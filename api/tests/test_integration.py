"""Real SQLite/workflow integration; only cloud transcription/extraction is simulated."""

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
import pytest_asyncio
from alodi_ai.runtime import create_app as create_ai_app
from alodi_ai.schema import DeliveryContext, empty_context
from alodi_ai.settings import Settings as AISettings
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.ai_bridge import LiveAdapter, WorkflowBridge
from app.contracts import CourierAction, ModeChange, RescueReply
from app.db.models import CallAttempt, Order, ProviderRequest, RescueCase, RescueResult
from app.demo import DemoService
from app.integrated import create_integrated_app
from app.morning import WorkflowError
from app.scheduler import Scheduler
from app.state import WorkflowService

TRACKING = "SPXVN0123456789"


def proposal(notes="Call when arriving at the security desk"):
    return DeliveryContext.model_validate(
        {
            **empty_context().model_dump(),
            "time_window": {
                "date": "2026-11-01",
                "from": "17:00",
                "to": "20:00",
                "confidence": 0.96,
            },
            "drop_location": {"type": "security_desk", "note": "Security desk", "confidence": 0.96},
            "delivery_notes": notes,
        }
    )


@pytest_asyncio.fixture
async def integrated(morning):
    morning.clock.set("10:00")
    morning.service.settings = morning.settings.model_copy(update={"ai_mode": "live"})
    flow = WorkflowService(morning.service)
    real = [datetime(2026, 10, 31, 3, 0, tzinfo=UTC)]
    flow.real_now = lambda: real[0]
    bridge = WorkflowBridge()
    bridge.bind(flow)
    ai_settings = AISettings(_env_file=None, ai_mode="live", openai_api_key="synthetic-test")
    ai_app = create_ai_app(settings=ai_settings, bridge=bridge, fixture=False)
    runtime = ai_app.state.runtime
    adapter = LiveAdapter(bridge, ai_settings)
    adapter.runtime = runtime
    scheduler = Scheduler(flow, adapter)
    env = SimpleNamespace(
        **vars(morning),
        flow=flow,
        bridge=bridge,
        runtime=runtime,
        scheduler=scheduler,
        adapter=adapter,
        real=real,
        ai_app=ai_app,
        ai_settings=ai_settings,
    )
    try:
        yield env
    finally:
        await scheduler.stop()
        await runtime.shutdown()


async def current(env):
    async with env.database.sessions() as session:
        return await session.get(Order, TRACKING)


async def trigger(env, button="A"):
    order = await current(env)
    result = await env.flow.tap(
        TRACKING,
        CourierAction(
            generation_id=env.generation,
            context_version=order.context_version,
            idempotency_key=f"tap:{order.context_version}",
            button=button,
        ),
    )
    env.clock.set("10:02")
    await env.scheduler.tick()
    return result


async def ringing(env):
    await trigger(env)
    env.clock.set("11:02")
    await env.scheduler.tick()
    return next(iter(env.runtime.calls.values()))


async def connected(env):
    call = await ringing(env)
    call.snapshot = await env.bridge.call_started(call)
    call.status = "connected"
    return call


async def test_scheduler_call_confirmed_revision_notes_persist_and_retry_is_idempotent(integrated):
    env = integrated
    call = await connected(env)
    assert (
        await env.bridge.submit(call.snapshot, proposal(), "ai_call", False, 2, "no")
        == "needs_clarification"
    )
    assert (await current(env)).context.get("card") is None
    final = proposal("Use reception instead; call once on arrival")
    final.drop_location.type, final.drop_location.note = "reception", "Reception"
    assert (
        await env.bridge.submit(call.snapshot, final, "ai_call", True, 3, "confirmed") == "applied"
    )
    assert (
        await env.bridge.submit(call.snapshot, final, "ai_call", True, 3, "confirmed") == "applied"
    )
    changed = proposal("Different instructions")
    assert (
        await env.bridge.submit(call.snapshot, changed, "ai_call", True, 3, "confirmed")
        == "rejected_stale"
    )
    order = await current(env)
    assert order.status == "moved"
    assert order.context["extracted"]["delivery_notes"] == final.delivery_notes
    assert order.context["card"]["notes"] == final.delivery_notes
    assert order.context["card"]["drop"] == "Reception"
    async with env.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(RescueResult)) == 1
        host = await session.get(CallAttempt, call.id)
        assert host.status == "ended" and host.recording_consent


