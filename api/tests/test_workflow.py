import asyncio
from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, update

from app.contracts import CourierAction, CSDecision, Extraction, UndoAction
from app.db.models import Event, Order, RescueCase, RescueMessage
from app.main import create_app
from app.morning import WorkflowError
from app.policy import appointment_policy
from app.state import WorkflowService

MAIN = "SPXVN0123456789"


def fields(**overrides):
    return Extraction.model_validate(
        {
            "time_window": {
                "date": "2026-11-01",
                "from": "17:00",
                "to": "20:00",
                "confidence": 0.94,
            },
            "drop_location": {
                "type": "security_desk",
                "note": "Tower B security",
                "confidence": 0.88,
            },
            "alt_receiver": None,
            "address_correction": None,
            "cannot_receive": None,
            "opt_out": False,
            **overrides,
        }
    )


async def command(env, cls=CourierAction, **overrides):
    async with env.database.sessions() as session:
        order = await session.get(Order, MAIN)
        return cls(
            **{
                "generation_id": env.generation,
                "context_version": order.context_version,
                "idempotency_key": f"command:{order.context_version}",
                **overrides,
            }
        )


@pytest.fixture
def workflow(morning):
    morning.clock.set("10:00")
    return WorkflowService(morning.service)


async def test_pending_undo_and_duplicate_taps_never_contact_buyer(morning, workflow):
    request = await command(morning, button="A")
    first, second = await asyncio.gather(workflow.tap(MAIN, request), workflow.tap(MAIN, request))
    assert first == second and first["status"] == "pending"
    with pytest.raises(WorkflowError):
        await workflow.tap(MAIN, await command(morning, button="B"))
    morning.clock.set("10:01")
    assert (await workflow.commit_due(morning.generation))["committed"] == 0
    result = await workflow.undo(first["event_id"], await command(morning, UndoAction))
    assert result["status"] == "undone"
    morning.clock.set("10:03")
    assert (await workflow.commit_due(morning.generation))["committed"] == 0
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.status == "out_for_delivery" and order.attempt_count == 0
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0
        assert await session.scalar(select(func.count()).select_from(RescueMessage)) == 0


@pytest.mark.parametrize(
    "button,state,contacts", [("A", "chat_pending", 1), ("B", "memo", 0), ("C", "with_cs", 0)]
)
async def test_committed_outcomes_follow_correct_branch_once(
    morning, workflow, button, state, contacts
):
    result = await workflow.tap(MAIN, await command(morning, button=button))
    morning.clock.set("10:02")
    with pytest.raises(WorkflowError) as error:
        await workflow.undo(result["event_id"], await command(morning, UndoAction))
    assert error.value.code == "undo_closed"
    assert (await workflow.commit_due(morning.generation))["committed"] == 1
    assert (await workflow.commit_due(morning.generation))["committed"] == 0
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        case = await session.scalar(select(RescueCase))
        assert order.attempt_count == 1 and case.cycle == 1 and case.state == state
        assert await session.scalar(select(func.count()).select_from(RescueMessage)) == contacts
        if button == "C":
            assert (
                order.status == "with_cs" and order.context["suggested_label"] == "suspected bomb"
            )
            assert not order.context.get("labels")


async def test_delivered_supersedes_pending_without_counting_failure(morning, workflow):
    await workflow.tap(MAIN, await command(morning, button="A"))
    result = await workflow.tap(MAIN, await command(morning, button="DELIVERED"))
    assert result["status"] == "committed"
    morning.clock.set("10:04")
    await workflow.commit_due(morning.generation)
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.status == "delivered" and order.attempt_count == 1
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0


async def test_third_failure_escalates_without_new_rescue_cycle(morning, workflow):
    async with morning.database.sessions.begin() as session:
        await session.execute(
            update(Order).where(Order.tracking_id == MAIN).values(attempt_count=2)
        )
    await workflow.tap(MAIN, await command(morning, button="A"))
    morning.clock.set("10:02")
    await workflow.commit_due(morning.generation)
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.attempt_count == 3 and order.status == "with_cs"
        assert order.context["escalation_reason"] == "redelivery_limit"
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0


