"""API tests: module gating on /me, org modules PUT, invalid location types."""

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


def _login_admin() -> str:
    login = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


def _ensure_setup(token: str) -> None:
    headers = _auth_headers(token)
    status = c.get("/api/setup/status", headers=headers)
    if status.status_code != 200:
        return
    if status.json().get("setup_completed"):
        return
    done = c.post(
        "/api/setup/complete",
        headers=headers,
        json={
            "business": {"legal_name": "Module Gate Co", "fy_start_month": 4},
            "enabled_modules": [
                "core",
                "parties",
                "settings",
                "inventory",
                "sales",
                "purchases",
                "finance",
            ],
            "primary_location": {
                "code": "MAIN",
                "name": "Main Warehouse",
                "location_type": "Warehouse",
                "address": "",
            },
        },
    )
    assert done.status_code == 200, done.text


def test_owner_me_reflects_enabled_modules_without_crm() -> None:
    token = _login_admin()
    _ensure_setup(token)
    headers = _auth_headers(token)

    trade = [
        "core",
        "parties",
        "settings",
        "inventory",
        "sales",
        "purchases",
        "finance",
    ]
    put = c.put(
        "/api/access/org-entitlement/modules",
        headers=headers,
        json={"modules": trade},
    )
    assert put.status_code == 200, put.text
    enabled = put.json().get("enabled_modules") or []
    assert "sales" in enabled
    assert "crm" not in enabled
    assert "boutique" not in enabled

    me = c.get("/api/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    user = me.json()["user"]
    assert "enabled_modules" in user
    assert "crm" not in (user.get("enabled_modules") or [])
    assert "*" not in (user.get("permissions") or [])
    perms = user.get("permissions") or []
    assert "module.crm" not in perms
    assert (
        "module.sales" in perms
        or "sales.invoices.view" in perms
        or "sales.overview.view" in perms
    )


def test_set_org_modules_round_trip() -> None:
    token = _login_admin()
    _ensure_setup(token)
    headers = _auth_headers(token)

    get1 = c.get("/api/access/org-entitlement", headers=headers)
    assert get1.status_code == 200, get1.text

    modules = ["core", "parties", "settings", "crm"]
    put = c.put(
        "/api/access/org-entitlement/modules",
        headers=headers,
        json={"modules": modules},
    )
    assert put.status_code == 200, put.text
    assert "crm" in (put.json().get("enabled_modules") or [])
    assert "core" in (put.json().get("enabled_modules") or [])
    assert "settings" in (put.json().get("enabled_modules") or [])

    get2 = c.get("/api/access/org-entitlement", headers=headers)
    assert get2.status_code == 200, get2.text
    assert "crm" in (get2.json().get("enabled_modules") or [])

    flags = c.get("/api/flags/modules", headers=headers)
    assert flags.status_code == 200, flags.text
    assert "crm" in (flags.json().get("modules") or [])


def test_invalid_location_type_rejected() -> None:
    token = _login_admin()
    _ensure_setup(token)
    headers = _auth_headers(token)

    bad = c.post(
        "/api/inventory/locations",
        headers=headers,
        json={
            "name": _uniq("BadLoc"),
            "code": _uniq("bad"),
            "location_type": "Store",
            "address": "",
            "is_active": True,
        },
    )
    assert bad.status_code == 400, bad.text
    assert "Warehouse" in bad.text or "Retail Store" in bad.text

    ok = c.post(
        "/api/inventory/locations",
        headers=headers,
        json={
            "name": _uniq("GoodLoc"),
            "code": _uniq("good"),
            "location_type": "Retail Store",
            "address": "",
            "is_active": True,
        },
    )
    assert ok.status_code == 201, ok.text
    assert ok.json().get("location_type") == "Retail Store"


def test_nav_item_visible_module_gate() -> None:
    """Mirror shell navItemVisible rules (TS) for regression without importing React."""

    def module_enabled(mod: str | None, enabled: list[str]) -> bool:
        if not mod:
            return True
        return mod in enabled

    def can(key: str, perms: list[str]) -> bool:
        return key in perms

    def visible(item: dict, enabled: list[str], perms: list[str]) -> bool:
        if not module_enabled(item.get("module"), enabled):
            return False
        perm = item.get("permission")
        if not perm:
            return True
        if not perms:
            return True
        if can(perm, perms):
            return True
        mod = item.get("module")
        return bool(mod and can(f"module.{mod}", perms))

    trade = ["core", "parties", "settings", "sales"]
    perms = ["module.sales", "sales.overview.view", "core.dashboard.view"]
    assert visible(
        {"module": "sales", "permission": "sales.overview.view"}, trade, perms
    )
    assert not visible(
        {"module": "crm", "permission": "crm.leads.view"}, trade, perms
    )
    assert visible({"module": "core", "permission": "core.dashboard.view"}, trade, perms)
