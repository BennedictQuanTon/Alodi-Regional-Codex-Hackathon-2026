import asyncio
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.clock import BusinessClock
from app.contracts import (
    CallReport,
    ClockChange,
    CourierAction,
    FixtureMemo,
    ModeChange,
    RescueReply,
)
from app.db.models import (
    CallAttempt,
    DemoState,
    Event,
    Order,
    OrderContextRevision,
    ProviderRequest,
    RescueCase,
    RescueMessage,
)
from app.db.seed import initial_context
from app.demo import DemoService
from app.main import create_app
from app.morning import WorkflowError
from app.scheduler import Scheduler
from app.state import WorkflowService

MAIN = "SPXVN0123456789"


@pytest.fixture
def runtime(morning):
    morning.clock.set("10:00")
    flow = WorkflowService(morning.service)
    real = [datetime(2026, 10, 31, 3, 0, tzinfo=UTC)]
    flow.real_now = lambda: real[0]
    return SimpleNamespace(**vars(morning), flow=flow, scheduler=Scheduler(flow), real=real)


async def add_order(env, pack, tracking_id):
    source = next(order for order in pack.orders if order.tracking_id == tracking_id)
    async with env.database.sessions.begin() as session:
        session.add(
            Order(
                **source.model_dump(),
                original_delivery_date=source.delivery_date,
                generation_id=env.generation,
                context_version=0,
                context=initial_context(tracking_id, pack.windows),
            )
        )


async def version(env, tracking_id=MAIN):
    async with env.database.sessions() as session:
        return (await session.get(Order, tracking_id)).context_version


async def tap(env, button="A", tracking_id=MAIN):
    return await env.flow.tap(
        tracking_id,
        CourierAction(
            generation_id=env.generation,
            context_version=await version(env, tracking_id),
            idempotency_key=f"tap:{tracking_id}:{await version(env, tracking_id)}",
            button=button,
        ),
    )


async def auto_mode(env, enabled=True):
    async with env.database.sessions.begin() as session:
        (await session.get(DemoState, 1)).auto_buyer = enabled


async def case_for(env, tracking_id=MAIN):
    async with env.database.sessions() as session:
        return await session.scalar(
            select(RescueCase)
            .where(RescueCase.tracking_id == tracking_id)
            .order_by(RescueCase.cycle.desc())
        )


async def buyer(env, text, tracking_id=MAIN, **overrides):
    case = await case_for(env, tracking_id)
    return RescueReply(
        **{
            "generation_id": env.generation,
            "context_version": await version(env, tracking_id),
            "rescue_case_id": case.id,
            "idempotency_key": f"buyer:{await version(env, tracking_id)}",
            "text": text,
            **overrides,
        }
    )


async def test_a_main_sends_chat_then_one_simulated_call_applies_card(runtime):
    await auto_mode(runtime)
    await tap(runtime)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    case = await case_for(runtime)
    assert case.state == "call_1_due" and case.next_action_at.hour == 4  # UTC 11:02 local
    runtime.clock.set("11:02")
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        order = await session.get(Order, MAIN)
        case = await session.get(RescueCase, case.id)
        assert case.state == "rescheduled" and case.calls_made == 1 and case.calls_reserved == 0
        assert order.attempt_count == 1 and order.delivery_date == date(2026, 11, 1)
        assert order.context["card"]["drop"] == "Tower B security"
        revision = await session.get(OrderContextRevision, (MAIN, order.context_version))
        assert revision.context == order.context
        call = await session.scalar(select(CallAttempt))
        assert call.status == "ended" and call.duration_s is None and call.mode == "stub"


async def test_a_noanswer_caps_two_calls_and_escalates(runtime, pack):
    tracking_id = "SPXVN0123458845"
    await add_order(runtime, pack, tracking_id)
    await auto_mode(runtime)
    await tap(runtime, tracking_id=tracking_id)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    runtime.clock.set("11:02")
    await runtime.scheduler.tick()
    assert (await case_for(runtime, tracking_id)).state == "call_2_due"
    runtime.clock.set("13:02")
    await runtime.scheduler.tick()
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        case = await case_for(runtime, tracking_id)
        order = await session.get(Order, tracking_id)
        assert case.state == "with_cs" and case.calls_made == 2 and case.calls_reserved == 0
        assert order.context["hotline_routing"] is True
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 2