@pytest.mark.parametrize("action", ["delivered", "opt_out", "new_chat", "offline", "reset"])
async def test_late_confirmed_call_cannot_apply_after_authoritative_change(integrated, action):
    env = integrated
    call = await connected(env)
    if action == "delivered":
        order = await current(env)
        await env.flow.tap(
            TRACKING,
            CourierAction(
                generation_id=env.generation,
                context_version=order.context_version,
                idempotency_key="delivered",
                button="DELIVERED",
            ),
        )
    elif action in {"opt_out", "new_chat"}:
        order = await current(env)
        await env.flow.receive_reply(
            TRACKING,
            RescueReply(
                generation_id=env.generation,
                context_version=order.context_version,
                rescue_case_id=call.snapshot.rescue_case_id,
                idempotency_key=action,
                text="stop" if action == "opt_out" else "Correction in chat",
            ),
        )
    elif action == "offline":
        await DemoService(env.scheduler).mode(
            ModeChange(generation_id=env.generation, offline=True)
        )
        assert call.status == "ended"
        async with env.database.sessions() as session:
            case = await session.get(RescueCase, call.snapshot.rescue_case_id)
            assert case.state == "confirm_in_chat"
    else:
        await DemoService(env.scheduler).reset(env.generation, "A_main")
        assert call.status == "ended"
    assert (
        await env.bridge.submit(call.snapshot, proposal(), "ai_call", True, 3, action)
        == "rejected_stale"
    )
    assert (await current(env)).context.get("card") is None


async def test_scheduler_chat_uses_provider_boundary_and_applies_real_database(
    integrated, monkeypatch
):
    env = integrated
    await trigger(env)
    async with env.database.sessions() as session:
        case = await session.scalar(select(RescueCase))

    async def simulated_extract(settings, snapshot, text, source):
        assert source == "chat" and text == "Tomorrow evening at security"
        return proposal("Leave with security")

    monkeypatch.setattr("app.ai_bridge.extract", simulated_extract)
    order = await current(env)
    await env.flow.receive_reply(
        TRACKING,
        RescueReply(
            generation_id=env.generation,
            context_version=order.context_version,
            rescue_case_id=case.id,
            idempotency_key="chat",
            text="Tomorrow evening at security",
        ),
    )
    await env.scheduler.tick()
    order = await current(env)
    assert order.status == "moved" and order.context["card"]["source"] == "chat"
    async with env.database.sessions() as session:
        task = await session.scalar(
            select(ProviderRequest).where(ProviderRequest.kind == "extract")
        )
        assert task.result["result"]["simulated"] is False


async def test_failed_reset_cancellation_is_retried_before_reseed(integrated, monkeypatch):
    env = integrated
    call = await ringing(env)
    original = env.adapter.cancel_call
    attempts = []

    async def flaky(call_id, generation):
        attempts.append(call_id)
        if len(attempts) == 1:
            raise RuntimeError("Synthetic cancellation failure")
        await original(call_id, generation)

    monkeypatch.setattr(env.adapter, "cancel_call", flaky)
    demo = DemoService(env.scheduler)
    with pytest.raises(WorkflowError):
        await demo.reset(env.generation, "A_main")
    assert (await demo.read())["generation_id"] == env.generation
    await demo.reset(env.generation, "A_main")
    assert attempts == [call.id, call.id]
    assert call.status == "ended"


