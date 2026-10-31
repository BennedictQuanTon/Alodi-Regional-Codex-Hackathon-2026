from datetime import timedelta

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError, StatementError

from app.db.migrate import migration_config, upgrade_database
from app.db.models import (
    AvailabilityReply,
    Base,
    DemoState,
    Event,
    Hub,
    IngressReceipt,
    Order,
    Recording,
    RescueCase,
    ShipperEvent,
)


async def test_migration_matches_models_and_can_be_applied_again(database):
    async with database.engine.connect() as connection:

        def verify(sync_connection):
            tables = set(inspect(sync_connection).get_table_names())
            assert tables == set(Base.metadata.tables) | {"alembic_version"}
            assert (
                compare_metadata(MigrationContext.configure(sync_connection), Base.metadata) == []
            )

        await connection.run_sync(verify)
    await upgrade_database(database)
    async with database.sessions() as session:
        assert await session.scalar(text("SELECT version_num FROM alembic_version")) == "0002"


async def test_empty_database_migration_downgrade_upgrade(database):
    config = migration_config()
    async with database.engine.begin() as connection:

        def downgrade(sync_connection):
            config.attributes["connection"] = sync_connection
            command.downgrade(config, "base")
            assert set(inspect(sync_connection).get_table_names()) == {"alembic_version"}

        await connection.run_sync(downgrade)
    await upgrade_database(database)


async def test_foreign_keys_are_enforced(seeded, settings):
    database, summary = seeded
    with pytest.raises(IntegrityError):
        async with database.sessions.begin() as session:
            session.add(
                Event(
                    tracking_id="missing",
                    at=settings.demo_start,
                    actor="system",
                    type="test",
                    payload={},
                    version=0,
                    generation_id=summary.generation_id,
                    data_source="synthetic",
                )
            )


def shipper_event(settings, generation, **overrides):
    return ShipperEvent(
        **{
            "tracking_id": "SPXVN0123456789",
            "button": "A",
            "created_at": settings.demo_start,
            "commit_at": settings.demo_start + timedelta(minutes=2),
            "status": "committed",
            "idempotency_key": "tap-one",
            "generation_id": generation,
            **overrides,
        }
    )


@pytest.mark.parametrize("pending", [False, True])
async def test_duplicate_action_or_second_pending_action_is_rejected(seeded, settings, pending):
    database, summary = seeded
    status = "pending" if pending else "committed"
    async with database.sessions.begin() as session:
        session.add(shipper_event(settings, summary.generation_id, status=status))
    with pytest.raises(IntegrityError):
        async with database.sessions.begin() as session:
            # Different keys still cannot create two outstanding pending actions.
            key = "tap-two" if pending else "tap-one"
            session.add(
                shipper_event(settings, summary.generation_id, status=status, idempotency_key=key)
            )


async def test_callback_delivery_idempotency_is_scoped_to_source_and_generation(seeded, settings):
    database, summary = seeded

    def receipt(source="voice"):
        return IngressReceipt(
            generation_id=summary.generation_id,
            source=source,
            idempotency_key="callback-one",
            received_at=settings.demo_start,
        )

    async with database.sessions.begin() as session:
        session.add_all([receipt(), receipt("chat")])
    with pytest.raises(IntegrityError):
        async with database.sessions.begin() as session:
            session.add(receipt())


async def test_call_reservations_cannot_exceed_cap_and_case_cannot_duplicate(seeded, settings):
    database, summary = seeded
    async with database.sessions.begin() as session:
        event = shipper_event(settings, summary.generation_id)
        session.add(event)
        await session.flush()
        event_id = event.id

    def case(**overrides):
        return RescueCase(
            **{
                "tracking_id": "SPXVN0123456789",
                "shipper_event_id": event_id,
                "trigger": "NO_ANSWER",
                "cycle": 1,
                "state": "chat_sent",
                "calls_made": 2,
                "calls_reserved": 0,
                "created_at": settings.demo_start,
                "generation_id": summary.generation_id,
                **overrides,
            }
        )

    with pytest.raises(IntegrityError):
        async with database.sessions.begin() as session:
            session.add(case(calls_reserved=1))
    async with database.sessions.begin() as session:
        session.add(case())
    with pytest.raises(IntegrityError):
        async with database.sessions.begin() as session:
            session.add(case(cycle=2))


async def test_memo_metadata_can_exist_before_case_and_times_are_aware(seeded, settings):
    database, summary = seeded
    async with database.sessions.begin() as session:
        event = shipper_event(settings, summary.generation_id, button="B", status="pending")
        session.add(event)
        await session.flush()
        session.add(
            Recording(
                key="fictional/memo.webm",
                shipper_event_id=event.id,
                kind="memo",
                duration_s=9.5,
                created_at=settings.demo_start,
                expires_at=settings.demo_start + timedelta(days=settings.recording_ttl_days),
            )
        )
    async with database.sessions() as session:
        recording = await session.get(Recording, "fictional/memo.webm")
        assert recording.rescue_case_id is None
        assert recording.created_at == settings.demo_start
        assert recording.expires_at.utcoffset() == timedelta(0)


async def test_naive_timestamp_is_rejected_and_rolled_back(seeded, settings):
    database, summary = seeded
    with pytest.raises(StatementError):
        async with database.sessions.begin() as session:
            session.add(
                shipper_event(
                    settings,
                    summary.generation_id,
                    created_at=settings.demo_start.replace(tzinfo=None),
                )
            )
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(ShipperEvent)) == 0


async def test_revision_two_upgrades_existing_seed_and_closes_unverified_legacy_questions(
    seeded, settings
):
    database, summary = seeded
    config = migration_config()
    async with database.engine.begin() as connection:

        def downgrade(sync_connection):
            config.attributes["connection"] = sync_connection
            command.downgrade(config, "0001")

        await connection.run_sync(downgrade)
        await connection.execute(
            text("""INSERT INTO availability_reply
            (tracking_id, asked_at, slots_offered, windows, channel)
            VALUES ('SPXVN0123456789', '2026-10-30 23:32:00.000000',
                    '["08:00/10:00"]', '[]', 'shopee_chat')""")
        )
    await upgrade_database(database)
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Order)) == 4000
        state = await session.get(DemoState, 1)
        assert (
            state.generation_id == summary.generation_id
            and state.business_time == state.clock_start
        )
        question = await session.scalar(select(AvailabilityReply))
        assert question.question_status == "cancelled" and question.offered_windows == []
        assert question.service_date.isoformat() == "2026-10-31"
        assert question.generation_id == summary.generation_id
        hub = await session.scalar(select(Hub))
        assert hub.morning_run.isoformat() == "06:30:00"
        assert not (await session.execute(text("PRAGMA foreign_key_check"))).all()
    from conftest import FixedClock

    from app.morning import MorningService, WorkflowError
    from app.schemas import MorningJobRequest

    # Legacy questions must not become duplicate sends or a low-level SQL error.
    service = MorningService(database, settings, clock=FixedClock())
    with pytest.raises(WorkflowError) as error:
        await service.load(MorningJobRequest(generation_id=summary.generation_id))
    assert error.value.code == "existing_questions"
    async with database.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(AvailabilityReply)) == 1
