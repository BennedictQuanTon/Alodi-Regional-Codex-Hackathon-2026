from pathlib import Path

from alembic import command
from alembic.config import Config

from app.db.session import Database


def migration_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parent / "migrations"))
    return config


async def upgrade_database(database: Database, revision: str = "head") -> None:
    config = migration_config()
    async with database.engine.begin() as connection:

        def upgrade(sync_connection) -> None:
            config.attributes["connection"] = sync_connection
            command.upgrade(config, revision)

        await connection.run_sync(upgrade)
