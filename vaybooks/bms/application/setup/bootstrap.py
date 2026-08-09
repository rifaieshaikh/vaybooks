"""Shared org setup bootstrap: modules, COA seed/assert, complete setup."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from packages.tenancy.context import DEFAULT_ORG_ID, set_org_id
from vaybooks.bms.domain.entitlements.catalog import (
    ALL_MODULES,
    SYSTEM_ROLE_DEFINITIONS,
)
from vaybooks.bms.domain.entitlements.entities import OrgEntitlement
from vaybooks.bms.domain.shared.date_utils import utc_now
from vaybooks.bms.infrastructure.db.seed import COUNTERS, DEFAULT_ACCOUNTS

FINANCE_TRIGGER_MODULES = frozenset(
    {
        "sales",
        "purchases",
        "inventory",
        "boutique",
        "store",
        "projects",
        "production",
    }
)
ALWAYS_MODULES = ("core", "parties", "settings")


def normalize_modules(raw: List[str] | None) -> List[str]:
    cleaned: List[str] = []
    for item in raw or []:
        m = (item or "").strip()
        if m in ALL_MODULES and m not in cleaned:
            cleaned.append(m)
    for required in ALWAYS_MODULES:
        if required not in cleaned:
            cleaned.insert(0, required)
    if any(m in FINANCE_TRIGGER_MODULES for m in cleaned) and "finance" not in cleaned:
        cleaned.append("finance")
    out: List[str] = []
    for m in cleaned:
        if m not in out:
            out.append(m)
    return out


def _counter_id(org_id: str, counter_key: str) -> str:
    if org_id == DEFAULT_ORG_ID:
        return counter_key
    return f"{org_id}:{counter_key}"


def seed_org_accounting(db: Database, org_id: str) -> None:
    """Seed DEFAULT_ACCOUNTS and COUNTERS tagged with org_id."""
    oid = (org_id or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    now = utc_now()
    for account_name, account_type, is_store_account in DEFAULT_ACCOUNTS:
        existing = db.accounts.find_one(
            {"account_name": account_name, "org_id": oid}
        )
        if existing:
            continue
        # Legacy unscoped accounts for default org
        if oid == DEFAULT_ORG_ID:
            legacy = db.accounts.find_one(
                {
                    "account_name": account_name,
                    "$or": [{"org_id": {"$exists": False}}, {"org_id": ""}, {"org_id": oid}],
                }
            )
            if legacy:
                db.accounts.update_one({"_id": legacy["_id"]}, {"$set": {"org_id": oid}})
                continue
        try:
            db.accounts.insert_one(
                {
                    "_id": uuid4().hex,
                    "account_name": account_name,
                    "account_type": account_type.value,
                    "org_id": oid,
                    "linked_customer_id": None,
                    "linked_vendor_id": None,
                    "linked_worker_id": None,
                    "linked_agent_id": None,
                    "opening_balance": 0,
                    "current_balance": 0,
                    "is_store_account": is_store_account,
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                }
            )
        except DuplicateKeyError:
            pass

    for counter_key, prefix in COUNTERS:
        cid = _counter_id(oid, counter_key)
        existing = db.counters.find_one({"_id": cid})
        if existing:
            continue
        if oid == DEFAULT_ORG_ID:
            legacy = db.counters.find_one({"_id": counter_key})
            if legacy:
                if "org_id" not in legacy:
                    db.counters.update_one({"_id": counter_key}, {"$set": {"org_id": oid}})
                continue
        try:
            db.counters.insert_one(
                {
                    "_id": cid,
                    "prefix": prefix,
                    "current_value": 0,
                    "org_id": oid,
                    "counter_key": counter_key,
                }
            )
        except DuplicateKeyError:
            pass


def assert_org_accounting(db: Database, org_id: str) -> None:
    oid = (org_id or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    names = {name for name, _, _ in DEFAULT_ACCOUNTS}
    found = {
        doc.get("account_name")
        for doc in db.accounts.find({"org_id": oid}, {"account_name": 1})
        if doc.get("account_name")
    }
    if oid == DEFAULT_ORG_ID and names - found:
        # Accept legacy unscoped
        found |= {
            doc.get("account_name")
            for doc in db.accounts.find(
                {
                    "account_name": {"$in": list(names)},
                    "$or": [{"org_id": {"$exists": False}}, {"org_id": ""}],
                },
                {"account_name": 1},
            )
            if doc.get("account_name")
        }
    missing = sorted(names - found)
    if missing:
        raise RuntimeError(f"Accounting assert failed; missing accounts: {missing}")

    for counter_key, _ in COUNTERS:
        cid = _counter_id(oid, counter_key)
        if db.counters.find_one({"_id": cid}):
            continue
        if oid == DEFAULT_ORG_ID and db.counters.find_one({"_id": counter_key}):
            continue
        raise RuntimeError(f"Accounting assert failed; missing counter: {counter_key}")


def ensure_system_roles(db: Database) -> None:
    """Seed global system role catalog (shared across orgs)."""
    from vaybooks.bms.domain.identity.entities import Role

    for role_id, spec in SYSTEM_ROLE_DEFINITIONS.items():
        if db.roles.find_one({"_id": role_id}):
            continue
        try:
            db.roles.insert_one(
                {
                    "_id": role_id,
                    "name": str(spec.get("name") or role_id),
                    "description": str(spec.get("description") or ""),
                    "permission_keys": list(spec.get("permission_keys") or []),
                    "is_system": True,
                    "created_at": utc_now(),
                    "updated_at": utc_now(),
                }
            )
        except DuplicateKeyError:
            pass


def upsert_primary_location(
    db: Database,
    org_id: str,
    primary_location: Optional[Dict[str, Any]] = None,
) -> str:
    """Create or update the org primary location; return location id."""
    from vaybooks.bms.domain.shared.enums import LocationType

    oid = (org_id or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    loc = primary_location or {}
    code = str(loc.get("code") or "MAIN").strip() or "MAIN"
    name = str(loc.get("name") or "Main Warehouse").strip() or "Main Warehouse"
    address = str(loc.get("address") or "").strip()
    try:
        loc_type = LocationType(str(loc.get("location_type") or "Warehouse"))
    except ValueError:
        loc_type = LocationType.WAREHOUSE

    coll = db.warehouses
    query: Dict[str, Any] = {"code": code, "org_id": oid}
    existing = coll.find_one(query)
    if existing is None and oid == DEFAULT_ORG_ID:
        # Legacy unscoped MAIN
        existing = coll.find_one(
            {
                "code": code,
                "$or": [{"org_id": {"$exists": False}}, {"org_id": ""}, {"org_id": oid}],
            }
        )
    now = utc_now()
    if existing:
        coll.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": name,
                    "address": address,
                    "location_type": loc_type.value,
                    "org_id": oid,
                    "is_active": True,
                    "updated_at": now,
                }
            },
        )
        return str(existing["_id"])

    location_id = uuid4().hex
    try:
        coll.insert_one(
            {
                "_id": location_id,
                "code": code,
                "name": name,
                "location_type": loc_type.value,
                "address": address,
                "org_id": oid,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        )
    except DuplicateKeyError:
        again = coll.find_one({"code": code, "org_id": oid}) or coll.find_one({"code": code})
        if again:
            return str(again["_id"])
        raise
    return location_id


def complete_org_setup(
    db: Database,
    *,
    org_id: str,
    business: Dict[str, Any],
    enabled_modules: List[str],
    license_key: str = "",
    primary_location: Optional[Dict[str, Any]] = None,
    owner_user_id: str = "",
) -> OrgEntitlement:
    """Apply business profile, modules, COA seed, primary location, mark setup_completed."""
    from vaybooks.bms.application.settings.business.service import BusinessAppService
    from vaybooks.bms.infrastructure.db.indexes import ensure_indexes
    from vaybooks.bms.infrastructure.repositories.entitlements.mongo_entitlement_repository import (
        MongoOrgEntitlementRepository,
        MongoPlanRepository,
    )
    from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
        MongoBusinessProfileRepository,
    )
    from vaybooks.bms.application.entitlements.service import PlanAppService

    oid = (org_id or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    set_org_id(oid)

    ensure_indexes(db)
    ensure_system_roles(db)
    modules = normalize_modules(enabled_modules)

    biz = BusinessAppService(MongoBusinessProfileRepository(db))
    biz.update_profile(
        legal_name=str(business.get("legal_name") or ""),
        trade_name=str(business.get("trade_name") or ""),
        gstin=str(business.get("gstin") or ""),
        phone=str(business.get("phone") or ""),
        email=str(business.get("email") or ""),
        state_code=str(business.get("state_code") or ""),
        fy_start_month=int(business.get("fy_start_month") or 4),
    )
    # Ensure profile id is org-scoped
    profile = biz.get_profile()
    profile.id = oid
    MongoBusinessProfileRepository(db).save(profile)

    plans = PlanAppService(
        MongoPlanRepository(db),
        MongoOrgEntitlementRepository(db),
        authorization=None,
        audit=None,
    )
    ent = plans.set_enabled_modules(modules)
    ent.id = oid
    ent.setup_completed = True
    ent.bump_version()
    MongoOrgEntitlementRepository(db).save(ent)

    seed_org_accounting(db, oid)
    assert_org_accounting(db, oid)

    loc_id = upsert_primary_location(db, oid, primary_location)
    if owner_user_id:
        db.users.update_one(
            {"_id": owner_user_id},
            {"$addToSet": {"location_ids": loc_id}},
        )
    else:
        # Sole / first owner in org
        owner = db.users.find_one(
            {"org_id": oid, "role_ids": "role_owner"},
            sort=[("created_at", 1)],
        ) or db.users.find_one({"org_id": oid})
        if owner:
            db.users.update_one(
                {"_id": owner["_id"]},
                {"$addToSet": {"location_ids": loc_id}},
            )

    if license_key:
        try:
            from services.auth.license_store import license_store

            license_store.record_outcome(status="skipped", license_key=license_key)
        except Exception:
            pass

    return ent
