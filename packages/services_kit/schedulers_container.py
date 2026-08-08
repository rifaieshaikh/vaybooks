"""Non-Streamlit schedulers service container (Mongo only).

Assembles SchedulerAppService the same way as bootstrap._build_scheduler_service,
wiring domain services from sibling containers where available.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["SchedulersContainer"] = None


@dataclass
class SchedulersContainer:
    backend: str  # always "mongo"
    schedulers: Any  # SchedulerAppService


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


def _try_get(attr_path: str) -> Any:
    """Resolve 'module:getter.attr' best-effort (None on failure)."""
    try:
        mod_name, rest = attr_path.split(":", 1)
        getter_name, attr = rest.split(".", 1)
        mod = __import__(mod_name, fromlist=[getter_name])
        container = getattr(mod, getter_name)()
        return getattr(container, attr)
    except Exception:
        return None


def _build_services_and_repos(db) -> tuple[dict, dict]:
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_delivery_repository import (
        MongoDeliveryRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_invoice_repository import (
        MongoInvoiceRepository,
    )
    from vaybooks.bms.infrastructure.repositories.boutique.mongo_order_repository import (
        MongoOrderRepository,
    )
    from vaybooks.bms.infrastructure.repositories.crm.mongo_crm_activity_repository import (
        MongoCrmActivityRepository,
    )
    from vaybooks.bms.infrastructure.repositories.crm.mongo_crm_enquiry_repository import (
        MongoCrmEnquiryRepository,
    )
    from vaybooks.bms.infrastructure.repositories.crm.mongo_crm_lead_repository import (
        MongoCrmLeadRepository,
    )
    from vaybooks.bms.infrastructure.repositories.finance.mongo_accounting_repository import (
        MongoAccountRepository,
        MongoVoucherRepository,
    )
    from vaybooks.bms.infrastructure.repositories.inventory.mongo_inventory_repository import (
        MongoInventoryProductRepository,
        MongoStockTransferRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_customer_repository import (
        MongoCustomerRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_vendor_repository import (
        MongoVendorRepository,
    )
    from vaybooks.bms.infrastructure.repositories.production.mongo_production_repository import (
        MongoProductionBatchRepository,
        MongoRecipeRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_app_user_repository import (
        MongoProjectMembershipRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_procurement_repository import (
        MongoProjectProcurementRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_quotation_repository import (
        MongoProjectQuotationRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_repository import (
        MongoProjectRepository,
    )
    from vaybooks.bms.infrastructure.repositories.purchases.mongo_purchase_repository import (
        MongoGoodsReceiptRepository,
        MongoPurchaseOrderRepository,
    )
    from vaybooks.bms.infrastructure.repositories.sales.mongo_sales_repository import (
        MongoDeliveryNoteRepository,
        MongoEstimateRepository,
        MongoQuotationRepository,
        MongoSalesOrderRepository,
        MongoSalesReturnRepository,
    )

    services: dict[str, Any] = {}
    for key, path in (
        ("customers", "packages.services_kit.parties_container:get_parties_container.customers"),
        ("vendors", "packages.services_kit.parties_container:get_parties_container.vendors"),
        ("accounting", "packages.services_kit.finance_container:get_finance_container.accounting"),
        ("inventory", "packages.services_kit.inventory_container:get_inventory_container.inventory"),
        ("purchases", "packages.services_kit.purchases_container:get_purchases_container.purchases"),
        ("sales", "packages.services_kit.sales_container:get_sales_container.sales"),
        ("orders", "packages.services_kit.boutique_container:get_boutique_container.orders"),
        ("crm_leads", "packages.services_kit.crm_container:get_crm_container.leads"),
        ("crm_enquiries", "packages.services_kit.crm_container:get_crm_container.enquiries"),
        ("crm_activities", "packages.services_kit.crm_container:get_crm_container.activities"),
        ("crm_dashboard", "packages.services_kit.crm_container:get_crm_container.dashboard"),
        ("crm_reports", "packages.services_kit.crm_container:get_crm_container.reports"),
        ("crm_settings", "packages.services_kit.crm_container:get_crm_container.settings"),
        ("crm_notifications", "packages.services_kit.crm_container:get_crm_container.notifications"),
        ("projects", "packages.services_kit.projects_container:get_projects_container.projects"),
        ("reports_purchases", "packages.services_kit.purchases_container:get_purchases_container.reports"),
        ("reports_sales_module", "packages.services_kit.sales_container:get_sales_container.reports"),
        ("reports_boutique_module", "packages.services_kit.boutique_container:get_boutique_container.reports"),
    ):
        value = _try_get(path)
        if value is not None:
            services[key] = value

    repos = {
        "customers": MongoCustomerRepository(db),
        "vendors": MongoVendorRepository(db),
        "crm_activities": MongoCrmActivityRepository(db),
        "crm_leads": MongoCrmLeadRepository(db),
        "crm_enquiries": MongoCrmEnquiryRepository(db),
        "accounts": MongoAccountRepository(db),
        "vouchers": MongoVoucherRepository(db),
        "quotations": MongoQuotationRepository(db),
        "estimates": MongoEstimateRepository(db),
        "sales_orders": MongoSalesOrderRepository(db),
        "delivery_notes": MongoDeliveryNoteRepository(db),
        "sales_returns": MongoSalesReturnRepository(db),
        "purchase_orders": MongoPurchaseOrderRepository(db),
        "goods_receipts": MongoGoodsReceiptRepository(db),
        "inventory_products": MongoInventoryProductRepository(db),
        "stock_transfers": MongoStockTransferRepository(db),
        "production_recipes": MongoRecipeRepository(db),
        "production_batches": MongoProductionBatchRepository(db),
        "boutique_orders": MongoOrderRepository(db),
        "boutique_invoices": MongoInvoiceRepository(db),
        "boutique_deliveries": MongoDeliveryRepository(db),
        "projects": MongoProjectRepository(db),
        "project_memberships": MongoProjectMembershipRepository(db),
        "project_quotations": MongoProjectQuotationRepository(db),
        "project_procurement": MongoProjectProcurementRepository(db),
    }
    return services, repos


def _build_scheduler_service(db, services: dict, *, repos: dict, audit=None):
    """Mirror of vaybooks.bms.ui.bootstrap._build_scheduler_service (no Streamlit)."""
    from vaybooks.bms.application.schedulers.jobs import all_jobs
    from vaybooks.bms.application.schedulers.jobs._base import Deps
    from vaybooks.bms.application.schedulers.registry import JobRegistry
    from vaybooks.bms.application.schedulers.reports_registry import build_report_registry
    from vaybooks.bms.application.schedulers.service import SchedulerAppService
    from vaybooks.bms.infrastructure.repositories.schedulers import (
        MongoSchedulerJobConfigRepository,
        MongoSchedulerLeaseRepository,
        MongoSchedulerNotificationRepository,
        MongoSchedulerQueries,
        MongoSchedulerReportArtifactRepository,
        MongoSchedulerReportConfigRepository,
        MongoSchedulerReportRunLogRepository,
        MongoSchedulerRunLogRepository,
    )

    deps = Deps(queries=MongoSchedulerQueries(db), services=services, repos=repos)
    registry = JobRegistry()
    for job, definition in all_jobs(deps):
        registry.register(job, definition)

    return SchedulerAppService(
        MongoSchedulerJobConfigRepository(db),
        MongoSchedulerRunLogRepository(db),
        MongoSchedulerLeaseRepository(db),
        MongoSchedulerNotificationRepository(db),
        registry=registry,
        report_registry=build_report_registry(services),
        report_config_repo=MongoSchedulerReportConfigRepository(db),
        report_run_log_repo=MongoSchedulerReportRunLogRepository(db),
        report_artifact_repo=MongoSchedulerReportArtifactRepository(db),
        audit=audit,
        background=False,
    )


def _build_mongo(uri: str) -> SchedulersContainer:
    from pymongo import MongoClient

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]
    services, repos = _build_services_and_repos(db)
    schedulers = _build_scheduler_service(db, services, repos=repos)
    return SchedulersContainer(backend="mongo", schedulers=schedulers)


def build_schedulers_container() -> SchedulersContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Schedulers container using Mongo backend db=%s", _db_name())
    return container


def get_schedulers_container() -> SchedulersContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_schedulers_container()
    return _CONTAINER


def set_schedulers_container(container: SchedulersContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_schedulers_container() -> SchedulersContainer:
    set_schedulers_container(None)
    return get_schedulers_container()
