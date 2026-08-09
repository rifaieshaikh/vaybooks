"""Combined VayBooks API (embedded gateway + all module stubs)."""

from __future__ import annotations

from fastapi import FastAPI

from services.access.router import router as access_router
from services.boutique.router import router as boutique_router
from services.crm.router import router as crm_router
from services.finance.router import router as finance_router
from services.gateway.app import create_gateway_app
from services.home.router import router as home_router
from services.inventory.router import router as inventory_router
from services.migration.router import router as migration_router
from services.notifications.router import router as notifications_router
from services.parties.router import router as parties_router
from services.production.router import router as production_router
from services.projects.router import router as projects_router
from services.purchases.router import router as purchases_router
from services.reports.router import router as reports_router
from services.sales.router import router as sales_router
from services.schedulers.router import router as schedulers_router
from services.settings.router import router as settings_router
from services.store.router import router as store_router
from services.system.router import router as system_router

MODULE_ROUTERS = [
    parties_router,
    home_router,
    reports_router,
    inventory_router,
    sales_router,
    purchases_router,
    finance_router,
    boutique_router,
    store_router,
    crm_router,
    projects_router,
    production_router,
    migration_router,
    system_router,
    settings_router,
    schedulers_router,
    access_router,
    notifications_router,
]


def create_combined_app() -> FastAPI:
    """Create embedded gateway with auth, license, flags, and module stubs."""
    return create_gateway_app(module_routers=MODULE_ROUTERS)


app = create_combined_app()
