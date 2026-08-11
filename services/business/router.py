"""Business ops activities, free-standing tasks, and time entries API."""

from __future__ import annotations

from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.business_container import get_business_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.exceptions import DomainError, ValidationError

router = APIRouter(prefix="/api/business", tags=["business"])


class ActivityCreate(BaseModel):
    activity_name: str = ""
    activity_category: str = "In House Service"
    default_hourly_expense: float = 0.0
    custom_statuses: Optional[List[str]] = None


class ActivityUpdate(BaseModel):
    activity_name: str = Field(min_length=1)
    activity_category: str = "In House Service"
    default_hourly_expense: float = 0.0
    is_active: bool = True
    custom_statuses: Optional[List[str]] = None


class TaskCreate(BaseModel):
    activity_id: str = Field(min_length=1)
    title: str = ""
    notes: str = ""
    due_date: Optional[str] = None
    estimated_hours: float = 0.0
    assignee_worker_id: str = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None
    clear_due_date: bool = False
    estimated_hours: Optional[float] = None


class AssignBody(BaseModel):
    worker_id: str = ""


class StatusBody(BaseModel):
    status: str = Field(min_length=1)


class TimeEntryCreate(BaseModel):
    task_id: str = Field(min_length=1)
    worker_id: str = Field(min_length=1)
    work_date: str
    start_time: str = Field(min_length=1)
    end_time: str = Field(min_length=1)
    notes: str = ""
    ends_next_day: bool = False


class TimeEntryUpdate(BaseModel):
    work_date: str
    start_time: str = Field(min_length=1)
    end_time: str = Field(min_length=1)
    notes: str = ""
    ends_next_day: bool = False
    worker_id: Optional[str] = None


def _c():
    return get_business_container()


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


def _page(items: list, page: int, page_size: int) -> dict[str, Any]:
    page = max(1, int(page or 1))
    page_size = max(1, min(200, int(page_size or 50)))
    total = len(items)
    start = (page - 1) * page_size
    slice_items = items[start : start + page_size]
    return {
        "items": slice_items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


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
    data["name"] = data.get("activity_name") or ""
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("activity_name") or ""),
            str(data.get("activity_category") or ""),
        ]
        if b
    )
    return data


def _task_dict(task: Any) -> dict[str, Any]:
    data = entity_dict(task)
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("title") or data.get("activity_name") or ""),
            str(data.get("assignee_name") or ""),
            str(data.get("status") or ""),
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
    return {"module": "business_ops", "status": "ok", "backend": _c().backend}


@router.get("/overview")
def overview() -> dict[str, Any]:
    try:
        activities = _c().activities.list_activities(active_only=True)
        tasks = _c().tasks.list_tasks()
        entries = _c().time_tracking.list_all()
        open_tasks = [t for t in tasks if str(getattr(t, "status", "")) != "Completed"]
        return {
            "active_activities": len(activities),
            "total_tasks": len(tasks),
            "open_tasks": len(open_tasks),
            "total_time_entries": len(entries),
            "quick_actions": [
                {"to": "/business/tasks", "label": "Tasks"},
                {"to": "/business/time", "label": "Time log"},
                {"to": "/settings/business-activities", "label": "Activities"},
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/activities")
def list_activities(
    *,
    active_only: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    try:
        rows = [_activity_dict(r) for r in _c().activities.list_activities(active_only=active_only)]
        return _page(rows, page, page_size)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities", status_code=201)
def create_activity(body: ActivityCreate) -> dict[str, Any]:
    name = (body.activity_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="activity_name is required")
    try:
        activity = _c().activities.create_activity(
            activity_name=name,
            activity_category=body.activity_category,
            default_hourly_expense=float(body.default_hourly_expense or 0.0),
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


@router.get("/tasks")
def list_tasks(
    *,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    try:
        rows = [_task_dict(t) for t in _c().tasks.list_tasks()]
        return _page(rows, page, page_size)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/tasks", status_code=201)
def create_task(body: TaskCreate) -> dict[str, Any]:
    try:
        task = _c().tasks.create_task(
            activity_id=body.activity_id,
            title=body.title,
            notes=body.notes,
            due_date=_parse_date(body.due_date),
            estimated_hours=body.estimated_hours,
            assignee_worker_id=body.assignee_worker_id,
        )
        publish(
            "BusinessTaskCreated",
            {"task_id": task.id, "activity_id": body.activity_id},
        )
        return _task_dict(task)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/tasks/{task_id}")
def get_task(task_id: str) -> dict[str, Any]:
    task = _c().tasks.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    return _task_dict(task)


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, body: TaskUpdate) -> dict[str, Any]:
    try:
        task = _c().tasks.update_task(
            task_id,
            title=body.title,
            notes=body.notes,
            due_date=_parse_date(body.due_date),
            estimated_hours=body.estimated_hours,
            clear_due_date=body.clear_due_date,
        )
        return _task_dict(task)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/tasks/{task_id}/assign")
def assign_task(task_id: str, body: AssignBody) -> dict[str, Any]:
    try:
        return _task_dict(_c().tasks.assign_task(task_id, body.worker_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/tasks/{task_id}/status")
def set_task_status(task_id: str, body: StatusBody) -> dict[str, Any]:
    try:
        return _task_dict(_c().tasks.set_status(task_id, body.status))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/tasks/{task_id}/complete")
def complete_task(task_id: str) -> dict[str, Any]:
    try:
        return _task_dict(_c().tasks.complete_task(task_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str) -> dict[str, Any]:
    try:
        _c().tasks.delete_task(task_id)
        return {"id": task_id, "deleted": True}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/time-entries")
def list_time_entries(
    *,
    task_id: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    try:
        if task_id.strip():
            rows = _c().time_tracking.list_for_task(task_id.strip())
        else:
            rows = _c().time_tracking.list_all()
        return _page([_entry_dict(r) for r in rows], page, page_size)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/time-entries", status_code=201)
def create_time_entry(body: TimeEntryCreate) -> dict[str, Any]:
    work_date = _parse_date(body.work_date)
    if not work_date:
        raise HTTPException(status_code=400, detail="work_date is required")
    try:
        entry = _c().time_tracking.record_time_entry(
            task_id=body.task_id,
            worker_id=body.worker_id,
            work_date=work_date,
            start_time=body.start_time,
            end_time=body.end_time,
            notes=body.notes,
            ends_next_day=body.ends_next_day,
        )
        publish(
            "BusinessTimeLogged",
            {
                "entry_id": entry.id,
                "task_id": body.task_id,
                "worker_id": body.worker_id,
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
            worker_id=body.worker_id,
        )
        return _entry_dict(entry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/time-entries/{entry_id}")
def delete_time_entry(entry_id: str) -> dict[str, Any]:
    try:
        _c().time_tracking.delete_time_entry(entry_id)
        return {"id": entry_id, "deleted": True}
    except Exception as exc:
        raise _http_err(exc) from exc