async def test_cs_label_and_return_are_explicit_audited_decisions(morning, workflow):
    await workflow.tap(MAIN, await command(morning, button="C"))
    morning.clock.set("10:02")
    await workflow.commit_due(morning.generation)
    await workflow.cs_decision(
        MAIN,
        await command(
            morning, CSDecision, action="approve_label", label="suspected bomb", by="cs:lan"
        ),
    )
    await workflow.cs_decision(
        MAIN, await command(morning, CSDecision, action="return", by="cs:lan")
    )
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.context["labels"] == ["suspected bomb"]
        assert order.context["return"]["approved_by"] == "cs:lan"
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Event)
                .where(Event.type == "cs_decision", Event.actor == "cs:lan")
            )
            == 2
        )
        assert await session.scalar(select(func.count()).select_from(RescueMessage)) == 0


async def test_human_appointment_does_not_increment_delivery_attempt(morning, workflow):
    await workflow.tap(MAIN, await command(morning, button="C"))
    morning.clock.set("10:02")
    await workflow.commit_due(morning.generation)
    await workflow.cs_decision(
        MAIN, await command(morning, CSDecision, action="apply", by="cs:lan", appointment=fields())
    )
    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        assert order.delivery_date == date(2026, 11, 1) and order.attempt_count == 1
        assert order.original_delivery_date == date(2026, 10, 31)
        assert order.context["card"]["by"] == "cs"
    morning.clock.set("17:22", day="2026-11-01")
    await workflow.tap(MAIN, await command(morning, button="DELIVERED"))
    async with morning.database.sessions() as session:
        assert (await session.get(Order, MAIN)).attempt_count == 2


@pytest.mark.parametrize(
    "change,expected",
    [
        ({"drop_location": None}, "needs_clarification"),
        ({"time_window": None}, "needs_clarification"),
        (
            {"alt_receiver": {"relation": "wife", "phone_masked": "*** 214", "confidence": 0.5}},
            "needs_clarification",
        ),
        (
            {
                "address_correction": {
                    "text": "Other ward",
                    "same_district": False,
                    "confidence": 0.99,
                }
            },
            "blocked_by_policy",
        ),
        (
            {
                "time_window": {
                    "date": "2026-11-06",
                    "from": "17:00",
                    "to": "20:00",
                    "confidence": 0.99,
                }
            },
            "blocked_by_policy",
        ),
        ({}, "applied"),
    ],
)
async def test_appointment_policy_guards_required_fields_confidence_area_and_fixed_horizon(
    morning, workflow, change, expected
):
    from app.db.models import RouteWindow

    async with morning.database.sessions() as session:
        order = await session.get(Order, MAIN)
        windows = (await session.scalars(select(RouteWindow))).all()
        assert (
            appointment_policy(
                order, fields(**change), windows, ["Binh Thanh"], morning.clock.at, morning.settings
            )[0]
            == expected
        )


async def test_courier_api_registration_and_stale_version(morning):
    morning.clock.set("10:00")
    app = create_app(morning.settings, clock=morning.clock)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            payload = (await command(morning, button="A")).model_dump(mode="json")
            result = await client.post(f"/orders/{MAIN}/events", json=payload)
            assert result.status_code == 201
            detail = (await client.get(f"/orders/{MAIN}")).json()
            assert detail["pending_event"]["id"] == result.json()["event_id"]
            stale = {**payload, "idempotency_key": "stale", "button": "B"}
            assert (await client.post(f"/orders/{MAIN}/events", json=stale)).status_code == 409
            undo = (await command(morning, UndoAction)).model_dump(mode="json")
            assert (
                await client.post(f"/events/{result.json()['event_id']}/undo", json=undo)
            ).status_code == 200
