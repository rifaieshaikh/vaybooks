"""Smoke tests covering all module APIs beyond health."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from services.combined.main import app

c = TestClient(app)


def test_all_module_health() -> None:
    modules = [
        "parties",
        "home",
        "reports",
        "inventory",
        "sales",
        "purchases",
        "finance",
        "boutique",
        "store",
        "crm",
        "projects",
        "production",
        "migration",
        "system",
        "settings",
        "schedulers",
        "access",
    ]
    for mod in modules:
        r = c.get(f"/api/{mod}/health")
        assert r.status_code == 200, mod
        assert r.json()["status"] == "ok"


def test_module_crud_flows() -> None:
    assert c.post("/api/auth/login", json={"username": "u", "password": "p"}).status_code == 200

    vphone = f"9{uuid4().int % 10**9:09d}"
    cphone = f"9{uuid4().int % 10**9:09d}"
    party = c.post(
        "/api/parties",
        json={"name": "VendorCo", "kind": "vendor", "phone_number": vphone},
    ).json()
    cust = c.post(
        "/api/parties",
        json={"name": "CustCo", "kind": "customer", "phone_number": cphone},
    ).json()

    po = c.post(
        "/api/purchases/orders",
        json={"vendor_id": party["id"], "total": 10},
    )
    assert po.status_code == 201

    bill = c.post(
        "/api/purchases/bills",
        json={"vendor_id": party["id"], "total": 10},
    )
    assert bill.status_code == 201

    # Boutique order create needs a parties customer (Mongo); skip full CRUD here.
    bout_health = c.get("/api/boutique/health")
    assert bout_health.status_code == 200
    assert bout_health.json().get("backend") == "mongo"

    act = c.post("/api/store/activities", json={"name": "Packing"})
    assert act.status_code == 201
    te = c.post(
        "/api/store/time-entries",
        json={
            "worker_id": "w1",
            "activity_id": act.json()["id"],
            "hours": 2,
        },
    )
    assert te.status_code == 201

    lead = c.post("/api/crm/leads", json={"name": "Lead A"})
    assert lead.status_code == 201
    assert c.post(
        "/api/crm/activities",
        json={"lead_id": lead.json()["id"], "kind": "call"},
    ).status_code == 201

    job = c.post(
        "/api/schedulers/jobs",
        json={"name": "crm-digest", "module": "crm"},
    )
    assert job.status_code == 201
    assert c.post(f"/api/schedulers/jobs/{job.json()['id']}/run").status_code == 200

    proj = c.post(
        "/api/projects",
        json={"name": "Site A", "customer_id": cust["id"]},
    )
    assert proj.status_code == 201
    assert c.post(
        "/api/projects/enquiries",
        json={"project_id": proj.json()["id"], "subject": "BOQ"},
    ).status_code == 201

    recipe = c.post(
        "/api/production/recipes",
        json={"name": "Mix", "output_product_id": "p1"},
    )
    assert recipe.status_code == 201
    batch = c.post(
        "/api/production/batches",
        json={"recipe_id": recipe.json()["id"], "planned_qty": 5},
    )
    assert batch.status_code == 201
    assert c.post(f"/api/production/batches/{batch.json()['id']}/complete").status_code == 200

    mig = c.post(
        "/api/migration/batches",
        json={"source": "csv", "entity": "customers"},
    )
    assert mig.status_code == 201
    assert c.post(f"/api/migration/batches/{mig.json()['id']}/run").json()["status"] == "completed"

    assert c.put("/api/system/settings/theme", json={"key": "theme", "value": "teal"}).status_code == 200
    assert c.get("/api/system/diagnostics").status_code == 200

    assert c.post("/api/access/users", json={"username": "admin1", "role_ids": ["admin"]}).status_code == 201
    assert c.get("/api/access/roles").status_code == 200

    assert c.get("/api/home/dashboard").status_code == 200
    assert c.get("/api/reports/catalog").status_code == 200
    assert c.get("/api/settings/prefs").status_code == 200
    assert c.get("/api/inventory/health").json()["consumer_healthy"] is True
    assert c.get("/api/finance/health").json()["consumer_healthy"] is True


if __name__ == "__main__":
    test_all_module_health()
    test_module_crud_flows()
    print("OK")