async def test_blocked_extraction_does_not_hold_timer_lock_or_ignore_offline(
    integrated, monkeypatch
):
    env = integrated
    await trigger(env)
    entered, cancelled = asyncio.Event(), asyncio.Event()

    async def blocked(request):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    monkeypatch.setattr(env.adapter, "extract", blocked)
    order = await current(env)
    async with env.database.sessions() as session:
        case = await session.scalar(select(RescueCase))
    await env.flow.receive_reply(
        TRACKING,
        RescueReply(
            generation_id=env.generation,
            context_version=order.context_version,
            rescue_case_id=case.id,
            idempotency_key="slow",
            text="Tomorrow evening",
        ),
    )
    await env.scheduler.tick(wait_for_providers=False)
    await asyncio.wait_for(entered.wait(), 1)
    await asyncio.wait_for(env.scheduler.tick(wait_for_providers=False), 1)
    await asyncio.wait_for(
        DemoService(env.scheduler).mode(ModeChange(generation_id=env.generation, offline=True)), 1
    )
    assert cancelled.is_set()
    async with env.database.sessions() as session:
        task = await session.scalar(
            select(ProviderRequest).where(ProviderRequest.kind == "extract")
        )
        assert task.mode == "replay" and task.status == "requested"
    await env.scheduler.tick()
    assert (await current(env)).status == "moved"


async def test_host_real_timeout_stops_runtime_media(integrated):
    env = integrated
    call = await connected(env)
    env.real[0] += timedelta(seconds=180)
    await env.scheduler.real_timeouts(env.generation)
    assert call.status == "ended"
    async with env.database.sessions() as session:
        host = await session.get(CallAttempt, call.id)
        assert host.status == "ended" and host.duration_s == 180


async def test_timeout_cancellation_failure_is_durable_and_next_tick_retries(
    integrated, monkeypatch
):
    env = integrated
    call = await connected(env)
    original, attempts = env.adapter.cancel_call, []

    async def flaky(call_id, generation):
        attempts.append(call_id)
        if len(attempts) == 1:
            raise RuntimeError("Synthetic timeout cancellation failure")
        await original(call_id, generation)

    monkeypatch.setattr(env.adapter, "cancel_call", flaky)
    env.real[0] += timedelta(seconds=180)
    with pytest.raises(WorkflowError):
        await env.scheduler.real_timeouts(env.generation)
    assert call.status == "connected"
    await env.scheduler.tick()
    assert attempts == [call.id, call.id] and call.status == "ended"


async def test_distinct_host_orders_can_ring_without_global_fixture_capacity_failure(integrated):
    env = integrated
    first = await ringing(env)
    tracking = "SPXVN0123459012"
    async with env.database.sessions() as session:
        order = await session.get(Order, tracking)
    await env.flow.tap(
        tracking,
        CourierAction(
            generation_id=env.generation,
            context_version=order.context_version,
            idempotency_key="second-order",
            button="A",
        ),
    )
    env.clock.set("11:04")
    await env.scheduler.tick()
    env.clock.set("12:04")
    await env.scheduler.tick()
    calls = list(env.runtime.calls.values())
    assert len(calls) == 2 and first.status == "ringing"
    async with env.database.sessions() as session:
        case = await session.scalar(select(RescueCase).where(RescueCase.tracking_id == tracking))
        assert case.state == "calling" and case.calls_made == 1 and case.calls_reserved == 0


async def test_optout_during_connect_authorization_never_opens_provider(integrated, monkeypatch):
    env = integrated
    call = await ringing(env)
    original = env.flow.call_event
    opened = []

    async def concurrent_optout(report):
        result = await original(report)
        order = await current(env)
        await env.flow.receive_reply(
            TRACKING,
            RescueReply(
                generation_id=env.generation,
                context_version=order.context_version,
                rescue_case_id=call.snapshot.rescue_case_id,
                idempotency_key="during-connect",
                text="stop",
            ),
        )
        return result

    async def open_provider(self, sdp):
        opened.append(True)
        return "synthetic-answer"

    monkeypatch.setattr(env.flow, "call_event", concurrent_optout)
    monkeypatch.setattr("alodi_ai.runtime.LiveSession.open", open_provider)
    call.socket = object()
    async with AsyncClient(transport=ASGITransport(env.ai_app), base_url="http://test") as client:
        response = await client.post(
            f"/ai/calls/{call.id}/connect", json={"consent": True, "sdp": "offer"}
        )
        assert response.status_code == 409
    assert not opened
    call.socket = None