async def test_a_midway_auto_reply_prevents_call_and_confirms_drop(runtime, pack):
    tracking_id = "SPXVN0123452290"
    await add_order(runtime, pack, tracking_id)
    await auto_mode(runtime)
    await tap(runtime, tracking_id=tracking_id)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    runtime.clock.set("10:42")
    await runtime.scheduler.tick()
    assert (await case_for(runtime, tracking_id)).state == "confirm_in_chat"
    runtime.clock.set("10:43")
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        order = await session.get(Order, tracking_id)
        assert order.context["card"]["drop"] == "Hand to buyer"
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 0


async def test_b_memo_is_not_processed_during_undo_window(runtime, pack):
    tracking_id = "SPXVN0123451120"
    await add_order(runtime, pack, tracking_id)
    event = await tap(runtime, "B", tracking_id)
    await runtime.flow.attach_fixture_memo(
        tracking_id,
        FixtureMemo(
            generation_id=runtime.generation,
            context_version=await version(runtime, tracking_id),
            idempotency_key="memo",
            shipper_event_id=event["event_id"],
            memo_ref="fixture:B_memo",
        ),
    )
    runtime.clock.set("10:01")
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(ProviderRequest)) == 0
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        order = await session.get(Order, tracking_id)
        assert order.context["card"]["drop"] == "Tower A reception"
        assert order.context["card"]["source"] == "shipper_memo"
        assert order.attempt_count == 1


async def test_a_lowconf_escalates_after_clarification_timeout(runtime, pack):
    tracking_id = "SPXVN0123457781"
    await add_order(runtime, pack, tracking_id)
    await auto_mode(runtime)
    await tap(runtime, tracking_id=tracking_id)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    runtime.clock.set("11:02")
    await runtime.scheduler.tick()
    assert (await case_for(runtime, tracking_id)).state == "confirm_in_chat"
    runtime.clock.set("11:32")
    await runtime.scheduler.tick()
    case = await case_for(runtime, tracking_id)
    assert case.state == "with_cs" and case.reason == "low_confidence"


async def test_call_hours_defer_and_competing_workers_do_not_duplicate_slots(runtime):
    runtime.clock.set("19:40")
    await tap(runtime)
    runtime.clock.set("19:42")
    await runtime.scheduler.tick()
    runtime.clock.set("20:42")
    await runtime.scheduler.tick()
    case = await case_for(runtime)
    assert (
        case.calls_made == 0 and case.next_action_at.astimezone(runtime.settings.timezone).hour == 8
    )
    runtime.clock.set("08:00", day="2026-11-01")
    other = Scheduler(runtime.flow)
    await asyncio.gather(runtime.scheduler.tick(), other.tick())
    async with runtime.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 1
        case = await case_for(runtime)
        assert case.calls_made == 1 and case.calls_reserved == 0


async def test_newer_reply_and_delivery_reject_late_provider_results(runtime):
    await tap(runtime)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    first = await runtime.flow.receive_reply(MAIN, await buyer(runtime, "First answer"))
    async with runtime.database.sessions() as session:
        task = await session.get(ProviderRequest, first["request_id"])
        envelope = await runtime.flow.envelope(session, task)
    assert not {"buyer_phone", "buyer_name", "address"} & envelope.masked_order_context.keys()
    proposal = await runtime.scheduler.adapters["stub"].extract(envelope)
    await runtime.flow.receive_reply(MAIN, await buyer(runtime, "Newer correction"))
    assert (await runtime.flow.apply_proposal(proposal))["status"] == "rejected_stale"
    await tap(runtime, "DELIVERED")
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.status == "delivered" and not order.context.get("card")


