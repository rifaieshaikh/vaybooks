"""Schedulers API — Mongo-backed job configs, domain filters, run now."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.schedulers_container import get_schedulers_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.schedulers.entities import DOMAIN_ORDER, DOMAIN_LABELS

router = APIRouter(prefix="/api/schedulers", tags=["schedulers"])

MODULE_PACKS = tuple(d for d in DOMAIN_ORDER if d != "system") + ("system",)


class JobCreate(BaseModel):
    """Enable / save a registry job (job_id) or first job in module pack."""

    name: str = Field(default="", description="Optional title override / label")
    module: str = Field(min_length=1, description="Domain pack e.g. crm|sales|...")
    job_id: str = ""
    cron: str = ""
    enabled: bool = True
    tenant_id: str = "default"


class JobPatch(BaseModel):
    enabled: Optional[bool] = None
    title: Optional[str] = None
    frequency: Optional[str] = None
    time_of_day: Optional[str] = None
    weekday: Optional[int] = None
    interval_days: Optional[int] = None


class ReportPatch(BaseModel):
    enabled: Optional[bool] = None
    frequency: Optional[str] = None
    time_of_day: Optional[str] = None
    weekday: Optional[int] = None
    interval_days: Optional[int] = None
    filters: Optional[dict[str, Any]] = None
    recipient_ids: Optional[list[str]] = None
    create_notification: Optional[bool] = None
    max_rows: Optional[int] = Field(default=None, ge=1)


def _svc():
    return get_schedulers_container().schedulers


def _job_row(config) -> dict[str, Any]:
    data = entity_dict(config)
    running = False
    try:
        running = _svc().is_running(config.job_id)
    except Exception:
        running = False
    return {
        "id": config.job_id,
        "job_id": config.job_id,
        "name": config.title or config.job_id,
        "title": config.title or config.job_id,
        "module": config.domain,
        "domain": config.domain,
        "cron": config.cron_expression or "",
        "enabled": bool(config.enabled),
        "status": "running" if running else ("enabled" if config.enabled else "disabled"),
        "frequency": getattr(config, "frequency", ""),
        "time_of_day": getattr(config, "time_of_day", ""),
        "next_run_at": data.get("next_run_at"),
        "last_run_at": data.get("last_run_at"),
        "description": getattr(config, "description", "") or "",
    }


def _report_row(config, definition=None) -> dict[str, Any]:
    data = entity_dict(config)
    report_id = config.report_id
    return {
        "id": report_id,
        "report_id": report_id,
        "title": config.report_title or getattr(definition, "title", "") or report_id,
        "domain": config.domain,
        "module": config.domain,
        "category": getattr(definition, "category", "") or "",
        "enabled": bool(config.enabled),
        "frequency": config.frequency,
        "time_of_day": config.time_of_day,
        "weekday": config.weekday,
        "interval_days": config.interval_days,
        "cron": config.cron_expression,
        "next_run_at": data.get("next_run_at"),
        "last_run_at": data.get("last_run_at"),
        "last_status": config.last_status,
        "last_error": config.last_error,
        "last_artifact_id": config.last_artifact_id,
        "filters": dict(config.filters or {}),
        "recipient_ids": list(config.recipient_ids or []),
        "create_notification": bool(config.create_notification),
        "max_rows": config.max_rows,
        "status": (
            "running"
            if _svc().is_report_running(config.domain, report_id)
            else ("enabled" if config.enabled else "disabled")
        ),
    }


def _outcome(outcome) -> dict[str, Any]:
    return {
        "started": list(outcome.started),
        "skipped": list(outcome.skipped),
        "message": outcome.message,
    }


def _normalize_module(module: str) -> str:
    m = (module or "").strip().lower()
    if m not in DOMAIN_LABELS and m not in MODULE_PACKS:
        raise HTTPException(status_code=400, detail=f"Unknown module pack: {module}")
    return m


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "module": "schedulers",
        "status": "ok",
        "backend": get_schedulers_container().backend,
    }


@router.get("/modules")
def list_modules() -> dict[str, Any]:
    return {
        "modules": [
            {"id": d, "label": DOMAIN_LABELS.get(d, d.title())}
            for d in MODULE_PACKS
            if d in DOMAIN_LABELS or d == "system"
        ]
    }


@router.get("/jobs")
def list_jobs(*, module: str = "", domain: str = "") -> list[dict[str, Any]]:
    pack = (module or domain or "").strip().lower()
    if pack:
        pack = _normalize_module(pack)
    configs = _svc().list_configs(pack)
    return [_job_row(c) for c in configs]


@router.post("/jobs", status_code=201)
def create_job(body: JobCreate) -> dict[str, Any]:
    pack = _normalize_module(body.module)
    svc = _svc()
    job_id = (body.job_id or "").strip()
    if not job_id:
        defs = svc.job_definitions(pack)
        if not defs:
            raise HTTPException(status_code=400, detail=f"No jobs registered for {pack}")
        # Prefer matching title, else first definition.
        match = next(
            (d for d in defs if body.name and d.title.lower() == body.name.lower()),
            defs[0],
        )
        job_id = match.job_id
    config = svc.get_config(job_id)
    if config is None or (config.domain and config.domain != pack):
        # Allow save when domain matches pack or empty seed
        if config is None:
            raise HTTPException(status_code=404, detail=f"Unknown job: {job_id}")
        if config.domain != pack:
            raise HTTPException(
                status_code=400,
                detail=f"Job {job_id} belongs to {config.domain}, not {pack}",
            )
    if body.name:
        config.title = body.name
    config.enabled = body.enabled
    if body.cron:
        config.cron_expression = body.cron
    saved = svc.save_config(config)
    row = _job_row(saved)
    publish(
        "SchedulerJobQueued",
        {"job_id": row["id"], "name": row["name"], "module": row["module"], "cron": row["cron"]},
    )
    return row


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    config = _svc().get_config(job_id)
    if config is None:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_row(config)


@router.patch("/jobs/{job_id}")
def patch_job(job_id: str, body: JobPatch) -> dict[str, Any]:
    config = _svc().get_config(job_id)
    if config is None:
        raise HTTPException(status_code=404, detail="job not found")
    if body.enabled is not None:
        config.enabled = body.enabled
    if body.title is not None:
        config.title = body.title
    if body.frequency is not None:
        config.frequency = body.frequency
    if body.time_of_day is not None:
        config.time_of_day = body.time_of_day
    if body.weekday is not None:
        config.weekday = body.weekday
    if body.interval_days is not None:
        config.interval_days = body.interval_days
    return _job_row(_svc().save_config(config))


@router.post("/jobs/{job_id}/run")
def run_job(job_id: str) -> dict[str, Any]:
    outcome = _svc().run_now(job_id)
    config = _svc().get_config(job_id)
    row = _job_row(config) if config else {"id": job_id, "job_id": job_id}
    row["run"] = {
        "started": list(outcome.started),
        "skipped": list(outcome.skipped),
        "message": outcome.message,
    }
    row["status"] = "running" if outcome.any_started else row.get("status", "enabled")
    return row


@router.post("/domains/{domain}/run")
def run_domain(domain: str) -> dict[str, Any]:
    pack = _normalize_module(domain)
    outcome = _svc().run_domain(pack)
    return {
        "domain": pack,
        "started": list(outcome.started),
        "skipped": list(outcome.skipped),
        "message": outcome.message,
    }


@router.get("/jobs/{job_id}/runs")
def list_runs(job_id: str, limit: int = 10) -> list[dict[str, Any]]:
    return [entity_dict(r) for r in _svc().list_runs(job_id, limit=limit)]


@router.get("/reports")
def list_domain_reports(*, module: str = "", domain: str = "") -> list[dict[str, Any]]:
    pack = _normalize_module(module or domain or "crm")
    svc = _svc()
    return [
        _report_row(svc.get_report_config(pack, definition.report_id), definition)
        for definition in svc.list_domain_reports(pack)
    ]


@router.patch("/reports/{report_id}")
def patch_report(report_id: str, body: ReportPatch, *, module: str = "", domain: str = "") -> dict[str, Any]:
    pack = _normalize_module(module or domain or "crm")
    svc = _svc()
    config = svc.get_report_config(pack, report_id)
    if config is None:
        raise HTTPException(status_code=404, detail="report not found")
    for field in (
        "enabled",
        "frequency",
        "time_of_day",
        "weekday",
        "interval_days",
        "filters",
        "recipient_ids",
        "create_notification",
        "max_rows",
    ):
        value = getattr(body, field)
        if value is not None:
            setattr(config, field, value)
    saved = svc.save_report_config(config)
    definition = next((d for d in svc.list_domain_reports(pack) if d.report_id == report_id), None)
    return _report_row(saved, definition)


@router.post("/reports/{report_id}/run")
def run_report(report_id: str, *, module: str = "", domain: str = "") -> dict[str, Any]:
    pack = _normalize_module(module or domain or "crm")
    outcome = _svc().run_report_now(pack, report_id)
    if not outcome.started and outcome.message == "Unknown report":
        raise HTTPException(status_code=404, detail="report not found")
    return _outcome(outcome)


@router.get("/reports/{report_id}/runs")
def list_report_runs(
    report_id: str, *, module: str = "", domain: str = "", limit: int = 20
) -> list[dict[str, Any]]:
    pack = _normalize_module(module or domain or "crm")
    return [entity_dict(run) for run in _svc().list_report_runs(pack, report_id, limit=limit)]


@router.get("/artifacts/{artifact_id}")
def get_report_artifact(artifact_id: str) -> Response:
    artifact = _svc().get_artifact(artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="artifact not found")
    return Response(
        content=artifact.data,
        media_type=artifact.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{artifact.filename or "report.csv"}"'},
    )


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, Any]:
    """Soft-disable a job (registry jobs cannot be hard-deleted)."""
    config = _svc().get_config(job_id)
    if config is None:
        raise HTTPException(status_code=404, detail="job not found")
    config.enabled = False
    return _job_row(_svc().save_config(config))
