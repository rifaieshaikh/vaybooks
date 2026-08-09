"""Projects typed API smoke tests (Mongo only)."""

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


def _seed_customer() -> str:
    customer = c.post(
        "/api/parties/customers",
        json={
            "customer_name": _uniq("ProjCust"),
            "phone_number": f"9{uuid.uuid4().int % 10**9:09d}",
        },
    )
    assert customer.status_code == 201, customer.text
    return customer.json()["id"]


def test_projects_health() -> None:
    r = c.get("/api/projects/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_project_enquiry_boq_measurement_ra_overview() -> None:
    customer_id = _seed_customer()

    enquiry = c.post(
        "/api/projects/enquiries",
        json={"customer_id": customer_id, "requirement": "Fit-out"},
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry_id = enquiry.json()["id"]
    assert c.get(f"/api/projects/enquiries/{enquiry_id}").status_code == 200

    project = c.post(
        "/api/projects",
        json={
            "name": _uniq("Proj"),
            "customer_id": customer_id,
            "contract_value": 100000,
            "location_id": "loc-test",
        },
    )
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    boq = c.post(
        f"/api/projects/{project_id}/boq",
        json={"code": "A1", "description": "Civil works", "qty": 10, "rate": 500},
    )
    assert boq.status_code == 201, boq.text
    boq_id = boq.json()["id"]

    meas = c.post(
        f"/api/projects/{project_id}/measurements",
        json={"boq_item_id": boq_id, "quantity": 2, "notes": "partial"},
    )
    assert meas.status_code == 201, meas.text

    ra = c.post(
        f"/api/projects/{project_id}/ra-bills",
        json={"claim_amount": 1000, "description": "RA-1"},
    )
    assert ra.status_code == 201, ra.text

    expense = c.post(
        f"/api/projects/{project_id}/expenses",
        json={"amount": 250, "category": "Material", "description": "Cement"},
    )
    assert expense.status_code == 201, expense.text

    dpr = c.post(
        f"/api/projects/{project_id}/dpr",
        json={"notes": "Day 1"},
    )
    assert dpr.status_code == 201, dpr.text

    portal = c.post(
        f"/api/projects/{project_id}/portal",
        json={"label": "client", "scope": "quote"},
    )
    assert portal.status_code == 201, portal.text

    workspace = c.get(f"/api/projects/{project_id}/workspace")
    assert workspace.status_code == 200, workspace.text
    assert workspace.json()["project"]["id"] == project_id

    site = c.get(f"/api/projects/{project_id}/site-mobile")
    assert site.status_code == 200

    overview = c.get("/api/projects/overview")
    assert overview.status_code == 200
    assert overview.json()["project_count"] >= 1

    catalog = c.get("/api/projects/reports/catalog")
    assert catalog.status_code == 200
    run = c.post(
        "/api/projects/reports/run",
        json={"report_type": catalog.json()["report_types"][0], "filters": {}},
    )
    assert run.status_code == 200, run.text

    assert c.get("/api/projects/settings").status_code == 200
    assert c.get("/api/projects/measurements").status_code == 200
    assert c.get("/api/projects/ra-bills").status_code == 200


def test_boq_measurement_certify_ra_budget_expense() -> None:
    customer_id = _seed_customer()
    project = c.post(
        "/api/projects",
        json={
            "name": _uniq("Depth"),
            "customer_id": customer_id,
            "contract_value": 50000,
            "location_id": "loc-test",
        },
    )
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    boq = c.post(
        f"/api/projects/{project_id}/boq",
        json={"code": "M1", "description": "Masonry", "qty": 5, "rate": 200},
    )
    assert boq.status_code == 201, boq.text
    boq_id = boq.json()["id"]

    meas = c.post(
        f"/api/projects/{project_id}/measurements",
        json={"boq_item_id": boq_id, "quantity": 1},
    )
    assert meas.status_code == 201, meas.text
    meas_id = meas.json()["id"]

    submitted = c.post(f"/api/projects/{project_id}/measurements/{meas_id}/submit")
    assert submitted.status_code == 200, submitted.text

    certified = c.post(
        f"/api/projects/{project_id}/measurements/{meas_id}/certify",
        json={"actor": "tester"},
    )
    assert certified.status_code == 200, certified.text

    ra = c.post(
        f"/api/projects/{project_id}/ra-bills",
        json={"claim_amount": 500, "description": "from meas", "measurement_ids": [meas_id]},
    )
    assert ra.status_code == 201, ra.text
    ra_id = ra.json()["id"]
    assert c.post(f"/api/projects/{project_id}/ra-bills/{ra_id}/submit").status_code == 200

    budget = c.get(f"/api/projects/{project_id}/budget")
    assert budget.status_code == 200, budget.text
    assert "summary" in budget.json()

    line = c.post(
        f"/api/projects/{project_id}/budget/lines",
        json={"cost_category": "Labour", "amount": 1500},
    )
    assert line.status_code == 201, line.text

    expense = c.post(
        f"/api/projects/{project_id}/expenses",
        json={"amount": 75, "category": "Material", "description": "nails"},
    )
    assert expense.status_code == 201, expense.text

    doc = c.post(
        f"/api/projects/{project_id}/documents",
        json={
            "name": "note.txt",
            "category": "Other",
            "content_type": "text/plain",
            "data_base64": "bm90ZQ==",
        },
    )
    assert doc.status_code == 201, doc.text
