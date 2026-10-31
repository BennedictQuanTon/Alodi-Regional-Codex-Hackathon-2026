from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class OrderView(BaseModel):
    tracking_id: str
    buyer_name: str
    buyer_phone_masked: str
    address: str
    district: str
    item: str
    cod_amount: int
    route_id: str
    stop_index: int
    risk_flags: list[str]
    delivery_date: date
    attempt_count: int
    status: str
    context_version: int
    generation_id: str


class OrderPage(BaseModel):
    items: list[OrderView]
    total: int
    limit: int
    offset: int
    data_source: str


class AuditView(BaseModel):
    id: int
    at: datetime
    actor: str
    type: str
    payload: dict[str, Any]
    version: int
    data_source: str


class OrderDetail(BaseModel):
    order: OrderView
    context: dict[str, Any]
    slots_offered: list[dict[str, str]]
    events: list[AuditView]
    data_source: str
