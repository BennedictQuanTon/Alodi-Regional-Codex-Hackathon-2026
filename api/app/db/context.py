"""Context persistence primitive. Workflow/policy services must authorize changes first."""

from copy import deepcopy
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DemoState, Event, Order, OrderContextRevision


class StaleContextError(RuntimeError):
    pass


async def record_context_change(
    session: AsyncSession,
    *,
    tracking_id: str,
    expected_version: int,
    expected_generation: str,
    context: dict[str, Any],
    actor: str,
    at: datetime,
    event_type: str,
    payload: dict[str, Any],
    data_source: Literal["synthetic", "live", "replay"],
) -> int:
    """Compare-and-swap context, revision and audit inside the caller's transaction.

    The generation check remains necessary even when a reset reuses version zero.
    No commit or broadcast occurs here. A caller must roll back on failure.
    """
    version = expected_version + 1
    snapshot = deepcopy(context)
    snapshot.update(tracking_id=tracking_id, version=version, updated_by=actor.split(":", 1)[0])
    result = await session.execute(
        update(Order)
        .where(
            Order.tracking_id == tracking_id,
            Order.context_version == expected_version,
            Order.generation_id == expected_generation,
            exists(select(DemoState.id).where(DemoState.generation_id == expected_generation)),
        )
        .values(context=snapshot, context_version=version)
        .execution_options(synchronize_session="fetch")
    )
    if result.rowcount != 1:
        raise StaleContextError("Order context version or generation is no longer current")
    session.add(
        OrderContextRevision(
            tracking_id=tracking_id,
            version=version,
            context=snapshot,
            actor=actor,
            at=at,
            generation_id=expected_generation,
        )
    )
    session.add(
        Event(
            tracking_id=tracking_id,
            version=version,
            actor=actor,
            at=at,
            type=event_type,
            payload=deepcopy(payload),
            generation_id=expected_generation,
            data_source=data_source,
        )
    )
    await session.flush()
    return version
