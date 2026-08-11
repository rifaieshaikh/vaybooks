"""Shared in-memory resource helpers for module API stubs."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from packages.messaging.bus import get_bus
from packages.timeutil.utc import utc_now


class MemoryStore:
    def __init__(self) -> None:
        self._rows: dict[str, dict[str, Any]] = {}

    def list(self, *, include_deleted: bool = False) -> list[dict[str, Any]]:
        rows = list(self._rows.values())
        if not include_deleted:
            rows = [r for r in rows if not r.get("deleted")]
        return rows

    def get(self, item_id: str, *, allow_deleted: bool = False) -> dict[str, Any]:
        row = self._rows.get(item_id)
        if not row or (row.get("deleted") and not allow_deleted):
            raise HTTPException(status_code=404, detail="not found")
        return row

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        item_id = str(uuid4())
        row = {
            "id": item_id,
            "created_at": utc_now().isoformat(),
            "updated_at": utc_now().isoformat(),
            "deleted": False,
            **data,
        }
        self._rows[item_id] = row
        return row

    def update(self, item_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        row = self.get(item_id)
        for key, value in patch.items():
            if value is not None and key not in {"id", "created_at", "deleted"}:
                row[key] = value
        row["updated_at"] = utc_now().isoformat()
        return row

    def soft_delete(self, item_id: str) -> dict[str, Any]:
        row = self.get(item_id)
        row["deleted"] = True
        row["updated_at"] = utc_now().isoformat()
        return row


def publish(event_name: str, payload: dict[str, Any], *, version: int = 1) -> None:
    """Publish if registered; otherwise publish with provided version."""
    try:
        from packages.events.registry import get_event

        ev = get_event(event_name)
        get_bus().publish(ev.name, payload, version=ev.version)
    except KeyError:
        get_bus().publish(event_name, payload, version=version)
