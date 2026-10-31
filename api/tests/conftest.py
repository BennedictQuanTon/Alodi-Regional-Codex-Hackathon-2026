import os

import pytest
import pytest_asyncio

from app.db.migrate import upgrade_database
from app.db.seed import load_seed_pack, seed_database
from app.db.session import Database
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
