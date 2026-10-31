import asyncio
import json

import pytest
import pytest_asyncio

from alodi_ai import live
from alodi_ai.bridge import FixtureBridge
from alodi_ai.live import LiveSession, no_more_notes
from alodi_ai.runtime import create_app
from alodi_ai.settings import Settings
from test_core import candidate


@pytest_asyncio.fixture
async def harness(monkeypatch):
    bridge = FixtureBridge()
    runtime = create_app(
        Settings(_env_file=None, ai_mode="stub"), bridge, fixture=True
    ).state.runtime
    call = await runtime.reserve_call(bridge.state.tracking_id)
    call.status = "connected"
    session = LiveSession(runtime, call)
    events = []

    class Socket:
        async def send_json(self, event):
            events.append(event)

    class Provider:
        def __init__(self):
            self.sent = []
            self.queue = asyncio.Queue()
            self.auto_ack = True

        async def send(self, raw):
            event = json.loads(raw)
            self.sent.append(event)
            if self.auto_ack and event["type"].startswith("session.input_audio."):
                ack = (
                    "session.input_audio.muted"
                    if event["type"].endswith(".mute")
                    else "session.input_audio.unmuted"
                )
                await self.queue.put(
                    json.dumps({"type": ack, "client_event_id": event["event_id"]})
                )

        def __aiter__(self):
            return self

        async def __anext__(self):
            return await self.queue.get()

        async def close(self):
            pass

    call.socket = Socket()
    session.ws = Provider()
    session.reader = asyncio.create_task(session.read())

    async def fake_extract(*args):
        return candidate()

    monkeypatch.setattr(live, "extract", fake_extract)
    yield session, runtime, call, bridge, events
    await runtime.end(call, "test_cleanup")
    session.reader.cancel()
    await asyncio.gather(session.reader, return_exceptions=True)
    session.reader = None
    await session.close()


async def provider_event(session, event):
    await session.ws.queue.put(json.dumps(event))
    await asyncio.sleep(0.01)


async def playback(session, state, **changes):
    await session.browser_event(
        {
            "type": "playback_state",
            "generation_id": session.generation_id,
            "turn_id": session.turn_id,
            "playback_revision": session.playback_revision,
            "state": state,
            **changes,
        }
    )


async def drain(session, text="spoken", start=10, end=20):
    await playback(session, "playing", playback_revision=session.playback_revision + 1)
    await provider_event(
        session,
        {
            "type": "session.output_transcript.delta",
            "delta": text,
            "start_ms": start,
            "end_ms": end,
        },
    )
    await playback(session, "drained")
    if session.verification_task:
        await session.verification_task


async def buyer(session, text, start=21, end=30):
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": text,
            "start_ms": start,
            "end_ms": end,
        },
    )
    await session.delegate("delegation", end + 1, session.input_revision)


@pytest.mark.asyncio
async def test_input_requires_audible_drain_and_matching_unmute_ack(harness):
    session, _, _, _, events = harness
    await session.say(None, "Hello", "greeting")
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "yes",
            "start_ms": 0,
            "end_ms": 3,
        },
    )
    assert session.input_revision == 0
    await playback(session, "drained")
    assert not session.input_allowed
    await playback(session, "playing", playback_revision=1)
    session.ws.auto_ack = False
    opening = asyncio.create_task(playback(session, "drained"))
    await asyncio.sleep(0.01)
    assert not session.input_allowed
    event_id = session.ws.sent[-1]["event_id"]
    await provider_event(
        session, {"type": "session.input_audio.unmuted", "client_event_id": "stale"}
    )
    assert not session.input_allowed
    await provider_event(
        session, {"type": "session.input_audio.unmuted", "client_event_id": event_id}
    )
    await opening
    assert events[-1]["input_allowed"] and events[-1]["playback_revision"] == 1


@pytest.mark.asyncio
async def test_stale_playback_and_blocked_tail_cannot_open_input(harness):
    session, *_ = harness
    await session.say(None, "Hello", "greeting")
    await playback(session, "playing", playback_revision=1)
    await playback(session, "blocked", playback_revision=2)
    old_turn = session.turn_id
    await playback(session, "drained", playback_revision=1)
    assert not session.input_allowed
    await playback(session, "ready", playback_revision=2)
    assert session.turn_id == old_turn + 1 and not session.output_heard
    await playback(session, "drained", turn_id=old_turn)
    assert not session.input_allowed


