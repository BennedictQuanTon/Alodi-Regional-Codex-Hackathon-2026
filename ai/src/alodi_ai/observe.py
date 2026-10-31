"""Bounded public application events, never raw provider traffic or reasoning."""

from collections import deque
import re
from copy import deepcopy
from datetime import UTC, datetime
from uuid import uuid4

from pydantic import ValidationError

from .privacy import mask
from .schema import DeliveryContext

FIELDS = {
    "transcript": {"speaker", "text", "final", "turn_id"},
    "proposal": {"revision", "context"},
    "result": {"status", "message", "context", "job_id"},
    "status": {"status", "reason", "message", "job_id"},
    "turn_state": {
        "phase",
        "turn_id",
        "generation_id",
        "playback_revision",
        "input_allowed",
        "notes_timeout_seconds",
    },
    "error": {"code", "message"},
    "notice": {"code", "message"},
    "models": {"voice", "extraction", "transcription"},
    "media_stop": {"reason"},
}


def safe_value(value, known_pii, depth=0):
    if depth > 8:
        return None
    if isinstance(value, str):
        text = mask(value, known_pii)
        text = re.sub(
            r"(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{16,}|"
            r"Bearer\s+[A-Za-z0-9._-]{12,})",
            "[secret]",
            text,
            flags=re.I,
        )
        return text[:2000]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, dict):
        return {
            str(key): safe_value(item, known_pii, depth + 1)
            for key, item in list(value.items())[:30]
        }
    return None


class ObservationLog:
    def __init__(self, limit=1000, per_call_limit=300):
        self.records = deque(maxlen=limit)
        self.sequence = 0
        self.stream_id = str(uuid4())
        self.active_generation = None
        self.evicted_through = 0
        self.per_call_limit = per_call_limit

    def activate(self, generation):
        self.active_generation = generation

    def retire(self, generation):
        self.active_generation = f"retired:{generation}"
        self.evicted_through = 0
        self.records = deque(
            (row for row in self.records if row["generation_id"] != generation),
            maxlen=self.records.maxlen,
        )

    def append(self, snapshot, message, call_id=None):
        if (
            self.active_generation is not None
            and snapshot.demo_epoch != self.active_generation
        ):
            return
        kind = message.get("type")
        if kind not in FIELDS:
            return
        payload = {key: message[key] for key in FIELDS[kind] if key in message}
        if "context" in payload:
            try:
                payload["context"] = DeliveryContext.model_validate(
                    payload["context"]
                ).model_dump(by_alias=True, mode="json")
            except (ValidationError, TypeError):
                payload.pop("context")
        self.sequence += 1
        same_call = [
            row for row in self.records if call_id and row["call_id"] == call_id
        ]
        if len(same_call) >= self.per_call_limit:
            self.evicted_through = max(self.evicted_through, same_call[0]["seq"])
            self.records.remove(same_call[0])
        if len(self.records) == self.records.maxlen:
            self.evicted_through = max(self.evicted_through, self.records[0]["seq"])
        self.records.append(
            {
                "seq": self.sequence,
                "at": datetime.now(UTC).isoformat(),
                "tracking_id": snapshot.tracking_id,
                "generation_id": snapshot.demo_epoch,
                "call_id": call_id,
                "type": kind,
                "payload": safe_value(payload, snapshot.known_pii),
            }
        )

    def read(self, tracking_id, generation, after_seq=0, limit=100):
        rows = [
            record
            for record in self.records
            if record["tracking_id"] == tracking_id
            and record["generation_id"] == generation
        ]
        eligible = [record for record in rows if record["seq"] > after_seq]
        return {
            "tracking_id": tracking_id,
            "generation_id": generation,
            "stream_id": self.stream_id,
            "latest_seq": self.sequence,
            "next_seq": eligible[min(len(eligible), limit) - 1]["seq"]
            if eligible
            else after_seq,
            "records": deepcopy(eligible[:limit]),
            "truncated": after_seq < self.evicted_through,
            "has_more": len(eligible) > limit,
        }
