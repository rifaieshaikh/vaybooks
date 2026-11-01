"""In-memory license state for Phase 1 stubs."""

from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from packages.timeutil.utc import to_utc, utc_now

DEFAULT_COOLING_DAYS = 7


@dataclass
class LicenseState:
    status: str = "unknown"
    cooling_ends_at: datetime | None = None
    expiry: datetime | None = None
    last_check_utc: datetime | None = None
    license_key: str | None = None


class LicenseStore:
    """Thread-safe in-memory license status (desktop / combined stub)."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._state = LicenseState()

    def _refresh_expired_from_cooling(self) -> None:
        if self._state.status != "in_cooling_period" or not self._state.cooling_ends_at:
            return
        if utc_now() >= to_utc(self._state.cooling_ends_at):
            self._state.status = "expired"

    def get_snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_expired_from_cooling()
            return {
                "status": self._state.status,
                "cooling_ends_at": (
                    self._state.cooling_ends_at.isoformat()
                    if self._state.cooling_ends_at
                    else None
                ),
                "expiry": (
                    self._state.expiry.isoformat() if self._state.expiry else None
                ),
                "last_check_utc": (
                    self._state.last_check_utc.isoformat()
                    if self._state.last_check_utc
                    else None
                ),
            }

    def record_outcome(
        self,
        *,
        status: str,
        cooling_ends_at: datetime | None = None,
        expiry: datetime | None = None,
        license_key: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            now = utc_now()
            self._state.status = status
            self._state.last_check_utc = now
            if cooling_ends_at is not None:
                self._state.cooling_ends_at = cooling_ends_at
            elif status != "in_cooling_period":
                self._state.cooling_ends_at = None
            if expiry is not None:
                self._state.expiry = expiry
            if license_key is not None:
                self._state.license_key = license_key
            return self.get_snapshot()

    def set_cooling_period(self, *, days: int = DEFAULT_COOLING_DAYS) -> dict[str, Any]:
        now = utc_now()
        cooling_ends = now + timedelta(days=days)
        return self.record_outcome(
            status="in_cooling_period",
            cooling_ends_at=cooling_ends,
            expiry=cooling_ends,
        )


license_store = LicenseStore()