@pytest.mark.asyncio
async def test_confirmation_requires_played_and_verified_full_readback(harness):
    session, _, _, bridge, _ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    await session.read_back(None)
    # A transcript without real playback never makes a confirmation valid.
    await provider_event(
        session,
        {
            "type": "session.output_transcript.delta",
            "delta": "readback",
            "start_ms": 10,
            "end_ms": 20,
        },
    )
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "yes",
            "start_ms": 21,
            "end_ms": 30,
        },
    )
    assert session.input_revision == 0 and not session.readback_played
    await drain(session)
    await buyer(session, "đúng rồi")
    assert session.phase == "notes" and session.confirmed
    assert bridge.state.context_version == 1 and session.notes_timer is None


@pytest.mark.asyncio
async def test_negative_notes_finalizes_once_and_keeps_media_until_farewell_drain(
    harness,
):
    session, _, call, bridge, events = harness
    session.candidate, session.candidate_revision = candidate(), 1
    session.confirmed = True
    await session.say(None, "Notes?", "notes")
    await drain(session)
    await buyer(session, "dạ không")
    assert bridge.state.context_version == 2 and session.phase == "closing"
    assert call.status == "connected" and not any(
        e["type"] == "media_stop" for e in events
    )
    await session.finalize(None)
    assert len(bridge.events) == 1
    await playback(session, "drained")
    assert call.status == "connected"  # A new farewell must actually play.
    await drain(session, start=40, end=50)
    assert call.status == "ended" and len(bridge.events) == 1


@pytest.mark.asyncio
async def test_notes_timeout_starts_after_prompt_and_noise_restarts_silence(
    harness, monkeypatch
):
    session, _, _, bridge, _ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    session.confirmed = True
    wait = asyncio.Event()
    real_sleep = asyncio.sleep

    async def controlled_sleep(seconds):
        if seconds == 8:
            await wait.wait()
        else:
            await real_sleep(seconds)

    monkeypatch.setattr(live.asyncio, "sleep", controlled_sleep)
    await session.say(None, "Notes?", "notes")
    assert session.notes_timer is None
    await drain(session)
    first_timer = session.notes_timer
    await session.browser_event(
        {
            "type": "user_activity",
            "generation_id": session.generation_id,
            "turn_id": session.turn_id,
            "active": True,
        }
    )
    assert session.notes_timer is None and bridge.state.context_version == 1
    await session.browser_event(
        {
            "type": "user_activity",
            "generation_id": session.generation_id,
            "turn_id": session.turn_id,
            "active": False,
        }
    )
    assert session.notes_timer is not None and session.notes_timer is not first_timer
    wait.set()
    await real_sleep(0.02)
    assert bridge.state.context_version == 2 and session.phase == "closing"


@pytest.mark.asyncio
async def test_notes_transcript_blocks_silence_and_requires_reconfirmation(
    harness, monkeypatch
):
    session, _, _, bridge, _ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    session.confirmed = True
    await session.say(None, "Notes?", "notes")
    await drain(session)
    updated = candidate().model_copy(update={"delivery_notes": "Call from the gate"})

    async def note_extract(*args):
        return updated

    monkeypatch.setattr(live, "extract", note_extract)
    await buyer(session, "Gọi tôi ở cổng")
    assert session.phase == "confirming" and not session.confirmed
    assert session.candidate.delivery_notes == "Call from the gate"
    assert bridge.state.context_version == 1 and session.notes_timer is None
    await session.finalize(None)
    assert bridge.state.context_version == 1
    await drain(session, start=40, end=50)
    await buyer(session, "đúng rồi", start=51, end=60)
    assert (
        bridge.state.context.delivery_notes == "Call from the gate"
        and session.phase == "closing"
    )


@pytest.mark.asyncio
async def test_missing_data_or_unconfirmed_changes_never_finalize(harness):
    session, _, _, bridge, _ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    await session.finalize(None)
    assert bridge.state.context_version == 1
    session.confirmed = True
    session.candidate = candidate().model_copy(update={"drop_location": None})
    await session.finalize(None)
    assert bridge.state.context_version == 1 and not session.finalizing


