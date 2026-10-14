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
            "last_purchase_rate": 10,
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


def test_patch_batch_scrap_and_profitability() -> None:
    deps = _seed_products()

    recipe = c.post(
        "/api/production/recipes",
        json={
            "name": _uniq("Scraped"),
            "code": _uniq("RS"),
            "base_quantity": 1,
            "inputs": [
                {
                    "product_id": deps["rm_id"],
                    "qty": 10,
                    "scrap_pct": 10,
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
        },
    )
    assert recipe.status_code == 201, recipe.text
    recipe_id = recipe.json()["id"]
    assert len(recipe.json()["inputs"]) == 1

    batch = c.post(
        "/api/production/batches",
        json={
            "recipe_id": recipe_id,
            "location_id": deps["location_id"],
            "planned_quantity": 1,
            "batch_date": date.today().isoformat(),
        },
    )
    assert batch.status_code == 201, batch.text
    batch_id = batch.json()["id"]
    issue = (batch.json().get("issues") or [{}])[0]
    assert float(issue.get("qty") or 0) == pytest.approx(11.0)

    patched = c.patch(
        f"/api/production/batches/{batch_id}",
        json={"issues": [{"id": issue["id"], "qty": 12}]},
    )
    assert patched.status_code == 200, patched.text
    assert float((patched.json().get("issues") or [{}])[0]["qty"]) == pytest.approx(12.0)

    bad = c.patch(
        f"/api/production/batches/{batch_id}",
        json={"issues": [{"id": "missing-line", "qty": 1}]},
    )
    assert bad.status_code == 400

    cancelled = c.post(f"/api/production/batches/{batch_id}/cancel")
    assert cancelled.status_code == 200
    blocked = c.patch(
        f"/api/production/batches/{batch_id}",
        json={"issues": [{"id": issue["id"], "qty": 9}]},
    )
    assert blocked.status_code == 409

    summary = c.get("/api/production/profitability/summary")
    assert summary.status_code == 200
    assert "margin" in summary.json()

    recipes = c.get("/api/production/profitability/recipes")
    assert recipes.status_code == 200

    material = c.get("/api/production/profitability/material-variance")
    assert material.status_code == 200

    products = c.get("/api/production/profitability/products")
    assert products.status_code == 200

    trend = c.get("/api/production/profitability/cost-trend")
    assert trend.status_code == 200
    rm = c.get("/api/production/profitability/rm-consumption")
    assert rm.status_code == 200
    wip = c.get("/api/production/profitability/wip")
    assert wip.status_code == 200


def _seed_production_accounts() -> dict[str, str]:
    """Create finance accounts and wire them into production settings for posting."""
    specs = [
        ("wip", "Production WIP", "Asset"),
        ("raw", "Raw Materials", "Asset"),
        ("fg", "Finished Goods", "Asset"),
        ("clearing", "Expense Clearing", "Expense"),
    ]
    ids: dict[str, str] = {}
    for key, name, account_type in specs:
        created = c.post(
            "/api/finance/accounts",
            json={"account_name": _uniq(name), "account_type": account_type},
        )
        assert created.status_code == 201, created.text
        ids[key] = created.json()["id"]

    updated = c.patch(
        "/api/production/settings",
        json={
            "wip_account_id": ids["wip"],
            "raw_material_account_id": ids["raw"],
            "finished_goods_account_id": ids["fg"],
            "expense_clearing_account_id": ids["clearing"],
        },
    )
    assert updated.status_code == 200, updated.text
    return ids


def test_post_then_unpost_batch() -> None:
    deps = _seed_products()
    _seed_production_accounts()

    recipe = c.post(
        "/api/production/recipes",
        json={
            "name": _uniq("PostUnpost"),
            "code": _uniq("PU"),
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
        },
    )
    assert recipe.status_code == 201, recipe.text
    recipe_id = recipe.json()["id"]

    batch = c.post(
        "/api/production/batches",
        json={
            "recipe_id": recipe_id,
            "location_id": deps["location_id"],
            "planned_quantity": 1,
            "batch_date": date.today().isoformat(),
        },
    )
    assert batch.status_code == 201, batch.text
    batch_id = batch.json()["id"]

    completed = c.post(f"/api/production/batches/{batch_id}/complete")
    assert completed.status_code == 200, completed.text

    cost = c.post(
        f"/api/production/batches/{batch_id}/costs",
        json={"cost_type": "Labour", "amount": 25, "description": "mixing"},
    )
    assert cost.status_code == 201, cost.text

    posted = c.post(f"/api/production/batches/{batch_id}/post")
    assert posted.status_code == 200, posted.text
    body = posted.json()
    assert body["status"] == "Posted"
    posting = body.get("posting") or {}
    assert posting.get("movement_ids"), posting
    assert posting.get("voucher_ids"), posting

    unposted = c.post(f"/api/production/batches/{batch_id}/unpost")
    assert unposted.status_code == 200, unposted.text
    restored = unposted.json()
    assert restored["status"] == "In Progress"
    restored_posting = restored.get("posting") or {}
    assert not restored_posting.get("movement_ids")
    assert not restored_posting.get("voucher_ids")
