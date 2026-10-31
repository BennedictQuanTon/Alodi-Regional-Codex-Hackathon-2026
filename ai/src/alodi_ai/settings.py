from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT / ".env",
        extra="ignore",
        env_file_encoding="utf-8",
        hide_input_in_errors=True,
    )
    ai_mode: str = "live"
    offline_mode: bool = False
    voice_provider: str = "gpt_live"
    buyer_language: str = "vi"
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = "gpt-5.6-terra"
    openai_reasoning_effort: str = "none"
    openai_live_model: str = "gpt-live-1"
    openai_live_voice: str = "marin"
    openai_memo_model: str = "gpt-transcribe"
    openai_tts_model: str = "gpt-4o-mini-tts"
    openai_tts_voice: str = "coral"
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    recordings_dir: str = "data/recordings"
    recording_ttl_days: int = 30

    def __init__(self, **values):
        super().__init__(**values)
        if (
            self.ai_mode not in ("live", "stub")
            or self.voice_provider != "gpt_live"
            or self.buyer_language != "vi"
        ):
            raise ValueError("Invalid AI_MODE, VOICE_PROVIDER or BUYER_LANGUAGE")

    @property
    def mode(self):
        return "offline" if self.offline_mode else self.ai_mode

    def missing(self):
        if self.mode != "live":
            return []
        return ["OPENAI_API_KEY"] if not self.openai_api_key.get_secret_value() else []
