"""Module health stub router factory."""

from __future__ import annotations

from fastapi import APIRouter


def create_module_router(module: str) -> APIRouter:
    router = APIRouter(prefix=f"/api/{module}", tags=[module])

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"module": module, "status": "ok"}

    return router
