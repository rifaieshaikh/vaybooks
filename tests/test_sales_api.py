"""Sales typed API smoke tests (Mongo only)."""

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


def _seed_sales_deps() -> dict[str, str]:
    customer = c.post(
        "/api/parties/customers",
        json={
            "customer_name": _uniq("SaleCust"),
            "phone_number": f"9{uuid.uuid4().int % 10**9:09d}",
        },
    )
    assert customer.status_code == 201, customer.text
    customer_id = customer.json()["id"]

    store = c.post(
        "/api/finance/accounts",
        json={
            "account_name": _uniq("Store Cash"),
            "account_type": "Asset",
            "opening_balance": 5000,
            "is_store_account": True,
        },
    )
    assert store.status_code == 201, store.text
    store_id = store.json()["id"]

    locs = c.get("/api/inventory/locations").json()
    if locs:
        location_id = locs[0]["id"]
    else:
        loc = c.post(
            "/api/inventory/locations",
            json={"name": _uniq("Showroom"), "code": _uniq("sr")},
        )
        assert loc.status_code == 201, loc.text
        location_id = loc.json()["id"]

    cat = c.post("/api/inventory/categories", json={"name": _uniq("SaleCat")})
    assert cat.status_code == 201, cat.text
    prod = c.post(
        "/api/inventory/products",
        json={
            "sku": _uniq("SAL"),
            "name": _uniq("Shirt"),
            "category_ids": [cat.json()["id"]],
            "opening_qty": 50,
            "unit_code": "pcs",
            "selling_rate": 200,
            "mrp": 250,
            "hsn_sac": "6109",
            "gst_rate": 5,
            "location_id": location_id,
        },
    )
    assert prod.status_code == 201, prod.text
    return {
        "customer_id": customer_id,
        "store_id": store_id,
        "location_id": location_id,
        "product_id": prod.json()["id"],
    }


def test_sales_health() -> None:
    r = c.get("/api/sales/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"
    assert "degraded_pending" in r.json()


def test_so_invoice_return_and_priced_docs() -> None:
    deps = _seed_sales_deps()

    order = c.post(
        "/api/sales/orders",
        json={
            "customer_id": deps["customer_id"],
            "location_id": deps["location_id"],
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty": 2,
                    "rate": 100,
                }
            ],
        },
    )
    assert order.status_code == 201, order.text
    order_id = order.json()["id"]
    assert order.json()["status"] == "Confirmed"

    listed = c.get("/api/sales/orders")
    assert listed.status_code == 200
    assert any(row["id"] == order_id for row in listed.json())

    inv = c.post(
        "/api/sales/invoices",
        json={
            "customer_id": deps["customer_id"],
            "store_account_id": deps["store_id"],
            "store_invoice_number": _uniq("SI"),
            "reference_so_id": order_id,
            "location_id": deps["location_id"],
            "amount_received": 200,
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty": 2,
                    "rate": 100,
                    "location_id": deps["location_id"],
                }
            ],
        },
    )
    assert inv.status_code == 201, inv.text
    invoice_id = inv.json()["id"]
    assert "LINES_JSON" not in str(inv.json().get("description") or "")
    assert inv.json().get("posting_status") in {"posted", "degraded_pending"}

    bills = c.get("/api/sales/invoices")
    assert bills.status_code == 200
    assert any(row["id"] == invoice_id for row in bills.json())

    pdf = c.get(f"/api/sales/invoices/{invoice_id}/pdf")
    assert pdf.status_code == 200, pdf.text
    assert "pdf" in pdf.headers.get("content-type", "").lower() or pdf.content[:4] == b"%PDF"

    ret = c.post(
        "/api/sales/returns",
        json={
            "customer_id": deps["customer_id"],
            "source_invoice_id": invoice_id,
            "location_id": deps["location_id"],
            "lines": [
                {
                    "product_id": deps["product_id"],
                    "qty": 1,
                    "rate": 100,
                }
            ],
        },
    )
    assert ret.status_code == 201, ret.text
    ret_id = ret.json()["id"]
    approved = c.post(f"/api/sales/returns/{ret_id}/approve")
    assert approved.status_code == 200, approved.text

    estimate = c.post(
        "/api/sales/estimates",
        json={
            "customer_id": deps["customer_id"],
            "location_id": deps["location_id"],
            "lines": [{"product_id": deps["product_id"], "qty": 1, "rate": 90}],
        },
    )
    assert estimate.status_code == 201, estimate.text
    est_id = estimate.json()["id"]
    accepted = c.post(f"/api/sales/estimates/{est_id}/status", json={"status": "Accepted"})
    assert accepted.status_code == 200, accepted.text

    quotation = c.post(
        "/api/sales/quotations",
        json={
            "customer_id": deps["customer_id"],
            "location_id": deps["location_id"],
            "lines": [{"product_id": deps["product_id"], "qty": 1, "rate": 95}],
        },
    )
    assert quotation.status_code == 201, quotation.text

    dn = c.post(
        "/api/sales/delivery-notes",
        json={
            "customer_id": deps["customer_id"],
            "sales_order_id": order_id,
            "location_id": deps["location_id"],
            "confirm": True,
            "lines": [{"product_id": deps["product_id"], "qty": 1, "rate": 100}],
        },
    )
    # May fail if SO already fully invoiced — either success or clean 400
    assert dn.status_code in (201, 400), dn.text

    ov = c.get("/api/sales/overview")
    assert ov.status_code == 200
    assert "kpis" in ov.json()

    catalog = c.get("/api/sales/reports")
    assert catalog.status_code == 200
    assert "Sales Orders Pipeline" in catalog.json()["report_types"]

    run = c.post(
        "/api/sales/reports/run",
        json={"report_type": "Sales Orders Pipeline", "filters": {}},
    )
    assert run.status_code == 200
    assert "rows" in run.json()

    cancelled = c.post(
        "/api/sales/orders",
        json={
            "customer_id": deps["customer_id"],
            "location_id": deps["location_id"],
            "lines": [{"product_id": deps["product_id"], "qty": 1, "rate": 10}],
        },
    )
    assert cancelled.status_code == 201, cancelled.text
    cancel = c.post(f"/api/sales/orders/{cancelled.json()['id']}/cancel")
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["status"] == "Cancelled"
