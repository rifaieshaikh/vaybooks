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


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login_admin() -> str:
    login = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


def _seed_customer(headers: dict[str, str]) -> str:
    customer = c.post(
        "/api/parties/customers",
        headers=headers,
        json={
            "customer_name": _uniq("ProjCust"),
            "phone_number": f"9{uuid.uuid4().int % 10**9:09d}",
        },
    )
    assert customer.status_code == 201, customer.text
    return customer.json()["id"]


def _create_project(headers: dict[str, str], **extra) -> dict:
    customer_id = _seed_customer(headers)
    body = {
        "name": _uniq("Proj"),
        "customer_id": customer_id,
        "contract_value": 100000,
        "location_id": "loc-test",
        **extra,
    }
    project = c.post("/api/projects", headers=headers, json=body)
    assert project.status_code == 201, project.text
    return project.json()


def test_projects_health() -> None:
    r = c.get("/api/projects/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_projects_require_auth() -> None:
    assert c.get("/api/projects").status_code in (401, 403)
    assert c.post("/api/projects", json={"name": "x", "customer_id": "c"}).status_code in (
        401,
        403,
    )


def test_project_enquiry_boq_measurement_ra_overview() -> None:
    h = _auth_headers(_login_admin())
    customer_id = _seed_customer(h)

    enquiry = c.post(
        "/api/projects/enquiries",
        headers=h,
        json={"customer_id": customer_id, "requirement": "Fit-out"},
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry_id = enquiry.json()["id"]
    assert c.get(f"/api/projects/enquiries/{enquiry_id}", headers=h).status_code == 200

    project = c.post(
        "/api/projects",
        headers=h,
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
        headers=h,
        json={"code": "A1", "description": "Civil works", "qty": 10, "rate": 500},
    )
    assert boq.status_code == 201, boq.text
    boq_id = boq.json()["id"]

    meas = c.post(
        f"/api/projects/{project_id}/measurements",
        headers=h,
        json={"boq_item_id": boq_id, "quantity": 2, "notes": "partial"},
    )
    assert meas.status_code == 201, meas.text

    ra = c.post(
        f"/api/projects/{project_id}/ra-bills",
        headers=h,
        json={"claim_amount": 1000, "description": "RA-1"},
    )
    assert ra.status_code == 201, ra.text

    expense = c.post(
        f"/api/projects/{project_id}/expenses",
        headers=h,
        json={"amount": 250, "category": "Material", "description": "Cement"},
    )
    assert expense.status_code == 201, expense.text

    dpr = c.post(
        f"/api/projects/{project_id}/dpr",
        headers=h,
        json={"notes": "Day 1"},
    )
    assert dpr.status_code == 201, dpr.text

    portal = c.post(
        f"/api/projects/{project_id}/portal",
        headers=h,
        json={"label": "client", "scope": "quote"},
    )
    assert portal.status_code == 201, portal.text

    workspace = c.get(f"/api/projects/{project_id}/workspace", headers=h)
    assert workspace.status_code == 200, workspace.text
    assert workspace.json()["project"]["id"] == project_id

    site = c.get(f"/api/projects/{project_id}/site-mobile", headers=h)
    assert site.status_code == 200

    overview = c.get("/api/projects/overview", headers=h)
    assert overview.status_code == 200
    assert overview.json()["project_count"] >= 1

    catalog = c.get("/api/projects/reports/catalog", headers=h)
    assert catalog.status_code == 200
    run = c.post(
        "/api/projects/reports/run",
        headers=h,
        json={"report_type": catalog.json()["report_types"][0], "filters": {}},
    )
    assert run.status_code == 200, run.text

    assert c.get("/api/projects/settings", headers=h).status_code == 200
    assert c.get("/api/projects/measurements", headers=h).status_code == 200
    assert c.get("/api/projects/ra-bills", headers=h).status_code == 200

    history = c.get(f"/api/projects/{project_id}/history", headers=h)
    assert history.status_code == 200, history.text
    assert isinstance(history.json(), list)
    assert any(row.get("action") == "created" for row in history.json())


def test_boq_measurement_certify_ra_budget_expense() -> None:
    h = _auth_headers(_login_admin())
    project = _create_project(h)
    project_id = project["id"]

    boq = c.post(
        f"/api/projects/{project_id}/boq",
        headers=h,
        json={"code": "M1", "description": "Masonry", "qty": 5, "rate": 200},
    )
    assert boq.status_code == 201, boq.text
    boq_id = boq.json()["id"]

    meas = c.post(
        f"/api/projects/{project_id}/measurements",
        headers=h,
        json={"boq_item_id": boq_id, "quantity": 1},
    )
    assert meas.status_code == 201, meas.text
    meas_id = meas.json()["id"]

    submitted = c.post(
        f"/api/projects/{project_id}/measurements/{meas_id}/submit", headers=h
    )
    assert submitted.status_code == 200, submitted.text

    certified = c.post(
        f"/api/projects/{project_id}/measurements/{meas_id}/certify",
        headers=h,
        json={"actor": "tester"},
    )
    assert certified.status_code == 200, certified.text

    ra = c.post(
        f"/api/projects/{project_id}/ra-bills",
        headers=h,
        json={"claim_amount": 500, "description": "from meas", "measurement_ids": [meas_id]},
    )
    assert ra.status_code == 201, ra.text
    ra_id = ra.json()["id"]
    assert (
        c.post(f"/api/projects/{project_id}/ra-bills/{ra_id}/submit", headers=h).status_code
        == 200
    )

    budget = c.get(f"/api/projects/{project_id}/budget", headers=h)
    assert budget.status_code == 200, budget.text
    assert "summary" in budget.json()

    line = c.post(
        f"/api/projects/{project_id}/budget/lines",
        headers=h,
        json={"cost_category": "Labour", "amount": 1500},
    )
    assert line.status_code == 201, line.text

    expense = c.post(
        f"/api/projects/{project_id}/expenses",
        headers=h,
        json={"amount": 75, "category": "Material", "description": "nails"},
    )
    assert expense.status_code == 201, expense.text

    doc = c.post(
        f"/api/projects/{project_id}/documents",
        headers=h,
        json={
            "name": "note.txt",
            "category": "Other",
            "content_type": "text/plain",
            "data_base64": "bm90ZQ==",
        },
    )
    assert doc.status_code == 201, doc.text


def test_project_dates_activities_and_accounting_summary() -> None:
    h = _auth_headers(_login_admin())
    customer_id = _seed_customer(h)
    project = c.post(
        "/api/projects",
        headers=h,
        json={
            "name": _uniq("Schedule"),
            "customer_id": customer_id,
            "contract_value": 25000,
            "start_date": "2026-01-01",
            "expected_end_date": "2026-03-31",
        },
    )
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]
    assert project.json()["start_date"] == "2026-01-01"
    assert project.json()["expected_end_date"] == "2026-03-31"

    patched = c.patch(
        f"/api/projects/{project_id}",
        headers=h,
        json={"start_date": "2026-01-15", "expected_end_date": "2026-04-15"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["start_date"] == "2026-01-15"
    assert patched.json()["expected_end_date"] == "2026-04-15"

    activities = c.get(f"/api/projects/{project_id}/activities", headers=h)
    assert activities.status_code == 200, activities.text
    assert activities.json() == []

    activity = c.post(
        f"/api/projects/{project_id}/activities",
        headers=h,
        json={
            "name": "Foundation",
            "planned_start": "2026-01-15",
            "planned_end": "2026-02-15",
            "weightage": 25,
        },
    )
    assert activity.status_code == 201, activity.text
    assert len(activity.json()) == 1

    summary = c.get(f"/api/projects/{project_id}/accounting-summary", headers=h)
    assert summary.status_code == 200, summary.text
    assert "progress" in summary.json()

    vouchers = c.get(f"/api/projects/{project_id}/vouchers", headers=h)
    assert vouchers.status_code == 200, vouchers.text
    assert vouchers.json() == []


def test_project_money_routes_with_auth() -> None:
    h = _auth_headers(_login_admin())
    project = _create_project(h, contract_value=50000)
    project_id = project["id"]

    cash = c.post(
        "/api/finance/accounts",
        json={
            "account_name": _uniq("Cash Box"),
            "account_type": "Asset",
            "opening_balance": 5000,
            "is_store_account": True,
        },
    )
    assert cash.status_code == 201, cash.text
    vendor = c.post(
        "/api/parties/vendors",
        headers=h,
        json={"vendor_name": _uniq("Site Vendor"), "phone_number": f"8{uuid.uuid4().int % 10**9:09d}"},
    )
    assert vendor.status_code == 201, vendor.text
    expense_acct = c.post(
        "/api/finance/accounts",
        json={"account_name": _uniq("Site Exp"), "account_type": "Expense"},
    )
    assert expense_acct.status_code == 201, expense_acct.text

    from packages.services_kit.finance_container import get_finance_container

    repo = get_finance_container().account_repo
    customer_account = repo.find_customer_account(project["customer_id"])
    assert customer_account is not None
    vendor_account = repo.find_vendor_account(vendor.json()["id"])
    assert vendor_account is not None

    unauth_receipt = c.post(
        f"/api/projects/{project_id}/receipts",
        json={
            "receiving_account_id": cash.json()["id"],
            "customer_account_id": customer_account.id,
            "amount": 100,
            "description": "no auth",
        },
    )
    assert unauth_receipt.status_code in (401, 403)

    receipt = c.post(
        f"/api/projects/{project_id}/receipts",
        headers=h,
        json={
            "receiving_account_id": cash.json()["id"],
            "customer_account_id": customer_account.id,
            "amount": 125,
            "description": "Project receipt",
        },
    )
    assert receipt.status_code == 201, receipt.text
    assert "voucher" in receipt.json()

    payment = c.post(
        f"/api/projects/{project_id}/vendor-payments",
        headers=h,
        json={
            "vendor_account_id": vendor_account.id,
            "expense_account_id": expense_acct.json()["id"],
            "paying_account_id": cash.json()["id"],
            "amount": 40,
            "description": "Site payment",
        },
    )
    assert payment.status_code == 201, payment.text

    draft = c.post(
        f"/api/projects/{project_id}/recognition",
        headers=h,
        json={
            "period_end": "2026-03-31",
            "method": "Percent Complete",
            "percent_complete": 25,
            "total_cost": 1000,
            "billed_to_date": 0,
            "prior_recognised": 0,
            "estimated_total_cost": 4000,
            "notes": "Q1",
        },
    )
    assert draft.status_code == 201, draft.text
    entry_id = draft.json()["id"]

    approved = c.post(
        f"/api/projects/{project_id}/recognition/{entry_id}/approve", headers=h
    )
    assert approved.status_code == 200, approved.text

    posted = c.post(f"/api/projects/{project_id}/recognition/{entry_id}/post", headers=h)
    assert posted.status_code == 200, posted.text

    recon = c.post(
        f"/api/projects/{project_id}/reconciliations",
        headers=h,
        json={
            "period_end": "2026-03-31",
            "notes": "month-end",
            "project_subledger": 100,
            "gl_balance": 100,
        },
    )
    assert recon.status_code == 201, recon.text

    history = c.get(f"/api/projects/{project_id}/history", headers=h)
    assert history.status_code == 200, history.text
    actions = {row.get("action") for row in history.json()}
    assert "created" in actions
    assert "drafted" in actions or "posted" in actions

    # RA convert requires approve permission + certified bill
    ra = c.post(
        f"/api/projects/{project_id}/ra-bills",
        headers=h,
        json={"claim_amount": 500, "description": "RA convert"},
    )
    assert ra.status_code == 201, ra.text
    ra_id = ra.json()["id"]
    assert (
        c.post(f"/api/projects/{project_id}/ra-bills/{ra_id}/submit", headers=h).status_code
        == 200
    )
    assert c.post(
        f"/api/projects/{project_id}/ra-bills/{ra_id}/convert-invoice",
        json={"store_account_id": cash.json()["id"], "amount_received": 0},
    ).status_code in (401, 403)

    certify = c.post(
        f"/api/projects/{project_id}/ra-bills/{ra_id}/certify",
        headers=h,
        json={"line_certifications": []},
    )
    assert certify.status_code == 200, certify.text

    convert = c.post(
        f"/api/projects/{project_id}/ra-bills/{ra_id}/convert-invoice",
        headers=h,
        json={"store_account_id": cash.json()["id"], "amount_received": 0},
    )
    assert convert.status_code == 200, convert.text
