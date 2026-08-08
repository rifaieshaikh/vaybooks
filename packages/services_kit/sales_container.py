"""Non-Streamlit sales service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["SalesContainer"] = None


@dataclass
class SalesContainer:
    backend: str  # always "mongo"
    sales: Any  # SalesAppService
    reports: Any  # SalesModuleReportService


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


def _build_mongo(uri: str) -> SalesContainer:
    from pymongo import MongoClient

    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.inventory_container import get_inventory_container
    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.finance.reports.services.sales_module_report_service import (
        SalesModuleReportService,
    )
    from vaybooks.bms.application.sales.service import SalesAppService
    from vaybooks.bms.application.settings.business.service import BusinessAppService
    from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
        MongoCounterRepository,
    )
    from vaybooks.bms.infrastructure.repositories.sales.mongo_customer_price_repository import (
        MongoCustomerPriceRepository,
    )
    from vaybooks.bms.infrastructure.repositories.sales.mongo_sales_repository import (
        MongoDeliveryNoteRepository,
        MongoEstimateRepository,
        MongoQuotationRepository,
        MongoSalesOrderRepository,
        MongoSalesReturnRepository,
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

    sales = SalesAppService(
        MongoSalesOrderRepository(db),
        MongoDeliveryNoteRepository(db),
        MongoSalesReturnRepository(db),
        MongoCounterRepository(db),
        finance.accounting,
        inventory.inventory,
        customer_service=parties.customers,
        business_service=business,
        estimate_repo=MongoEstimateRepository(db),
        quotation_repo=MongoQuotationRepository(db),
        customer_price_repo=MongoCustomerPriceRepository(db),
    )
    reports = SalesModuleReportService(sales)
    return SalesContainer(backend="mongo", sales=sales, reports=reports)


def build_sales_container() -> SalesContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Sales container using Mongo backend db=%s", _db_name())
    return container


def get_sales_container() -> SalesContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_sales_container()
    return _CONTAINER


def set_sales_container(container: SalesContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_sales_container() -> SalesContainer:
    set_sales_container(None)
    return get_sales_container()
