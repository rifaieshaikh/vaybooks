"""System settings / updates / logs API (Mongo-backed)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.system_container import get_system_container
from packages.timeutil.utc import utc_now

router = APIRouter(prefix="/api/system", tags=["system"])


class SystemSettingUpsert(BaseModel):
    key: str = Field(min_length=1)
    value: str = ""
    tenant_id: str = "default"


class LogCreate(BaseModel):
    message: str = Field(min_length=1)
    level: str = "info"
    source: str = "system"


def _c():
    return get_system_container()


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "module": "system",
        "status": "ok",
        "backend": _c().backend,
        "server_time_utc": utc_now().isoformat(),
    }


@router.get("/diagnostics")
def diagnostics() -> dict[str, object]:
    settings = _c().settings.list()
    return {
        "status": "ok",
        "server_time_utc": utc_now().isoformat(),
        "process": "combined",
        "backend": _c().backend,
        "settings_count": len(settings),
    }


@router.get("/settings")
def list_settings() -> list[dict[str, Any]]:
    return _c().settings.list()


@router.put("/settings/{key}")
def upsert_setting(key: str, body: SystemSettingUpsert) -> dict[str, Any]:
    row = _c().settings.upsert(key, body.value, tenant_id=body.tenant_id)
    publish("SystemSettingChanged", {"key": key, "value": body.value})
    return row


@router.get("/settings/{key}")
def get_setting(key: str) -> dict[str, Any]:
    row = _c().settings.get(key)
    if not row:
        raise HTTPException(status_code=404, detail="setting not found")
    return row


@router.get("/updates")
def updates_status() -> dict[str, Any]:
    return _c().updates.status()


@router.post("/updates/check")
def updates_check() -> dict[str, Any]:
    return _c().updates.check()


@router.get("/logs")
def list_logs(*, limit: int = 100) -> list[dict[str, Any]]:
    return _c().logs.list(limit=max(1, min(limit, 500)))


@router.post("/logs", status_code=201)
def append_log(body: LogCreate) -> dict[str, Any]:
    return _c().logs.append(body.message, level=body.level, source=body.source)
