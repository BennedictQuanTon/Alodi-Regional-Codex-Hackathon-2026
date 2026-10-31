from contextlib import asynccontextmanager

from httpx import ASGITransport, AsyncClient
from test_morning import CANT, MAIN

from app.main import create_app
from app.morning import SimulatedChatChannel, WorkflowError


@asynccontextmanager
async def client_for(morning):
    app = create_app(morning.settings, clock=morning.clock)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield client, app


def reply_payload(detail, **overrides):
    return {
        "generation_id": detail["order"]["generation_id"],
        "tracking_id": detail["order"]["tracking_id"],
        "question_id": detail["availability"]["id"],
        "context_version": detail["order"]["context_version"],
        "idempotency_key": "callback-1",
        "answer_type": "windows",
        "windows": ["W3", "W4"],
        **overrides,
    }


async def test_api_morning_question_reply_route_notes_and_cutoff(morning):
    async with client_for(morning) as (client, app):
        health = (await client.get("/health")).json()
        assert health["generation_id"] == morning.generation
        body = {"generation_id": morning.generation}
        loaded = await client.post("/jobs/morning-load", json=body)
        assert loaded.status_code == 200 and loaded.json()["dispatch"]["sent"] == 2
        detail = (await client.get(f"/orders/{MAIN}")).json()
        assert detail["availability"]["question_status"] == "open"
        assert detail["messages"][0]["status"] == "sent"
        assert detail["messages"][0]["channel"] == "demo_chat"
        assert detail["messages"][0]["data_source"] == "synthetic"
        assert detail["messages"][0]["sent_at"].endswith("+07:00")
        request = reply_payload(detail)
        result = await client.post("/webhooks/chat", json=request)
        assert result.status_code == 200 and result.json()["status"] == "applied"
        assert (await client.post("/webhooks/chat", json=request)).json() == result.json()
        new_detail = (await client.get(f"/orders/{MAIN}")).json()
        assert new_detail["order"]["context_version"] == result.json()["context_version"]
        assert new_detail["order"]["window_note"] == "Prefers 14:00–17:00 or 17:00–20:00"
        assert all(message["status"] == "sent" for message in new_detail["messages"])
        assert not (await client.post("/jobs/morning-load", json=body)).json()["created"]
        morning.clock.set("08:00")
        cutoff = await client.post("/jobs/route-cutoff", json=body)
        assert cutoff.status_code == 200 and cutoff.json()["planned"] == 1
        assert (await client.get(f"/orders/{CANT}")).json()["availability"][
            "answer_type"
        ] == "no_reply"
        # An exact already-applied callback remains idempotent after cutoff.
        assert (await client.post("/webhooks/chat", json=request)).json() == result.json()


async def test_cannot_today_selected_monday_is_removed_from_today_route(morning):
    async with client_for(morning) as (client, _):
        await client.post("/jobs/morning-load", json={"generation_id": morning.generation})
        detail = (await client.get(f"/orders/{CANT}")).json()
        payload = reply_payload(
            detail,
            answer_type="cannot_today",
            windows=[],
            reason="Out of town until Monday",
            available_date="2026-11-02",
        )
        result = await client.post("/webhooks/chat", json=payload)
        assert result.status_code == 200 and result.json()["available_date"] == "2026-11-02"
        current = (
            await client.get("/orders", params={"route_id": "HCM-BTH-R07", "date": "2026-10-31"})
        ).json()
        assert [order["tracking_id"] for order in current["items"]] == [MAIN]
        moved = (await client.get(f"/orders/{CANT}")).json()
        assert moved["order"]["attempt_count"] == 0
        assert moved["availability"]["reason"] == "Out of town until Monday"
        morning.clock.set("08:00")
        await client.post("/jobs/route-cutoff", json={"generation_id": morning.generation})
        assert (await client.get(f"/orders/{CANT}")).json()["order"][
            "delivery_date"
        ] == "2026-11-02"


async def test_api_validation_stale_and_late_requests(morning):
    async with client_for(morning) as (client, _):
        body = {"generation_id": morning.generation}
        morning.clock.set("06:28")
        assert (await client.post("/jobs/morning-load", json=body)).json()[
            "code"
        ] == "morning_closed"
        morning.clock.set("06:30")
        assert (
            await client.post(
                "/jobs/morning-load", json={**body, "at": "2026-10-31T06:30:00+07:00"}
            )
        ).status_code == 422
        assert (
            await client.post("/jobs/morning-load", json={"generation_id": "old-generation"})
        ).status_code == 409
        await client.post("/jobs/morning-load", json=body)
        detail = (await client.get(f"/orders/{MAIN}")).json()
        request = reply_payload(detail)
        for changes in (
            {"windows": ["W5", "W4"]},
            {"windows": ["W4", "W4"]},
            {"answer_type": "cannot_today", "windows": [], "reason": " "},
        ):
            assert (
                await client.post("/webhooks/chat", json={**request, **changes})
            ).status_code == 422
        assert (await client.post("/webhooks/chat", json={**request, "context_version": 0})).json()[
            "code"
        ] == "rejected_stale"
        morning.clock.set("08:00")
        assert (await client.post("/webhooks/chat", json=request)).json()[
            "code"
        ] == "availability_closed"
        # A typed "stop" is accepted even when the client context is old.
        stop = reply_payload(detail, answer_type=None, windows=[], text="stop", context_version=0)
        assert (await client.post("/webhooks/chat", json=stop)).json()["opt_out"] is True


async def test_api_channel_failure_keeps_committed_queue_and_supports_retry(morning):
    class FailingChannel:
        def accept(self, message):
            raise WorkflowError("channel_unavailable", "Simulated delivery failure", 503)

    async with client_for(morning) as (client, app):
        app.state.morning.channel = FailingChannel()
        body = {"generation_id": morning.generation}
        failed = await client.post("/jobs/morning-load", json=body)
        assert failed.status_code == 503 and failed.json()["code"] == "channel_unavailable"
        detail = (await client.get(f"/orders/{MAIN}")).json()
        assert detail["messages"][0]["status"] == "queued"
        assert detail["availability"]["asked_at"] is None
        request = reply_payload(detail)
        assert (await client.post("/webhooks/chat", json=request)).json()[
            "code"
        ] == "question_not_sent"
        app.state.morning.channel = SimulatedChatChannel()
        sent = await client.post("/jobs/messages/dispatch", json=body)
        assert sent.status_code == 200 and sent.json()["sent"] == 2
        repeated = await client.post("/jobs/morning-load", json=body)
        assert repeated.json()["created"] is False and repeated.json()["dispatch"]["sent"] == 0
