from fastapi import APIRouter, Request
from sqlalchemy import exists, select

from app.contracts import CourierAction, CSDecision, UndoAction
from app.db.models import Order, RescueCase
from app.morning import WorkflowError


def case_view(case, settings):
    return {
        "shipper_event_id": case.shipper_event_id,
        "id": case.id,
        "tracking_id": case.tracking_id,
        "generation_id": case.generation_id,
        "trigger": case.trigger,
        "cycle": case.cycle,
        "state": case.state,
        "calls_made": case.calls_made,
        "calls_reserved": case.calls_reserved,
        "reason": case.reason,
        "assigned_to": case.assigned_to,
        "opt_out": case.opt_out,
        "next_action_at": case.next_action_at.astimezone(settings.timezone).isoformat()
        if case.next_action_at
        else None,
        "closed_at": case.closed_at.astimezone(settings.timezone).isoformat()
        if case.closed_at
        else None,
    }


def workflow_router():
    router = APIRouter()

    @router.post("/orders/{tracking_id}/events", status_code=201)
    async def tap(tracking_id: str, body: CourierAction, request: Request):
        return await request.app.state.workflow.tap(tracking_id, body)

    @router.post("/events/{event_id}/undo")
    async def undo(event_id: int, body: UndoAction, request: Request):
        return await request.app.state.workflow.undo(event_id, body)

    @router.get("/cases")
    async def cases(request: Request, state: str = "with_cs,needs_review"):
        states = set(state.split(","))
        if "review" in states or "needs_review" in states:
            states.add("with_cs")
        async with request.app.state.database.sessions() as session:
            cases = (
                await session.scalars(
                    select(RescueCase)
                    .where(
                        RescueCase.state.in_(states),
                        RescueCase.closed_at.is_(None),
                    )
                    .order_by(RescueCase.created_at, RescueCase.id)
                )
            ).all()
            orphans = (
                await session.scalars(
                    select(Order).where(
                        Order.status == "with_cs",
                        ~exists(
                            select(RescueCase.id).where(
                                RescueCase.tracking_id == Order.tracking_id,
                                RescueCase.closed_at.is_(None),
                            )
                        ),
                    )
                )
            ).all()
            return {
                "items": [case_view(case, request.app.state.settings) for case in cases],
                "orders_without_case": [
                    {
                        "tracking_id": order.tracking_id,
                        "context_version": order.context_version,
                        "generation_id": order.generation_id,
                        "reason": order.context.get("escalation_reason"),
                    }
                    for order in orphans
                ],
            }

    @router.post("/cases/{case_id}/decision")
    async def decide_case(case_id: int, body: CSDecision, request: Request):
        async with request.app.state.database.sessions() as session:
            case = await session.get(RescueCase, case_id)
            if case is None:
                raise WorkflowError("not_found", "Case not found", 404)
            tracking_id = case.tracking_id
        return await request.app.state.workflow.cs_decision(tracking_id, body)

    @router.post("/orders/{tracking_id}/decision")
    async def decide_order(tracking_id: str, body: CSDecision, request: Request):
        return await request.app.state.workflow.cs_decision(tracking_id, body)

    return router
