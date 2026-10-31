"""Phone coordination against real temporary SQLite workflow/call state."""

import asyncio
from time import monotonic

import pytest
import pytest_asyncio
from alodi_ai.live import LiveSession
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from test_integration import current, integrated, proposal  # noqa: F401

from app.clock import BusinessClock
from app.contracts import ModeChange
from app.db.models import CallAttempt, DemoState, Order, ShipperEvent
from app.main import create_app
from app.morning import WorkflowError
from app.route_a import AUDIO_FRAME_BYTES, Peer, RouteARoom, StartRouteA


class Socket:
    def __init__(self):
        self.messages = []
        self.closed = None

    async def send_json(self, value):
        self.messages.append(value)

    async def close(self, code):
        self.closed = code


@pytest_asyncio.fixture
async def paired(integrated, monkeypatch):  # noqa: F811 - imported pytest fixture
    monkeypatch.setattr("app.route_a.CALLBACK_WALL_SECONDS", 0)
    env = integrated
    async with env.database.sessions.begin() as session:
        state = await session.get(DemoState, 1)
        state.business_time = env.clock.at
        state.clock_paused = True
    env.flow.clock = env.flow.morning.clock = BusinessClock()
    env.scheduler.clock = env.flow.clock
    from app.demo import DemoService

    room = RouteARoom(DemoService(env.scheduler), env.runtime)
    await room.initialize()
    phone = Peer("phone", "phone-1", Socket())
    env.room, env.phone = room, phone
    try:
        yield env
    finally:
        await room.shutdown()


async def connect_ready(env):
    await env.room.connect(env.phone, env.generation)
    await env.room.message(
        env.phone, {"type": "ready", "generation_id": env.generation, "ready": True}
    )


def start(env, key="initiate-1"):
    return StartRouteA(
        generation_id=env.generation, client_id=env.phone.client_id, idempotency_key=key
    )


async def test_connect_and_ready_are_idle_and_initiation_is_gated(paired):
    env = paired
    before = await env.room.demo.read()
    with pytest.raises(WorkflowError, match="Connect the shipper phone"):
        await env.room.start(start(env))
    await env.room.connect(env.phone, env.generation)
    assert env.room.snapshot()["can_start"], "unconfirmed sound must not block the demo"
    await asyncio.sleep(0.55)
    assert env.room.phase == "idle" and env.room.snapshot()["can_start"]
    assert (await env.room.demo.read())["now"] == before["now"]
    async with env.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(ShipperEvent)) == 0
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 0


async def test_actual_scheduler_rings_once_and_confirmed_result_is_authoritative(
    paired, monkeypatch
):
    env = paired
    await connect_ready(env)
    results = await asyncio.gather(env.room.start(start(env)), env.room.start(start(env)))
    assert all(result["phase"] in {"starting", "advancing"} for result in results)
    with pytest.raises(WorkflowError, match="already been initiated"):
        await env.room.start(start(env, "another"))
    await env.room.start_task
    assert env.room.phase == "ringing"
    assert [timer["business_seconds"] for timer in env.room.timers][:2] == [120, 3600]
    assert len(env.room.timers) == 3
    assert all(timer["compressed"] for timer in env.room.timers)
    assert (await env.room.demo.read())["paused"]
    call = env.runtime.calls[env.room.call_id]
    assert call.status == "ringing"
    async with env.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 2
        event = await session.scalar(select(ShipperEvent))
        assert event.button == "A" and event.status == "committed"
    await env.room.message(
        env.phone,
        {
            "type": "answer",
            "generation_id": env.generation,
            "call_id": call.id,
        },
    )
    assert env.room.answer_sent
    # Answer alone cannot manufacture a connected call or result.
    assert (await env.room.refresh())["phase"] == "ringing"
    call.snapshot = await env.bridge.call_started(call)
    call.status = "connected"
    assert (await env.room.refresh())["phase"] == "connected"

    # Only the external extractor is replaced. Runtime transcript/proposal/confirmation,
    # policy validation, result events and durable application remain real.
    async def extract(*args):
        return proposal()

    monkeypatch.setattr("alodi_ai.runtime.extract", extract)
    await env.runtime.turn(call, "Tomorrow after five, at the security desk")
    await call.task
    assert call.readback
    await env.runtime.turn(call, "yes")
    assert (await current(env)).status == "moved"
    assert (await env.room.refresh())["phase"] == "ended"
    records = env.runtime.observations.read("SPXVN0123456789", env.generation)["records"]
    assert {"transcript", "proposal", "result"} <= {record["type"] for record in records}
    assert any(
        record["type"] == "result" and record["payload"]["status"] == "applied"
        for record in records
    )


