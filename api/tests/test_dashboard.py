"""Actual backend counts, coherent read-only polling, and persisted rescue results."""

from types import SimpleNamespace

from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from test_integration import connected, integrated, proposal, trigger  # noqa: F401

from app.dashboard import dashboard_view
from app.db.models import DemoState, Order
from app.main import create_app


async def test_full_dashboard_counts_seeded_4000_without_writes_or_fixture_success(settings):
    app = create_app(settings, start_scheduler=False)
    async with app.router.lifespan_context(app):
        async with app.state.database.sessions() as session:
            before = await session.get(DemoState, 1)
            checkpoint = (before.generation_id, before.business_time, before.clock_revision)
        statements = []

        def capture(connection, cursor, statement, parameters, context, many):
            statements.append(statement.lstrip().split()[0].upper())

        event.listen(app.state.database.engine.sync_engine, "before_cursor_execute", capture)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.get("/demo/dashboard")
        event.remove(app.state.database.engine.sync_engine, "before_cursor_execute", capture)
        assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
        view = response.json()
        assert view["day"]["orders"] == 4000
        assert len(view["routes"]) == 20 and sum(row["orders"] for row in view["routes"]) == 4000
        assert view["day"]["attempted_today"] == 0
        assert view["day"]["rescheduled_with_card"] == 0
        assert view["day"]["calls_placed"] == 0
        assert view["cases"] == [] and view["cs_queue"] == []
        assert view["day"]["memo_seconds"] is None
        assert view["selected_order"]["context_card"] is None
        assert view["data_source"] == "synthetic" and "buyer_phone" not in response.text
        assert len(statements) <= 20 and set(statements) <= {"BEGIN", "SELECT"}
        async with app.state.database.sessions() as session:
            after = await session.get(DemoState, 1)
            assert checkpoint == (after.generation_id, after.business_time, after.clock_revision)


def dashboard_app(env):
    return SimpleNamespace(
        state=SimpleNamespace(
            settings=env.flow.settings,
            database=env.database,
            morning=env.flow.morning,
        )
    )


async def test_dashboard_tracks_actual_ring_and_confirmed_result(integrated):  # noqa: F811
    env = integrated
    call = await connected(env)
    view = await dashboard_view(dashboard_app(env))
    assert view["day"]["orders"] == 2
    assert view["day"]["attempted_today"] == 1
    assert view["day"]["failed_first_attempt"] == {"A": 1, "B": 0, "C": 0, "total": 1}
    assert view["day"]["flow_a"]["chat_sent"] == 1
    assert view["day"]["flow_a"]["call_1"] == 1
    assert view["day"]["flow_a"]["call_1_answered"] == 1
    assert view["selected_order"]["context_card"] is None
    assert view["selected_order"]["calls"][0]["id"] == call.id
    assert (
        await env.bridge.submit(call.snapshot, proposal(), "ai_call", True, 1, "confirmed")
        == "applied"
    )
    applied = await dashboard_view(dashboard_app(env))
    assert applied["day"]["rescheduled_with_card"] == 1
    assert applied["day"]["extraction"]["auto_applied"] == 1
    assert applied["routes"][0]["rescued"] == 1
    assert applied["selected_order"]["status"] == "moved"
    assert applied["selected_order"]["context_card"]["source"] == "ai_call"
    assert applied["selected_order"]["context_card"]["notes"] == proposal().delivery_notes
    assert applied["cases"][0]["state"] == "rescheduled"


async def test_dashboard_cs_queue_and_policy_violations_are_observed(integrated):  # noqa: F811
    env = integrated
    await trigger(env, "C")
    view = await dashboard_view(dashboard_app(env))
    assert view["day"]["cs_queue"]["refused"] == 1
    assert view["cs_queue"][0]["reason"] == "Refused at door"
    assert view["cs_queue"][0]["tap"] == "Refused"
    async with env.database.sessions.begin() as session:
        order = await session.get(Order, "SPXVN0123459012")
        order.status = "labelled"
    assert (await dashboard_view(dashboard_app(env)))["policy_guard"]["labels_without_human"] == 1
