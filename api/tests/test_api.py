from contextlib import asynccontextmanager

from httpx import ASGITransport, AsyncClient

from app.main import create_app


@asynccontextmanager
async def app_client(settings):
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield client


async def test_health_and_seeded_route_are_available_without_keys(settings):
    async with app_client(settings) as client:
        health = await client.get("/health")
        assert health.status_code == 200
        status = health.json()
        assert status["counts"] == {"orders": 4000, "routes": 20, "scenario_fixtures": 7}
        assert status["ai_mode"] == "stub"
        assert status["data_source"] == "synthetic"
        assert status["provider_calls_enabled"] is False
        route = await client.get(
            "/orders", params={"route_id": "HCM-BTH-R07", "date": "2026-10-31"}
        )
        assert route.status_code == 200
        body = route.json()
        assert body["total"] == 200 and len(body["items"]) == 200
        assert [order["stop_index"] for order in body["items"]] == list(range(1, 201))
        assert "buyer_phone" not in body["items"][0]
        assert body["items"][0]["buyer_phone_masked"].startswith("TEST *** ")


async def test_order_detail_has_initial_context_windows_and_audit(settings):
    async with app_client(settings) as client:
        response = await client.get("/orders/SPXVN0123456789")
        assert response.status_code == 200
        body = response.json()
        assert body["order"]["buyer_name"] == "Minh Hoang"
        assert body["order"]["stop_index"] == 37
        assert body["context"]["version"] == 0
        assert body["context"]["extracted"]["time_window"] is None
        assert [window["id"] for window in body["slots_offered"]] == ["W1", "W2", "W3", "W4"]
        assert body["events"][0]["type"] == "order_seeded"
        assert body["events"][0]["at"] == "2026-10-31T06:28:00+07:00"
        assert body["events"][0]["data_source"] == "synthetic"
        assert (await client.get("/orders/missing")).status_code == 404


async def test_pagination_filters_and_validation(settings):
    async with app_client(settings) as client:
        page = (await client.get("/orders", params={"limit": 3, "offset": 2})).json()
        assert page["total"] == 4000
        assert [order["stop_index"] for order in page["items"]] == [3, 4, 5]
        assert (await client.get("/orders", params={"date": "2026-11-01"})).json()["total"] == 0
        assert (await client.get("/orders", params={"route_id": "missing"})).json()["items"] == []
        for query in ({"limit": 501}, {"offset": -1}, {"date": "invalid"}):
            assert (await client.get("/orders", params=query)).status_code == 422


async def test_cors_allows_only_configured_origin(settings):
    async with app_client(settings) as client:
        allowed = await client.options(
            "/orders",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == settings.web_origin
        denied = await client.get("/health", headers={"Origin": "http://untrusted.example"})
        assert "access-control-allow-origin" not in denied.headers


async def test_restart_keeps_generation_and_audit(settings):
    async with app_client(settings) as client:
        first = (await client.get("/orders/SPXVN0123456789")).json()
    async with app_client(settings) as client:
        second = (await client.get("/orders/SPXVN0123456789")).json()
    assert first == second


async def test_offline_mode_is_labelled_without_claiming_replay_is_implemented(settings):
    settings.ai_mode = "live"
    settings.offline_mode = True
    async with app_client(settings) as client:
        status = (await client.get("/health")).json()
        assert status["ai_mode"] == "replay"
        assert status["ai_adapters_ready"] is False
        assert status["provider_calls_enabled"] is False


async def test_non_demo_startup_does_not_insert_synthetic_data(settings):
    settings.app_env = "pilot"
    async with app_client(settings) as client:
        status = (await client.get("/health")).json()
        assert status["data_source"] == "unseeded"
        assert status["counts"] == {"orders": 0, "routes": 0, "scenario_fixtures": 0}
        assert (await client.get("/orders")).json()["items"] == []
