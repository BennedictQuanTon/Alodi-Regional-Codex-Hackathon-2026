"""Morning availability workflow. All writes serialize before reading authoritative state."""

import hashlib
import json
from collections import defaultdict
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import date, datetime, timedelta
from uuid import uuid4

from sqlalchemy import insert, select, update

from app.clock import BusinessClock
from app.db.models import (
    AvailabilityReply,
    Courier,
    DemoState,
    Event,
    Hub,
    IngressReceipt,
    Message,
    MorningRun,
    Order,
    OrderContextRevision,
    RescueCase,
    RouteWindow,
    ShipperEvent,
)
from app.db.session import Database
from app.schemas import MorningJobRequest, MorningReplyRequest
from app.settings import Settings
from app.templates import load_window_template


class WorkflowError(RuntimeError):
    def __init__(self, code: str, detail: str, status_code: int = 409):
        super().__init__(detail)
        self.code, self.detail, self.status_code = code, detail, status_code


class SimulatedChatChannel:
    """The committed messages table is the simulated buyer inbox, not a real gateway.

    Acceptance has no external side effects. Inbox visibility and sent audit events
    commit together. A live gateway will need its own idempotent delivery adapter.
    """

    def accept(self, message: Message) -> None:
        if message.channel != "demo_chat" or message.data_source != "synthetic":
            raise WorkflowError("unsupported_channel", "Only simulated chat is implemented", 503)


class MutationLog:
    """Batch revisions/audit while the caller holds SQLite's write reservation."""

    def __init__(self, generation: str, at: datetime):
        self.generation, self.at = generation, at
        self.revisions: list[dict] = []
        self.events: list[dict] = []

    def audit(self, order: Order | None, kind: str, payload: dict, actor: str = "system"):
        self.events.append(
            {
                "tracking_id": order.tracking_id if order else None,
                "at": self.at,
                "actor": actor,
                "type": kind,
                "payload": deepcopy(payload),
                "version": order.context_version if order else 0,
                "generation_id": self.generation,
                "data_source": "synthetic",
            }
        )

    def change(self, order: Order, context: dict, kind: str, payload: dict, actor="system"):
        order.context_version += 1
        snapshot = deepcopy(context)
        snapshot.update(
            tracking_id=order.tracking_id,
            version=order.context_version,
            updated_by=actor.split(":", 1)[0],
        )
        order.context = snapshot
        self.revisions.append(
            {
                "tracking_id": order.tracking_id,
                "version": order.context_version,
                "context": deepcopy(snapshot),
                "actor": actor,
                "at": self.at,
                "generation_id": self.generation,
            }
        )
        self.audit(order, kind, payload, actor)

    async def flush(self, session):
        await session.flush()
        if self.revisions:
            await session.execute(insert(OrderContextRevision), self.revisions)
        if self.events:
            await session.execute(insert(Event), self.events)


def availability_context(order: Order, question: AvailabilityReply, status: str, **fields) -> dict:
    context = deepcopy(order.context)
    previous = context.get("availability", {})
    current = previous if previous.get("question_id") == question.id else {}
    context["availability"] = {
        **current,
        "question_id": question.id,
        "service_date": question.service_date.isoformat(),
        # Keep a fixed morning horizon even if another morning run asks again tomorrow.
        "horizon_anchor": order.original_delivery_date.isoformat()
        if order.original_delivery_date
        else previous.get("horizon_anchor", question.service_date.isoformat()),
        "status": status,
        "answer_type": question.answer_type,
        "windows": list(question.windows),
        "reason": question.reason,
        "available_date": question.available_date.isoformat() if question.available_date else None,
        "note": None,
        **fields,
    }
    context["slots_offered"] = question.slots_offered
    return context


def window_note(order: Order) -> str | None:
    availability = order.context.get("availability", {})
    if availability.get("service_date") == order.delivery_date.isoformat():
        return availability.get("note")
    return None


def enqueue_message(session, order, question, at, kind, text, key, quick_replies=None):
    message = Message(
        id=str(uuid4()),
        generation_id=order.generation_id,
        tracking_id=order.tracking_id,
        question_id=question.id,
        kind=kind,
        template_key=kind,
        text=text,
        quick_replies=deepcopy(quick_replies or []),
        status="queued",
        created_at=at,
        context_version=order.context_version,
        idempotency_key=key,
        data_source="synthetic",
        channel="demo_chat",
    )
    session.add(message)
    return message.id


