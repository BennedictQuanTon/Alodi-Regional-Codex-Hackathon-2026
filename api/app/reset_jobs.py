"""One asynchronous, explicitly requested workflow reset per backend session."""

import asyncio
from datetime import UTC, datetime
from uuid import uuid4

from app.morning import WorkflowError


class ResetJobs:
    def __init__(self, demo):
        self.demo = demo
        self.jobs = {}
        self.task = None
        self.active = None
        self.lock = asyncio.Lock()

    @property
    def running(self):
        return self.task is not None and not self.task.done()

    async def start(self, generation):
        async with self.lock:
            if self.running:
                job = self.jobs[self.active]
                if generation == job["requested_generation_id"]:
                    return dict(job)
                current = await self.demo.read()
                if generation != current["generation_id"]:
                    raise WorkflowError(
                        "rejected_stale", "Workflow generation is no longer current"
                    )
                return dict(job)
            current = await self.demo.read()
            if generation != current["generation_id"]:
                raise WorkflowError("rejected_stale", "Workflow generation is no longer current")
            job_id = str(uuid4())
            job = {
                "job_id": job_id,
                "status": "processing",
                "stage": "queued",
                "message": "Reset queued for the shared demo.",
                "requested_generation_id": generation,
                "started_at": datetime.now(UTC).isoformat(),
            }
            self.jobs[job_id] = job
            self.active = job_id
            self.task = asyncio.create_task(self.run(job))
            while len(self.jobs) > 20:
                self.jobs.pop(next(iter(self.jobs)))
            return dict(job)

    async def run(self, job):
        def progress(stage, message):
            job.update(stage=stage, message=message)

        try:
            result = await self.demo.reset(
                job["requested_generation_id"],
                "A_main",
                prepare=True,
                progress=progress,
            )
            job.update(
                status="completed",
                stage="ready",
                message="Ready at 10:00 with the business clock paused.",
                generation_id=result["generation_id"],
                clock=result["clock"],
            )
        except asyncio.CancelledError:
            job.update(
                status="cancelled",
                stage="cancelled",
                message="Reset interrupted by backend shutdown. Refresh before retrying.",
            )
            raise
        except Exception as error:
            job.update(
                status="failed",
                stage="failed",
                error=error.code if isinstance(error, WorkflowError) else "reset_failed",
                message="Reset could not finish. Refresh the workflow before retrying.",
            )
        finally:
            job["finished_at"] = datetime.now(UTC).isoformat()

    def get(self, job_id):
        if job_id not in self.jobs:
            raise WorkflowError("not_found", "Reset job not found", 404)
        return dict(self.jobs[job_id])

    async def shutdown(self):
        if self.running:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
