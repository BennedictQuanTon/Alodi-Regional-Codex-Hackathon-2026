"""Authoritative courier and CS state changes. No provider writes order tables."""

import hashlib
import json
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select, update

from app.contracts import CourierAction, CSDecision, UndoAction
from app.db.models import (
    AvailabilityReply,
    CallAttempt,
    Courier,
    Event,
    Hub,
    IngressReceipt,
    Message,
    Order,
    ProviderRequest,
    RescueCase,
    RescueMessage,
    RescueResult,
    RouteWindow,
    ShipperEvent,
)
from app.morning import MorningService, WorkflowError
from app.policy import appointment_policy, deadline
from app.rescue import ACTIVE_CALLS, RescueBoundary


class WorkflowService(RescueBoundary):
    def __init__(self, morning: MorningService):
        self.morning = morning
        self.database, self.settings, self.clock = morning.database, morning.settings, morning.clock
        self.real_now = lambda: datetime.now(UTC)
        morning.cancel_hook = self.cancel_work

    @staticmethod
    async def replay(session, source, target, request):
        fingerprint = hashlib.sha256(
            json.dumps(
                {"target": target, "body": request.model_dump(mode="json")},
                sort_keys=True,
            ).encode()
        ).hexdigest()
        receipt = await session.scalar(
            select(IngressReceipt).where(
                IngressReceipt.generation_id == request.generation_id,
                IngressReceipt.source == source,
                IngressReceipt.idempotency_key == request.idempotency_key,
            )
        )
        if receipt:
            if receipt.response["fingerprint"] != fingerprint:
                raise WorkflowError(
                    "idempotency_conflict", "Key was already used for another payload"
                )
            return fingerprint, receipt.response["result"]
        return fingerprint, None

    @staticmethod
    def receipt(session, source, request, fingerprint, result, now):
        session.add(
            IngressReceipt(
                generation_id=request.generation_id,
                source=source,
                idempotency_key=request.idempotency_key,
                received_at=now,
                response={"fingerprint": fingerprint, "result": deepcopy(result)},
            )
        )

    @staticmethod
    async def order(session, tracking_id, request=None):
        order = await session.get(Order, tracking_id)
        if order is None:
            raise WorkflowError("not_found", "Order not found", 404)
        if request and (
            order.generation_id != request.generation_id
            or order.context_version != request.context_version
        ):
            raise WorkflowError("rejected_stale", "Fetch the current order context before acting")
        return order

    @staticmethod
    async def active_cases(session, tracking_id):
        return (
            await session.scalars(
                select(RescueCase)
                .where(
                    RescueCase.tracking_id == tracking_id,
                    RescueCase.closed_at.is_(None),
                )
                .order_by(RescueCase.cycle)
            )
        ).all()

    async def cancel_work(self, session, order, now, reason):
        scheduled = (
            await session.scalars(
                select(RescueCase).where(
                    RescueCase.tracking_id == order.tracking_id,
                    RescueCase.next_action_at.is_not(None),
                )
            )
        ).all()
        for case in scheduled:
            session.add(
                Event(
                    tracking_id=order.tracking_id,
                    at=now,
                    actor="system",
                    type="call_cancelled"
                    if case.state in {"call_1_due", "call_2_due"}
                    else "timer_cancelled",
                    payload={"rescue_case_id": case.id, "reason": reason},
                    version=order.context_version,
                    generation_id=order.generation_id,
                    data_source="synthetic",
                )
            )
        calls = (
            await session.scalars(
                select(CallAttempt)
                .join(RescueCase)
                .where(
                    RescueCase.tracking_id == order.tracking_id,
                    CallAttempt.status.in_(ACTIVE_CALLS),
                )
            )
        ).all()
        for call in calls:
            case = await session.get(RescueCase, call.rescue_case_id)
            if not call.dispatched:
                case.calls_reserved -= 1
            call.status, call.ended_real_at = "cancelled", self.real_now()
            session.add(
                Event(
                    tracking_id=order.tracking_id,
                    at=now,
                    actor="system",
                    type="call_cancelled",
                    payload={"call_id": call.id, "reason": reason},
                    version=order.context_version,
                    generation_id=order.generation_id,
                    data_source="synthetic",
                )
            )
            session.add(
                ProviderRequest(
                    id=str(uuid4()),
                    generation_id=order.generation_id,
                    tracking_id=order.tracking_id,
                    rescue_case_id=case.id,
                    context_version=order.context_version,
                    kind="cancel_call",
                    source="ai_call",
                    mode=call.mode,
                    status="requested",
                    created_at=now,
                    correlation_key=f"cancel:{call.id}",
                    input={},
                    call_id=call.id,
                )
            )
        await session.execute(
            update(ProviderRequest)
            .where(
                ProviderRequest.tracking_id == order.tracking_id,
                ProviderRequest.kind != "cancel_call",
                ProviderRequest.status.in_(["requested", "processing"]),
            )
            .values(status="cancelled")
        )
        await session.execute(
            update(Message)
            .where(
                Message.tracking_id == order.tracking_id,
                Message.status == "queued",
            )
            .values(status="cancelled", cancelled_at=now, cancellation_reason=reason)
        )
        await session.execute(
            update(RescueMessage)
            .where(
                RescueMessage.tracking_id == order.tracking_id,
                RescueMessage.status == "queued",
            )
            .values(status="cancelled")
        )
        await session.execute(
            update(RescueCase)
            .where(
                RescueCase.tracking_id == order.tracking_id,
            )
            .values(next_action_at=None)
        )

    @staticmethod
    def context(order, state, **fields):
        context = deepcopy(order.context)
        context.update(workflow_state=state, **fields)
        context["delivery_attempt"] = order.attempt_count
        return context

    async def tap(self, tracking_id: str, request: CourierAction):
        async with self.morning.transaction(request.generation_id) as (session, now, log):
            fingerprint, cached = await self.replay(session, "courier_tap", tracking_id, request)
            if cached:
                return cached
            order = await self.order(session, tracking_id, request)
            local = now.astimezone(self.settings.timezone)
            if order.status in {"delivered", "labelled", "with_cs"}:
                raise WorkflowError("invalid_state", "Order cannot accept another delivery outcome")
            if (
                order.delivery_date != local.date()
                or local.time().replace(tzinfo=None) < self.settings.route_cutoff
            ):
                raise WorkflowError("not_on_route", "Order is not on today's active route")
            pending = await session.scalar(
                select(ShipperEvent).where(
                    ShipperEvent.tracking_id == tracking_id, ShipperEvent.status == "pending"
                )
            )
            cases = await self.active_cases(session, tracking_id)
            if request.button != "DELIVERED" and (
                pending
                or any(case.state not in {"rescheduled", "out_for_delivery"} for case in cases)
            ):
                raise WorkflowError("invalid_state", "An outcome or rescue is already in progress")
            if order.attempt_count >= 1 + self.settings.max_redeliveries:
                raise WorkflowError("redelivery_limit", "No delivery attempts remain")
            await self.cancel_work(session, order, now, "courier_outcome")
            await session.execute(
                update(AvailabilityReply)
                .where(
                    AvailabilityReply.tracking_id == tracking_id,
                )
                .values(question_status="cancelled")
            )
            if pending:
                pending.status = "undone"
                log.audit(
                    order,
                    "event_undone",
                    {"event_id": pending.id, "reason": "superseded_by_delivery"},
                    request.by,
                )
            event = ShipperEvent(
                tracking_id=tracking_id,
                button=request.button,
                created_at=now,
                commit_at=now
                if request.button == "DELIVERED"
                else now + timedelta(minutes=self.settings.undo_window_min),
                status="committed" if request.button == "DELIVERED" else "pending",
                idempotency_key=request.idempotency_key,
                generation_id=request.generation_id,
            )
            session.add(event)
            await session.flush()
            if request.button == "DELIVERED":
                order.attempt_count += 1
                order.status = "delivered"
                for case in cases:
                    case.state, case.closed_at = "delivered", now
                context = self.context(order, "delivered", pending_event=None)
                log.change(order, context, "delivered", {"event_id": event.id}, request.by)
            else:
                order.status = "out_for_delivery"
                for case in cases:
                    case.state = "out_for_delivery"
                context = self.context(
                    order,
                    "pending_event",
                    pending_event={
                        "id": event.id,
                        "button": event.button,
                        "commit_at": event.commit_at.astimezone(self.settings.timezone).isoformat(),
                    },
                )
                log.change(
                    order,
                    context,
                    "event_pending",
                    {"event_id": event.id, "button": event.button},
                    request.by,
                )
            result = {
                "event_id": event.id,
                "status": event.status,
                "commit_at": event.commit_at.astimezone(self.settings.timezone).isoformat(),
                "context_version": order.context_version,
            }
            self.receipt(session, "courier_tap", request, fingerprint, result, now)
            await log.flush(session)
            return result

    async def undo(self, event_id: int, request: UndoAction):
        async with self.morning.transaction(request.generation_id) as (session, now, log):
            fingerprint, cached = await self.replay(session, "courier_undo", event_id, request)
            if cached:
                return cached
            event = await session.get(ShipperEvent, event_id)
            if event is None:
                raise WorkflowError("not_found", "Courier event not found", 404)
            order = await self.order(session, event.tracking_id, request)
            if (
                event.generation_id != request.generation_id
                or event.status != "pending"
                or now >= event.commit_at
            ):
                raise WorkflowError(
                    "undo_closed", "Undo is available only before the pending event deadline"
                )
            event.status = "undone"
            order.status = "out_for_delivery"
            log.change(
                order,
                self.context(order, "out_for_delivery", pending_event=None),
                "event_undone",
                {"event_id": event.id},
                request.by,
            )
            result = {
                "event_id": event.id,
                "status": "undone",
                "context_version": order.context_version,
            }
            self.receipt(session, "courier_undo", request, fingerprint, result, now)
            await log.flush(session)
            return result

    async def commit_due(self, generation: str):
        async with self.morning.transaction(generation) as (session, now, log):
            events = (
                await session.scalars(
                    select(ShipperEvent)
                    .where(
                        ShipperEvent.generation_id == generation,
                        ShipperEvent.status == "pending",
                        ShipperEvent.commit_at <= now,
                    )
                    .order_by(ShipperEvent.id)
                )
            ).all()
            committed = 0
            for event in events:
                order = await self.order(session, event.tracking_id)
                if (
                    order.status != "out_for_delivery"
                    or (order.context.get("pending_event") or {}).get("id") != event.id
                ):
                    event.status = "undone"
                    log.audit(order, "event_undone", {"event_id": event.id, "reason": "superseded"})
                    continue
                event.status = "committed"
                order.attempt_count += 1
                cases = await self.active_cases(session, order.tracking_id)
                limit = deadline(order, self.settings)
                reason = None
                if order.attempt_count >= 1 + self.settings.max_redeliveries:
                    reason = "redelivery_limit"
                elif limit is None or now.astimezone(self.settings.timezone).date() > limit:
                    reason = "horizon_expired"
                elif event.button == "C":
                    reason = "refused"
                elif order.opt_out:
                    reason = "opt_out"
                for old in cases:
                    old.next_action_at = None
                if reason == "redelivery_limit":
                    case = cases[-1] if cases else None
                else:
                    for old in cases:
                        old.state, old.closed_at = "closed", now
                    cycle = (
                        await session.scalars(
                            select(RescueCase.cycle).where(
                                RescueCase.tracking_id == order.tracking_id
                            )
                        )
                    ).all()
                    number = max(cycle, default=0) + 1
                    case = None
                    if number <= self.settings.max_redeliveries:
                        case = RescueCase(
                            tracking_id=order.tracking_id,
                            shipper_event_id=event.id,
                            trigger={"A": "NO_ANSWER", "B": "RESCHEDULE", "C": "REFUSED"}[
                                event.button
                            ],
                            cycle=number,
                            state="with_cs"
                            if reason
                            else "chat_pending"
                            if event.button == "A"
                            else "memo",
                            created_at=now,
                            generation_id=generation,
                            calls_made=0,
                            calls_reserved=0,
                            opt_out=order.opt_out,
                            reason=reason,
                        )
                        session.add(case)
                        await session.flush()
                    else:
                        reason = "redelivery_limit"
                context = self.context(
                    order,
                    "with_cs" if reason else case.state,
                    pending_event=None,
                    card=None,
                    trigger={"A": "NO_ANSWER", "B": "RESCHEDULE", "C": "REFUSED"}[event.button],
                )
                if case:
                    context["rescue_cycle"] = case.cycle
                    context["rescue_case_id"] = case.id
                log.change(
                    order,
                    context,
                    "event_committed",
                    {"event_id": event.id, "button": event.button},
                )
                if reason:
                    self.escalate(order, case, reason, now, log)
                elif event.button == "A":
                    self.message(
                        session,
                        order,
                        case,
                        now,
                        "rescue_chat",
                        "We just missed you. When and where should we come back?",
                        f"rescue:{case.id}",
                    )
                committed += 1
            await log.flush(session)
            return {"committed": committed}

    @staticmethod
    def message(session, order, case, now, kind, text, key):
        message = RescueMessage(
            id=str(uuid4()),
            tracking_id=order.tracking_id,
            rescue_case_id=case.id,
            generation_id=order.generation_id,
            kind=kind,
            text=text,
            status="queued",
            created_at=now,
            context_version=order.context_version,
            idempotency_key=key,
            data_source="synthetic",
        )
        session.add(message)
        return message

    def escalate(self, order, case, reason, now, log):
        order.status = "with_cs"
        if case:
            case.state, case.reason, case.next_action_at = "with_cs", reason, None
        context = self.context(order, "with_cs", escalation_reason=reason)
        if reason == "refused":
            context["suggested_label"] = "suspected bomb"
        if reason == "two_calls_unanswered":
            context["hotline_routing"] = True
        log.change(
            order, context, "escalated", {"reason": reason, "case_id": case.id if case else None}
        )

    async def apply_appointment(
        self,
        session,
        order,
        case,
        fields,
        now,
        log,
        *,
        human=False,
        conflicts=(),
        source="chat",
        actor="agent",
    ):
        windows = (
            await session.scalars(select(RouteWindow).where(RouteWindow.route_id == order.route_id))
        ).all()
        hub = await session.scalar(
            select(Hub).join(Courier).where(Courier.route_id == order.route_id)
        )
        status, reason = appointment_policy(
            order,
            fields,
            windows,
            hub.service_area_wards,
            now,
            self.settings,
            human=human,
            conflicts=conflicts,
        )
        if status != "applied":
            return status, reason
        await self.cancel_work(session, order, now, "appointment_applied")
        order.delivery_date, order.status = fields.time_window.date, "moved"
        context = self.context(order, "rescheduled", pending_event=None)
        extracted = fields.model_dump(mode="json", by_alias=True)
        confidence = {
            key: value["confidence"]
            for key, value in extracted.items()
            if isinstance(value, dict) and "confidence" in value
        }
        context.update(
            extracted=extracted,
            confidence=confidence,
            decision="cs_applied" if human else "auto_applied",
            channel=source,
        )
        window = fields.time_window
        card = {
            "tracking_id": order.tracking_id,
            "window": f"{window.date.isoformat()}, {window.starts_at:%H:%M}–{window.ends_at:%H:%M}",
            "drop": fields.drop_location.note,
            "notes": fields.delivery_notes,
            "alt": f"{fields.alt_receiver.relation} · {fields.alt_receiver.phone_masked}"
            if fields.alt_receiver
            else None,
            "source": source,
            "by": "cs" if human else "agent",
        }
        context["card"] = card
        if fields.address_correction:
            order.address, order.district = (
                fields.address_correction.text,
                fields.address_correction.ward,
            )
        if case:
            case.state, case.reason, case.next_action_at = "rescheduled", None, None
        log.change(
            order,
            context,
            "card_pushed",
            {"case_id": case.id if case else None, "card": card},
            actor,
        )
        if case:
            session.add(
                RescueResult(
                    rescue_case_id=case.id,
                    source=source,
                    extracted=extracted,
                    confidence=confidence,
                    decision=context["decision"],
                    card=card,
                    context_version=order.context_version,
                    created_at=now,
                )
            )
            if case.trigger != "REFUSED":
                self.message(
                    session,
                    order,
                    case,
                    now,
                    "confirmation",
                    f"Got it: {card['window']}, {card['drop']}.",
                    f"card:{case.id}:{order.context_version}",
                )
        return status, reason

    async def cs_decision(self, tracking_id: str, request: CSDecision):
        async with self.morning.transaction(request.generation_id) as (session, now, log):
            fingerprint, cached = await self.replay(session, "cs_decision", tracking_id, request)
            if cached:
                return cached
            order = await self.order(session, tracking_id, request)
            if order.status != "with_cs" and not (
                request.action == "return"
                and order.status == "labelled"
                and not order.context.get("return")
            ):
                raise WorkflowError("invalid_state", "CS decisions require an escalated order")
            cases = await self.active_cases(session, tracking_id)
            case = cases[-1] if cases else None
            if request.action == "apply":
                status, reason = await self.apply_appointment(
                    session,
                    order,
                    case,
                    request.appointment,
                    now,
                    log,
                    human=True,
                    source="cs",
                    actor=request.by,
                )
                if status != "applied":
                    raise WorkflowError("blocked_by_policy", reason, 422)
            else:
                context = deepcopy(order.context)
                context.setdefault("cs", {})["last_action"] = request.action
                if request.action == "claim":
                    context["cs"]["assigned_to"] = request.by
                    if case:
                        case.assigned_to = request.by
                elif request.action == "approve_label":
                    context["labels"] = list(
                        dict.fromkeys(context.get("labels", []) + [request.label])
                    )
                    context.pop("suggested_label", None)
                    order.status = "labelled"
                elif request.action == "reject_label":
                    context.pop("suggested_label", None)
                elif request.action == "return":
                    context["return"] = {"approved_by": request.by, "at": now.isoformat()}
                    order.status = "labelled"
                context["workflow_state"] = order.status
                if request.action in {"approve_label", "return"}:
                    await self.cancel_work(session, order, now, request.action)
                    for active in cases:
                        active.state, active.closed_at = request.action, now
                log.change(
                    order,
                    context,
                    "cs_decision",
                    {"action": request.action, "label": request.label},
                    request.by,
                )
            if request.action == "apply":
                log.audit(order, "cs_decision", {"action": request.action}, request.by)
            result = {
                "status": "applied",
                "context_version": order.context_version,
                "action": request.action,
            }
            self.receipt(session, "cs_decision", request, fingerprint, result, now)
            await log.flush(session)
            return result
