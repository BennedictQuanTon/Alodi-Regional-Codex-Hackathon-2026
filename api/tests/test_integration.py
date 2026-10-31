"""Real SQLite/workflow integration; only cloud transcription/extraction is simulated."""

import asyncio
import sqlite3
from datetime import UTC, datetime, timedelta
from time import monotonic
from types import SimpleNamespace

import pytest
import pytest_asyncio
from alodi_ai.runtime import create_app as create_ai_app
from alodi_ai.schema import DeliveryContext, empty_context
from alodi_ai.settings import Settings as AISettings
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.engine import make_url

from app.ai_bridge import LiveAdapter, WorkflowBridge
from app.contracts import CourierAction, ModeChange, RescueReply
from app.db.models import CallAttempt, Order, ProviderRequest, RescueCase, RescueResult
from app.db.snapshot import restore_snapshot, save_snapshot, snapshot_path
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


@pytest.mark.parametrize(
    ("drop_type", "label"),
    [
        ("hand_to_buyer", "Hand to buyer"),
        ("security_desk", "Security desk"),
        ("reception", "Reception"),
        ("neighbour", "Neighbour"),
        ("locker", "Locker"),
    ],
)
async def test_ai_valid_empty_drop_note_maps_only_known_category_label(
    integrated, drop_type, label
):
    env = integrated
    call = await connected(env)
    values = proposal().model_dump(mode="json", by_alias=True)
    values["drop_location"] = {"type": drop_type, "note": "", "confidence": 1}
    fields = DeliveryContext.model_validate(values)
    assert (
        await env.bridge.submit(call.snapshot, fields, "ai_call", True, 1, "confirmed") == "applied"
    )
    order = await current(env)
    assert order.context["card"]["drop"] == label
    assert order.context["extracted"]["drop_location"] == {
        "type": drop_type,
        "note": label,
        "confidence": 1,
    }
    assert fields.drop_location.note == ""  # The verified AI proposal remains unchanged.


@pytest.mark.parametrize("note", ["", "  "])
async def test_other_location_with_no_details_requires_clarification(integrated, note):
    env = integrated
    call = await connected(env)
    fields = proposal()
    fields.drop_location.type, fields.drop_location.note = "other", note
    assert (
        await env.bridge.submit(call.snapshot, fields, "ai_call", True, 1, "confirmed")
        == "needs_clarification"
    )
    assert (await current(env)).context.get("card") is None
    async with env.database.sessions() as session:
        assert (await session.get(CallAttempt, call.id)).status == "connected"


async def test_other_location_preserves_confirmed_nonempty_details(integrated):
    env = integrated
    call = await connected(env)
    fields = proposal()
    fields.drop_location.type, fields.drop_location.note = "other", "Parcel counter inside lobby"
    assert (
        await env.bridge.submit(call.snapshot, fields, "ai_call", True, 1, "confirmed") == "applied"
    )
    assert (await current(env)).context["card"]["drop"] == "Parcel counter inside lobby"


async def test_blank_drop_note_does_not_bypass_confirmation_or_confidence(integrated):
    env = integrated
    call = await connected(env)
    fields = proposal()
    fields.drop_location.note = "  "
    assert (
        await env.bridge.submit(call.snapshot, fields, "ai_call", False, 1, "unconfirmed")
        == "needs_clarification"
    )
    assert (await current(env)).context.get("card") is None
    fields.drop_location.confidence = 0.4
    assert (
        await env.bridge.submit(call.snapshot, fields, "ai_call", True, 2, "low-confidence")
        == "needs_clarification"
    )
    assert (await current(env)).context.get("card") is None


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


