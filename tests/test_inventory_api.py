"""Inventory typed API smoke tests (Mongo only)."""

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


def test_inventory_health() -> None:
    r = c.get("/api/inventory/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_category_product_stock_flow() -> None:
    cat = c.post("/api/inventory/categories", json={"name": _uniq("Fabrics")})
    assert cat.status_code == 201, cat.text
    cid = cat.json()["id"]
    sku = _uniq("SKU")

    prod = c.post(
        "/api/inventory/products",
        json={
            "sku": sku,
            "name": _uniq("Cotton"),
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
        json={"name": _uniq("Store"), "code": _uniq("st")},
    )
    assert loc2.status_code == 201, loc2.text
    to_id = loc2.json()["id"]
    locs = c.get("/api/inventory/locations").json()
    from_id = next(row["id"] for row in locs if row["id"] != to_id)

    cat = c.post("/api/inventory/categories", json={"name": _uniq("Misc")})
    cid = cat.json()["id"]
    prod = c.post(
        "/api/inventory/products",
        json={
            "sku": _uniq("XFER"),
            "name": _uniq("Thread"),
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


def test_location_create_patch_delete() -> None:
    code = _uniq("loc")
    created = c.post(
        "/api/inventory/locations",
        json={"name": _uniq("Loc"), "code": code, "address": "A1", "location_type": "Warehouse"},
    )
    assert created.status_code == 201, created.text
    loc_id = created.json()["id"]

    patched = c.patch(
        f"/api/inventory/locations/{loc_id}",
        json={
            "name": "Renamed Loc",
            "code": code,
            "address": "A2",
            "location_type": "Store",
            "is_active": True,
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == "Renamed Loc"

    deleted = c.delete(f"/api/inventory/locations/{loc_id}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["status"] == "deleted"

    listed = c.get("/api/inventory/locations")
    assert listed.status_code == 200
    assert all(row.get("id") != loc_id for row in listed.json())
