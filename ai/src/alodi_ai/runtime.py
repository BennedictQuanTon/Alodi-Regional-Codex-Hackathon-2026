import asyncio
import json
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import (
    APIRouter,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .bridge import FixtureBridge
from .conversation import is_confirmation
from .extract import extract
from .live import LiveSession
from .memo import transcribe
from .privacy import mask
from .settings import Settings

DISCLOSURE = "Đây là cuộc gọi hỗ trợ giao hàng bằng AI. Âm thanh sẽ được xử lý bởi dịch vụ đám mây. Bạn có đồng ý tiếp tục không? Bạn có thể chọn dùng chat."


class Connect(BaseModel):
    consent: bool
    sdp: str | None = None


class End(BaseModel):
    reason: str = "hangup"


class Create(BaseModel):
    tracking_id: str | None = None


class Turn(BaseModel):
    call_id: str
    text: str


@dataclass
class Call:
    id: str
    snapshot: object
    status: str = "ringing"
    socket: WebSocket | None = None
    revision: int = 0
    proposal: object = None
    readback: bool = False
    utterance_id: str | None = None
    proposal_revision: int | None = None
    clarifications: int = 0
    buyer_turns: list[str] = field(default_factory=list)
    usage: list = field(default_factory=list)
    started_monotonic: float = field(default_factory=time.monotonic)
    ended_monotonic: float | None = None
    task: asyncio.Task | None = None
    timeout: asyncio.Task | None = None
    upstream: object = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class Runtime:
    def __init__(self, settings, bridge):
        self.settings, self.bridge = settings, bridge
        self.calls, self.jobs, self.job_tasks = {}, {}, {}
        self.reservation_lock = asyncio.Lock()

    async def reserve_call(self, tracking_id, call_id=None):
        async with self.reservation_lock:
            if call_id and call_id in self.calls:
                call = self.calls[call_id]
                if call.snapshot.tracking_id != tracking_id or call.status == "ended":
                    raise ValueError("Call reservation is no longer current")
                return call
            if call_id is None and any(c.status != "ended" for c in self.calls.values()):
                raise ValueError("A call is already active")
            snapshot = await self.bridge.snapshot(tracking_id)
            if not snapshot.eligible:
                raise ValueError("Contact blocked")
            call = Call(call_id or str(uuid.uuid4()), snapshot)
            self.calls[call.id] = call

            async def expire_reservation():
                await asyncio.sleep(120)
                if call.status in ("ringing", "connecting"):
                    await self.end(call, "reservation_timeout")

            call.timeout = asyncio.create_task(expire_reservation())
            return call

    async def shutdown(self):
        for job_id, task in list(self.job_tasks.items()):
            if not task.done():
                self.jobs[job_id]["status"] = "cancelled"
                task.cancel()
        await asyncio.gather(
            *(self.end(call, "shutdown") for call in list(self.calls.values())),
            return_exceptions=True,
        )
        await asyncio.gather(*self.job_tasks.values(), return_exceptions=True)

    async def emit(self, call, message):
        if message.get("type") == "usage":
            call.usage.append(message)
        if call.socket:
            try:
                await call.socket.send_json(message)
            except (RuntimeError, WebSocketDisconnect):
                call.socket = None
                if call.status != "ended":
                    asyncio.create_task(self.end(call, "socket_disconnected"))

    async def end(self, call, reason="hangup"):
        if call.status == "ended":
            return
        call.status = "ended"
        call.ended_monotonic = time.monotonic()
        call.revision += 1
        current = asyncio.current_task()
        for task in (call.task, call.timeout):
            if task and task is not current:
                task.cancel()
        await self.emit(call, {"type": "audio_clear"})
        await self.emit(call, {"type": "media_stop", "reason": reason})
        try:
            ended = getattr(self.bridge, "call_ended", None)
            if ended:
                await ended(call, reason)
        finally:
            await self._close_media(call, reason)

    async def _close_media(self, call, reason):
        try:
            if call.upstream is not None:
                upstream, call.upstream = call.upstream, None
                async with asyncio.timeout(16):
                    await upstream.close()
        finally:
            await self.emit(
                call, {"type": "status", "status": "ended", "reason": reason}
            )

    async def clarification(self, call):
        call.clarifications += 1
        if call.clarifications >= 2:
            await self.emit(
                call,
                {
                    "type": "result",
                    "status": "needs_clarification",
                    "message": "Use chat or request human review.",
                },
            )
            await self.end(call, "clarification_limit")
            return True
        return False

    async def turn(self, call, text, turn_id=None):
        async with call.lock:
            await self._turn_locked(call, text, turn_id)

    async def _turn_locked(self, call, text, turn_id=None):
        if call.status != "connected":
            raise HTTPException(409, "Call is not connected")
        safe = mask(text, call.snapshot.known_pii)
        affirmative = is_confirmation(text)
        confirming = (
            affirmative
            and call.proposal is not None
            and call.readback
            and call.proposal_revision == call.revision
        )
        if not confirming:
            call.revision += 1
            revision = call.revision
            call.readback = False
            call.proposal = None
            call.proposal_revision = None
            call.utterance_id = None
            call.buyer_turns.append(safe)
            conversation = "\n".join(call.buyer_turns)
            if call.task:
                call.task.cancel()
        await self.emit(
            call,
            {
                "type": "transcript",
                "speaker": "buyer",
                "text": safe,
                "final": True,
                "turn_id": turn_id or str(uuid.uuid4()),
            },
        )
        if call.status != "connected":
            return
        if (
            confirming
            and call.proposal is not None
            and call.readback
            and call.proposal_revision == call.revision
        ):
            revision = call.revision
            status = await self.bridge.submit(
                call.snapshot,
                call.proposal,
                "ai_call",
                True,
                revision,
                f"{call.id}:{revision}",
            )
            await self.emit(
                call,
                {
                    "type": "result",
                    "status": status,
                    "context": call.proposal.model_dump(by_alias=True, mode="json"),
                },
            )
            if status == "applied":
                await self.end(call, "applied")
            elif status == "needs_clarification":
                await self.clarification(call)
            return
        await self.emit(call, {"type": "audio_clear"})

        async def run():
            try:
                proposal = await asyncio.wait_for(
                    extract(
                        self.settings,
                        call.snapshot,
                        conversation,
                        "ai_call",
                        call.usage,
                    ),
                    30,
                )
                if call.status != "connected" or revision != call.revision:
                    return
                current = await self.bridge.snapshot(call.snapshot.tracking_id)
                if (current.demo_epoch, current.context_version) != (
                    call.snapshot.demo_epoch,
                    call.snapshot.context_version,
                ):
                    return
                call.proposal = proposal
                call.proposal_revision = revision
                context = proposal.model_dump(by_alias=True, mode="json")
                await self.emit(
                    call, {"type": "proposal", "revision": revision, "context": context}
                )
                if proposal.opt_out:
                    status = await self.bridge.submit(
                        call.snapshot,
                        proposal,
                        "ai_call",
                        False,
                        revision,
                        f"{call.id}:{revision}",
                    )
                    await self.emit(
                        call, {"type": "result", "status": status, "context": context}
                    )
                    await self.end(call, "opt_out")
                    return
                if not proposal.time_window or not proposal.drop_location:
                    if await self.clarification(call):
                        return
                # Typed fixture readback is visible text; voice requires actual playback evidence.
                call.utterance_id = str(uuid.uuid4())
                if self.settings.mode == "live":
                    window = proposal.time_window
                    drop = proposal.drop_location
                    if window and drop:
                        line = f"Xin xác nhận giao ngày {window.date}, từ {window.from_.strftime('%H:%M')} đến {window.to.strftime('%H:%M')}, địa điểm {drop.note or drop.type}."
                        if proposal.alt_receiver:
                            line += f" Người nhận thay: {proposal.alt_receiver.relation}, số {proposal.alt_receiver.phone_masked}."
                        if proposal.address_correction:
                            line += f" Địa chỉ sửa: {proposal.address_correction.text}."
                        if proposal.cannot_receive:
                            line += (
                                f" Lý do không nhận: {proposal.cannot_receive.reason}."
                            )
                        line += " Bạn đồng ý không?"
                    else:
                        line = "Bạn vui lòng cho biết ngày giờ và địa điểm nhận hàng cụ thể."
                else:
                    line = "Please confirm the proposed delivery details shown above."
                await self.emit(
                    call,
                    {
                        "type": "transcript",
                        "speaker": "assistant",
                        "text": line,
                        "final": True,
                        "turn_id": call.utterance_id,
                    },
                )
                call.readback = True
            except asyncio.CancelledError:
                raise
            except Exception:
                await self.emit(
                    call,
                    {
                        "type": "error",
                        "code": "extraction_failed",
                        "message": "Could not process this turn.",
                    },
                )

        call.task = asyncio.create_task(run())

    async def memo_job(self, job_id, snapshot, data):
        job = self.jobs[job_id]
        start = time.monotonic()
        job["usage"] = []
        job["models"] = {
            "transcription": self.settings.openai_memo_model,
            "extraction": self.settings.openai_model,
        }
        try:

            async def process():
                text = await transcribe(self.settings, data)
                proposal = await asyncio.wait_for(
                    extract(
                        self.settings, snapshot, text, "shipper_memo", job["usage"]
                    ),
                    30,
                )
                return text, proposal

            text, proposal = await asyncio.wait_for(process(), 60)
            result = await self.bridge.submit(
                snapshot, proposal, "shipper_memo", False, 1, job_id
            )
            job.update(
                status="completed",
                transcript=mask(text, snapshot.known_pii),
                context=proposal.model_dump(by_alias=True, mode="json"),
                result=result,
            )
        except asyncio.CancelledError:
            job.update(status="cancelled")
            raise
        except Exception:
            job.update(status="failed", error="Memo could not be processed.")
        finally:
            job["elapsed_seconds"] = round(time.monotonic() - start, 3)


def create_app(settings=None, bridge=None, fixture=False):
    settings = settings or Settings()
    if bridge is None:
        if not fixture:
            raise ValueError("An authoritative bridge is required")
        bridge = FixtureBridge()
    runtime = Runtime(settings, bridge)

    @asynccontextmanager
    async def lifespan(app):
        yield
        await runtime.shutdown()

    app = FastAPI(title="Alodi AI", lifespan=lifespan)
    if fixture:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
            allow_methods=["GET", "POST"],
            allow_headers=["*"],
        )
    app.state.runtime = runtime
    router = APIRouter()

    @router.get("/ai/config")
    async def config():
        current_mode = getattr(bridge, "current_mode", None)
        mode = await current_mode() if current_mode else settings.mode
        missing = settings.missing() if mode != "offline" else []
        return {
            "mode": mode,
            "voice_provider": settings.voice_provider,
            "language": "vi",
            "transport": "webrtc",
            "ready": mode != "offline" and not missing,
            "models": {"voice": settings.openai_live_model,
                       "extraction": settings.openai_model,
                       "memo": settings.openai_memo_model},
            "bridge_mode": "fixture" if fixture else "part1",
            "missing_variables": missing,
            "limits": {"call_seconds": settings.call_max_duration_seconds,
                       "memo_seconds": 10, "memo_bytes": 5242880},
            "disclosure": {"text": DISCLOSURE, "audio_url": "/ai/disclosure.mp3"},
        }

    @router.get("/ai/disclosure.mp3")
    async def disclosure_audio():
        return FileResponse(
            Path(__file__).with_name("disclosure.mp3"), media_type="audio/mpeg"
        )

    if fixture:

        @router.get("/ai/dev/fixture")
        async def get_fixture():
            s = await bridge.snapshot(bridge.state.tracking_id)
            return {
                "tracking_id": s.tracking_id,
                "context_version": s.context_version,
                "demo_epoch": s.demo_epoch,
                "context": s.context.model_dump(by_alias=True, mode="json"),
                "events": bridge.events,
            }

        @router.post("/ai/dev/calls")
        async def create_call(body: Create):
            try:
                call = await runtime.reserve_call(
                    body.tracking_id or bridge.state.tracking_id
                )
            except KeyError:
                raise HTTPException(404, "Order not found") from None
            except ValueError as exc:
                raise HTTPException(409, str(exc)) from None
            snap = call.snapshot
            return {
                "call_id": call.id,
                "tracking_id": snap.tracking_id,
                "voice_provider": settings.voice_provider,
                "ws_path": f"/ws/call?session={call.id}",
                "status": call.status,
            }

        @router.post("/ai/dev/reset")
        async def reset():
            bridge.reset()
            for job_id, task in list(runtime.job_tasks.items()):
                if not task.done():
                    runtime.jobs[job_id]["status"] = "cancelled"
                    task.cancel()
            await asyncio.gather(
                *(runtime.end(call, "reset") for call in list(runtime.calls.values()))
            )
            return await get_fixture()

        @router.post("/ai/dev/turn")
        async def typed_turn(body: Turn):
            call = runtime.calls.get(body.call_id)
            if not call:
                raise HTTPException(404, "Call not found")
            if settings.mode == "live":
                raise HTTPException(403, "Typed test turns require stub mode")
            await runtime.turn(call, body.text)
            return {"status": "accepted", "source": "typed_test"}

    @router.post("/ai/calls/{call_id}/connect")
    async def connect(call_id: str, body: Connect):
        call = runtime.calls.get(call_id)
        if not call:
            raise HTTPException(404, "Call not found")
        async with call.lock:
            if not body.consent:
                raise HTTPException(403, "Explicit consent required")
            if call.status != "ringing":
                raise HTTPException(409, "Call already connected or ended")
            if settings.mode == "offline":
                raise HTTPException(503, "Voice unavailable offline; use chat")
            if settings.mode == "live":
                if settings.missing():
                    raise HTTPException(503, "Missing required provider configuration")
                if not call.socket:
                    raise HTTPException(409, "Attach call websocket first")
                if not body.sdp:
                    raise HTTPException(400, "SDP offer required")
            # The host rechecks policy and records consent before any cloud audio.
            started = getattr(bridge, "call_started", None)
            if started:
                try:
                    call.snapshot = await started(call)
                except (KeyError, ValueError):
                    raise HTTPException(409, "Call is no longer eligible") from None
            if call.status != "ringing":
                raise HTTPException(409, "Call ended during authorization")
            if settings.mode == "live":
                call.status = "connecting"
                upstream = LiveSession(runtime, call)
                call.upstream = upstream
                try:
                    answer = await upstream.open(body.sdp)
                    if call.status != "connecting":
                        await upstream.close()
                        raise HTTPException(409, "Call ended during connection")
                except HTTPException:
                    if call.upstream is upstream:
                        call.upstream = None
                        await upstream.close()
                    raise
                except Exception:
                    if call.upstream is upstream:
                        call.upstream = None
                        await upstream.close()
                    await runtime.end(call, "connection_failed")
                    raise HTTPException(503, "Voice service unavailable") from None
            call.status = "connected"
            if call.timeout:
                call.timeout.cancel()

            async def expire():
                await asyncio.sleep(settings.call_max_duration_seconds)
                await runtime.end(call, "timeout")

            call.timeout = asyncio.create_task(expire())
            await runtime.emit(
                call,
                {
                    "type": "status",
                    "status": "connected",
                    "message": "Typed fixture mode; no live voice."
                    if settings.mode == "stub"
                    else "Voice connected.",
                },
            )
            result = {
                "call_id": call.id,
                "voice_provider": settings.voice_provider,
                "transport": "webrtc"
                if settings.mode == "live" and settings.voice_provider == "gpt_live"
                else "websocket",
                "ws_path": f"/ws/call?session={call.id}",
            }
            if settings.mode == "live" and settings.voice_provider == "gpt_live":
                result.update(session_id=call.upstream.session_id, sdp=answer)
            return result

    @router.get("/ai/calls/{call_id}")
    async def call_summary(call_id: str):
        call = runtime.calls.get(call_id)
        if not call:
            raise HTTPException(404, "Call not found")
        return {
            "call_id": call.id,
            "status": call.status,
            "usage": call.usage,
            "elapsed_seconds": round(
                (call.ended_monotonic or time.monotonic()) - call.started_monotonic, 3
            ),
            "models": {
                "voice": settings.openai_live_model,
                "extraction": settings.openai_model,
            },
        }

    @router.post("/ai/calls/{call_id}/end")
    async def end(call_id: str, body: End):
        call = runtime.calls.get(call_id)
        if not call:
            raise HTTPException(404, "Call not found")
        await runtime.end(call, body.reason)
        return {"call_id": call_id, "status": "ended"}

    @router.post("/orders/{tracking_id}/memo", status_code=202)
    async def memo(
        tracking_id: str,
        audio: UploadFile = File(...),
        generation_id: str | None = Form(None),
        context_version: int | None = Form(None),
        shipper_event_id: int | None = Form(None),
    ):
        try:
            snapshot = await bridge.snapshot(tracking_id)
        except KeyError:
            raise HTTPException(404, "Order not found") from None
        if settings.mode == "offline":
            raise HTTPException(503, "Memo unavailable offline")
        if settings.mode == "live" and settings.missing():
            raise HTTPException(503, "Missing OPENAI_API_KEY")
        data = await audio.read(5242881)
        await audio.close()
        if len(data) > 5242880:
            raise HTTPException(413, "Memo exceeds 5 MiB")
        if not data:
            raise HTTPException(400, "Empty memo")
        job_id = str(uuid.uuid4())
        prepare = getattr(bridge, "prepare_memo", None)
        if prepare:
            snapshot = await prepare(
                tracking_id, generation_id, context_version, shipper_event_id, job_id
            )
        runtime.jobs[job_id] = {"job_id": job_id, "status": "processing"}
        runtime.job_tasks[job_id] = asyncio.create_task(
            runtime.memo_job(job_id, snapshot, data)
        )
        return {"job_id": job_id, "status": "processing"}

    @router.get("/ai/jobs/{job_id}")
    async def job(job_id: str):
        if job_id not in runtime.jobs:
            raise HTTPException(404, "Job not found")
        return runtime.jobs[job_id]

    @router.websocket("/ws/call")
    async def socket(ws: WebSocket, session: str):
        call = runtime.calls.get(session)
        if not call:
            await ws.close(code=1008)
            return
        if call.socket is not None or call.status == "ended":
            await ws.close(code=1008)
            return
        call.socket = ws
        try:
            await ws.accept()
            while True:
                message = await ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                if message.get("text"):
                    try:
                        payload = json.loads(message["text"])
                    except ValueError:
                        continue
                    if payload.get("type") in ("hangup", "decline"):
                        await runtime.end(call, payload["type"])
                    elif call.upstream and payload.get("type") in (
                        "playback_state",
                        "user_activity",
                    ):
                        await call.upstream.browser_event(payload)
        finally:
            if call.socket is ws:
                call.socket = None
                await runtime.end(call, "socket_disconnected")

    app.include_router(router)
    return app
