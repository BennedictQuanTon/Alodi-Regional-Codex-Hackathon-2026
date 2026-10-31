"""Shared service routes; Part 2 can register its actual memo/voice APIRouter."""

from fastapi import APIRouter, Query, Request

from app.contracts import (
    CallReport,
    ClockChange,
    FixtureMemo,
    GenerationRequest,
    ModeChange,
    Proposal,
    ScenarioReset,
)
from app.db.models import Order
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
        result = await request.app.state.demo.read()
        jobs = request.app.state.reset_jobs
        result["reset_job"] = jobs.get(jobs.active) if jobs.running else None
        return result

    @router.post("/demo/clock")
    async def change_clock(body: ClockChange, request: Request):
        return await request.app.state.demo.change_clock(body)

    @router.post("/demo/mode")
    async def mode(body: ModeChange, request: Request):
        return await request.app.state.demo.mode(body)

    @router.post("/demo/scenario")
    async def scenario(body: ScenarioReset, request: Request):
        return await request.app.state.demo.reset(body.generation_id, body.scenario)

    @router.post("/demo/workflow-reset", status_code=202)
    async def workflow_reset(body: GenerationRequest, request: Request):
        return await request.app.state.reset_jobs.start(body.generation_id)

    @router.get("/demo/workflow-reset/{job_id}")
    async def reset_status(job_id: str, request: Request):
        return request.app.state.reset_jobs.get(job_id)

    @router.get("/orders/{tracking_id}/live")
    async def live_events(
        tracking_id: str,
        request: Request,
        after_seq: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=200),
    ):
        async with request.app.state.database.sessions() as session:
            order = await session.get(Order, tracking_id)
            if order is None:
                raise WorkflowError("not_found", "Order not found", 404)
            generation = order.generation_id
        runtime = request.app.state.ai_runtime
        if runtime is None:
            return {
                "tracking_id": tracking_id,
                "generation_id": generation,
                "stream_id": None,
                "latest_seq": 0,
                "next_seq": after_seq,
                "has_more": False,
                "records": [],
                "truncated": False,
            }
        return runtime.observations.read(tracking_id, generation, after_seq, limit)

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
