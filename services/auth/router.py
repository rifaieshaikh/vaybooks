"""Auth API — Mongo-backed login, session, working location."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from packages.auth_cache.memory import InProcessPermissionCache
from packages.services_kit.access_container import get_access_container
from packages.services_kit.inventory_container import get_inventory_container
from packages.tenancy.context import DEFAULT_ORG_ID, get_org_id, set_org_id
from vaybooks.bms.domain.entitlements.catalog import ROLE_OWNER, SYSTEM_ROLE_DEFINITIONS
from vaybooks.bms.domain.identity.location_access import (
    ALL_LOCATIONS,
    accessible_locations,
    can_select_all,
    default_working_location_id,
)
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/auth", tags=["auth"])

permission_cache = InProcessPermissionCache()

JWT_SECRET = os.getenv("JWT_SECRET", "vaybooks-dev-secret-change-me-32b")
JWT_ALGORITHM = "HS256"
JWT_TTL_HOURS = int(os.getenv("JWT_TTL_HOURS", "8"))
DEFAULT_ADMIN_USERNAME = os.getenv("VAYBOOKS_SEED_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("VAYBOOKS_SEED_ADMIN_PASSWORD", "admin")


class LoginRequest(BaseModel):
    username: str
    password: str
    org_id: str = DEFAULT_ORG_ID


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]


class UserResponse(BaseModel):
    user: dict[str, Any]


class WorkingLocationBody(BaseModel):
    working_location_id: str = Field(min_length=1)


def _perm_key(username: str, org_id: str | None = None) -> str:
    oid = (org_id or get_org_id() or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    return f"perm:{oid}:{username}"


def _create_access_token(username: str, user_id: str, org_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "uid": user_id,
        "org_id": org_id or DEFAULT_ORG_ID,
        "iat": now,
        "exp": now + timedelta(hours=JWT_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_bearer_payload(authorization: str | None) -> dict[str, Any] | None:
    """Decode JWT without session-cache checks. Returns None if missing/invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def _decode_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    username_s = str(username)
    oid = str(payload.get("org_id") or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    set_org_id(oid)
    # Logout clears the in-process session cache; treat missing cache as logged out.
    if permission_cache.get(_perm_key(username_s, oid)) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or logged out",
        )
    return username_s


def _access():
    return get_access_container()


def _ensure_system_roles() -> None:
    roles = _access().roles
    for role_id, spec in SYSTEM_ROLE_DEFINITIONS.items():
        existing = None
        try:
            existing = roles.get_role(role_id) if hasattr(roles, "get_role") else None
        except Exception:
            existing = None
        if existing:
            continue
        # RoleAppService may expose create_role / ensure; fall back to repo via create
        try:
            if hasattr(roles, "ensure_system_role"):
                roles.ensure_system_role(role_id)
                continue
        except Exception:
            pass
        try:
            from vaybooks.bms.domain.identity.entities import Role

            role = Role(
                id=role_id,
                name=str(spec.get("name") or role_id),
                description=str(spec.get("description") or ""),
                permission_keys=list(spec.get("permission_keys") or []),
                is_system=True,
            )
            if hasattr(roles, "_role_repo"):
                roles._role_repo.save(role)  # noqa: SLF001
        except Exception:
            continue


def _ensure_seed_admin() -> None:
    import os

    if os.environ.get("VAYBOOKS_SKIP_DEFAULT_ADMIN", "").strip() in {"1", "true", "True"}:
        return
    users = _access().users
    if users.list_users():
        return
    _ensure_system_roles()
    try:
        users.create_user(
            username=DEFAULT_ADMIN_USERNAME,
            display_name="Administrator",
            password=DEFAULT_ADMIN_PASSWORD,
            role_ids=[ROLE_OWNER],
            location_ids=[],
            active=True,
        )
    except ValidationError:
        # Race or role validation — try without roles as last resort
        try:
            users.create_user(
                username=DEFAULT_ADMIN_USERNAME,
                display_name="Administrator",
                password=DEFAULT_ADMIN_PASSWORD,
                role_ids=[],
                location_ids=[],
                active=True,
            )
        except Exception:
            pass
    except Exception:
        pass


