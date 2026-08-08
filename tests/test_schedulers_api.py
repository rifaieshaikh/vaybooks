"""Schedulers typed API smoke tests (Mongo only)."""

from __future__ import annotations

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


def test_schedulers_health() -> None:
    r = c.get("/api/schedulers/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_list_filter_create_run_crm_jobs() -> None:
    listed = c.get("/api/schedulers/jobs", params={"module": "crm"})
    assert listed.status_code == 200, listed.text
    jobs = listed.json()
    assert isinstance(jobs, list)
    assert len(jobs) >= 1
    assert all(j.get("module") == "crm" or j.get("domain") == "crm" for j in jobs)

    job_id = jobs[0]["id"]
    created = c.post(
        "/api/schedulers/jobs",
        json={"module": "crm", "job_id": job_id, "enabled": True, "name": jobs[0].get("name") or ""},
    )
    assert created.status_code == 201, created.text
    assert created.json()["id"] == job_id

    ran = c.post(f"/api/schedulers/jobs/{job_id}/run")
    assert ran.status_code == 200, ran.text
    assert "run" in ran.json()


def test_module_packs() -> None:
    for module in ("sales", "purchases", "inventory", "production", "boutique", "projects"):
        r = c.get("/api/schedulers/jobs", params={"module": module})
        assert r.status_code == 200, f"{module}: {r.text}"
        assert isinstance(r.json(), list)
