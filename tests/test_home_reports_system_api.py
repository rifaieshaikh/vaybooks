"""Home / reports / system API smoke tests (Mongo only)."""

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


def test_home_dashboard_and_mtd() -> None:
    dash = c.get("/api/home/dashboard")
    assert dash.status_code == 200, dash.text
    body = dash.json()
    assert body["status"] == "ok"
    assert "metrics" in body
    assert "active_orders" in body["metrics"]

    mtd = c.get("/api/home/mtd")
    assert mtd.status_code == 200, mtd.text
    assert "metrics" in mtd.json()


def test_reports_catalog() -> None:
    r = c.get("/api/reports/catalog")
    assert r.status_code == 200
    reports = r.json()["reports"]
    assert len(reports) >= 3
    assert any(item.get("href") for item in reports)


def test_system_settings_updates_logs() -> None:
    key = f"test.key.{uuid.uuid4().hex[:8]}"
    put = c.put(f"/api/system/settings/{key}", json={"key": key, "value": "1"})
    assert put.status_code == 200, put.text
    assert put.json()["value"] == "1"

    listed = c.get("/api/system/settings")
    assert listed.status_code == 200
    assert any(row.get("key") == key for row in listed.json())

    updates = c.get("/api/system/updates")
    assert updates.status_code == 200
    assert "current_version" in updates.json()

    checked = c.post("/api/system/updates/check")
    assert checked.status_code == 200

    log = c.post("/api/system/logs", json={"message": "wave9-test", "level": "info"})
    assert log.status_code == 201, log.text
    logs = c.get("/api/system/logs")
    assert logs.status_code == 200
    assert any(row.get("message") == "wave9-test" for row in logs.json())
