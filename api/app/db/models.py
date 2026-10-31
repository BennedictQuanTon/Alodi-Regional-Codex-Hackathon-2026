"""PRD §12 tables and the metadata required to seed and isolate demo generations."""

from datetime import UTC, date, datetime, time
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator[datetime]):
    """SQLite has no timezone-aware type: store UTC, restore an aware datetime."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Timestamps must include a timezone")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None else None


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class Hub(Base):
    __tablename__ = "hubs"

    hub_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String)
    service_area_wards: Mapped[list[str]] = mapped_column(JSON)
    delivery_date: Mapped[date] = mapped_column(Date)
    data_source: Mapped[str] = mapped_column(String, default="synthetic")


class Courier(Base):
    __tablename__ = "couriers"

    courier_id: Mapped[str] = mapped_column(String, primary_key=True)
    hub_id: Mapped[str] = mapped_column(ForeignKey("hubs.hub_id"))
    name: Mapped[str] = mapped_column(String)
    route_id: Mapped[str] = mapped_column(String, unique=True)
    ward: Mapped[str] = mapped_column(String)


class RouteWindow(Base):
    __tablename__ = "route_windows"
    __table_args__ = (CheckConstraint("starts_at < ends_at", name="window_order"),)

    route_id: Mapped[str] = mapped_column(ForeignKey("couriers.route_id"), primary_key=True)
    window_id: Mapped[str] = mapped_column(String, primary_key=True)
    starts_at: Mapped[time] = mapped_column(Time)
    ends_at: Mapped[time] = mapped_column(Time)
    label: Mapped[str] = mapped_column(String)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("cod_amount >= 0", name="nonnegative_cod"),
        CheckConstraint("stop_index > 0", name="positive_stop"),
        CheckConstraint("attempt_count BETWEEN 0 AND 3", name="attempt_count"),
        CheckConstraint("context_version >= 0", name="context_version"),
        CheckConstraint(
            "status IN ('scheduled','out_for_delivery','delivered','moved','with_cs','labelled')",
            name="status",
        ),
        Index("ix_orders_route_date_stop", "route_id", "delivery_date", "stop_index"),
    )

    tracking_id: Mapped[str] = mapped_column(String, primary_key=True)
    buyer_name: Mapped[str] = mapped_column(String)
    # The demo seed accepts only TEST-* tokens. Real contact encryption is a later integration.
    buyer_phone: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(Text)
    district: Mapped[str] = mapped_column(String)
    item: Mapped[str] = mapped_column(String)
    cod_amount: Mapped[int] = mapped_column(Integer)
    route_id: Mapped[str] = mapped_column(ForeignKey("couriers.route_id"))
    stop_index: Mapped[int] = mapped_column(Integer)
    risk_flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    delivery_date: Mapped[date] = mapped_column(Date)
    # Completed delivery attempts only. Creating an appointment never increments this counter.
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="scheduled")
    context_version: Mapped[int] = mapped_column(Integer, default=0)
    context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    opt_out: Mapped[bool] = mapped_column(Boolean, default=False)
    generation_id: Mapped[str] = mapped_column(String)


class AvailabilityReply(Base):
    __tablename__ = "availability_reply"
    __table_args__ = (
        CheckConstraint(
            "answer_type IS NULL OR answer_type IN ('windows','cannot_today','no_reply')",
            name="answer_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracking_id: Mapped[str] = mapped_column(ForeignKey("orders.tracking_id"), index=True)
    asked_at: Mapped[datetime] = mapped_column(UTCDateTime)
    slots_offered: Mapped[list[str]] = mapped_column(JSON)
    answer_type: Mapped[str | None] = mapped_column(String)
    windows: Mapped[list[str]] = mapped_column(JSON, default=list)
    reason: Mapped[str | None] = mapped_column(Text)
    answered_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    channel: Mapped[str] = mapped_column(String)


class ShipperEvent(Base):
    __tablename__ = "shipper_event"
    __table_args__ = (
        CheckConstraint("button IN ('A','B','C','DELIVERED')", name="button"),
        CheckConstraint("status IN ('pending','committed','undone')", name="status"),
        UniqueConstraint("generation_id", "tracking_id", "idempotency_key"),
        Index(
            "uq_shipper_event_pending_order",
            "tracking_id",
            unique=True,
            sqlite_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracking_id: Mapped[str] = mapped_column(ForeignKey("orders.tracking_id"), index=True)
    button: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    status: Mapped[str] = mapped_column(String, default="pending")
    commit_at: Mapped[datetime] = mapped_column(UTCDateTime)
    memo_ref: Mapped[str | None] = mapped_column(String)
    idempotency_key: Mapped[str] = mapped_column(String)
    generation_id: Mapped[str] = mapped_column(String)


class RescueCase(Base):
    __tablename__ = "rescue_case"
    __table_args__ = (
        UniqueConstraint("tracking_id", "cycle"),
        CheckConstraint("cycle BETWEEN 1 AND 2", name="cycle"),
        CheckConstraint("trigger IN ('NO_ANSWER','RESCHEDULE','REFUSED')", name="trigger"),
        CheckConstraint("calls_made >= 0 AND calls_reserved >= 0", name="nonnegative_calls"),
        CheckConstraint("calls_made + calls_reserved <= 2", name="call_cap"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracking_id: Mapped[str] = mapped_column(ForeignKey("orders.tracking_id"), index=True)
    shipper_event_id: Mapped[int] = mapped_column(ForeignKey("shipper_event.id"), unique=True)
    trigger: Mapped[str] = mapped_column(String)
    cycle: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String, index=True)
    calls_made: Mapped[int] = mapped_column(Integer, default=0)
    calls_reserved: Mapped[int] = mapped_column(Integer, default=0)
    next_action_at: Mapped[datetime | None] = mapped_column(UTCDateTime, index=True)
    opt_out: Mapped[bool] = mapped_column(Boolean, default=False)
    recording_consent: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    generation_id: Mapped[str] = mapped_column(String)


class RescueResult(Base):
    __tablename__ = "rescue_result"
    __table_args__ = (
        CheckConstraint("source IN ('chat','ai_call','shipper_memo','cs')", name="source"),
        CheckConstraint(
            "decision IN ('auto_applied','needs_review','escalated_cs','cs_applied')",
            name="decision",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rescue_case_id: Mapped[int] = mapped_column(ForeignKey("rescue_case.id"), index=True)
    source: Mapped[str] = mapped_column(String)
    extracted: Mapped[dict[str, Any]] = mapped_column(JSON)
    confidence: Mapped[dict[str, Any]] = mapped_column(JSON)
    decision: Mapped[str] = mapped_column(String)
    card: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True))
    context_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("version >= 0", name="version"),
        CheckConstraint("data_source IN ('synthetic','live','replay')", name="data_source"),
        Index("ix_events_order_at", "tracking_id", "at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NULL denotes a hub/system event; never use a fictional '*' order FK.
    tracking_id: Mapped[str | None] = mapped_column(ForeignKey("orders.tracking_id"))
    at: Mapped[datetime] = mapped_column(UTCDateTime)
    actor: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer)
    generation_id: Mapped[str] = mapped_column(String)
    data_source: Mapped[str] = mapped_column(String)


class OrderContextRevision(Base):
    __tablename__ = "order_context_revisions"
    __table_args__ = (CheckConstraint("version >= 0", name="version"),)

    tracking_id: Mapped[str] = mapped_column(ForeignKey("orders.tracking_id"), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    context: Mapped[dict[str, Any]] = mapped_column(JSON)
    actor: Mapped[str] = mapped_column(String)
    at: Mapped[datetime] = mapped_column(UTCDateTime)
    generation_id: Mapped[str] = mapped_column(String)


class Recording(Base):
    __tablename__ = "recordings"
    __table_args__ = (
        CheckConstraint("kind IN ('call','memo')", name="kind"),
        CheckConstraint("duration_s >= 0", name="duration"),
        CheckConstraint("expires_at >= created_at", name="expiry"),
        CheckConstraint("rescue_case_id IS NOT NULL OR shipper_event_id IS NOT NULL", name="owner"),
    )

    key: Mapped[str] = mapped_column(String, primary_key=True)
    # A B memo may be uploaded during undo, before a rescue case exists.
    rescue_case_id: Mapped[int | None] = mapped_column(ForeignKey("rescue_case.id"), index=True)
    shipper_event_id: Mapped[int | None] = mapped_column(ForeignKey("shipper_event.id"))
    kind: Mapped[str] = mapped_column(String)
    duration_s: Mapped[float] = mapped_column(Float)
    transcript_masked: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)


class IngressReceipt(Base):
    __tablename__ = "ingress_receipts"
    __table_args__ = (UniqueConstraint("generation_id", "source", "idempotency_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    generation_id: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)
    idempotency_key: Mapped[str] = mapped_column(String)
    received_at: Mapped[datetime] = mapped_column(UTCDateTime)
    response: Mapped[dict[str, Any] | None] = mapped_column(JSON(none_as_null=True))


class ScenarioFixture(Base):
    __tablename__ = "scenario_fixtures"

    scenario: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    tracking_id: Mapped[str] = mapped_column(ForeignKey("orders.tracking_id"), unique=True)
    steps: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    data_source: Mapped[str] = mapped_column(String, default="scripted_fixture")


class DemoState(Base):
    __tablename__ = "demo_state"
    __table_args__ = (CheckConstraint("id = 1", name="singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    generation_id: Mapped[str] = mapped_column(String, unique=True)
    scenario: Mapped[str] = mapped_column(String)
    clock_start: Mapped[datetime] = mapped_column(UTCDateTime)
    clock_speed: Mapped[float] = mapped_column(Float)
    seeded_at: Mapped[datetime] = mapped_column(UTCDateTime)
    pack_fingerprint: Mapped[str] = mapped_column(String)
