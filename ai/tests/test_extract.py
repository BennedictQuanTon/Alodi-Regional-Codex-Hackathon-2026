"""Provider extraction contract: placeholder descriptions are not location facts."""

import importlib
from types import SimpleNamespace

import pytest
from alodi_ai.bridge import FixtureBridge
from alodi_ai.settings import Settings
from test_core import candidate

extraction = importlib.import_module("alodi_ai.extract")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "note,expected",
    [
        ("/", ""),
        (" - ", ""),
        ("—", ""),
        ("East gate / security desk", "East gate / security desk"),
    ],
)
async def test_live_extraction_normalizes_only_empty_placeholder_description(
    monkeypatch, note, expected
):
    proposal = candidate()
    proposal.drop_location.note = note
    proposal.delivery_notes = "Please call when arriving"

    class Client:
        def __init__(self, **options):
            self.responses = self

        async def create(self, **body):
            return SimpleNamespace(
                output_text=proposal.model_dump_json(by_alias=True), usage=None
            )

        async def close(self):
            pass

    monkeypatch.setattr(extraction, "AsyncOpenAI", Client)
    bridge = FixtureBridge()
    snapshot = await bridge.snapshot(bridge.state.tracking_id)
    result = await extraction.extract(
        Settings(_env_file=None, ai_mode="live", openai_api_key="synthetic-test"),
        snapshot,
        "Leave at the security desk. Please call when arriving.",
        "ai_call",
    )
    assert result.drop_location.note == expected
    assert result.drop_location.type == "security_desk"
    assert result.drop_location.confidence == proposal.drop_location.confidence
    assert result.delivery_notes == "Please call when arriving"
