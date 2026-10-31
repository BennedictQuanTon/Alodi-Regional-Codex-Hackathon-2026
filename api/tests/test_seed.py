import asyncio
from copy import deepcopy

import pytest
from sqlalchemy import func, select, text, update

from app.db.migrate import upgrade_database
from app.db.models import (
    Courier,
    DemoState,
    Event,
    Order,
    OrderContextRevision,
    RescueCase,
    RouteWindow,
    ScenarioFixture,
)
from app.db.seed import SeedError, SeedPack, load_seed_pack, seed_database
from app.settings import SCENARIOS


async def test_seed_matches_prd_and_does_not_execute_scripts(seeded, settings, pack):
    database, summary = seeded
    assert (summary.orders, summary.routes, summary.scenarios) == (4000, 20, 7)
    async with database.sessions() as session:
        routes = (
            await session.execute(select(Order.route_id, func.count()).group_by(Order.route_id))
        ).all()
        assert len(routes) == 20 and {count for _, count in routes} == {200}
        assert await session.scalar(select(func.count()).select_from(Courier)) == 20
        assert await session.scalar(select(func.count()).select_from(RouteWindow)) == 80
        assert await session.scalar(select(func.count()).select_from(OrderContextRevision)) == 4000
        assert await session.scalar(select(func.count()).select_from(Event)) == 4001
        assert await session.scalar(select(func.count()).select_from(RescueCase)) == 0
        fixtures = (await session.scalars(select(ScenarioFixture))).all()
        assert {fixture.scenario for fixture in fixtures} == SCENARIOS
        for fixture in fixtures:
            order = await session.get(Order, fixture.tracking_id)
            assert order.route_id == "HCM-BTH-R07"
            assert order.status == "scheduled" and order.attempt_count == 0
            assert order.context_version == 0
            assert order.context["contact_log"] == []
            assert order.context["decision"] == "pending"
        main = await session.get(Order, "SPXVN0123456789")
        assert main.buyer_name == "Minh Hoang" and main.stop_index == 37
        assert main.buyer_phone == "TEST-1237"
        assert main.generation_id == summary.generation_id
        demo = await session.get(DemoState, 1)
        assert demo.clock_start == settings.demo_start
        assert demo.clock_speed == 600 and demo.scenario == "A_main"
        assert demo.pack_fingerprint == pack.fingerprint
        assert not (await session.execute(text("PRAGMA foreign_key_check"))).all()
        assert await session.scalar(text("PRAGMA foreign_keys")) == 1
        assert await session.scalar(text("PRAGMA journal_mode")) == "wal"


async def test_reseed_and_migration_retain_existing_changes(seeded, settings, pack):
    database, initial = seeded
    async with database.sessions.begin() as session:
        await session.execute(
            update(Order).where(Order.tracking_id == "SPXVN0123456789").values(status="with_cs")
        )
    await upgrade_database(database)
    again = await seed_database(database, settings, pack)
    assert not again.created and again.generation_id == initial.generation_id
    async with database.sessions() as session:
        assert (await session.get(Order, "SPXVN0123456789")).status == "with_cs"
        assert await session.scalar(select(func.count()).select_from(Event)) == 4001


async def test_explicit_reset_creates_new_generation_and_retains_migration(seeded, settings, pack):
    database, initial = seeded
    reset = await seed_database(database, settings, pack, reset=True)
    assert reset.created and reset.generation_id != initial.generation_id
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Order)) == 4000
        assert await session.scalar(text("SELECT version_num FROM alembic_version")) == "0002"
        assert (await session.get(Order, "SPXVN0123456789")).context_version == 0
        assert not (await session.execute(text("PRAGMA foreign_key_check"))).all()


async def test_two_concurrent_seed_calls_are_idempotent(database, settings, pack):
    summaries = await asyncio.gather(
        seed_database(database, settings, pack), seed_database(database, settings, pack)
    )
    assert sorted(summary.created for summary in summaries) == [False, True]
    assert len({summary.generation_id for summary in summaries}) == 1


@pytest.mark.parametrize("reset", [False, True])
async def test_seed_and_reset_are_demo_only(seeded, settings, pack, reset):
    database, initial = seeded
    settings.app_env = "pilot"
    with pytest.raises(SeedError, match="APP_ENV=demo"):
        await seed_database(database, settings, pack, reset=reset)
    async with database.sessions() as session:
        assert (await session.get(DemoState, 1)).generation_id == initial.generation_id


async def test_partial_database_is_never_silently_replaced(seeded, settings, pack):
    database, _ = seeded
    async with database.sessions.begin() as session:
        await session.execute(text("DELETE FROM demo_state"))
    with pytest.raises(SeedError, match="not empty"):
        await seed_database(database, settings, pack)
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Order)) == 4000


async def test_invalid_pack_during_reset_rolls_back_everything(seeded, settings, pack):
    database, original = seeded
    invalid = pack.model_copy(deep=True)
    # Bypass pack validation deliberately to prove transaction rollback on a later DB error.
    invalid.orders[-1].route_id = "missing-route"
    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        await seed_database(database, settings, invalid, reset=True)
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Order)) == 4000
        assert (await session.get(DemoState, 1)).generation_id == original.generation_id


@pytest.mark.parametrize(
    "change", ["missing_order", "duplicate_stop", "unknown_route", "real_phone", "missing_scenario"]
)
def test_rejects_invalid_seed_pack(pack, change):
    raw = deepcopy(pack.model_dump(mode="json", by_alias=True))
    if change == "missing_order":
        raw["orders"].pop()
    elif change == "duplicate_stop":
        raw["orders"][1]["stop_index"] = raw["orders"][0]["stop_index"]
    elif change == "unknown_route":
        raw["orders"][0]["route_id"] = "missing-route"
    elif change == "real_phone":
        raw["orders"][0]["buyer_phone"] = "0912345678"
    else:
        raw["scenarios"].pop()
    from pydantic import ValidationError

    with pytest.raises((SeedError, ValidationError)):
        SeedPack.model_validate(raw)


def test_missing_pack_reports_filename_without_data(tmp_path):
    with pytest.raises(SeedError, match="hub.json"):
        load_seed_pack(tmp_path)