async def test_async_reset_closes_call_and_memo_fences_stale_results_and_prepares_route(
    integrated,
    monkeypatch,
):
    env = integrated
    settings = env.service.settings.model_copy(
        update={
            "openai_api_key": env.ai_settings.openai_api_key,
        }
    )
    app = create_integrated_app(settings, ai_settings=env.ai_settings, start_scheduler=False)
    entered, cancelled, closed = asyncio.Event(), asyncio.Event(), asyncio.Event()

    async def blocked_transcribe(settings, data):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    class Media:
        async def close(self):
            closed.set()

    monkeypatch.setattr("alodi_ai.runtime.transcribe", blocked_transcribe)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:
            generation = env.generation

            async def clock(stamp):
                response = await client.post(
                    "/demo/clock",
                    json={
                        "generation_id": generation,
                        "jump": f"2026-10-31T{stamp}:00+07:00",
                        "paused": True,
                        "speed": 1,
                    },
                )
                assert response.status_code == 200, response.text
                assert (
                    await client.post(
                        "/jobs/run-due",
                        json={
                            "generation_id": generation,
                        },
                    )
                ).status_code == 200

            async def tap(tracking, button):
                order = (await client.get(f"/orders/{tracking}")).json()["order"]
                response = await client.post(
                    f"/orders/{tracking}/events",
                    json={
                        "generation_id": generation,
                        "context_version": order["context_version"],
                        "idempotency_key": f"{tracking}:{button}",
                        "button": button,
                    },
                )
                assert response.status_code == 201, response.text
                return response.json()

            await clock("10:00")
            await tap(TRACKING, "A")
            pending = (await client.get(f"/orders/{TRACKING}")).json()
            assert pending["action_guard"]["can_tap"] is False
            assert "pending" in pending["action_guard"]["reason"]
            await clock("10:02")
            await clock("11:02")
            runtime = app.state.ai_runtime
            call = next(iter(runtime.calls.values()))
            assert (await client.get(f"/orders/{TRACKING}")).json()["calls"][0][
                "answer_deadline_at"
            ]
            call.snapshot = await app.state.ai_bridge.call_started(call)
            call.status, call.upstream = "connected", Media()
            await runtime.emit(
                call,
                {
                    "type": "transcript",
                    "speaker": "buyer",
                    "turn_id": "spoken",
                    "text": "Known buyer " + call.snapshot.known_pii[0],
                    "final": True,
                },
            )
            observed = (await client.get(f"/orders/{TRACKING}/live")).json()
            assert observed["generation_id"] == generation
            assert observed["records"][-1]["payload"]["turn_id"] == "spoken"
            assert call.snapshot.known_pii[0] not in str(observed)
            second = "SPXVN0123459012"
            event = await tap(second, "B")
            await clock("11:04")
            detail = (await client.get(f"/orders/{second}")).json()
            upload = await client.post(
                f"/orders/{second}/memo",
                files={"audio": b"synthetic"},
                data={
                    "generation_id": generation,
                    "context_version": detail["order"]["context_version"],
                    "shipper_event_id": event["event_id"],
                },
            )
            assert upload.status_code == 202, upload.text
            memo_id = upload.json()["job_id"]
            await asyncio.wait_for(entered.wait(), 2)
            response = await client.post("/demo/workflow-reset", json={"generation_id": generation})
            assert response.status_code == 202
            reset_id = response.json()["job_id"]
            duplicate = await client.post(
                "/demo/workflow-reset", json={"generation_id": generation}
            )
            assert duplicate.json()["job_id"] == reset_id
            blocked = await client.post(
                "/demo/clock", json={"generation_id": generation, "speed": 2}
            )
            assert blocked.status_code == 409 and blocked.json()["code"] == "reset_in_progress"
            assert (await client.get("/demo/clock")).json()["reset_job"]["job_id"] == reset_id
            await asyncio.wait_for(app.state.reset_jobs.task, 180)
            result = (await client.get(f"/demo/workflow-reset/{reset_id}")).json()
            assert result["status"] == "completed", result
            assert result["generation_id"] != generation
            assert result["clock"]["paused"] and "T10:00:00" in result["clock"]["now"]
            assert closed.is_set() and cancelled.is_set()
            assert call.id not in runtime.calls and memo_id not in runtime.jobs
            sequence = runtime.observations.sequence
            runtime.observations.append(
                call.snapshot, {"type": "status", "status": "late"}, call.id
            )
            assert runtime.observations.sequence == sequence
            assert (
                await app.state.ai_bridge.submit(
                    call.snapshot, proposal(), "ai_call", True, 5, "late-confirmation"
                )
                == "rejected_stale"
            )
            stale = await client.post("/demo/workflow-reset", json={"generation_id": generation})
            assert stale.status_code == 409 and stale.json()["code"] == "rejected_stale"
            fresh = (await client.get(f"/orders/{TRACKING}")).json()
            assert fresh["action_guard"]["can_tap"] and not fresh["pending_event"]
            assert not fresh["calls"] and not fresh["rescue_cases"]
            live = (await client.get(f"/orders/{TRACKING}/live")).json()
            assert live["generation_id"] == result["generation_id"] and not live["records"]


