from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Window(Strict):
    date: date
    from_: time = Field(alias="from")
    to: time
    confidence: float = Field(ge=0, le=1)

    @field_serializer("from_", "to", when_used="json")
    def serialize_time(self, value):
        return value.strftime("%H:%M")

    @model_validator(mode="after")
    def ordered(self):
        if self.from_ >= self.to:
            raise ValueError("window must end after it starts")
        return self


class Drop(Strict):
    type: Literal[
        "hand_to_buyer", "security_desk", "reception", "neighbour", "locker", "other"
    ]
    note: str
    confidence: float = Field(ge=0, le=1)


class Receiver(Strict):
    relation: str
    phone_masked: str
    confidence: float = Field(ge=0, le=1)


class Address(Strict):
    text: str
    same_district: bool
    confidence: float = Field(ge=0, le=1)


class CannotReceive(Strict):
    reason: str


class DeliveryContext(Strict):
    time_window: Window | None
    drop_location: Drop | None
    alt_receiver: Receiver | None
    address_correction: Address | None
    cannot_receive: CannotReceive | None
    delivery_notes: str | None = None
    opt_out: bool


def empty_context():
    return DeliveryContext(
        time_window=None,
        drop_location=None,
        alt_receiver=None,
        address_correction=None,
        cannot_receive=None,
        opt_out=False,
    )
