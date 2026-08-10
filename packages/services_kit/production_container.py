"""Non-Streamlit production service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["ProductionContainer"] = None


@dataclass
class ProductionContainer:
    backend: str  # always "mongo"
    production: Any
    reports: Any
    activities: Any


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


def _build_mongo(uri: str) -> ProductionContainer:
    from pymongo import MongoClient

    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.inventory_container import get_inventory_container
    from vaybooks.bms.application.finance.reports.services.production_report_service import (
        ProductionReportService,
    )
    from vaybooks.bms.application.production.service import ProductionAppService
    from vaybooks.bms.application.production.activities.service import (
        ProductionActivityAppService,
    )
    from vaybooks.bms.infrastructure.repositories.production.mongo_production_repository import (
        MongoProductionBatchRepository,
        MongoProductionSettingsRepository,
        MongoRecipeRepository,
    )
    from vaybooks.bms.infrastructure.repositories.production.mongo_production_activity_repository import (
        MongoProductionActivityRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    inventory = get_inventory_container()
    finance = get_finance_container()

    production = ProductionAppService(
        MongoRecipeRepository(db),
        MongoProductionBatchRepository(db),
        MongoProductionSettingsRepository(db),
        inventory.inventory,
        finance.accounting,
    )
    reports = ProductionReportService(production)
    activities = ProductionActivityAppService(MongoProductionActivityRepository(db))
    return ProductionContainer(
        backend="mongo",
        production=production,
        reports=reports,
        activities=activities,
    )


def build_production_container() -> ProductionContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Production container using Mongo backend db=%s", _db_name())
    return container


def get_production_container() -> ProductionContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_production_container()
    return _CONTAINER


def set_production_container(container: ProductionContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_production_container() -> ProductionContainer:
    set_production_container(None)
    return get_production_container()
