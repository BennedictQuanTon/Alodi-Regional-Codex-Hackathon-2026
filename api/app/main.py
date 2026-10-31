"""Local read APIs and the simulated morning availability workflow."""

from contextlib import asynccontextmanager
from datetime import date as Date
from typing import Annotated

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

from app.clock import BusinessClock
from app.contracts import RescueReply
from app.db.migrate import upgrade_database
from app.db.models import (
    AvailabilityReply,
    CallAttempt,
    Courier,
    DemoState,
    Event,
    Hub,
    Message,
    Order,
    ProviderRequest,
    RescueCase,
    RescueMessage,
    RouteWindow,
    ScenarioFixture,
)
from app.db.seed import load_seed_pack, seed_database
from app.db.session import Database
from app.demo import DemoService
from app.morning import MorningService, WorkflowError, window_note
from app.part2 import Part2Adapter
from app.rescue_routes import rescue_router
from app.scheduler import Scheduler
from app.schemas import (
    AuditView,
    DispatchRequest,
    MessageView,
    MorningJobRequest,
    MorningReplyRequest,
    OrderDetail,
    OrderPage,
    OrderView,
)
from app.settings import ConfigurationError, Settings, load_settings
from app.state import WorkflowService
from app.workflow_routes import case_view, workflow_router


def order_view(order: Order) -> OrderView:
    phone = order.buyer_phone
    if phone.startswith("TEST-"):
        masked = "TEST *** " + phone.removeprefix("TEST-")
    else:
        masked = "***"
    return OrderView(
        tracking_id=order.tracking_id,
        buyer_name=order.buyer_name,
        buyer_phone_masked=masked,
        address=order.address,
        district=order.district,
        item=order.item,
        cod_amount=order.cod_amount,
        route_id=order.route_id,
        stop_index=order.stop_index,
        risk_flags=order.risk_flags,
        delivery_date=order.delivery_date,
        attempt_count=order.attempt_count,
        status=order.status,
        context_version=order.context_version,
        generation_id=order.generation_id,
        original_delivery_date=order.original_delivery_date,
        window_note=window_note(order),
    )


