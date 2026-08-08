"""Feature flags API (behind gateway)."""

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


@router.get("/modules", response_model=ModulesResponse)
def get_modules() -> ModulesResponse:
    return ModulesResponse(modules=flags_service.get_enabled_modules())


@router.post("/modules", response_model=ModulesResponse)
def set_modules(body: ModulesUpdateRequest) -> ModulesResponse:
    flags_service.set_enabled_modules(body.modules)
    return ModulesResponse(modules=flags_service.get_enabled_modules())
