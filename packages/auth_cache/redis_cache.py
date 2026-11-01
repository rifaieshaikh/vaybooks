"""Redis-backed permission cache for multi-instance web deployments.

Auth-owned cache pattern
------------------------
The Auth service owns cache population and invalidation:

* **SET** — after login or permission refresh, Auth writes the resolved
  permission payload with a TTL.
* **DEL** — on logout, role change, or entitlement update, Auth deletes
  the key so the next request repopulates from source.

Application code should treat this cache as read-through: ``get`` returns
``dict`` on hit and ``None`` on miss; callers fetch authoritative data
when ``None`` is returned.
"""

from __future__ import annotations

import json
from typing import Any

try:
    import redis
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "RedisPermissionCache requires the 'redis' package. "
        "Install with: pip install redis"
    ) from exc


class RedisPermissionCache:
    """JSON-serialized permission cache backed by Redis."""

    def __init__(self, client: "redis.Redis[str]", *, prefix: str = "perm:") -> None:
        self._client = client
        self._prefix = prefix

    def _full_key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    def get(self, key: str) -> dict | None:
        raw = self._client.get(self._full_key(key))
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        payload: Any = json.loads(raw)
        if not isinstance(payload, dict):
            raise TypeError(f"Expected dict payload for key {key!r}, got {type(payload)!r}")
        return payload

    def set(self, key: str, value: dict) -> None:
        self._client.set(self._full_key(key), json.dumps(value))

    def delete(self, key: str) -> None:
        self._client.delete(self._full_key(key))
