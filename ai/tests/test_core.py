import asyncio

import httpx
import pytest
from alodi_ai.bridge import FixtureBridge
from alodi_ai.memo import transcribe
from alodi_ai.privacy import mask
from alodi_ai.runtime import create_app
from alodi_ai.schema import DeliveryContext
from alodi_ai.settings import Settings
from pydantic import ValidationError


def config(**values):
    return Settings(_env_file=None, ai_mode="stub", **values)


def candidate(confidence=0.9, same_district=True):
    return DeliveryContext.model_validate(
        {
            "time_window": {
                "date": "2026-11-01",
                "from": "17:00",
                "to": "20:00",
                "confidence": confidence,
            },
            "drop_location": {
                "type": "security_desk",
                "note": "desk",
                "confidence": confidence,
            },
            "alt_receiver": None,
            "address_correction": {
                "text": "street",
                "same_district": same_district,
                "confidence": confidence,
            },
            "cannot_receive": None,
            "opt_out": False,
        }
    )


def test_schema_and_mask():
    with pytest.raises(ValidationError):
        DeliveryContext.model_validate({"opt_out": False})
    with pytest.raises(ValidationError):
        candidate(1.2)
    assert "0912345678" not in mask(
        "Minh Hoang 0912345678 a@example.com", ["Minh Hoang"]
    )
    assert "Minh Hoang" not in mask("Minh Hoang", ["Minh Hoang"])


def test_gpt_only_settings():
    settings = Settings(_env_file=None, openai_api_key="test")
    assert settings.voice_provider == "gpt_live" and settings.missing() == []
    with pytest.raises(ValueError, match="VOICE_PROVIDER"):
        Settings(_env_file=None, voice_provider="assemblyai")


@pytest.mark.asyncio
async def test_fixture_gate():
    bridge = FixtureBridge()
    s = await bridge.snapshot(bridge.state.tracking_id)
    assert (
        await bridge.submit(s, candidate(), "ai_call", False, 1, "a")
        == "needs_clarification"
    )
    assert (
        await bridge.submit(s, candidate(0.4), "shipper_memo", False, 1, "b")
        == "needs_clarification"
    )
    assert (
        await bridge.submit(
            s, candidate(same_district=False), "shipper_memo", False, 1, "c"
        )
        == "needs_clarification"
    )
    assert await bridge.submit(s, candidate(), "ai_call", True, 1, "d") == "applied"
    assert (
        await bridge.submit(s, candidate(), "ai_call", True, 1, "d") == "rejected_stale"
    )
    assert (
        await bridge.submit(s, candidate(), "ai_call", True, 2, "e") == "rejected_stale"
    )
    bridge.reset()
    assert (
        await bridge.submit(s, candidate(), "shipper_memo", False, 1, "f")
        == "rejected_stale"
    )


@pytest.mark.asyncio
async def test_contract_consent_and_offline():
    app = create_app(config(), FixtureBridge(), fixture=True)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        cfg = (await client.get("/ai/config")).json()
        assert cfg["mode"] == "stub" and cfg["disclosure"]["text"]
        fixture = (await client.get("/ai/dev/fixture")).json()
        call = (await client.post("/ai/dev/calls", json={})).json()
        assert (
            await client.post(
                f"/ai/calls/{call['call_id']}/connect", json={"consent": False}
            )
        ).status_code == 403
        assert (
            await client.post(
                f"/ai/calls/{call['call_id']}/connect", json={"consent": True}
            )
        ).status_code == 200
        assert (
            await client.post(
                f"/orders/{fixture['tracking_id']}/memo",
                files={"audio": ("memo.webm", b"x" * 5242881, "audio/webm")},
            )
        ).status_code == 413
        await client.post("/ai/dev/reset")
        assert app.state.runtime.calls[call["call_id"]].status == "ended"
    offline = create_app(config(offline_mode=True), FixtureBridge(), fixture=True)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=offline), base_url="http://test"
    ) as client:
        assert not (await client.get("/ai/config")).json()["ready"]
        c = (await client.post("/ai/dev/calls", json={})).json()
        assert (
            await client.post(
                f"/ai/calls/{c['call_id']}/connect", json={"consent": True}
            )
        ).status_code == 503


