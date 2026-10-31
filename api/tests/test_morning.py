import asyncio
from datetime import date

import pytest
from conftest import FixedClock
from pydantic import ValidationError
from sqlalchemy import func, select, update

from app.db.models import (
    AvailabilityReply,
    DemoState,
    Event,
    IngressReceipt,
    Message,
    MorningRun,
    Order,
    OrderContextRevision,
    RescueCase,
    RouteWindow,
    ShipperEvent,
)
from app.db.seed import seed_database
from app.morning import MorningService, SimulatedChatChannel, WorkflowError, window_note
from app.schemas import MorningJobRequest, MorningReplyRequest

MAIN = "SPXVN0123456789"
CANT = "SPXVN0123459012"


async def ask(morning):
    result = await morning.service.load(morning.job)
    morning.clock.set("06:32")
    await morning.service.dispatch(morning.generation)
    return result


async def answer(morning, *, tracking_id=MAIN, **fields):
    async with morning.database.sessions() as session:
        order = await session.get(Order, tracking_id)
        question = await session.scalar(
            select(AvailabilityReply)
            .where(AvailabilityReply.tracking_id == tracking_id)
            .order_by(AvailabilityReply.id.desc())
        )
        return MorningReplyRequest(
            **{
                "generation_id": morning.generation,
                "tracking_id": tracking_id,
                "question_id": question.id,
                "context_version": order.context_version,
                "idempotency_key": "reply-one",
                "answer_type": "windows",
                "windows": ["W3", "W4"],
                **fields,
            }
        )


async def test_tc01_loads_all_4000_and_only_marks_accepted_messages_sent(seeded, settings):
    database, summary = seeded
    clock = FixedClock()
    service = MorningService(database, settings, clock=clock)
    job = MorningJobRequest(generation_id=summary.generation_id)
    result = await service.load(job)
    assert result["orders_loaded"] == result["questions_created"] == 4000
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(AvailabilityReply)) == 4000
        assert (
            await session.scalar(
                select(func.count()).select_from(Message).where(Message.status == "queued")
            )
            == 4000
        )
        assert (
            await session.scalar(
                select(func.count()).select_from(Event).where(Event.type == "slots_sent")
            )
            == 0
        )
        question = await session.scalar(
            select(AvailabilityReply).where(AvailabilityReply.tracking_id == MAIN)
        )
        assert question.asked_at is None and question.question_status == "queued"
        message = await session.scalar(select(Message).where(Message.tracking_id == MAIN))
        assert message.text.startswith("Hi Minh, your 6L air fryer arrives today.")
        assert [reply["id"] for reply in message.quick_replies] == [
            "W1",
            "W2",
            "W3",
            "W4",
            "cannot_today",
        ]
    clock.set("06:32")
    assert (await service.dispatch(summary.generation_id))["sent"] == 4000
    assert not (await service.load(job))["created"]
    assert (await service.dispatch(summary.generation_id))["sent"] == 0
    async with database.sessions() as session:
        assert (
            await session.scalar(
                select(func.count()).select_from(Event).where(Event.type == "chat_message")
            )
            == 4000
        )
        assert (
            await session.scalar(
                select(func.count()).select_from(Event).where(Event.type == "orders_loaded")
            )
            == 1
        )
        assert (
            await session.scalar(
                select(func.count()).select_from(Order).where(Order.context_version == 2)
            )
            == 4000
        )
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0


async def test_concurrent_morning_load_and_dispatch_are_idempotent(morning):
    results = await asyncio.gather(
        morning.service.load(morning.job), morning.service.load(morning.job)
    )
    assert sorted(result["created"] for result in results) == [False, True]
    results = await asyncio.gather(
        morning.service.dispatch(morning.generation), morning.service.dispatch(morning.generation)
    )
    assert sum(result["sent"] for result in results) == 2
    async with morning.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Message)) == 2
        assert await session.scalar(select(func.count()).select_from(AvailabilityReply)) == 2


async def test_tc02_one_window_asks_for_more_without_valid_reply_or_note(morning):
    await ask(morning)
    request = await answer(morning, windows=["W4"])
    result = await morning.service.reply(request)
    assert result["status"] == "needs_clarification"
    async with morning.database.sessions() as session:
        question = await session.get(AvailabilityReply, request.question_id)
        order = await session.get(Order, MAIN)
        assert question.answer_type is None and question.windows == []
        assert question.answered_at is None and window_note(order) is None
        assert order.context["availability"]["pending_windows"] == ["W4"]
        message = await session.get(Message, result["message_id"])
        assert message.kind == "more_windows" and "one more" in message.text
    assert (await morning.service.dispatch(morning.generation))["sent"] == 1
    result = await morning.service.reply(await answer(morning, idempotency_key="reply-two"))
    assert result["status"] == "applied"


