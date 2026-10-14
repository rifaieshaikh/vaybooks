"""Unit + optional Mongo tests for org setup bootstrap."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest

from vaybooks.bms.application.setup.bootstrap import (
    assert_org_accounting,
    normalize_modules,
    seed_org_accounting,
)


def test_normalize_modules_adds_finance_and_always():
    mods = normalize_modules(["sales"])
    assert "core" in mods
    assert "parties" in mods
    assert "settings" in mods
    assert "finance" in mods
    assert "sales" in mods


def test_normalize_modules_dedupes():
    mods = normalize_modules(["core", "core", "parties", "settings", "finance"])
    assert mods.count("core") == 1


@pytest.mark.skipif(
    not (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")),
    reason="Mongo URI not configured",
)
def test_two_org_coa_isolation():
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
    org_a = f"test_a_{uuid4().hex[:8]}"
    org_b = f"test_b_{uuid4().hex[:8]}"
    try:
        seed_org_accounting(db, org_a)
        seed_org_accounting(db, org_b)
        assert_org_accounting(db, org_a)
        assert_org_accounting(db, org_b)
        a_ids = {d["_id"] for d in db.accounts.find({"org_id": org_a})}
        b_ids = {d["_id"] for d in db.accounts.find({"org_id": org_b})}
        assert a_ids
        assert b_ids
        assert a_ids.isdisjoint(b_ids)
        # Re-seed is idempotent
        before = db.accounts.count_documents({"org_id": org_a})
        seed_org_accounting(db, org_a)
        assert db.accounts.count_documents({"org_id": org_a}) == before
    finally:
        db.accounts.delete_many({"org_id": {"$in": [org_a, org_b]}})
        db.counters.delete_many({"org_id": {"$in": [org_a, org_b]}})
