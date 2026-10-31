"""Public, deterministic summaries of the authoritative courier action gates."""


def action_guard(order, cases, now, settings):
    local = now.astimezone(settings.timezone)
    pending = order.context.get("pending_event")
    active = [
        case for case in cases if not case.closed_at and case.generation_id == order.generation_id
    ]
    case = active[-1] if active else None
    reason = None
    if order.status in {"delivered", "labelled", "with_cs"}:
        reason = "This order is closed or needs customer service."
    elif order.delivery_date != local.date():
        reason = "This order is not on today's route."
    elif local.time().replace(tzinfo=None) < settings.route_cutoff:
        reason = "The delivery route has not started yet."
    elif order.attempt_count >= 1 + settings.max_redeliveries:
        reason = "No delivery attempts remain."
    elif pending:
        reason = "Commit or undo the pending outcome first."
    elif any(item.state not in {"rescheduled", "out_for_delivery"} for item in active):
        reason = "A rescue is already in progress for this order."
    actions = {
        "memo": "Record and upload the courier memo.",
        "call_1_due": "Advance to the next scheduled call.",
        "call_2_due": "Advance to the next scheduled call.",
        "calling": "Answer the issued call on the buyer screen.",
        "extracting": "Wait for the provider result.",
        "confirm_in_chat": "Confirm delivery details in chat.",
        "rescheduled": "Review the saved delivery context.",
        "with_cs": "Review the case with customer service.",
    }
    return {
        "can_tap": reason is None,
        "reason": reason,
        "next_action": "Commit or undo the pending outcome."
        if pending
        else actions.get(case.state if case else "", reason or "Record a delivery outcome."),
        "pending_commit_at": pending.get("commit_at") if pending else None,
        "next_action_at": case.next_action_at.astimezone(settings.timezone).isoformat()
        if case and case.next_action_at
        else None,
    }