@pytest.mark.asyncio
async def test_memo_invalid_and_temp_cleanup(tmp_path, monkeypatch):
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    settings = Settings(_env_file=None, ai_mode="live", openai_api_key="test")
    with pytest.raises(ValueError, match="decoded"):
        await transcribe(settings, b"not-audio")
    assert list(tmp_path.iterdir()) == []


@pytest.mark.asyncio
async def test_missing_past_and_cannot_receive_do_not_apply():
    bridge = FixtureBridge()
    snap = await bridge.snapshot(bridge.state.tracking_id)
    for idx, change in enumerate(
        (
            {"drop_location": None},
            {"time_window": None},
            {
                "time_window": None,
                "drop_location": None,
                "cannot_receive": {"reason": "away"},
            },
            {
                "time_window": {
                    "date": "2026-10-31",
                    "from": "08:00",
                    "to": "10:00",
                    "confidence": 0.9,
                }
            },
        )
    ):
        proposal = candidate().model_dump(by_alias=True, mode="json")
        proposal.update(change)
        assert (
            await bridge.submit(
                snap,
                DeliveryContext.model_validate(proposal),
                "shipper_memo",
                False,
                1,
                str(idx),
            )
            == "needs_clarification"
        )
    assert (
        candidate().model_dump(by_alias=True, mode="json")["time_window"]["from"]
        == "17:00"
    )


@pytest.mark.asyncio
async def test_stale_candidate_cleared_on_new_turn(monkeypatch):
    from alodi_ai import runtime as module

    bridge = FixtureBridge()
    app = create_app(config(), bridge, fixture=True)
    runtime = app.state.runtime
    call = await runtime.reserve_call(bridge.state.tracking_id)
    call.status = "connected"
    release = asyncio.Event()

    async def delayed(*args):
        await release.wait()
        return candidate()

    monkeypatch.setattr(module, "extract", delayed)
    call.proposal = candidate()
    call.proposal_revision = 1
    call.revision = 1
    call.utterance_id = "old"
    call.readback = True
    await runtime.turn(call, "correction")
    assert call.proposal is None and call.utterance_id is None and not call.readback
    await runtime.turn(call, "yes")
    assert bridge.state.context_version == 1
    await runtime.end(call)


def test_part1_bridge_required():
    with pytest.raises(ValueError, match="bridge"):
        create_app(config(), fixture=False)


