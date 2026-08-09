"""Org setup status/complete APIs and platform org create."""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from packages.services_kit.access_container import get_access_container
from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
from packages.tenancy.context import DEFAULT_ORG_ID, get_org_id, set_org_id
from pymongo import MongoClient
from vaybooks.bms.application.setup.bootstrap import (
    complete_org_setup,
    ensure_system_roles,
    normalize_modules,
)
from vaybooks.bms.domain.entitlements.catalog import ROLE_OWNER
from vaybooks.bms.domain.entitlements.entities import OrgEntitlement
from vaybooks.bms.domain.shared.exceptions import ValidationError
from vaybooks.bms.infrastructure.repositories.entitlements.mongo_entitlement_repository import (
    MongoOrgEntitlementRepository,
)
from services.auth.router import _decode_token, _load_user_by_username

router = APIRouter(tags=["setup"])

PLATFORM_API_KEY = os.getenv("PLATFORM_API_KEY", "").strip()

SETUP_ALLOWLIST_PREFIXES = (
    "/health",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/setup",
    "/api/orgs",
    "/api/license",
    "/docs",
    "/openapi.json",
    "/redoc",
)


def _db():
    uri = mongo_uri()
    if not uri:
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return client[mongo_db_name()]


class BusinessBody(BaseModel):
    legal_name: str = ""
    trade_name: str = ""
    gstin: str = ""
    phone: str = ""
    email: str = ""
    state_code: str = ""
    fy_start_month: int = 4


class PrimaryLocationBody(BaseModel):
    code: str = "MAIN"
    name: str = "Main Warehouse"
    location_type: str = "Warehouse"
    address: str = ""


class SetupCompleteBody(BaseModel):
    business: BusinessBody = Field(default_factory=BusinessBody)
    enabled_modules: list[str] = Field(default_factory=list)
    license_key: str = ""
    primary_location: PrimaryLocationBody = Field(default_factory=PrimaryLocationBody)


class OwnerBody(BaseModel):
    username: str
    password: str
    display_name: str = ""


class CreateOrgBody(BaseModel):
    org_id: str = Field(min_length=2, max_length=64)
    org_name: str = ""
    owner: OwnerBody


@router.get("/api/setup/status")
def setup_status(username: str = Depends(_decode_token)) -> dict[str, Any]:
    user = _load_user_by_username(username)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    set_org_id(oid)
    ent = MongoOrgEntitlementRepository(_db()).get(oid)
    completed = bool(ent and ent.setup_completed)
    return {"setup_completed": completed, "org_id": oid}


@router.post("/api/setup/complete")
def setup_complete(
    body: SetupCompleteBody, username: str = Depends(_decode_token)
) -> dict[str, Any]:
    user = _load_user_by_username(username)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    set_org_id(oid)
    db = _db()
    repo = MongoOrgEntitlementRepository(db)
    ent = repo.get(oid)
    if ent and ent.setup_completed:
        return {"setup_completed": True, "org_id": oid, "idempotent": True}

    access = get_access_container()
    users = access.users.list_users()
    is_owner = ROLE_OWNER in (getattr(user, "role_ids", None) or [])
    sole = len(users) <= 1
    if not is_owner and not sole:
        raise HTTPException(status_code=403, detail="Owner role required to complete setup")

    try:
        complete_org_setup(
            db,
            org_id=oid,
            business=body.business.model_dump(),
            enabled_modules=body.enabled_modules,
            license_key=body.license_key or "",
            primary_location=body.primary_location.model_dump(),
            owner_user_id=getattr(user, "id", "") or "",
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"setup_completed": True, "org_id": oid}


@router.post("/api/orgs", status_code=status.HTTP_201_CREATED)
def create_org(
    body: CreateOrgBody,
    x_platform_key: str | None = Header(default=None, alias="X-Platform-Key"),
) -> dict[str, Any]:
    if not PLATFORM_API_KEY or (x_platform_key or "").strip() != PLATFORM_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid platform key")
    oid = body.org_id.strip().lower().replace(" ", "_")
    if oid == "default":
        raise HTTPException(status_code=400, detail="Reserve 'default' for single-tenant installs")
    set_org_id(oid)
    db = _db()
    repo = MongoOrgEntitlementRepository(db)
    if repo.get(oid) is not None:
        raise HTTPException(status_code=409, detail="Organization already exists")

    ensure_system_roles(db)
    ent = OrgEntitlement(
        id=oid,
        setup_completed=False,
        enabled_modules=normalize_modules(["core", "parties", "settings"]),
    )
    repo.save(ent)

    access = get_access_container()
    try:
        access.users.create_user(
            username=body.owner.username,
            display_name=body.owner.display_name or body.owner.username,
            password=body.owner.password,
            role_ids=[ROLE_OWNER],
            location_ids=[],
            org_id=oid,
            active=True,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "org_id": oid,
        "org_name": body.org_name or oid,
        "setup_completed": False,
        "owner_username": body.owner.username,
    }


def setup_required_blocked(path: str) -> bool:
    """Return True when path must be blocked until setup_completed."""
    for prefix in SETUP_ALLOWLIST_PREFIXES:
        if path == prefix or path.startswith(prefix + "/"):
            return False
    return True
