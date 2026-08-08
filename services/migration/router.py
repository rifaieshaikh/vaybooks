"""Data migration wizard API — queue import batches."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish

router = APIRouter(prefix="/api/migration", tags=["migration"])
_BATCHES = MemoryStore()


class MigrationBatchCreate(BaseModel):
    source: str = Field(min_length=1, description="csv|xlsx|json")
    entity: str = Field(min_length=1, description="customers|products|...")
    payload_ref: str = ""
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "migration", "status": "ok"}


@router.get("/batches")
def list_batches(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _BATCHES.list(include_deleted=include_deleted)


@router.post("/batches", status_code=201)
def create_batch(body: MigrationBatchCreate) -> dict[str, Any]:
    row = _BATCHES.create({**body.model_dump(), "status": "queued", "progress": 0})
    publish(
        "MigrationBatchQueued",
        {
            "batch_id": row["id"],
            "source": body.source,
            "entity": body.entity,
        },
    )
    return row


@router.get("/batches/{batch_id}")
def get_batch(batch_id: str) -> dict[str, Any]:
    return _BATCHES.get(batch_id)


@router.post("/batches/{batch_id}/run")
def run_batch(batch_id: str) -> dict[str, Any]:
    _BATCHES.update(batch_id, {"status": "running", "progress": 50})
    return _BATCHES.update(batch_id, {"status": "completed", "progress": 100})


@router.delete("/batches/{batch_id}")
def delete_batch(batch_id: str) -> dict[str, Any]:
    return _BATCHES.soft_delete(batch_id)
