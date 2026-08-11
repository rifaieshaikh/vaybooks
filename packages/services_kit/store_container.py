"""Non-Streamlit store service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["StoreContainer"] = None


@dataclass
class StoreContainer:
    backend: str  # always "mongo"
    activities: Any
    time_tracking: Any
    workers: Any


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


def _build_mongo(uri: str) -> StoreContainer:
    from pymongo import MongoClient

    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.store.activities.service import StoreActivityAppService
    from vaybooks.bms.application.store.time_tracking.service import (
        StoreTimeTrackingAppService,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_worker_repository import (
        MongoWorkerRepository,
    )
    from vaybooks.bms.infrastructure.repositories.store.mongo_store_activity_repository import (
        MongoStoreActivityRepository,
    )
    from vaybooks.bms.infrastructure.repositories.store.mongo_store_time_tracking_repository import (
        MongoStoreTimeTrackingRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    parties = get_parties_container()
    activity_repo = MongoStoreActivityRepository(db)
    time_repo = MongoStoreTimeTrackingRepository(db)
    worker_repo = MongoWorkerRepository(db)

    activities = StoreActivityAppService(activity_repo)
    time_tracking = StoreTimeTrackingAppService(time_repo, activity_repo, worker_repo)
    return StoreContainer(
        backend="mongo",
        activities=activities,
        time_tracking=time_tracking,
        workers=parties.workers,
    )


def build_store_container() -> StoreContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Store container using Mongo backend db=%s", _db_name())
    return container


def get_store_container() -> StoreContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_store_container()
    return _CONTAINER


def set_store_container(container: StoreContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_store_container() -> StoreContainer:
    set_store_container(None)
    return get_store_container()
