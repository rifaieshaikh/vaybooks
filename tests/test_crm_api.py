"""CRM typed API smoke tests (Mongo only)."""

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


def test_crm_health() -> None:
    r = c.get("/api/crm/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_lead_enquiry_activity_overview_reports() -> None:
    h = _auth_headers(_login_admin())
    lead = c.post(
        "/api/crm/leads",
        headers=h,
        json={
            "name": _uniq("Lead"),
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "location_id": "loc-test",
            "allow_duplicate": True,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]
    assert lead.json()["name"]

    listed = c.get("/api/crm/leads", headers=h)
    assert listed.status_code == 200
    body = listed.json()
    items = body["items"] if isinstance(body, dict) else body
    assert any(row.get("id") == lead_id for row in items)

    got = c.get(f"/api/crm/leads/{lead_id}", headers=h)
    assert got.status_code == 200
    assert got.json()["id"] == lead_id

    patched = c.patch(f"/api/crm/leads/{lead_id}", headers=h, json={"notes": "follow up"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["notes"] == "follow up"

    assigned = c.post(
        f"/api/crm/leads/{lead_id}/assign",
        headers=h,
        json={"assigned_user_id": "sales-1", "assigned_user_name": "Sales One"},
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["assigned_user_id"] == "sales-1"

    status = c.post(
        f"/api/crm/leads/{lead_id}/status", headers=h, json={"status": "Contacted"}
    )
    assert status.status_code == 200, status.text
    assert status.json()["status"] == "Contacted"

    lost = c.post(
        f"/api/crm/leads/{lead_id}/mark-lost", headers=h, json={"reason": "Budget"}
    )
    assert lost.status_code == 200, lost.text
    assert lost.json()["status"] == "Lost"
    assert lost.json()["lost_reason"] == "Budget"

    reopened = c.post(f"/api/crm/leads/{lead_id}/reopen", headers=h, json={})
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["status"] == "Follow-up Required"

    enquiry = c.post(
        "/api/crm/enquiries",
        headers=h,
        json={"lead_id": lead_id, "description": "Need quote", "product_interest": "Fabric"},
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry_id = enquiry.json()["id"]

    activity = c.post(
        "/api/crm/activities",
        headers=h,
        json={
            "activity_type": "Called",
            "lead_id": lead_id,
            "notes": "Intro call",
            "location_id": "loc-test",
        },
    )
    assert activity.status_code == 201, activity.text
    activity_id = activity.json()["id"]

    completed = c.post(
        f"/api/crm/activities/{activity_id}/complete",
        headers=h,
        json={"outcome": "Interested", "notes": "done"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "Completed"

    timeline = c.get(f"/api/crm/leads/{lead_id}/timeline", headers=h)
    assert timeline.status_code == 200, timeline.text
    assert any(row.get("id") == activity_id for row in timeline.json())

    cal = c.get("/api/crm/calendar", headers=h)
    assert cal.status_code == 200
    assert any(row.get("id") == activity_id for row in cal.json())

    overview = c.get("/api/crm/overview", headers=h)
    assert overview.status_code == 200
    assert overview.json()["total_active_leads"] >= 1

    owners = c.get("/api/crm/owners", headers=h)
    assert owners.status_code == 200
    assert isinstance(owners.json(), list)

    catalog = c.get("/api/crm/reports/catalog", headers=h)
    assert catalog.status_code == 200
    reports = catalog.json()["reports"]
    assert len(reports) >= 1
    run = c.post(
        "/api/crm/reports/run",
        headers=h,
        json={"report_id": reports[0]["id"], "filters": {}},
    )
    assert run.status_code == 200, run.text
    assert "rows" in run.json()

    settings = c.get("/api/crm/settings", headers=h)
    assert settings.status_code == 200
    updated = c.patch(
        "/api/crm/settings", headers=h, json={"default_follow_up_days": 5}
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["default_follow_up_days"] == 5

    assert c.get(f"/api/crm/enquiries/{enquiry_id}", headers=h).status_code == 200
    assert c.get(f"/api/crm/activities/{activity_id}", headers=h).status_code == 200

    converted = c.post(f"/api/crm/leads/{lead_id}/convert", headers=h, json={})
    assert converted.status_code == 200, converted.text
    assert converted.json()["status"] == "Converted"
    assert converted.json()["customer_id"]
