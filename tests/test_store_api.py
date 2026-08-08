"""Store typed API smoke tests (Mongo only)."""

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


def test_store_health() -> None:
    r = c.get("/api/store/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_store_activity_and_time_entry_flow() -> None:
    activity = c.post(
        "/api/store/activities",
        json={
            "activity_name": _uniq("Shelf"),
            "activity_category": "In House Service",
            "default_hourly_expense": 120,
        },
    )
    assert activity.status_code == 201, activity.text
    activity_id = activity.json()["id"]
    assert activity.json()["activity_name"]
    assert activity.json()["requires_time_tracking"] is True

    listed = c.get("/api/store/activities")
    assert listed.status_code == 200
    assert any(row.get("id") == activity_id for row in listed.json())

    patched = c.patch(
        f"/api/store/activities/{activity_id}",
        json={
            "activity_name": activity.json()["activity_name"],
            "activity_category": "In House Service",
            "default_hourly_expense": 150,
            "is_active": True,
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["default_hourly_expense"] == 150

    worker = c.post(
        "/api/parties/workers",
        json={
            "worker_name": _uniq("Clerk"),
            "default_hourly_rate": 100,
            "activity_refs": [{"activity_id": activity_id, "source": "store"}],
        },
    )
    assert worker.status_code == 201, worker.text
    worker_id = worker.json()["id"]

    entry = c.post(
        "/api/store/time-entries",
        json={
            "activity_id": activity_id,
            "worker_id": worker_id,
            "work_date": date.today().isoformat(),
            "start_time": "09:00",
            "end_time": "11:00",
            "notes": "restock",
        },
    )
    assert entry.status_code == 201, entry.text
    entry_id = entry.json()["id"]
    assert entry.json()["duration_minutes"] == 120

    got = c.get(f"/api/store/time-entries/{entry_id}")
    assert got.status_code == 200
    assert got.json()["id"] == entry_id

    updated = c.patch(
        f"/api/store/time-entries/{entry_id}",
        json={
            "work_date": date.today().isoformat(),
            "start_time": "10:00",
            "end_time": "12:30",
            "notes": "updated",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["duration_minutes"] == 150

    completed = c.post(f"/api/store/time-entries/{entry_id}/complete")
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "Completed"

    overview = c.get("/api/store/overview")
    assert overview.status_code == 200
    assert overview.json()["active_activities"] >= 1
    assert overview.json()["total_time_entries"] >= 1

    deleted = c.delete(f"/api/store/time-entries/{entry_id}")
    assert deleted.status_code == 200
    assert c.get(f"/api/store/time-entries/{entry_id}").status_code == 404
