"""Non-Streamlit purchases service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["PurchasesContainer"] = None


@dataclass
class PurchasesContainer:
    backend: str  # always "mongo"
    purchases: Any  # PurchaseAppService
    reports: Any  # PurchaseReportService


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


def _build_mongo(uri: str) -> PurchasesContainer:
    from pymongo import MongoClient

    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.inventory_container import get_inventory_container
    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.finance.reports.services.purchase_report_service import (
        PurchaseReportService,
    )
    from vaybooks.bms.application.purchases.service import PurchaseAppService
    from vaybooks.bms.application.settings.business.service import BusinessAppService
    from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
        MongoCounterRepository,
    )
    from vaybooks.bms.infrastructure.repositories.purchases.mongo_purchase_price_history_repository import (
        MongoPurchasePriceHistoryRepository,
    )
    from vaybooks.bms.infrastructure.repositories.purchases.mongo_purchase_repository import (
        MongoGoodsReceiptRepository,
        MongoPurchaseOrderRepository,
        MongoPurchaseReturnRepository,
    )
    from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
        MongoBusinessProfileRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    finance = get_finance_container()
    inventory = get_inventory_container()
    parties = get_parties_container()
    business = BusinessAppService(MongoBusinessProfileRepository(db))

    purchases = PurchaseAppService(
        MongoPurchaseOrderRepository(db),
        MongoGoodsReceiptRepository(db),
        MongoPurchaseReturnRepository(db),
        MongoCounterRepository(db),
        finance.accounting,
        inventory.inventory,
        vendor_service=parties.vendors,
        business_service=business,
        price_history_repo=MongoPurchasePriceHistoryRepository(db),
    )
    reports = PurchaseReportService(purchases)
    return PurchasesContainer(backend="mongo", purchases=purchases, reports=reports)


def build_purchases_container() -> PurchasesContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Purchases container using Mongo backend db=%s", _db_name())
    return container


def get_purchases_container() -> PurchasesContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_purchases_container()
    return _CONTAINER


def set_purchases_container(container: PurchasesContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_purchases_container() -> PurchasesContainer:
    set_purchases_container(None)
    return get_purchases_container()
