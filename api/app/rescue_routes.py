"""Shared service routes; Part 2 can register its actual memo/voice APIRouter."""

from fastapi import APIRouter, Request

from app.contracts import (
    CallReport,
    ClockChange,
    FixtureMemo,
    GenerationRequest,
    ModeChange,
    Proposal,
    ScenarioReset,
)
from app.morning import WorkflowError


def rescue_router(*, fixture_memo=True):
    router = APIRouter()

    @router.post("/webhooks/call")
    async def call_event(body: CallReport, request: Request):
        return await request.app.state.workflow.call_event(body)

    @router.post("/internal/part2/results")
    async def proposal(body: Proposal, request: Request):
        return await request.app.state.workflow.apply_proposal(body)

    @router.post("/jobs/run-due")
    async def run_due(body: GenerationRequest, request: Request):
        return await request.app.state.scheduler.tick(body.generation_id)

    @router.get("/demo/clock")
    async def clock(request: Request):
        return await request.app.state.demo.read()

    @router.post("/demo/clock")
    async def change_clock(body: ClockChange, request: Request):
        return await request.app.state.demo.change_clock(body)

    @router.post("/demo/mode")
    async def mode(body: ModeChange, request: Request):
        return await request.app.state.demo.mode(body)

    @router.post("/demo/scenario")
    async def scenario(body: ScenarioReset, request: Request):
        return await request.app.state.demo.reset(body.generation_id, body.scenario)

    if fixture_memo:

        @router.post("/orders/{tracking_id}/memo")
        async def memo(tracking_id: str, body: FixtureMemo, request: Request):
            return await request.app.state.workflow.attach_fixture_memo(tracking_id, body)

        @router.post("/voice/sessions")
        async def voice_unavailable(request: Request):
            raise WorkflowError(
                "part2_unavailable", "Register Part 2's Realtime voice-session router", 503
            )

    return router
