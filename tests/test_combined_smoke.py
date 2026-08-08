"""Smoke test for combined API scaffolding."""

from uuid import uuid4

from fastapi.testclient import TestClient

from services.combined.main import app


def test_smoke() -> None:
    c = TestClient(app)
    assert c.get("/health").status_code == 200

    r = c.post("/api/auth/login", json={"username": "a", "password": "b"})
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()

    r = c.post("/api/license/verify")
    assert r.status_code == 200
    assert r.json()["status"] == "skipped"

    phone = f"9{uuid4().int % 10**9:09d}"
    r = c.post(
        "/api/parties",
        json={"name": "Acme", "kind": "customer", "phone_number": phone},
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    r = c.post("/api/sales/invoices", json={"customer_id": pid, "total": 100})
    assert r.status_code == 201, r.text
    body = r.json()
    # Consumers stubbed healthy → full notify path (not degraded)
    assert body["degraded_pending"] is False
    assert body["stock_status"] == "reserve_requested"

    r = c.get("/api/sales/health")
    assert r.json()["degraded_pending"] is False

    import os

    os.environ["SALES_FORCE_DEGRADED"] = "1"
    r = c.post("/api/sales/invoices", json={"customer_id": pid, "total": 50})
    assert r.json()["degraded_pending"] is True
    os.environ.pop("SALES_FORCE_DEGRADED", None)

    r = c.get("/api/home/dashboard")
    assert r.status_code == 200

    r = c.get("/api/flags/modules")
    assert r.status_code == 200


if __name__ == "__main__":
    test_smoke()
    print("OK")
