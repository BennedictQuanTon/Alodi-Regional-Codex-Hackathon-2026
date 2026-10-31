"""Run migrations through the application's async engine or a supplied connection."""

import asyncio

from alembic import context

from app.db.models import Base, UTCDateTime
from app.db.session import Database
from app.settings import load_settings

config = context.config
target_metadata = Base.metadata


def render_item(kind, item, autogen_context):
    # Revisions describe storage, independent of future changes to the runtime decorator.
    if kind == "type" and isinstance(item, UTCDateTime):
        return "sa.DateTime()"
    return False


def run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=True,
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    settings = load_settings()
    settings.prepare_directories()
    database = Database(settings)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(run_migrations)
    finally:
        await database.close()


if context.is_offline_mode():
    context.configure(
        url=load_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()
elif supplied_connection := config.attributes.get("connection"):
    run_migrations(supplied_connection)
else:
    asyncio.run(run_async_migrations())
