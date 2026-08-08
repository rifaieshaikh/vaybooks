"""Auth API routes (Phase 1 stub)."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from packages.auth_cache.memory import InProcessPermissionCache

router = APIRouter(prefix="/api/auth", tags=["auth"])

permission_cache = InProcessPermissionCache()

JWT_SECRET = os.getenv("JWT_SECRET", "vaybooks-dev-secret-change-me-32b")
JWT_ALGORITHM = "HS256"
JWT_TTL_HOURS = int(os.getenv("JWT_TTL_HOURS", "8"))


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]


class UserResponse(BaseModel):
    user: dict[str, Any]


def _perm_key(username: str) -> str:
    return f"perm:{username}"


def _create_access_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + timedelta(hours=JWT_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


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
    return str(username)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    username = (body.username or "").strip()
    password = (body.password or "").strip()
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="username and password are required",
        )

    user = {
        "id": username,
        "username": username,
        "display_name": username,
    }
    permission_cache.set(
        _perm_key(username),
        {
            "user_id": username,
            "permissions": ["*"],
            "modules": ["*"],
        },
    )
    token = _create_access_token(username)
    return LoginResponse(access_token=token, user=user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(username: str = Depends(_decode_token)) -> None:
    permission_cache.delete(_perm_key(username))


@router.get("/me", response_model=UserResponse)
def me(username: str = Depends(_decode_token)) -> UserResponse:
    cached = permission_cache.get(_perm_key(username))
    user = {
        "id": username,
        "username": username,
        "display_name": username,
        "permissions": (cached or {}).get("permissions", []),
    }
    return UserResponse(user=user)
