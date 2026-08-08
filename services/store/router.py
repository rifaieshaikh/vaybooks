"""Store time-log / activities API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish

router = APIRouter(prefix="/api/store", tags=["store"])
_ENTRIES = MemoryStore()
_ACTIVITIES = MemoryStore()


class TimeEntryCreate(BaseModel):
    worker_id: str = Field(min_length=1)
    activity_id: str = Field(min_length=1)
    hours: float = Field(gt=0)
    tenant_id: str = "default"
    notes: str = ""


class ActivityCreate(BaseModel):
    name: str = Field(min_length=1)
    default_rate: float = 0.0
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "store", "status": "ok"}


@router.get("/activities")
def list_activities(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ACTIVITIES.list(include_deleted=include_deleted)


@router.post("/activities", status_code=201)
def create_activity(body: ActivityCreate) -> dict[str, Any]:
    return _ACTIVITIES.create(body.model_dump())


@router.get("/time-entries")
def list_time_entries(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ENTRIES.list(include_deleted=include_deleted)


@router.post("/time-entries", status_code=201)
def create_time_entry(body: TimeEntryCreate) -> dict[str, Any]:
    row = _ENTRIES.create(body.model_dump())
    publish(
        "StoreTimeLogged",
        {
            "entry_id": row["id"],
            "worker_id": body.worker_id,
            "activity_id": body.activity_id,
            "hours": body.hours,
        },
    )
    return row


@router.get("/time-entries/{entry_id}")
def get_time_entry(entry_id: str) -> dict[str, Any]:
    return _ENTRIES.get(entry_id)


@router.delete("/time-entries/{entry_id}")
def delete_time_entry(entry_id: str) -> dict[str, Any]:
    return _ENTRIES.soft_delete(entry_id)
