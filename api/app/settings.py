"""Typed, root-relative configuration; errors never include configuration values."""

from datetime import datetime, time
from pathlib import Path
from typing import Literal, Self
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
ScenarioName = Literal[
    "A_main", "B_memo", "REFUSE", "A_lowconf", "A_noanswer", "A_midway", "CANT_TODAY"
]
SCENARIOS = frozenset(ScenarioName.__args__)


class ConfigurationError(RuntimeError):
    """A safe, name-only startup error suitable for local logs."""


def resolve_path(value: str | Path) -> Path:
    path = Path(value).expanduser()
    return (REPOSITORY_ROOT / path).resolve() if not path.is_absolute() else path.resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        hide_input_in_errors=True,
        validate_default=True,
    )

    app_env: Literal["demo", "pilot", "production"] = "demo"
    tz: str = "Asia/Ho_Chi_Minh"
    api_host: str = Field(default="127.0.0.1", min_length=1)
    api_port: int = Field(default=8000, ge=1, le=65535)
    web_origin: str = "http://localhost:3000"
    database_url: str = Field(default="sqlite+aiosqlite:///./data/alodi.db", repr=False)
    mock_pack_dir: Path = Path("prep/02-technical/mock-data")
    recordings_dir: Path = Path("data/recordings")
    recording_ttl_days: int = Field(default=30, ge=1, le=30)

    ai_mode: Literal["stub", "live"] = "stub"
    offline_mode: bool = False
    auto_buyer: bool = False
    demo_start: datetime = datetime.fromisoformat("2026-10-31T06:28:00+07:00")
    demo_clock_speed: float = Field(default=600, gt=0, allow_inf_nan=False)
    demo_scenario: ScenarioName = "A_main"

    call_window_start: time = time(8)
    call_window_end: time = time(20, 30)
    undo_window_min: int = Field(default=2, ge=1)
    call1_after_min: int = Field(default=60, ge=1)
    call2_after_min: int = Field(default=120, ge=1)
    max_calls_per_cycle: int = Field(default=2, ge=1, le=2)
    max_redeliveries: int = Field(default=2, ge=0, le=2)
    reschedule_horizon_days: int = Field(default=5, ge=1, le=5)
    auto_apply_confidence: float = Field(default=0.85, ge=0.85, le=1, allow_inf_nan=False)
    route_cutoff: time = time(8)

    openai_api_key: SecretStr = Field(default=SecretStr(""), repr=False, exclude=True)
    assemblyai_api_key: SecretStr = Field(default=SecretStr(""), repr=False, exclude=True)
    assembly_api_key: SecretStr = Field(default=SecretStr(""), repr=False, exclude=True)
    openai_model: str = "gpt-5.6-terra"
    openai_reasoning_effort: str = "none"
    assemblyai_memo_model: str = "universal-3-5-pro"
    voice_provider: str = "openai_realtime"
    openai_realtime_model: str = "gpt-realtime-2.1"
    openai_realtime_voice: str = "marin"
    buyer_language: str = "vi"
    call_max_duration_seconds: int = Field(default=90, ge=1)
    ffmpeg_path: str = "ffmpeg"
    ai_request_timeout_seconds: float = Field(default=30, gt=0, allow_inf_nan=False)

    @field_validator("mock_pack_dir", "recordings_dir", mode="after")
    @classmethod
    def root_relative_paths(cls, value: Path) -> Path:
        return resolve_path(value)

    @field_validator("database_url")
    @classmethod
    def local_sqlite_url(cls, value: str) -> str:
        try:
            url = make_url(value)
        except ArgumentError:
            raise ConfigurationError("Invalid configuration: DATABASE_URL") from None
        if (
            url.drivername != "sqlite+aiosqlite"
            or not url.database
            or url.host
            or url.username
            or url.password
            or url.query
        ):
            raise ConfigurationError("Invalid configuration: DATABASE_URL")
        if url.database != ":memory:":
            url = url.set(database=resolve_path(url.database).as_posix())
        return url.render_as_string(hide_password=True)

    @field_validator("tz")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ConfigurationError("Invalid configuration: TZ") from None
        return value

    @field_validator("demo_start")
    @classmethod
    def aware_start(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ConfigurationError("Invalid configuration: DEMO_START")
        return value

    @field_validator("web_origin")
    @classmethod
    def single_web_origin(cls, value: str) -> str:
        try:
            origin = urlsplit(value)
            valid = (
                origin.scheme in {"http", "https"}
                and origin.hostname
                and origin.port != 0
                and not origin.username
                and not origin.password
                and origin.path in {"", "/"}
                and not origin.query
                and not origin.fragment
            )
        except ValueError:
            valid = False
        if not valid:
            raise ConfigurationError("Invalid configuration: WEB_ORIGIN")
        return value.rstrip("/")

    @model_validator(mode="after")
    def consistent_settings(self) -> Self:
        start, end = self.call_window_start, self.call_window_end
        if start.tzinfo or end.tzinfo or start >= end:
            raise ConfigurationError("Invalid configuration: CALL_WINDOW_START, CALL_WINDOW_END")
        if self.route_cutoff.tzinfo:
            raise ConfigurationError("Invalid configuration: ROUTE_CUTOFF")
        canonical = self.assemblyai_api_key.get_secret_value()
        alias = self.assembly_api_key.get_secret_value()
        if canonical and alias and canonical != alias:
            raise ConfigurationError(
                "Conflicting configuration: ASSEMBLY_API_KEY, ASSEMBLYAI_API_KEY"
            )
        if self.ai_mode == "live" and not self.offline_mode:
            missing = []
            if not self.openai_api_key.get_secret_value().strip():
                missing.append("OPENAI_API_KEY")
            if not (canonical or alias).strip():
                missing.append("ASSEMBLYAI_API_KEY (or ASSEMBLY_API_KEY)")
            if missing:
                raise ConfigurationError("Missing configuration: " + ", ".join(missing))
        return self

    @property
    def effective_assemblyai_api_key(self) -> SecretStr:
        return (
            self.assemblyai_api_key
            if self.assemblyai_api_key.get_secret_value()
            else self.assembly_api_key
        )

    @property
    def effective_ai_mode(self) -> Literal["stub", "live", "replay"]:
        return "replay" if self.offline_mode else self.ai_mode

    @property
    def timezone(self) -> ZoneInfo:
        return ZoneInfo(self.tz)

    def prepare_directories(self) -> None:
        database = make_url(self.database_url).database
        if database and database != ":memory:":
            Path(database).parent.mkdir(parents=True, exist_ok=True)
        self.recordings_dir.mkdir(parents=True, exist_ok=True)


def load_settings(**overrides: object) -> Settings:
    try:
        return Settings(**overrides)
    except ValidationError as exc:
        names = sorted({str(error["loc"][0]).upper() for error in exc.errors() if error["loc"]})
        raise ConfigurationError("Invalid configuration: " + ", ".join(names)) from None
