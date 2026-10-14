"""Route-level boutique permission resolution."""

from __future__ import annotations

import re

from fastapi import HTTPException, Request, status

from packages.tenancy.context import DEFAULT_ORG_ID, get_org_id
from services.auth.router import (
    _access,
    _decode_token,
    _load_user_by_username,
    _perm_key,
    permission_cache,
)


def _boutique_subpath(path: str) -> str:
    marker = "/api/boutique"
    if marker in path:
        rest = path.split(marker, 1)[1]
    else:
        rest = path
    if not rest.startswith("/"):
        rest = f"/{rest}"
    return rest.rstrip("/") or "/"


def permission_for_boutique_route(method: str, path: str) -> str | None:
    """Map HTTP method + path to a boutique entitlement key.

    Returns ``None`` for unauthenticated health checks.
    """
    sub = _boutique_subpath(path)
    m = (method or "GET").upper()

    if sub == "/health":
        return None

    if sub.startswith("/overview"):
        return "boutique.overview.view"

    if sub.startswith("/reports"):
        return "boutique.reports.view"

    if sub.startswith("/calendar"):
        return "boutique.calendar.view"

    if sub.startswith("/time-entries") or sub.startswith("/tasks"):
        if m in ("POST", "PATCH", "PUT", "DELETE"):
            return "boutique.tasks.edit"
        return "boutique.tasks.view"

    if sub.startswith("/measurements") or sub.startswith("/measurement-"):
        if m in ("POST", "PATCH", "PUT", "DELETE"):
            return "boutique.measurements.edit"
        return "boutique.measurements.view"

    if sub.startswith("/items"):
        if m in ("POST", "PATCH", "PUT", "DELETE"):
            return "boutique.items.edit"
        return "boutique.items.view"

    if sub.startswith("/activities"):
        if m in ("POST", "PATCH", "PUT", "DELETE"):
            return "boutique.orders.edit"
        return "boutique.orders.view"

    # Customer related-summary keeps its own multi-key Depends; still require boutique view.
    if sub.startswith("/customers/"):
        return "boutique.orders.view"

    if m == "POST" and re.fullmatch(r"/orders", sub):
        return "boutique.orders.create"

    if m in ("POST", "PATCH", "PUT", "DELETE"):
        return "boutique.orders.edit"

    return "boutique.orders.view"


def require_boutique_access(request: Request) -> str:
    """FastAPI dependency: authenticate and enforce boutique permission for the route."""
    key = permission_for_boutique_route(request.method, request.url.path)
    if key is None:
        return "anonymous"

    username = _decode_token(authorization=request.headers.get("Authorization"))
    user = _load_user_by_username(username)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    cached = permission_cache.get(_perm_key(user.username, oid)) or {}
    if "*" in list(cached.get("permissions") or []):
        return username
    authz = _access().authorization
    if not authz.can(user, key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {key}",
        )
    return username