async def test_disconnect_during_wait_stops_compression_and_requires_reset(paired):
    env = paired
    await connect_ready(env)
    await env.room.start(start(env))
    await env.room.disconnect(env.phone)
    await asyncio.gather(env.room.start_task, return_exceptions=True)
    assert env.room.phase == "error"
    assert not env.room.snapshot()["can_start"]
    assert (await env.room.demo.read())["now"].endswith("10:00:00+07:00")
    async with env.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 0


async def test_disconnect_ringing_closes_real_runtime_and_call(paired):
    env = paired
    await connect_ready(env)
    await env.room.start(start(env))
    await env.room.start_task
    call = env.runtime.calls[env.room.call_id]
    await env.room.disconnect(env.phone)
    assert call.status == "ended"
    async with env.database.sessions() as session:
        assert (await session.get(CallAttempt, call.id)).status == "missed"
    assert env.room.phase == "error"


async def test_phone_gate_requires_closed_track_and_correlated_release(paired, monkeypatch):
    env = paired
    await connect_ready(env)
    await env.room.start(start(env))
    await env.room.start_task
    call = env.runtime.calls[env.room.call_id]
    sent = asyncio.Event()
    original_send = env.phone.socket.send_json

    async def capture(value):
        await original_send(value)
        if value.get("action") == "input_gate":
            sent.set()

    monkeypatch.setattr(env.phone.socket, "send_json", capture)
    closing = asyncio.create_task(env.room.local_input_gate(call, True))
    await sent.wait()
    gate_id = next(
        message["gate_id"]
        for message in reversed(env.phone.socket.messages)
        if message.get("action") == "input_gate"
    )
    payload = {
        "type": "input_gate_ack",
        "generation_id": env.generation,
        "call_id": call.id,
        "gate_id": gate_id,
        "enabled": True,
    }
    with pytest.raises(WorkflowError, match="must be closed"):
        await env.room.message(env.phone, payload)
    assert not closing.done()
    payload["enabled"] = False
    await env.room.message(env.phone, payload)
    await closing
    await env.room.local_input_gate(call, False)
    release = next(
        message
        for message in reversed(env.phone.socket.messages)
        if message.get("action") == "input_gate_release"
    )
    assert release["gate_id"] == gate_id


async def test_hangup_does_not_block_the_socket_that_carries_its_gate_ack(paired, monkeypatch):
    env = paired
    await connect_ready(env)
    await env.room.start(start(env))
    await env.room.start_task
    call = env.runtime.calls[env.room.call_id]
    acknowledged = asyncio.Event()

    async def request_end(target, reason):
        await env.room.local_input_gate(target, True)
        acknowledged.set()

    monkeypatch.setattr(env.runtime, "request_end", request_end)
    end = {"type": "end", "generation_id": env.generation, "call_id": call.id}
    # The receive loop must get control back while the gate waits for this phone's ack.
    await asyncio.wait_for(env.room.message(env.phone, end), 1)
    assert env.room.end_requested
    while not env.room.gates:  # noqa: ASYNC110 - polls room state the test does not own
        await asyncio.sleep(0.01)
    await env.room.message(
        env.phone,
        {
            "type": "input_gate_ack",
            "generation_id": env.generation,
            "call_id": call.id,
            "gate_id": next(iter(env.room.gates)),
            "enabled": False,
        },
    )
    await asyncio.wait_for(acknowledged.wait(), 1)


@pytest.mark.parametrize("confirmed", [True, False])
async def test_hangup_saves_only_complete_confirmed_context_through_real_bridge(
    paired, monkeypatch, confirmed
):
    env = paired
    await connect_ready(env)
    await env.room.start(start(env))
    await env.room.start_task
    call = env.runtime.calls[env.room.call_id]
    call.snapshot = await env.bridge.call_started(call)
    call.status = "connected"
    session = LiveSession(env.runtime, call)
    session.candidate, session.candidate_revision, session.confirmed = proposal(), 1, confirmed

    async def closed_device_gate(muted):
        pass

    monkeypatch.setattr(session, "audio_control", closed_device_gate)
    await session.finish_requested()
    assert call.status == "ended"
    order = await current(env)
    assert bool(order.context.get("card")) is confirmed
    records = env.runtime.observations.read("SPXVN0123456789", env.generation)["records"]
    results = [record["payload"]["status"] for record in records if record["type"] == "result"]
    assert ("applied" in results) is confirmed
    if not confirmed:
        assert "needs_clarification" in results