def _user_payload(user: Any, *, working_location_id: Optional[str] = None) -> dict[str, Any]:
    authz = _access().authorization
    perms = sorted(authz.effective_keys(user)) if authz and user else []
    # Owner / empty effective keys in early seed: grant all for usability
    if user and ROLE_OWNER in (getattr(user, "role_ids", None) or []) and not perms:
        perms = ["*"]
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    cached = permission_cache.get(_perm_key(user.username, oid)) or {}
    work = working_location_id
    if work is None:
        work = cached.get("working_location_id")
    return {
        "id": getattr(user, "id", "") or "",
        "username": getattr(user, "username", "") or "",
        "display_name": getattr(user, "display_name", "") or getattr(user, "username", ""),
        "org_id": oid,
        "role_ids": list(getattr(user, "role_ids", None) or []),
        "location_ids": list(getattr(user, "location_ids", None) or []),
        "active": bool(getattr(user, "active", True)),
        "permissions": perms or list(cached.get("permissions") or []),
        "working_location_id": work,
    }


def _load_user_by_username(username: str) -> Any:
    user = _access().users.get_by_username(username)
    if user is None or not getattr(user, "active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive user",
        )
    return user


def _cache_session(user: Any, working_location_id: str) -> None:
    authz = _access().authorization
    perms = sorted(authz.effective_keys(user)) if authz else []
    if ROLE_OWNER in (getattr(user, "role_ids", None) or []) and not perms:
        perms = ["*"]
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    permission_cache.set(
        _perm_key(user.username, oid),
        {
            "user_id": user.id,
            "username": user.username,
            "org_id": oid,
            "permissions": perms or ["*"],
            "modules": ["*"],
            "working_location_id": working_location_id,
            "location_ids": list(getattr(user, "location_ids", None) or []),
            "role_ids": list(getattr(user, "role_ids", None) or []),
        },
    )


def _working_location_payload(user: Any) -> dict[str, Any]:
    inventory = get_inventory_container().inventory
    locs = accessible_locations(user, inventory)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    cached = permission_cache.get(_perm_key(user.username, oid)) or {}
    current = cached.get("working_location_id")
    if not current:
        current = default_working_location_id(user, locs)
        _cache_session(user, current)
    allow_all = can_select_all(user, locs)
    # If current is invalid, reset
    valid_ids = {getattr(loc, "id", "") for loc in locs}
    if current != ALL_LOCATIONS and current not in valid_ids:
        current = default_working_location_id(user, locs)
        _cache_session(user, current)
    if current == ALL_LOCATIONS and not allow_all and locs:
        current = locs[0].id
        _cache_session(user, current)
    return {
        "working_location_id": current,
        "allow_all": allow_all,
        "accessible": [
            {
                "id": getattr(loc, "id", ""),
                "code": getattr(loc, "code", ""),
                "name": getattr(loc, "name", ""),
            }
            for loc in locs
        ],
    }


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    username = (body.username or "").strip()
    password = (body.password or "").strip()
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="username and password are required",
        )

    oid = (body.org_id or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    set_org_id(oid)

    _ensure_seed_admin()
    try:
        user = _access().users.authenticate(username, password, org_id=oid)
    except TypeError:
        # Older service signature without org_id
        try:
            user = _access().users.authenticate(username, password)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(exc) or "Invalid username or password",
            ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc) or "Invalid username or password",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        ) from exc

    user_org = getattr(user, "org_id", None) or oid
    set_org_id(user_org)
    inventory = get_inventory_container().inventory
    locs = accessible_locations(user, inventory)
    work = default_working_location_id(user, locs)
    _cache_session(user, work)
    token = _create_access_token(user.username, user.id, user_org)
    return LoginResponse(
        access_token=token,
        user=_user_payload(user, working_location_id=work),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(username: str = Depends(_decode_token)) -> None:
    permission_cache.delete(_perm_key(username))


@router.get("/me", response_model=UserResponse)
def me(username: str = Depends(_decode_token)) -> UserResponse:
    user = _load_user_by_username(username)
    payload = _working_location_payload(user)
    return UserResponse(
        user=_user_payload(user, working_location_id=payload["working_location_id"])
    )


@router.get("/working-location")
def get_working_location(username: str = Depends(_decode_token)) -> dict[str, Any]:
    user = _load_user_by_username(username)
    return _working_location_payload(user)


@router.put("/working-location")
def put_working_location(
    body: WorkingLocationBody,
    username: str = Depends(_decode_token),
) -> dict[str, Any]:
    user = _load_user_by_username(username)
    inventory = get_inventory_container().inventory
    locs = accessible_locations(user, inventory)
    requested = (body.working_location_id or "").strip()
    allow_all = can_select_all(user, locs)
    valid_ids = {getattr(loc, "id", "") for loc in locs}
    if requested == ALL_LOCATIONS:
        if not allow_all:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All locations is not allowed for this user",
            )
    elif requested not in valid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location is not accessible",
        )
    _cache_session(user, requested)
    return _working_location_payload(user)
