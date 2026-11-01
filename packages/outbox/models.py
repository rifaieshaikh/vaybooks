"""Outbox message model."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from uuid import uuid4

from packages.timeutil.utc import utc_now

OutboxStatus = Literal["pending", "confirmed", "failed"]


@dataclass(slots=True)
class OutboxMessage:
    """A domain event staged for asynchronous dispatch."""

    aggregate_type: str
    aggregate_id: str
    event_name: str
    event_version: int
    payload: dict
    id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=utc_now)
    status: OutboxStatus = "pending"
