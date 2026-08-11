"""UTC datetime utilities."""

from __future__ import annotations

from datetime import datetime, timezone

__all__ = ["utc_now", "to_utc", "ensure_aware_utc"]

UTC = timezone.utc


def utc_now() -> datetime:
    """Return the current time as timezone-aware UTC."""
    return datetime.now(UTC)


def to_utc(dt: datetime) -> datetime:
    """Convert *dt* to UTC. Naive datetimes are assumed to already be UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def ensure_aware_utc(dt: datetime) -> datetime:
    """Ensure *dt* is timezone-aware UTC (alias of ``to_utc``)."""
    return to_utc(dt)
