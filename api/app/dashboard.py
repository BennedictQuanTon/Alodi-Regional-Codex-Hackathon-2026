"""Read-only dashboard projection of the current synthetic backend generation."""

from collections import Counter, defaultdict

from fastapi import APIRouter, Request, Response
from sqlalchemy import func, select

from app.db.models import (
    AvailabilityReply,
    CallAttempt,
    Courier,
    DemoState,
    Event,
    Hub,
    Message,
    Order,
    RescueCase,
    RescueMessage,
    RescueResult,
    ScenarioFixture,
    ShipperEvent,
)
from app.morning import WorkflowError

SELECTED = "SPXVN0123456789"
LIMIT = 100
REASONS = {
    "refused": "Refused at door",
    "two_calls_unanswered": "Unreachable after 2 calls",
    "low_confidence": "Low confidence",
}


async def dashboard_view(app):
    settings = app.state.settings
    if settings.app_env != "demo":
        raise WorkflowError("demo_only", "The synthetic dashboard requires APP_ENV=demo", 503)
    async with app.state.database.sessions() as session:
        # A single read transaction provides a coherent generation without taking
        # the workflow's write reservation or checkpointing business time.
        async with session.begin():
            state = await session.get(DemoState, 1)
            if state is None:
                raise WorkflowError("demo_only", "Demo state is not seeded", 503)
            generation = state.generation_id
            now = app.state.morning.clock.now(state).astimezone(settings.timezone)
            hub = await session.scalar(select(Hub).order_by(Hub.hub_id).limit(1))
            couriers = (await session.scalars(select(Courier).order_by(Courier.route_id))).all()
            orders = (
                await session.execute(
                    select(
                        Order.tracking_id,
                        Order.buyer_name,
                        Order.district,
                        Order.item,
                        Order.cod_amount,
                        Order.route_id,
                        Order.status,
                        Order.delivery_date,
                        Order.attempt_count,
                        Order.context_version,
                        Order.opt_out,
                        Order.context["card"].label("card"),
                    ).where(Order.generation_id == generation)
                )
            ).all()
            cases = (
                await session.scalars(
                    select(RescueCase)
                    .where(
                        RescueCase.generation_id == generation,
                    )
                    .order_by(RescueCase.id)
                )
            ).all()
            calls = (
                await session.scalars(
                    select(CallAttempt).where(
                        CallAttempt.generation_id == generation,
                    )
                )
            ).all()
            taps = (
                await session.scalars(
                    select(ShipperEvent)
                    .where(
                        ShipperEvent.generation_id == generation,
                    )
                    .order_by(ShipperEvent.id)
                )
            ).all()
            availability = (
                await session.execute(
                    select(
                        AvailabilityReply.tracking_id,
                        AvailabilityReply.answer_type,
                        AvailabilityReply.asked_at,
                    ).where(
                        AvailabilityReply.generation_id == generation,
                        AvailabilityReply.service_date == now.date(),
                    )
                )
            ).all()
            results = (
                await session.execute(
                    select(
                        RescueResult.rescue_case_id,
                        RescueResult.source,
                        RescueResult.decision,
                    )
                    .join(RescueCase)
                    .where(RescueCase.generation_id == generation)
                )
            ).all()
            messages = (
                await session.execute(
                    select(
                        RescueMessage.rescue_case_id,
                        RescueMessage.kind,
                        RescueMessage.status,
                    ).where(RescueMessage.generation_id == generation)
                )
            ).all()
            sent_morning = await session.scalar(
                select(func.count())
                .select_from(Message)
                .where(
                    Message.generation_id == generation,
                    Message.status == "sent",
                )
            )
            updated = dict(
                (
                    await session.execute(
                        select(Event.tracking_id, func.max(Event.at))
                        .where(
                            Event.generation_id == generation,
                        )
                        .group_by(Event.tracking_id)
                    )
                ).all()
            )
            approved_labels = set(
                (
                    await session.scalars(
                        select(Event.tracking_id).where(
                            Event.generation_id == generation,
                            Event.type == "cs_decision",
                            Event.actor.like("cs:%"),
                            Event.payload["action"].as_string().in_(["approve_label", "return"]),
                        )
                    )
                ).all()
            )
            fixtures = await session.scalar(
                select(func.count())
                .select_from(ScenarioFixture)
                .join(
                    Order,
                    ScenarioFixture.tracking_id == Order.tracking_id,
                )
                .where(Order.generation_id == generation)
            )
            selected = await session.get(Order, SELECTED)

    by_order = {order.tracking_id: order for order in orders}
    by_courier = {courier.route_id: courier for courier in couriers}
    by_case = {case.id: case for case in cases}
    latest = {case.tracking_id: case for case in cases}
    first_taps = {}
    hours = {
        f"{hour:02}": {"h": f"{hour:02}", "a": 0, "b": 0, "refused": 0} for hour in range(8, 21)
    }
    for tap in taps:
        if tap.status != "committed":
            continue
        first_taps.setdefault(tap.tracking_id, tap)
    failures = Counter(tap.button for tap in first_taps.values() if tap.button in {"A", "B", "C"})
    for tap in first_taps.values():
        local = tap.commit_at.astimezone(settings.timezone)
        if tap.button in {"A", "B", "C"} and local.date() == now.date():
            hour = f"{local.hour:02}"
            hours.setdefault(hour, {"h": hour, "a": 0, "b": 0, "refused": 0})
            hours[hour][{"A": "a", "B": "b", "C": "refused"}[tap.button]] += 1
    morning = Counter(item.answer_type for item in availability)
    cs_orders = [order for order in orders if order.status == "with_cs"]
    cs_reasons = Counter(
        latest[order.tracking_id].reason if order.tracking_id in latest else "unknown"
        for order in cs_orders
    )
    placed = [call for call in calls if call.dispatched]
    flow_a_calls = [call for call in placed if by_case[call.rescue_case_id].trigger == "NO_ANSWER"]
    flow_a_chat = {
        message.rescue_case_id
        for message in messages
        if message.kind == "rescue_chat"
        and message.status == "sent"
        and by_case[message.rescue_case_id].trigger == "NO_ANSWER"
    }
    flow_a_replies = {
        result.rescue_case_id
        for result in results
        if result.source == "chat" and by_case[result.rescue_case_id].trigger == "NO_ANSWER"
    }
    result_counts = Counter((result.decision, result.source) for result in results)
    minutes = round(sum(call.duration_s or 0 for call in calls if call.connected_real_at) / 60, 2)
    day = {
        "orders": len(orders),
        "window_questions_sent": sum(item.asked_at is not None for item in availability),
        "morning": {
            "windows": morning["windows"],
            "cannot_today": morning["cannot_today"],
            "no_reply": morning["no_reply"],
        },
        "attempted_today": sum(
            tap.commit_at.astimezone(settings.timezone).date() == now.date()
            for tap in first_taps.values()
        ),
        "delivered_first_attempt": sum(tap.button == "DELIVERED" for tap in first_taps.values()),
        "failed_first_attempt": {
            "A": failures["A"],
            "B": failures["B"],
            "C": failures["C"],
            "total": sum(failures.values()),
        },
        "flow_a": {
            "chat_sent": len(flow_a_chat),
            "replied_in_chat": len(flow_a_replies),
            "call_1": sum(call.number == 1 for call in flow_a_calls),
            "call_1_answered": sum(
                call.number == 1 and call.connected_real_at is not None for call in flow_a_calls
            ),
            "call_2": sum(call.number == 2 for call in flow_a_calls),
            "call_2_answered": sum(
                call.number == 2 and call.connected_real_at is not None for call in flow_a_calls
            ),
            "unreachable_to_cs": cs_reasons["two_calls_unanswered"],
            "calls_moved_to_next_morning": sum(
                case.trigger == "NO_ANSWER"
                and case.next_action_at is not None
                and case.next_action_at.astimezone(settings.timezone).date() > now.date()
                for case in cases
            ),
        },
        "flow_b": {
            "memos": sum(
                tap.button == "B" and tap.memo_ref is not None
                for tap in taps
                if tap.status == "committed"
            )
        },
        "extraction": {
            "auto_applied": sum(
                count
                for (decision, source), count in result_counts.items()
                if decision == "auto_applied" and source != "chat"
            ),
            "confirmed_in_chat": result_counts[("auto_applied", "chat")],
            "cs_review": sum(
                count
                for (decision, _), count in result_counts.items()
                if decision in {"needs_review", "escalated_cs"}
            ),
        },
        "opt_out": sum(order.opt_out for order in orders),
        "cs_queue": {
            "refused": cs_reasons["refused"],
            "unreachable": cs_reasons["two_calls_unanswered"],
            "low_confidence": cs_reasons["low_confidence"],
            "total": len(cs_orders),
        },
        "rescheduled_with_card": sum(order.card is not None for order in orders),
        "messages_sent": int(sent_morning or 0)
        + sum(message.status == "sent" for message in messages),
        "call_minutes_answered": minutes,
        "memo_seconds": None,
        "calls_placed": len(placed),
        "scripted_demo_orders": int(fixtures or 0),
    }
    routes = []
    grouped_orders = defaultdict(list)
    for order in orders:
        grouped_orders[order.route_id].append(order)
    picked_windows = {item.tracking_id for item in availability if item.answer_type == "windows"}
    for courier in couriers:
        current = grouped_orders[courier.route_id]
        failed = Counter(
            first_taps[order.tracking_id].button
            for order in current
            if order.tracking_id in first_taps
        )
        routes.append(
            {
                "route": courier.route_id,
                "shipper": courier.name,
                "ward": courier.ward,
                "orders": len(current),
                "delivered": sum(order.status == "delivered" for order in current),
                "a": failed["A"],
                "b": failed["B"],
                "refused": failed["C"],
                "rescued": sum(order.card is not None for order in current),
                "cs": sum(order.status == "with_cs" for order in current),
                "windows": sum(order.tracking_id in picked_windows for order in current),
            }
        )

    def row(order, case=None):
        courier = by_courier.get(order.route_id)
        at = updated.get(order.tracking_id)
        return {
            "id": order.tracking_id,
            "buyer": order.buyer_name,
            "district": order.district,
            "ward": order.district,
            "item": order.item,
            "cod": order.cod_amount,
            "route": order.route_id,
            "shipper": courier.name if courier else "—",
            "at": at.astimezone(settings.timezone).strftime("%H:%M") if at else "—",
            "updated": at.astimezone(settings.timezone).isoformat() if at else None,
            "reason": REASONS.get(case.reason, case.reason or case.trigger)
            if case
            else "Needs review",
            "tap": {
                "NO_ANSWER": "No answer",
                "RESCHEDULE": "Rescheduled",
                "REFUSED": "Refused",
            }.get(case.trigger if case else "", "—"),
            "trigger": case.trigger if case else "PRE_DELIVERY",
            "state": case.state if case else order.status,
            "status": order.status,
            "context_version": order.context_version,
            "generation_id": generation,
        }

    recent = list(reversed(list(latest.values())))[:LIMIT]
    selected_case = latest.get(SELECTED)
    selected_view = None
    if selected and selected.generation_id == generation:
        selected_view = {
            "tracking_id": selected.tracking_id,
            "generation_id": generation,
            "status": selected.status,
            "delivery_date": selected.delivery_date.isoformat(),
            "context_version": selected.context_version,
            "context_card": selected.context.get("card"),
            "pending_event": selected.context.get("pending_event"),
            "extracted": selected.context.get("extracted"),
            "decision": selected.context.get("decision"),
            "confidence": selected.context.get("confidence"),
            "rescue_state": selected_case.state if selected_case else None,
            "calls": [
                {"id": call.id, "status": call.status, "number": call.number, "mode": call.mode}
                for call in calls
                if by_case[call.rescue_case_id].tracking_id == SELECTED
            ],
        }
    return {
        "generation_id": generation,
        "business_time": now.isoformat(),
        "data_source": "synthetic",
        "data_label": "Live backend · synthetic demo orders",
        "hub": {
            "id": hub.hub_id if hub else "—",
            "name": hub.name if hub else "Unseeded hub",
            "date": now.date().isoformat(),
            "shippers": len(couriers),
            "wards": hub.service_area_wards if hub else [],
            "morningRun": hub.morning_run.strftime("%H:%M") if hub else "—",
            "cutoff": settings.route_cutoff.strftime("%H:%M"),
            "callHours": f"{settings.call_window_start:%H:%M}–{settings.call_window_end:%H:%M}",
        },
        "day": day,
        "routes": routes,
        "fails_by_hour": [hours[key] for key in sorted(hours)],
        "cases": [
            row(by_order[case.tracking_id], case) for case in recent if case.tracking_id in by_order
        ],
        "cs_queue": [
            row(order, latest.get(order.tracking_id))
            for order in sorted(
                cs_orders,
                key=lambda order: updated.get(order.tracking_id) or state.clock_start,
                reverse=True,
            )[:LIMIT]
        ],
        "selected_order": selected_view,
        "policy_guard": {
            "calls_outside_window": sum(
                not settings.call_window_start
                <= call.requested_at.astimezone(settings.timezone).time().replace(tzinfo=None)
                <= settings.call_window_end
                for call in placed
            ),
            "cycles_over_two_calls": sum(
                case.calls_made > settings.max_calls_per_cycle for case in cases
            ),
            "labels_without_human": sum(
                order.status == "labelled" and order.tracking_id not in approved_labels
                for order in orders
            ),
            "opt_out_contact_violations": None,
            "call_minutes_answered": minutes,
            "memo_seconds": None,
            "scope": "Observed requests and audit records in this synthetic generation.",
        },
        "limits": {
            "case_limit": LIMIT,
            "cs_queue_limit": LIMIT,
            "cases_truncated": len(latest) > LIMIT,
            "cs_queue_truncated": len(cs_orders) > LIMIT,
        },
    }


def dashboard_router():
    router = APIRouter()

    @router.get("/demo/dashboard")
    async def dashboard(request: Request, response: Response):
        response.headers["Cache-Control"] = "no-store"
        return await dashboard_view(request.app)

    return router
