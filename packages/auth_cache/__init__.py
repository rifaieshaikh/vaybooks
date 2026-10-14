"""Permission cache abstractions for desktop and web deployments."""

from packages.auth_cache.base import PermissionCache
from packages.auth_cache.memory import InProcessPermissionCache

__all__ = [
    "PermissionCache",
    "InProcessPermissionCache",
]

try:
    from packages.auth_cache.redis_cache import RedisPermissionCache
except ImportError:  # redis optional
    RedisPermissionCache = None  # type: ignore[misc, assignment]

if RedisPermissionCache is not None:
    __all__.append("RedisPermissionCache")
