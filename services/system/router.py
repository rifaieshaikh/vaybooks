"""System settings / diagnostics API (desktop-oriented)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish
from packages.timeutil.utc import utc_now

router = APIRouter(prefix="/api/system", tags=["system"])
_SETTINGS = MemoryStore()


class SystemSettingUpsert(BaseModel):
    key: str = Field(min_length=1)
    value: str = ""
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, object]:
    return {"module": "system", "status": "ok", "server_time_utc": utc_now().isoformat()}


@router.get("/diagnostics")
def diagnostics() -> dict[str, object]:
    return {
        "status": "ok",
        "server_time_utc": utc_now().isoformat(),
        "process": "combined",
        "settings_count": len(_SETTINGS.list(include_deleted=True)),
    }


@router.get("/settings")
def list_settings(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _SETTINGS.list(include_deleted=include_deleted)


@router.put("/settings/{key}")
def upsert_setting(key: str, body: SystemSettingUpsert) -> dict[str, Any]:
    existing = next((r for r in _SETTINGS.list(include_deleted=True) if r.get("key") == key), None)
    if existing:
        row = _SETTINGS.update(existing["id"], {"value": body.value, "key": key})
    else:
        row = _SETTINGS.create({"key": key, "value": body.value, "tenant_id": body.tenant_id})
    publish("SystemSettingChanged", {"key": key, "value": body.value})
    return row


@router.get("/settings/{key}")
def get_setting(key: str) -> dict[str, Any]:
    for row in _SETTINGS.list(include_deleted=True):
        if row.get("key") == key and not row.get("deleted"):
            return row
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail="setting not found")
