from pathlib import Path

import pytest

from app.main import create_app
from app.settings import REPOSITORY_ROOT, ConfigurationError, Settings, load_settings


def test_stub_defaults_and_paths_are_independent_of_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    settings = load_settings(_env_file=None)
    assert settings.effective_ai_mode == "stub"
    assert not settings.openai_api_key.get_secret_value()
    assert settings.mock_pack_dir == REPOSITORY_ROOT / "prep/02-technical/mock-data"
    assert settings.recordings_dir == REPOSITORY_ROOT / "data/recordings"
    assert settings.database_url.endswith((REPOSITORY_ROOT / "data/alodi.db").as_posix())
    assert Path(Settings.model_config["env_file"]) == REPOSITORY_ROOT / ".env"


def test_dotenv_is_explicit_and_process_environment_wins(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("API_PORT=8011\nASSEMBLY_API_KEY=test-alias\nUNRELATED_SETTING=ignored\n")
    monkeypatch.setenv("API_PORT", "8012")
    settings = load_settings(_env_file=env)
    assert settings.api_port == 8012
    assert "assembly_api_key" not in Settings.model_fields


def test_obsolete_provider_values_cannot_block_gpt_only_startup():
    settings = load_settings(_env_file=None, assembly_api_key="old-a", assemblyai_api_key="old-b")
    assert settings.voice_provider == "gpt_live"


def test_live_requires_credentials_but_offline_overrides_live():
    with pytest.raises(ConfigurationError) as error:
        load_settings(_env_file=None, ai_mode="live")
    assert "OPENAI_API_KEY" in str(error.value)
    assert "ASSEMBLYAI_API_KEY" not in str(error.value)
    assert (
        load_settings(_env_file=None, ai_mode="live", openai_api_key="test").voice_provider
        == "gpt_live"
    )
    settings = load_settings(_env_file=None, ai_mode="live", offline_mode=True, auto_buyer=False)
    assert settings.effective_ai_mode == "replay"
    assert settings.auto_buyer is False


def test_live_is_not_silently_reported_as_available_before_part_two():
    settings = load_settings(_env_file=None, ai_mode="live", openai_api_key="openai-test")
    with pytest.raises(ConfigurationError, match="Part 2"):
        create_app(settings)
    assert "openai-test" not in repr(settings)
    assert "openai_api_key" not in settings.model_dump()
    assert "assembly_api_key" not in settings.model_dump()


@pytest.mark.parametrize(
    "overrides,variable",
    [
        ({"api_port": "sensitive-invalid-port"}, "API_PORT"),
        ({"database_url": "postgresql://secret-user:secret-password@host/db"}, "DATABASE_URL"),
        ({"database_url": "sqlite+aiosqlite:///file:db?uri=true"}, "DATABASE_URL"),
        ({"tz": "Invalid/sensitive-zone"}, "TZ"),
        ({"demo_start": "2026-10-31T06:28:00"}, "DEMO_START"),
        ({"demo_clock_speed": 0}, "DEMO_CLOCK_SPEED"),
        ({"demo_clock_speed": float("inf")}, "DEMO_CLOCK_SPEED"),
        ({"demo_scenario": "invalid"}, "DEMO_SCENARIO"),
        ({"web_origin": "https://secret-user:secret-password@example.com"}, "WEB_ORIGIN"),
        ({"web_origin": "http://localhost:3000/path"}, "WEB_ORIGIN"),
        ({"call_window_start": "21:00"}, "CALL_WINDOW_START"),
        ({"max_calls_per_cycle": 3}, "MAX_CALLS_PER_CYCLE"),
        ({"max_redeliveries": 3}, "MAX_REDELIVERIES"),
        ({"reschedule_horizon_days": 6}, "RESCHEDULE_HORIZON_DAYS"),
        ({"auto_apply_confidence": 0.5}, "AUTO_APPLY_CONFIDENCE"),
        ({"recording_ttl_days": 31}, "RECORDING_TTL_DAYS"),
    ],
)
def test_invalid_configuration_is_safe(overrides, variable):
    with pytest.raises(ConfigurationError) as error:
        load_settings(_env_file=None, **overrides)
    message = str(error.value)
    assert variable in message
    assert "sensitive" not in message
    assert "secret-user" not in message
    assert "secret-password" not in message


def test_creates_storage_directories(settings):
    settings.prepare_directories()
    assert settings.recordings_dir.is_dir()
