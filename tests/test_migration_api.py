"""Migration API smoke tests (Mongo only)."""

from __future__ import annotations

import base64
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


def test_migration_health_and_entities() -> None:
    r = c.get("/api/migration/health")
    assert r.status_code == 200
    assert r.json()["backend"] == "mongo"
    ents = c.get("/api/migration/entities")
    assert ents.status_code == 200
    assert "customers" in ents.json()["entities"]


def test_profiles_parse_preview_batch() -> None:
    name = f"profile-{uuid.uuid4().hex[:8]}"
    saved = c.post(
        "/api/migration/profiles",
        json={
            "entity": "customers",
            "name": name,
            "mapping": {"phone_number": "Phone", "customer_name": "Name"},
        },
    )
    assert saved.status_code == 201, saved.text
    profile_id = saved.json()["id"]

    listed = c.get("/api/migration/profiles", params={"entity": "customers"})
    assert listed.status_code == 200
    assert any(p.get("id") == profile_id for p in listed.json())

    csv_text = "Phone,Name\n9000000001,Test Customer\n"
    parsed = c.post(
        "/api/migration/parse",
        json={
            "filename": "customers.csv",
            "content_base64": base64.b64encode(csv_text.encode()).decode(),
        },
    )
    assert parsed.status_code == 200, parsed.text
    upload_id = parsed.json()["upload_id"]
    assert "Phone" in parsed.json()["columns"]

    preview = c.post(
        "/api/migration/preview",
        json={
            "upload_id": upload_id,
            "entity": "customers",
            "mapping": {"phone_number": "Phone", "customer_name": "Name"},
        },
    )
    assert preview.status_code == 200, preview.text
    assert "total_rows" in preview.json()

    batch = c.post(
        "/api/migration/batches",
        json={
            "source": "csv",
            "entity": "customers",
            "upload_id": upload_id,
            "mapping": {"phone_number": "Phone", "customer_name": "Name"},
        },
    )
    assert batch.status_code == 201, batch.text
    ran = c.post(f"/api/migration/batches/{batch.json()['id']}/run")
    assert ran.status_code == 200, ran.text
    assert ran.json()["status"] in ("completed", "completed_with_errors")
