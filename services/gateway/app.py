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
    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.inventory_container import get_inventory_container
    from packages.services_kit.parties_container import get_parties_container

    parties = get_parties_container()
    inventory = get_inventory_container()
    finance = get_finance_container()
    app.state.parties = parties
    app.state.inventory = inventory
    app.state.finance = finance
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
