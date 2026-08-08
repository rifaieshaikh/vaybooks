"""Boutique typed API smoke tests (Mongo only)."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from tests.mongo_test_env import require_mongo, reset_all_containers


@pytest.fixture(autouse=True)
def _mongo():
    require_mongo()
    reset_all_containers()
    yield


from packages.services_kit.boutique_container import get_boutique_container  # noqa: E402
from services.combined.main import app  # noqa: E402

c = TestClient(app)


def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _seed_customer() -> str:
    customer = c.post(
        "/api/parties/customers",
        json={
            "customer_name": _uniq("BoutCust"),
            "phone_number": f"9{uuid.uuid4().int % 10**9:09d}",
        },
    )
    assert customer.status_code == 201, customer.text
    return customer.json()["id"]


def test_boutique_health() -> None:
    r = c.get("/api/boutique/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_order_measurement_time_overview_reports() -> None:
    customer_id = _seed_customer()
    activity = get_boutique_container().activities.create_activity(
        _uniq("Stitch"),
        "In House Service",
        default_hourly_expense=100,
    )

    draft = c.post(
        "/api/boutique/orders",
        json={"customer_id": customer_id, "notes": "rush"},
    )
    assert draft.status_code == 201, draft.text
    order_id = draft.json()["id"]
    assert draft.json()["order_status"] == "Draft"

    etd = (date.today() + timedelta(days=5)).isoformat()
    patched = c.patch(
        f"/api/boutique/orders/{order_id}",
        json={"expected_delivery_date": etd, "notes": "updated"},
    )
    assert patched.status_code == 200, patched.text

    item = c.post(
        f"/api/boutique/orders/{order_id}/items",
        json={
            "description": "Silk kurta",
            "bill_number": f"BN-{uuid.uuid4().hex[:6].upper()}",
            "required_activities": {activity.activity_name: True},
        },
    )
    assert item.status_code == 201, item.text
    item_id = item.json()["item"]["item_id"]

    confirmed = c.post(f"/api/boutique/orders/{order_id}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["order_status"] == "In Progress"

    listed_items = c.get("/api/boutique/items")
    assert listed_items.status_code == 200
    assert any(row.get("item_id") == item_id for row in listed_items.json())

    specs = c.get("/api/boutique/measurement-specs").json()
    values = [
        {"key": s["key"], "value": "10"}
        for s in specs
        if s.get("required") and "Men" in (s.get("person_types") or [])
    ]
    meas = c.post(
        "/api/boutique/measurements",
        json={
            "customer_id": customer_id,
            "person_type": "Men",
            "order_id": order_id,
            "wearer_name": "Alex",
            "notes": "loose fit",
            "values": values,
        },
    )
    assert meas.status_code == 201, meas.text
    meas_id = meas.json()["id"]
    assert c.get(f"/api/boutique/measurements/{meas_id}").status_code == 200

    order = c.get(f"/api/boutique/orders/{order_id}").json()
    activities = order.get("order_activities") or []
    assert activities, "expected order activities from required_activities"
    activity_id = activities[0]["activity_id"]

    oa_id = activities[0]["order_activity_id"]
    blocked = c.post(
        f"/api/boutique/orders/{order_id}/activities/{oa_id}/complete",
        json={"completed_by": "test", "add_expense": False},
    )
    assert blocked.status_code == 400, blocked.text
    assert "task" in blocked.json()["detail"].lower() or "time" in blocked.json()["detail"].lower()

    te = c.post(
        "/api/boutique/time-entries",
        json={
            "order_id": order_id,
            "bill_id": item_id,
            "activity_id": activity_id,
            "work_date": date.today().isoformat(),
            "start_time": "09:00",
            "end_time": "11:00",
            "worker_name": "Ravi",
        },
    )
    assert te.status_code == 201, te.text

    completed = c.post(
        f"/api/boutique/orders/{order_id}/activities/{oa_id}/complete",
        json={
            "completed_by": "test",
            "purchase_price": 100,
            "selling_price": 150,
            "add_expense": True,
        },
    )
    assert completed.status_code == 200, completed.text

    invoice = c.post(
        f"/api/boutique/orders/{order_id}/invoices",
        json={"bill_ids": [item_id], "invoice_amount": 1500},
    )
    assert invoice.status_code == 201, invoice.text

    delivery = c.post(
        f"/api/boutique/orders/{order_id}/deliveries",
        json={"bill_ids": [item_id]},
    )
    assert delivery.status_code == 201, delivery.text

    got_meas = c.get(f"/api/boutique/measurements/{meas_id}").json()
    assert got_meas.get("values")
    assert all("key" in row or "field_key" in row for row in got_meas["values"])

    cal = c.get("/api/boutique/calendar")
    assert cal.status_code == 200
    assert isinstance(cal.json(), list)

    overview = c.get("/api/boutique/overview")
    assert overview.status_code == 200, overview.text
    assert "kpis" in overview.json()

    catalog = c.get("/api/boutique/reports/catalog")
    assert catalog.status_code == 200
    types = catalog.json()["report_types"]
    assert "Order Pipeline" in types

    run = c.post(
        "/api/boutique/reports/run",
        json={"report_type": "Order Pipeline", "filters": {}},
    )
    assert run.status_code == 200, run.text
    assert "rows" in run.json()

    export = c.post(
        "/api/boutique/reports/export",
        json={"report_type": "Order Pipeline", "filters": {}},
    )
    assert export.status_code == 200
    assert "text/csv" in export.headers.get("content-type", "")


def test_activities_seed_and_material_complete_without_time() -> None:
    acts = c.get("/api/boutique/activities")
    assert acts.status_code == 200
    assert len(acts.json()) >= 1

    material = get_boutique_container().activities.create_activity(
        _uniq("Mat"),
        "Outsourced Material",
        default_hourly_expense=0,
    )
    customer_id = _seed_customer()
    draft = c.post("/api/boutique/orders", json={"customer_id": customer_id})
    assert draft.status_code == 201, draft.text
    order_id = draft.json()["id"]
    etd = (date.today() + timedelta(days=3)).isoformat()
    c.patch(f"/api/boutique/orders/{order_id}", json={"expected_delivery_date": etd})
    item = c.post(
        f"/api/boutique/orders/{order_id}/items",
        json={
            "description": "Lining",
            "required_activities": {material.activity_name: True},
        },
    )
    assert item.status_code == 201, item.text
    c.post(f"/api/boutique/orders/{order_id}/confirm")
    order = c.get(f"/api/boutique/orders/{order_id}").json()
    oa_id = order["order_activities"][0]["order_activity_id"]
    done = c.post(
        f"/api/boutique/orders/{order_id}/activities/{oa_id}/complete",
        json={"completed_by": "test", "add_expense": False},
    )
    assert done.status_code == 200, done.text