async def test_lifecycle_hook_failure_still_closes_provider_media(integrated, monkeypatch):
    env = integrated
    call = await connected(env)
    closed = []

    class Media:
        async def close(self):
            closed.append(True)

    async def failed_hook(call, reason):
        raise RuntimeError("Synthetic database failure")

    call.upstream = Media()
    monkeypatch.setattr(env.bridge, "call_ended", failed_hook)
    with pytest.raises(RuntimeError):
        await env.runtime.end(call)
    assert closed == [True] and call.status == "ended"


async def test_multipart_memo_has_one_owner_and_notes_survive_host_restart(integrated, monkeypatch):
    env = integrated
    event = await trigger(env, "B")
    settings = env.service.settings.model_copy(
        update={"openai_api_key": env.ai_settings.openai_api_key}
    )
    app = create_integrated_app(
        settings, ai_settings=env.ai_settings, clock=env.clock, start_scheduler=False
    )

    async def transcribe(settings, data):
        assert data == b"synthetic-audio"
        return "Tomorrow at security, call on arrival"

    async def extract(settings, snapshot, text, source, usage):
        return proposal()

    monkeypatch.setattr("alodi_ai.runtime.transcribe", transcribe)
    monkeypatch.setattr("alodi_ai.runtime.extract", extract)
    async with app.router.lifespan_context(app):
        schema = app.openapi()["paths"]["/orders/{tracking_id}/memo"]["post"]
        assert set(schema["requestBody"]["content"]) == {"multipart/form-data"}
        async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:
            assert (await client.get("/ai/config")).json()["bridge_mode"] == "part1"
            assert (await client.post("/ai/dev/calls", json={})).status_code == 404
            invalid = await client.post(f"/orders/{TRACKING}/memo", files={"audio": b"audio"})
            assert invalid.status_code == 422
            order = await current(env)
            response = await client.post(
                f"/orders/{TRACKING}/memo",
                files={"audio": b"synthetic-audio"},
                data={
                    "generation_id": env.generation,
                    "context_version": order.context_version,
                    "shipper_event_id": event["event_id"],
                },
            )
            assert response.status_code == 202, response.text
            job_id = response.json()["job_id"]
            await app.state.ai_runtime.job_tasks[job_id]
            job = (await client.get(f"/ai/jobs/{job_id}")).json()
            assert job["result"] == "applied", job
    restarted = create_integrated_app(
        settings, ai_settings=env.ai_settings, clock=env.clock, start_scheduler=False
    )
    async with restarted.router.lifespan_context(restarted):
        async with AsyncClient(
            transport=ASGITransport(restarted), base_url="http://test"
        ) as client:
            saved = (await client.get(f"/orders/{TRACKING}")).json()
            assert saved["context_card"]["notes"] == proposal().delivery_notes
            assert saved["context"]["extracted"]["delivery_notes"] == proposal().delivery_notes


async def test_configured_call_cap_and_gpt_model_reach_host_runtime(integrated):
    env = integrated
    settings = env.service.settings.model_copy(
        update={
            "call_max_duration_seconds": 60,
            "openai_api_key": env.ai_settings.openai_api_key,
        }
    )
    app = create_integrated_app(settings, clock=env.clock, start_scheduler=False)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:
            config = (await client.get("/ai/config")).json()
            assert config["limits"]["call_seconds"] == 60
            assert config["models"]["extraction"] == "gpt-6.1-terra"
            assert app.state.ai_runtime.settings.call_max_duration_seconds == 60
            await client.post("/demo/mode", json={"generation_id": env.generation, "offline": True})
            config = (await client.get("/ai/config")).json()
            assert config["mode"] == "offline" and config["ready"] is False
