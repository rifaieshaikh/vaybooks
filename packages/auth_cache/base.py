"""Permission cache protocol."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class PermissionCache(Protocol):
    """Cache resolved permission payloads keyed by tenant/user scope."""

    def get(self, key: str) -> dict | None:
        """Return cached permissions dict, or ``None`` on miss."""

    def set(self, key: str, value: dict) -> None:
        """Store permissions dict under *key*."""

    def delete(self, key: str) -> None:
        """Remove cached entry for *key* if present."""
