"""Rescue ingress and provider-result application, mixed into the authoritative service."""

import hashlib
import json
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import select

from app.contracts import CallReport, Part2Input, Proposal
from app.db.models import (
    CallAttempt,
    DemoState,
    Order,
    ProviderRequest,
    Recording,
    RescueCase,
    RescueResult,
    RouteWindow,
    ShipperEvent,
)
from app.morning import WorkflowError
from app.policy import call_time

ACTIVE_CALLS = {"requested", "connected"}


class RescueBoundary:
    async def provider_request(
        self,
        session,
        order,
        case,
        now,
        *,
        source,
        text=None,
        memo_ref=None,
        kind="extract",
        call=None,
    ):
        state = await session.get(DemoState, 1)
        mode = "replay" if state.offline_mode else self.settings.ai_mode
        request = ProviderRequest(
            id=str(uuid4()),
            generation_id=order.generation_id,
            tracking_id=order.tracking_id,
            rescue_case_id=case.id,
            context_version=order.context_version,
            kind=kind,
            source=source,
            mode=mode,
            status="requested",
            created_at=now,
            correlation_key=f"{kind}:{case.id}:{order.context_version}",
            input={"text": text, "memo_ref": memo_ref},
            call_id=call.id if call else None,
        )
        session.add(request)
        return request

    async def envelope(self, session, request):
        case = await session.get(RescueCase, request.rescue_case_id)
        order = await session.get(Order, request.tracking_id)
        state = await session.get(DemoState, 1)
        windows = (
            await session.scalars(
                select(RouteWindow)
                .where(RouteWindow.route_id == order.route_id)
                .order_by(RouteWindow.starts_at)
            )
        ).all()
        return Part2Input(
            request_id=request.id,
            correlation_id=request.id,
            generation_id=request.generation_id,
            tracking_id=order.tracking_id,
            rescue_case_id=case.id,
            context_version=request.context_version,
            source=request.source,
            mode=request.mode,
            trigger=case.trigger,
            business_time=self.clock.now(state),
            call_id=request.call_id,
            masked_order_context={
                "delivery_date": order.delivery_date.isoformat(),
                "original_delivery_date": order.original_delivery_date.isoformat()
                if order.original_delivery_date
                else None,
                "attempt_count": order.attempt_count,
                "ward": order.district,
                "opt_out": order.opt_out,
            },
            offered_windows=[
                {"id": w.window_id, "from": f"{w.starts_at:%H:%M}", "to": f"{w.ends_at:%H:%M}"}
                for w in windows
            ],
            text=request.input.get("text"),
            memo_ref=request.input.get("memo_ref"),
            auto_buyer=bool(state.auto_buyer) if request.mode != "live" else False,
        )

    async def receive_reply(self, tracking_id, request, *, source="chat"):
        async with self.morning.transaction(request.generation_id) as (session, now, log):
            fingerprint, cached = await self.replay(session, "rescue_reply", tracking_id, request)
            if cached:
                return cached
            order = await self.order(session, tracking_id)
            case = await session.get(RescueCase, request.rescue_case_id)
            if (
                case is None
                or case.tracking_id != tracking_id
                or case.generation_id != request.generation_id
            ):
                raise WorkflowError("rejected_stale", "Rescue case is no longer current")
            if request.opt_out or request.text.casefold() == "stop":
                result = await self.morning.opt_out(session, order, now, log, source="rescue_chat")
            else:
                if (
                    order.context_version != request.context_version
                    or case.state
                    not in {
                        "chat_pending",
                        "call_1_due",
                        "call_2_due",
                        "calling",
                        "confirm_in_chat",
                        "extracting",
                    }
                    or order.status in {"delivered", "labelled", "with_cs"}
                    or case.closed_at
                ):
                    raise WorkflowError(
                        "rejected_stale", "Fetch current rescue context before replying"
                    )
                if not request.text:
                    raise WorkflowError("invalid_reply", "A reply is required", 422)
                job = await self.begin_extraction(
                    session, order, case, now, log, source, text=request.text
                )
                result = {
                    "status": "accepted",
                    "request_id": job.id,
                    "context_version": order.context_version,
                }
            self.receipt(session, "rescue_reply", request, fingerprint, result, now)
            await log.flush(session)
            return result

    async def begin_extraction(
        self, session, order, case, now, log, source, *, text=None, memo_ref=None
    ):
        await self.cancel_work(
            session, order, now, "buyer_reply" if source != "shipper_memo" else "memo_processing"
        )
        if order.opt_out or case.trigger == "REFUSED":
            raise WorkflowError("blocked_by_policy", "Contact is stopped for this order")
        case.state, case.next_action_at = "extracting", None
        log.change(
            order,
            self.context(order, "extracting"),
            "reply" if source != "shipper_memo" else "memo_processing",
            {"case_id": case.id, "source": source},
            "buyer" if source != "shipper_memo" else "system",
        )
        return await self.provider_request(
            session, order, case, now, source=source, text=text, memo_ref=memo_ref
        )

    async def apply_proposal(self, proposal: Proposal):
        try:
            async with self.morning.transaction(proposal.generation_id) as (session, now, log):
                task = await session.get(ProviderRequest, proposal.request_id)
                case = await session.get(RescueCase, proposal.rescue_case_id)
                order = await session.get(Order, proposal.tracking_id)
                digest = hashlib.sha256(
                    json.dumps(proposal.model_dump(mode="json"), sort_keys=True).encode()
                ).hexdigest()
                if task and task.status == "completed" and task.result:
                    if task.result.get("fingerprint") != digest:
                        raise WorkflowError(
                            "idempotency_conflict", "Request already has another result"
                        )
                    return task.result["result"]
                if (
                    not task
                    or not case
                    or not order
                    or task.kind != "extract"
                    or task.status not in {"requested", "processing"}
                    or task.tracking_id != order.tracking_id
                    or task.rescue_case_id != case.id
                    or task.generation_id != proposal.generation_id
                    or case.generation_id != proposal.generation_id
                    or task.context_version != proposal.context_version
                    or order.context_version != proposal.context_version
                    or task.source != proposal.source
                    or task.mode != proposal.mode
                    or case.state != "extracting"
                    or case.closed_at
                    or order.status in {"delivered", "labelled", "with_cs"}
                ):
                    return {"status": "rejected_stale"}
                log.data_source = (
                    "live"
                    if proposal.mode == "live"
                    else "replay"
                    if proposal.mode == "replay"
                    else "synthetic"
                )
                if proposal.fields.opt_out:
                    await self.morning.opt_out(session, order, now, log, source="part2")
                    status, reason = "applied", "opt_out"
                else:
                    status, reason = await self.apply_appointment(
                        session,
                        order,
                        case,
                        proposal.fields,
                        now,
                        log,
                        conflicts=proposal.conflicts,
                        source=proposal.source,
                    )
                    if status != "applied":
                        data = proposal.fields.model_dump(mode="json", by_alias=True)
                        confidence = {
                            key: value["confidence"]
                            for key, value in data.items()
                            if isinstance(value, dict) and "confidence" in value
                        }
                        session.add(
                            RescueResult(
                                rescue_case_id=case.id,
                                source=proposal.source,
                                extracted=data,
                                confidence=confidence,
                                decision="needs_review",
                                card=None,
                                context_version=order.context_version,
                                created_at=now,
                            )
                        )
                        if status == "blocked_by_policy":
                            self.escalate(order, case, reason, now, log)
                        elif case.reason == "clarification_sent":
                            self.escalate(order, case, "low_confidence", now, log)
                        else:
                            case.state, case.reason = "confirm_in_chat", "clarification_sent"
                            case.next_action_at = (
                                None  # starts only when clarification reaches the inbox
                            )
                            context = self.context(order, "confirm_in_chat", proposed=data)
                            log.change(
                                order,
                                context,
                                "confirm_asked",
                                {"reason": reason, "case_id": case.id},
                            )
                            self.message(
                                session,
                                order,
                                case,
                                now,
                                "clarification",
                                "Please confirm a delivery date/window "
                                "and where we should hand over the parcel.",
                                f"clarify:{task.id}",
                            )
                result = {
                    "status": status,
                    "reason": reason,
                    "context_version": order.context_version,
                    "simulated": proposal.mode != "live",
                    "mode": proposal.mode,
                }
                task.status, task.result = "completed", {"fingerprint": digest, "result": result}
                await log.flush(session)
                return result
        except WorkflowError as error:
            if error.code == "rejected_stale":
                return {"status": "rejected_stale"}
            raise

    async def attach_fixture_memo(self, tracking_id, request):
        async with self.morning.transaction(request.generation_id) as (session, now, log):
            fingerprint, cached = await self.replay(session, "fixture_memo", tracking_id, request)
            if cached:
                return cached
            state = await session.get(DemoState, 1)
            if self.settings.ai_mode == "live" and not state.offline_mode:
                raise WorkflowError(
                    "part2_unavailable", "Register Part 2's multipart memo router", 503
                )
            order = await self.order(session, tracking_id, request)
            event = await session.get(ShipperEvent, request.shipper_event_id)
            if (
                not event
                or event.tracking_id != tracking_id
                or event.button != "B"
                or event.status == "undone"
            ):
                raise WorkflowError("invalid_memo", "Memo requires an active B outcome")
            if event.memo_ref:
                raise WorkflowError("invalid_memo", "This outcome already has a memo")
            key = f"fixture:{request.generation_id}:{event.id}"
            real = self.real_now()
            session.add(
                Recording(
                    key=key,
                    shipper_event_id=event.id,
                    kind="memo",
                    duration_s=9,
                    created_at=real,
                    expires_at=real + timedelta(days=self.settings.recording_ttl_days),
                )
            )
            event.memo_ref = key
            log.change(
                order,
                self.context(order, order.context.get("workflow_state")),
                "memo_attached",
                {"event_id": event.id, "simulated": True},
                "courier",
            )
            result = {
                "status": "accepted",
                "memo_ref": key,
                "simulated": True,
                "context_version": order.context_version,
            }
            self.receipt(session, "fixture_memo", request, fingerprint, result, now)
            await log.flush(session)
            return result

    async def reserve_call(self, session, order, case, now, log):
        active = await session.scalar(
            select(CallAttempt.id).where(
                CallAttempt.rescue_case_id == case.id, CallAttempt.status.in_(ACTIVE_CALLS)
            )
        )
        if active:
            return
        if case.calls_made + case.calls_reserved >= self.settings.max_calls_per_cycle:
            self.escalate(order, case, "two_calls_unanswered", now, log)
            return
        due = call_time(now, order, self.settings)
        if due is None:
            self.escalate(order, case, "horizon_expired", now, log)
            return
        if due > now:
            case.next_action_at = due
            log.audit(order, "policy_block", {"rule": "call_hours", "due": due.isoformat()})
            return
        state = await session.get(DemoState, 1)
        mode = "replay" if state.offline_mode else self.settings.ai_mode
        number = case.calls_made + case.calls_reserved + 1
        case.calls_reserved += 1
        case.state, case.next_action_at = "calling", None
        log.change(
            order,
            self.context(order, "calling"),
            "call_reserved",
            {"case_id": case.id, "number": number},
        )
        call = CallAttempt(
            id=str(uuid4()),
            generation_id=order.generation_id,
            rescue_case_id=case.id,
            number=number,
            status="requested",
            dispatched=False,
            context_version=order.context_version,
            active_version=order.context_version,
            requested_at=now,
            requested_real_at=self.real_now(),
            mode=mode,
        )
        session.add(call)
        await session.flush()
        await self.provider_request(
            session, order, case, now, source="ai_call", kind="call", call=call
        )

    async def call_event(self, report: CallReport):
        async with self.morning.transaction(report.generation_id) as (session, now, log):
            fingerprint, cached = await self.replay(session, "call_event", report.call_id, report)
            if cached:
                return cached
            call = await session.get(CallAttempt, report.call_id)
            if (
                not call
                or call.generation_id != report.generation_id
                or call.context_version != report.context_version
            ):
                raise WorkflowError("rejected_stale", "Call is no longer current")
            case = await session.get(RescueCase, call.rescue_case_id)
            order = await self.order(session, case.tracking_id)
            if call.status not in ACTIVE_CALLS:
                return {"status": "ignored_terminal"}
            if (
                case.closed_at
                or case.opt_out
                or order.opt_out
                or order.context_version != call.active_version
                or order.status in {"delivered", "labelled", "with_cs"}
            ):
                raise WorkflowError("rejected_stale", "Call was superseded by newer order state")
            if report.status == "requested" and not call.dispatched:
                due = call_time(now, order, self.settings)
                if due is None:
                    case.calls_reserved -= 1
                    call.status, call.ended_real_at = "cancelled", self.real_now()
                    self.escalate(order, case, "horizon_expired", now, log)
                    await log.flush(session)
                    return {"status": "blocked_by_policy", "reason": "horizon_expired"}
                if due > now:
                    case.next_action_at = due
                    log.audit(order, "policy_block", {"rule": "call_hours", "due": due.isoformat()})
                    await log.flush(session)
                    return {"status": "deferred", "due": due.isoformat()}
            if report.status == "consent" and (
                call.status != "connected" or report.recording_consent is None
            ):
                raise WorkflowError(
                    "invalid_call_event",
                    "Consent requires a connected call and explicit decision",
                    422,
                )
            if report.status in {"missed", "declined"} and call.status == "connected":
                raise WorkflowError(
                    "invalid_call_event", "A connected call must end, not become missed", 422
                )
            if report.status == "requested" and call.dispatched:
                return {"status": "already_requested"}
            if not call.dispatched:
                call.dispatched = True
                call.requested_at, call.requested_real_at = now, self.real_now()
                case.next_action_at = None
                case.calls_reserved -= 1
                case.calls_made += 1
            real = self.real_now()
            if report.recording_consent is not None:
                call.recording_consent = case.recording_consent = report.recording_consent
            if report.status == "connected":
                if call.status == "connected":
                    return {"status": "already_connected"}
                call.status, call.connected_real_at = "connected", real
            elif report.status in {"missed", "declined", "ended"}:
                call.status, call.ended_real_at = report.status, real
            if call.recording_consent is False:
                call.status, call.ended_real_at = "ended", real
            if call.ended_real_at and call.connected_real_at and call.mode == "live":
                call.duration_s = max(0, (real - call.connected_real_at).total_seconds())
            context = self.context(order, "calling")
            context.setdefault("contact_log", []).append(
                {
                    "at": now.astimezone(self.settings.timezone).isoformat(),
                    "type": "call_" + str(call.number),
                    "result": call.status,
                    "simulated": call.mode != "live",
                }
            )
            log.change(
                order,
                context,
                "call_state",
                {
                    "call_id": call.id,
                    "status": call.status,
                    "number": call.number,
                    "mode": call.mode,
                },
            )
            call.active_version = order.context_version
            if call.status in {"missed", "declined"}:
                if call.number >= self.settings.max_calls_per_cycle:
                    self.escalate(order, case, "two_calls_unanswered", now, log)
                else:
                    case.state = "call_2_due"
                    case.next_action_at = call.requested_at + timedelta(
                        minutes=self.settings.call2_after_min
                    )
                    log.change(
                        order, self.context(order, "call_2_due"), "call_scheduled", {"number": 2}
                    )
            elif call.status == "ended":
                if report.masked_text and call.recording_consent is True:
                    await self.begin_extraction(
                        session, order, case, now, log, "ai_call", text=report.masked_text
                    )
                else:
                    case.state, case.reason = "confirm_in_chat", "clarification_sent"
                    case.next_action_at = None
                    log.change(
                        order,
                        self.context(order, "confirm_in_chat"),
                        "confirm_asked",
                        {"case_id": case.id},
                    )
                    self.message(
                        session,
                        order,
                        case,
                        now,
                        "clarification",
                        "Please confirm a delivery date/window and drop-off point in chat.",
                        f"call-end:{call.id}",
                    )
            result = {"status": call.status, "context_version": order.context_version}
            self.receipt(session, "call_event", report, fingerprint, result, now)
            await log.flush(session)
            return result
