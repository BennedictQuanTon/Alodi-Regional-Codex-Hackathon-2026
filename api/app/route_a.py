"""Ephemeral phone coordination for the explicitly initiated Route A demo.

Each session has one phone; the dashboard only observes over HTTP. Only control crosses
this socket: the phone owns the provider call, so its audio never touches the laptop.
Business transitions remain owned by the existing workflow and scheduler.
"""

import asyncio
import json
import logging
import re
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from time import monotonic
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from pydantic import Field
from sqlalchemy import select

from app.action_guard import action_guard
from app.contracts import CallReport, ClockChange, CourierAction, StrictModel
from app.db.models import CallAttempt, DemoState, Order, RescueCase, ShipperEvent
from app.morning import WorkflowError

logger = logging.getLogger("uvicorn.error")

TRACKING = "SPXVN0123456789"
AUDIO_FRAME_BYTES = 16_384
AUDIO_LISTENER_LIMIT = 4
AUDIO_STEPS = {"context", "ringtone", "clip", "voice", "setup"}
AUDIO_CONTEXT_STATES = {"running", "suspended", "interrupted", "closed", "none"}
IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_MESSAGE_BYTES = 16_384
PEER_TTL_SECONDS = 30
INPUT_GATE_ACK_SECONDS = 8
CALL_ISSUE_TIMEOUT_SECONDS = 8
CALLBACK_WALL_SECONDS = 5


class StartRouteA(StrictModel):
    generation_id: str = Field(min_length=1, max_length=64)
    client_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    idempotency_key: str = Field(min_length=1, max_length=128)


@dataclass
class Peer:
    role: str
    client_id: str
    socket: WebSocket
    ready: bool = False
    seen: float = field(default_factory=monotonic)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    agent: str = ""

    async def send(self, payload):
        async with self.send_lock:
            await asyncio.wait_for(self.socket.send_json(payload), timeout=3)


class AudioListener:
    """A dashboard hearing the call. A slow one loses frames instead of delaying the phone."""

    def __init__(self, socket):
        self.socket = socket
        self.frames = asyncio.Queue(maxsize=20)

    def offer(self, frame):
        with suppress(asyncio.QueueFull):
            self.frames.put_nowait(frame)

    async def run(self):
        while True:
            await asyncio.wait_for(self.socket.send_bytes(await self.frames.get()), timeout=3)


def same_origin(connection):
    """The loopback gateway supplies a sanitized original host before proxying."""
    origin = connection.headers.get("origin")
    if not origin:
        return True  # Non-browser tests/clients do not send Origin.
    peer = connection.client.host if connection.client else ""
    host = connection.headers.get("host", "")
    if peer in {"127.0.0.1", "::1"}:
        host = connection.headers.get("x-forwarded-host", host)
    try:
        parsed = urlsplit(origin)
        return parsed.scheme in {"http", "https"} and parsed.netloc == host
    except ValueError:
        return False


