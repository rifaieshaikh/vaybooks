"""Non-Streamlit reports / home dashboard container (Mongo only).

Wires ReportAppService the same way as bootstrap (report_facade).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["ReportsContainer"] = None


@dataclass
class ReportsContainer:
    backend: str  # always "mongo"
    reports: Any  # ReportAppService


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


def _build_mongo(uri: str) -> ReportsContainer:
    from pymongo import MongoClient

    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.inventory_container import get_inventory_container
    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.finance.reports.service import ReportAppService
    from vaybooks.bms.application.finance.reports.services import (
        BusinessInsightsReportService,
        CustomerReportService,
        LaborReportService,
        OperationsReportService,
        ProfitabilityReportService,
    )
    from vaybooks.bms.application.finance.reports.services.inventory_report_service import (
        InventoryReportService,
    )
    from vaybooks.bms.application.finance.reports.services.sales_report_service import (
        SalesReportService,
    )
    from vaybooks.bms.infrastructure.repositories.finance.mongo_report_repository import (
        MongoReportRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    parties = get_parties_container()
    finance = get_finance_container()
    inventory = get_inventory_container()
    report_repo = MongoReportRepository(db)

    sales_svc = None
    try:
        from packages.services_kit.sales_container import get_sales_container

        sales_svc = get_sales_container().sales
    except Exception:
        sales_svc = None

    inventory_reports = InventoryReportService(inventory.inventory, sales=sales_svc)
    reports = ReportAppService(
        report_repo,
        BusinessInsightsReportService(
            report_repo, finance.accounting, parties.vendors, parties.customers
        ),
        ProfitabilityReportService(report_repo),
        OperationsReportService(report_repo),
        LaborReportService(report_repo),
        CustomerReportService(report_repo),
        SalesReportService(report_repo),
        inventory_reports=inventory_reports,
    )
    return ReportsContainer(backend="mongo", reports=reports)


def build_reports_container() -> ReportsContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Reports container using Mongo backend db=%s", _db_name())
    return container


def get_reports_container() -> ReportsContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_reports_container()
    return _CONTAINER


def set_reports_container(container: ReportsContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_reports_container() -> ReportsContainer:
    set_reports_container(None)
    return get_reports_container()
