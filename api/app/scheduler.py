"""Restart-safe business timers backed by events, cases and provider requests."""

import asyncio
from datetime import timedelta

from sqlalchemy import and_, func, or_, select

from app.contracts import CallReport, RescueReply
from app.db.models import (
    CallAttempt,
    DemoState,
    Hub,
    MorningRun,
    Order,
    ProviderRequest,
    RescueCase,
    RescueMessage,
    RescueResult,
    ShipperEvent,
)
from app.morning import WorkflowError
from app.part2 import FixtureAdapter
from app.policy import deadline
from app.schemas import MorningJobRequest


class Scheduler:
    def __init__(self, workflow, live_adapter=None):
        self.flow = workflow
        self.database, self.clock, self.settings = (
            workflow.database,
            workflow.clock,
            workflow.settings,
        )
        self.adapters = {
            mode: FixtureAdapter(self.settings.mock_pack_dir, mode) for mode in ("stub", "replay")
        }
        if live_adapter:
            self.adapters["live"] = live_adapter
        self.lock = asyncio.Lock()
        self.task = None
        self.last_error = None

    def start(self):
        self.task = asyncio.create_task(self.run())

    async def stop(self):
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None

    async def run(self):
        while True:
            try:
                await self.tick()
                self.last_error = None
            except asyncio.CancelledError:
                raise
            except Exception as error:
                self.last_error = (
                    error.code if isinstance(error, WorkflowError) else type(error).__name__
                )
            await asyncio.sleep(0.1)

    async def tick(self, expected_generation=None):
        async with self.lock:
            async with self.database.sessions() as session:
                state = await session.get(DemoState, 1)
                if state is None:
                    return {"status": "unseeded"}
                generation = state.generation_id
                if expected_generation is not None and expected_generation != generation:
                    raise WorkflowError("rejected_stale", "Demo generation is no longer current")
            await self.flow.commit_due(generation)
            await self.morning(generation)
            await self.dispatch(generation)
            await self.auto_buyer(generation)
            await self.timers(generation)
            await self.real_timeouts(generation)
            for _ in range(20):
                claimed = await self.claim(generation)
                if claimed is None:
                    break
                await self.process(*claimed)
            await self.dispatch(generation)
            return {"status": "ok", "generation_id": generation}

    async def morning(self, generation):
        async with self.database.sessions() as session:
            state = await session.get(DemoState, 1)
            now = self.clock.now(state).astimezone(self.settings.timezone)
            hubs = (await session.scalars(select(Hub))).all()
            runs = {
                (run.hub_id, run.service_date): run
                for run in await session.scalars(select(MorningRun))
            }
        for hub in hubs:
            run = runs.get((hub.hub_id, now.date()))
            body = MorningJobRequest(
                generation_id=generation, hub_id=hub.hub_id, service_date=now.date()
            )
            if (
                run is None
                and hub.morning_run <= now.time().replace(tzinfo=None) < self.settings.route_cutoff
            ):
                try:
                    await self.flow.morning.load(body)
                except WorkflowError as error:
                    if error.code != "no_orders":
                        raise
            elif run and not run.cutoff_processed_at and now >= run.cutoff_at:
                await self.flow.morning.cutoff(body)
        await self.flow.morning.dispatch(generation)

    async def dispatch(self, generation):
        async with self.flow.morning.transaction(generation) as (session, now, log):
            state = await session.get(DemoState, 1)
            rows = (
                await session.execute(
                    select(RescueMessage, RescueCase, Order)
                    .join(RescueCase, RescueMessage.rescue_case_id == RescueCase.id)
                    .join(Order, RescueMessage.tracking_id == Order.tracking_id)
                    .where(
                        RescueMessage.generation_id == generation,
                        RescueMessage.status == "queued",
                    )
                    .order_by(RescueMessage.created_at, RescueMessage.id)
                )
            ).all()
            for message, case, order in rows:
                now = self.clock.now(state)
                state.business_time, log.at = now, now
                if (
                    order.opt_out
                    or case.opt_out
                    or case.trigger == "REFUSED"
                    or case.closed_at
                    or order.status in {"delivered", "labelled", "with_cs"}
                    or case.state == "with_cs"
                    or message.context_version != order.context_version
                    or deadline(order, self.settings) is None
                    or now.astimezone(self.settings.timezone).date()
                    > deadline(order, self.settings)
                    or (
                        message.kind == "confirmation"
                        and order.delivery_date < now.astimezone(self.settings.timezone).date()
                    )
                ):
                    message.status = "cancelled"
                    log.audit(
                        order, "message_cancelled", {"message_id": message.id, "source": "rescue"}
                    )
                    continue
                message.status, message.sent_at = "sent", now
                if message.kind == "rescue_chat":
                    case.state = "call_1_due"
                    case.next_action_at = now + timedelta(minutes=self.settings.call1_after_min)
                elif message.kind == "clarification":
                    case.next_action_at = now + timedelta(minutes=30)
                context = self.flow.context(order, case.state)
                context.setdefault("contact_log", []).append(
                    {
                        "at": now.astimezone(self.settings.timezone).isoformat(),
                        "type": "chat_sent",
                        "message_id": message.id,
                        "simulated": True,
                    }
                )
                log.change(
                    order,
                    context,
                    "chat_sent",
                    {"message_id": message.id, "kind": message.kind, "simulated": True},
                )
            await log.flush(session)

    async def timers(self, generation):
        async with self.flow.morning.transaction(generation) as (session, now, log):
            cases = (
                await session.scalars(
                    select(RescueCase).where(
                        RescueCase.generation_id == generation,
                        RescueCase.closed_at.is_(None),
                        RescueCase.state.in_(
                            ["memo", "call_1_due", "call_2_due", "confirm_in_chat"]
                        ),
                    )
                )
            ).all()
            for case in cases:
                order = await self.flow.order(session, case.tracking_id)
                if (
                    order.opt_out
                    or case.opt_out
                    or order.status in {"delivered", "labelled", "with_cs"}
                    or case.trigger == "REFUSED"
                ):
                    await self.flow.cancel_work(session, order, now, "policy")
                    continue
                if case.state == "memo":
                    event = await session.get(ShipperEvent, case.shipper_event_id)
                    if event.memo_ref:
                        await self.flow.begin_extraction(
                            session, order, case, now, log, "shipper_memo", memo_ref=event.memo_ref
                        )
                elif case.next_action_at and case.next_action_at <= now:
                    if case.state == "confirm_in_chat":
                        self.flow.escalate(order, case, "low_confidence", now, log)
                    else:
                        await self.flow.reserve_call(session, order, case, now, log)
            await log.flush(session)

    async def auto_buyer(self, generation):
        requests = []
        async with self.database.sessions() as session:
            state = await session.get(DemoState, 1)
            if not state.auto_buyer or (self.settings.ai_mode == "live" and not state.offline_mode):
                return
            now = self.clock.now(state)
            cases = (
                await session.scalars(
                    select(RescueCase).where(
                        RescueCase.generation_id == generation,
                        RescueCase.closed_at.is_(None),
                        RescueCase.tracking_id == "SPXVN0123452290",
                        RescueCase.state.in_(["call_1_due", "confirm_in_chat"]),
                    )
                )
            ).all()
            for case in cases:
                if case.state == "call_1_due":
                    sent = await session.scalar(
                        select(RescueMessage.sent_at).where(
                            RescueMessage.rescue_case_id == case.id,
                            RescueMessage.kind == "rescue_chat",
                        )
                    )
                    due, text = sent + timedelta(minutes=40), "after 5 tomorrow"
                else:
                    sent = await session.scalar(
                        select(func.max(RescueResult.created_at)).where(
                            RescueResult.rescue_case_id == case.id
                        )
                    )
                    if sent is None:
                        continue
                    due, text = sent + timedelta(minutes=1), "Hand it to me"
                if now >= due:
                    order = await session.get(Order, case.tracking_id)
                    requests.append(
                        RescueReply(
                            generation_id=generation,
                            context_version=order.context_version,
                            idempotency_key=f"auto:{case.id}:{case.state}",
                            rescue_case_id=case.id,
                            text=text,
                        )
                    )
        for body in requests:
            await self.flow.receive_reply("SPXVN0123452290", body)

    async def real_timeouts(self, generation):
        reports = []
        async with self.database.sessions() as session:
            for call in await session.scalars(
                select(CallAttempt).where(
                    CallAttempt.generation_id == generation,
                    CallAttempt.status.in_(["requested", "connected"]),
                )
            ):
                start = call.connected_real_at or call.requested_real_at
                seconds = self.settings.call_max_duration_seconds if call.connected_real_at else 30
                if self.flow.real_now() >= start + timedelta(seconds=seconds):
                    if not call.dispatched:
                        continue
                    reports.append(
                        CallReport(
                            generation_id=generation,
                            call_id=call.id,
                            context_version=call.context_version,
                            idempotency_key=f"timeout:{call.id}",
                            status="ended" if call.connected_real_at else "missed",
                        )
                    )
        for report in reports:
            await self.flow.call_event(report)

    async def claim(self, generation):
        async with self.flow.morning.transaction(generation) as (session, now, log):
            state = await session.get(DemoState, 1)
            tasks = (
                await session.scalars(
                    select(ProviderRequest)
                    .where(
                        ProviderRequest.generation_id == generation,
                        or_(
                            ProviderRequest.status == "requested",
                            and_(
                                ProviderRequest.status == "processing",
                                ProviderRequest.lease_until <= self.flow.real_now(),
                            ),
                        ),
                    )
                    .order_by(ProviderRequest.created_at, ProviderRequest.id)
                    .limit(100)
                )
            ).all()
            for task in tasks:
                order = await self.flow.order(session, task.tracking_id)
                case = await session.get(RescueCase, task.rescue_case_id)
                if task.kind != "cancel_call" and (
                    order.opt_out
                    or case.opt_out
                    or case.closed_at
                    or order.status in {"delivered", "labelled", "with_cs"}
                    or (
                        task.kind == "extract"
                        and (
                            order.context_version != task.context_version
                            or case.state != "extracting"
                        )
                    )
                ):
                    task.status = "cancelled"
                    continue
                if task.kind == "call":
                    call = await session.get(CallAttempt, task.call_id)
                    if case.next_action_at and case.next_action_at > now:
                        continue
                    if call.status not in {"requested", "connected"}:
                        task.status = "cancelled"
                        continue
                if state.offline_mode and task.mode == "live" and task.kind != "cancel_call":
                    if task.kind == "call":
                        if call.dispatched:
                            task.status = "cancelled"
                            await self.flow.cancel_work(session, order, now, "offline_mode")
                            continue
                        call.mode = "replay"
                    task.mode = "replay"
                task.status, task.lease_until = (
                    "processing",
                    self.flow.real_now()
                    + timedelta(seconds=self.settings.ai_request_timeout_seconds + 5),
                )
                await session.flush()
                return await self.flow.envelope(session, task), task.kind
            return None

    async def process(self, envelope, kind):
        try:
            adapter = self.adapters.get(envelope.mode)
            if adapter is None:
                raise WorkflowError(
                    "part2_unavailable", "Part 2 live adapter is not registered", 503
                )
            if kind == "extract":
                proposal = await asyncio.wait_for(
                    adapter.extract(envelope), self.settings.ai_request_timeout_seconds
                )
                result = await self.flow.apply_proposal(proposal)
                if result["status"] == "rejected_stale":
                    await self.failure(
                        envelope, kind, ValueError("Invalid or superseded provider result")
                    )
                return
            if kind == "cancel_call":
                await asyncio.wait_for(
                    adapter.cancel_call(envelope.call_id, envelope.generation_id),
                    self.settings.ai_request_timeout_seconds,
                )
            else:
                async with self.database.sessions() as session:
                    call = await session.get(CallAttempt, envelope.call_id)
                    report = CallReport(
                        generation_id=envelope.generation_id,
                        call_id=call.id,
                        context_version=call.context_version,
                        idempotency_key=f"requested:{envelope.request_id}",
                        status="requested",
                    )
                result = await self.flow.call_event(report)
                if result["status"] in {"deferred", "blocked_by_policy", "ignored_terminal"}:
                    async with self.flow.morning.transaction(envelope.generation_id) as (
                        session,
                        now,
                        log,
                    ):
                        task = await session.get(ProviderRequest, envelope.request_id)
                        if task and task.status == "processing":
                            task.status = (
                                "requested" if result["status"] == "deferred" else "cancelled"
                            )
                            task.lease_until = None
                    return
                updates = await asyncio.wait_for(
                    adapter.request_call(envelope), self.settings.ai_request_timeout_seconds
                )
                for index, update in enumerate(updates or []):
                    await self.flow.call_event(
                        CallReport(
                            generation_id=envelope.generation_id,
                            call_id=envelope.call_id,
                            context_version=envelope.context_version,
                            idempotency_key=f"provider:{envelope.request_id}:{index}",
                            **update,
                        )
                    )
            async with self.flow.morning.transaction(envelope.generation_id) as (session, now, log):
                task = await session.get(ProviderRequest, envelope.request_id)
                if task and task.status == "processing":
                    task.status, task.result = (
                        "completed",
                        {"status": "accepted", "mode": envelope.mode},
                    )
        except asyncio.CancelledError:
            raise
        except Exception as error:
            await self.failure(envelope, kind, error)

    async def failure(self, envelope, kind, error):
        try:
            async with self.flow.morning.transaction(envelope.generation_id) as (session, now, log):
                task = await session.get(ProviderRequest, envelope.request_id)
                if not task or task.status != "processing":
                    return
                task.status = "failed"
                task.result = {
                    "status": "provider_failed",
                    "mode": envelope.mode,
                    "error_type": type(error).__name__,
                }
                order = await self.flow.order(session, task.tracking_id)
                case = await session.get(RescueCase, task.rescue_case_id)
                log.audit(
                    order,
                    "provider_failure",
                    {"request_id": task.id, "mode": task.mode, "error_type": type(error).__name__},
                )
                if kind != "cancel_call":
                    if task.call_id:
                        call = await session.get(CallAttempt, task.call_id)
                        if call.status in {"requested", "connected"}:
                            if not call.dispatched:
                                case.calls_reserved -= 1
                            call.status, call.ended_real_at = "failed", self.flow.real_now()
                    await self.flow.cancel_work(session, order, now, "provider_failure")
                    self.flow.escalate(order, case, "provider_failure", now, log)
                await log.flush(session)
        except WorkflowError as rejected:
            if rejected.code != "rejected_stale":
                raise
