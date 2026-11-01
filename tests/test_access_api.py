"""Access typed API smoke tests (Mongo only)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.mongo_test_env import require_mongo, reset_all_containers


@pytest.fixture(autouse=True)
def _mongo():
    require_mongo()
    reset_all_containers()
    yield


from services.combined.main import app  # noqa: E402

c = TestClient(app)


def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_access_health() -> None:
    r = c.get("/api/access/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_users_roles_permissions_plans_flags_audit() -> None:
    role = c.post(
        "/api/access/roles",
        json={
            "name": _uniq("Role"),
            "permission_keys": [],
            "description": "custom",
        },
    )
    assert role.status_code == 201, role.text
    role_id = role.json()["id"]

    user = c.post(
        "/api/access/users",
        json={
            "username": _uniq("user"),
            "display_name": "Smoke User",
            "password": "test-pass",
            "role_ids": [role_id],
        },
    )
    assert user.status_code == 201, user.text
    user_id = user.json()["id"]
    assert "password_hash" not in user.json()

    listed = c.get("/api/access/users")
    assert listed.status_code == 200
    assert any(row.get("id") == user_id for row in listed.json())

    patched = c.patch(
        f"/api/access/users/{user_id}",
        json={"display_name": "Updated User"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["display_name"] == "Updated User"

    perms = c.get("/api/access/permissions")
    assert perms.status_code == 200
    body = perms.json()
    assert "assignable_permission_keys" in body
    assert "all_permissions" in body

    plans = c.get("/api/access/plans")
    assert plans.status_code == 200
    assert len(plans.json()) >= 1

    plan = c.post(
        "/api/access/plans",
        json={
            "name": _uniq("Plan"),
            "feature_keys": ["core.dashboard.view"],
            "description": "smoke",
        },
    )
    assert plan.status_code == 201, plan.text

    flag = c.put("/api/access/feature-flags/core.dashboard.view", json={"enabled": True})
    assert flag.status_code == 200, flag.text
    assert flag.json()["enabled"] is True

    flags = c.get("/api/access/feature-flags")
    assert flags.status_code == 200
    assert any(row.get("key") == "core.dashboard.view" for row in flags.json())

    audit = c.get("/api/access/audit-logs")
    assert audit.status_code == 200
    assert any(row.get("action", "").startswith("user.") for row in audit.json())

    roles = c.get("/api/access/roles")
    assert roles.status_code == 200
    assert any(row.get("id") == role_id for row in roles.json())
