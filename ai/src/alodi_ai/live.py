"""GPT Live sideband orchestration; transcripts are never playback evidence."""

import asyncio
import json
import re
import time
import uuid

import httpx
import websockets

from .conversation import is_confirmation
from .extract import extract
from .privacy import mask

INSTRUCTIONS = """Bạn là trợ lý giao hàng Alodi, nói tiếng Việt. Ứng dụng điều khiển từng bước.
Hỏi ngày giờ và địa điểm nhận hàng. Delegate mọi câu trả lời, thay đổi, xác nhận và yêu cầu ngừng liên hệ tới ứng dụng.
Chỉ đọc lại và hỏi điều ứng dụng yêu cầu; đợi chỉ dẫn ứng dụng sau mỗi câu trả lời, không tự chuyển bước.
Không nói đã lưu trước khi ứng dụng xác nhận. Sau xác nhận thông tin, ứng dụng sẽ yêu cầu hỏi ghi chú tùy chọn.
Không tự kết thúc trước lời chào ứng dụng cung cấp."""


class InputGateTimeout(TimeoutError):
    """Provider input control was not acknowledged; never open local input."""


AUDIO_CONTROL_ACK_TIMEOUT = 8


def no_more_notes(text):
    # Preserve every word so punctuation cannot turn a correction into consent.
    text = re.sub(r"[,.;:!?…]", " ", text)
    text = " ".join(text.split())
    return bool(
        re.fullmatch(
            r"\s*(?:dạ\s+|vâng\s+)?(?:không(?:\s+(?:có|cần))?(?:\s+(?:ghi\s+chú|gì))?(?:\s+(?:thêm|nữa))?|hết(?:\s+rồi)?|vậy\s+thôi|no(?:\s+more(?:\s+notes)?)?|nothing(?:\s+else)?)(?:\s+(?:thank\s+you|thanks))?(?:\s+(?:ạ|nhé))?\s*[.!?]?\s*",
            text,
            re.IGNORECASE,
        )
    )


def readback_mismatches(candidate, heard):
    def normalized(value):
        if isinstance(value, str):
            return " ".join(value.casefold().split())
        if isinstance(value, dict):
            return {k: normalized(v) for k, v in value.items() if k != "confidence"}
        return value

    mismatches = []
    for field in (
        "time_window",
        "drop_location",
        "alt_receiver",
        "address_correction",
        "cannot_receive",
    ):
        expected, actual = getattr(candidate, field), getattr(heard, field)
        if expected is None:
            if actual is not None:
                mismatches.append(field)
            continue
        if actual is None or (
            hasattr(actual, "confidence") and actual.confidence < 0.85
        ):
            mismatches.append(field)
            continue
        if normalized(expected.model_dump(by_alias=True, mode="json")) != normalized(
            actual.model_dump(by_alias=True, mode="json")
        ):
            mismatches.append(field)
    if candidate.opt_out != heard.opt_out:
        mismatches.append("opt_out")
    if normalized(candidate.delivery_notes) != normalized(heard.delivery_notes):
        mismatches.append("delivery_notes")
    return mismatches


def same_readback(candidate, heard):
    return not readback_mismatches(candidate, heard)


