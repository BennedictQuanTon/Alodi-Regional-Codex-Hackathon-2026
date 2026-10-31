"""Explicit demo controls. Reset shares the scheduler lock and changes generation."""

from datetime import datetime, timedelta

from sqlalchemy import func, select

from app.db.models import CallAttempt, DemoState, Hub, Order, RescueCase, ShipperEvent
from app.db.seed import load_seed_pack, seed_database
from app.morning import WorkflowError


class DemoService:
    def __init__(self, scheduler):
        self.scheduler, self.flow = scheduler, scheduler.flow
        self.database, self.settings = self.flow.database, self.flow.settings

    def view(self, state):
        return {
            "generation_id": state.generation_id,
            "now": self.flow.clock.now(state).astimezone(self.settings.timezone).isoformat(),
            "speed": state.clock_speed,
            "paused": bool(state.clock_paused),
            "auto_buyer": bool(state.auto_buyer),
            "offline": bool(state.offline_mode),
            "scenario": state.scenario,
        }

    async def read(self):
        async with self.database.sessions() as session:
            state = await session.get(DemoState, 1)
            if state is None:
                raise WorkflowError("demo_only", "Demo state is not seeded", 503)
            return self.view(state)

    async def next_timer(self, session, state, now):
        candidates = []
        pending = await session.scalar(
            select(func.min(ShipperEvent.commit_at)).where(ShipperEvent.status == "pending")
        )
        case = await session.scalar(
            select(func.min(RescueCase.next_action_at)).where(RescueCase.closed_at.is_(None))
        )
        candidates.extend(value for value in (pending, case) if value and value > now)
        local = now.astimezone(self.settings.timezone)
        for hub in await session.scalars(select(Hub)):
            for day in (local.date(), local.date() + timedelta(days=1)):
                if await session.scalar(
                    select(func.count()).select_from(Order).where(Order.delivery_date == day)
                ):
                    candidates.extend(
                        value
                        for value in (
                            datetime.combine(day, hub.morning_run, self.settings.timezone),
                            datetime.combine(
                                day, self.settings.route_cutoff, self.settings.timezone
                            ),
                        )
                        if value > now
                    )
        if state.auto_buyer:
            from app.db.models import RescueMessage, RescueResult

            for current in await session.scalars(
                select(RescueCase).where(
                    RescueCase.tracking_id == "SPXVN0123452290", RescueCase.closed_at.is_(None)
                )
            ):
                if current.state == "call_1_due":
                    sent = await session.scalar(
                        select(RescueMessage.sent_at).where(
                            RescueMessage.rescue_case_id == current.id,
                            RescueMessage.kind == "rescue_chat",
                        )
                    )
                    if sent and sent + timedelta(minutes=40) > now:
                        candidates.append(sent + timedelta(minutes=40))
                elif current.state == "confirm_in_chat":
                    sent = await session.scalar(
                        select(func.max(RescueResult.created_at)).where(
                            RescueResult.rescue_case_id == current.id
                        )
                    )
                    if sent and sent + timedelta(minutes=1) > now:
                        candidates.append(sent + timedelta(minutes=1))
        if not candidates:
            raise WorkflowError("no_timer", "No future business timer is pending")
        return min(candidates)

    async def change_clock(self, body):
        async with self.flow.morning.transaction(body.generation_id) as (session, now, log):
            state = await session.get(DemoState, 1)
            target = now
            if body.jump:
                target = (
                    await self.next_timer(session, state, now)
                    if body.jump == "next_timer"
                    else datetime.fromisoformat(body.jump)
                )
                if target < now:
                    raise WorkflowError("clock_regression", "Use scenario reset to rewind the demo")
            state.business_time = target
            if body.speed is not None:
                state.clock_speed = body.speed
            if body.paused is not None:
                state.clock_paused = body.paused
            state.clock_revision += 1
            log.audit(
                None,
                "demo_clock",
                {
                    "now": target.isoformat(),
                    "speed": state.clock_speed,
                    "paused": state.clock_paused,
                },
            )
            await log.flush(session)
            return self.view(state)

    async def mode(self, body):
        async with self.flow.morning.transaction(body.generation_id) as (session, now, log):
            state = await session.get(DemoState, 1)
            if (
                body.offline is False
                and self.settings.ai_mode == "live"
                and "live" not in self.scheduler.adapters
            ):
                raise WorkflowError(
                    "part2_unavailable", "Register a live Part 2 adapter first", 503
                )
            if body.auto_buyer is not None:
                state.auto_buyer = body.auto_buyer
            if body.offline is not None:
                state.offline_mode = body.offline
            log.audit(
                None, "demo_mode", {"auto_buyer": state.auto_buyer, "offline": state.offline_mode}
            )
            await log.flush(session)
            return self.view(state)

    async def reset(self, generation, scenario):
        async with self.scheduler.lock:
            calls = []
            async with self.flow.morning.transaction(generation) as (session, now, log):
                calls = [
                    (call.id, call.mode)
                    for call in await session.scalars(
                        select(CallAttempt).where(
                            CallAttempt.generation_id == generation,
                            CallAttempt.status.in_(["requested", "connected"]),
                        )
                    )
                ]
                active_orders = (
                    (
                        await session.scalars(
                            select(Order)
                            .join(RescueCase)
                            .join(CallAttempt)
                            .where(
                                CallAttempt.generation_id == generation,
                                CallAttempt.status.in_(["requested", "connected"]),
                            )
                        )
                    )
                    .unique()
                    .all()
                )
                for order in active_orders:
                    await self.flow.cancel_work(session, order, now, "reset")
            # Part 2 must implement idempotent cancellation by call ID, including a
            # tombstone if cancellation arrives before provider session creation.
            for call_id, mode in calls:
                adapter = self.scheduler.adapters.get(mode)
                if adapter is None:
                    raise WorkflowError(
                        "part2_unavailable", "Active provider session cannot be cancelled", 503
                    )
                import asyncio

                try:
                    await asyncio.wait_for(
                        adapter.cancel_call(call_id, generation),
                        self.settings.ai_request_timeout_seconds,
                    )
                except Exception:
                    raise WorkflowError(
                        "provider_failure",
                        "Provider cancellation failed; reset was not applied",
                        503,
                    ) from None
            settings = self.settings.model_copy(update={"demo_scenario": scenario})
            pack = load_seed_pack(settings.mock_pack_dir)
            summary = await seed_database(self.database, settings, pack, reset=True)
            return {"status": "reset", "generation_id": summary.generation_id, "scenario": scenario}
