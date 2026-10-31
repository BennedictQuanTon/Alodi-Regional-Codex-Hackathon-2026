import json

import pytest
from alodi_ai.bridge import FixtureBridge, Snapshot
from alodi_ai.observe import ObservationLog
from alodi_ai.runtime import Runtime
from alodi_ai.schema import empty_context
from alodi_ai.settings import Settings


def test_observation_allowlist_masking_bounds_and_generation_fence():
    log = ObservationLog(limit=5, per_call_limit=3)
    snapshot = Snapshot(known_pii=["Synthetic Buyer"])
    log.activate(snapshot.demo_epoch)
    context = empty_context().model_dump(by_alias=True, mode="json")
    context["delivery_notes"] = "Synthetic Buyer 0912345678 buyer@example.com"
    log.append(
        snapshot,
        {
            "type": "proposal",
            "context": context,
            "revision": 2,
            "sdp": "private-sdp",
            "audio": "private-audio",
            "reasoning": "private-thought",
            "secret": "private-secret",
        },
        "call",
    )
    log.append(snapshot, {"type": "reasoning", "text": "private-thought"}, "call")
    log.append(
        snapshot,
        {
            "type": "transcript",
            "speaker": "buyer",
            "turn_id": "turn",
            "text": "Synthetic Buyer sk-syntheticlongsecret123456",
        },
        "call",
    )
    first = log.read(snapshot.tracking_id, snapshot.demo_epoch)
    safe = json.dumps(first)
    for forbidden in [
        "Synthetic Buyer",
        "0912345678",
        "buyer@example.com",
        "private-",
        "sk-syntheticlongsecret123456",
    ]:
        assert forbidden not in safe
    assert (
        len(first["records"]) == 2
        and first["records"][-1]["payload"]["turn_id"] == "turn"
    )
    for index in range(20):
        log.append(snapshot, {"type": "status", "status": str(index)}, "call")
    assert len(log.records) <= 5
    assert sum(row["call_id"] == "call" for row in log.records) <= 3
    assert log.read(snapshot.tracking_id, snapshot.demo_epoch, after_seq=1)["truncated"]
    log.retire(snapshot.demo_epoch)
    sequence = log.sequence
    log.append(snapshot, {"type": "status", "status": "late"}, "call")
    assert log.sequence == sequence and not log.records
    log.activate("new")
    newer = Snapshot(demo_epoch="new")
    log.append(newer, {"type": "status", "status": "ringing"}, "new-call")
    assert not log.read(newer.tracking_id, snapshot.demo_epoch)["records"]
    assert len(log.read(newer.tracking_id, "new")["records"]) == 1


def test_other_order_traffic_does_not_falsely_report_truncation_and_paging_has_cursor():
    log = ObservationLog()
    other = Snapshot(tracking_id="other")
    target = Snapshot(tracking_id="target")
    for _ in range(2):
        log.append(other, {"type": "status", "status": "ringing"}, "other-call")
    for _ in range(3):
        log.append(target, {"type": "status", "status": "ringing"}, "target-call")
    page = log.read("target", target.demo_epoch, after_seq=1, limit=2)
    assert not page["truncated"] and page["has_more"]
    assert page["next_seq"] == 4 and page["latest_seq"] == 5
    last = log.read("target", target.demo_epoch, after_seq=page["next_seq"])
    assert [row["seq"] for row in last["records"]] == [5]


@pytest.mark.asyncio
async def test_observation_reads_never_replace_or_send_to_buyer_socket():
    bridge = FixtureBridge()
    runtime = Runtime(Settings(_env_file=None, ai_mode="stub"), bridge)
    call = await runtime.reserve_call(bridge.state.tracking_id)

    class Socket:
        messages = []

        async def send_json(self, message):
            self.messages.append(message)

    socket = Socket()
    call.socket = socket
    await runtime.emit(
        call,
        {
            "type": "transcript",
            "speaker": "buyer",
            "text": "hello",
            "turn_id": "partial-1",
            "final": False,
        },
    )
    before = list(socket.messages)
    first = runtime.observations.read(
        call.snapshot.tracking_id, call.snapshot.demo_epoch
    )
    runtime.observations.read(
        call.snapshot.tracking_id, call.snapshot.demo_epoch, first["next_seq"]
    )
    assert call.socket is socket and socket.messages == before
    assert first["records"][-1]["payload"]["turn_id"] == "partial-1"
    await runtime.shutdown()
