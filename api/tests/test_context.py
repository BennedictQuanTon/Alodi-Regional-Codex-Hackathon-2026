import asyncio

import pytest
from sqlalchemy import func, select

from app.db.context import StaleContextError, record_context_change
from app.db.models import Event, Order, OrderContextRevision
from app.db.seed import seed_database


def change_args(settings, generation):
    return {
        "tracking_id": "SPXVN0123456789",
        "expected_version": 0,
        "expected_generation": generation,
        "context": {"decision": "pending"},
        "actor": "system",
        "at": settings.demo_start,
        "event_type": "context_changed",
        "payload": {"simulated": True},
        "data_source": "synthetic",
    }


async def test_context_revision_and_audit_commit_together(seeded, settings):
    database, summary = seeded
    args = change_args(settings, summary.generation_id)
    async with database.sessions.begin() as session:
        loaded_order = await session.get(Order, args["tracking_id"])
        version = await record_context_change(session, **args)
        assert loaded_order.context_version == version == 1
        assert loaded_order.context["version"] == 1
    assert version == 1
    async with database.sessions() as session:
        order = await session.get(Order, args["tracking_id"])
        revision = await session.get(OrderContextRevision, (args["tracking_id"], 1))
        event = await session.scalar(select(Event).where(Event.type == "context_changed"))
        assert order.context_version == order.context["version"] == event.version == 1
        assert revision.context == order.context
        assert revision.actor == event.actor == "system"
        assert event.at == settings.demo_start
        assert order.attempt_count == 0
    assert args["context"] == {"decision": "pending"}


async def test_context_audit_roll_back_with_caller_transaction(seeded, settings):
    database, summary = seeded
    with pytest.raises(RuntimeError, match="later failure"):
        async with database.sessions.begin() as session:
            await record_context_change(session, **change_args(settings, summary.generation_id))
            raise RuntimeError("later failure")
    async with database.sessions() as session:
        assert (await session.get(Order, "SPXVN0123456789")).context_version == 0
        assert await session.get(OrderContextRevision, ("SPXVN0123456789", 1)) is None
        assert await session.scalar(select(func.count()).select_from(Event)) == 4001


async def test_competing_changes_allow_only_one_version_winner(seeded, settings):
    database, summary = seeded

    async def change():
        async with database.sessions.begin() as session:
            return await record_context_change(
                session, **change_args(settings, summary.generation_id)
            )

    results = await asyncio.gather(change(), change(), return_exceptions=True)
    assert sum(result == 1 for result in results) == 1
    assert sum(isinstance(result, StaleContextError) for result in results) == 1
    async with database.sessions() as session:
        assert (
            await session.scalar(
                select(func.count()).select_from(Event).where(Event.type == "context_changed")
            )
            == 1
        )


async def test_pre_reset_generation_is_rejected_even_at_version_zero(seeded, settings, pack):
    database, summary = seeded
    await seed_database(database, settings, pack, reset=True)
    with pytest.raises(StaleContextError):
        async with database.sessions.begin() as session:
            await record_context_change(session, **change_args(settings, summary.generation_id))
    async with database.sessions() as session:
        assert (await session.get(Order, "SPXVN0123456789")).context_version == 0
        assert await session.scalar(select(func.count()).select_from(Event)) == 4001
