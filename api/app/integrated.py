"""Single process: real workflow, database, scheduler and GPT transport routes."""

from alodi_ai.runtime import create_app as create_ai_app
from alodi_ai.settings import Settings as AISettings

from app.ai_bridge import LiveAdapter, WorkflowBridge
from app.main import create_app
from app.settings import load_settings


def create_integrated_app(settings=None, *, ai_settings=None, **options):
    settings = settings or load_settings()
    ai_settings = ai_settings or AISettings(
        ai_mode=settings.ai_mode,
        offline_mode=settings.offline_mode,
        voice_provider=settings.voice_provider,
        openai_api_key=settings.openai_api_key,
        openai_model=settings.openai_model,
        openai_reasoning_effort=settings.openai_reasoning_effort,
        openai_live_model=settings.openai_live_model,
        openai_live_voice=settings.openai_live_voice,
        openai_memo_model=settings.openai_memo_model,
        ffmpeg_path=settings.ffmpeg_path,
        ffprobe_path=settings.ffprobe_path,
        call_max_duration_seconds=settings.call_max_duration_seconds,
    )
    bridge = WorkflowBridge()
    ai_app = create_ai_app(settings=ai_settings, bridge=bridge, fixture=False)
    adapter = LiveAdapter(bridge, ai_settings)
    adapter.runtime = ai_app.state.runtime
    app = create_app(
        settings,
        part2_adapter=adapter,
        part2_router=ai_app.router,
        ai_runtime=adapter.runtime,
        **options,
    )
    app.state.ai_bridge = bridge
    return app
