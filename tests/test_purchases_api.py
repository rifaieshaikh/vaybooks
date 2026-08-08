"""Purchases typed API smoke tests (Mongo only)."""

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


def _seed_purchase_deps() -> dict[str, str]:
    vendor = c.post(
        "/api/parties/vendors",
        json={
            "vendor_name": _uniq("PurVendor"),
            "phone_number": f"9{uuid.uuid4().int % 10**9:09d}",
        },
    )
    assert vendor.status_code == 201, vendor.text
    vendor_id = vendor.json()["id"]

    expense = c.post(
        "/api/finance/accounts",
        json={
            "account_name": "Material Purchase Expense",
            "account_type": "Expense",
        },
    )
    # May already exist from prior runs in shared test DB
    if expense.status_code == 201:
        expense_id = expense.json()["id"]
    else:
        accounts = c.get("/api/finance/accounts").json()
        match = next(
            (a for a in accounts if a.get("account_name") == "Material Purchase Expense"),
            None,
        )
        assert match, expense.text
        expense_id = match["id"]

    locs = c.get("/api/inventory/locations").json()
    if locs:
        location_id = locs[0]["id"]
    else:
        loc = c.post(
            "/api/inventory/locations",
            json={"name": _uniq("Main WH"), "code": _uniq("mw")},
        )
        assert loc.status_code == 201, loc.text
        location_id = loc.json()["id"]

    cat = c.post("/api/inventory/categories", json={"name": _uniq("PurCat")})
    assert cat.status_code == 201, cat.text
    prod = c.post(
        "/api/inventory/products",
        json={
            "sku": _uniq("PUR"),
            "name": _uniq("Bolt"),
            "category_ids": [cat.json()["id"]],
            "opening_qty": 0,
            "unit_code": "pcs",
            "selling_rate": 50,
            "mrp": 60,
            "location_id": location_id,
        },
    )
    assert prod.status_code == 201, prod.text
    return {
        "vendor_id": vendor_id,
        "expense_id": expense_id,
        "location_id": location_id,
        "product_id": prod.json()["id"],
    }


def test_purchases_health() -> None:
    r = c.get("/api/purchases/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_po_grn_bill_return_flow() -> None:
    deps = _seed_purchase_deps()

    po = c.post(
        "/api/purchases/orders",
        json={
            "vendor_id": deps["vendor_id"],
            "location_id": deps["location_id"],
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty_ordered": 5,
                    "rate": 20,
                    "expense_account_id": deps["expense_id"],
                }
            ],
        },
    )
    assert po.status_code == 201, po.text
    po_id = po.json()["id"]
    assert po.json()["status"] == "Sent"

    listed = c.get("/api/purchases/orders")
    assert listed.status_code == 200
    assert any(row["id"] == po_id for row in listed.json())

    detail = c.get(f"/api/purchases/orders/{po_id}")
    assert detail.status_code == 200
    assert len(detail.json()["lines"]) == 1

    grn = c.post(
        "/api/purchases/goods-receipts",
        json={
            "vendor_id": deps["vendor_id"],
            "purchase_order_id": po_id,
            "location_id": deps["location_id"],
            "confirm": True,
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty_received": 5,
                    "rate": 20,
                }
            ],
        },
    )
    assert grn.status_code == 201, grn.text
    grn_id = grn.json()["id"]
    assert grn.json()["status"] == "Received"

    bill = c.post(
        "/api/purchases/bills",
        json={
            "vendor_id": deps["vendor_id"],
            "vendor_bill_number": _uniq("VB"),
            "reference_po_id": po_id,
            "reference_grn_id": grn_id,
            "location_id": deps["location_id"],
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty": 5,
                    "rate": 20,
                }
            ],
        },
    )
    assert bill.status_code == 201, bill.text
    bill_id = bill.json()["id"]
    assert "LINES_JSON" not in str(bill.json().get("description") or "")
    assert "LINES_JSON" not in str(bill.json().get("caption") or "")

    bills = c.get("/api/purchases/bills")
    assert bills.status_code == 200
    assert any(row["id"] == bill_id for row in bills.json())

    ret = c.post(
        "/api/purchases/returns",
        json={
            "vendor_id": deps["vendor_id"],
            "source_bill_id": bill_id,
            "source_grn_id": grn_id,
            "location_id": deps["location_id"],
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty": 1,
                    "rate": 20,
                    "expense_account_id": deps["expense_id"],
                }
            ],
        },
    )
    assert ret.status_code == 201, ret.text
    ret_id = ret.json()["id"]

    got_ret = c.get(f"/api/purchases/returns/{ret_id}")
    assert got_ret.status_code == 200

    ov = c.get("/api/purchases/overview")
    assert ov.status_code == 200
    assert "kpis" in ov.json()

    catalog = c.get("/api/purchases/reports")
    assert catalog.status_code == 200
    assert "Purchase Orders Pipeline" in catalog.json()["report_types"]

    run = c.post(
        "/api/purchases/reports/run",
        json={"report_type": "Purchase Orders Pipeline", "filters": {}},
    )
    assert run.status_code == 200
    assert "rows" in run.json()

    cancel_po = c.post(
        "/api/purchases/orders",
        json={
            "vendor_id": deps["vendor_id"],
            "location_id": deps["location_id"],
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty_ordered": 1,
                    "rate": 10,
                    "expense_account_id": deps["expense_id"],
                }
            ],
        },
    )
    assert cancel_po.status_code == 201, cancel_po.text
    cancelled = c.post(f"/api/purchases/orders/{cancel_po.json()['id']}/cancel")
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "Cancelled"
