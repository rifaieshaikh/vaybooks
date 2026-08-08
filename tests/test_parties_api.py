"""Parties typed API smoke tests (memory backend when Mongo unset)."""

from __future__ import annotations

import os

os.environ["PARTIES_BACKEND"] = "memory"

from fastapi.testclient import TestClient

from packages.services_kit.parties_container import reset_parties_container
from services.combined.main import app


def setup_function() -> None:
    os.environ["PARTIES_BACKEND"] = "memory"
    reset_parties_container()


c = TestClient(app)


def test_parties_health() -> None:
    r = c.get("/api/parties/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] in {"memory", "mongo"}


def test_customer_crud_and_blacklist() -> None:
    created = c.post(
        "/api/parties/customers",
        json={"customer_name": "Acme", "phone_number": "9000000001"},
    )
    assert created.status_code == 201, created.text
    cid = created.json()["id"]

    listed = c.get("/api/parties/customers", params={"q": "Acme"})
    assert listed.status_code == 200
    assert any(row["id"] == cid for row in listed.json())

    got = c.get(f"/api/parties/customers/{cid}")
    assert got.status_code == 200
    assert got.json()["customer_name"] == "Acme"

    updated = c.put(
        f"/api/parties/customers/{cid}",
        json={
            "customer_name": "Acme Updated",
            "phone_number": "9000000001",
            "city": "Pune",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["customer_name"] == "Acme Updated"

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
        json={"name": "VIP", "applies_to": ["customer", "vendor"]},
    )
    assert seg.status_code == 201, seg.text
    sid = seg.json()["id"]

    vendor = c.post(
        "/api/parties/vendors",
        json={"vendor_name": "SupplyCo", "phone_number": "9000000002"},
    )
    assert vendor.status_code == 201, vendor.text

    segs = c.get("/api/parties/segments")
    assert any(row["id"] == sid for row in segs.json())

    deleted = c.delete(f"/api/parties/segments/{sid}")
    assert deleted.status_code == 204


def test_workers_partners_agents() -> None:
    worker = c.post(
        "/api/parties/workers",
        json={"worker_name": "Ravi", "default_hourly_rate": 120, "activity_refs": []},
    )
    assert worker.status_code == 201, worker.text

    partner = c.post(
        "/api/parties/delivery-partners",
        json={"partner_name": "FastShip", "phone_number": "9000000003"},
    )
    assert partner.status_code == 201, partner.text

    agent = c.post(
        "/api/parties/commission-agents",
        json={"agent_name": "Agent One", "phone_number": "9000000004"},
    )
    assert agent.status_code == 201, agent.text


def test_legacy_parties_shim() -> None:
    r = c.post("/api/parties", json={"name": "LegacyCust", "kind": "customer"})
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "customer"
    assert r.json()["id"]
