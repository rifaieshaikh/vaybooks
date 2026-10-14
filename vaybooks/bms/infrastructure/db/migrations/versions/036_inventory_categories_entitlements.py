"""Sync inventory.categories granular keys into plans/roles after catalog split.

Without this, stale plan.feature_keys omit inventory.categories.open (and related
keys), so effective_keys = plan ∩ … strips them and the category detail route
never opens.
"""

from datetime import datetime

from pymongo.database import Database

from vaybooks.bms.domain.entitlements.catalog import (
    ORG_ENTITLEMENT_ID,
    PLAN_DEFINITIONS,
    SYSTEM_ROLE_DEFINITIONS,
)

_CATEGORY_KEYS = (
    "inventory.categories.view",
    "inventory.categories.create",
    "inventory.categories.edit",
    "inventory.categories.deactivate",
    "inventory.categories.open",
    "inventory.categories.overview.view",
    "inventory.categories.items.view",
    "inventory.categories.items.add",
    "inventory.categories.sales.view",
    "inventory.categories.production.view",
    "inventory.categories.customization.view",
)

_BOUTIQUE_CATEGORY_KEYS = ("boutique.items.category.edit",)


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
            "$addToSet": {
                "feature_keys": {"$each": list(_CATEGORY_KEYS) + list(_BOUTIQUE_CATEGORY_KEYS)}
            },
            "$set": {"updated_at": now},
        },
    )

    for key in list(_CATEGORY_KEYS) + list(_BOUTIQUE_CATEGORY_KEYS):
        db.feature_flags.update_one(
            {"_id": key},
            {
                "$setOnInsert": {
                    "key": key,
                    "enabled": True,
                    "description": key,
                    "updated_at": now,
                }
            },
            upsert=True,
        )

    # Custom roles that still only have legacy view/edit get the open/detail family.
    for role in db.roles.find(
        {
            "$or": [
                {"permission_keys": "inventory.categories.view"},
                {"permission_keys": "inventory.categories.edit"},
            ]
        }
    ):
        keys = set(role.get("permission_keys") or [])
        if "inventory.categories.open" in keys:
            continue
        if "inventory.categories.edit" in keys:
            keys.update(_CATEGORY_KEYS)
        else:
            keys.update(
                (
                    "inventory.categories.view",
                    "inventory.categories.open",
                    "inventory.categories.overview.view",
                    "inventory.categories.items.view",
                )
            )
        db.roles.update_one(
            {"_id": role["_id"]},
            {"$set": {"permission_keys": sorted(keys), "updated_at": now}},
        )

    for role in db.roles.find({"permission_keys": {"$regex": "^boutique\\.items\\."}}):
        keys = set(role.get("permission_keys") or [])
        if "boutique.items.category.edit" in keys:
            continue
        if "boutique.items.edit" in keys:
            keys.add("boutique.items.category.edit")
            db.roles.update_one(
                {"_id": role["_id"]},
                {"$set": {"permission_keys": sorted(keys), "updated_at": now}},
            )

    db.org_entitlements.update_one(
        {"_id": ORG_ENTITLEMENT_ID},
        {"$inc": {"version": 1}, "$set": {"updated_at": now}},
        upsert=False,
    )
