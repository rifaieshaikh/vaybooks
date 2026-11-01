"""In-process permission cache for desktop deployments."""

from __future__ import annotations

import threading
from typing import Dict


class InProcessPermissionCache:
    """Thread-safe dict-backed cache suitable for single-process desktop apps."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._data: Dict[str, dict] = {}

    def get(self, key: str) -> dict | None:
        with self._lock:
            return self._data.get(key)

    def set(self, key: str, value: dict) -> None:
        with self._lock:
            self._data[key] = dict(value)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)
