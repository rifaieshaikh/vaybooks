"""Non-Streamlit settings service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["SettingsContainer"] = None


@dataclass
class SettingsContainer:
    backend: str  # always "mongo"
    business: Any
    vendor_services: Any
    discounts: Any
    measurements: Any
    boutique_activities: Any
    store_activities: Any
    project_activities: Any
    prefs_collection: Any


def _mongo_uri() -> str:
    from packages.services_kit.mongo_env import mongo_uri

    return mongo_uri()


def _db_name() -> str:
    from packages.services_kit.mongo_env import mongo_db_name

    return mongo_db_name()


def _require_uri() -> str:
    uri = _mongo_uri()
    if not uri:
        raise RuntimeError(
            "MONGODB_URI is required (set env or .streamlit/secrets.toml); "
            "memory backend is disabled"
        )
    return uri


class MongoPrefsStore:
    """Tiny singleton prefs document (timezone/locale) in Mongo."""

    _ID = "default"

    def __init__(self, collection):
        self._col = collection

    def get(self) -> dict[str, str]:
        doc = self._col.find_one({"_id": self._ID}) or {}
        return {
            "timezone": str(doc.get("timezone") or "UTC"),
            "locale": str(doc.get("locale") or "en"),
        }

    def put(self, *, timezone: str | None = None, locale: str | None = None) -> dict[str, str]:
        current = self.get()
        if timezone:
            current["timezone"] = timezone
        if locale:
            current["locale"] = locale
        self._col.update_one(
            {"_id": self._ID},
            {"$set": current},
            upsert=True,
        )
        return current


def _build_mongo(uri: str) -> SettingsContainer:
    from pymongo import MongoClient

    from packages.services_kit.boutique_container import get_boutique_container
    from vaybooks.bms.application.projects.activity_config.service import (
        ProjectActivityConfigAppService,
    )
    from vaybooks.bms.application.sales.discounts.service import DiscountAppService
    from vaybooks.bms.application.settings.business.service import BusinessAppService
    from vaybooks.bms.application.settings.services.service import VendorServiceAppService
    from vaybooks.bms.application.store.activities.service import StoreActivityAppService
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_activity_config_repository import (
        MongoProjectActivityConfigRepository,
    )
    from vaybooks.bms.infrastructure.repositories.sales.mongo_discount_rule_repository import (
        MongoDiscountRuleRepository,
    )
    from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
        MongoBusinessProfileRepository,
    )
    from vaybooks.bms.infrastructure.repositories.shared.mongo_vendor_service_repository import (
        MongoVendorServiceRepository,
    )
    from vaybooks.bms.infrastructure.repositories.store.mongo_store_activity_repository import (
        MongoStoreActivityRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    boutique = get_boutique_container()
    business = BusinessAppService(MongoBusinessProfileRepository(db))
    vendor_services = VendorServiceAppService(MongoVendorServiceRepository(db))
    discounts = DiscountAppService(MongoDiscountRuleRepository(db))
    store_activities = StoreActivityAppService(MongoStoreActivityRepository(db))
    project_activities = ProjectActivityConfigAppService(
        MongoProjectActivityConfigRepository(db)
    )
    prefs = MongoPrefsStore(db["app_prefs"])

    return SettingsContainer(
        backend="mongo",
        business=business,
        vendor_services=vendor_services,
        discounts=discounts,
        measurements=boutique.measurements,
        boutique_activities=boutique.activities,
        store_activities=store_activities,
        project_activities=project_activities,
        prefs_collection=prefs,
    )


def build_settings_container() -> SettingsContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Settings container using Mongo backend db=%s", _db_name())
    return container


def get_settings_container() -> SettingsContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_settings_container()
    return _CONTAINER


def set_settings_container(container: SettingsContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_settings_container() -> SettingsContainer:
    set_settings_container(None)
    return get_settings_container()