class LiveSession:
    def __init__(self, runtime, call):
        self.runtime, self.call = runtime, call
        self.ws = self.reader = self.task = self.boot = self.notes_timer = None
        self.session_id = None
        self.generation_id = str(uuid.uuid4())
        self.turn_id = 0
        self.playback_revision = 0
        self.phase = "greeting"
        self.input_allowed = self.ever_listened = False
        self.listen_after_ms = -1
        self.input_cutoff = None
        self.listening_windows = []
        self.input_events = set()
        self.input_evidence = []
        self.verified_readback = None
        self.verification_task = None
        self.tail_task = None
        self.readback_attempts = 0
        self.user_active = False
        self.last_input_activity = 0.0
        self.inputs, self.outputs = [], []
        self.input_revision = self.processed_revision = 0
        self.candidate = self.candidate_revision = None
        self.confirmed = self.final_after_confirmation = False
        self.readback = None
        self.readback_played = False
        self.output_start = 0
        self.output_heard = self.notes_pending = self.finalizing = False
        self.processing = self.playback_blocked = False
        self.last_content = None
        self.closing_reason = None
        self.started = asyncio.Event()
        self.started_source = None
        self.acks = {}
        self.audio_lock = asyncio.Lock()
        self.input_muted = None
        self.control_lock = asyncio.Lock()
        self.delegate_lock = asyncio.Lock()

    async def open(self, sdp):
        settings = self.runtime.settings
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key.get_secret_value()}"
        }
        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            response = await client.post(
                "https://api.openai.com/v1/live/sessions",
                json={
                    "session": {
                        "model": settings.openai_live_model,
                        "instructions": INSTRUCTIONS,
                        "input": [
                            {
                                "type": "message",
                                "role": "developer",
                                "content": [
                                    {
                                        "type": "input_text",
                                        "text": "Consent is complete. Greet the buyer and ask their delivery time and place, in Vietnamese. Wait for application commentary.",
                                    }
                                ],
                            }
                        ],
                        "delegation": {
                            "type": "client",
                            "acknowledgement_delay_ms": 800,
                        },
                        "audio": {"output": {"voice": settings.openai_live_voice}},
                        "store": False,
                    },
                    "transport": {"type": "webrtc", "sdp": sdp},
                },
            )
            response.raise_for_status()
            result = response.json()
        self.session_id = result["session"]["id"]
        self.ws = await websockets.connect(
            f"wss://api.openai.com/v1/live/sessions/{self.session_id}/attach",
            additional_headers=headers,
            open_timeout=20,
        )
        self.reader = asyncio.create_task(self.read())
        # WebRTC starts after the browser installs this answer, so do not block it.
        self.boot = asyncio.create_task(self.begin())
        await self.state()
        return result["transport"]["sdp"]

    async def begin(self):
        try:
            await asyncio.wait_for(self.started.wait(), 25)
            await self.say(
                None,
                "Xin chào, bạn muốn nhận hàng vào ngày giờ nào và ở địa điểm nào?",
                "greeting",
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            await self.runtime.end(self.call, "voice_start_failed")

    async def state(self):
        await self.runtime.emit(
            self.call,
            {
                "type": "turn_state",
                "generation_id": self.generation_id,
                "turn_id": self.turn_id,
                "phase": self.phase,
                "input_allowed": self.input_allowed,
                "playback_revision": self.playback_revision,
                "notes_timeout_seconds": 8
                if self.phase == "notes" and not self.call.explicit_finish
                else None,
            },
        )

    def cancel_notes_timer(self):
        if self.notes_timer and self.notes_timer is not asyncio.current_task():
            self.notes_timer.cancel()
        self.notes_timer = None

    async def audio_control(self, muted):
        # Serialize toggles and reuse only an acknowledged state. Some provider
        # revisions do not emit another acknowledgement for redundant toggles.
        async with self.audio_lock:
            if self.input_muted is muted:
                return
            if self.call.local_input_gate is not None:
                try:
                    await self.call.local_input_gate(muted)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # noqa: BLE001 - fail closed at the device boundary
                    raise InputGateTimeout("browser_local_gate") from exc
                self.input_muted = muted
                return
            identity = (self.generation_id, self.turn_id, self.playback_revision)
            for attempt in range(2 if muted else 1):
                event_id = str(uuid.uuid4())
                future = asyncio.get_running_loop().create_future()
                expected = (
                    "session.input_audio.muted"
                    if muted
                    else "session.input_audio.unmuted"
                )
                self.acks[event_id] = (expected, future)
                try:
                    await self.ws.send(
                        json.dumps(
                            {
                                "type": "session.input_audio.mute"
                                if muted
                                else "session.input_audio.unmute",
                                "event_id": event_id,
                            }
                        )
                    )
                    try:
                        await asyncio.wait_for(future, AUDIO_CONTROL_ACK_TIMEOUT)
                    except TimeoutError as exc:
                        if (
                            muted
                            and attempt == 0
                            and self.call.status == "connected"
                            and identity
                            == (
                                self.generation_id,
                                self.turn_id,
                                self.playback_revision,
                            )
                        ):
                            await self.runtime.emit(
                                self.call,
                                {
                                    "type": "notice",
                                    "code": "input_gate_retry",
                                    "message": "Audio remains paused while its connection recovers.",
                                },
                            )
                            continue
                        raise InputGateTimeout("mute" if muted else "unmute") from exc
                    self.input_muted = muted
                    return
                finally:
                    self.acks.pop(event_id, None)

    async def say(self, delegation_id, content, phase):
        async with self.control_lock:
            self.cancel_notes_timer()
            self.input_allowed = False
            self.processing = False
            self.user_active = False
            self.last_content = content
            self.phase = phase
            self.turn_id += 1
            self.playback_revision = 0
            self.output_heard = False
            self.output_start = len(self.outputs)
            self.readback_played = False
            self.verified_readback = None
            if (
                self.verification_task
                and self.verification_task is not asyncio.current_task()
            ):
                self.verification_task.cancel()
            if phase == "confirming":
                self.readback = (self.output_start, None, self.candidate_revision)
            await self.state()
            await self.audio_control(True)
            await self.ws.send(
                json.dumps(
                    {
                        "type": "session.commentary.append",
                        "event_id": str(uuid.uuid4()),
                        "delegation_id": delegation_id,
                        "content": content,
                    },
                    ensure_ascii=False,
                )
            )

    async def browser_event(self, payload):
        try:
            await self._browser_event(payload)
        except InputGateTimeout:
            self.input_allowed = False
            self.cancel_notes_timer()
            await self.runtime.emit(
                self.call,
                {
                    "type": "error",
                    "code": "input_gate_failed",
                    "message": "Audio control could not be verified. Please reconnect or use chat.",
                },
            )
            await self.runtime.end(self.call, "input_gate_failed")

    async def _browser_event(self, payload):
        if (
            payload.get("generation_id") != self.generation_id
            or payload.get("turn_id") != self.turn_id
            or self.call.status != "connected"
        ):
            return
        typ = payload.get("type")
        if typ == "user_activity":
            active = bool(payload.get("active"))
            if active and not self.input_allowed:
                return
            self.user_active = active
            self.last_input_activity = time.monotonic()
            if self.user_active:
                self.cancel_notes_timer()
            elif (
                self.phase == "notes"
                and self.input_allowed
                and not self.notes_pending
                and self.processed_revision == self.input_revision
            ):
                self.arm_notes_timer()
            return
        if typ != "playback_state":
            return
        revision = payload.get("playback_revision")
        if not isinstance(revision, int) or revision < self.playback_revision:
            return
        self.playback_revision = revision
        state = payload.get("state")
        if state == "ready" and self.playback_blocked and self.last_content:
            self.playback_blocked = False
            await self.say(None, self.last_content, self.phase)
            return
        if state in ("failed", "blocked"):
            if state == "blocked" and self.playback_blocked:
                return
            self.playback_blocked = True
            self.input_allowed = False
            self.cancel_notes_timer()
            await self.state()
            if state == "failed":
                await self.runtime.end(self.call, "playback_failed")
            return
        if state == "playing":
            self.output_heard = True
            if self.input_allowed:
                self.input_allowed = False
                self.cancel_notes_timer()
                await self.state()
                await self.audio_control(True)
            return
        if (
            state != "drained"
            or not self.output_heard
            or self.input_allowed
            or self.processing
            or self.playback_blocked
        ):
            return
        async with self.control_lock:
            if payload.get("turn_id") != self.turn_id:
                return
            if self.phase == "closing":
                await self.runtime.end(self.call, self.closing_reason or "completed")
                return
            if self.phase == "confirming":
                if not self.readback or len(self.outputs) <= self.readback[0]:
                    return
                self.readback = (
                    self.readback[0],
                    len(self.outputs),
                    self.candidate_revision,
                )
                self.readback_played = True
                if self.verification_task and not self.verification_task.done():
                    self.verification_task.cancel()
                identity = (
                    self.turn_id,
                    self.candidate_revision,
                    self.readback,
                    self.playback_revision,
                )
                self.verification_task = asyncio.create_task(
                    self.verify_prompt(identity)
                )
                return
            await self.enable_input()

    async def enable_input(self, identity=None):
        await self.audio_control(False)
        if self.call.status != "connected":
            return
        if identity and not self.current_readback(identity):
            await self.audio_control(True)
            return
        self.input_allowed = self.ever_listened = True
        self.listen_after_ms = max((x[1] for x in self.outputs), default=-1)
        self.input_cutoff = None
        if self.phase == "greeting":
            self.phase = "collecting"
        self.listening_windows.append(
            [
                self.listen_after_ms,
                None,
                self.phase,
                self.verified_readback,
                self.turn_id,
            ]
        )
        await self.state()
        if self.phase == "notes" and not self.notes_pending:
            self.arm_notes_timer()

    def current_readback(self, identity):
        return (
            identity
            == (
                self.turn_id,
                self.candidate_revision,
                self.readback,
                self.playback_revision,
            )
            and self.readback_played
            and not self.playback_blocked
            and self.readback
            and self.readback[1] == len(self.outputs)
        )

    async def verify_prompt(self, identity):
        try:
            readback = identity[2]
            spoken = "".join(x[2] for x in self.outputs[readback[0] : readback[1]])
            heard = await asyncio.wait_for(
                extract(
                    self.runtime.settings,
                    self.call.snapshot,
                    spoken,
                    "assistant_readback",
                    self.call.usage,
                    self.candidate,
                ),
                30,
            )
            if self.call.status != "connected" or not self.current_readback(identity):
                return
            if not same_readback(self.candidate, heard):
                await self.runtime.emit(
                    self.call,
                    {
                        "type": "notice",
                        "code": "readback_mismatch",
                        "message": "Please wait while the delivery details are repeated.",
                        "fields": readback_mismatches(self.candidate, heard),
                    },
                )
                await self.repeat_readback()
                return
            async with self.control_lock:
                if self.current_readback(identity):
                    self.verified_readback = identity
                    await self.enable_input(identity)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if self.call.status == "connected":
                await self.runtime.emit(
                    self.call,
                    {
                        "type": "notice",
                        "code": "readback_verification_failed",
                        "message": "Please wait while the delivery details are repeated.",
                        "error_type": type(exc).__name__,
                        "http_status": getattr(exc, "status_code", None),
                    },
                )
                await self.repeat_readback()

    async def repeat_readback(self):
        if self.readback_attempts >= 3:
            await self.runtime.emit(
                self.call,
                {
                    "type": "error",
                    "code": "readback_verification_failed",
                    "message": "Could not verify the spoken delivery details. Please use chat.",
                },
            )
            await self.runtime.end(self.call, "readback_verification_failed")
            return
        await self.read_back(None)

    def arm_notes_timer(self):
        self.cancel_notes_timer()
        if self.call.explicit_finish:
            return
        revision, turn = self.input_revision, self.turn_id

        async def expire():
            await asyncio.sleep(8)
            if (
                self.call.status == "connected"
                and self.phase == "notes"
                and self.input_allowed
                and not self.notes_pending
                and not self.user_active
                and self.confirmed
                and revision == self.input_revision
                and turn == self.turn_id
            ):
                await self.finalize(None)

        self.notes_timer = asyncio.create_task(expire())

    async def read(self):
        try:
            async for raw in self.ws:
                e = json.loads(raw)
                typ = e.get("type")
                if typ == "session.started":
                    self.started_source = "sideband"
                    self.started.set()
                elif typ in (
                    "session.input_audio.muted",
                    "session.input_audio.unmuted",
                ):
                    entry = self.acks.get(e.get("client_event_id"))
                    if entry and typ == entry[0] and not entry[1].done():
                        entry[1].set_result(None)
                elif typ == "session.input_transcript.delta":
                    start, end = e.get("start_ms", 0), e.get("end_ms", 0)
                    # Every closed listening interval remains valid for late delivery.
                    event_id = e.get("event_id")
                    if not self.interval_phase(start) or (
                        event_id and event_id in self.input_events
                    ):
                        continue
                    if event_id:
                        self.input_events.add(event_id)
                    self.input_revision += 1
                    self.last_input_activity = time.monotonic()
                    self.notes_pending = self.phase == "notes" or self.notes_pending
                    self.cancel_notes_timer()
                    window = self.interval(start)
                    self.input_evidence.append(window[3] if len(window) > 3 else None)
                    self.inputs.append(
                        (
                            start,
                            end,
                            mask(e.get("delta", ""), self.call.snapshot.known_pii),
                        )
                    )
                    await self.runtime.emit(
                        self.call,
                        {
                            "type": "transcript",
                            "speaker": "buyer",
                            "text": "".join(
                                x[2] for x in self.inputs[self.processed_revision :]
                            ),
                            "final": False,
                            "turn_id": self.turn_id,
                        },
                    )
                    if (
                        window[4] != self.turn_id
                        and self.input_revision > self.processed_revision
                    ):
                        # STT from an earlier listening interval can arrive after
                        # its proposal/readback. It invalidates that proposal;
                        # a second provider delegation is not guaranteed.
                        self.confirmed = False
                        self.readback_played = False
                        self.verified_readback = None
                        self.input_allowed = False
                        self.processing = True
                        if self.verification_task and not self.verification_task.done():
                            self.verification_task.cancel()
                        await self.state()
                        if self.tail_task is None or self.tail_task.done():
                            self.tail_task = asyncio.create_task(
                                self.delegate(None, end, self.input_revision)
                            )
                elif typ == "session.output_transcript.delta":
                    self.outputs.append(
                        (
                            e.get("start_ms", 0),
                            e.get("end_ms", 0),
                            mask(e.get("delta", ""), self.call.snapshot.known_pii),
                        )
                    )
                    if self.input_allowed:
                        self.input_allowed = False
                        self.cancel_notes_timer()
                        await self.state()
                        asyncio.create_task(self.mute_spontaneous())
                    if self.listening_windows and self.listening_windows[-1][1] is None:
                        self.listening_windows[-1][1] = e.get("start_ms", 0)
                    if self.phase == "confirming" and self.readback_played:
                        self.readback_played = False
                        self.verified_readback = None
                        self.readback = (
                            self.readback[0],
                            None,
                            self.candidate_revision,
                        )
                    await self.runtime.emit(
                        self.call,
                        {
                            "type": "transcript",
                            "speaker": "assistant",
                            "text": "".join(
                                x[2] for x in self.outputs[self.output_start :]
                            ),
                            "final": False,
                            "turn_id": self.turn_id,
                        },
                    )
                elif typ == "session.delegation.created":
                    delegation_id = e.get("delegation", {}).get("id")
                    if delegation_id:
                        if self.input_revision > self.processed_revision:
                            self.processing = True
                        # Documented quiet progress cancels pending automatic
                        # acknowledgements before they invalidate a readback.
                        await self.ws.send(
                            json.dumps(
                                {
                                    "type": "session.thinking.append",
                                    "event_id": str(uuid.uuid4()),
                                    "delegation_id": delegation_id,
                                    "content": "",
                                }
                            )
                        )
                        self.input_cutoff = e.get("offset_ms", 0)
                        # A provider delegation is speculative, not evidence that
                        # buyer audio ended. Keep its STT interval open through
                        # the tail; actual assistant output closes the interval.
                        self.task = asyncio.create_task(
                            self.delegate(
                                delegation_id, self.input_cutoff, self.input_revision
                            )
                        )
                elif typ == "session.closed":
                    await self.runtime.emit(
                        self.call, {"type": "usage", "usage": e.get("usage")}
                    )
                    break
                elif typ == "error":
                    raise ValueError("Live provider error")
        except asyncio.CancelledError:
            raise
        except Exception:
            await self.runtime.emit(
                self.call,
                {
                    "type": "error",
                    "code": "voice_failed",
                    "message": "Live session disconnected.",
                },
            )
        finally:
            if self.call.status in ("connecting", "connected"):
                await self.runtime.end(self.call, "voice_disconnected")

    async def mute_spontaneous(self):
        try:
            await self.audio_control(True)
        except Exception:
            await self.runtime.end(self.call, "input_gate_failed")

    def interval(self, start):
        for window in reversed(self.listening_windows):
            lower, upper, phase = window[:3]
            if start >= lower and (upper is None or start <= upper):
                return window
        return None

    def interval_phase(self, start):
        window = self.interval(start)
        return window[2] if window else None

    async def delegate(self, delegation_id, offset, revision):
        async with self.delegate_lock:
            if self.finalizing or self.call.status != "connected":
                return
            if self.input_revision > self.processed_revision:
                self.processing = True
            # Keep listening through the end of actual buyer activity and a quiet
            # transcript frontier. GPT Live has no response/turn-done event.
            while self.user_active or time.monotonic() - self.last_input_activity < 1.8:
                await asyncio.sleep(0.1)
                if self.call.status != "connected":
                    return
            revision = self.input_revision
            if revision <= self.processed_revision:
                return
            self.processing = True
            self.cancel_notes_timer()
            try:
                current_inputs = self.inputs[self.processed_revision : revision]
                text = "".join(x[2] for x in current_inputs).strip()
                if not text:
                    return
                input_phase = self.interval_phase(current_inputs[0][0])
                if (
                    self.phase == "notes"
                    and input_phase == "notes"
                    and self.confirmed
                    and no_more_notes(text)
                ):
                    self.processed_revision = revision
                    self.notes_pending = False
                    await self.finalize(delegation_id)
                    return
                evidence = (
                    self.input_evidence[self.processed_revision]
                    if self.input_evidence
                    else None
                )
                if (
                    self.phase == "confirming"
                    and self.candidate
                    and evidence
                    and evidence[1] == self.candidate_revision
                    and input_phase == "confirming"
                    and is_confirmation(text)
                ):
                    # Evidence was verified before this listening interval opened.
                    # A generic post-answer acknowledgement cannot erase it.
                    self.processed_revision = revision
                    self.confirmed = True
                    self.notes_pending = False
                    if self.final_after_confirmation:
                        await self.finalize(delegation_id)
                    else:
                        await self.say(
                            delegation_id,
                            "Bạn có muốn ghi chú thêm điều gì cho người giao hàng không? Nếu không có, bạn có thể nói không hoặc kết thúc cuộc gọi.",
                            "notes",
                        )
                    return
                was_notes = self.phase == "notes"
                conversation = "".join(
                    x[2]
                    for x in sorted(
                        self.inputs[:revision], key=lambda item: (item[0], item[1])
                    )
                )
                proposal = await asyncio.wait_for(
                    extract(
                        self.runtime.settings,
                        self.call.snapshot,
                        conversation,
                        "ai_call",
                        self.call.usage,
                    ),
                    30,
                )
                if revision != self.input_revision or self.call.status != "connected":
                    if self.call.status == "connected":
                        self.task = asyncio.create_task(
                            self.delegate(delegation_id, offset, self.input_revision)
                        )
                    return
                self.processed_revision = revision
                self.candidate, self.candidate_revision = proposal, revision
                self.readback_attempts = 0
                self.confirmed = self.notes_pending = False
                self.final_after_confirmation = (
                    was_notes or self.final_after_confirmation
                )
                await self.runtime.emit(
                    self.call,
                    {
                        "type": "proposal",
                        "revision": revision,
                        "context": proposal.model_dump(by_alias=True, mode="json"),
                    },
                )
                if proposal.opt_out:
                    await self.finalize(delegation_id, opt_out=True)
                elif not proposal.time_window or not proposal.drop_location:
                    await self.say(
                        delegation_id,
                        "Bạn vui lòng cho biết đầy đủ ngày giờ và địa điểm nhận hàng. Thông tin chưa được lưu.",
                        "collecting",
                    )
                else:
                    await self.read_back(delegation_id)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                if self.call.status == "connected":
                    await self.runtime.emit(
                        self.call,
                        {
                            "type": "notice",
                            "code": "voice_processing_failed",
                            "message": "Could not verify this turn. Please repeat or use chat.",
                            "error_type": type(exc).__name__,
                            "http_status": getattr(exc, "status_code", None),
                        },
                    )
                    await self.say(
                        delegation_id,
                        "Chưa thể xác nhận thông tin. Bạn vui lòng nhắc lại hoặc chọn chat.",
                        "collecting",
                    )

    async def read_back(self, delegation_id):
        self.confirmed = False
        self.readback_attempts += 1
        location_labels = {
            "hand_to_buyer": "giao tận tay người nhận",
            "security_desk": "bàn bảo vệ",
            "reception": "lễ tân",
            "neighbour": "hàng xóm",
            "locker": "tủ nhận hàng",
            "other": "địa điểm khác theo mô tả của khách",
        }
        category = (
            self.candidate.drop_location.type if self.candidate.drop_location else None
        )
        location_instruction = (
            f"Tên địa điểm phải đọc chính xác là '{location_labels[category]}'. "
            "Bàn bảo vệ (security_desk) và lễ tân (reception) là hai địa điểm khác nhau; "
            "không thay thế địa điểm hoặc thêm thông tin không có trong JSON. "
            if category
            else ""
        )
        await self.say(
            delegation_id,
            location_instruction
            + "Đọc lại chính xác toàn bộ thông tin sau, bao gồm ghi chú nếu có, rồi hỏi khách xác nhận. Không đọc confidence hoặc tên trường JSON: "
            + json.dumps(
                self.candidate.model_dump(by_alias=True, mode="json"),
                ensure_ascii=False,
            ),
            "confirming",
        )

    async def finish_requested(self, reason="hangup"):
        if (
            not self.candidate
            or not self.confirmed
            or not self.candidate.time_window
            or not self.candidate.drop_location
            or self.processed_revision != self.input_revision
        ):
            await self.runtime.emit(
                self.call,
                {
                    "type": "result",
                    "status": "needs_clarification",
                    "message": "Delivery details were incomplete or unconfirmed. No card was saved.",
                },
            )
            await self.runtime.end(self.call, "hangup_incomplete")
            return
        await self.finalize(None, hangup=True)

    async def finalize(self, delegation_id, opt_out=False, hangup=False):
        try:
            await self._finalize(delegation_id, opt_out, hangup)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - close media for any unexpected finalization failure
            self.finalizing = False
            self.input_allowed = False
            self.cancel_notes_timer()
            try:
                await self.runtime.emit(
                    self.call,
                    {
                        "type": "error",
                        "code": "finalization_failed",
                        "message": "Could not complete the delivery update. Please check the saved status or use chat.",
                    },
                )
            finally:
                await self.runtime.end(self.call, "finalization_failed")

    async def _finalize(self, delegation_id, opt_out=False, hangup=False):
        if self.finalizing or self.call.status != "connected" or not self.candidate:
            return
        if not opt_out and (
            not self.confirmed
            or not self.candidate.time_window
            or not self.candidate.drop_location
        ):
            return
        revision = self.input_revision
        self.finalizing = True
        self.input_allowed = False
        self.cancel_notes_timer()
        await self.state()
        await self.audio_control(True)
        if revision != self.input_revision or (self.user_active and not hangup):
            self.finalizing = False
            if hangup:
                await self.runtime.emit(
                    self.call,
                    {
                        "type": "result",
                        "status": "needs_clarification",
                        "message": "A late correction was not confirmed. No card was saved.",
                    },
                )
                await self.runtime.end(self.call, "hangup_incomplete")
                return
            if self.input_revision > self.processed_revision:
                self.task = asyncio.create_task(
                    self.delegate(
                        delegation_id, self.input_cutoff or 0, self.input_revision
                    )
                )
            else:
                await self.audio_control(False)
                self.input_allowed = True
                await self.state()
            return
        status = await self.runtime.bridge.submit(
            self.call.snapshot,
            self.candidate,
            "ai_call",
            self.confirmed and not opt_out,
            self.candidate_revision,
            f"{self.call.id}:{self.candidate_revision}",
        )
        await self.runtime.emit(
            self.call,
            {
                "type": "result",
                "status": status,
                "context": self.candidate.model_dump(by_alias=True, mode="json"),
            },
        )
        self.closing_reason = "opt_out" if opt_out else status
        if hangup:
            await self.runtime.end(self.call, self.closing_reason)
            return
        if opt_out and status == "applied":
            line = "Đã ghi nhận yêu cầu ngừng liên hệ. Cảm ơn bạn, xin chào."
        elif status == "applied":
            line = "Đã lưu thông tin giao hàng của bạn. Cảm ơn bạn, chúc bạn một ngày tốt lành. Xin chào."
        else:
            line = "Thông tin chưa được áp dụng, cần kiểm tra thêm. Bạn vui lòng dùng chat hoặc liên hệ hỗ trợ. Cảm ơn bạn, xin chào."
        await self.say(delegation_id, line, "closing")

    async def close(self):
        self.cancel_notes_timer()
        current = asyncio.current_task()
        for task in (self.task, self.boot, self.verification_task, self.tail_task):
            if task and task is not current:
                task.cancel()
        for _, future in self.acks.values():
            if not future.done():
                future.cancel()
        if self.ws:
            try:
                try:
                    await self.ws.send(
                        json.dumps(
                            {"type": "session.close", "event_id": str(uuid.uuid4())}
                        )
                    )
                except websockets.exceptions.ConnectionClosed:
                    pass
                if self.reader and self.reader is not current:
                    try:
                        await asyncio.wait_for(asyncio.shield(self.reader), 3)
                    except TimeoutError:
                        self.reader.cancel()
            finally:
                await self.ws.close()
