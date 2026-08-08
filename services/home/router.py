"""Home dashboard stub — event-projected aggregates placeholder."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/home", tags=["home"])

_AGG: dict[str, float] = {"order_count": 0, "revenue": 0.0}


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "home", "status": "ok"}


@router.get("/dashboard")
def dashboard() -> dict[str, object]:
    return {"status": "ok", "metrics": dict(_AGG), "source": "event_projections"}
