"""Non-Streamlit projects service container (Mongo only, multi-service facade)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["ProjectsContainer"] = None


@dataclass
class ProjectsContainer:
    backend: str
    projects: Any
    enquiries: Any
    documents: Any
    time: Any
    expenses: Any
    boq: Any
    budget: Any
    measurements: Any
    billing: Any
    dpr: Any
    portal: Any
    activity_configs: Any
    profitability: Any
    reports: Any
    quality: Any
    offline: Any


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


def _build_mongo(uri: str) -> ProjectsContainer:
    from pymongo import MongoClient

    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.projects.activity_config.service import (
        ProjectActivityConfigAppService,
    )
    from vaybooks.bms.application.projects.billing.service import ProjectBillingAppService
    from vaybooks.bms.application.projects.boq.service import ProjectBoqAppService
    from vaybooks.bms.application.projects.budget.service import ProjectBudgetAppService
    from vaybooks.bms.application.projects.core.service import ProjectAppService
    from vaybooks.bms.application.projects.documents.service import ProjectDocumentAppService
    from vaybooks.bms.application.projects.dpr.service import ProjectDprAppService
    from vaybooks.bms.application.projects.enquiries.service import ProjectEnquiryAppService
    from vaybooks.bms.application.projects.expenses.service import ProjectExpenseAppService
    from vaybooks.bms.application.projects.measurements.service import (
        ProjectMeasurementAppService,
    )
    from vaybooks.bms.application.projects.offline.service import ProjectOfflineAppService
    from vaybooks.bms.application.projects.portal.service import ProjectPortalAppService
    from vaybooks.bms.application.projects.profitability.service import (
        ProjectProfitabilityService,
    )
    from vaybooks.bms.application.projects.quality.service import (
        ProjectQualityConfigAppService,
    )
    from vaybooks.bms.application.finance.reports.services.project_report_service import (
        ProjectReportService,
    )
    from vaybooks.bms.application.projects.time.service import ProjectTimeAppService
    from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
        MongoCounterRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_customer_repository import (
        MongoCustomerRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_worker_repository import (
        MongoWorkerRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_activity_config_repository import (
        MongoProjectActivityConfigRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_boq_repository import (
        MongoProjectBoqRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_budget_repository import (
        MongoProjectBudgetRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_cash_flow_repository import (
        MongoProjectCashFlowRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_document_repository import (
        MongoProjectDocumentRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_dpr_repository import (
        MongoProjectDprRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_enquiry_repository import (
        MongoProjectEnquiryRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_expense_repository import (
        MongoProjectExpenseRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_measurement_repository import (
        MongoProjectMeasurementRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_offline_draft_repository import (
        MongoProjectOfflineDraftRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_portal_token_repository import (
        MongoProjectPortalTokenRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_proforma_repository import (
        MongoProjectProformaRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_quality_config_repository import (
        MongoProjectQualityConfigRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_quotation_repository import (
        MongoProjectQuotationRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_ra_repository import (
        MongoProjectRABillRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_repository import (
        MongoProjectRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_retention_repository import (
        MongoProjectRetentionRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_template_repository import (
        MongoProjectTemplateRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_time_entry_repository import (
        MongoProjectTimeEntryRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_cost_transfer_repository import (
        MongoProjectCostTransferRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_variation_repository import (
        MongoProjectVariationRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_work_order_repository import (
        MongoProjectWorkOrderRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_project_write_off_repository import (
        MongoProjectWriteOffRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    parties = get_parties_container()
    finance = get_finance_container()
    purchase_service = None
    sales_service = None
    try:
        from packages.services_kit.purchases_container import get_purchases_container

        purchase_service = get_purchases_container().purchases
    except Exception:
        pass
    try:
        from packages.services_kit.sales_container import get_sales_container

        sales_service = get_sales_container().sales
    except Exception:
        pass

    counter_repo = MongoCounterRepository(db)
    for counter_id, prefix in (
        ("project_number", "PRJ"),
        ("enquiry_number", "ENQ"),  # used by ProjectEnquiryAppService
        ("project_quotation_number", "PQ"),
        ("project_work_order_number", "PWO"),
        ("project_ra_number", "PRA"),
        ("project_proforma_number", "PPF"),
        ("project_variation_number", "PV"),
    ):
        if db.counters.find_one({"_id": counter_id}) is None:
            db.counters.insert_one(
                {"_id": counter_id, "prefix": prefix, "current_value": 0}
            )
    customer_repo = MongoCustomerRepository(db)
    worker_repo = MongoWorkerRepository(db)
    project_repo = MongoProjectRepository(db)
    template_repo = MongoProjectTemplateRepository(db)
    enquiry_repo = MongoProjectEnquiryRepository(db)
    document_repo = MongoProjectDocumentRepository(db)
    time_repo = MongoProjectTimeEntryRepository(db)
    expense_repo = MongoProjectExpenseRepository(db)
    boq_repo = MongoProjectBoqRepository(db)
    budget_repo = MongoProjectBudgetRepository(db)
    cash_flow_repo = MongoProjectCashFlowRepository(db)
    measurement_repo = MongoProjectMeasurementRepository(db)
    ra_repo = MongoProjectRABillRepository(db)
    work_order_repo = MongoProjectWorkOrderRepository(db)
    proforma_repo = MongoProjectProformaRepository(db)
    retention_repo = MongoProjectRetentionRepository(db)
    variation_repo = MongoProjectVariationRepository(db)
    transfer_repo = MongoProjectCostTransferRepository(db)
    write_off_repo = MongoProjectWriteOffRepository(db)
    dpr_repo = MongoProjectDprRepository(db)
    portal_repo = MongoProjectPortalTokenRepository(db)
    activity_config_repo = MongoProjectActivityConfigRepository(db)
    quality_repo = MongoProjectQualityConfigRepository(db)
    offline_repo = MongoProjectOfflineDraftRepository(db)
    quotation_repo = MongoProjectQuotationRepository(db)

    projects = ProjectAppService(
        project_repo,
        template_repo,
        counter_repo,
        customer_repo,
        activity_config_repo=activity_config_repo,
    )
    enquiries = ProjectEnquiryAppService(
        enquiry_repo, project_repo, counter_repo, customer_repo=customer_repo
    )
    documents = ProjectDocumentAppService(document_repo, project_repo)
    time = ProjectTimeAppService(time_repo, project_repo, worker_repo)
    expenses = ProjectExpenseAppService(expense_repo, project_repo)
    boq = ProjectBoqAppService(boq_repo, project_repo)
    budget = ProjectBudgetAppService(
        budget_repo,
        project_repo,
        expense_repo=expense_repo,
        time_repo=time_repo,
        purchase_service=purchase_service,
        cash_flow_repo=cash_flow_repo,
    )
    expenses._budget_service = budget
    measurements = ProjectMeasurementAppService(
        measurement_repo, boq_repo, project_repo, ra_repo=ra_repo
    )
    profitability = ProjectProfitabilityService(project_repo, time_repo, expense_repo)
    billing = ProjectBillingAppService(
        project_repo,
        work_order_repo,
        counter_repo,
        accounting_service=finance.accounting,
        voucher_repo=finance.voucher_repo,
        sales_service=sales_service,
        document_service=documents,
        customer_repo=customer_repo,
        time_repo=time_repo,
        expense_repo=expense_repo,
        ra_repo=ra_repo,
        proforma_repo=proforma_repo,
        retention_repo=retention_repo,
        variation_repo=variation_repo,
        transfer_repo=transfer_repo,
        write_off_repo=write_off_repo,
        purchase_service=purchase_service,
        boq_repo=boq_repo,
        measurement_repo=measurement_repo,
        measurement_service=measurements,
    )
    budget._billing_service = billing
    dpr = ProjectDprAppService(dpr_repo, project_repo)
    portal = ProjectPortalAppService(portal_repo, project_repo)
    activity_configs = ProjectActivityConfigAppService(activity_config_repo)
    quality = ProjectQualityConfigAppService(quality_repo, project_repo, project_service=projects)
    offline = ProjectOfflineAppService(offline_repo, project_repo)
    reports = ProjectReportService(
        project_repo,
        time_repo,
        expense_repo,
        profitability_service=profitability,
        quotation_repo=quotation_repo,
        document_repo=document_repo,
        voucher_repo=finance.voucher_repo,
        ra_repo=ra_repo,
        retention_repo=retention_repo,
        transfer_repo=transfer_repo,
        write_off_repo=write_off_repo,
        variation_repo=variation_repo,
        boq_repo=boq_repo,
        budget_repo=budget_repo,
        measurement_repo=measurement_repo,
        billing_service=billing,
        purchase_service=purchase_service,
    )
    return ProjectsContainer(
        backend="mongo",
        projects=projects,
        enquiries=enquiries,
        documents=documents,
        time=time,
        expenses=expenses,
        boq=boq,
        budget=budget,
        measurements=measurements,
        billing=billing,
        dpr=dpr,
        portal=portal,
        activity_configs=activity_configs,
        profitability=profitability,
        reports=reports,
        quality=quality,
        offline=offline,
    )


def build_projects_container() -> ProjectsContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Projects container using Mongo backend db=%s", _db_name())
    return container


def get_projects_container() -> ProjectsContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_projects_container()
    return _CONTAINER


def set_projects_container(container: ProjectsContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_projects_container() -> ProjectsContainer:
    set_projects_container(None)
    return get_projects_container()