async def test_valid_windows_create_note_confirmation_and_atomic_revision(morning):
    await ask(morning)
    request = await answer(morning, windows=["W4", "W3"])
    result = await morning.service.reply(request)
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        question = await session.get(AvailabilityReply, request.question_id)
        revision = await session.get(OrderContextRevision, (MAIN, result["context_version"]))
        assert question.windows == ["W3", "W4"] and question.answer_type == "windows"
        assert window_note(order) == "Prefers 14:00–17:00 or 17:00–20:00"
        assert revision.context == order.context
        assert order.attempt_count == 0 and order.delivery_date == date(2026, 10, 31)
        assert (await session.get(Message, result["message_id"])).status == "queued"
    await morning.service.dispatch(morning.generation)
    assert await morning.service.reply(request) == result


async def test_callback_duplicates_and_payload_conflicts(morning):
    await ask(morning)
    request = await answer(morning)
    results = await asyncio.gather(morning.service.reply(request), morning.service.reply(request))
    assert results[0] == results[1]
    with pytest.raises(WorkflowError, match="another payload"):
        await morning.service.reply(request.model_copy(update={"windows": ["W1", "W2"]}))
    async with morning.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(IngressReceipt)) == 1
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Message)
                .where(Message.kind == "window_confirmation")
            )
            == 1
        )


async def test_competing_buyer_corrections_reject_one_stale_version(morning):
    await ask(morning)
    first = await answer(morning)
    other = first.model_copy(update={"windows": ["W1", "W2"], "idempotency_key": "other"})
    results = await asyncio.gather(
        morning.service.reply(first), morning.service.reply(other), return_exceptions=True
    )
    assert sum(isinstance(result, dict) for result in results) == 1
    assert [result.code for result in results if isinstance(result, WorkflowError)] == [
        "rejected_stale"
    ]


async def test_old_confirmation_is_cancelled_after_newer_correction(morning):
    await ask(morning)
    first = await morning.service.reply(await answer(morning))
    second = await morning.service.reply(
        await answer(morning, idempotency_key="two", windows=["W1", "W2"])
    )
    result = await morning.service.dispatch(morning.generation)
    assert result["sent"] == result["cancelled"] == 1
    async with morning.database.sessions() as session:
        assert (
            await session.get(Message, first["message_id"])
        ).cancellation_reason == "stale_context"
        assert (await session.get(Message, second["message_id"])).status == "sent"


@pytest.mark.parametrize(
    "explicit_day, expected", [(None, date(2026, 11, 1)), ("2026-11-02", date(2026, 11, 2))]
)
async def test_tc15_cannot_today_default_or_explicit_monday(morning, explicit_day, expected):
    await ask(morning)
    request = await answer(
        morning,
        tracking_id=CANT,
        answer_type="cannot_today",
        windows=[],
        reason="Out of town until Monday",
        available_date=explicit_day,
    )
    result = await morning.service.reply(request)
    assert result["available_date"] == expected.isoformat()
    async with morning.database.sessions() as session:
        order = await session.get(Order, CANT)
        question = await session.get(AvailabilityReply, request.question_id)
        assert order.delivery_date == question.available_date == expected
        assert order.status == "moved" and order.attempt_count == 0
        assert question.reason == "Out of town until Monday" and question.windows == []
        assert window_note(order) is None
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Order)
                .where(Order.route_id == "HCM-BTH-R07", Order.delivery_date == date(2026, 10, 31))
            )
            == 1
        )
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0


@pytest.mark.parametrize("day", ["2026-10-31", "2026-10-30", "2026-11-06"])
async def test_cannot_today_rejects_invalid_or_beyond_horizon_dates(morning, day):
    await ask(morning)
    request = await answer(
        morning, answer_type="cannot_today", windows=[], reason="Away", available_date=day
    )
    with pytest.raises(WorkflowError) as error:
        await morning.service.reply(request)
    assert error.value.code == "invalid_date"
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.delivery_date == date(2026, 10, 31) and order.context_version == 2
        assert await session.scalar(select(func.count()).select_from(IngressReceipt)) == 0


