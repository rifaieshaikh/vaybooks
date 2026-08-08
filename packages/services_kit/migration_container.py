"""Non-Streamlit migration service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["MigrationContainer"] = None


@dataclass
class MigrationContainer:
    backend: str  # always "mongo"
    migration: Any  # MigrationAppService


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


def _build_mongo(uri: str) -> MigrationContainer:
    from pymongo import MongoClient

    from packages.services_kit.crm_container import get_crm_container
    from packages.services_kit.finance_container import get_finance_container
    from packages.services_kit.inventory_container import get_inventory_container
    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.migration.service import MigrationAppService
    from vaybooks.bms.infrastructure.repositories.migration.mongo_import_mapping_profile_repository import (
        MongoImportMappingProfileRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    parties = get_parties_container()
    inventory = get_inventory_container()
    finance = get_finance_container()
    leads = None
    try:
        leads = get_crm_container().leads
    except Exception:
        leads = None

    migration = MigrationAppService(
        MongoImportMappingProfileRepository(db),
        parties.customers,
        parties.vendors,
        inventory.inventory,
        finance.accounting,
        party_segment_service=parties.segments,
        lead_service=leads,
        import_batch_repo=None,
    )
    return MigrationContainer(backend="mongo", migration=migration)


def build_migration_container() -> MigrationContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Migration container using Mongo backend db=%s", _db_name())
    return container


def get_migration_container() -> MigrationContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_migration_container()
    return _CONTAINER


def set_migration_container(container: MigrationContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_migration_container() -> MigrationContainer:
    set_migration_container(None)
    return get_migration_container()
