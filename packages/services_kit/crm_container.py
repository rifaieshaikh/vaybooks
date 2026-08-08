"""Non-Streamlit CRM service container (Mongo only, multi-service facade)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["CrmContainer"] = None


@dataclass
class CrmContainer:
    backend: str  # always "mongo"
    leads: Any
    enquiries: Any
    activities: Any
    dashboard: Any
    settings: Any
    reports: Any
    notifications: Any


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


def _build_mongo(uri: str) -> CrmContainer:
    from pymongo import MongoClient

    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.crm import (
        CrmActivityAppService,
        CrmDashboardAppService,
        CrmEnquiryAppService,
        CrmLeadAppService,
        CrmNotificationAppService,
        CrmReportService,
        CrmSettingsAppService,
    )
    from vaybooks.bms.infrastructure.repositories.crm import (
        MongoCrmActivityRepository,
        MongoCrmAuditRepository,
        MongoCrmEnquiryRepository,
        MongoCrmLeadRepository,
        MongoCrmNotificationPreferencesRepository,
        MongoCrmNotificationRepository,
        MongoCrmSettingsRepository,
    )
    from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
        MongoCounterRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    parties = get_parties_container()
    finance = get_finance_container()

    lead_repo = MongoCrmLeadRepository(db)
    enquiry_repo = MongoCrmEnquiryRepository(db)
    activity_repo = MongoCrmActivityRepository(db)
    settings_repo = MongoCrmSettingsRepository(db)
    audit_repo = MongoCrmAuditRepository(db)
    notification_repo = MongoCrmNotificationRepository(db)
    prefs_repo = MongoCrmNotificationPreferencesRepository(db)
    counter_repo = MongoCounterRepository(db)

    notifications = CrmNotificationAppService(
        notification_repo,
        preferences_repo=prefs_repo,
        activity_repo=activity_repo,
        lead_repo=lead_repo,
        settings_repo=settings_repo,
    )
    settings = CrmSettingsAppService(settings_repo, audit_repo=audit_repo)
    leads = CrmLeadAppService(
        lead_repo,
        audit_repo=audit_repo,
        activity_repo=activity_repo,
        notification_repo=notification_repo,
        notification_service=notifications,
        customer_service=parties.customers,
        counter_repo=counter_repo,
        settings_repo=settings_repo,
        user_service=None,
        enquiry_repo=enquiry_repo,
    )
    enquiries = CrmEnquiryAppService(
        enquiry_repo,
        audit_repo=audit_repo,
        activity_repo=activity_repo,
        lead_repo=lead_repo,
        counter_repo=counter_repo,
        settings_repo=settings_repo,
        user_service=None,
        notification_service=notifications,
    )
    activities = CrmActivityAppService(
        activity_repo,
        settings_repo=settings_repo,
        audit_repo=audit_repo,
        lead_repo=lead_repo,
        user_service=None,
    )
    sales = None
    try:
        from packages.services_kit.sales_container import get_sales_container

        sales = get_sales_container().sales
    except Exception:
        sales = None

    dashboard = CrmDashboardAppService(
        lead_repo,
        enquiry_repo=enquiry_repo,
        activity_repo=activity_repo,
        customer_service=parties.customers,
        sales_service=sales,
        accounting_service=finance.accounting,
        settings_repo=settings_repo,
    )
    reports = CrmReportService(
        lead_repo,
        enquiry_repo=enquiry_repo,
        activity_repo=activity_repo,
        customer_service=parties.customers,
        settings_repo=settings_repo,
        sales_service=sales,
        accounting_service=finance.accounting,
    )
    return CrmContainer(
        backend="mongo",
        leads=leads,
        enquiries=enquiries,
        activities=activities,
        dashboard=dashboard,
        settings=settings,
        reports=reports,
        notifications=notifications,
    )


def build_crm_container() -> CrmContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("CRM container using Mongo backend db=%s", _db_name())
    return container


def get_crm_container() -> CrmContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_crm_container()
    return _CONTAINER


def set_crm_container(container: CrmContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_crm_container() -> CrmContainer:
    set_crm_container(None)
    return get_crm_container()
