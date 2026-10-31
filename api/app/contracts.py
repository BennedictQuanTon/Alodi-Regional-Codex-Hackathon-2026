"""Strict application contracts. Provider implementations belong to Part 2."""

from datetime import date, time
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Confidence = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, populate_by_name=True)


class TimeWindow(StrictModel):
    date: date
    starts_at: time = Field(alias="from")
    ends_at: time = Field(alias="to")
    confidence: Confidence

    @model_validator(mode="after")
    def local_ordered_times(self):
        if self.starts_at.tzinfo or self.ends_at.tzinfo or self.starts_at >= self.ends_at:
            raise ValueError("Window must use ordered local times")
        return self


class DropLocation(StrictModel):
    type: Literal["hand_to_buyer", "security_desk", "reception", "neighbour", "locker", "other"]
    note: str = Field(min_length=1, max_length=500)
    confidence: Confidence


class AltReceiver(StrictModel):
    relation: str = Field(min_length=1, max_length=100)
    phone_masked: str = Field(max_length=100)
    confidence: Confidence

    @model_validator(mode="after")
    def masked_phone(self):
        digits = "".join(character for character in self.phone_masked if character.isdigit())
        if len(digits) >= 8:
            raise ValueError("Alternate receiver phone must be masked")
        return self


class AddressCorrection(StrictModel):
    text: str = Field(min_length=1, max_length=500)
    same_district: bool
    confidence: Confidence
    ward: str | None = Field(default=None, max_length=100)


class CannotReceive(StrictModel):
    reason: str = Field(min_length=1, max_length=1000)


class Extraction(StrictModel):
    time_window: TimeWindow | None
    drop_location: DropLocation | None
    alt_receiver: AltReceiver | None
    address_correction: AddressCorrection | None
    cannot_receive: CannotReceive | None
    opt_out: bool


class Command(StrictModel):
    generation_id: str = Field(min_length=1, max_length=64)
    context_version: int = Field(ge=0)
    idempotency_key: str = Field(min_length=1, max_length=128)


class CourierAction(Command):
    button: Literal["A", "B", "C", "DELIVERED"]
    by: str = Field(default="courier", min_length=1, max_length=100)


class UndoAction(Command):
    by: str = Field(default="courier", min_length=1, max_length=100)


class CSDecision(Command):
    action: Literal["claim", "apply", "approve_label", "reject_label", "return"]
    by: str = Field(pattern=r"^cs:\S.*", max_length=100)
    appointment: Extraction | None = None
    label: Literal["suspected bomb", "undeliverable"] | None = None

    @model_validator(mode="after")
    def action_fields(self):
        if (self.action == "apply") != (self.appointment is not None):
            raise ValueError("An appointment is required only for apply")
        if (self.action in {"approve_label", "reject_label"}) != (self.label is not None):
            raise ValueError("A label is required only for a label decision")
        return self