async def test_later_morning_does_not_move_horizon_or_allow_old_question(morning):
    await ask(morning)
    old = await answer(morning)
    await morning.service.reply(
        await answer(morning, answer_type="cannot_today", windows=[], reason="Away")
    )
    morning.clock.set("06:30", day="2026-11-01")
    assert (await morning.service.load(morning.job))["questions_created"] == 1
    await morning.service.dispatch(morning.generation)
    late_date = await answer(
        morning,
        answer_type="cannot_today",
        windows=[],
        reason="Away",
        available_date="2026-11-06",
        idempotency_key="later",
    )
    with pytest.raises(WorkflowError) as error:
        await morning.service.reply(late_date)
    assert error.value.code == "invalid_date"
    async with morning.database.sessions() as session:
        assert (await session.get(Order, MAIN)).context["availability"][
            "horizon_anchor"
        ] == "2026-10-31"
    with pytest.raises(WorkflowError):
        await morning.service.reply(old.model_copy(update={"idempotency_key": "old-callback"}))


async def test_buyer_can_correct_cannot_today_before_cutoff(morning):
    await ask(morning)
    moved = await morning.service.reply(
        await answer(morning, answer_type="cannot_today", windows=[], reason="Away")
    )
    windows = await morning.service.reply(await answer(morning, idempotency_key="actually-today"))
    await morning.service.dispatch(morning.generation)
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.delivery_date == date(2026, 10, 31) and order.status == "scheduled"
        assert (await session.get(Message, moved["message_id"])).status == "cancelled"
        assert (await session.get(Message, windows["message_id"])).status == "sent"


async def test_cutoff_defaults_only_unanswered_orders_and_is_idempotent(morning):
    await ask(morning)
    await morning.service.reply(await answer(morning))
    morning.clock.set("07:59")
    with pytest.raises(WorkflowError) as error:
        await morning.service.cutoff(morning.job)
    assert error.value.code == "cutoff_not_due"
    morning.clock.set("08:00")
    result = await morning.service.cutoff(morning.job)
    assert result == {"processed": True, "planned": 1, "cancelled": 0}
    assert not (await morning.service.cutoff(morning.job))["processed"]
    async with morning.database.sessions() as session:
        planned = await session.get(Order, CANT)
        assert (
            planned.context["availability"]["status"] == "planned" and window_note(planned) is None
        )
        assert planned.delivery_date == date(2026, 10, 31) and planned.attempt_count == 0
        assert window_note(await session.get(Order, MAIN)) is not None
        question = await session.scalar(
            select(AvailabilityReply).where(AvailabilityReply.tracking_id == CANT)
        )
        assert question.answer_type == "no_reply" and question.answered_at is None
        assert (
            await session.scalar(
                select(func.count()).select_from(Message).where(Message.status == "queued")
            )
            == 0
        )


async def test_late_callback_is_rejected_even_before_cutoff_job_runs(morning):
    await ask(morning)
    request = await answer(morning)
    morning.clock.set("08:00")
    with pytest.raises(WorkflowError) as error:
        await morning.service.reply(request)
    assert error.value.code == "availability_closed"
    async with morning.database.sessions() as session:
        state = await session.get(DemoState, 1)
        assert state.business_time == morning.clock.at


async def test_queued_messages_expire_without_being_reported_sent(morning):
    await morning.service.load(morning.job)
    morning.clock.set("08:00")
    assert (await morning.service.dispatch(morning.generation)) == {
        "sent": 0,
        "cancelled": 2,
        "simulated": True,
    }
    assert (await morning.service.cutoff(morning.job))["planned"] == 2
    async with morning.database.sessions() as session:
        assert (
            await session.scalar(
                select(func.count()).select_from(Event).where(Event.type == "chat_message")
            )
            == 0
        )
        assert (
            await session.scalar(
                select(func.count())
                .select_from(AvailabilityReply)
                .where(AvailabilityReply.asked_at.is_not(None))
            )
            == 0
        )


@pytest.mark.parametrize(
    "status,opt_out",
    [("delivered", False), ("with_cs", False), ("labelled", False), ("scheduled", True)],
)
async def test_morning_load_blocks_terminal_orders_and_opt_out(morning, status, opt_out):
    async with morning.database.sessions.begin() as session:
        await session.execute(update(Order).values(status=status, opt_out=opt_out))
    result = await morning.service.load(morning.job)
    assert result["orders_loaded"] == result["policy_blocked"] == 2
    assert result["questions_created"] == 0
    assert (await morning.service.dispatch(morning.generation))["sent"] == 0


