"""Backfill org_id / setup_completed for multi-tenant setup wizard."""

from __future__ import annotations

from packages.tenancy.context import DEFAULT_ORG_ID
from vaybooks.bms.domain.entitlements.catalog import ORG_ENTITLEMENT_ID, PLAN_ENTERPRISE, ALL_MODULES
from vaybooks.bms.domain.shared.date_utils import utc_now


def up(db) -> None:
    now = utc_now()
    # Entitlement: ensure default org doc with setup_completed
    ent = db.org_entitlements.find_one({"_id": DEFAULT_ORG_ID})
    legacy = db.org_entitlements.find_one({"_id": ORG_ENTITLEMENT_ID})
    if ent is None and legacy is not None and ORG_ENTITLEMENT_ID != DEFAULT_ORG_ID:
        legacy_copy = dict(legacy)
        legacy_copy["_id"] = DEFAULT_ORG_ID
        db.org_entitlements.replace_one({"_id": DEFAULT_ORG_ID}, legacy_copy, upsert=True)
        ent = legacy_copy
    if ent is None and legacy is not None:
        ent = legacy

    profile = db.business_profile.find_one({"_id": DEFAULT_ORG_ID})
    if profile is None:
        profile = db.business_profile.find_one({"_id": "default"})

    has_users = db.users.estimated_document_count() > 0
    has_accounts = db.accounts.estimated_document_count() > 0
    legal = (profile or {}).get("legal_name") or ""
    completed = bool(legal.strip()) or (has_users and has_accounts)

    if ent is None:
        db.org_entitlements.replace_one(
            {"_id": DEFAULT_ORG_ID},
            {
                "_id": DEFAULT_ORG_ID,
                "plan_id": PLAN_ENTERPRISE,
                "enabled_modules": list(ALL_MODULES),
                "version": 1,
                "setup_completed": completed,
                "updated_at": now,
            },
            upsert=True,
        )
    else:
        db.org_entitlements.update_one(
            {"_id": ent["_id"]},
            {
                "$set": {
                    "setup_completed": bool(ent.get("setup_completed", completed)),
                    "updated_at": now,
                }
            },
        )
        if ent["_id"] != DEFAULT_ORG_ID and DEFAULT_ORG_ID == "default":
            # Also upsert canonical default id
            doc = dict(ent)
            doc["_id"] = DEFAULT_ORG_ID
            doc["setup_completed"] = bool(ent.get("setup_completed", completed))
            db.org_entitlements.replace_one({"_id": DEFAULT_ORG_ID}, doc, upsert=True)

    if profile and profile.get("_id") != DEFAULT_ORG_ID:
        copy = dict(profile)
        copy["_id"] = DEFAULT_ORG_ID
        db.business_profile.replace_one({"_id": DEFAULT_ORG_ID}, copy, upsert=True)

    db.users.update_many(
        {"$or": [{"org_id": {"$exists": False}}, {"org_id": ""}]},
        {"$set": {"org_id": DEFAULT_ORG_ID}},
    )
    db.accounts.update_many(
        {"$or": [{"org_id": {"$exists": False}}, {"org_id": ""}]},
        {"$set": {"org_id": DEFAULT_ORG_ID}},
    )
    db.counters.update_many(
        {"$or": [{"org_id": {"$exists": False}}, {"org_id": ""}]},
        {"$set": {"org_id": DEFAULT_ORG_ID}},
    )
