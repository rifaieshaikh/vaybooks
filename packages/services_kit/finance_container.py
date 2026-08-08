"""Non-Streamlit finance service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["FinanceContainer"] = None


@dataclass
class FinanceContainer:
    backend: str  # always "mongo"
    accounting: Any  # AccountingAppService
    account_repo: Any
    voucher_repo: Any


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


def _build_mongo(uri: str) -> FinanceContainer:
    from pymongo import MongoClient

    from vaybooks.bms.application.finance.accounting.service import AccountingAppService
    from vaybooks.bms.infrastructure.repositories.finance.mongo_accounting_repository import (
        MongoAccountRepository,
        MongoVoucherRepository,
    )
    from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
        MongoCounterRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    account_repo = MongoAccountRepository(db)
    voucher_repo = MongoVoucherRepository(db)
    counter_repo = MongoCounterRepository(db)
    accounting = AccountingAppService(account_repo, voucher_repo, counter_repo)
    return FinanceContainer(
        backend="mongo",
        accounting=accounting,
        account_repo=account_repo,
        voucher_repo=voucher_repo,
    )


def build_finance_container() -> FinanceContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Finance container using Mongo backend db=%s", _db_name())
    return container


def get_finance_container() -> FinanceContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_finance_container()
    return _CONTAINER


def set_finance_container(container: FinanceContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_finance_container() -> FinanceContainer:
    set_finance_container(None)
    return get_finance_container()
