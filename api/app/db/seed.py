"""Validate the fictional PRD pack, then seed atomically without replaying its scripts."""

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, time
from pathlib import Path
from typing import Any, Self
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import delete, func, insert, select, update

from app.db.models import (
    Base,
    Courier,
    DemoState,
    Event,
    Hub,
    Order,
    OrderContextRevision,
    RouteWindow,
    ScenarioFixture,
)
from app.db.session import Database
from app.settings import SCENARIOS, Settings


class SeedError(RuntimeError):
    pass


class SeedRow(BaseModel):
    model_config = ConfigDict(extra="ignore", hide_input_in_errors=True)


class HubRow(SeedRow):
    hub_id: str
    name: str
    city: str
    service_area_wards: list[str]
    date: date
    couriers: int
    orders: int
    stops_per_route: int
    morning_run: time


class CourierRow(SeedRow):
    courier_id: str
    name: str
    route_id: str
    ward: str


class WindowRow(SeedRow):
    id: str
    starts_at: time = Field(alias="from")
    ends_at: time = Field(alias="to")
    label: str


class OrderRow(SeedRow):
    tracking_id: str
    buyer_name: str
    buyer_phone: str = Field(pattern=r"^TEST-\d{4}$")
    address: str
    district: str
    item: str
    cod_amount: int = Field(ge=0)
    route_id: str
    stop_index: int = Field(ge=1, le=200)
    risk_flags: list[str]
    delivery_date: date
    attempt_count: int = Field(ge=0, le=0)
    status: str = Field(pattern=r"^scheduled$")


class ScenarioRow(SeedRow):
    scenario: str
    title: str
    tracking_id: str
    steps: list[dict[str, Any]] = Field(min_length=1)


class SeedPack(BaseModel):
    hub: HubRow
    couriers: list[CourierRow]
    windows: list[WindowRow]
    orders: list[OrderRow]
    scenarios: list[ScenarioRow]
    fingerprint: str

    @model_validator(mode="after")
    def validate_pack(self) -> Self:
        if len(self.orders) != 4000 or self.hub.orders != 4000:
            raise SeedError("Mock pack must contain exactly 4,000 orders")
        if len(self.couriers) != 20 or self.hub.couriers != 20 or self.hub.stops_per_route != 200:
            raise SeedError("Mock pack must contain 20 couriers with 200 stops per route")
        route_ids = {courier.route_id for courier in self.couriers}
        if len(route_ids) != 20 or len({c.courier_id for c in self.couriers}) != 20:
            raise SeedError("Courier and route identifiers must be unique")
        if len(self.windows) != 4 or {w.id for w in self.windows} != {"W1", "W2", "W3", "W4"}:
            raise SeedError("Mock pack must contain four unique route windows W1-W4")
        ordered_windows = sorted(self.windows, key=lambda window: window.starts_at)
        for index, window in enumerate(ordered_windows):
            if (
                window.starts_at.tzinfo
                or window.ends_at.tzinfo
                or window.starts_at >= window.ends_at
                or (index > 0 and ordered_windows[index - 1].ends_at > window.starts_at)
            ):
                raise SeedError("Route windows must be valid, local and non-overlapping")
        by_id = {order.tracking_id: order for order in self.orders}
        if len(by_id) != 4000 or len({o.buyer_phone for o in self.orders}) != 4000:
            raise SeedError("Order identifiers and fictional phone tokens must be unique")
        stops: dict[str, list[int]] = defaultdict(list)
        for order in self.orders:
            if order.route_id not in route_ids:
                raise SeedError("Order references an unknown route")
            if order.delivery_date != self.hub.date:
                raise SeedError("Order dates must match the hub date")
            if order.district not in self.hub.service_area_wards:
                raise SeedError("Order ward is outside the fictional hub")
            stops[order.route_id].append(order.stop_index)
        if set(stops) != route_ids or any(
            sorted(indices) != list(range(1, 201)) for indices in stops.values()
        ):
            raise SeedError("Every route must have exactly stops 1-200, without duplicates")
        if len(self.scenarios) != 7 or {s.scenario for s in self.scenarios} != SCENARIOS:
            raise SeedError("Mock pack must contain the seven agreed scenarios")
        if len({scenario.tracking_id for scenario in self.scenarios}) != 7:
            raise SeedError("Each scenario must reference a different order")
        for scenario in self.scenarios:
            order = by_id.get(scenario.tracking_id)
            if order is None or order.route_id != "HCM-BTH-R07":
                raise SeedError("Each stage scenario must reference an existing order on R07")
        return self


PACK_FILES = {
    "hub": "hub.json",
    "couriers": "couriers.json",
    "windows": "windows.json",
    "orders": "orders.json",
    "scenarios": "demo-cases.json",
}


def load_seed_pack(directory: Path) -> SeedPack:
    content = {}
    fingerprint = hashlib.sha256()
    for key, filename in PACK_FILES.items():
        try:
            raw = (directory / filename).read_bytes()
            content[key] = json.loads(raw)
        except (OSError, ValueError):
            raise SeedError(f"Cannot read valid mock data: {filename}") from None
        fingerprint.update(filename.encode())
        fingerprint.update(raw)
    try:
        return SeedPack(**content, fingerprint=fingerprint.hexdigest())
    except (ValidationError, TypeError):
        raise SeedError("Mock pack does not match the required schema") from None


