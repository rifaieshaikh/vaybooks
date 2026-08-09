"""Production typed API smoke tests (Mongo only)."""

from __future__ import annotations

import uuid
from datetime import date

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


def _seed_products() -> dict[str, str]:
    locs = c.get("/api/inventory/locations").json()
    if locs:
        location_id = locs[0]["id"]
    else:
        loc = c.post(
            "/api/inventory/locations",
            json={"name": _uniq("Plant"), "code": _uniq("PL")},
        )
        assert loc.status_code == 201, loc.text
        location_id = loc.json()["id"]

    rm = c.post(
        "/api/inventory/products",
        json={
            "name": _uniq("Flour"),
            "sku": _uniq("RM"),
            "unit_code": "kg",
            "opening_qty": 100,
            "location_id": location_id,
            "selling_rate": 12,
            "mrp": 15,
        },
    )
    assert rm.status_code == 201, rm.text
    fg = c.post(
        "/api/inventory/products",
        json={
            "name": _uniq("Bread"),
            "sku": _uniq("FG"),
            "unit_code": "pcs",
            "opening_qty": 0,
            "location_id": location_id,
            "selling_rate": 40,
            "mrp": 45,
        },
    )
    assert fg.status_code == 201, fg.text
    return {
        "location_id": location_id,
        "rm_id": rm.json()["id"],
        "fg_id": fg.json()["id"],
    }


def test_production_health() -> None:
    r = c.get("/api/production/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_recipe_batch_reports_settings() -> None:
    deps = _seed_products()

    recipe = c.post(
        "/api/production/recipes",
        json={
            "name": _uniq("Loaf"),
            "code": _uniq("R"),
            "base_quantity": 1,
            "inputs": [
                {
                    "product_id": deps["rm_id"],
                    "qty": 2,
                    "product_name": "Flour",
                    "unit": "kg",
                }
            ],
            "outputs": [
                {
                    "product_id": deps["fg_id"],
                    "expected_qty": 1,
                    "product_name": "Bread",
                    "unit": "pcs",
                    "role": "Main",
                    "nrv_rate": 40,
                }
            ],
            "stages": [{"name": "Mix", "sequence": 1}],
        },
    )
    assert recipe.status_code == 201, recipe.text
    recipe_id = recipe.json()["id"]
    assert recipe.json()["name"]

    listed = c.get("/api/production/recipes")
    assert listed.status_code == 200
    assert any(row.get("id") == recipe_id for row in listed.json())

    batch = c.post(
        "/api/production/batches",
        json={
            "recipe_id": recipe_id,
            "location_id": deps["location_id"],
            "planned_quantity": 1,
            "batch_date": date.today().isoformat(),
            "notes": "test batch",
        },
    )
    assert batch.status_code == 201, batch.text
    batch_id = batch.json()["id"]
    assert batch.json()["status"] == "Draft"

    got = c.get(f"/api/production/batches/{batch_id}")
    assert got.status_code == 200
    assert got.json()["id"] == batch_id

    stage_id = (got.json().get("stages") or [{}])[0].get("id")
    if stage_id:
        completed = c.post(
            f"/api/production/batches/{batch_id}/complete",
            json={"stage_id": stage_id},
        )
        assert completed.status_code == 200, completed.text
        assert completed.json()["status"] == "In Progress"

    cost = c.post(
        f"/api/production/batches/{batch_id}/costs",
        json={"cost_type": "Labour", "amount": 25, "description": "mixing"},
    )
    assert cost.status_code == 201, cost.text
    cost_id = (cost.json().get("costs") or [{}])[-1].get("id")
    if cost_id:
        removed = c.delete(f"/api/production/batches/{batch_id}/costs/{cost_id}")
        assert removed.status_code == 200, removed.text

    overview = c.get("/api/production/overview")
    assert overview.status_code == 200
    assert overview.json()["total_batches"] >= 1

    day_book = c.get("/api/production/day-book")
    assert day_book.status_code == 200

    margins = c.get("/api/production/margins")
    assert margins.status_code == 200

    yield_rows = c.get("/api/production/yield")
    assert yield_rows.status_code == 200
    assert len(yield_rows.json()) >= 1

    catalog = c.get("/api/production/reports/catalog")
    assert catalog.status_code == 200
    reports = catalog.json()["reports"]
    assert len(reports) >= 1
    run = c.post(
        "/api/production/reports/run",
        json={"report_id": reports[0]["id"], "filters": {}},
    )
    assert run.status_code == 200, run.text
    assert "rows" in run.json()

    settings = c.get("/api/production/settings")
    assert settings.status_code == 200
    updated = c.patch(
        "/api/production/settings",
        json={"wip_account_id": "acc-wip-test"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["wip_account_id"] == "acc-wip-test"

    cancelled = c.post(f"/api/production/batches/{batch_id}/cancel")
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "Cancelled"
