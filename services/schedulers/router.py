"""Schedulers — job definitions and queue stubs."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish

router = APIRouter(prefix="/api/schedulers", tags=["schedulers"])
_JOBS = MemoryStore()


class JobCreate(BaseModel):
    name: str = Field(min_length=1)
    module: str = Field(min_length=1)
    cron: str = "0 * * * *"
    enabled: bool = True
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "schedulers", "status": "ok"}


@router.get("/jobs")
def list_jobs(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _JOBS.list(include_deleted=include_deleted)


@router.post("/jobs", status_code=201)
def create_job(body: JobCreate) -> dict[str, Any]:
    row = _JOBS.create({**body.model_dump(), "status": "queued"})
    publish(
        "SchedulerJobQueued",
        {"job_id": row["id"], "name": body.name, "module": body.module, "cron": body.cron},
    )
    return row


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    return _JOBS.get(job_id)


@router.post("/jobs/{job_id}/run")
def run_job(job_id: str) -> dict[str, Any]:
    row = _JOBS.update(job_id, {"status": "running"})
    row = _JOBS.update(job_id, {"status": "completed"})
    return row


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, Any]:
    return _JOBS.soft_delete(job_id)
