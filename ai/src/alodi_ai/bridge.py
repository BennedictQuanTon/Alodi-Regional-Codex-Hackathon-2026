from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from .schema import DeliveryContext, empty_context


@dataclass
class Snapshot:
    tracking_id: str = "SPXVN0123456789"
    rescue_case_id: int = 1
    context_version: int = 1
    demo_epoch: int | str = 1
    business_now: datetime = field(
        default_factory=lambda: datetime.fromisoformat("2026-10-31T11:04:00+07:00")
    )
    offered_windows: list[str] = field(
        default_factory=lambda: [
            "08:00/10:00",
            "10:00/12:00",
            "14:00/17:00",
            "17:00/20:00",
        ]
    )
    reschedule_deadline: datetime = field(
        default_factory=lambda: datetime.fromisoformat("2026-11-05T20:00:00+07:00")
    )
    context: DeliveryContext = field(default_factory=empty_context)
    known_pii: list[str] = field(default_factory=lambda: ["Minh Hoang", "0912345678"])
    eligible: bool = True


class Bridge(Protocol):
    async def snapshot(self, tracking_id: str) -> Snapshot: ...
    async def submit(
        self,
        snapshot: Snapshot,
        proposal: DeliveryContext,
        source: str,
        confirmation: bool,
        proposal_revision: int,
        idempotency_key: str,
    ) -> str: ...


class FixtureBridge:
    def __init__(self):
        self.state = Snapshot()
        self.keys = set()
        self.events = []

    async def snapshot(self, tracking_id: str) -> Snapshot:
        from copy import deepcopy

        if tracking_id != self.state.tracking_id:
            raise KeyError(tracking_id)
        return deepcopy(self.state)

    async def submit(
        self,
        snapshot,
        proposal,
        source,
        confirmation,
        proposal_revision,
        idempotency_key,
    ):
        state = self.state
        if idempotency_key in self.keys:
            return "rejected_stale"
        self.keys.add(idempotency_key)
        if (
            snapshot.demo_epoch != state.demo_epoch
            or snapshot.context_version != state.context_version
        ):
            return "rejected_stale"
        if not state.eligible:
            return "blocked_by_policy"
        if proposal.opt_out:
            state.eligible = False
            state.context = proposal
            state.context_version += 1
            return "applied"
        if source == "ai_call" and not confirmation:
            return "needs_clarification"
        fields = [
            proposal.time_window,
            proposal.drop_location,
            proposal.alt_receiver,
            proposal.address_correction,
        ]
        if proposal.cannot_receive or not (
            proposal.time_window and proposal.drop_location
        ):
            return "needs_clarification"
        if any(x and x.confidence < 0.85 for x in fields):
            return "needs_clarification"
        if (
            proposal.address_correction
            and not proposal.address_correction.same_district
        ):
            return "needs_clarification"
        if proposal.time_window:
            start = datetime.combine(
                proposal.time_window.date,
                proposal.time_window.from_,
                tzinfo=snapshot.business_now.tzinfo,
            )
            end = datetime.combine(
                proposal.time_window.date,
                proposal.time_window.to,
                tzinfo=snapshot.business_now.tzinfo,
            )
            if start < snapshot.business_now or end > snapshot.reschedule_deadline:
                return "needs_clarification"
        state.context = proposal
        state.context_version += 1
        self.events.append({"source": source, "result": "applied"})
        return "applied"

    def reset(self):
        epoch = self.state.demo_epoch + 1
        self.state = Snapshot(demo_epoch=epoch)
        self.keys.clear()
        self.events.clear()
