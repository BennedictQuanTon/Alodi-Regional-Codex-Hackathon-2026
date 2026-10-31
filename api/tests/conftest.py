import os
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import insert

from app.db.migrate import upgrade_database
from app.db.models import Courier, DemoState, Hub, Order, OrderContextRevision, RouteWindow
from app.db.seed import initial_context, load_seed_pack, seed_database
from app.db.session import Database
from app.morning import MorningService
from app.schemas import MorningJobRequest
from app.settings import Settings, load_settings


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    # Local provider credentials must never influence or appear in tests.
    fields = set(Settings.model_fields)
    for name in tuple(os.environ):
        if name.lower() in fields:
            monkeypatch.delenv(name)


@pytest.fixture
def settings(tmp_path):
    return load_settings(
        _env_file=None,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        recordings_dir=tmp_path / "recordings",
    )


@pytest.fixture(scope="session")
def pack():
    return load_seed_pack(load_settings(_env_file=None).mock_pack_dir)


@pytest_asyncio.fixture
async def database(settings):
    settings.prepare_directories()
    database = Database(settings)
    await upgrade_database(database)
    try:
        yield database
    finally:
        await database.close()


@pytest_asyncio.fixture
async def seeded(database, settings, pack):
    summary = await seed_database(database, settings, pack)
    return database, summary


class FixedClock:
    def __init__(self, hhmm="06:30"):
        self.set(hhmm)

    def set(self, hhmm, day="2026-10-31"):
        self.at = datetime.fromisoformat(f"{day}T{hhmm}:00+07:00")

    def now(self, state):
        return self.at


@pytest_asyncio.fixture
async def morning(database, settings, pack):
    """Two real R07 pack rows for focused workflow tests; full 4,000 load is separate."""
    generation = str(uuid4())
    clock = FixedClock()
    selected = [
        order
        for order in pack.orders
        if order.tracking_id
        in {
            "SPXVN0123456789",
            "SPXVN0123459012",
        }
    ]
    async with database.sessions.begin() as session:
        session.add(
            Hub(
                hub_id=pack.hub.hub_id,
                name=pack.hub.name,
                city=pack.hub.city,
                service_area_wards=pack.hub.service_area_wards,
                delivery_date=pack.hub.date,
                morning_run=pack.hub.morning_run,
                data_source="synthetic",
            )
        )
        await session.flush()
        session.add(Courier(**pack.couriers[6].model_dump(), hub_id=pack.hub.hub_id))
        await session.flush()
        session.add_all(
            [
                RouteWindow(
                    route_id="HCM-BTH-R07",
                    window_id=w.id,
                    starts_at=w.starts_at,
                    ends_at=w.ends_at,
                    label=w.label,
                )
                for w in pack.windows
            ]
        )
        await session.execute(
            insert(Order),
            [
                {
                    **order.model_dump(),
                    "context_version": 0,
                    "context": initial_context(order.tracking_id, pack.windows),
                    "generation_id": generation,
                    "opt_out": False,
                }
                for order in selected
            ],
        )
        await session.execute(
            insert(OrderContextRevision),
            [
                {
                    "tracking_id": order.tracking_id,
                    "version": 0,
                    "context": initial_context(order.tracking_id, pack.windows),
                    "actor": "system",
                    "at": settings.demo_start,
                    "generation_id": generation,
                }
                for order in selected
            ],
        )
        session.add(
            DemoState(
                id=1,
                generation_id=generation,
                scenario="A_main",
                clock_start=settings.demo_start,
                business_time=settings.demo_start,
                clock_speed=600,
                seeded_at=settings.demo_start,
                pack_fingerprint=pack.fingerprint,
            )
        )
    return SimpleNamespace(
        service=MorningService(database, settings, clock=clock),
        database=database,
        generation=generation,
        clock=clock,
        settings=settings,
        job=MorningJobRequest(generation_id=generation),
    )
