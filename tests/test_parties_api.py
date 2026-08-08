"""Parties typed API smoke tests (Mongo only)."""

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


def test_parties_health() -> None:
    r = c.get("/api/parties/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] == "mongo"


def test_customer_crud_and_blacklist() -> None:
    name = _uniq("Acme")
    phone = f"9{uuid.uuid4().int % 10**9:09d}"
    created = c.post(
        "/api/parties/customers",
        json={"customer_name": name, "phone_number": phone},
    )
    assert created.status_code == 201, created.text
    cid = created.json()["id"]

    listed = c.get("/api/parties/customers", params={"q": name})
    assert listed.status_code == 200
    assert any(row["id"] == cid for row in listed.json())

    got = c.get(f"/api/parties/customers/{cid}")
    assert got.status_code == 200
    assert got.json()["customer_name"] == name

    updated = c.put(
        f"/api/parties/customers/{cid}",
        json={
            "customer_name": f"{name} Updated",
            "phone_number": phone,
            "city": "Pune",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["customer_name"] == f"{name} Updated"

    bl = c.post(
        f"/api/parties/customers/{cid}/blacklist",
        json={"blacklisted": True, "reason": "test"},
    )
    assert bl.status_code == 200
    assert bl.json()["is_blacklisted"] is True

    summary = c.get(f"/api/parties/customers/{cid}/summary")
    assert summary.status_code == 200
    assert "balance" in summary.json()


def test_vendor_and_segment_flow() -> None:
    seg = c.post(
        "/api/parties/segments",
        json={"name": _uniq("VIP"), "applies_to": ["customer", "vendor"]},
    )
    assert seg.status_code == 201, seg.text
    sid = seg.json()["id"]

    vendor = c.post(
        "/api/parties/vendors",
        json={"vendor_name": _uniq("SupplyCo"), "phone_number": f"9{uuid.uuid4().int % 10**9:09d}"},
    )
    assert vendor.status_code == 201, vendor.text

    segs = c.get("/api/parties/segments")
    assert any(row["id"] == sid for row in segs.json())

    deleted = c.delete(f"/api/parties/segments/{sid}")
    assert deleted.status_code == 204


def test_workers_partners_agents() -> None:
    worker = c.post(
        "/api/parties/workers",
        json={"worker_name": _uniq("Ravi"), "default_hourly_rate": 120, "activity_refs": []},
    )
    assert worker.status_code == 201, worker.text

    partner = c.post(
        "/api/parties/delivery-partners",
        json={"partner_name": _uniq("FastShip"), "phone_number": f"9{uuid.uuid4().int % 10**9:09d}"},
    )
    assert partner.status_code == 201, partner.text

    agent = c.post(
        "/api/parties/commission-agents",
        json={"agent_name": _uniq("Agent"), "phone_number": f"9{uuid.uuid4().int % 10**9:09d}"},
    )
    assert agent.status_code == 201, agent.text


def test_legacy_parties_shim() -> None:
    r = c.post(
        "/api/parties",
        json={
            "name": _uniq("LegacyCust"),
            "kind": "customer",
            "phone_number": f"9{uuid.uuid4().int % 10**9:09d}",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "customer"
    assert r.json()["id"]
