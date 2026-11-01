"""VayBooks Gateway FastAPI application."""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterable

from fastapi import APIRouter, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response as StarletteResponse

from services.auth.license_router import router as license_router
from services.auth.router import decode_bearer_payload, router as auth_router
from services.flags.router import router as flags_router
from services.setup.router import router as setup_router, setup_required_blocked
from packages.tenancy.context import DEFAULT_ORG_ID, reset_org_id, set_org_id

CORRELATION_HEADER = "X-Correlation-ID"

_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:8000",
]


def _ui_root() -> Path | None:
    raw = (os.environ.get("VAYBOOKS_UI_ROOT") or "").strip()
    if not raw:
        return None
    path = Path(raw)
    if path.is_dir() and (path / "index.html").is_file():
        return path
    return None


def _mount_spa(app: FastAPI, ui_root: Path) -> None:
    """Serve packaged React UI without shadowing /api or /health."""
    assets_dir = ui_root / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="ui-assets")

    index_html = ui_root / "index.html"

    @app.get("/")
    async def spa_index() -> FileResponse:
        return FileResponse(index_html)

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> StarletteResponse:
        if full_path.startswith(("api/", "api", "health", "docs", "openapi.json", "redoc")):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = ui_root / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index_html)


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

    @app.middleware("http")
    async def org_setup_middleware(request: Request, call_next):
        reset_org_id()
        path = request.url.path
        payload = decode_bearer_payload(request.headers.get("Authorization"))
        if payload:
            oid = str(payload.get("org_id") or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
            set_org_id(oid)
            if path.startswith("/api") and setup_required_blocked(path):
                try:
                    from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
                    from pymongo import MongoClient
                    from vaybooks.bms.infrastructure.repositories.entitlements.mongo_entitlement_repository import (
                        MongoOrgEntitlementRepository,
                    )

                    uri = mongo_uri()
                    if uri:
                        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
                        ent = MongoOrgEntitlementRepository(client[mongo_db_name()]).get(oid)
                        if not ent or not ent.setup_completed:
                            from fastapi.responses import JSONResponse

                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": "Organization setup required",
                                    "code": "SETUP_REQUIRED",
                                },
                            )
                except Exception:
                    # Fail open if Mongo is unreachable; route handlers will surface errors.
                    pass
        response: Response = await call_next(request)
        return response

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "gateway"}

    app.include_router(auth_router)
    app.include_router(license_router)
    app.include_router(flags_router)
    app.include_router(setup_router)

    if module_routers:
        for router in module_routers:
            app.include_router(router)

    ui_root = _ui_root()
    if ui_root is not None:
        _mount_spa(app, ui_root)

    return app


def include_module_routers(app: FastAPI, routers: Iterable[APIRouter]) -> None:
    """Proxy-style mount of module routers for combined desktop/cloud modes."""
    for router in routers:
        app.include_router(router)