async def test_prepared_reset_restores_snapshot_under_a_new_generation(integrated):
    env = integrated
    app = create_integrated_app(
        env.service.settings, ai_settings=env.ai_settings, start_scheduler=False
    )

    def rows(database):
        connection = sqlite3.connect(database)
        try:
            tables = [
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' "
                    "AND name NOT LIKE 'sqlite_%'"
                )
            ]
            counts = {
                table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                for table in tables
            }
            generations = set()
            for table in tables:
                columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
                if "generation_id" in columns:
                    generations |= {
                        row[0]
                        for row in connection.execute(
                            f'SELECT DISTINCT generation_id FROM "{table}"'
                        )
                    }
            return counts, generations
        finally:
            connection.close()

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:

            async def reset(generation):
                response = await client.post(
                    "/demo/workflow-reset", json={"generation_id": generation}
                )
                assert response.status_code == 202, response.text
                await asyncio.wait_for(app.state.reset_jobs.task, 180)
                job = (await client.get(f"/demo/workflow-reset/{response.json()['job_id']}")).json()
                assert job["status"] == "completed", job
                return job

            target = snapshot_path(env.service.settings)
            assert not target.exists()
            first = await reset(env.generation)
            assert target.exists(), "a full reset captures the prepared state"
            database = make_url(env.service.settings.database_url).database
            prepared_counts, _ = rows(database)

            order = (await client.get(f"/orders/{TRACKING}")).json()["order"]
            dirtied = await client.post(
                f"/orders/{TRACKING}/events",
                json={
                    "generation_id": first["generation_id"],
                    "context_version": order["context_version"],
                    "idempotency_key": "dirty",
                    "button": "A",
                },
            )
            assert dirtied.status_code == 201, dirtied.text

            began = monotonic()
            second = await reset(first["generation_id"])
            assert monotonic() - began < 8, "the snapshot path skips the morning workflow"
            assert second["generation_id"] != first["generation_id"]
            assert second["clock"]["generation_id"] == second["generation_id"]
            assert second["clock"]["paused"] and "T10:00:00" in second["clock"]["now"]
            counts, generations = rows(database)
            # Pausing the clock for the new generation audits one event; nothing else differs.
            assert counts == prepared_counts | {"events": prepared_counts["events"] + 1}
            assert generations == {second["generation_id"]}, "no row keeps an old generation"
            fresh = (await client.get(f"/orders/{TRACKING}")).json()
            assert fresh["action_guard"]["can_tap"] and not fresh["pending_event"]
            assert not fresh["calls"] and not fresh["rescue_cases"]
            stale = await client.post(
                "/demo/workflow-reset", json={"generation_id": first["generation_id"]}
            )
            assert stale.status_code == 409 and stale.json()["code"] == "rejected_stale"
            # The restored generation runs the real workflow again.
            again = await client.post(
                f"/orders/{TRACKING}/events",
                json={
                    "generation_id": second["generation_id"],
                    "context_version": fresh["order"]["context_version"],
                    "idempotency_key": "again",
                    "button": "A",
                },
            )
            assert again.status_code == 201, again.text


async def test_unusable_snapshot_leaves_the_database_for_the_full_reset(integrated):
    env = integrated
    settings = env.service.settings
    target = snapshot_path(settings)
    assert await restore_snapshot(settings, "unused") is False, "no snapshot yet"
    await save_snapshot(settings)
    connection = sqlite3.connect(target)
    connection.execute("UPDATE alembic_version SET version_num = 'older'")
    connection.commit()
    connection.close()
    assert await restore_snapshot(settings, "unused") is False, "another schema is refused"
    assert (await current(env)).generation_id == env.generation, "the database is untouched"
    target.write_bytes(b"not a database")
    assert await restore_snapshot(settings, "unused") is False, "a corrupt file is refused"
    assert not target.exists()


async def test_reset_removes_pending_outcome_and_rejects_old_generation_write(integrated):
    env = integrated
    order = await current(env)
    command = CourierAction(
        generation_id=env.generation,
        context_version=order.context_version,
        idempotency_key="pending-before-reset",
        button="A",
    )
    await env.flow.tap(TRACKING, command)
    assert (await current(env)).context["pending_event"]["button"] == "A"
    result = await DemoService(env.scheduler).reset(env.generation, "A_main")
    assert result["generation_id"] != env.generation
    async with env.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0
        assert (await session.get(Order, TRACKING)).context.get("pending_event") is None
    with pytest.raises(WorkflowError) as stale:
        await env.flow.tap(TRACKING, command)
    assert stale.value.code == "rejected_stale"