async def test_real_first_missed_attempt_waits_five_wall_seconds_before_call_two(
    paired, monkeypatch
):
    env = paired
    monkeypatch.setattr("app.route_a.CALLBACK_WALL_SECONDS", 5)
    await connect_ready(env)
    observed = {}
    original = env.room.broadcast

    async def capture(**options):
        observed.setdefault(env.room.presentation["step"], monotonic())
        await original(**options)

    monkeypatch.setattr(env.room, "broadcast", capture)
    began = monotonic()
    await env.room.start(start(env))
    await env.room.start_task
    assert 0.7 <= observed["rescue_chat"] - began < 3
    assert observed["ringing"] - observed["callback_wait"] >= 5
    async with env.database.sessions() as session:
        calls = list(
            (await session.scalars(select(CallAttempt).order_by(CallAttempt.number))).all()
        )
        assert [(call.number, call.status) for call in calls] == [(1, "missed"), (2, "requested")]
        assert calls[0].ended_real_at is not None
    assert env.room.call_log[0]["status"] == "missed"
    assert env.room.call_id == calls[1].id


async def test_background_owned_outbox_dispatch_is_awaited_before_ringing(paired, monkeypatch):
    env = paired
    await connect_ready(env)
    entered, release = asyncio.Event(), asyncio.Event()
    original_request = env.adapter.request_call
    original_tick = env.scheduler.tick

    async def delayed(request):
        entered.set()
        await release.wait()
        return await original_request(request)

    async def background_tick(generation=None):
        return await original_tick(generation, wait_for_providers=False)

    monkeypatch.setattr(env.adapter, "request_call", delayed)
    monkeypatch.setattr(env.scheduler, "tick", background_tick)
    await env.room.start(start(env))
    await asyncio.wait_for(entered.wait(), 3)
    with pytest.raises(TimeoutError):
        await asyncio.wait_for(asyncio.shield(env.room.start_task), 0.15)
    assert env.room.phase == "advancing" and env.room.error is None
    release.set()
    await asyncio.wait_for(env.room.start_task, 3)
    assert env.room.phase == "ringing"
    assert env.runtime.calls[env.room.call_id].status == "ringing"
    async with env.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 2


async def test_unfinished_dispatch_has_bounded_visible_failure_and_no_orphan_call(
    paired, monkeypatch
):
    env = paired
    await connect_ready(env)
    original_tick = env.scheduler.tick
    blocked = asyncio.Event()

    async def delayed(request):
        await blocked.wait()
        return []

    async def background_tick(generation=None):
        return await original_tick(generation, wait_for_providers=False)

    monkeypatch.setattr(env.adapter, "request_call", delayed)
    monkeypatch.setattr(env.scheduler, "tick", background_tick)
    monkeypatch.setattr("app.route_a.CALL_ISSUE_TIMEOUT_SECONDS", 0.1)
    await env.room.start(start(env))
    await asyncio.wait_for(env.room.start_task, 3)
    assert env.room.phase == "error" and env.room.error["code"] == "call_not_issued"
    async with env.database.sessions() as session:
        call = await session.scalar(select(CallAttempt))
        assert call.status == "cancelled"
    assert not env.runtime.calls
    assert not env.scheduler.provider_tasks


async def test_persisted_result_keeps_media_connected_until_closing_playback_ends(paired):
    env = paired
    await connect_ready(env)
    await env.room.start(start(env))
    await env.room.start_task
    call = env.runtime.calls[env.room.call_id]
    call.snapshot = await env.bridge.call_started(call)
    call.status = "connected"
    assert (
        await env.bridge.submit(call.snapshot, proposal(), "ai_call", True, 1, "confirmed")
        == "applied"
    )
    async with env.database.sessions() as session:
        assert (await session.get(CallAttempt, call.id)).status == "ended"
    assert (await env.room.refresh())["phase"] == "connected"
    await env.runtime.end(call, "closing_playback_complete")
    assert (await env.room.refresh())["phase"] == "ended"


async def test_first_phone_keeps_session_stale_generation_and_reset(paired):
    env = paired
    await connect_ready(env)
    with pytest.raises(WorkflowError, match="Another phone"):
        await env.room.connect(Peer("phone", "other", Socket()), env.generation)
    assert env.room.peers["phone"] is env.phone
    with pytest.raises(WorkflowError, match="current generation"):
        await env.room.message(
            env.phone,
            {
                "type": "ready",
                "generation_id": "stale",
                "ready": True,
            },
        )
    with pytest.raises(WorkflowError, match="Unsupported"):
        await env.room.message(
            env.phone,
            {"type": "signal", "generation_id": env.generation, "signal": {"candidate": None}},
        )
    await env.room.demo.reset(env.generation, "A_main")
    snapshot = await env.room.refresh()
    assert snapshot["generation_id"] != env.generation
    assert snapshot["phase"] == "idle" and snapshot["timers"] == []
    assert (await env.room.demo.read())["paused"]
    assert not snapshot["phone"]["connected"]
    assert env.phone.socket.closed == 4001
    with pytest.raises(WorkflowError, match="no longer current"):
        await env.room.start(start(env))


