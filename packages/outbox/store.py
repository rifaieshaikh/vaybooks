"""Outbox persistence backends.

Web deployment note
-------------------
When running against MongoDB with a replica set, wrap ``append`` and the
associated business write in a **multi-document transaction** so the
aggregate change and outbox row commit atomically. Desktop/single-node
deployments may use non-transactional append until replica set is available.
"""

from __future__ import annotations

from typing import Any, List, Protocol, runtime_checkable
from uuid import uuid4

from packages.outbox.models import OutboxMessage, OutboxStatus
from packages.timeutil.utc import utc_now


@runtime_checkable
class OutboxStore(Protocol):
    """Persistence port for outbox messages."""

    def append(self, message: OutboxMessage) -> OutboxMessage:
        """Persist a new outbox message."""

    def list_pending(self, *, limit: int = 100) -> List[OutboxMessage]:
        """Return pending messages ordered oldest-first."""

    def mark_confirmed(self, message_id: str) -> None:
        """Mark a message as successfully dispatched."""

    def mark_failed(self, message_id: str) -> None:
        """Mark a message as failed after dispatch attempts."""


class InMemoryOutboxStore:
    """Process-local outbox for tests and desktop bootstrap."""

    def __init__(self) -> None:
        self._messages: dict[str, OutboxMessage] = {}

    def append(self, message: OutboxMessage) -> OutboxMessage:
        if not message.id:
            message.id = str(uuid4())
        if message.created_at is None:
            message.created_at = utc_now()
        self._messages[message.id] = message
        return message

    def list_pending(self, *, limit: int = 100) -> List[OutboxMessage]:
        pending = [m for m in self._messages.values() if m.status == "pending"]
        pending.sort(key=lambda m: m.created_at)
        return pending[:limit]

    def mark_confirmed(self, message_id: str) -> None:
        self._set_status(message_id, "confirmed")

    def mark_failed(self, message_id: str) -> None:
        self._set_status(message_id, "failed")

    def _set_status(self, message_id: str, status: OutboxStatus) -> None:
        msg = self._messages.get(message_id)
        if msg is None:
            raise KeyError(f"Outbox message not found: {message_id!r}")
        msg.status = status


class MongoOutboxStore:
    """MongoDB outbox store (non-transactional append by default).

    Callers on web should wrap ``append`` plus business writes in a
    multi-document transaction when a replica set is available.
    """

    def __init__(self, collection: Any) -> None:
        self._collection = collection

    def append(self, message: OutboxMessage) -> OutboxMessage:
        if not message.id:
            message.id = str(uuid4())
        if message.created_at is None:
            message.created_at = utc_now()
        doc = {
            "_id": message.id,
            "aggregate_type": message.aggregate_type,
            "aggregate_id": message.aggregate_id,
            "event_name": message.event_name,
            "event_version": message.event_version,
            "payload": message.payload,
            "created_at": message.created_at,
            "status": message.status,
        }
        self._collection.insert_one(doc)
        return message

    def list_pending(self, *, limit: int = 100) -> List[OutboxMessage]:
        cursor = (
            self._collection.find({"status": "pending"})
            .sort("created_at", 1)
            .limit(limit)
        )
        return [self._from_doc(doc) for doc in cursor]

    def mark_confirmed(self, message_id: str) -> None:
        self._collection.update_one(
            {"_id": message_id},
            {"$set": {"status": "confirmed"}},
        )

    def mark_failed(self, message_id: str) -> None:
        self._collection.update_one(
            {"_id": message_id},
            {"$set": {"status": "failed"}},
        )

    @staticmethod
    def _from_doc(doc: dict) -> OutboxMessage:
        return OutboxMessage(
            id=str(doc["_id"]),
            aggregate_type=doc["aggregate_type"],
            aggregate_id=doc["aggregate_id"],
            event_name=doc["event_name"],
            event_version=int(doc["event_version"]),
            payload=dict(doc.get("payload") or {}),
            created_at=doc["created_at"],
            status=doc.get("status", "pending"),
        )
