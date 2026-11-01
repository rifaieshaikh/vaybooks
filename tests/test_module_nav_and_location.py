"""Nav filter + primary location bootstrap unit tests."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest

from vaybooks.bms.application.setup.bootstrap import (
    complete_org_setup,
    normalize_modules,
    upsert_primary_location,
)


def test_normalize_modules_keeps_core_settings():
    mods = normalize_modules(["sales"])
    assert "core" in mods
    assert "settings" in mods
    assert "finance" in mods


@pytest.mark.skipif(
    not (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")),
    reason="Mongo URI not configured",
)
def test_upsert_primary_location_org_scoped():
    from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
    from pymongo import MongoClient

    uri = mongo_uri()
    if not uri:
        pytest.skip("no mongo")
    client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    try:
        client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"mongo unavailable: {exc}")

    db = client[mongo_db_name()]
    org = f"loc_org_{uuid4().hex[:8]}"
    try:
        loc_id = upsert_primary_location(
            db,
            org,
            {
                "code": "MAIN",
                "name": "HQ",
                "location_type": "Warehouse",
                "address": "1 Test St",
            },
        )
        assert loc_id
        doc = db.warehouses.find_one({"_id": loc_id})
        assert doc is not None
        assert doc.get("org_id") == org
        assert doc.get("name") == "HQ"
        # idempotent
        again = upsert_primary_location(
            db, org, {"code": "MAIN", "name": "HQ Updated", "location_type": "Warehouse"}
        )
        assert again == loc_id
        assert db.warehouses.find_one({"_id": loc_id})["name"] == "HQ Updated"
    finally:
        db.warehouses.delete_many({"org_id": org})


@pytest.mark.skipif(
    not (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")),
    reason="Mongo URI not configured",
)
def test_complete_org_setup_creates_primary_location():
    from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
    from pymongo import MongoClient

    uri = mongo_uri()
    if not uri:
        pytest.skip("no mongo")
    client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    try:
        client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"mongo unavailable: {exc}")

    db = client[mongo_db_name()]
    org = f"setup_org_{uuid4().hex[:8]}"
    owner_id = uuid4().hex
    try:
        db.users.insert_one(
            {
                "_id": owner_id,
                "username": f"owner_{org}",
                "display_name": "Owner",
                "password_hash": "x",
                "role_ids": ["role_owner"],
                "location_ids": [],
                "org_id": org,
                "active": True,
            }
        )
        ent = complete_org_setup(
            db,
            org_id=org,
            business={"legal_name": "Setup Loc Co", "fy_start_month": 4},
            enabled_modules=["core", "parties", "settings", "sales", "finance"],
            primary_location={
                "code": "HQ1",
                "name": "HQ Warehouse",
                "location_type": "Warehouse",
                "address": "1 Road",
            },
            owner_user_id=owner_id,
        )
        assert ent.setup_completed is True
        loc = db.warehouses.find_one({"code": "HQ1", "org_id": org})
        assert loc is not None
        user = db.users.find_one({"_id": owner_id})
        assert loc["_id"] in (user.get("location_ids") or [])
    finally:
        db.warehouses.delete_many({"org_id": org})
        db.users.delete_many({"org_id": org})
        db.org_entitlements.delete_one({"_id": org})
        db.business_profile.delete_one({"_id": org})
        db.accounts.delete_many({"org_id": org})
        db.counters.delete_many({"org_id": org})
