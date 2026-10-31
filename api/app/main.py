"""Local read APIs and the simulated morning availability workflow."""

from contextlib import asynccontextmanager
from datetime import date as Date
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

from app.clock import BusinessClock
from app.db.migrate import upgrade_database
from app.db.models import (
    AvailabilityReply,
    Courier,
    DemoState,
    Event,
    Hub,
    Message,
    Order,
    RouteWindow,
    ScenarioFixture,
)
from app.db.seed import load_seed_pack, seed_database
from app.db.session import Database
from app.morning import MorningService, WorkflowError, window_note
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
        window_note=window_note(order),
    )


def create_app(settings: Settings | None = None, *, clock: BusinessClock | None = None) -> FastAPI:
    settings = settings or load_settings()
    if settings.effective_ai_mode == "live":
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
            async with database.sessions() as session:
                state = await session.get(DemoState, 1)
                if state:
                    app.state.morning.clock.now(state)
            yield
        finally:
            await database.close()

    app = FastAPI(title="Alodi local API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings

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
            "implementation_stage": "morning_availability",
            "app_env": settings.app_env,
            "ai_mode": settings.effective_ai_mode,
            "ai_adapters_ready": False,
            "provider_calls_enabled": False,
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
            return OrderDetail(
                order=order_view(order),
                context=order.context,
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
    async def morning_reply(body: MorningReplyRequest, request: Request):
        service: MorningService = request.app.state.morning
        result = await service.reply(body)
        await service.dispatch(body.generation_id, tracking_id=body.tracking_id)
        return result

    return app