@pytest.mark.asyncio
async def test_old_snapshot_result_is_rejected_and_not_claimed_saved(harness):
    session, _, _, bridge, events = harness
    session.candidate, session.candidate_revision = candidate(), 1
    session.confirmed = True
    bridge.reset()
    await session.finalize(None)
    assert (
        next(e for e in events if e["type"] == "result")["status"] == "rejected_stale"
    )
    assert (
        session.closing_reason == "rejected_stale" and bridge.state.context_version == 1
    )


@pytest.mark.asyncio
async def test_opt_out_uses_bridge_without_confirmation_and_farewell(harness):
    session, _, call, bridge, _ = harness
    session.candidate, session.candidate_revision = (
        candidate().model_copy(update={"opt_out": True}),
        1,
    )
    await session.finalize(None, opt_out=True)
    assert (
        not bridge.state.eligible
        and call.status == "connected"
        and session.phase == "closing"
    )


@pytest.mark.asyncio
async def test_delayed_transcript_from_closed_interval_is_retained(harness):
    session, *_ = harness
    await session.say(None, "Hello", "greeting")
    await drain(session)
    session.listening_windows[-1][1] = 30
    await session.say(None, "Readback", "collecting")
    await drain(session, start=40, end=50)
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "late correction",
            "start_ms": 25,
            "end_ms": 29,
        },
    )
    assert session.inputs[-1][2] == "late correction"
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "during AI",
            "start_ms": 35,
            "end_ms": 39,
        },
    )
    assert len(session.inputs) == 1


@pytest.mark.asyncio
async def test_late_revision_during_extraction_is_processed_again(harness, monkeypatch):
    session, _, _, bridge, _ = harness
    await session.say(None, "Hello", "greeting")
    await drain(session)
    entered, release = asyncio.Event(), asyncio.Event()
    seen = []

    async def delayed(settings, snapshot, text, source, metrics):
        seen.append(text)
        if len(seen) == 1:
            entered.set()
            await release.wait()
        return candidate()

    monkeypatch.setattr(live, "extract", delayed)
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "tomorrow ",
            "start_ms": 21,
            "end_ms": 24,
        },
    )
    task = asyncio.create_task(session.delegate("d", 35, 1))
    await entered.wait()
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "after six",
            "start_ms": 25,
            "end_ms": 30,
        },
    )
    release.set()
    await task
    await session.task
    assert seen == ["tomorrow ", "tomorrow after six"]
    assert session.candidate_revision == 2 and bridge.state.context_version == 1


@pytest.mark.asyncio
async def test_new_audio_invalidates_readback_permission(harness):
    session, *_ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    await session.read_back(None)
    await drain(session)
    assert session.readback_played
    await provider_event(
        session,
        {
            "type": "session.output_transcript.delta",
            "delta": "more speech",
            "start_ms": 22,
            "end_ms": 25,
        },
    )
    assert not session.input_allowed and not session.readback_played
    await playback(session, "playing", playback_revision=2)
    await playback(session, "drained", playback_revision=1)
    assert not session.input_allowed
    await playback(session, "drained", playback_revision=2)
    await session.verification_task
    assert session.input_allowed and session.readback[1] == len(session.outputs)


@pytest.mark.parametrize(
    "text",
    [
        "dạ không",
        "Dạ, không có gì thêm.",
        "Vâng, không có gì thêm ạ…",
        "không ạ",
        "không có gì thêm",
        "không cần gì nữa",
        "hết rồi",
        "no more",
    ],
)
def test_natural_negative_notes(text):
    assert no_more_notes(text)


@pytest.mark.parametrize(
    "text",
    ["không, đổi sang sáu giờ", "không gọi trước nhé", "không đúng", "không nhận được"],
)
def test_corrections_are_not_negative_notes(text):
    assert not no_more_notes(text)