class RouteARoom:
    def __init__(self, demo, runtime=None, reset_jobs=None):
        self.demo, self.runtime, self.reset_jobs = demo, runtime, reset_jobs
        self.scheduler, self.flow = demo.scheduler, demo.flow
        self.peers = {}
        self.audio_listeners = set()
        self.generation = None
        self.phase = "idle"
        self.error = None
        self.call_id = None
        self.mode = None
        self.timers = []
        self.started_key = None
        self.start_task = None
        self.finish_task = None
        self.monitor_task = None
        self.answer_sent = False
        self.lock = asyncio.Lock()
        self.last_snapshot = None
        self.end_requested = False
        self.call_log = []
        self.gates = {}
        self.closed_gates = {}
        self.presentation = self.empty_presentation()
        self.demo.on_generation_reset = self.reset_generation

    @staticmethod
    def empty_presentation():
        return {
            "step": "waiting",
            "missed_call": None,
            "callback_wait_seconds": CALLBACK_WALL_SECONDS,
            "callback_due_at": None,
        }

    async def initialize(self):
        current = await self.demo.read()
        self.generation = current["generation_id"]
        # Checkpoint before the scheduler is started: an idle room has no business timer.
        await self.demo.change_clock(ClockChange(generation_id=self.generation, paused=True))
        self.monitor_task = asyncio.create_task(self.monitor())

    async def shutdown(self):
        tasks = [task for task in (self.start_task, self.finish_task, self.monitor_task) if task]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        for peer in list(self.peers.values()):
            with suppress(Exception):
                await peer.socket.close(code=1001)
        self.peers.clear()

    def snapshot(self):
        phone = self.peers.get("phone")
        return {
            "type": "state",
            "generation_id": self.generation,
            "tracking_id": TRACKING,
            "phase": self.phase,
            "phone": {
                "connected": phone is not None,
                "client_id": phone.client_id if phone else None,
                "ready": bool(phone and phone.ready),
            },
            "audio_listeners": len(self.audio_listeners),
            # Sound is reported separately and never blocks: the call re-unlocks it on answer.
            "can_start": self.phase == "idle"
            and phone is not None
            and not (self.reset_jobs and self.reset_jobs.running),
            "call_id": self.call_id,
            "mode": self.mode,
            "timers": list(self.timers),
            "error": self.error,
            "started": self.started_key is not None,
            "end_requested": self.end_requested,
            "call_log": list(self.call_log),
            "presentation": dict(self.presentation),
        }

    async def broadcast(self, *, force=False):
        snapshot = self.snapshot()
        if not force and snapshot == self.last_snapshot:
            return
        self.last_snapshot = snapshot
        for peer in list(self.peers.values()):
            try:
                await peer.send(snapshot)
            except Exception:
                # The receive loop or TTL sweep performs authoritative cleanup.
                peer.seen = 0

    async def reset_generation(self, generation):
        async with self.lock:
            if generation != self.generation:
                if self.start_task and not self.start_task.done():
                    self.start_task.cancel()
                old_peers = list(self.peers.values())
                self.peers.clear()
                self.generation = generation
                self.phase, self.error, self.call_id, self.mode = "idle", None, None, None
                self.started_key, self.timers, self.answer_sent = None, [], False
                self.end_requested, self.call_log = False, []
                self.presentation = self.empty_presentation()
                self.closed_gates.clear()
                for peer in old_peers:
                    with suppress(Exception):
                        await peer.send(
                            {
                                "type": "error",
                                "code": "rejected_stale",
                                "detail": "Workflow reset. Connect to the new generation.",
                            }
                        )
                        await peer.socket.close(code=4001)
                await self.demo.change_clock(ClockChange(generation_id=generation, paused=True))

    async def refresh(self):
        current = await self.demo.read()
        if current["generation_id"] != self.generation:
            await self.reset_generation(current["generation_id"])
        if self.call_id and self.phase not in {"error", "ended"}:
            async with self.flow.database.sessions() as session:
                call = await session.get(CallAttempt, self.call_id)
                if call and call.generation_id == self.generation:
                    runtime_call = self.runtime.calls.get(self.call_id) if self.runtime else None
                    # Application can persist an appointment before the final spoken
                    # acknowledgement drains. Media lifecycle owns the closing boundary.
                    if runtime_call and runtime_call.status in {"connecting", "connected"}:
                        self.phase = "connected"
                    elif runtime_call and runtime_call.status == "ended":
                        self.phase = "ended"
                    elif call.status == "connected":
                        self.phase = "connected"
                    elif call.status not in {"requested", "connected"} and not runtime_call:
                        self.phase = "ended"
                    if self.phase == "connected":
                        self.presentation["step"] = (
                            "finishing" if self.end_requested else "connected"
                        )
                    elif self.phase == "ended":
                        self.presentation["step"] = "ended"
                    for item in self.call_log:
                        if item["id"] == call.id and self.phase in {"connected", "ended"}:
                            item["status"] = "answered" if self.phase == "connected" else "ended"
                            at = (
                                call.connected_real_at
                                if self.phase == "connected"
                                else call.ended_real_at
                            )
                            if at:
                                item["at"] = at.isoformat()
                            item["text"] = (
                                "Callback answered" if self.phase == "connected" else "Call ended"
                            )
        await self.broadcast()
        return self.snapshot()

    async def monitor(self):
        while True:
            try:
                await self.refresh()
                for peer in list(self.peers.values()):
                    if monotonic() - peer.seen > PEER_TTL_SECONDS:
                        await self.disconnect(peer, "presence_expired")
                        with suppress(Exception):
                            await peer.socket.close(code=4000)
            except asyncio.CancelledError:
                raise
            except Exception:
                # No raw payloads or provider errors are logged/persisted by this room.
                pass
            await asyncio.sleep(0.5)

    async def connect(self, peer, generation):
        await self.refresh()
        async with self.lock:
            if generation != self.generation:
                raise WorkflowError("rejected_stale", "Connect to the current generation")
            # The first phone keeps the session. Only that same browser may reclaim it,
            # so a reload is not locked out by its own not-yet-expired socket.
            previous = self.peers.get(peer.role)
            if previous and previous.client_id != peer.client_id:
                raise WorkflowError(
                    "role_conflict", "Another phone is already using this session link"
                )
            self.peers[peer.role] = peer
        if previous:
            with suppress(Exception):
                await previous.socket.close(code=4002)
        await self.broadcast(force=True)

    async def disconnect(self, peer, reason="device_disconnected"):
        async with self.lock:
            if self.peers.get(peer.role) is not peer:
                return
            self.peers.pop(peer.role)
            active = self.phase in {"starting", "advancing", "ringing", "connected"}
            if active:
                self.phase = "error"
                self.error = {
                    "code": reason,
                    "detail": "The phone disconnected. Restart the demo to retry.",
                }
                if self.start_task and not self.start_task.done():
                    self.start_task.cancel()
        if active:
            await self.end_call(reason)
        await self.broadcast(force=True)

    async def end_call(self, reason):
        if not self.call_id:
            async with self.flow.database.sessions() as session:
                call = await session.scalar(
                    select(CallAttempt)
                    .join(RescueCase)
                    .where(
                        RescueCase.tracking_id == TRACKING,
                        CallAttempt.generation_id == self.generation,
                        CallAttempt.status.in_(["requested", "connected"]),
                    )
                    .order_by(CallAttempt.requested_at.desc())
                    .limit(1)
                )
                if call:
                    self.call_id = call.id
            if not self.call_id:
                return
        runtime_call = self.runtime.calls.get(self.call_id) if self.runtime else None
        if runtime_call:
            await self.runtime.end(runtime_call, reason)
            return
        async with self.flow.database.sessions() as session:
            call = await session.get(CallAttempt, self.call_id)
            if not call or call.status not in {"requested", "connected"}:
                return
            report = CallReport(
                generation_id=call.generation_id,
                call_id=call.id,
                context_version=call.context_version,
                idempotency_key=f"route-a-end:{call.id}",
                status="ended" if call.status == "connected" else "missed",
            )
        with suppress(WorkflowError):
            await self.flow.call_event(report)

    async def start(self, body):
        await self.refresh()
        async with self.lock:
            if body.generation_id != self.generation:
                raise WorkflowError("rejected_stale", "Workflow generation is no longer current")
            phone = self.peers.get("phone")
            if not phone or phone.client_id != body.client_id:
                raise WorkflowError("phone_required", "Connect the shipper phone before initiating")
            if self.started_key == body.idempotency_key:
                return self.snapshot()
            if self.started_key is not None or self.phase != "idle":
                raise WorkflowError(
                    "already_started", "Route A has already been initiated; reset to retry"
                )
            if not self.snapshot()["can_start"]:
                raise WorkflowError(
                    "devices_not_ready", "Wait for this session's restart to finish"
                )
            async with self.flow.database.sessions() as session:
                state = await session.get(DemoState, 1)
                order = await session.get(Order, TRACKING)
                if state is None or state.generation_id != body.generation_id:
                    raise WorkflowError(
                        "rejected_stale", "Workflow generation is no longer current"
                    )
                if order is None:
                    raise WorkflowError("not_found", "The shared demo order is missing", 404)
                cases = await self.flow.active_cases(session, TRACKING)
                guard = action_guard(order, cases, self.flow.clock.now(state), self.flow.settings)
                if not guard["can_tap"] or order.opt_out:
                    raise WorkflowError("order_not_eligible", guard["reason"] or "Buyer opted out")
                if state.auto_buyer:
                    raise WorkflowError(
                        "auto_buyer_enabled",
                        "Disable automatic buyer replies for the physical demo",
                    )
                self.mode = "replay" if state.offline_mode else self.flow.settings.ai_mode
                action = CourierAction(
                    generation_id=body.generation_id,
                    context_version=order.context_version,
                    idempotency_key=f"route-a:{body.idempotency_key}"[:128],
                    button="A",
                    by="courier:phone",
                )
            # tap remains the authority for date, attempt caps, concurrency and idempotency.
            await self.flow.tap(TRACKING, action)
            self.started_key, self.phase, self.error = body.idempotency_key, "starting", None
            self.start_task = asyncio.create_task(self.advance(body.generation_id))
        await self.broadcast(force=True)
        return self.snapshot()

    async def advance_clock(self, generation, target, label):
        current = await self.demo.read()
        now = datetime.fromisoformat(current["now"])
        if target <= now:
            return
        self.timers.append(
            {
                "label": label,
                "from": now.isoformat(),
                "to": target.isoformat(),
                "business_seconds": (target - now).total_seconds(),
                "compressed": True,
            }
        )
        self.phase = "advancing"
        await self.broadcast(force=True)
        # A visible boundary; the duration is a presentation delay, not business policy.
        await asyncio.sleep(0.9 if label == "Courier undo window" else 0.05)
        if "phone" not in self.peers:
            raise WorkflowError("device_disconnected", "The phone must stay connected")
        await self.demo.change_clock(
            ClockChange(generation_id=generation, paused=True, speed=1, jump=target.isoformat())
        )

    async def advance(self, generation):
        try:
            # No generic next_timer jump: only this order's deadlines may advance the demo.
            async with self.flow.database.sessions() as session:
                pending = await session.scalar(
                    select(ShipperEvent).where(
                        ShipperEvent.tracking_id == TRACKING,
                        ShipperEvent.generation_id == generation,
                        ShipperEvent.status == "pending",
                    )
                )
                target = pending.commit_at if pending else None
            if target:
                await self.advance_clock(generation, target, "Courier undo window")
            await self.scheduler.tick(generation)
            self.presentation["step"] = "rescue_chat"
            await self.broadcast(force=True)
            async with self.flow.database.sessions() as session:
                case = await session.scalar(
                    select(RescueCase)
                    .where(
                        RescueCase.tracking_id == TRACKING,
                        RescueCase.generation_id == generation,
                        RescueCase.closed_at.is_(None),
                    )
                    .order_by(RescueCase.cycle.desc())
                    .limit(1)
                )
                target = case.next_action_at if case and case.state == "call_1_due" else None
            if target:
                await self.advance_clock(
                    generation, target, "No-answer chat response wait / allowed call window"
                )
                await self.scheduler.tick(generation)
            if not case:
                raise WorkflowError("call_not_issued", "No eligible rescue case was created")
            first_id = await self.wait_for_issued_call(generation, case.id)
            first_runtime = self.runtime.calls.get(first_id) if self.runtime else None
            if first_runtime:
                await self.runtime.end(first_runtime, "demo_unanswered_attempt")
            else:
                async with self.flow.database.sessions() as session:
                    first = await session.get(CallAttempt, first_id)
                await self.flow.call_event(
                    CallReport(
                        generation_id=generation,
                        call_id=first_id,
                        context_version=first.context_version,
                        idempotency_key=f"route-a-missed:{first_id}",
                        status="missed",
                    )
                )
            async with self.flow.database.sessions() as session:
                first = await session.get(CallAttempt, first_id)
                current_case = await session.get(RescueCase, case.id)
                callback_at = current_case.next_action_at
                missed_at = first.ended_real_at.isoformat()
                if first.status != "missed" or not callback_at:
                    raise WorkflowError(
                        "call_not_issued", "First missed attempt did not schedule a callback"
                    )
            self.call_log.append(
                {
                    "id": first_id,
                    "at": missed_at,
                    "status": "missed",
                    "text": "First rescue call was not answered",
                }
            )
            self.presentation.update(
                step="callback_wait",
                missed_call={"call_id": first_id, "number": 1, "at": missed_at, "status": "missed"},
                callback_due_at=(
                    datetime.now(UTC) + timedelta(seconds=CALLBACK_WALL_SECONDS)
                ).isoformat(),
            )
            await self.broadcast(force=True)
            await asyncio.sleep(CALLBACK_WALL_SECONDS)
            await self.advance_clock(generation, callback_at, "Second-call business wait")
            await self.scheduler.tick(generation)
            self.call_id = await self.wait_for_issued_call(generation, case.id, number=2)
            runtime_call = self.runtime.calls.get(self.call_id) if self.runtime else None
            if runtime_call:
                runtime_call.local_input_gate = lambda muted: self.local_input_gate(
                    runtime_call, muted
                )
                runtime_call.explicit_finish = True
            self.phase = "ringing"
            self.presentation["step"] = "ringing"
            self.call_log.append(
                {
                    "id": self.call_id,
                    "at": datetime.now(UTC).isoformat(),
                    "status": "ringing",
                    "text": "Callback is ringing",
                }
            )
            await self.broadcast(force=True)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            if generation != self.generation:
                return
            self.phase = "error"
            self.error = {
                "code": error.code if isinstance(error, WorkflowError) else "route_a_failed",
                "detail": error.detail
                if isinstance(error, WorkflowError)
                else "Route A could not issue a call.",
            }
            await self.cancel_failed_issuance(generation)
            await self.broadcast(force=True)

    async def cancel_failed_issuance(self, generation):
        async with self.flow.morning.transaction(generation) as (session, now, log):
            order = await self.flow.order(session, TRACKING)
            active = list(
                (
                    await session.scalars(
                        select(CallAttempt)
                        .join(RescueCase)
                        .where(
                            RescueCase.tracking_id == TRACKING,
                            CallAttempt.generation_id == generation,
                            CallAttempt.status.in_(["requested", "connected"]),
                        )
                    )
                ).all()
            )
            await self.flow.cancel_work(session, order, now, "route_a_failed")
            await log.flush(session)
        tasks = [
            task
            for key, task in list(self.scheduler.provider_tasks.items())
            if self.scheduler.provider_inputs[key].generation_id == generation
            and self.scheduler.provider_inputs[key].tracking_id == TRACKING
        ]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        for call in active:
            self.call_id = call.id
            adapter = self.scheduler.adapters.get(call.mode)
            if adapter:
                await adapter.cancel_call(call.id, generation)

    async def wait_for_issued_call(self, generation, case_id, number=1):
        # Another scheduler tick may already own the outbox task, so tick() can
        # return before that task dispatches/reserves the actual runtime call.
        deadline = monotonic() + CALL_ISSUE_TIMEOUT_SECONDS
        while True:
            if generation != self.generation:
                raise WorkflowError("rejected_stale", "Workflow generation is no longer current")
            if self.phase == "error" or "phone" not in self.peers:
                raise WorkflowError("device_disconnected", "The phone must stay connected")
            async with self.flow.database.sessions() as session:
                state = await session.get(DemoState, 1)
                if state is None or state.generation_id != generation:
                    raise WorkflowError(
                        "rejected_stale", "Workflow generation is no longer current"
                    )
                call = await session.scalar(
                    select(CallAttempt)
                    .where(
                        CallAttempt.rescue_case_id == case_id,
                        CallAttempt.generation_id == generation,
                        CallAttempt.number == number,
                    )
                    .order_by(CallAttempt.number.desc())
                    .limit(1)
                )
                if call and call.status == "requested" and call.dispatched:
                    runtime_call = self.runtime.calls.get(call.id) if self.runtime else None
                    if call.mode != "live" or (runtime_call and runtime_call.status == "ringing"):
                        return call.id
                if call and call.status not in {"requested", "connected"}:
                    raise WorkflowError("call_not_issued", "The workflow call ended before ringing")
            if monotonic() >= deadline:
                raise WorkflowError(
                    "call_not_issued", "Timed out waiting for the workflow call to ring"
                )
            await asyncio.sleep(0.05)

    async def local_input_gate(self, call, muted):
        phone = self.peers.get("phone")
        if not muted:
            gate_id = self.closed_gates.get(call.id)
            if not phone or not gate_id:
                raise WorkflowError("invalid_gate", "No acknowledged closed device gate")
            await phone.send(
                {
                    "type": "control",
                    "action": "input_gate_release",
                    "generation_id": self.generation,
                    "call_id": call.id,
                    "gate_id": gate_id,
                }
            )
            return
        if not phone or call.id != self.call_id:
            raise WorkflowError("device_disconnected", "The phone is disconnected")
        gate_id = str(uuid4())
        future = asyncio.get_running_loop().create_future()
        self.gates[gate_id] = (call.id, future)
        try:
            await phone.send(
                {
                    "type": "control",
                    "action": "input_gate",
                    "generation_id": self.generation,
                    "call_id": call.id,
                    "gate_id": gate_id,
                    "enabled": False,
                }
            )
            await asyncio.wait_for(future, INPUT_GATE_ACK_SECONDS)
            self.closed_gates[call.id] = gate_id
        finally:
            self.gates.pop(gate_id, None)

    async def finish_call(self, peer):
        # Beside the receive loop: finishing may await an input-gate ack on this same socket.
        call = self.runtime.calls.get(self.call_id) if self.runtime else None
        try:
            if call:
                await self.runtime.request_end(call, "phone_end")
            else:
                await self.end_call("phone_end")
            await self.refresh()
        except WorkflowError as error:
            with suppress(Exception):
                await peer.send({"type": "error", "code": error.code, "detail": error.detail})

    async def message(self, peer, payload):
        await self.refresh()
        if not isinstance(payload, dict):
            raise WorkflowError("invalid_message", "Send a JSON object", 422)
        if payload.get("generation_id") != self.generation or self.peers.get(peer.role) is not peer:
            raise WorkflowError("rejected_stale", "Connect to the current generation")
        kind = payload.get("type")
        fields = {
            "ping": {"type", "generation_id"},
            "ready": {"type", "generation_id", "ready"},
            "initiate": {"type", "generation_id", "idempotency_key"},
            "answer": {"type", "generation_id", "call_id"},
            "end": {"type", "generation_id", "call_id"},
            "input_gate_ack": {"type", "generation_id", "call_id", "gate_id", "enabled"},
            "audio_report": {"type", "generation_id", "failed", "context"},
        }
        if not isinstance(kind, str) or kind not in fields or set(payload) != fields[kind]:
            raise WorkflowError("unsupported_command", "Unsupported message or fields", 422)
        peer.seen = monotonic()
        if kind == "ping":
            await peer.send({"type": "pong", "generation_id": self.generation})
        elif kind == "ready":
            if type(payload["ready"]) is not bool:
                raise WorkflowError("invalid_message", "ready must be a boolean", 422)
            peer.ready = payload["ready"]
            await self.broadcast(force=True)
        elif kind == "audio_report":
            failed, context = payload["failed"], payload["context"]
            if (
                not isinstance(failed, list)
                or not all(isinstance(step, str) and step in AUDIO_STEPS for step in failed)
                or context not in AUDIO_CONTEXT_STATES
            ):
                raise WorkflowError("invalid_message", "Invalid audio report", 422)
            logger.info(
                "route_a audio_report failed=%s context=%s agent=%s", failed, context, peer.agent
            )
        elif kind == "initiate":
            key = payload["idempotency_key"]
            if not isinstance(key, str) or not 1 <= len(key) <= 128:
                raise WorkflowError("invalid_message", "Invalid idempotency key", 422)
            await self.start(
                StartRouteA(
                    generation_id=self.generation, client_id=peer.client_id, idempotency_key=key
                )
            )
        elif kind == "input_gate_ack":
            gate = self.gates.get(payload["gate_id"])
            if not gate or gate[0] != payload["call_id"]:
                raise WorkflowError("invalid_gate", "The input gate is no longer pending")
            if payload["enabled"] is not False:
                raise WorkflowError("invalid_gate", "The phone microphone must be closed")
            if not gate[1].done():
                gate[1].set_result(None)
        else:
            await self.refresh()
            if payload["call_id"] != self.call_id or self.phase not in {"ringing", "connected"}:
                raise WorkflowError("call_not_active", "This call is no longer active")
            if kind == "answer":
                self.answer_sent = True
                return
            self.end_requested = True
            self.presentation["step"] = "finishing"
            await self.broadcast(force=True)
            if not self.finish_task or self.finish_task.done():
                self.finish_task = asyncio.create_task(self.finish_call(peer))


