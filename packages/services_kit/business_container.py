"""Non-Streamlit business ops service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["BusinessContainer"] = None


@dataclass
class BusinessContainer:
    backend: str
    activities: Any
    tasks: Any
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


def _build_mongo(uri: str) -> BusinessContainer:
    from pymongo import MongoClient

    from packages.services_kit.parties_container import get_parties_container
    from vaybooks.bms.application.business.activities.service import (
        BusinessActivityAppService,
    )
    from vaybooks.bms.application.business.tasks.service import BusinessTaskAppService
    from vaybooks.bms.application.business.time_tracking.service import (
        BusinessTimeTrackingAppService,
    )
    from vaybooks.bms.infrastructure.repositories.business.mongo_business_activity_repository import (
        MongoBusinessActivityRepository,
    )
    from vaybooks.bms.infrastructure.repositories.business.mongo_business_task_repository import (
        MongoBusinessTaskRepository,
    )
    from vaybooks.bms.infrastructure.repositories.business.mongo_business_time_tracking_repository import (
        MongoBusinessTimeTrackingRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_worker_repository import (
        MongoWorkerRepository,
    )

    client = MongoClient(
        uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True
    )
    client.admin.command("ping")
    db = client[_db_name()]

    parties = get_parties_container()
    activity_repo = MongoBusinessActivityRepository(db)
    task_repo = MongoBusinessTaskRepository(db)
    time_repo = MongoBusinessTimeTrackingRepository(db)
    worker_repo = MongoWorkerRepository(db)

    activities = BusinessActivityAppService(activity_repo)
    time_tracking = BusinessTimeTrackingAppService(
        time_repo, task_repo, activity_repo, worker_repo
    )
    tasks = BusinessTaskAppService(
        task_repo, activity_repo, worker_repo, time_repo=time_repo
    )
    return BusinessContainer(
        backend="mongo",
        activities=activities,
        tasks=tasks,
        time_tracking=time_tracking,
        workers=parties.workers,
    )


def build_business_container() -> BusinessContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Business container using Mongo backend db=%s", _db_name())
    return container


def get_business_container() -> BusinessContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_business_container()
    return _CONTAINER


def set_business_container(container: BusinessContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_business_container() -> BusinessContainer:
    set_business_container(None)
    return get_business_container()