async def test_dispatch_rechecks_current_policy_and_cutoff_preserves_delivered(morning):
    await morning.service.load(morning.job)
    async with morning.database.sessions.begin() as session:
        await session.execute(
            update(Order).where(Order.tracking_id == MAIN).values(status="delivered")
        )
    assert (await morning.service.dispatch(morning.generation)) == {
        "sent": 1,
        "cancelled": 1,
        "simulated": True,
    }
    morning.clock.set("08:00")
    assert (await morning.service.cutoff(morning.job))["cancelled"] == 1
    async with morning.database.sessions() as session:
        assert (await session.get(Order, MAIN)).status == "delivered"


async def test_stop_has_priority_over_stale_context_and_late_cutoff(morning):
    await ask(morning)
    stale = await answer(morning, answer_type="opt_out", windows=[], text="stop")
    await morning.service.reply(await answer(morning))
    morning.clock.set("08:01")
    result = await morning.service.reply(stale.model_copy(update={"idempotency_key": "stop-now"}))
    assert result["opt_out"] is True
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.opt_out and order.context["consent"]["opt_out"]
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Message)
                .where(Message.tracking_id == MAIN, Message.status == "queued")
            )
            == 0
        )
    assert (await morning.service.dispatch(morning.generation))["sent"] == 0


async def test_failed_dispatch_rolls_back_sent_state_and_can_retry(morning):
    await morning.service.load(morning.job)

    class FailingChannel:
        def __init__(self):
            self.accepted = 0

        def accept(self, message):
            self.accepted += 1
            if self.accepted == 2:
                raise WorkflowError("channel_unavailable", "Simulated delivery failure", 503)

    morning.service.channel = FailingChannel()
    with pytest.raises(WorkflowError):
        await morning.service.dispatch(morning.generation)
    async with morning.database.sessions() as session:
        assert (
            await session.scalar(
                select(func.count()).select_from(Message).where(Message.status == "sent")
            )
            == 0
        )
        assert (
            await session.scalar(
                select(func.count()).select_from(Event).where(Event.type == "chat_message")
            )
            == 0
        )
    morning.service.channel = SimulatedChatChannel()
    assert not (await morning.service.load(morning.job))["created"]
    assert (await morning.service.dispatch(morning.generation))["sent"] == 2


async def test_reset_invalidates_questions_receipts_and_pending_messages(morning, pack):
    await ask(morning)
    request = await answer(morning)
    await morning.service.reply(request)
    reset = await seed_database(morning.database, morning.settings, pack, reset=True)
    with pytest.raises(WorkflowError) as error:
        await morning.service.reply(request)
    assert error.value.code == "rejected_stale"
    with pytest.raises(WorkflowError):
        await morning.service.dispatch(morning.generation)
    async with morning.database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Message)) == 0
        assert await session.scalar(select(func.count()).select_from(AvailabilityReply)) == 0
        assert await session.scalar(select(func.count()).select_from(MorningRun)) == 0
        assert (await session.get(DemoState, 1)).generation_id == reset.generation_id


async def test_question_window_snapshot_survives_planner_changes(morning):
    await ask(morning)
    async with morning.database.sessions.begin() as session:
        await session.execute(
            update(RouteWindow).where(RouteWindow.window_id == "W4").values(label="Changed label")
        )
    await morning.service.reply(await answer(morning))
    async with morning.database.sessions() as session:
        assert window_note(await session.get(Order, MAIN)) == "Prefers 14:00–17:00 or 17:00–20:00"


@pytest.mark.parametrize(
    "fields",
    [
        {"windows": []},
        {"windows": ["W4", "W4"]},
        {"answer_type": "cannot_today", "windows": [], "reason": " "},
        {"answer_type": "cannot_today", "reason": "Away"},
        {"available_date": "2026-11-02"},
        {"answer_type": None, "windows": [], "text": "tomorrow"},
        {"at": "2026-10-31T07:00:00+07:00"},
    ],
)
def test_reply_schema_rejects_ambiguous_or_spoofed_input(fields):
    with pytest.raises(ValidationError):
        MorningReplyRequest(
            **{
                "generation_id": "generation",
                "tracking_id": MAIN,
                "question_id": 1,
                "context_version": 2,
                "idempotency_key": "test",
                "answer_type": "windows",
                "windows": ["W1", "W2"],
                **fields,
            }
        )