def route_a_router():
    router = APIRouter()

    def room(connection):
        value = getattr(connection.app.state, "route_a", None)
        if value is None:
            raise WorkflowError("demo_only", "Route A requires APP_ENV=demo", 503)
        return value

    @router.get("/demo/route-a")
    async def state(request: Request):
        return await room(request).refresh()

    @router.websocket("/demo/route-a/ws")
    async def socket(ws: WebSocket, role: str = "", client_id: str = "", generation_id: str = ""):
        await ws.accept()
        peer = None
        coordinator = None
        try:
            if not same_origin(ws):
                raise WorkflowError("origin_rejected", "Use this demo origin", 403)
            coordinator = room(ws)
            if (
                role != "phone"
                or not IDENTIFIER.fullmatch(client_id)
                or not 1 <= len(generation_id) <= 64
            ):
                raise WorkflowError(
                    "invalid_connection", "Valid role, client ID and generation required", 422
                )
            peer = Peer(role, client_id, ws, agent=ws.headers.get("user-agent", "")[:200])
            await coordinator.connect(peer, generation_id)
            logger.info("route_a phone connected client=%s agent=%s", client_id, peer.agent)
            window, count = monotonic(), 0
            while True:
                message = await asyncio.wait_for(ws.receive(), timeout=PEER_TTL_SECONDS)
                if message["type"] == "websocket.disconnect":
                    break
                raw = message.get("text")
                if raw is None or len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
                    raise WorkflowError(
                        "message_too_large", "Only JSON signaling up to 16 KiB is accepted", 413
                    )
                if monotonic() - window >= 1:
                    window, count = monotonic(), 0
                count += 1
                if count > 60:
                    raise WorkflowError("rate_limited", "Too many signaling messages", 429)
                try:
                    payload = json.loads(raw)
                    await coordinator.message(peer, payload)
                except (ValueError, RecursionError):
                    await peer.send(
                        {"type": "error", "code": "invalid_message", "detail": "Invalid JSON"}
                    )
                except WorkflowError as error:
                    await peer.send({"type": "error", "code": error.code, "detail": error.detail})
        except WorkflowError as error:
            with suppress(Exception):
                await ws.send_json({"type": "error", "code": error.code, "detail": error.detail})
                await ws.close(code=1008)
        except (WebSocketDisconnect, TimeoutError, RuntimeError):
            pass
        finally:
            if peer and coordinator:
                await coordinator.disconnect(peer)

    @router.websocket("/demo/route-a/audio")
    async def audio(ws: WebSocket, role: str = "", client_id: str = ""):
        """Relays Alodi's voice from this session's phone to its dashboards. Nothing is stored."""
        await ws.accept()
        coordinator = getattr(ws.app.state, "route_a", None)
        phone = coordinator.peers.get("phone") if coordinator else None
        listening = (
            role == "listener"
            and coordinator
            and len(coordinator.audio_listeners) < AUDIO_LISTENER_LIMIT
        )
        sending = role == "phone" and phone and phone.client_id == client_id
        if not same_origin(ws) or not (listening or sending):
            with suppress(Exception):
                await ws.close(code=1008)
            return
        listener = writer = None
        if role == "listener":
            listener = AudioListener(ws)
            coordinator.audio_listeners.add(listener)
            writer = asyncio.create_task(listener.run())
        try:
            while True:
                message = await ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                frame = message.get("bytes")
                if role == "phone" and frame and len(frame) <= AUDIO_FRAME_BYTES:
                    for target in coordinator.audio_listeners:
                        target.offer(frame)
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            if listener:
                coordinator.audio_listeners.discard(listener)
                writer.cancel()

    return router
