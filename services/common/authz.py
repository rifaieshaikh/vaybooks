"""Shared Bearer authn + permission authz dependencies for module APIs."""

from __future__ import annotations

from typing import Callable, Iterable

from fastapi import Depends, HTTPException, status

from packages.tenancy.context import DEFAULT_ORG_ID, get_org_id
from services.auth.router import (
    _access,
    _decode_token,
    _load_user_by_username,
    _perm_key,
    permission_cache,
)


def require_permission(*permission_keys: str) -> Callable:
    """Require a valid Bearer session and all listed permission keys.

    Session permissions from login are already expanded concrete keys.
    ``*`` in the session cache grants all keys (owner bootstrap).
    """

    keys = tuple(k.strip() for k in permission_keys if (k or "").strip())

    def _dep(username: str = Depends(_decode_token)) -> str:
        if not keys:
            return username
        assert_permissions(username, keys)
        return username

    return _dep


def assert_permissions(username: str, permission_keys: Iterable[str]) -> None:
    """Raise 403 unless ``username`` has every listed permission (or ``*``)."""
    keys = [k.strip() for k in permission_keys if (k or "").strip()]
    if not keys:
        return
    user = _load_user_by_username(username)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    cached = permission_cache.get(_perm_key(user.username, oid)) or {}
    if "*" in list(cached.get("permissions") or []):
        return
    authz = _access().authorization
    for key in keys:
        if not authz.can(user, key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {key}",
            )