@pytest.mark.parametrize("active_case", [False, True])
async def test_active_delivery_and_rescue_block_new_morning_contact(morning, active_case):
    async with morning.database.sessions.begin() as session:
        event = ShipperEvent(
            tracking_id=MAIN,
            button="A",
            created_at=morning.clock.at,
            commit_at=morning.clock.at,
            status="committed" if active_case else "pending",
            idempotency_key="courier-action",
            generation_id=morning.generation,
        )
        session.add(event)
        await session.flush()
        if active_case:
            session.add(
                RescueCase(
                    tracking_id=MAIN,
                    shipper_event_id=event.id,
                    trigger="NO_ANSWER",
                    cycle=1,
                    state="call_1_due",
                    calls_made=0,
                    calls_reserved=1,
                    created_at=morning.clock.at,
                    next_action_at=morning.clock.at,
                    generation_id=morning.generation,
                )
            )
    result = await morning.service.load(morning.job)
    assert result["policy_blocked"] == result["questions_created"] == 1
    await morning.service.dispatch(morning.generation)
    async with morning.database.sessions() as session:
        assert (
            await session.scalar(
                select(func.count()).select_from(Message).where(Message.tracking_id == MAIN)
            )
            == 0
        )


async def test_stop_cancels_existing_rescue_timer_and_reservations_remain_auditable(morning):
    await ask(morning)
    async with morning.database.sessions.begin() as session:
        event = ShipperEvent(
            tracking_id=MAIN,
            button="A",
            created_at=morning.clock.at,
            commit_at=morning.clock.at,
            status="committed",
            idempotency_key="courier",
            generation_id=morning.generation,
        )
        session.add(event)
        await session.flush()
        session.add(
            RescueCase(
                tracking_id=MAIN,
                shipper_event_id=event.id,
                trigger="NO_ANSWER",
                cycle=1,
                state="call_1_due",
                calls_made=0,
                calls_reserved=1,
                next_action_at=morning.clock.at,
                created_at=morning.clock.at,
                generation_id=morning.generation,
            )
        )
    await morning.service.reply(await answer(morning, answer_type="opt_out", windows=[]))
    async with morning.database.sessions() as session:
        case = await session.scalar(select(RescueCase))
        assert case.opt_out and case.next_action_at is None
        assert (
            await session.scalar(
                select(func.count()).select_from(Event).where(Event.type == "call_cancelled")
            )
            == 1
        )


async def test_invalid_window_rolls_back_business_changes_but_checkpoints_server_time(morning):
    await ask(morning)
    morning.clock.set("07:00")
    request = await answer(morning, windows=["W5", "W4"])
    with pytest.raises(WorkflowError):
        await morning.service.reply(request)
    async with morning.database.sessions() as session:
        assert (await session.get(Order, MAIN)).context_version == 2
        assert (await session.get(DemoState, 1)).business_time == morning.clock.at
        assert await session.scalar(select(func.count()).select_from(IngressReceipt)) == 0


async def test_cutoff_after_partial_choice_clears_pending_selection(morning):
    await ask(morning)
    await morning.service.reply(await answer(morning, windows=["W4"]))
    morning.clock.set("08:00")
    assert (await morning.service.cutoff(morning.job))["planned"] == 2
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.context["availability"]["pending_windows"] == []
        assert window_note(order) is None


async def test_dispatch_batch_rechecks_time_when_it_crosses_cutoff(morning):
    from datetime import timedelta

    await morning.service.load(morning.job)
    start = FixedClock("07:58").at

    class AdvancingClock:
        def __init__(self):
            self.calls = 0

        def now(self, state):
            now = start + timedelta(minutes=self.calls)
            self.calls += 1
            return now

    morning.service.clock = AdvancingClock()
    result = await morning.service.dispatch(morning.generation)
    assert result == {"sent": 1, "cancelled": 1, "simulated": True}
    async with morning.database.sessions() as session:
        assert (
            await session.scalar(
                select(func.count()).select_from(Message).where(Message.status == "sent")
            )
            == 1
        )
        cancelled = await session.scalar(select(Message).where(Message.status == "cancelled"))
        assert cancelled.cancellation_reason == "cutoff"
