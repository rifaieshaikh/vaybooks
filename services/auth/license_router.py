"""License verification API (Phase 1 stub).

When license status is ``expired``, business APIs return 403 except allowlisted routes:
``GET /api/license/status``, ``POST /api/license/verify``, ``POST /api/license/renew``,
``POST /api/auth/logout``, and ``GET /health``.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.auth.license_store import DEFAULT_COOLING_DAYS, license_store

router = APIRouter(prefix="/api/license", tags=["license"])

LICENSE_API_URL = os.getenv("LICENSE_API_URL", "").strip()
LICENSE_FORCE_EXPIRED = os.getenv("LICENSE_FORCE_EXPIRED", "").strip() == "1"
LICENSE_FORCE_REVOKED = os.getenv("LICENSE_FORCE_REVOKED", "").strip() == "1"
LICENSE_FORCE_SEAT_EXCEEDED = os.getenv("LICENSE_FORCE_SEAT_EXCEEDED", "").strip() == "1"
COOLING_DAYS = int(os.getenv("LICENSE_COOLING_DAYS", str(DEFAULT_COOLING_DAYS)))


class RenewRequest(BaseModel):
    license_key: str = Field(..., min_length=1)


async def _consume_external_license() -> str:
    """Return outcome status: success, skipped, in_cooling_period, expired, revoked, seat_exceeded."""
    if LICENSE_FORCE_REVOKED:
        return "revoked"
    if LICENSE_FORCE_SEAT_EXCEEDED:
        return "seat_exceeded"
    if LICENSE_FORCE_EXPIRED:
        return "in_cooling_period"
    if not LICENSE_API_URL:
        return "skipped"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(LICENSE_API_URL, json={"action": "verify"})
        if response.status_code == 404 or response.status_code >= 500:
            return "skipped"
        if response.status_code >= 400:
            return "skipped"
        data = response.json() if response.content else {}
        remote_status = str(data.get("status", "success")).lower()
        if remote_status in {"valid", "success", "active"}:
            return "success"
        if remote_status in {"expired", "in_cooling_period"}:
            return "in_cooling_period"
        if remote_status in {"revoked", "invalid"}:
            return "revoked"
        if remote_status in {"seat_exceeded", "seats_exceeded"}:
            return "seat_exceeded"
        return "success"
    except (httpx.HTTPError, ValueError):
        return "skipped"


def _apply_outcome(outcome: str, *, license_key: str | None = None) -> dict[str, Any]:
    if outcome == "skipped":
        return license_store.record_outcome(status="skipped")
    if outcome == "success":
        return license_store.record_outcome(status="success", license_key=license_key)
    if outcome == "in_cooling_period":
        return license_store.set_cooling_period(days=COOLING_DAYS)
    if outcome == "revoked":
        return license_store.record_outcome(status="expired", license_key=license_key)
    if outcome == "seat_exceeded":
        snapshot = license_store.record_outcome(status="success", license_key=license_key)
        snapshot["seat_exceeded"] = True
        snapshot["notify"] = "Seat limit exceeded; renew or upgrade seats."
        return snapshot
    return license_store.record_outcome(status="unknown")


@router.get("/status")
def license_status() -> dict[str, Any]:
    """Return persisted daily license status from the in-memory store."""
    return license_store.get_snapshot()


@router.post("/verify")
async def verify_license() -> dict[str, Any]:
    """App-start license consume stub."""
    outcome = await _consume_external_license()
    return _apply_outcome(outcome)


@router.post("/renew")
async def renew_license(body: RenewRequest) -> dict[str, Any]:
    """Submit a new license key (stub)."""
    key = body.license_key.strip()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="license_key is required",
        )
    outcome = await _consume_external_license()
    if outcome in {"revoked", "expired"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="License key is invalid or revoked",
        )
    snapshot = _apply_outcome("success", license_key=key)
    snapshot["renewed"] = True
    return snapshot
