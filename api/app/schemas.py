from datetime import date, datetime
from typing import Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    window_note: str | None = None
    original_delivery_date: date | None = None


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
    availability: dict[str, Any] | None = None
    messages: list["MessageView"] = Field(default_factory=list)
    pending_event: dict[str, Any] | None = None
    context_card: dict[str, Any] | None = None
    rescue_cases: list[dict[str, Any]] = Field(default_factory=list)
    rescue_messages: list[dict[str, Any]] = Field(default_factory=list)
    calls: list[dict[str, Any]] = Field(default_factory=list)
    provider_requests: list[dict[str, Any]] = Field(default_factory=list)
    action_guard: dict[str, Any] = Field(default_factory=dict)
    reset_job: dict[str, Any] | None = None


class MessageView(BaseModel):
    id: str
    question_id: int
    kind: str
    template_key: str
    text: str
    quick_replies: list[dict[str, str]]
    status: str
    created_at: datetime
    sent_at: datetime | None
    cancellation_reason: str | None
    context_version: int
    channel: str
    data_source: str


class MorningJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    generation_id: str = Field(min_length=1, max_length=64)
    hub_id: str | None = Field(default=None, min_length=1, max_length=64)
    service_date: date | None = None


class DispatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    generation_id: str = Field(min_length=1, max_length=64)
    limit: int = Field(default=4000, ge=1, le=4000)
    tracking_id: str | None = Field(default=None, min_length=1, max_length=64)


class MorningReplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    generation_id: str = Field(min_length=1, max_length=64)
    tracking_id: str = Field(min_length=1, max_length=64)
    question_id: int = Field(gt=0)
    context_version: int = Field(ge=0)
    idempotency_key: str = Field(min_length=1, max_length=128)
    answer_type: Literal["windows", "cannot_today", "opt_out"] | None = None
    windows: list[str] = Field(default_factory=list, max_length=4)
    reason: str | None = Field(default=None, max_length=1000)
    available_date: date | None = None
    text: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def valid_answer(self) -> Self:
        if self.text and self.text.casefold() == "stop":
            self.answer_type = "opt_out"
        if self.answer_type is None:
            raise ValueError(
                "Use a structured morning reply; free-text extraction belongs to Part 2"
            )
        if self.answer_type == "windows":
            if not self.windows or len(set(self.windows)) != len(self.windows):
                raise ValueError("Choose distinct offered windows")
            if self.reason or self.available_date or self.text:
                raise ValueError("Window selection cannot include a reason, date or free text")
        elif self.answer_type == "cannot_today":
            if not self.reason or self.windows or self.text:
                raise ValueError("Cannot receive today requires a reason and no window selection")
        elif self.windows or self.reason or self.available_date:
            raise ValueError("Opt-out cannot include appointment fields")
        return self
