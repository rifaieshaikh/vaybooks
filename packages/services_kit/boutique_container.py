"""Non-Streamlit boutique service container (Mongo only, multi-service facade)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["BoutiqueContainer"] = None


@dataclass
class BoutiqueContainer:
    backend: str  # always "mongo"
    orders: Any
    measurements: Any
    time_tracking: Any
    activities: Any
    invoices: Any
    expenses: Any
    deliveries: Any
    reports: Any


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


def _build_mongo(uri: str) -> BoutiqueContainer:
    from pymongo import MongoClient

    from packages.services_kit.finance_container import get_finance_container
    from vaybooks.bms.application.boutique.activities.service import ActivityAppService
    from vaybooks.bms.application.boutique.deliveries.service import DeliveryAppService
    from vaybooks.bms.application.boutique.expenses.service import ExpenseAppService
    from vaybooks.bms.application.boutique.invoices.service import InvoiceAppService
    from vaybooks.bms.application.boutique.measurements.service import MeasurementAppService
    from vaybooks.bms.application.boutique.orders.service import OrderAppService
    from vaybooks.bms.application.boutique.reports.service import BoutiqueModuleReportService
    from vaybooks.bms.application.boutique.time_tracking.service import TimeTrackingAppService
    from vaybooks.bms.application.finance.reports.services.labor_report_service import (
        LaborReportService,
    )
    from vaybooks.bms.application.finance.reports.services.operations_report_service import (
        OperationsReportService,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_activity_repository import (
        MongoActivityRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_delivery_repository import (
        MongoDeliveryRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_expense_repository import (
        MongoExpenseRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_invoice_repository import (
        MongoInvoiceRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_measurement_repository import (
        MongoMeasurementRecordRepository,
        MongoMeasurementSectionRepository,
        MongoMeasurementSpecRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_order_repository import (
        MongoBillRegistryRepository,
        MongoOrderRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_time_tracking_repository import (
        MongoTimeTrackingRepository,
    )
    from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
        MongoCounterRepository,
    )
    from vaybooks.bms.infrastructure.repositories.finance.mongo_report_repository import (
        MongoReportRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_customer_repository import (
        MongoCustomerRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    finance = get_finance_container()

    order_repo = MongoOrderRepository(db)
    bill_registry_repo = MongoBillRegistryRepository(db)
    activity_repo = MongoActivityRepository(db)
    time_repo = MongoTimeTrackingRepository(db)
    expense_repo = MongoExpenseRepository(db)
    invoice_repo = MongoInvoiceRepository(db)
    delivery_repo = MongoDeliveryRepository(db)
    counter_repo = MongoCounterRepository(db)
    customer_repo = MongoCustomerRepository(db)
    measurement_spec_repo = MongoMeasurementSpecRepository(db)
    measurement_section_repo = MongoMeasurementSectionRepository(db)
    measurement_record_repo = MongoMeasurementRecordRepository(db)
    report_repo = MongoReportRepository(db)

    invoices = InvoiceAppService(
        invoice_repo,
        order_repo,
        expense_repo,
        counter_repo,
        delivery_repo,
        accounting_service=finance.accounting,
    )
    expenses = ExpenseAppService(
        expense_repo,
        order_repo,
        invoice_service=invoices,
        invoice_repo=invoice_repo,
        delivery_repo=delivery_repo,
        time_repo=time_repo,
    )
    deliveries = DeliveryAppService(
        delivery_repo, order_repo, invoice_repo, expense_repo, time_repo
    )
    orders = OrderAppService(
        order_repo,
        bill_registry_repo,
        customer_repo,
        finance.account_repo,
        activity_repo,
        time_repo,
        expense_repo,
        finance.voucher_repo,
        counter_repo,
        invoice_repo=invoice_repo,
        delivery_repo=delivery_repo,
        accounting_service=finance.accounting,
        measurement_repo=measurement_record_repo,
    )
    measurements = MeasurementAppService(
        measurement_spec_repo,
        measurement_record_repo,
        counter_repo,
        measurement_section_repo,
    )
    time_tracking = TimeTrackingAppService(time_repo, order_repo)
    activities = ActivityAppService(activity_repo, order_repo)
    reports = BoutiqueModuleReportService(
        OperationsReportService(report_repo),
        LaborReportService(report_repo),
        order_repo,
        invoice_repo,
        delivery_repo,
    )
    return BoutiqueContainer(
        backend="mongo",
        orders=orders,
        measurements=measurements,
        time_tracking=time_tracking,
        activities=activities,
        invoices=invoices,
        expenses=expenses,
        deliveries=deliveries,
        reports=reports,
    )


def build_boutique_container() -> BoutiqueContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Boutique container using Mongo backend db=%s", _db_name())
    return container


def get_boutique_container() -> BoutiqueContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_boutique_container()
    return _CONTAINER


def set_boutique_container(container: BoutiqueContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_boutique_container() -> BoutiqueContainer:
    set_boutique_container(None)
    return get_boutique_container()