@pytest.mark.asyncio
async def test_late_correction_after_negative_notes_is_not_applied(
    harness, monkeypatch
):
    session, _, _, bridge, _ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    session.confirmed = True
    await session.say(None, "Notes?", "notes")
    await drain(session)
    updated = candidate().model_copy(update={"delivery_notes": "Call before arrival"})

    async def with_notes(*args):
        return updated

    monkeypatch.setattr(live, "extract", with_notes)
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "không",
            "start_ms": 21,
            "end_ms": 25,
        },
    )
    processing = asyncio.create_task(session.delegate("d", 35, 1))
    await asyncio.sleep(0.3)  # Later than the previous 250 ms finalization bug.
    assert bridge.state.context_version == 1 and session.input_allowed
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": ", nhớ gọi trước",
            "start_ms": 26,
            "end_ms": 32,
        },
    )
    await processing
    assert bridge.state.context_version == 1 and session.phase == "confirming"
    assert session.candidate.delivery_notes == "Call before arrival"


@pytest.mark.asyncio
async def test_resumed_audio_during_prelisten_validation_revokes_permission(
    harness, monkeypatch
):
    session, _, _, bridge, _ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    await session.read_back(None)
    entered, release = asyncio.Event(), asyncio.Event()

    async def delayed(*args):
        entered.set()
        await release.wait()
        return candidate()

    monkeypatch.setattr(live, "extract", delayed)
    await playback(session, "playing", playback_revision=1)
    await provider_event(
        session,
        {
            "type": "session.output_transcript.delta",
            "delta": "readback",
            "start_ms": 10,
            "end_ms": 20,
        },
    )
    await playback(session, "drained")  # Returns without waiting for extraction.
    await entered.wait()
    assert not session.input_allowed
    await provider_event(
        session,
        {
            "type": "session.output_transcript.delta",
            "delta": "another clause",
            "start_ms": 31,
            "end_ms": 40,
        },
    )
    release.set()
    await session.verification_task
    assert not session.confirmed and not session.input_allowed
    assert bridge.state.context_version == 1


@pytest.mark.asyncio
async def test_post_answer_ack_preserves_verified_confirmation(harness):
    session, _, _, bridge, _ = harness
    session.candidate, session.candidate_revision = candidate(), 1
    await session.read_back(None)
    await drain(session)
    await provider_event(
        session,
        {
            "type": "session.input_transcript.delta",
            "delta": "đúng rồi",
            "start_ms": 21,
            "end_ms": 25,
        },
    )
    await provider_event(
        session,
        {
            "type": "session.output_transcript.delta",
            "delta": "vâng",
            "start_ms": 31,
            "end_ms": 35,
        },
    )
    await session.delegate("d", 30, session.input_revision)
    assert session.phase == "notes" and session.confirmed
    assert bridge.state.context_version == 1


@pytest.mark.asyncio
async def test_duplicate_and_concurrent_mute_reuse_acknowledged_state(harness):
    session, *_ = harness
    await session.audio_control(True)
    session.ws.auto_ack = False  # A redundant provider toggle would never ACK.
    before = len(session.ws.sent)
    await asyncio.wait_for(
        asyncio.gather(
            session.mute_spontaneous(),
            session.say(None, "Repeat safely", "collecting"),
        ),
        0.5,
    )
    assert len(session.ws.sent) == before + 1
    assert session.ws.sent[-1]["type"] == "session.commentary.append"
    assert not session.input_allowed


@pytest.mark.asyncio
async def test_repeated_blocked_report_does_not_echo_state(harness):
    session, _, _, _, events = harness
    await session.say(None, "Hello", "greeting")
    await playback(session, "blocked", playback_revision=1)
    count = len(events)
    await playback(session, "blocked", playback_revision=1)
    assert len(events) == count


@pytest.mark.asyncio
@pytest.mark.parametrize("material_change", [False, True])
async def test_checklist_verifier_accepts_canonical_equivalence_but_rejects_changed_notes(
    harness, monkeypatch, material_change
):
    session, *_ = harness
    proposed = candidate().model_copy(
        update={"delivery_notes": "Call ten minutes before arrival"}
    )
    session.candidate, session.candidate_revision = proposed, 1
    supplied = []

    async def canonical_extract(settings, snapshot, text, source, usage, expected):
        supplied.append(expected)
        return (
            proposed.model_copy(update={"delivery_notes": "Call on arrival"})
            if material_change
            else proposed
        )

    monkeypatch.setattr(live, "extract", canonical_extract)
    await session.read_back(None)
    initial_turn = session.turn_id
    await drain(session)
    assert supplied == [proposed]
    if material_change:
        assert not session.input_allowed and session.turn_id == initial_turn + 1
    else:
        assert session.input_allowed and session.verified_readback is not None
