"""Access API — users, roles, permissions, plans, feature flags, audit (Mongo)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit.access_container import get_access_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.entitlements.catalog import ALL_FEATURE_KEYS, PERMISSIONS
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/access", tags=["access"])


class UserCreate(BaseModel):
    username: str = Field(min_length=1)
    display_name: str = ""
    password: str = Field(min_length=4)
    role_ids: list[str] = Field(default_factory=list)
    location_ids: list[str] = Field(default_factory=list)
    active: bool = True


class UserPatch(BaseModel):
    display_name: Optional[str] = None
    role_ids: Optional[list[str]] = None
    location_ids: Optional[list[str]] = None
    active: Optional[bool] = None


class PasswordBody(BaseModel):
    password: str = Field(min_length=4)


class RoleCreate(BaseModel):
    name: str = Field(min_length=1)
    permission_keys: list[str] = Field(default_factory=list)
    description: str = ""
    clone_from_role_id: str = ""


class RolePatch(BaseModel):
    name: Optional[str] = None
    permission_keys: Optional[list[str]] = None
    description: Optional[str] = None


class PlanCreate(BaseModel):
    name: str = Field(min_length=1)
    feature_keys: list[str] = Field(default_factory=list)
    description: str = ""
    clone_from_plan_id: str = ""


class PlanPatch(BaseModel):
    name: Optional[str] = None
    feature_keys: Optional[list[str]] = None
    description: Optional[str] = None


class FlagBody(BaseModel):
    enabled: bool


class OrgPlanBody(BaseModel):
    plan_id: str = Field(min_length=1)


class OrgModulesBody(BaseModel):
    modules: list[str] = Field(min_length=1)


def _c():
    return get_access_container()


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _user_dict(user: Any) -> dict[str, Any]:
    data = entity_dict(user)
    data.pop("password_hash", None)
    return data


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "access", "status": "ok", "backend": _c().backend}


@router.get("/users")
def list_users() -> list[dict[str, Any]]:
    return [_user_dict(u) for u in _c().users.list_users()]


@router.post("/users", status_code=201)
def create_user(body: UserCreate) -> dict[str, Any]:
    try:
        user = _c().users.create_user(
            username=body.username,
            display_name=body.display_name,
            password=body.password,
            role_ids=body.role_ids,
            location_ids=body.location_ids,
            active=body.active,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return _user_dict(user)


@router.get("/users/{user_id}")
def get_user(user_id: str) -> dict[str, Any]:
    user = _c().users.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_dict(user)


@router.patch("/users/{user_id}")
def patch_user(user_id: str, body: UserPatch) -> dict[str, Any]:
    try:
        user = _c().users.update_user(
            user_id,
            display_name=body.display_name,
            role_ids=body.role_ids,
            location_ids=body.location_ids,
            active=body.active,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return _user_dict(user)


@router.post("/users/{user_id}/password")
def set_password(user_id: str, body: PasswordBody) -> dict[str, Any]:
    try:
        user = _c().users.set_password(user_id, body.password)
    except Exception as exc:
        raise _http_err(exc) from exc
    return _user_dict(user)


@router.get("/roles")
def list_roles() -> list[dict[str, Any]]:
    return [entity_dict(r) for r in _c().roles.list_roles()]


@router.post("/roles", status_code=201)
def create_role(body: RoleCreate) -> dict[str, Any]:
    try:
        role = _c().roles.create_custom_role(
            name=body.name,
            permission_keys=body.permission_keys,
            description=body.description,
            clone_from_role_id=body.clone_from_role_id,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(role)


@router.get("/roles/{role_id}")
def get_role(role_id: str) -> dict[str, Any]:
    role = _c().roles.get_role(role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return entity_dict(role)


@router.patch("/roles/{role_id}")
def patch_role(role_id: str, body: RolePatch) -> dict[str, Any]:
    try:
        role = _c().roles.update_custom_role(
            role_id,
            name=body.name,
            permission_keys=body.permission_keys,
            description=body.description,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(role)


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(role_id: str) -> None:
    try:
        _c().roles.delete_custom_role(role_id)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/permissions")
def permissions_matrix() -> dict[str, Any]:
    auth = _c().authorization
    assignable = sorted(auth.assignable_permission_keys())
    entitlement = sorted(auth.entitlement_keys())
    return {
        "all_permissions": sorted(PERMISSIONS),
        "all_feature_keys": sorted(ALL_FEATURE_KEYS),
        "entitlement_keys": entitlement,
        "assignable_permission_keys": assignable,
        "org": entity_dict(auth.get_org_entitlement()),
    }


@router.get("/plans")
def list_plans() -> list[dict[str, Any]]:
    return [entity_dict(p) for p in _c().plans.list_plans()]


@router.post("/plans", status_code=201)
def create_plan(body: PlanCreate) -> dict[str, Any]:
    try:
        plan = _c().plans.create_plan(
            name=body.name,
            feature_keys=body.feature_keys,
            description=body.description,
            clone_from_plan_id=body.clone_from_plan_id,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(plan)


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str) -> dict[str, Any]:
    plan = _c().plans.get_plan(plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return entity_dict(plan)


@router.patch("/plans/{plan_id}")
def patch_plan(plan_id: str, body: PlanPatch) -> dict[str, Any]:
    try:
        plan = _c().plans.update_plan(
            plan_id,
            name=body.name,
            feature_keys=body.feature_keys,
            description=body.description,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(plan)


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: str) -> None:
    try:
        _c().plans.delete_plan(plan_id)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/org-entitlement")
def get_org_entitlement() -> dict[str, Any]:
    return entity_dict(_c().plans.get_org_entitlement())


@router.put("/org-entitlement/plan")
def set_org_plan(body: OrgPlanBody) -> dict[str, Any]:
    try:
        return entity_dict(_c().plans.set_plan(body.plan_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.put("/org-entitlement/modules")
def set_org_modules(body: OrgModulesBody) -> dict[str, Any]:
    try:
        return entity_dict(_c().plans.set_enabled_modules(body.modules))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/feature-flags")
def list_feature_flags() -> list[dict[str, Any]]:
    return [entity_dict(f) for f in _c().feature_flags.list_flags()]


@router.put("/feature-flags/{key}")
def set_feature_flag(key: str, body: FlagBody) -> dict[str, Any]:
    try:
        return entity_dict(_c().feature_flags.set_enabled(key, body.enabled))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/audit-logs")
def list_audit_logs(
    actor_id: str = "",
    action: str = "",
    limit: int = 200,
) -> list[dict[str, Any]]:
    rows = _c().audit.list_entries(
        actor_id=actor_id,
        action=action,
        limit=max(1, min(limit, 1000)),
    )
    return [entity_dict(r) for r in rows]
