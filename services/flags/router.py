"""Feature flags API (behind gateway). Proxies modules from org entitlement."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.flags.service import FlagsService

router = APIRouter(prefix="/api/flags", tags=["flags"])

flags_service = FlagsService(
    enabled_modules=[
        "home",
        "parties",
        "auth",
        "access",
        "settings",
        "flags",
    ]
)


class ModulesResponse(BaseModel):
    modules: List[str]


class ModulesUpdateRequest(BaseModel):
    modules: List[str] = Field(default_factory=list)


def _entitlement_modules() -> List[str] | None:
    try:
        from packages.services_kit.access_container import get_access_container

        ent = get_access_container().plans.get_org_entitlement()
        if ent is None:
            return None
        return list(ent.enabled_modules or [])
    except Exception:
        return None


@router.get("/modules", response_model=ModulesResponse)
def get_modules() -> ModulesResponse:
    mods = _entitlement_modules()
    if mods is not None:
        return ModulesResponse(modules=mods)
    return ModulesResponse(modules=flags_service.get_enabled_modules())


@router.post("/modules", response_model=ModulesResponse)
def set_modules(body: ModulesUpdateRequest) -> ModulesResponse:
    try:
        from packages.services_kit.access_container import get_access_container

        ent = get_access_container().plans.set_enabled_modules(body.modules)
        flags_service.set_enabled_modules(list(ent.enabled_modules or []))
        return ModulesResponse(modules=list(ent.enabled_modules or []))
    except Exception:
        flags_service.set_enabled_modules(body.modules)
        return ModulesResponse(modules=flags_service.get_enabled_modules())