async def test_same_browser_reclaims_its_phone_slot_without_failing_the_session(paired):
    env = paired
    await connect_ready(env)
    reloaded = Peer("phone", env.phone.client_id, Socket())
    await env.room.connect(reloaded, env.generation)
    assert env.room.peers["phone"] is reloaded
    assert env.phone.socket.closed == 4002
    # The replaced socket's own cleanup must not evict its successor.
    await env.room.disconnect(env.phone)
    assert env.room.peers["phone"] is reloaded
    assert env.room.phase == "idle" and env.room.error is None


async def test_order_policy_and_auto_buyer_are_not_bypassed(paired):
    env = paired
    await connect_ready(env)
    await env.room.demo.mode(ModeChange(generation_id=env.generation, auto_buyer=True))
    with pytest.raises(WorkflowError, match="automatic buyer"):
        await env.room.start(start(env))
    await env.room.demo.mode(ModeChange(generation_id=env.generation, auto_buyer=False))
    async with env.database.sessions.begin() as session:
        (await session.get(Order, "SPXVN0123456789")).opt_out = True
    with pytest.raises(WorkflowError, match="opted out"):
        await env.room.start(start(env))
    assert env.room.started_key is None


def test_audio_relay_reaches_listeners_only_from_this_sessions_phone(settings):
    app = create_app(settings, start_scheduler=False)
    with TestClient(app) as client:
        generation = client.get("/demo/route-a").json()["generation_id"]
        path = f"/demo/route-a/ws?role=phone&client_id=test-phone&generation_id={generation}"
        with client.websocket_connect(path) as phone:
            phone.receive_json()
            with client.websocket_connect("/demo/route-a/audio?role=listener") as listener:
                assert client.get("/demo/route-a").json()["audio_listeners"] == 1
                with client.websocket_connect(
                    "/demo/route-a/audio?role=phone&client_id=other"
                ) as bad:
                    assert bad.receive()["type"] == "websocket.close"
                relay = "/demo/route-a/audio?role=phone&client_id=test-phone"
                with client.websocket_connect(relay) as sender:
                    sender.send_bytes(b"x" * AUDIO_FRAME_BYTES)
                    assert listener.receive_bytes() == b"x" * AUDIO_FRAME_BYTES
                    sender.send_bytes(b"y" * (AUDIO_FRAME_BYTES + 1))
                    sender.send_bytes(b"z")
                    assert listener.receive_bytes() == b"z", "an oversized frame is dropped"
            assert client.get("/demo/route-a").json()["audio_listeners"] == 0


def test_audio_relay_limits_listeners_and_rejects_other_origins(settings):
    app = create_app(settings, start_scheduler=False)
    with TestClient(app) as client:
        foreign = {"origin": "https://untrusted.invalid"}
        path = "/demo/route-a/audio?role=listener"
        with client.websocket_connect(path, headers=foreign) as socket:
            assert socket.receive()["type"] == "websocket.close"
        with (
            client.websocket_connect(path),
            client.websocket_connect(path),
            client.websocket_connect(path),
            client.websocket_connect(path),
            client.websocket_connect(path) as extra,
        ):
            assert extra.receive()["type"] == "websocket.close"


async def test_audio_report_is_validated_and_logged_with_the_device(paired, caplog):
    env = paired
    await connect_ready(env)
    env.phone.agent = "iPhone Safari"
    report = {"type": "audio_report", "generation_id": env.generation, "context": "interrupted"}
    with caplog.at_level("INFO", logger="uvicorn.error"):
        await env.room.message(env.phone, {**report, "failed": ["clip"]})
    assert "failed=['clip'] context=interrupted agent=iPhone Safari" in caplog.text
    with pytest.raises(WorkflowError, match="Invalid audio report"):
        await env.room.message(env.phone, {**report, "failed": ["<script>"]})


def test_websocket_route_enforces_origin_json_bounds_and_command_types(settings):
    app = create_app(settings, start_scheduler=False)
    with TestClient(app) as client:
        generation = client.get("/demo/route-a").json()["generation_id"]
        path = f"/demo/route-a/ws?role=phone&client_id=test-phone&generation_id={generation}"
        with client.websocket_connect(path, headers={"origin": "https://untrusted.invalid"}) as ws:
            assert ws.receive_json()["code"] == "origin_rejected"
        display = path.replace("role=phone", "role=display")
        with client.websocket_connect(display) as ws:
            assert ws.receive_json()["code"] == "invalid_connection"
        with client.websocket_connect(path) as ws:
            assert ws.receive_json()["phase"] == "idle"
            ws.send_json({"type": "script_success", "generation_id": generation})
            assert ws.receive_json()["code"] == "unsupported_command"
            ws.send_text("x" * 16_385)
            assert ws.receive_json()["code"] == "message_too_large"
