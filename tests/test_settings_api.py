"""Settings typed API smoke tests (Mongo only)."""

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


def test_settings_health() -> None:
    r = c.get("/api/settings/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_business_prefs_activities_specs_services_discounts() -> None:
    prefs = c.put("/api/settings/prefs", json={"timezone": "Asia/Kolkata", "locale": "en-IN"})
    assert prefs.status_code == 200, prefs.text
    assert prefs.json()["timezone"] == "Asia/Kolkata"

    business = c.get("/api/settings/business")
    assert business.status_code == 200
    patched = c.patch(
        "/api/settings/business",
        json={"legal_name": _uniq("Biz"), "trade_name": "Smoke Trade"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["trade_name"] == "Smoke Trade"

    print_settings = c.get("/api/settings/print")
    assert print_settings.status_code == 200
    assert "document_templates" in print_settings.json()

    keyboard = c.get("/api/settings/keyboard")
    assert keyboard.status_code == 200
    assert "parents" in keyboard.json()
    assert "actions" in keyboard.json()

    activity = c.post(
        "/api/settings/activities",
        json={
            "activity_name": _uniq("Stitch"),
            "activity_category": "In House Service",
            "default_hourly_expense": 100,
        },
    )
    assert activity.status_code == 201, activity.text

    store_act = c.post(
        "/api/settings/store-activities",
        json={
            "activity_name": _uniq("Shelf"),
            "activity_category": "In House Service",
            "default_hourly_expense": 50,
        },
    )
    assert store_act.status_code == 201, store_act.text

    project_act = c.post(
        "/api/settings/project-activities",
        json={
            "activity_name": _uniq("Site"),
            "activity_category": "In House Service",
            "default_hourly_rate": 200,
        },
    )
    assert project_act.status_code == 201, project_act.text

    spec = c.post(
        "/api/settings/measurement-specs",
        json={
            "key": _uniq("chest"),
            "label": "Chest",
            "person_types": ["Men"],
            "section": "Torso",
        },
    )
    assert spec.status_code == 201, spec.text
    spec_id = spec.json()["id"]
    specs = c.get("/api/settings/measurement-specs")
    assert specs.status_code == 200
    assert any(row.get("id") == spec_id for row in specs.json())

    # Need a finance expense account id — create via finance accounts API if available
    accounts = c.get("/api/finance/accounts")
    expense_account_id = "exp-smoke"
    if accounts.status_code == 200 and accounts.json():
        expense_account_id = str(accounts.json()[0].get("id") or expense_account_id)

    service = c.post(
        "/api/settings/services",
        json={"service_name": _uniq("Alteration"), "expense_account_id": expense_account_id},
    )
    assert service.status_code == 201, service.text

    discount = c.post(
        "/api/settings/discounts",
        json={"name": _uniq("Festive"), "scope": "global", "discount_type": "percent", "value": 10},
    )
    assert discount.status_code == 201, discount.text

    crm = c.get("/api/settings/crm", follow_redirects=False)
    assert crm.status_code in (307, 302)
    assert "/api/crm/settings" in crm.headers.get("location", "")

    locations = c.get("/api/settings/locations", follow_redirects=False)
    assert locations.status_code in (307, 302)
    assert "/api/inventory/locations" in locations.headers.get("location", "")

    production = c.get("/api/settings/production")
    assert production.status_code == 200
    assert production.json()["status"] == "stub"
