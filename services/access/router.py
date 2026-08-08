"""Access module — thin BFF over Auth identity (no separate identity DB).

Admin UI (Access MFE) should call Auth for users/roles/permissions.
This module exposes convenience list endpoints that mirror Auth cache/state
for gateway routing under /api/access.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/access", tags=["access"])

# Local mirror for admin UX stubs — Auth remains SOR for tokens/permissions.
_USERS: dict[str, dict[str, Any]] = {}
_ROLES: dict[str, dict[str, Any]] = {
    "admin": {"id": "admin", "name": "Admin", "permissions": ["*"]},
    "staff": {"id": "staff", "name": "Staff", "permissions": ["module.parties", "module.sales"]},
}


class UserCreate(BaseModel):
    username: str = Field(min_length=1)
    display_name: str = ""
    role_ids: list[str] = Field(default_factory=lambda: ["staff"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "access", "status": "ok", "identity_sor": "auth"}


@router.get("/users")
def list_users() -> list[dict[str, Any]]:
    return list(_USERS.values())


@router.post("/users", status_code=201)
def create_user(body: UserCreate) -> dict[str, Any]:
    if body.username in _USERS:
        raise HTTPException(status_code=409, detail="user exists")
    for role_id in body.role_ids:
        if role_id not in _ROLES:
            raise HTTPException(status_code=400, detail=f"unknown role {role_id}")
    row = {
        "id": body.username,
        "username": body.username,
        "display_name": body.display_name or body.username,
        "role_ids": body.role_ids,
    }
    _USERS[body.username] = row
    return row


@router.get("/users/{username}")
def get_user(username: str) -> dict[str, Any]:
    row = _USERS.get(username)
    if not row:
        raise HTTPException(status_code=404, detail="user not found")
    return row


@router.get("/roles")
def list_roles() -> list[dict[str, Any]]:
    return list(_ROLES.values())


@router.get("/roles/{role_id}")
def get_role(role_id: str) -> dict[str, Any]:
    row = _ROLES.get(role_id)
    if not row:
        raise HTTPException(status_code=404, detail="role not found")
    return row
