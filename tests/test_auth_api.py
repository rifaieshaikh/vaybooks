"""Auth API smoke tests — real Mongo login, me, logout, working-location."""

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


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_rejects_bad_password() -> None:
    # Ensure seed or create a known user first via login seed path
    seed = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert seed.status_code in (200, 401), seed.text

    bad = c.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})
    assert bad.status_code == 401


def test_login_me_logout_working_location() -> None:
    login = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    if login.status_code != 200:
        # Create via access API then login
        username = _uniq("authuser")
        created = c.post(
            "/api/access/users",
            json={
                "username": username,
                "display_name": "Auth Smoke",
                "password": "test-pass",
                "role_ids": [],
            },
        )
        assert created.status_code == 201, created.text
        login = c.post("/api/auth/login", json={"username": username, "password": "test-pass"})
    assert login.status_code == 200, login.text
    body = login.json()
    assert "access_token" in body
    token = body["access_token"]
    assert body["user"]["username"]

    me = c.get("/api/auth/me", headers=_auth_headers(token))
    assert me.status_code == 200, me.text
    assert me.json()["user"]["username"]

    unauth = c.get("/api/auth/me")
    assert unauth.status_code == 401

    wl = c.get("/api/auth/working-location", headers=_auth_headers(token))
    assert wl.status_code == 200, wl.text
    assert "working_location_id" in wl.json()
    assert "accessible" in wl.json()

    # Invalid location rejected
    bad_put = c.put(
        "/api/auth/working-location",
        headers=_auth_headers(token),
        json={"working_location_id": "not-a-real-location"},
    )
    assert bad_put.status_code == 400

    accessible = wl.json().get("accessible") or []
    if accessible:
        loc_id = accessible[0]["id"]
        put = c.put(
            "/api/auth/working-location",
            headers=_auth_headers(token),
            json={"working_location_id": loc_id},
        )
        assert put.status_code == 200, put.text
        assert put.json()["working_location_id"] == loc_id

    logout = c.post("/api/auth/logout", headers=_auth_headers(token))
    assert logout.status_code == 204

    me_after = c.get("/api/auth/me", headers=_auth_headers(token))
    assert me_after.status_code == 401


def test_notifications_list_requires_auth_and_empty_ok() -> None:
    assert c.get("/api/notifications").status_code == 401

    login = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    if login.status_code != 200:
        username = _uniq("notif")
        c.post(
            "/api/access/users",
            json={
                "username": username,
                "display_name": "N",
                "password": "test-pass",
                "role_ids": [],
            },
        )
        login = c.post("/api/auth/login", json={"username": username, "password": "test-pass"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    listed = c.get("/api/notifications", headers=_auth_headers(token))
    assert listed.status_code == 200, listed.text
    assert isinstance(listed.json(), list)

    missing = c.post(
        "/api/notifications/does-not-exist/read",
        headers=_auth_headers(token),
    )
    # Scheduler mark may be idempotent (204) or raise 404/400 for unknown ids.
    assert missing.status_code in (204, 400, 404)
