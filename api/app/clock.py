"""Business-time reader, injectable in tests. Job scheduling/clock controls are separate."""

from datetime import datetime, timedelta
from time import monotonic

from app.db.models import DemoState


class BusinessClock:
    """Resume the demo from its last committed checkpoint, using real elapsed time.

    No timers run here. A new reset generation starts from the new seed time.
    Request payloads never supply the authoritative current time.
    """

    def __init__(self) -> None:
        self._generation: str | None = None
        self._start: datetime | None = None
        self._elapsed_start = 0.0
        self._revision = None

    def now(self, state: DemoState) -> datetime:
        checkpoint = state.business_time or state.clock_start
        revision = (state.clock_revision or 0, state.clock_speed, bool(state.clock_paused))
        if self._generation != state.generation_id or self._revision != revision:
            self._generation = state.generation_id
            self._revision = revision
            self._start = max(checkpoint, state.clock_start)
            self._elapsed_start = monotonic()
        if state.clock_paused:
            return checkpoint
        elapsed = (monotonic() - self._elapsed_start) * state.clock_speed
        assert self._start is not None
        candidate = self._start + timedelta(seconds=elapsed)
        if checkpoint > candidate:
            self._start, self._elapsed_start = checkpoint, monotonic()
            return checkpoint
        return candidate
