"""Non-Streamlit system settings / logs / updates container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

_CONTAINER: Optional["SystemContainer"] = None


@dataclass
class SystemContainer:
    backend: str  # always "mongo"
    settings: Any  # SystemSettingsStore
    logs: Any  # SystemLogsStore
    updates: Any  # SystemUpdatesStore


class SystemSettingsStore:
    def __init__(self, db):
        self._col = db.system_settings

    def list(self) -> list[dict[str, Any]]:
        rows = []
        for doc in self._col.find().sort("key", 1):
            rows.append(
                {
                    "id": str(doc.get("_id")),
                    "key": doc.get("key", ""),
                    "value": doc.get("value", ""),
                    "tenant_id": doc.get("tenant_id", "default"),
                    "updated_at": (doc.get("updated_at") or datetime.now(timezone.utc)).isoformat(),
                }
            )
        return rows

    def get(self, key: str) -> Optional[dict[str, Any]]:
        doc = self._col.find_one({"key": key})
        if not doc:
            return None
        return {
            "id": str(doc.get("_id")),
            "key": doc.get("key", ""),
            "value": doc.get("value", ""),
            "tenant_id": doc.get("tenant_id", "default"),
            "updated_at": (doc.get("updated_at") or datetime.now(timezone.utc)).isoformat(),
        }

    def upsert(self, key: str, value: str, *, tenant_id: str = "default") -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        self._col.update_one(
            {"key": key},
            {
                "$set": {
                    "key": key,
                    "value": value,
                    "tenant_id": tenant_id,
                    "updated_at": now,
                },
                "$setOnInsert": {"_id": uuid4().hex},
            },
            upsert=True,
        )
        row = self.get(key)
        assert row is not None
        return row


class SystemLogsStore:
    def __init__(self, db):
        self._col = db.system_logs
        self._audit = db.access_audit_entries

    def list(self, *, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for doc in self._col.find().sort("created_at", -1).limit(limit):
            rows.append(
                {
                    "id": str(doc.get("_id")),
                    "level": doc.get("level", "info"),
                    "message": doc.get("message", ""),
                    "source": doc.get("source", "system"),
                    "created_at": (doc.get("created_at") or datetime.now(timezone.utc)).isoformat(),
                }
            )
        if rows:
            return rows
        # Fall back to access audit when no explicit system logs exist.
        for doc in self._audit.find().sort("created_at", -1).limit(limit):
            rows.append(
                {
                    "id": str(doc.get("_id")),
                    "level": "info",
                    "message": doc.get("action") or doc.get("message") or "audit",
                    "source": "access_audit",
                    "created_at": (doc.get("created_at") or datetime.now(timezone.utc)).isoformat(),
                }
            )
        return rows

    def append(self, message: str, *, level: str = "info", source: str = "system") -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        doc = {
            "_id": uuid4().hex,
            "level": level,
            "message": message,
            "source": source,
            "created_at": now,
        }
        self._col.insert_one(doc)
        return {
            "id": doc["_id"],
            "level": level,
            "message": message,
            "source": source,
            "created_at": now.isoformat(),
        }


class SystemUpdatesStore:
    def __init__(self, db):
        self._col = db.system_updates
        self._settings = SystemSettingsStore(db)

    def status(self) -> dict[str, Any]:
        version = self._settings.get("app.version")
        channel = self._settings.get("app.update_channel")
        last = self._col.find_one(sort=[("checked_at", -1)])
        return {
            "current_version": (version or {}).get("value") or "0.0.0",
            "channel": (channel or {}).get("value") or "stable",
            "update_available": bool(last and last.get("update_available")),
            "latest_version": (last or {}).get("latest_version") or "",
            "checked_at": (
                (last.get("checked_at").isoformat() if last and last.get("checked_at") else None)
            ),
            "notes": (last or {}).get("notes") or "",
        }

    def check(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        current = self.status()["current_version"]
        doc = {
            "_id": uuid4().hex,
            "checked_at": now,
            "current_version": current,
            "latest_version": current,
            "update_available": False,
            "notes": "Up to date",
        }
        self._col.insert_one(doc)
        return self.status()

    def install(self) -> dict[str, Any]:
        """Record an install request (web stub — desktop installer runs locally)."""
        now = datetime.now(timezone.utc)
        status = self.status()
        doc = {
            "_id": uuid4().hex,
            "checked_at": now,
            "installed_at": now,
            "current_version": status.get("current_version") or "0.0.0",
            "latest_version": status.get("latest_version") or status.get("current_version") or "0.0.0",
            "update_available": False,
            "notes": "Install requested from web (no desktop installer payload)",
        }
        self._col.insert_one(doc)
        out = self.status()
        out["install_requested"] = True
        out["notes"] = doc["notes"]
        return out


def _mongo_uri() -> str:
    from packages.services_kit.mongo_env import mongo_uri

    return mongo_uri()


def _db_name() -> str:
    from packages.services_kit.mongo_env import mongo_db_name

    return mongo_db_name()


def _require_uri() -> str:
    uri = _mongo_uri()
    if not uri:
        raise RuntimeError(
            "MONGODB_URI is required (set env or .streamlit/secrets.toml); "
            "memory backend is disabled"
        )
    return uri


def _build_mongo(uri: str) -> SystemContainer:
    from pymongo import MongoClient

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]
    return SystemContainer(
        backend="mongo",
        settings=SystemSettingsStore(db),
        logs=SystemLogsStore(db),
        updates=SystemUpdatesStore(db),
    )


def build_system_container() -> SystemContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("System container using Mongo backend db=%s", _db_name())
    return container


def get_system_container() -> SystemContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_system_container()
    return _CONTAINER


def set_system_container(container: SystemContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_system_container() -> SystemContainer:
    set_system_container(None)
    return get_system_container()