async def test_opt_out_cancels_ringing_call_and_future_jobs(runtime):
    await tap(runtime)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    runtime.clock.set("11:02")
    await runtime.scheduler.tick()
    await runtime.flow.receive_reply(MAIN, await buyer(runtime, "stop", context_version=0))
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        call = await session.scalar(select(CallAttempt))
        assert call.status == "cancelled"
        case = await case_for(runtime)
        assert case.opt_out and case.next_action_at is None
        assert (
            await session.scalar(
                select(func.count())
                .select_from(ProviderRequest)
                .where(ProviderRequest.kind == "cancel_call", ProviderRequest.status == "completed")
            )
            == 1
        )


async def test_offline_overrides_queued_live_requests_and_provider_failure_is_explicit(runtime):
    await tap(runtime)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    reply = await runtime.flow.receive_reply(MAIN, await buyer(runtime, "Tomorrow evening"))
    async with runtime.database.sessions.begin() as session:
        (await session.get(ProviderRequest, reply["request_id"])).mode = "live"
    demo = DemoService(runtime.scheduler)
    await demo.mode(ModeChange(generation_id=runtime.generation, offline=True))
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        task = await session.get(ProviderRequest, reply["request_id"])
        assert task.mode == "replay" and task.status == "completed"
        assert task.result["result"]["simulated"] is True


async def test_provider_error_does_not_leak_details_or_silently_fake_success(runtime):
    class BrokenAdapter:
        mode = "stub"

        async def extract(self, envelope):
            raise RuntimeError("PRIVATE-PROVIDER-SECRET")

    await tap(runtime)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    await runtime.flow.receive_reply(MAIN, await buyer(runtime, "Tomorrow evening"))
    runtime.scheduler.adapters["stub"] = BrokenAdapter()
    await runtime.scheduler.tick()
    case = await case_for(runtime)
    assert case.state == "with_cs" and case.reason == "provider_failure"
    async with runtime.database.sessions() as session:
        assert "PRIVATE-PROVIDER-SECRET" not in str(
            (await session.scalars(select(Event.payload))).all()
        )
        assert (await session.get(Order, MAIN)).context.get("card") is None


async def test_call_duration_uses_real_time_and_absent_transcript_requests_clarification(runtime):
    await tap(runtime)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    runtime.clock.set("11:02")
    await runtime.scheduler.tick()
    async with runtime.database.sessions.begin() as session:
        call = await session.scalar(select(CallAttempt))
        call.mode = "live"  # fake live session for testing real elapsed measurement only
        call_id, origin = call.id, call.context_version
    runtime.real[0] += timedelta(seconds=2)
    await runtime.flow.call_event(
        CallReport(
            generation_id=runtime.generation,
            call_id=call_id,
            context_version=origin,
            idempotency_key="connected",
            status="connected",
            recording_consent=True,
        )
    )
    runtime.clock.set("18:00")
    runtime.real[0] += timedelta(seconds=5)
    await runtime.scheduler.real_timeouts(runtime.generation)
    async with runtime.database.sessions() as session:
        assert (await session.get(CallAttempt, call_id)).status == "connected"
    await runtime.flow.call_event(
        CallReport(
            generation_id=runtime.generation,
            call_id=call_id,
            context_version=origin,
            idempotency_key="ended",
            status="ended",
        )
    )
    async with runtime.database.sessions() as session:
        assert (await session.get(CallAttempt, call_id)).duration_s == 5
        assert (
            await session.scalar(
                select(func.count())
                .select_from(ProviderRequest)
                .where(ProviderRequest.kind == "extract")
            )
            == 0
        )