class MorningService:
    def __init__(self, database: Database, settings: Settings, clock=None, channel=None):
        self.database, self.settings = database, settings
        self.clock = clock or BusinessClock()
        self.channel = channel or SimulatedChatChannel()
        self.window_template = load_window_template(settings.mock_pack_dir)

    @asynccontextmanager
    async def transaction(self, generation: str):
        if self.settings.app_env != "demo":
            raise WorkflowError(
                "demo_only", "The simulated morning channel requires APP_ENV=demo", 503
            )
        rejection = None
        async with self.database.sessions.begin() as session:
            # All mutations (including reset) obtain this reservation before any reads.
            # This works across API requests/processes, unlike a Python-only order lock.
            await session.execute(update(DemoState).where(DemoState.id == 1).values(id=1))
            state = await session.get(DemoState, 1)
            if state is None or state.generation_id != generation:
                raise WorkflowError("rejected_stale", "Demo generation is no longer current")
            now = self.clock.now(state)
            if now.tzinfo is None or now.utcoffset() is None:
                raise ValueError("Business time must be timezone-aware")
            if now < (state.business_time or state.clock_start):
                raise WorkflowError("clock_regression", "Business time cannot move backwards")
            state.business_time = now
            # A rejected late callback must still checkpoint the server's time. Otherwise
            # restarting from the last accepted reply could reopen an expired question.
            # Business changes roll back to this savepoint, independently of the clock.
            try:
                async with session.begin_nested():
                    yield session, now, MutationLog(generation, now)
            except WorkflowError as error:
                rejection = error
                await session.refresh(state)
                state.business_time = max(state.business_time, self.clock.now(state))
        if rejection:
            raise rejection

    async def hub(self, session, hub_id):
        hub = await session.get(Hub, hub_id) if hub_id else await session.scalar(select(Hub))
        if hub is None:
            raise WorkflowError("not_found", "Hub not found", 404)
        return hub

    async def blocked_orders(self, session) -> set[str]:
        pending = await session.scalars(
            select(ShipperEvent.tracking_id).where(ShipperEvent.status == "pending")
        )
        active = await session.scalars(
            select(RescueCase.tracking_id).where(RescueCase.closed_at.is_(None))
        )
        return set(pending) | set(active)

    def blocked_reason(self, order, busy: set[str]) -> str | None:
        if order.opt_out or order.context.get("consent", {}).get("opt_out"):
            return "opt_out"
        if order.status not in {"scheduled", "moved"}:
            return "order_state"
        if order.tracking_id in busy:
            return "active_delivery_or_rescue"
        return None

    async def load(self, request: MorningJobRequest) -> dict:
        async with self.transaction(request.generation_id) as (session, now, log):
            hub = await self.hub(session, request.hub_id)
            day = request.service_date or now.astimezone(self.settings.timezone).date()
            run = await session.scalar(
                select(MorningRun).where(
                    MorningRun.generation_id == request.generation_id,
                    MorningRun.hub_id == hub.hub_id,
                    MorningRun.service_date == day,
                )
            )
            if run:
                return self.run_result(run, False)
            cutoff = datetime.combine(day, self.settings.route_cutoff, self.settings.timezone)
            start = datetime.combine(day, hub.morning_run, self.settings.timezone)
            if start >= cutoff:
                raise WorkflowError(
                    "invalid_schedule", "Morning run must precede route cutoff", 422
                )
            if now < start or now >= cutoff:
                raise WorkflowError(
                    "morning_closed", "Morning load must run between morning start and cutoff"
                )
            orders = (
                await session.scalars(
                    select(Order)
                    .join(Courier, Order.route_id == Courier.route_id)
                    .where(
                        Courier.hub_id == hub.hub_id,
                        Order.delivery_date == day,
                        Order.generation_id == request.generation_id,
                    )
                    .order_by(Order.route_id, Order.stop_index)
                )
            ).all()
            if not orders:
                raise WorkflowError(
                    "no_orders", "No locally loaded orders for this hub and date", 404
                )
            existing_question = await session.scalar(
                select(AvailabilityReply.id)
                .join(Order)
                .join(Courier)
                .where(
                    Courier.hub_id == hub.hub_id,
                    AvailabilityReply.generation_id == request.generation_id,
                    AvailabilityReply.service_date == day,
                )
                .limit(1)
            )
            if existing_question is not None:
                raise WorkflowError(
                    "existing_questions",
                    "Availability records exist without a morning run; review them before retrying",
                )
            route_windows: dict[str, list[dict]] = defaultdict(list)
            for window in await session.scalars(
                select(RouteWindow)
                .join(Courier)
                .where(Courier.hub_id == hub.hub_id)
                .order_by(RouteWindow.starts_at)
            ):
                route_windows[window.route_id].append(
                    {
                        "id": window.window_id,
                        "from": f"{window.starts_at:%H:%M}",
                        "to": f"{window.ends_at:%H:%M}",
                        "label": window.label,
                    }
                )
            busy = await self.blocked_orders(session)
            eligible = []
            for order in orders:
                reason = self.blocked_reason(order, busy)
                if reason:
                    log.audit(order, "policy_block", {"rule": reason, "action": "ask_window"})
                else:
                    if len(route_windows[order.route_id]) != 4:
                        raise WorkflowError(
                            "invalid_windows", "Each route must provide four windows", 422
                        )
                    eligible.append(order)
            run = MorningRun(
                id=str(uuid4()),
                generation_id=request.generation_id,
                hub_id=hub.hub_id,
                service_date=day,
                created_at=now,
                cutoff_at=cutoff,
                orders_loaded=len(orders),
                questions_created=len(eligible),
                policy_blocked=len(orders) - len(eligible),
            )
            session.add(run)
            log.audit(
                None,
                "orders_loaded",
                {
                    "hub_id": hub.hub_id,
                    "orders": len(orders),
                    "service_date": day.isoformat(),
                    "simulated": True,
                },
            )
            if eligible:
                rows = (
                    await session.execute(
                        insert(AvailabilityReply).returning(
                            AvailabilityReply.id, AvailabilityReply.tracking_id
                        ),
                        [
                            {
                                "tracking_id": order.tracking_id,
                                "generation_id": request.generation_id,
                                "service_date": day,
                                "cutoff_at": cutoff,
                                "question_status": "queued",
                                "offered_windows": route_windows[order.route_id],
                                "slots_offered": [
                                    f"{w['from']}/{w['to']}" for w in route_windows[order.route_id]
                                ],
                                "windows": [],
                                "channel": "demo_chat",
                            }
                            for order in eligible
                        ],
                    )
                ).all()
                ids = {tracking_id: identifier for identifier, tracking_id in rows}
                for order in eligible:
                    options = route_windows[order.route_id]
                    question = AvailabilityReply(
                        id=ids[order.tracking_id],
                        tracking_id=order.tracking_id,
                        service_date=day,
                        slots_offered=[f"{w['from']}/{w['to']}" for w in options],
                        windows=[],
                    )
                    # A transient projection avoids loading 4,000 inserted questions again.
                    log.change(
                        order,
                        availability_context(order, question, "question_queued"),
                        "question_queued",
                        {"question_id": question.id},
                    )
                    enqueue_message(
                        session,
                        order,
                        question,
                        now,
                        "window_question",
                        self.window_template.format(
                            first_name=order.buyer_name.split()[0], item=order.item
                        ),
                        f"question:{day}:{order.tracking_id}",
                        options
                        + [
                            {
                                "id": "cannot_today",
                                "label": "Can't receive today",
                                "requires": "reason",
                            }
                        ],
                    )
            await log.flush(session)
            return self.run_result(run, True)

    @staticmethod
    def run_result(run, created):
        return {
            "run_id": run.id,
            "generation_id": run.generation_id,
            "service_date": run.service_date.isoformat(),
            "orders_loaded": run.orders_loaded,
            "questions_created": run.questions_created,
            "policy_blocked": run.policy_blocked,
            "created": created,
        }

    async def dispatch(self, generation: str, *, limit=4000, tracking_id=None) -> dict:
        async with self.transaction(generation) as (session, now, log):
            state = await session.get(DemoState, 1)
            query = select(Message, Order, AvailabilityReply).join(
                Order, Message.tracking_id == Order.tracking_id
            )
            query = query.join(
                AvailabilityReply, Message.question_id == AvailabilityReply.id
            ).where(Message.generation_id == generation, Message.status == "queued")
            if tracking_id:
                query = query.where(Message.tracking_id == tracking_id)
            rows = (
                await session.execute(query.order_by(Message.created_at, Message.id).limit(limit))
            ).all()
            busy = await self.blocked_orders(session)
            sent = cancelled = 0
            for message, order, question in rows:
                # Large batches can cross cutoff at accelerated demo speed. Re-read
                # business time for each acceptance, not only at transaction start.
                now = self.clock.now(state)
                state.business_time, log.at = now, now
                reason = self.blocked_reason(order, busy)
                current = order.context.get("availability", {})
                if order.generation_id != generation or question.generation_id != generation:
                    reason = "rejected_stale"
                elif now >= question.cutoff_at:
                    reason = "cutoff"
                elif (
                    current.get("question_id") != question.id
                    or message.context_version != order.context_version
                ):
                    reason = "stale_context"
                elif question.question_status in {"expired", "cancelled"}:
                    reason = "question_closed"
                elif message.kind == "window_question" and (
                    question.question_status != "queued"
                    or order.delivery_date != question.service_date
                ):
                    reason = "question_superseded"
                if reason:
                    message.status, message.cancelled_at, message.cancellation_reason = (
                        "cancelled",
                        now,
                        reason,
                    )
                    log.audit(
                        order, "message_cancelled", {"message_id": message.id, "reason": reason}
                    )
                    cancelled += 1
                    continue
                self.channel.accept(message)
                message.status, message.sent_at = "sent", now
                if message.kind == "window_question":
                    question.question_status, question.asked_at = "open", now
                    log.change(
                        order,
                        availability_context(order, question, "window_asked"),
                        "slots_sent",
                        {"question_id": question.id, "message_id": message.id},
                    )
                log.audit(
                    order,
                    "chat_message",
                    {
                        "message_id": message.id,
                        "kind": message.kind,
                        "channel": "demo_chat",
                        "simulated": True,
                    },
                )
                sent += 1
            await log.flush(session)
            return {"sent": sent, "cancelled": cancelled, "simulated": True}

    async def reply(self, request: MorningReplyRequest) -> dict:
        async with self.transaction(request.generation_id) as (session, now, log):
            digest = hashlib.sha256(
                json.dumps(request.model_dump(mode="json"), sort_keys=True).encode()
            ).hexdigest()
            receipt = await session.scalar(
                select(IngressReceipt).where(
                    IngressReceipt.generation_id == request.generation_id,
                    IngressReceipt.source == "morning_chat",
                    IngressReceipt.idempotency_key == request.idempotency_key,
                )
            )
            if receipt:
                if not receipt.response or receipt.response["fingerprint"] != digest:
                    raise WorkflowError(
                        "idempotency_conflict",
                        "Idempotency key was already used for another payload",
                    )
                return receipt.response["result"]
            order = await session.get(Order, request.tracking_id)
            question = await session.get(AvailabilityReply, request.question_id)
            if order is None or question is None or question.tracking_id != request.tracking_id:
                raise WorkflowError("not_found", "Order or morning question not found", 404)
            if (
                order.generation_id != request.generation_id
                or question.generation_id != request.generation_id
            ):
                raise WorkflowError(
                    "rejected_stale", "Morning question belongs to another generation"
                )
            if request.answer_type == "opt_out":
                result = await self.opt_out(session, order, now, log)
            else:
                current = order.context.get("availability", {})
                if (
                    order.context_version != request.context_version
                    or current.get("question_id") != question.id
                ):
                    raise WorkflowError(
                        "rejected_stale", "Fetch the current order context before replying"
                    )
                if now >= question.cutoff_at or question.question_status in {
                    "expired",
                    "cancelled",
                }:
                    raise WorkflowError(
                        "availability_closed", "Morning replies close at the route cutoff"
                    )
                if question.asked_at is None or question.question_status == "queued":
                    raise WorkflowError(
                        "question_not_sent", "The morning question has not been sent"
                    )
                if now < question.asked_at:
                    raise WorkflowError("question_not_sent", "Business time precedes the question")
                reason = self.blocked_reason(order, await self.blocked_orders(session))
                if reason:
                    raise WorkflowError(
                        "blocked_by_policy", "Order is no longer eligible for a morning reply"
                    )
                if request.answer_type == "windows":
                    result = self.choose_windows(session, order, question, request, now, log)
                else:
                    result = self.cannot_today(session, order, question, request, now, log)
            session.add(
                IngressReceipt(
                    generation_id=request.generation_id,
                    source="morning_chat",
                    idempotency_key=request.idempotency_key,
                    received_at=now,
                    response={"fingerprint": digest, "result": result},
                )
            )
            await log.flush(session)
            return result

    def choose_windows(self, session, order, question, request, now, log):
        options = {window["id"]: window for window in question.offered_windows}
        if any(window not in options for window in request.windows):
            raise WorkflowError(
                "invalid_windows", "Choose only windows offered in this question", 422
            )
        selected = [window for window in options if window in request.windows]
        if len(selected) < 2:
            existing_note = window_note(order)
            context = availability_context(
                order, question, "needs_more_windows", pending_windows=selected, note=existing_note
            )
            log.change(order, context, "confirm_asked", {"reason": "at_least_two_windows"}, "buyer")
            kind, status = "more_windows", "needs_clarification"
            text = "Please choose at least one more window. Submit at least two choices together."
        else:
            question.answer_type, question.windows, question.reason = "windows", selected, None
            question.answered_at, question.available_date, question.question_status = (
                now,
                None,
                "answered",
            )
            order.delivery_date, order.status = question.service_date, "scheduled"
            note = "Prefers " + " or ".join(options[key]["label"] for key in selected)
            log.change(
                order,
                availability_context(order, question, "noted", note=note, pending_windows=[]),
                "reply",
                {"question_id": question.id, "answer_type": "windows", "windows": selected},
                "buyer",
            )
            log.audit(order, "note_pushed", {"note": note, "question_id": question.id})
            kind, status, text = (
                "window_confirmation",
                "applied",
                f"Got it: {note}. You can change your choices before the morning cutoff.",
            )
        message_id = enqueue_message(
            session,
            order,
            question,
            now,
            kind,
            text,
            "reply:" + request.idempotency_key,
            list(options.values()) if status == "needs_clarification" else [],
        )
        return {
            "status": status,
            "context_version": order.context_version,
            "question_id": question.id,
            "message_id": message_id,
        }

    def cannot_today(self, session, order, question, request, now, log):
        available = request.available_date or question.service_date + timedelta(days=1)
        anchor = date.fromisoformat(order.context["availability"]["horizon_anchor"])
        horizon = anchor + timedelta(days=self.settings.reschedule_horizon_days)
        if not question.service_date < available <= horizon:
            raise WorkflowError(
                "invalid_date",
                "Receive date must be after the service date and within its five-day horizon",
                422,
            )
        question.answer_type, question.reason, question.windows = "cannot_today", request.reason, []
        question.available_date, question.answered_at, question.question_status = (
            available,
            now,
            "answered",
        )
        order.delivery_date, order.status = available, "moved"
        log.change(
            order,
            availability_context(order, question, "moved", pending_windows=[]),
            "reply",
            {
                "question_id": question.id,
                "answer_type": "cannot_today",
                "available_date": available.isoformat(),
                "date_source": "buyer_selected" if request.available_date else "next_day_default",
            },
            "buyer",
        )
        message_id = enqueue_message(
            session,
            order,
            question,
            now,
            "cannot_today_confirmation",
            f"Got it. Delivery moved to {available.isoformat()}. Your reason has been saved.",
            "reply:" + request.idempotency_key,
        )
        return {
            "status": "applied",
            "context_version": order.context_version,
            "question_id": question.id,
            "available_date": available.isoformat(),
            "message_id": message_id,
        }

    async def opt_out(self, session, order, now, log):
        order.opt_out = True
        context = deepcopy(order.context)
        context.setdefault("consent", {})["opt_out"] = True
        if "availability" in context:
            context["availability"].update(status="opted_out", note=None)
        log.change(order, context, "opt_out", {"source": "morning_chat"}, "buyer")
        await session.execute(
            update(AvailabilityReply)
            .where(
                AvailabilityReply.tracking_id == order.tracking_id,
                AvailabilityReply.generation_id == order.generation_id,
            )
            .values(question_status="cancelled")
        )
        await self.cancel_messages(session, order.tracking_id, order.generation_id, now, "opt_out")
        cases = (
            await session.scalars(
                select(RescueCase).where(
                    RescueCase.tracking_id == order.tracking_id, RescueCase.closed_at.is_(None)
                )
            )
        ).all()
        for case in cases:
            if case.next_action_at:
                log.audit(order, "call_cancelled", {"rescue_case_id": case.id, "reason": "opt_out"})
            case.opt_out, case.next_action_at = True, None
        return {"status": "applied", "context_version": order.context_version, "opt_out": True}

    @staticmethod
    async def cancel_messages(session, tracking_id, generation, now, reason, question_id=None):
        filters = [
            Message.tracking_id == tracking_id,
            Message.generation_id == generation,
            Message.status == "queued",
        ]
        if question_id:
            filters.append(Message.question_id == question_id)
        await session.execute(
            update(Message)
            .where(*filters)
            .values(status="cancelled", cancelled_at=now, cancellation_reason=reason)
        )

    async def cutoff(self, request: MorningJobRequest) -> dict:
        async with self.transaction(request.generation_id) as (session, now, log):
            hub = await self.hub(session, request.hub_id)
            day = request.service_date or now.astimezone(self.settings.timezone).date()
            run = await session.scalar(
                select(MorningRun).where(
                    MorningRun.generation_id == request.generation_id,
                    MorningRun.hub_id == hub.hub_id,
                    MorningRun.service_date == day,
                )
            )
            if run is None:
                raise WorkflowError("not_found", "Morning run not found", 404)
            if now < run.cutoff_at:
                raise WorkflowError("cutoff_not_due", "Route cutoff is not due yet")
            if run.cutoff_processed_at:
                return {"processed": False, "planned": 0, "cancelled": 0}
            rows = (
                await session.execute(
                    select(AvailabilityReply, Order)
                    .join(Order)
                    .join(Courier, Order.route_id == Courier.route_id)
                    .where(
                        Courier.hub_id == hub.hub_id,
                        AvailabilityReply.generation_id == request.generation_id,
                        AvailabilityReply.service_date == day,
                        AvailabilityReply.question_status.in_(["open", "queued"]),
                        AvailabilityReply.answer_type.is_(None),
                    )
                )
            ).all()
            busy = await self.blocked_orders(session)
            planned = cancelled = 0
            for question, order in rows:
                await self.cancel_messages(
                    session, order.tracking_id, request.generation_id, now, "cutoff", question.id
                )
                if (
                    self.blocked_reason(order, busy)
                    or order.delivery_date != day
                    or order.context.get("availability", {}).get("question_id") != question.id
                ):
                    question.question_status = "cancelled"
                    log.audit(
                        order,
                        "policy_block",
                        {"action": "route_cutoff", "question_id": question.id},
                    )
                    cancelled += 1
                    continue
                question.answer_type, question.question_status, question.windows = (
                    "no_reply",
                    "expired",
                    [],
                )
                log.change(
                    order,
                    availability_context(order, question, "planned", pending_windows=[]),
                    "availability_defaulted",
                    {"question_id": question.id, "plan": "deliver_as_planned"},
                )
                planned += 1
            # Expire queued confirmations too; sent inbox entries remain visible.
            await session.execute(
                update(Message)
                .where(
                    Message.question_id.in_(
                        select(AvailabilityReply.id)
                        .join(Order)
                        .join(Courier)
                        .where(
                            Courier.hub_id == hub.hub_id,
                            AvailabilityReply.service_date == day,
                            AvailabilityReply.generation_id == request.generation_id,
                        )
                    ),
                    Message.status == "queued",
                )
                .values(status="cancelled", cancelled_at=now, cancellation_reason="cutoff")
            )
            run.cutoff_processed_at = now
            log.audit(
                None,
                "route_cutoff",
                {
                    "hub_id": hub.hub_id,
                    "service_date": day.isoformat(),
                    "planned": planned,
                    "cancelled": cancelled,
                },
            )
            await log.flush(session)
            return {"processed": True, "planned": planned, "cancelled": cancelled}
