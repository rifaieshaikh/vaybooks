"""Smoke test for combined API scaffolding."""

from uuid import uuid4

from fastapi.testclient import TestClient

from services.combined.main import app


def test_smoke() -> None:
    c = TestClient(app)
    assert c.get("/health").status_code == 200

    # Empty catalog seeds admin/admin; otherwise use those credentials.
    r = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    if r.status_code != 200:
        from uuid import uuid4 as _uuid4

        uname = f"smoke-{_uuid4().hex[:8]}"
        created = c.post(
            "/api/access/users",
            json={
                "username": uname,
                "display_name": "Smoke",
                "password": "test-pass",
                "role_ids": [],
            },
        )
        assert created.status_code == 201, created.text
        r = c.post("/api/auth/login", json={"username": uname, "password": "test-pass"})
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
    assert r.json()["id"]

    r = c.get("/api/sales/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "degraded_pending" in body
    assert body.get("backend") == "mongo"

    import os

    os.environ["SALES_FORCE_DEGRADED"] = "1"
    r = c.get("/api/sales/health")
    assert r.json()["degraded_pending"] is True
    os.environ.pop("SALES_FORCE_DEGRADED", None)

    r = c.get("/api/home/dashboard")
    assert r.status_code == 200

    r = c.get("/api/flags/modules")
    assert r.status_code == 200


if __name__ == "__main__":
    test_smoke()
    print("OK")
