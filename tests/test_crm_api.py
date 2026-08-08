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


def test_crm_health() -> None:
    r = c.get("/api/crm/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_lead_enquiry_activity_overview_reports() -> None:
    lead = c.post(
        "/api/crm/leads",
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

    listed = c.get("/api/crm/leads")
    assert listed.status_code == 200
    assert any(row.get("id") == lead_id for row in listed.json())

    got = c.get(f"/api/crm/leads/{lead_id}")
    assert got.status_code == 200
    assert got.json()["id"] == lead_id

    patched = c.patch(f"/api/crm/leads/{lead_id}", json={"notes": "follow up"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["notes"] == "follow up"

    enquiry = c.post(
        "/api/crm/enquiries",
        json={"lead_id": lead_id, "description": "Need quote", "product_interest": "Fabric"},
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry_id = enquiry.json()["id"]

    activity = c.post(
        "/api/crm/activities",
        json={
            "activity_type": "Called",
            "lead_id": lead_id,
            "notes": "Intro call",
            "location_id": "loc-test",
        },
    )
    assert activity.status_code == 201, activity.text
    activity_id = activity.json()["id"]

    cal = c.get("/api/crm/calendar")
    assert cal.status_code == 200
    assert any(row.get("id") == activity_id for row in cal.json())

    overview = c.get("/api/crm/overview")
    assert overview.status_code == 200
    assert overview.json()["total_active_leads"] >= 1

    catalog = c.get("/api/crm/reports/catalog")
    assert catalog.status_code == 200
    reports = catalog.json()["reports"]
    assert len(reports) >= 1
    run = c.post("/api/crm/reports/run", json={"report_id": reports[0]["id"], "filters": {}})
    assert run.status_code == 200, run.text
    assert "rows" in run.json()

    settings = c.get("/api/crm/settings")
    assert settings.status_code == 200
    updated = c.patch("/api/crm/settings", json={"default_follow_up_days": 5})
    assert updated.status_code == 200, updated.text
    assert updated.json()["default_follow_up_days"] == 5

    assert c.get(f"/api/crm/enquiries/{enquiry_id}").status_code == 200
    assert c.get(f"/api/crm/activities/{activity_id}").status_code == 200
