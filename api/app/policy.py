"""Deterministic rules shared by scheduler, CS and Part 2 proposal application."""

from datetime import datetime, timedelta

from app.contracts import Extraction
from app.db.models import Order, RouteWindow
from app.settings import Settings


def deadline(order: Order, settings: Settings):
    if order.original_delivery_date is None:
        return None
    return order.original_delivery_date + timedelta(days=settings.reschedule_horizon_days)


def appointment_policy(
    order: Order,
    fields: Extraction,
    windows: list[RouteWindow],
    wards: list[str],
    now: datetime,
    settings: Settings,
    *,
    human=False,
    conflicts=(),
) -> tuple[str, str]:
    if fields.opt_out:
        return "blocked_by_policy", "opt_out"
    if order.opt_out or order.context.get("consent", {}).get("opt_out"):
        return "blocked_by_policy", "opt_out"
    if order.attempt_count >= 1 + settings.max_redeliveries:
        return "blocked_by_policy", "redelivery_limit"
    if conflicts:
        return "needs_clarification", "conflicting_fields"
    if fields.cannot_receive:
        return "needs_clarification", "cannot_receive"
    if fields.address_correction:
        address = fields.address_correction
        if not address.same_district or address.ward not in wards:
            return "blocked_by_policy", "address_out_of_area"
    if not fields.time_window or not fields.drop_location:
        return "needs_clarification", "missing_required_fields"
    window = fields.time_window
    limit = deadline(order, settings)
    local = now.astimezone(settings.timezone)
    if limit is None or not local.date() <= window.date <= limit:
        return "blocked_by_policy", "invalid_date"
    if window.date == local.date() and window.ends_at <= local.time().replace(tzinfo=None):
        return "blocked_by_policy", "expired_window"
    merged = []
    for offered in sorted(windows, key=lambda item: item.starts_at):
        if merged and offered.starts_at <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], offered.ends_at))
        else:
            merged.append((offered.starts_at, offered.ends_at))
    if not any(start <= window.starts_at < window.ends_at <= end for start, end in merged):
        return "blocked_by_policy", "invalid_window"
    if not human and any(
        field is not None and field.confidence < settings.auto_apply_confidence
        for field in (
            fields.time_window,
            fields.drop_location,
            fields.alt_receiver,
            fields.address_correction,
        )
    ):
        return "needs_clarification", "low_confidence"
    return "applied", "eligible"


def call_time(due: datetime, order: Order, settings: Settings) -> datetime | None:
    local = due.astimezone(settings.timezone)
    start = datetime.combine(local.date(), settings.call_window_start, settings.timezone)
    end = datetime.combine(local.date(), settings.call_window_end, settings.timezone)
    if local < start:
        local = start
    elif local > end:
        local = start + timedelta(days=1)
    limit = deadline(order, settings)
    return local if limit is not None and local.date() <= limit else None
