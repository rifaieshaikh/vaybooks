"""Sync inventory.skus.* entitlement keys after Product/SKU split."""

from datetime import datetime

from pymongo.database import Database

from vaybooks.bms.domain.entitlements.catalog import (
    ORG_ENTITLEMENT_ID,
    PLAN_DEFINITIONS,
    SYSTEM_ROLE_DEFINITIONS,
)

_SKU_KEYS = (
    "inventory.skus.view",
    "inventory.skus.create",
    "inventory.skus.edit",
)


def up(db: Database) -> None:
    now = datetime.utcnow()

    for role_id, meta in SYSTEM_ROLE_DEFINITIONS.items():
        existing = db.roles.find_one({"_id": role_id})
        db.roles.replace_one(
            {"_id": role_id},
            {
                "_id": role_id,
                "name": meta["name"],
                "description": meta.get("description", ""),
                "is_system": True,
                "permission_keys": list(meta.get("permission_keys") or []),
                "created_at": (existing or {}).get("created_at", now),
                "updated_at": now,
            },
            upsert=True,
        )

    for plan_id, meta in PLAN_DEFINITIONS.items():
        existing = db.plans.find_one({"_id": plan_id})
        db.plans.replace_one(
            {"_id": plan_id},
            {
                "_id": plan_id,
                "name": meta["name"],
                "description": meta.get("description", ""),
                "feature_keys": list(meta.get("feature_keys") or []),
                "created_at": (existing or {}).get("created_at", now),
                "updated_at": now,
            },
            upsert=True,
        )

    db.plans.update_many(
        {},
        {
            "$addToSet": {"feature_keys": {"$each": list(_SKU_KEYS)}},
            "$set": {"updated_at": now},
        },
    )

    for key in _SKU_KEYS:
        db.feature_flags.update_one(
            {"_id": key},
            {
                "$setOnInsert": {
                    "_id": key,
                    "enabled": True,
                    "created_at": now,
                    "updated_at": now,
                }
            },
            upsert=True,
        )

    # Roles that can manage products also get SKU keys
    db.roles.update_many(
        {"permission_keys": "inventory.products.view"},
        {
            "$addToSet": {"permission_keys": {"$each": list(_SKU_KEYS)}},
            "$set": {"updated_at": now},
        },
    )

    db.org_entitlements.update_one(
        {"_id": ORG_ENTITLEMENT_ID},
        {"$inc": {"version": 1}, "$set": {"updated_at": now}},
        upsert=True,
    )