@pytest.mark.asyncio
async def test_memo_accepts_recorder_padding_and_rejects_long(tmp_path, monkeypatch):
    import wave
    from io import BytesIO

    from alodi_ai import memo

    def audio(seconds):
        output = BytesIO()
        with wave.open(output, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\0\0" * int(16000 * seconds))
        return output.getvalue()

    class Client:
        def __init__(self, **kwargs):
            self.audio = self
            self.transcriptions = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            assert kwargs["model"] == "gpt-transcribe"
            assert kwargs["file"][0] == "memo.wav"
            return type("Transcript", (), {"text": "fixture"})()

    monkeypatch.setattr(memo, "AsyncOpenAI", Client)
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    settings = Settings(_env_file=None, ai_mode="live", openai_api_key="test")
    assert await transcribe(settings, audio(10.2)) == "fixture"
    with pytest.raises(ValueError, match="10 seconds"):
        await transcribe(settings, audio(10.3))
    assert list(tmp_path.iterdir()) == []


@pytest.mark.asyncio
async def test_end_during_connect_does_not_resurrect(monkeypatch):
    from alodi_ai import runtime as module

    entered, release = asyncio.Event(), asyncio.Event()

    class Upstream:
        def __init__(self, runtime, call):
            self.closed = 0

        async def open(self, sdp):
            entered.set()
            await release.wait()

        async def close(self):
            self.closed += 1

    monkeypatch.setattr(module, "LiveSession", Upstream)
    settings = Settings(_env_file=None, ai_mode="live", openai_api_key="test")
    app = create_app(settings, FixtureBridge(), fixture=True)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        call_id = (await client.post("/ai/dev/calls", json={})).json()["call_id"]
        call = app.state.runtime.calls[call_id]
        call.socket = type(
            "Socket", (), {"send_json": lambda *args: asyncio.sleep(0)}
        )()
        connection = asyncio.create_task(
            client.post(
                f"/ai/calls/{call_id}/connect", json={"consent": True, "sdp": "offer"}
            )
        )
        await entered.wait()
        await app.state.runtime.end(call, "reset")
        release.set()
        result = await connection
        assert (
            result.status_code == 409
            and call.status == "ended"
            and call.upstream is None
        )


def test_live_readback_requires_each_matching_field():
    from alodi_ai.live import same_readback

    proposed = candidate()
    assert same_readback(proposed, candidate())
    for changes in (
        {
            "time_window": {
                "date": "2026-11-02",
                "from": "17:00",
                "to": "20:00",
                "confidence": 0.9,
            }
        },
        {
            "time_window": {
                "date": "2026-11-01",
                "from": "14:00",
                "to": "17:00",
                "confidence": 0.9,
            }
        },
        {"drop_location": {"type": "reception", "note": "desk", "confidence": 0.9}},
        {"address_correction": None},
    ):
        data = proposed.model_dump(by_alias=True, mode="json")
        data.update(changes)
        assert not same_readback(proposed, DeliveryContext.model_validate(data))


@pytest.mark.asyncio
async def test_stop_media_before_waiting_on_provider():
    bridge = FixtureBridge()
    runtime = create_app(config(), bridge, fixture=True).state.runtime
    call = await runtime.reserve_call(bridge.state.tracking_id)
    call.status = "connected"
    sent = []

    class Socket:
        async def send_json(self, value):
            sent.append(value["type"])

    class Upstream:
        async def close(self):
            assert "media_stop" in sent and "status" not in sent
            await runtime.emit(call, {"type": "usage", "seconds": 1})

    call.socket = Socket()
    call.upstream = Upstream()
    await runtime.end(call, "test")
    assert sent == ["audio_clear", "media_stop", "usage", "status"]


@pytest.mark.asyncio
async def test_call_split_details_and_correction_preserve_other_fields():
    bridge = FixtureBridge()
    runtime = create_app(config(), bridge, fixture=True).state.runtime
    call = await runtime.reserve_call(bridge.state.tracking_id)
    call.status = "connected"
    await runtime.turn(call, "Tomorrow after five")
    await call.task
    assert call.proposal.time_window.from_.strftime("%H:%M") == "17:00"
    assert call.proposal.drop_location is None
    await runtime.turn(call, "At reception")
    await call.task
    assert call.proposal.time_window.from_.strftime("%H:%M") == "17:00"
    assert call.proposal.drop_location.type == "reception"
    assert call.proposal.alt_receiver is None
    old_revision = call.proposal_revision
    await runtime.turn(call, "yes, but actually after six")
    await call.task
    assert call.proposal.time_window.from_.strftime("%H:%M") == "18:00"
    assert call.proposal.drop_location.type == "reception"
    assert call.proposal_revision > old_revision
    await runtime.turn(call, "dạ đúng rồi")
    assert bridge.state.context_version == 2 and call.status == "ended"


def test_confirmation_requires_an_unqualified_affirmation():
    from alodi_ai.conversation import is_confirmation

    for phrase in (
        "đúng rồi",
        "dạ đúng rồi",
        "vâng đúng rồi",
        "dạ đúng rồi ạ",
        "vâng ạ",
        "đúng rồi ạ",
        "yes",
        "correct",
        "Yes, that is correct.",
        "yes that's right",
        "Yes, it is correct",
        "Yes. That is correct.",
        "That's correct",
        "that’s right",
        "it is correct",
        "yes, correct",
    ):
        assert is_confirmation(phrase)
    for phrase in (
        "yes, but after six",
        "đúng nhưng mai không nhận",
        "không đúng",
        "không đồng ý",
        "yes no",
        "Yes, that is correct, but after six",
        "yes that's right except at reception",
        "That is correct only if tomorrow",
        "Yes, that is not correct",
        "yes, but that is correct",
        "yescorrect",
    ):
        assert not is_confirmation(phrase)


@pytest.mark.asyncio
async def test_conflicting_cannot_receive_requires_clarification():
    bridge = FixtureBridge()
    snap = await bridge.snapshot(bridge.state.tracking_id)
    data = candidate().model_dump(by_alias=True, mode="json")
    data["cannot_receive"] = {
        "reason": "Cannot receive at that appointment; cancel delivery"
    }
    proposal = DeliveryContext.model_validate(data)
    assert (
        await bridge.submit(snap, proposal, "ai_call", True, 1, "conflict")
        == "needs_clarification"
    )
    assert bridge.state.context_version == 1
