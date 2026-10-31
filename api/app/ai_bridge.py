"""GPT transport boundary backed by the authoritative local workflow and SQLite."""

import asyncio
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from uuid import NAMESPACE_URL, uuid5

from alodi_ai.bridge import Snapshot
from alodi_ai.extract import extract
from alodi_ai.schema import DeliveryContext, empty_context
from sqlalchemy import select

from app.contracts import CallReport, Extraction, Proposal
from app.db.models import CallAttempt, DemoState, Order, ProviderRequest, RescueCase, RouteWindow
from app.morning import WorkflowError
from app.policy import call_time, deadline

DROP_LOCATION_LABELS = {
    "hand_to_buyer": "Hand to buyer",
    "security_desk": "Security desk",
    "reception": "Reception",
    "neighbour": "Neighbour",
    "locker": "Locker",
}


@dataclass
class HostSnapshot(Snapshot):
    call_id: str | None = None
    request_id: str | None = None


class WorkflowBridge:
    def __init__(self):
        self.flow = None

    def bind(self, workflow):
        self.flow = workflow

    async def current_mode(self):
        async with self.flow.database.sessions() as session:
            state = await session.get(DemoState, 1)
            return "offline" if state and state.offline_mode else self.flow.settings.ai_mode

    @staticmethod
    def eligible(order, case, state):
        return bool(
            case
            and state
            and not state.offline_mode
            and not order.opt_out
            and not case.opt_out
            and not case.closed_at
            and case.trigger != "REFUSED"
            and order.status not in {"delivered", "labelled", "with_cs"}
            and case.state
            in {
                "calling",
                "memo",
                "extracting",
                "call_1_due",
                "call_2_due",
                "chat_pending",
                "confirm_in_chat",
            }
        )

    async def snapshot(self, tracking_id):
        async with self.flow.database.sessions() as session:
            order = await session.get(Order, tracking_id)
            if not order:
                raise KeyError(tracking_id)
            state = await session.get(DemoState, 1)
            case = await session.scalar(
                select(RescueCase)
                .where(
                    RescueCase.tracking_id == tracking_id,
                    RescueCase.generation_id == order.generation_id,
                    RescueCase.closed_at.is_(None),
                )
                .order_by(RescueCase.cycle.desc())
                .limit(1)
            )
            windows = (
                await session.scalars(
                    select(RouteWindow)
                    .where(RouteWindow.route_id == order.route_id)
                    .order_by(RouteWindow.starts_at)
                )
            ).all()
            call = await session.scalar(
                select(CallAttempt)
                .where(
                    CallAttempt.rescue_case_id == case.id if case else False,
                    CallAttempt.status.in_(["requested", "connected"]),
                )
                .order_by(CallAttempt.number.desc())
                .limit(1)
            )
            limit = deadline(order, self.flow.settings)
            now = self.flow.clock.now(state).astimezone(self.flow.settings.timezone)
            raw = order.context.get("extracted") or {}
            # Part 1 may also retain its validated ward; it is not a cloud inference.
            raw = {key: value for key, value in raw.items() if key in DeliveryContext.model_fields}
            if raw.get("address_correction"):
                raw["address_correction"] = {
                    key: value for key, value in raw["address_correction"].items() if key != "ward"
                }
            context = DeliveryContext.model_validate(
                {
                    **empty_context().model_dump(by_alias=True),
                    **raw,
                }
            )
            return HostSnapshot(
                tracking_id=tracking_id,
                rescue_case_id=case.id if case else 0,
                context_version=order.context_version,
                demo_epoch=order.generation_id,
                business_now=now,
                offered_windows=[f"{w.starts_at:%H:%M}/{w.ends_at:%H:%M}" for w in windows],
                reschedule_deadline=datetime.combine(
                    limit or now.date(), time(20, 30), self.flow.settings.timezone
                ),
                context=context,
                known_pii=[order.buyer_name, order.buyer_phone, order.address],
                eligible=self.eligible(order, case, state)
                and limit is not None
                and now.date() <= limit,
                call_id=call.id if call else None,
            )

    async def call_started(self, call):
        snapshot = call.snapshot
        current = await self.snapshot(snapshot.tracking_id)
        if (
            not current.eligible
            or current.demo_epoch != snapshot.demo_epoch
            or current.context_version != snapshot.context_version
            or current.call_id != call.id
        ):
            raise ValueError("Call superseded")
        async with self.flow.database.sessions() as session:
            order = await session.get(Order, snapshot.tracking_id)
            if call_time(current.business_now, order, self.flow.settings) != current.business_now:
                raise ValueError("Outside calling hours")
            host = await session.get(CallAttempt, call.id)
            version = host.context_version
        try:
            result = await self.flow.call_event(
                CallReport(
                    generation_id=snapshot.demo_epoch,
                    call_id=call.id,
                    context_version=version,
                    idempotency_key=f"runtime-connect:{call.id}",
                    status="connected",
                    recording_consent=True,
                )
            )
        except WorkflowError as error:
            raise ValueError("Call superseded") from error
        current = await self.snapshot(snapshot.tracking_id)
        if (
            result["status"] not in {"connected", "already_connected"}
            or not current.eligible
            or current.call_id != call.id
            or current.context_version != result.get("context_version")
        ):
            raise ValueError("Call superseded during connection")
        return current

    async def call_ended(self, call, reason):
        async with self.flow.database.sessions() as session:
            host = await session.get(CallAttempt, call.id)
            if not host or host.status not in {"requested", "connected"}:
                return
            report = CallReport(
                generation_id=host.generation_id,
                call_id=host.id,
                context_version=host.context_version,
                idempotency_key=f"runtime-end:{call.id}",
                status="ended" if host.status == "connected" else "missed",
            )
        try:
            await self.flow.call_event(report)
        except WorkflowError as error:
            if error.code != "rejected_stale":
                raise

    async def prepare_memo(self, tracking_id, generation, version, event_id, job_id):
        from app.db.models import ShipperEvent

        if generation is None or version is None or event_id is None:
            raise WorkflowError("invalid_memo", "A current committed B outcome is required", 422)
        async with self.flow.morning.transaction(generation) as (session, now, log):
            if self.flow.settings.ai_mode != "live":
                raise WorkflowError("part2_unavailable", "Audio memo requires live mode", 503)
            order = await self.flow.order(session, tracking_id)
            state = await session.get(DemoState, 1)
            if state.offline_mode:
                raise WorkflowError("offline", "Memo unavailable offline", 503)
            case = await session.scalar(
                select(RescueCase).where(
                    RescueCase.shipper_event_id == event_id,
                    RescueCase.tracking_id == tracking_id,
                    RescueCase.generation_id == generation,
                )
            )
            event = await session.get(ShipperEvent, event_id)
            if order.context_version != version:
                raise WorkflowError("rejected_stale", "Fetch current context before uploading")
            if (
                not self.eligible(order, case, state)
                or case.trigger != "RESCHEDULE"
                or case.state != "memo"
                or not event
                or event.status != "committed"
                or event.memo_ref
            ):
                raise WorkflowError("invalid_memo", "Memo requires an unused committed B outcome")
            event.memo_ref = f"ephemeral:{job_id}"
            task = await self.flow.begin_extraction(
                session,
                order,
                case,
                now,
                log,
                "shipper_memo",
                memo_ref=event.memo_ref,
            )
            task.status = "processing"
            task.lease_until = self.flow.real_now() + timedelta(seconds=70)
            request_id = task.id
            request_version = task.context_version
            await log.flush(session)
        snapshot = await self.snapshot(tracking_id)
        if snapshot.context_version != request_version or not snapshot.eligible:
            raise WorkflowError("rejected_stale", "Memo was superseded during upload")
        snapshot.request_id = request_id
        return snapshot

    async def submit(
        self, snapshot, proposal, source, confirmation, proposal_revision, idempotency_key
    ):
        if source == "ai_call" and not confirmation and not proposal.opt_out:
            return "needs_clarification"
        values = proposal.model_dump(by_alias=True, mode="json")
        drop = values.get("drop_location")
        if drop and not drop["note"].strip():
            if drop["type"] == "other":
                return "needs_clarification"
            # The AI contract permits an omitted descriptive note when the enum
            # already names the location. Store that category's display label;
            # do not invent an address, receiver or additional instructions.
            drop["note"] = DROP_LOCATION_LABELS[drop["type"]]
        fields = Extraction.model_validate(values)
        # same_district does not establish a ward. Unresolved corrections go to review.
        digest = hashlib.sha256(
            json.dumps(
                {
                    "fields": fields.model_dump(mode="json"),
                    "revision": proposal_revision,
                    "source": source,
                    "confirmed": confirmation,
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        task_id = snapshot.request_id or str(
            uuid5(NAMESPACE_URL, f"{snapshot.demo_epoch}:{snapshot.tracking_id}:{idempotency_key}")
        )
        try:
            async with self.flow.morning.transaction(snapshot.demo_epoch) as (session, now, log):
                task = await session.get(ProviderRequest, task_id)
                if task:
                    if task.input.get("bridge_digest") not in (None, digest):
                        return "rejected_stale"
                    if task.status == "completed":
                        return task.result["result"]["status"]
                order = await session.get(Order, snapshot.tracking_id)
                case = await session.get(RescueCase, snapshot.rescue_case_id)
                state = await session.get(DemoState, 1)
                if (
                    not order
                    or not self.eligible(order, case, state)
                    or order.context_version != snapshot.context_version
                    or order.generation_id != snapshot.demo_epoch
                ):
                    return "rejected_stale"
                if source == "ai_call":
                    host = await session.get(CallAttempt, snapshot.call_id)
                    if (
                        not host
                        or host.status != "connected"
                        or host.active_version != order.context_version
                        or not host.recording_consent
                    ):
                        return "rejected_stale"
                    # Own completion must not enqueue a cancellation that cuts off farewell.
                    host.status, host.ended_real_at = "ended", self.flow.real_now()
                    host.duration_s = max(
                        0, (host.ended_real_at - host.connected_real_at).total_seconds()
                    )
                if task is None:
                    task = await self.flow.begin_extraction(
                        session,
                        order,
                        case,
                        now,
                        log,
                        source,
                    )
                    task.id = task_id
                    task.status = "processing"
                task.input = {**task.input, "bridge_digest": digest}
                request = Proposal(
                    request_id=task.id,
                    tracking_id=order.tracking_id,
                    rescue_case_id=case.id,
                    generation_id=order.generation_id,
                    context_version=task.context_version,
                    source=source,
                    mode="live",
                    fields=fields,
                )
                await log.flush(session)
            result = await self.flow.apply_proposal(request)
            return result["status"]
        except WorkflowError as error:
            if error.code in {"rejected_stale", "blocked_by_policy", "idempotency_conflict"}:
                return "rejected_stale"
            raise


class LiveAdapter:
    mode = "live"

    def __init__(self, bridge, settings):
        self.bridge, self.settings, self.runtime = bridge, settings, None
        self.cancelled = set()

    async def extract(self, request):
        if request.source == "ai_call":
            raise WorkflowError(
                "confirmation_required", "Live calls submit verified proposals only"
            )
        snapshot = await self.bridge.snapshot(request.tracking_id)
        if (
            snapshot.demo_epoch != request.generation_id
            or snapshot.context_version != request.context_version
            or not snapshot.eligible
        ):
            raise WorkflowError("rejected_stale", "Provider request superseded")
        if not request.text:
            raise WorkflowError("invalid_memo", "Ephemeral memo job has expired")
        self.runtime.observations.append(
            snapshot,
            {
                "type": "models",
                "extraction": self.settings.openai_model,
            },
        )
        self.runtime.observations.append(
            snapshot,
            {
                "type": "status",
                "status": "extraction_processing",
                "job_id": request.request_id,
            },
        )
        fields = await extract(self.settings, snapshot, request.text, request.source)
        values = fields.model_dump(by_alias=True, mode="json")
        self.runtime.observations.append(
            snapshot,
            {
                "type": "proposal",
                "revision": 1,
                "context": values,
            },
        )
        return Proposal(
            request_id=request.request_id,
            tracking_id=request.tracking_id,
            rescue_case_id=request.rescue_case_id,
            generation_id=request.generation_id,
            context_version=request.context_version,
            source=request.source,
            mode="live",
            fields=Extraction.model_validate(values),
        )

    async def observe_result(self, request, proposal, result):
        snapshot = await self.bridge.snapshot(request.tracking_id)
        if snapshot.demo_epoch == request.generation_id:
            context = proposal.fields.model_dump(by_alias=True, mode="json")
            if context.get("address_correction"):
                context["address_correction"].pop("ward", None)
            self.runtime.observations.append(
                snapshot,
                {
                    "type": "result",
                    "status": result["status"],
                    "message": result.get("reason"),
                    "context": context,
                    "job_id": request.request_id,
                },
            )

    async def request_call(self, request):
        if (request.generation_id, request.call_id) in self.cancelled:
            return []
        await self.runtime.reserve_call(request.tracking_id, call_id=request.call_id)
        if (request.generation_id, request.call_id) in self.cancelled:
            await self.cancel_call(request.call_id, request.generation_id)
        return []

    async def cancel_call(self, call_id, generation_id):
        self.cancelled.add((generation_id, call_id))
        call = self.runtime.calls.get(call_id)
        if call:
            await self.runtime.end(call, "host_cancelled")

    def bind(self, workflow):
        self.bridge.bind(workflow)

    async def cancel_generation(self, generation):
        jobs = [
            (job_id, task)
            for job_id, task in self.runtime.job_tasks.items()
            if self.runtime.jobs[job_id].get("generation_id") == generation
        ]
        for job_id, task in jobs:
            if not task.done():
                self.runtime.jobs[job_id]["status"] = "cancelled"
                task.cancel()
        await asyncio.gather(*(task for _, task in jobs), return_exceptions=True)
        for call in list(self.runtime.calls.values()):
            if call.snapshot.demo_epoch == generation:
                self.cancelled.add((generation, call.id))
                await self.runtime.end(call, "generation_cancelled")

    def retire_generation(self, generation):
        self.runtime.retire_generation(generation)

    def activate_generation(self, generation):
        self.runtime.observations.activate(generation)
