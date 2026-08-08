"""VayBooks Gateway FastAPI application."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Iterable

from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from services.auth.license_router import router as license_router
from services.auth.router import router as auth_router
from services.flags.router import router as flags_router

CORRELATION_HEADER = "X-Correlation-ID"

_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
]


@asynccontextmanager
async def _lifespan(app: FastAPI):
    from packages.services_kit.access_container import get_access_container
    from packages.services_kit.boutique_container import get_boutique_container
    from packages.services_kit.crm_container import get_crm_container
    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.inventory_container import get_inventory_container
    from packages.services_kit.migration_container import get_migration_container
    from packages.services_kit.parties_container import get_parties_container
    from packages.services_kit.production_container import get_production_container
    from packages.services_kit.projects_container import get_projects_container
    from packages.services_kit.purchases_container import get_purchases_container
    from packages.services_kit.reports_container import get_reports_container
    from packages.services_kit.sales_container import get_sales_container
    from packages.services_kit.schedulers_container import get_schedulers_container
    from packages.services_kit.settings_container import get_settings_container
    from packages.services_kit.store_container import get_store_container
    from packages.services_kit.system_container import get_system_container

    parties = get_parties_container()
    inventory = get_inventory_container()
    finance = get_finance_container()
    purchases = get_purchases_container()
    sales = get_sales_container()
    boutique = get_boutique_container()
    crm = get_crm_container()
    projects = get_projects_container()
    store = get_store_container()
    production = get_production_container()
    access = get_access_container()
    settings = get_settings_container()
    schedulers = get_schedulers_container()
    migration = get_migration_container()
    reports = get_reports_container()
    system = get_system_container()
    app.state.parties = parties
    app.state.inventory = inventory
    app.state.finance = finance
    app.state.purchases = purchases
    app.state.sales = sales
    app.state.boutique = boutique
    app.state.crm = crm
    app.state.projects = projects
    app.state.store = store
    app.state.production = production
    app.state.access = access
    app.state.settings = settings
    app.state.schedulers = schedulers
    app.state.migration = migration
    app.state.reports = reports
    app.state.system = system
    yield


def create_gateway_app(
    *,
    module_routers: Iterable[APIRouter] | None = None,
) -> FastAPI:
    """Build the gateway app with auth, flags, and optional module routers."""
    app = FastAPI(title="VayBooks Gateway", lifespan=_lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[CORRELATION_HEADER],
    )

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        correlation_id = request.headers.get(CORRELATION_HEADER) or str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        response: Response = await call_next(request)
        response.headers[CORRELATION_HEADER] = correlation_id
        return response

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "gateway"}

    app.include_router(auth_router)
    app.include_router(license_router)
    app.include_router(flags_router)

    if module_routers:
        for router in module_routers:
            app.include_router(router)

    return app


def include_module_routers(app: FastAPI, routers: Iterable[APIRouter]) -> None:
    """Proxy-style mount of module routers for combined desktop/cloud modes."""
    for router in routers:
        app.include_router(router)
