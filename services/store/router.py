"""Store activities and business-task time entries API (Mongo)."""

from __future__ import annotations

from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.store_container import get_store_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.exceptions import DomainError, ValidationError

router = APIRouter(prefix="/api/store", tags=["store"])


class ActivityCreate(BaseModel):
    activity_name: str = ""
    name: str = ""  # legacy alias
    activity_category: str = "In House Service"
    default_hourly_expense: float = 0.0
    default_rate: float = 0.0  # legacy alias
    custom_statuses: Optional[List[str]] = None


class ActivityUpdate(BaseModel):
    activity_name: str = Field(min_length=1)
    activity_category: str = "In House Service"
    default_hourly_expense: float = 0.0
    is_active: bool = True
    custom_statuses: Optional[List[str]] = None


class TimeEntryCreate(BaseModel):
    activity_id: str = Field(min_length=1)
    worker_id: str = Field(min_length=1)
    work_date: str
    start_time: str = Field(min_length=1)
    end_time: str = Field(min_length=1)
    location_id: str = ""
    location_name: str = ""
    notes: str = ""
    ends_next_day: bool = False


class TimeEntryUpdate(BaseModel):
    work_date: str
    start_time: str = Field(min_length=1)
    end_time: str = Field(min_length=1)
    notes: str = ""
    ends_next_day: bool = False
    activity_id: Optional[str] = None
    worker_id: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None


class StatusBody(BaseModel):
    status: str = Field(min_length=1)


def _c():
    return get_store_container()


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, (ValidationError, DomainError)):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _activity_dict(activity: Any) -> dict[str, Any]:
    data = entity_dict(activity)
    cat = data.get("activity_category")
    data["activity_category"] = (
        cat.value if hasattr(cat, "value") else str(cat or "")
    )
    atype = data.get("activity_type")
    data["activity_type"] = (
        atype.value if hasattr(atype, "value") else (str(atype) if atype else None)
    )
    data["name"] = data.get("activity_name") or data.get("name") or ""
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("activity_name") or ""),
            str(data.get("activity_category") or ""),
        ]
        if b
    )
    return data


def _entry_dict(entry: Any) -> dict[str, Any]:
    data = entity_dict(entry)
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("worker_name") or ""),
            str(data.get("activity_name") or ""),
            str(data.get("work_date") or "")[:10],
            str(data.get("status") or ""),
        ]
        if b
    )
    return data


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "store", "status": "ok", "backend": _c().backend}


@router.get("/overview")
def overview() -> dict[str, Any]:
    try:
        activities = _c().activities.list_activities(active_only=True)
        entries = _c().time_tracking.list_all()
        open_tasks = [e for e in entries if str(getattr(e, "status", "")) != "Completed"]
        return {
            "active_activities": len(activities),
            "total_time_entries": len(entries),
            "open_tasks": len(open_tasks),
            "quick_actions": [
                {"to": "/store-time", "label": "Business Tasks"},
                {"to": "/settings/store-activities", "label": "Store Activities"},
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/activities")
def list_activities(*, active_only: bool = True) -> list[dict[str, Any]]:
    try:
        rows = _c().activities.list_activities(active_only=active_only)
        return [_activity_dict(r) for r in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities", status_code=201)
def create_activity(body: ActivityCreate) -> dict[str, Any]:
    name = (body.activity_name or body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="activity_name is required")
    expense = body.default_hourly_expense or body.default_rate or 0.0
    try:
        activity = _c().activities.create_activity(
            activity_name=name,
            activity_category=body.activity_category,
            default_hourly_expense=float(expense),
            custom_statuses=body.custom_statuses,
        )
        return _activity_dict(activity)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/activities/{activity_id}")
def get_activity(activity_id: str) -> dict[str, Any]:
    activity = _c().activities.get_activity(activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="activity not found")
    return _activity_dict(activity)


@router.patch("/activities/{activity_id}")
def update_activity(activity_id: str, body: ActivityUpdate) -> dict[str, Any]:
    try:
        activity = _c().activities.update_activity_details(
            activity_id,
            activity_name=body.activity_name,
            activity_category=body.activity_category,
            default_hourly_expense=body.default_hourly_expense,
            is_active=body.is_active,
            custom_statuses=body.custom_statuses,
        )
        return _activity_dict(activity)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities/{activity_id}/deactivate")
def deactivate_activity(activity_id: str) -> dict[str, Any]:
    try:
        return _activity_dict(_c().activities.deactivate_activity(activity_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/time-entries")
def list_time_entries(
    *,
    worker_name: str = "",
    activity_name: str = "",
    location_id: str = "",
    work_date_from: Optional[str] = None,
    work_date_to: Optional[str] = None,
) -> list[dict[str, Any]]:
    try:
        if any([worker_name, activity_name, location_id, work_date_from, work_date_to]):
            rows = _c().time_tracking.search_entries(
                worker_name=worker_name,
                activity_name=activity_name,
                location_id=location_id,
                work_date_from=_parse_date(work_date_from),
                work_date_to=_parse_date(work_date_to),
            )
        else:
            rows = _c().time_tracking.list_all()
        return [_entry_dict(r) for r in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/time-entries", status_code=201)
def create_time_entry(body: TimeEntryCreate) -> dict[str, Any]:
    work_date = _parse_date(body.work_date)
    if not work_date:
        raise HTTPException(status_code=400, detail="work_date is required")
    try:
        entry = _c().time_tracking.record_time_entry(
            activity_id=body.activity_id,
            worker_id=body.worker_id,
            work_date=work_date,
            start_time=body.start_time,
            end_time=body.end_time,
            location_id=body.location_id,
            location_name=body.location_name,
            notes=body.notes,
            ends_next_day=body.ends_next_day,
        )
        publish(
            "StoreTimeLogged",
            {
                "entry_id": entry.id,
                "worker_id": body.worker_id,
                "activity_id": body.activity_id,
                "duration_minutes": entry.duration_minutes,
            },
        )
        return _entry_dict(entry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/time-entries/{entry_id}")
def get_time_entry(entry_id: str) -> dict[str, Any]:
    entry = _c().time_tracking.get_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="time entry not found")
    return _entry_dict(entry)


@router.patch("/time-entries/{entry_id}")
def update_time_entry(entry_id: str, body: TimeEntryUpdate) -> dict[str, Any]:
    work_date = _parse_date(body.work_date)
    if not work_date:
        raise HTTPException(status_code=400, detail="work_date is required")
    try:
        entry = _c().time_tracking.update_time_entry(
            entry_id,
            work_date=work_date,
            start_time=body.start_time,
            end_time=body.end_time,
            notes=body.notes,
            ends_next_day=body.ends_next_day,
            activity_id=body.activity_id,
            worker_id=body.worker_id,
            location_id=body.location_id,
            location_name=body.location_name,
        )
        return _entry_dict(entry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/time-entries/{entry_id}/status")
def set_time_entry_status(entry_id: str, body: StatusBody) -> dict[str, Any]:
    try:
        return _entry_dict(_c().time_tracking.set_status(entry_id, body.status))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/time-entries/{entry_id}/complete")
def complete_time_entry(entry_id: str) -> dict[str, Any]:
    try:
        return _entry_dict(_c().time_tracking.complete_task(entry_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/time-entries/{entry_id}")
def delete_time_entry(entry_id: str) -> dict[str, Any]:
    try:
        _c().time_tracking.delete_time_entry(entry_id)
        return {"id": entry_id, "deleted": True}
    except Exception as exc:
        raise _http_err(exc) from exc
