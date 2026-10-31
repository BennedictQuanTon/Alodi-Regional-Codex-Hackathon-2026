from datetime import datetime, timedelta

from app.clock import BusinessClock
from app.db.models import DemoState


def test_business_clock_uses_elapsed_time_checkpoint_and_reset(monkeypatch):
    elapsed = [10.0]
    monkeypatch.setattr("app.clock.monotonic", lambda: elapsed[0])
    start = datetime.fromisoformat("2026-10-31T06:28:00+07:00")
    state = DemoState(
        generation_id="first", clock_start=start, business_time=start, clock_speed=600
    )
    clock = BusinessClock()
    assert clock.now(state) == start
    elapsed[0] += 0.2
    assert abs((clock.now(state) - start).total_seconds() - 120) < 0.0001
    state.business_time = start + timedelta(hours=2)
    assert clock.now(state) == state.business_time
    elapsed[0] += 1
    assert clock.now(state) == state.business_time + timedelta(minutes=10)
    resumed = BusinessClock()
    assert resumed.now(state) == state.business_time
    state.generation_id, state.business_time = "reset", start
    assert clock.now(state) == start