def initial_context(tracking_id: str, windows: list[WindowRow]) -> dict[str, Any]:
    return {
        "tracking_id": tracking_id,
        "version": 0,
        "trigger": "PRE_DELIVERY",
        "rescue_cycle": 0,
        "delivery_attempt": 0,
        "channel": None,
        "contact_log": [],
        "slots_offered": [f"{window.starts_at:%H:%M}/{window.ends_at:%H:%M}" for window in windows],
        "extracted": {
            "time_window": None,
            "drop_location": None,
            "alt_receiver": None,
            "address_correction": None,
        },
        "confidence": {},
        "decision": "pending",
        "consent": {"recording": None, "opt_out": False},
        "raw_ref": None,
        "updated_by": "system",
    }


@dataclass(frozen=True)
class SeedSummary:
    created: bool
    orders: int
    routes: int
    scenarios: int
    generation_id: str


async def seed_database(
    database: Database, settings: Settings, pack: SeedPack, *, reset: bool = False
) -> SeedSummary:
    if settings.app_env != "demo":
        raise SeedError("Synthetic seed and reset require APP_ENV=demo")
    if settings.demo_start.astimezone(settings.timezone).date() != pack.hub.date:
        raise SeedError("DEMO_START date must match the mock pack date")

    async with database.sessions.begin() as session:
        # Acquire SQLite's write reservation before inspecting seed state. Concurrent demo
        # startups then see the committed seed instead of racing to insert the same rows.
        await session.execute(update(DemoState).where(DemoState.id == 1).values(id=1))
        existing = await session.scalar(select(DemoState.generation_id).where(DemoState.id == 1))
        if existing is not None and not reset:
            return SeedSummary(
                created=False,
                orders=await session.scalar(select(func.count()).select_from(Order)),
                routes=await session.scalar(select(func.count()).select_from(Courier)),
                scenarios=await session.scalar(select(func.count()).select_from(ScenarioFixture)),
                generation_id=existing,
            )
        if not reset:
            for table in Base.metadata.sorted_tables:
                if await session.scalar(select(func.count()).select_from(table)):
                    raise SeedError("Database is not empty; refusing to replace existing data")
        else:
            # Explicit demo reset only; preserve migration history and never drop the schema.
            for table in reversed(Base.metadata.sorted_tables):
                await session.execute(delete(table))

        generation = str(uuid4())
        at = settings.demo_start
        await session.execute(
            insert(Hub),
            [
                {
                    "hub_id": pack.hub.hub_id,
                    "name": pack.hub.name,
                    "city": pack.hub.city,
                    "service_area_wards": pack.hub.service_area_wards,
                    "delivery_date": pack.hub.date,
                    "morning_run": pack.hub.morning_run,
                    "data_source": "synthetic",
                }
            ],
        )
        await session.execute(
            insert(Courier),
            [{**courier.model_dump(), "hub_id": pack.hub.hub_id} for courier in pack.couriers],
        )
        await session.execute(
            insert(RouteWindow),
            [
                {
                    "route_id": courier.route_id,
                    "window_id": window.id,
                    "starts_at": window.starts_at,
                    "ends_at": window.ends_at,
                    "label": window.label,
                }
                for courier in pack.couriers
                for window in pack.windows
            ],
        )
        orders = [
            {
                **order.model_dump(),
                "original_delivery_date": order.delivery_date,
                "context_version": 0,
                "context": initial_context(order.tracking_id, pack.windows),
                "generation_id": generation,
                "opt_out": False,
            }
            for order in pack.orders
        ]
        await session.execute(insert(Order), orders)
        await session.execute(
            insert(OrderContextRevision),
            [
                {
                    "tracking_id": order["tracking_id"],
                    "version": 0,
                    "context": order["context"],
                    "actor": "system",
                    "at": at,
                    "generation_id": generation,
                }
                for order in orders
            ],
        )
        await session.execute(
            insert(Event),
            [
                {
                    "tracking_id": order["tracking_id"],
                    "version": 0,
                    "actor": "system",
                    "at": at,
                    "type": "order_seeded",
                    "payload": {"simulated": True},
                    "generation_id": generation,
                    "data_source": "synthetic",
                }
                for order in orders
            ],
        )
        await session.execute(
            insert(ScenarioFixture),
            [
                {**scenario.model_dump(), "data_source": "scripted_fixture"}
                for scenario in pack.scenarios
            ],
        )
        session.add(
            DemoState(
                id=1,
                generation_id=generation,
                scenario=settings.demo_scenario,
                clock_start=at,
                business_time=at,
                clock_speed=settings.demo_clock_speed,
                seeded_at=at,
                pack_fingerprint=pack.fingerprint,
            )
        )
        session.add(
            Event(
                tracking_id=None,
                at=at,
                actor="system",
                type="seeded",
                version=0,
                payload={
                    "orders": len(orders),
                    "routes": len(pack.couriers),
                    "scenarios": len(pack.scenarios),
                    "simulated": True,
                    "pack_fingerprint": pack.fingerprint,
                },
                generation_id=generation,
                data_source="synthetic",
            )
        )
        return SeedSummary(True, len(orders), len(pack.couriers), len(pack.scenarios), generation)
