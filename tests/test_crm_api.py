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


def test_lead_soft_delete_list_restore() -> None:
    h = _auth_headers(_login_admin())
    lead = c.post(
        "/api/crm/leads",
        headers=h,
        json={
            "name": _uniq("DelLead"),
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "location_id": "loc-test",
            "allow_duplicate": True,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]

    deleted = c.delete(f"/api/crm/leads/{lead_id}", headers=h)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json().get("is_deleted") is True

    excluded = c.get("/api/crm/leads", headers=h, params={"deleted": "exclude"})
    assert excluded.status_code == 200, excluded.text
    body = excluded.json()
    items = body["items"] if isinstance(body, dict) else body
    assert not any(row.get("id") == lead_id for row in items)

    only = c.get("/api/crm/leads", headers=h, params={"deleted": "only"})
    assert only.status_code == 200, only.text
    only_body = only.json()
    only_items = only_body["items"] if isinstance(only_body, dict) else only_body
    assert any(row.get("id") == lead_id for row in only_items)

    hidden = c.get(f"/api/crm/leads/{lead_id}", headers=h)
    assert hidden.status_code in (400, 404), hidden.text

    got = c.get(
        f"/api/crm/leads/{lead_id}",
        headers=h,
        params={"include_deleted": "true"},
    )
    assert got.status_code == 200, got.text
    assert got.json()["id"] == lead_id
    assert got.json().get("is_deleted") is True

    restored = c.post(f"/api/crm/lead/{lead_id}/restore", headers=h)
    assert restored.status_code == 200, restored.text
    assert restored.json().get("is_deleted") is False

    listed = c.get("/api/crm/leads", headers=h, params={"deleted": "exclude"})
    assert listed.status_code == 200, listed.text
    listed_body = listed.json()
    listed_items = listed_body["items"] if isinstance(listed_body, dict) else listed_body
    assert any(row.get("id") == lead_id for row in listed_items)


def test_activities_needs_correction_filter() -> None:
    h = _auth_headers(_login_admin())

    lead = c.post(
        "/api/crm/leads",
        headers=h,
        json={
            "name": _uniq("CorrLead"),
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "location_id": "loc-test",
            "allow_duplicate": True,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]

    manual = c.post(
        "/api/crm/activities",
        headers=h,
        json={
            "activity_type": "Called",
            "lead_id": lead_id,
            "notes": "manual",
            "location_id": "loc-test",
        },
    )
    assert manual.status_code == 201, manual.text

    from packages.services_kit.crm_container import get_crm_container
    from vaybooks.bms.application.crm.activities import (
        CrmActivityAppService,
        CrmAutoActivityService,
    )
    from vaybooks.bms.infrastructure.repositories.crm import MongoCrmActivityRepository

    repo = MongoCrmActivityRepository(get_crm_container().db)
    auto = CrmAutoActivityService(repo).record_event(
        type_key="invoice_created",
        source_module="finance",
        source_txn_type="sales_invoice",
        source_txn_id=_uniq("inv"),
        lead_id=lead_id,
        notes="auto invoice",
    )
    assert auto is not None
    flagged = CrmActivityAppService(repo).update_activity(
        auto.id, notes="needs review", allow_automatic=True
    )
    assert flagged.needs_correction is True

    listed = c.get(
        "/api/crm/activities",
        headers=h,
        params={"needs_correction": "true", "origin": "Automatic"},
    )
    assert listed.status_code == 200, listed.text
    body = listed.json()
    items = body["items"] if isinstance(body, dict) else body
    assert any(row.get("id") == flagged.id for row in items)
    assert all(row.get("origin") == "Automatic" for row in items)
    assert all(row.get("needs_correction") for row in items)
    assert not any(row.get("id") == manual.json()["id"] for row in items)


def test_create_quotation_requires_customer() -> None:
    h = _auth_headers(_login_admin())
    lead = c.post(
        "/api/crm/leads",
        headers=h,
        json={
            "name": _uniq("QuoteLead"),
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "location_id": "loc-test",
            "allow_duplicate": True,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]

    enquiry = c.post(
        "/api/crm/enquiries",
        headers=h,
        json={"lead_id": lead_id, "product_interest": "Fabric", "description": "Need quote"},
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry_id = enquiry.json()["id"]
    assert not enquiry.json().get("customer_id")

    quote = c.post(
        f"/api/crm/enquiries/{enquiry_id}/create-quotation",
        headers=h,
        json={},
    )
    assert quote.status_code == 400, quote.text
    detail = quote.json().get("detail") or ""
    assert "customer" in str(detail).lower()


def test_collections_get_shape() -> None:
    h = _auth_headers(_login_admin())
    r = c.get("/api/crm/collections", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body.get("balances"), list)
    assert isinstance(body.get("open_invoices"), list)
    assert isinstance(body.get("payment_promises"), list)
    assert isinstance(body.get("follow_ups"), list)
    assert "payment_reminders_available" in body
    assert "can_send_payment_reminders" in body
    assert "aging_available" in body
    # When open invoices carry due data, aging fields are present on rows.
    for inv in body.get("open_invoices") or []:
        assert "customer_id" in inv
        assert "outstanding" in inv
        assert "days_past_due" in inv or inv.get("due_date") is not None
    for bal in body.get("balances") or []:
        if bal.get("open_invoice_count"):
            assert bal.get("days_past_due") is not None or bal.get("oldest_due_date")


def test_audit_get_shape() -> None:
    h = _auth_headers(_login_admin())
    lead = c.post(
        "/api/crm/leads",
        headers=h,
        json={
            "name": _uniq("AuditLead"),
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "location_id": "loc-test",
            "allow_duplicate": True,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]

    c.patch(f"/api/crm/leads/{lead_id}", headers=h, json={"notes": "audited"})

    audit = c.get(f"/api/crm/lead/{lead_id}/audit", headers=h)
    assert audit.status_code == 200, audit.text
    body = audit.json()
    assert isinstance(body.get("items"), list)
    assert isinstance(body.get("total"), int)
    assert body["total"] == len(body["items"])


def test_customer_related_get() -> None:
    h = _auth_headers(_login_admin())
    customer_id = _uniq("cust")

    lead = c.post(
        "/api/crm/leads",
        headers=h,
        json={
            "name": _uniq("RelLead"),
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "location_id": "loc-test",
            "allow_duplicate": True,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]
    converted = c.post(f"/api/crm/leads/{lead_id}/convert", headers=h, json={})
    assert converted.status_code == 200, converted.text
    linked_customer = converted.json().get("customer_id") or customer_id

    activity = c.post(
        "/api/crm/activities",
        headers=h,
        json={
            "activity_type": "Payment Reminder",
            "customer_id": linked_customer,
            "status": "Scheduled",
            "notes": "360 timeline seed",
        },
    )
    assert activity.status_code in (200, 201), activity.text

    related = c.get(f"/api/crm/customers/{linked_customer}/related", headers=h)
    assert related.status_code == 200, related.text
    body = related.json()
    assert body.get("customer_id") == linked_customer
    assert isinstance(body.get("leads"), list)
    assert isinstance(body.get("enquiries"), list)
    assert isinstance(body.get("activities"), list)
    assert isinstance(body.get("recent_activities"), list)
    assert isinstance(body.get("timeline"), list)
    assert "last_contact_at" in body
    assert "next_follow_up_at" in body
    assert "outstanding_balance" in body
    assert "open_invoice_outstanding" in body
    assert any(row.get("id") == lead_id for row in body["leads"])
    assert body["recent_activities"]
    assert body["timeline"]
    assert len(body["recent_activities"]) <= len(body["activities"])
    assert len(body["timeline"]) <= len(body["activities"])
    assert body.get("last_contact_at") or body.get("next_follow_up_at")


def test_import_dry_run_smoke() -> None:
    h = _auth_headers(_login_admin())
    r = c.post(
        "/api/crm/leads/import/dry-run",
        headers=h,
        json={
            "rows": [
                {
                    "name": _uniq("ImportLead"),
                    "phone": f"9{uuid.uuid4().int % 10**9:09d}",
                }
            ],
            "duplicate_policy": "skip",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("total_rows") == 1
    assert isinstance(body.get("outcomes"), list)
    assert len(body["outcomes"]) == 1
    assert "would_create" in body["outcomes"][0]
    assert body.get("duplicate_policy") == "skip"


def test_list_views_crud() -> None:
    h = _auth_headers(_login_admin())
    name = _uniq("My High Leads")
    created = c.post(
        "/api/crm/list-views",
        headers=h,
        json={
            "name": name,
            "entity": "lead",
            "filters": {
                "status": "Follow-up Required",
                "priority": "High",
                "assigned_user_id": "me",
                "date_from": "2026-08-01",
                "date_to": "2026-08-07",
                "search": "",
            },
            "sort": [{"key": "next_follow_up_at", "desc": False}],
            "columns": ["lead", "status", "priority"],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    view_id = body["id"]
    assert body["name"] == name
    assert body["entity"] == "lead"
    assert body["filters"]["priority"] == "High"
    assert body["sort"][0]["key"] == "next_follow_up_at"
    assert body["columns"] == ["lead", "status", "priority"]

    listed = c.get("/api/crm/list-views", headers=h, params={"entity": "lead"})
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    assert any(row.get("id") == view_id for row in items)

    other = c.get("/api/crm/list-views", headers=h, params={"entity": "enquiry"})
    assert other.status_code == 200, other.text
    assert all(row.get("id") != view_id for row in other.json()["items"])

    deleted = c.delete(f"/api/crm/list-views/{view_id}", headers=h)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json().get("ok") is True

    after = c.get("/api/crm/list-views", headers=h, params={"entity": "lead"})
    assert after.status_code == 200, after.text
    assert all(row.get("id") != view_id for row in after.json()["items"])

    missing = c.delete(f"/api/crm/list-views/{view_id}", headers=h)
    assert missing.status_code == 404


def test_attachment_upload_and_meta() -> None:
    h = _auth_headers(_login_admin())
    lead = c.post(
        "/api/crm/leads",
        headers=h,
        json={
            "name": _uniq("AttachLead"),
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "location_id": "loc-test",
            "allow_duplicate": True,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]

    content = b"hello crm attachment"
    uploaded = c.post(
        "/api/crm/attachments",
        headers=h,
        files={"file": ("note.txt", content, "text/plain")},
        data={"entity_type": "lead", "entity_id": lead_id},
    )
    assert uploaded.status_code == 201, uploaded.text
    up = uploaded.json()
    attachment_id = up["id"]
    assert up["name"] == "note.txt"
    assert up["content_type"] == "text/plain"
    assert up["size_bytes"] == len(content)
    assert up["entity_type"] == "lead"
    assert up["entity_id"] == lead_id
    assert "data" not in up

    meta = c.get(f"/api/crm/attachments/{attachment_id}/meta", headers=h)
    assert meta.status_code == 200, meta.text
    body = meta.json()
    assert body["id"] == attachment_id
    assert body["name"] == "note.txt"
    assert body["content_type"] == "text/plain"
    assert body["size_bytes"] == len(content)
    assert body["entity_type"] == "lead"
    assert body["entity_id"] == lead_id
    assert "data" not in body

    downloaded = c.get(f"/api/crm/attachments/{attachment_id}", headers=h)
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == content
