"""In-memory reserve/lock service for stock and finance keys."""

from __future__ import annotations

import threading
from dataclasses import dataclass
from enum import Enum
from typing import Dict

degraded_pending: bool = False
"""Global flag: Sales side-effects stay pending until Inventory+Finance consumers are healthy."""


class ReserveState(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"


@dataclass
class ReserveRecord:
    key: str
    state: ReserveState = ReserveState.PENDING
    reason: str | None = None


class ReserveLockService:
    """In-memory reserve/confirm/fail for stock and finance reserve keys."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._reserves: Dict[str, ReserveRecord] = {}

    def request_reserve(self, key: str) -> ReserveRecord:
        with self._lock:
            existing = self._reserves.get(key)
            if existing and existing.state == ReserveState.CONFIRMED:
                return existing
            record = ReserveRecord(key=key, state=ReserveState.PENDING)
            self._reserves[key] = record
            return record

    def confirm(self, key: str) -> ReserveRecord:
        with self._lock:
            record = self._reserves.get(key) or ReserveRecord(key=key)
            record.state = ReserveState.CONFIRMED
            record.reason = None
            self._reserves[key] = record
            return record

    def fail(self, key: str, *, reason: str = "failed") -> ReserveRecord:
        with self._lock:
            record = self._reserves.get(key) or ReserveRecord(key=key)
            record.state = ReserveState.FAILED
            record.reason = reason
            self._reserves[key] = record
            return record

    def get(self, key: str) -> ReserveRecord | None:
        with self._lock:
            return self._reserves.get(key)
