"""Settings + Access note — Access MFE uses Auth APIs; settings owns business prefs."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["settings"])

_PREFS: dict[str, str] = {"timezone": "UTC", "locale": "en"}


class PrefsUpdate(BaseModel):
    timezone: str | None = None
    locale: str | None = None


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "settings", "status": "ok"}


@router.get("/prefs")
def get_prefs() -> dict[str, str]:
    return dict(_PREFS)


@router.put("/prefs")
def put_prefs(body: PrefsUpdate) -> dict[str, str]:
    if body.timezone:
        _PREFS["timezone"] = body.timezone
    if body.locale:
        _PREFS["locale"] = body.locale
    return dict(_PREFS)
