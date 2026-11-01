"""Cross-module reports catalog — deep-links to module report pages."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from packages.services_kit.reports_container import get_reports_container

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Catalog entries deep-link into migrated module report routes.
_CATALOG: list[dict[str, Any]] = [
    {
        "id": "finance_trial_balance",
        "title": "Trial Balance",
        "module": "finance",
        "href": "/finance/trial-balance",
    },
    {
        "id": "finance_reports",
        "title": "Finance Reports",
        "module": "finance",
        "href": "/finance/reports",
    },
    {
        "id": "sales_summary",
        "title": "Sales Summary",
        "module": "sales",
        "href": "/sales/reports",
    },
    {
        "id": "purchases_reports",
        "title": "Purchases Reports",
        "module": "purchases",
        "href": "/purchases/reports",
    },
    {
        "id": "stock_on_hand",
        "title": "Stock On Hand",
        "module": "inventory",
        "href": "/inventory/reports",
    },
    {
        "id": "boutique_reports",
        "title": "Boutique Reports",
        "module": "boutique",
        "href": "/boutique/reports",
    },
    {
        "id": "crm_reports",
        "title": "CRM Reports",
        "module": "crm",
        "href": "/crm/reports",
    },
    {
        "id": "projects_reports",
        "title": "Projects Reports",
        "module": "projects",
        "href": "/projects/reports",
    },
]


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "module": "reports",
        "status": "ok",
        "backend": get_reports_container().backend,
    }


@router.get("/catalog")
def catalog() -> dict[str, object]:
    return {"reports": list(_CATALOG)}


@router.get("/dashboard-summary")
def dashboard_summary() -> dict[str, object]:
    from services.parties.serialize import entity_dict

    summary = get_reports_container().reports.get_dashboard_summary()
    return {"status": "ok", "summary": entity_dict(summary)}
