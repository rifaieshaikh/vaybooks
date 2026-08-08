"""Inventory typed API smoke tests (memory backend)."""

from __future__ import annotations

import os

os.environ["INVENTORY_BACKEND"] = "memory"
os.environ["PARTIES_BACKEND"] = "memory"

from fastapi.testclient import TestClient

from packages.services_kit.inventory_container import reset_inventory_container
from services.combined.main import app


def setup_function() -> None:
    os.environ["INVENTORY_BACKEND"] = "memory"
    reset_inventory_container()


c = TestClient(app)


def test_inventory_health() -> None:
    r = c.get("/api/inventory/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] in {"memory", "mongo"}


def test_category_product_stock_flow() -> None:
    cat = c.post("/api/inventory/categories", json={"name": "Fabrics"})
    assert cat.status_code == 201, cat.text
    cid = cat.json()["id"]

    prod = c.post(
        "/api/inventory/products",
        json={
            "sku": "SKU-TEST-1",
            "name": "Cotton Roll",
            "category_ids": [cid],
            "opening_qty": 12,
            "unit_code": "pcs",
            "selling_rate": 100,
            "mrp": 120,
        },
    )
    assert prod.status_code == 201, prod.text
    pid = prod.json()["id"]
    assert prod.json()["current_qty"] == 12

    listed = c.get("/api/inventory/products")
    assert listed.status_code == 200
    assert any(row["id"] == pid for row in listed.json())

    stock = c.get("/api/inventory/stock")
    assert stock.status_code == 200
    assert any(row["id"] == pid for row in stock.json())

    mov = c.post(
        "/api/inventory/movements",
        json={"product_id": pid, "movement_type": "Receive", "qty": 3, "notes": "top-up"},
    )
    assert mov.status_code == 201, mov.text

    detail = c.get(f"/api/inventory/products/{pid}")
    assert detail.status_code == 200
    assert detail.json()["current_qty"] >= 12


def test_transfer_and_reports() -> None:
    loc2 = c.post(
        "/api/inventory/locations",
        json={"name": "Store A", "code": "store-a"},
    )
    assert loc2.status_code == 201, loc2.text
    to_id = loc2.json()["id"]
    from_id = c.get("/api/inventory/locations").json()[0]["id"]

    cat = c.post("/api/inventory/categories", json={"name": "Misc"})
    cid = cat.json()["id"]
    prod = c.post(
        "/api/inventory/products",
        json={
            "sku": "SKU-XFER-1",
            "name": "Thread",
            "category_ids": [cid],
            "opening_qty": 20,
            "unit_code": "pcs",
            "selling_rate": 10,
            "mrp": 12,
            "location_id": from_id,
        },
    )
    assert prod.status_code == 201, prod.text
    pid = prod.json()["id"]

    xfer = c.post(
        "/api/inventory/transfers",
        json={
            "from_location_id": from_id,
            "to_location_id": to_id,
            "lines": [{"product_id": pid, "qty": 5}],
            "send_in_transit": True,
        },
    )
    assert xfer.status_code == 201, xfer.text
    tid = xfer.json()["id"]

    recv = c.post(f"/api/inventory/transfers/{tid}/receive")
    assert recv.status_code == 200, recv.text

    catalog = c.get("/api/inventory/reports")
    assert catalog.status_code == 200
    assert "Stock on Hand" in catalog.json()["report_types"]

    run = c.post("/api/inventory/reports/run", json={"report_type": "Stock on Hand"})
    assert run.status_code == 200
    assert run.json()["row_count"] >= 1

    overview = c.get("/api/inventory/overview")
    assert overview.status_code == 200
    assert "kpis" in overview.json()