async def test_clock_pause_jump_reset_and_old_generation(runtime, monkeypatch):
    seconds = [10.0]
    monkeypatch.setattr("app.clock.monotonic", lambda: seconds[0])
    native = BusinessClock()
    runtime.flow.clock = runtime.service.clock = runtime.scheduler.clock = native
    demo = DemoService(runtime.scheduler)
    await demo.change_clock(
        ClockChange(generation_id=runtime.generation, paused=True, jump="2026-10-31T10:00:00+07:00")
    )
    first = await demo.read()
    seconds[0] += 100
    assert (await demo.read())["now"] == first["now"]
    request = CourierAction(
        generation_id=runtime.generation,
        context_version=await version(runtime),
        idempotency_key="paused-tap",
        button="A",
    )
    await runtime.flow.tap(MAIN, request)
    jumped = await demo.change_clock(
        ClockChange(generation_id=runtime.generation, jump="next_timer")
    )
    assert "10:02:00" in jumped["now"]
    await runtime.scheduler.tick()
    assert (await case_for(runtime)).state == "call_1_due"
    reset = await demo.reset(runtime.generation, "B_memo")
    assert reset["generation_id"] != runtime.generation
    with pytest.raises(WorkflowError):
        await runtime.scheduler.tick(runtime.generation)
    async with runtime.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Order)) == 4000
        assert await session.scalar(select(func.count()).select_from(ProviderRequest)) == 0
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0


async def test_refused_recording_consent_never_starts_extraction(runtime):
    await tap(runtime)
    runtime.clock.set("10:02")
    await runtime.scheduler.tick()
    runtime.clock.set("11:02")
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        call = await session.scalar(select(CallAttempt))
    await runtime.flow.call_event(
        CallReport(
            generation_id=runtime.generation,
            call_id=call.id,
            context_version=call.context_version,
            idempotency_key="no-consent",
            status="connected",
            recording_consent=False,
            masked_text="This must not reach an extractor",
        )
    )
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        assert (await session.get(CallAttempt, call.id)).status == "ended"
        assert (
            await session.scalar(
                select(func.count())
                .select_from(ProviderRequest)
                .where(ProviderRequest.kind == "extract")
            )
            == 0
        )
        assert (await case_for(runtime)).state == "confirm_in_chat"


async def test_call_reserved_before_closing_but_dispatched_late_defers_same_slot(runtime):
    runtime.clock.set("19:25")
    await tap(runtime)
    runtime.clock.set("19:27")
    await runtime.scheduler.tick()
    runtime.clock.set("20:30")
    await runtime.scheduler.timers(runtime.generation)
    runtime.clock.set("20:31")
    claimed = await runtime.scheduler.claim(runtime.generation)
    await runtime.scheduler.process(*claimed)
    case = await case_for(runtime)
    assert case.calls_reserved == 1 and case.calls_made == 0
    assert case.next_action_at.astimezone(runtime.settings.timezone).hour == 8
    runtime.real[0] += timedelta(hours=12)
    runtime.clock.set("08:00", day="2026-11-01")
    await runtime.scheduler.tick()
    async with runtime.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(CallAttempt)) == 1
        call = await session.scalar(select(CallAttempt))
        assert call.dispatched and call.requested_at.astimezone(runtime.settings.timezone).hour == 8
        case = await case_for(runtime)
        assert case.calls_made == 1 and case.calls_reserved == 0


async def test_background_scheduler_lifecycle_and_api_routes(morning):
    # Fixed clock, but explicitly enable the worker to verify startup/shutdown wiring.
    app = create_app(morning.settings, clock=morning.clock, start_scheduler=True)
    async with app.router.lifespan_context(app):
        assert app.state.scheduler.task is not None
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            clock = (await client.get("/demo/clock")).json()
            assert clock["generation_id"] == morning.generation
            for _ in range(100):
                async with morning.database.sessions() as session:
                    if await session.scalar(select(func.count()).select_from(RescueMessage)):
                        break
                health = (await client.get("/health")).json()
                if health["scheduler_error"]:
                    pytest.fail(health["scheduler_error"])
                from app.db.models import AvailabilityReply

                async with morning.database.sessions() as session:
                    if (
                        await session.scalar(select(func.count()).select_from(AvailabilityReply))
                        == 2
                    ):
                        break
                await asyncio.sleep(0.01)
            else:
                pytest.fail("Morning scheduler did not run")
            assert (await client.post("/voice/sessions", json={})).status_code == 503
            assert (
                await client.post("/jobs/run-due", json={"generation_id": "old"})
            ).status_code == 409
    assert app.state.scheduler.task is None
