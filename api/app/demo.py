"""Explicit demo controls. Reset shares the scheduler lock and changes generation."""

from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select

from app.contracts import ClockChange
from app.db.models import (
    CallAttempt,
    DemoState,
    Hub,
    Order,
    ProviderRequest,
    RescueCase,
    ShipperEvent,
)
from app.db.seed import load_seed_pack, seed_database
from app.db.snapshot import restore_snapshot, save_snapshot
from app.morning import WorkflowError
from app.schemas import MorningJobRequest


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
            if body.offline is True:
                orders = (
                    (
                        await session.scalars(
                            select(Order)
                            .join(RescueCase)
                            .where(
                                RescueCase.generation_id == body.generation_id,
                                RescueCase.closed_at.is_(None),
                            )
                        )
                    )
                    .unique()
                    .all()
                )
                for order in orders:
                    active = await session.scalar(
                        select(CallAttempt.id)
                        .join(RescueCase)
                        .where(
                            RescueCase.tracking_id == order.tracking_id,
                            CallAttempt.mode == "live",
                            CallAttempt.status.in_(["requested", "connected"]),
                        )
                    )
                    if active:
                        await self.flow.cancel_work(session, order, now, "offline_mode")
                        case = await session.scalar(
                            select(RescueCase)
                            .where(
                                RescueCase.tracking_id == order.tracking_id,
                                RescueCase.closed_at.is_(None),
                            )
                            .order_by(RescueCase.cycle.desc())
                            .limit(1)
                        )
                        case.state, case.reason = "confirm_in_chat", "clarification_sent"
                        log.change(
                            order,
                            self.flow.context(order, "confirm_in_chat"),
                            "confirm_asked",
                            {"case_id": case.id, "reason": "offline_mode"},
                        )
                        self.flow.message(
                            session,
                            order,
                            case,
                            now,
                            "clarification",
                            "Voice is offline. Please confirm delivery details in chat.",
                            f"offline:{active}",
                        )
                for task in await session.scalars(
                    select(ProviderRequest).where(
                        ProviderRequest.generation_id == body.generation_id,
                        ProviderRequest.kind == "extract",
                        ProviderRequest.mode == "live",
                        ProviderRequest.status == "processing",
                    )
                ):
                    task.mode, task.status, task.lease_until = "replay", "requested", None
            log.audit(
                None, "demo_mode", {"auto_buyer": state.auto_buyer, "offline": state.offline_mode}
            )
            await log.flush(session)
            result = self.view(state)
        if body.offline is True:
            await self.scheduler.cancel_generation(body.generation_id, live_only=True)
            await self.scheduler.acknowledge_cancellations(body.generation_id)
        return result

    async def reset(self, generation, scenario, *, prepare=False, progress=None):
        progress = progress or (lambda stage, message: None)
        async with self.scheduler.lock:
            progress("cancelling", "Closing calls and cancelling pending provider and memo jobs.")
            async with self.flow.morning.transaction(generation) as (session, now, log):
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
            # Includes unacknowledged cancellation from a failed earlier reset.
            await self.scheduler.cancel_generation(generation)
            await self.scheduler.acknowledge_cancellations(generation)
            self.scheduler.retire_generation(generation)
            if prepare:
                progress("restoring", "Restoring the prepared demo state.")
                restored = str(uuid4())
                if await restore_snapshot(self.settings, restored):
                    self.scheduler.activate_generation(restored)
                    on_reset = getattr(self, "on_generation_reset", None)
                    if on_reset:
                        await on_reset(restored)
                    return {
                        "status": "reset",
                        "generation_id": restored,
                        "scenario": scenario,
                        "clock": await self.read(),
                    }
            progress("seeding", "Creating a new generation of synthetic demo orders.")
            settings = self.settings.model_copy(update={"demo_scenario": scenario})
            pack = load_seed_pack(settings.mock_pack_dir)
            summary = await seed_database(self.database, settings, pack, reset=True)
            self.scheduler.activate_generation(summary.generation_id)
            on_reset = getattr(self, "on_generation_reset", None)
            if on_reset:
                await on_reset(summary.generation_id)
            result = {
                "status": "reset",
                "generation_id": summary.generation_id,
                "scenario": scenario,
            }
            if prepare:
                day = settings.demo_start.astimezone(settings.timezone).date()
                morning_at = datetime.combine(day, pack.hub.morning_run, settings.timezone)
                await self.change_clock(
                    ClockChange(
                        generation_id=summary.generation_id,
                        speed=1,
                        paused=True,
                        jump=morning_at.isoformat(),
                    )
                )
                request = MorningJobRequest(generation_id=summary.generation_id)
                progress("morning_load", "Preparing the normal morning availability workflow.")
                await self.flow.morning.load(request)
                progress("dispatching", "Dispatching synthetic morning messages.")
                await self.flow.morning.dispatch(summary.generation_id)
                await self.change_clock(
                    ClockChange(
                        generation_id=summary.generation_id,
                        speed=1,
                        paused=True,
                        jump=datetime.combine(
                            day, datetime.min.time().replace(hour=10), settings.timezone
                        ).isoformat(),
                    )
                )
                progress("route_cutoff", "Closing morning replies and preparing the route.")
                await self.flow.morning.cutoff(request)
                await save_snapshot(self.settings)
                result["clock"] = await self.read()
            return result