def create_app(
    settings: Settings | None = None,
    *,
    clock: BusinessClock | None = None,
    part2_adapter: Part2Adapter | None = None,
    part2_router: APIRouter | None = None,
    start_scheduler: bool | None = None,
    ai_runtime=None,
) -> FastAPI:
    settings = settings or load_settings()
    if part2_adapter is not None and part2_adapter.mode != "live":
        raise ConfigurationError("Part 2 provider adapter must declare live mode")
    if settings.effective_ai_mode == "live" and (
        part2_adapter is None or part2_adapter.mode != "live"
    ):
        raise ConfigurationError(
            "AI_MODE requires Part 2 live adapters, which are not registered yet"
        )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.prepare_directories()
        database = Database(settings)
        app.state.database = database
        try:
            await upgrade_database(database)
            if settings.app_env == "demo":
                pack = load_seed_pack(settings.mock_pack_dir)
                await seed_database(database, settings, pack)
            app.state.morning = MorningService(database, settings, clock=clock)
            app.state.workflow = WorkflowService(app.state.morning)
            if part2_adapter is not None and hasattr(part2_adapter, "bind"):
                part2_adapter.bind(app.state.workflow)
            app.state.scheduler = Scheduler(app.state.workflow, part2_adapter)
            app.state.demo = DemoService(app.state.scheduler)
            async with database.sessions.begin() as session:
                state = await session.get(DemoState, 1)
                if state:
                    # Environment switches initialize each process; controls may change
                    # them during the demo. Existing business time and speed are retained.
                    state.auto_buyer = settings.auto_buyer
                    state.offline_mode = settings.offline_mode
                    app.state.morning.clock.now(state)
            if settings.app_env == "demo" and (
                start_scheduler is True or (start_scheduler is None and clock is None)
            ):
                app.state.scheduler.start()
            try:
                yield
            finally:
                await app.state.scheduler.stop()
                if ai_runtime is not None:
                    await ai_runtime.shutdown()
        finally:
            await database.close()

    app = FastAPI(title="Alodi local API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.ai_runtime = ai_runtime
    app.include_router(workflow_router())
    app.include_router(rescue_router(fixture_memo=part2_router is None))
    if part2_router is not None:
        app.include_router(part2_router)

    @app.exception_handler(WorkflowError)
    async def workflow_error(request: Request, error: WorkflowError):
        return JSONResponse(
            status_code=error.status_code, content={"code": error.code, "detail": error.detail}
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Idempotency-Key"],
    )

    @app.get("/health")
    async def health(request: Request):
        database: Database = request.app.state.database
        try:
            async with database.sessions() as session:
                await session.execute(text("SELECT 1"))
                demo = await session.get(DemoState, 1)
                counts = {
                    "orders": await session.scalar(select(func.count()).select_from(Order)),
                    "routes": await session.scalar(select(func.count()).select_from(Courier)),
                    "scenario_fixtures": await session.scalar(
                        select(func.count()).select_from(ScenarioFixture)
                    ),
                }
        except SQLAlchemyError:
            return JSONResponse(
                status_code=503, content={"status": "unavailable", "database": "unavailable"}
            )
        return {
            "status": "ok",
            "database": "ok",
            "implementation_stage": "scheduled_rescue",
            "app_env": settings.app_env,
            "ai_mode": ("replay" if demo.offline_mode else settings.ai_mode)
            if demo
            else settings.effective_ai_mode,
            "ai_adapters_ready": part2_adapter is not None,
            "provider_calls_enabled": settings.ai_mode == "live"
            and part2_adapter is not None
            and not (demo.offline_mode if demo else settings.offline_mode),
            "stub_adapter_ready": True,
            "replay_adapter_ready": True,
            "scheduler_running": request.app.state.scheduler.task is not None,
            "scheduler_error": request.app.state.scheduler.last_error,
            "data_source": "synthetic" if demo else "unseeded",
            "counts": counts,
            "generation_id": demo.generation_id if demo else None,
            "business_time": request.app.state.morning.clock.now(demo)
            .astimezone(settings.timezone)
            .isoformat()
            if demo
            else None,
        }

    @app.get("/orders", response_model=OrderPage)
    async def list_orders(
        request: Request,
        route_id: str | None = None,
        date: Date | None = None,
        limit: Annotated[int, Query(ge=1, le=500)] = 200,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> OrderPage:
        filters = []
        if route_id is not None:
            filters.append(Order.route_id == route_id)
        database: Database = request.app.state.database
        async with database.sessions() as session:
            if date is None:
                state = await session.get(DemoState, 1)
                if state:
                    date = (
                        request.app.state.morning.clock.now(state)
                        .astimezone(settings.timezone)
                        .date()
                    )
            if date is not None:
                filters.append(Order.delivery_date == date)
            total = await session.scalar(select(func.count()).select_from(Order).where(*filters))
            orders = (
                await session.scalars(
                    select(Order)
                    .where(*filters)
                    .order_by(Order.route_id, Order.stop_index, Order.tracking_id)
                    .limit(limit)
                    .offset(offset)
                )
            ).all()
            source = await session.scalar(select(Hub.data_source).limit(1))
            return OrderPage(
                items=[order_view(order) for order in orders],
                total=total,
                limit=limit,
                offset=offset,
                data_source=source or "unseeded",
            )

    @app.get("/orders/{tracking_id}", response_model=OrderDetail)
    async def get_order(tracking_id: str, request: Request) -> OrderDetail:
        database: Database = request.app.state.database
        async with database.sessions() as session:
            order = await session.get(Order, tracking_id)
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")
            events = (
                await session.scalars(
                    select(Event).where(Event.tracking_id == tracking_id).order_by(Event.id)
                )
            ).all()
            windows = (
                await session.scalars(
                    select(RouteWindow)
                    .where(RouteWindow.route_id == order.route_id)
                    .order_by(RouteWindow.starts_at)
                )
            ).all()
            source = await session.scalar(
                select(Hub.data_source).join(Courier).where(Courier.route_id == order.route_id)
            )
            question = await session.scalar(
                select(AvailabilityReply)
                .where(
                    AvailabilityReply.tracking_id == tracking_id,
                    AvailabilityReply.generation_id == order.generation_id,
                )
                .order_by(AvailabilityReply.service_date.desc(), AvailabilityReply.id.desc())
                .limit(1)
            )
            messages = (
                await session.scalars(
                    select(Message)
                    .where(
                        Message.tracking_id == tracking_id,
                        Message.generation_id == order.generation_id,
                    )
                    .order_by(Message.created_at, Message.id)
                )
            ).all()
            rescue_cases = (
                await session.scalars(
                    select(RescueCase)
                    .where(RescueCase.tracking_id == tracking_id)
                    .order_by(RescueCase.cycle)
                )
            ).all()
            rescue_messages = (
                await session.scalars(
                    select(RescueMessage)
                    .where(RescueMessage.tracking_id == tracking_id)
                    .order_by(RescueMessage.created_at, RescueMessage.id)
                )
            ).all()
            calls = (
                await session.scalars(
                    select(CallAttempt)
                    .join(RescueCase)
                    .where(RescueCase.tracking_id == tracking_id)
                    .order_by(CallAttempt.requested_at)
                )
            ).all()
            provider_requests = (
                await session.scalars(
                    select(ProviderRequest)
                    .where(ProviderRequest.tracking_id == tracking_id)
                    .order_by(ProviderRequest.created_at)
                )
            ).all()
            return OrderDetail(
                order=order_view(order),
                context=order.context,
                pending_event=order.context.get("pending_event"),
                context_card=order.context.get("card"),
                calls=[
                    {
                        "id": call.id,
                        "case_id": call.rescue_case_id,
                        "number": call.number,
                        "status": call.status,
                        "context_version": call.context_version,
                        "mode": call.mode,
                        "recording_consent": call.recording_consent,
                        "duration_s": call.duration_s,
                        "requested_at": call.requested_at.astimezone(settings.timezone).isoformat(),
                        "provider_session_id": call.id
                        if ai_runtime and call.id in ai_runtime.calls
                        else None,
                        "ws_path": f"/ws/call?session={call.id}"
                        if ai_runtime and call.id in ai_runtime.calls
                        else None,
                        "runtime_status": ai_runtime.calls[call.id].status
                        if ai_runtime and call.id in ai_runtime.calls
                        else None,
                    }
                    for call in calls
                ],
                provider_requests=[
                    {
                        "id": task.id,
                        "kind": task.kind,
                        "mode": task.mode,
                        "status": task.status,
                        "context_version": task.context_version,
                        "result": task.result,
                    }
                    for task in provider_requests
                ],
                rescue_cases=[case_view(case, settings) for case in rescue_cases],
                rescue_messages=[
                    {
                        "id": message.id,
                        "case_id": message.rescue_case_id,
                        "kind": message.kind,
                        "text": message.text,
                        "status": message.status,
                        "data_source": message.data_source,
                        "created_at": message.created_at.astimezone(settings.timezone).isoformat(),
                        "sent_at": message.sent_at.astimezone(settings.timezone).isoformat()
                        if message.sent_at
                        else None,
                    }
                    for message in rescue_messages
                ],
                slots_offered=[
                    {
                        "id": window.window_id,
                        "from": f"{window.starts_at:%H:%M}",
                        "to": f"{window.ends_at:%H:%M}",
                        "label": window.label,
                    }
                    for window in windows
                ],
                events=[
                    AuditView(
                        id=event.id,
                        at=event.at.astimezone(settings.timezone),
                        actor=event.actor,
                        type=event.type,
                        payload=event.payload,
                        version=event.version,
                        data_source=event.data_source,
                    )
                    for event in events
                ],
                data_source=source or "unseeded",
                availability={
                    "id": question.id,
                    "generation_id": question.generation_id,
                    "service_date": question.service_date.isoformat(),
                    "cutoff_at": question.cutoff_at.astimezone(settings.timezone).isoformat(),
                    "asked_at": question.asked_at.astimezone(settings.timezone).isoformat()
                    if question.asked_at
                    else None,
                    "question_status": question.question_status,
                    "answer_type": question.answer_type,
                    "windows": question.windows,
                    "offered_windows": question.offered_windows,
                    "reason": question.reason,
                    "available_date": question.available_date.isoformat()
                    if question.available_date
                    else None,
                }
                if question
                else None,
                messages=[
                    MessageView.model_validate(message, from_attributes=True).model_copy(
                        update={
                            "created_at": message.created_at.astimezone(settings.timezone),
                            "sent_at": message.sent_at.astimezone(settings.timezone)
                            if message.sent_at
                            else None,
                        }
                    )
                    for message in messages
                ],
            )

    @app.post("/jobs/morning-load")
    async def morning_load(body: MorningJobRequest, request: Request):
        service: MorningService = request.app.state.morning
        result = await service.load(body)
        result["dispatch"] = await service.dispatch(body.generation_id)
        return result

    @app.post("/jobs/messages/dispatch")
    async def dispatch_messages(body: DispatchRequest, request: Request):
        return await request.app.state.morning.dispatch(
            body.generation_id, limit=body.limit, tracking_id=body.tracking_id
        )

    @app.post("/jobs/route-cutoff")
    async def route_cutoff(body: MorningJobRequest, request: Request):
        return await request.app.state.morning.cutoff(body)

    @app.post("/webhooks/chat")
    async def morning_reply(body: MorningReplyRequest | RescueReply, request: Request):
        if isinstance(body, RescueReply):
            return await request.app.state.workflow.receive_reply(
                # Resolve the target from the authoritative case.
                await rescue_tracking_id(request, body.rescue_case_id),
                body,
            )
        service: MorningService = request.app.state.morning
        result = await service.reply(body)
        await service.dispatch(body.generation_id, tracking_id=body.tracking_id)
        return result

    return app


async def rescue_tracking_id(request, case_id):
    async with request.app.state.database.sessions() as session:
        case = await session.get(RescueCase, case_id)
        if case is None:
            raise WorkflowError("not_found", "Case not found", 404)
        return case.tracking_id
