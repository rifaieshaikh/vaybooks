"""Non-Streamlit inventory service container (Mongo or in-memory)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["InventoryContainer"] = None


@dataclass
class InventoryContainer:
    backend: str  # "mongo" | "memory"
    inventory: Any  # InventoryAppService
    location_repo: Any
    product_repo: Any


def _mongo_uri() -> str:
    from packages.services_kit.mongo_env import mongo_uri

    return mongo_uri()


def _db_name() -> str:
    from packages.services_kit.mongo_env import mongo_db_name

    return mongo_db_name()


def _build_memory() -> InventoryContainer:
    from packages.services_kit.memory_inventory import (
        MemoryInventoryProductRepository,
        MemoryLocationRepository,
        MemoryProductCategoryRepository,
        MemoryProductFieldDefinitionRepository,
        MemoryProductRateHistoryRepository,
        MemoryProductUnitRepository,
        MemoryStockBalanceRepository,
        MemoryStockMovementRepository,
        MemoryStockTransferRepository,
        seed_default_location,
    )
    from vaybooks.bms.application.inventory.service import InventoryAppService
    from vaybooks.bms.domain.inventory.rate_history_service import ProductRateHistoryService

    category_repo = MemoryProductCategoryRepository()
    product_repo = MemoryInventoryProductRepository()
    movement_repo = MemoryStockMovementRepository()
    unit_repo = MemoryProductUnitRepository()
    field_repo = MemoryProductFieldDefinitionRepository()
    location_repo = MemoryLocationRepository()
    balance_repo = MemoryStockBalanceRepository()
    transfer_repo = MemoryStockTransferRepository()
    seed_default_location(location_repo)
    rate_history = ProductRateHistoryService(
        MemoryProductRateHistoryRepository(),
        MemoryProductRateHistoryRepository(),
        MemoryProductRateHistoryRepository(),
    )

    inventory = InventoryAppService(
        category_repo,
        product_repo,
        movement_repo,
        unit_repo=unit_repo,
        field_def_repo=field_repo,
        rate_history=rate_history,
        warehouse_repo=location_repo,
        location_repo=location_repo,
        balance_repo=balance_repo,
        transfer_repo=transfer_repo,
    )
    return InventoryContainer(
        backend="memory",
        inventory=inventory,
        location_repo=location_repo,
        product_repo=product_repo,
    )


def _build_mongo(uri: str) -> InventoryContainer:
    from pymongo import MongoClient

    from vaybooks.bms.application.inventory.service import InventoryAppService
    from vaybooks.bms.domain.inventory.rate_history_service import ProductRateHistoryService
    from vaybooks.bms.infrastructure.repositories.inventory.mongo_inventory_repository import (
        MongoInventoryProductRepository,
        MongoLocationRepository,
        MongoProductCategoryRepository,
        MongoProductFieldDefinitionRepository,
        MongoProductUnitRepository,
        MongoStockBalanceRepository,
        MongoStockMovementRepository,
        MongoStockTransferRepository,
    )
    from vaybooks.bms.infrastructure.repositories.inventory.mongo_product_rate_history_repository import (
        MongoProductRateHistoryRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    category_repo = MongoProductCategoryRepository(db)
    product_repo = MongoInventoryProductRepository(db)
    movement_repo = MongoStockMovementRepository(db)
    unit_repo = MongoProductUnitRepository(db)
    field_repo = MongoProductFieldDefinitionRepository(db)
    location_repo = MongoLocationRepository(db)
    balance_repo = MongoStockBalanceRepository(db)
    transfer_repo = MongoStockTransferRepository(db)
    rate_history = ProductRateHistoryService(
        MongoProductRateHistoryRepository(db, "product_selling_rate_history"),
        MongoProductRateHistoryRepository(db, "product_mrp_history"),
        MongoProductRateHistoryRepository(db, "product_gst_rate_history"),
    )

    inventory = InventoryAppService(
        category_repo,
        product_repo,
        movement_repo,
        unit_repo=unit_repo,
        field_def_repo=field_repo,
        rate_history=rate_history,
        warehouse_repo=location_repo,
        location_repo=location_repo,
        balance_repo=balance_repo,
        transfer_repo=transfer_repo,
    )
    return InventoryContainer(
        backend="mongo",
        inventory=inventory,
        location_repo=location_repo,
        product_repo=product_repo,
    )


def build_inventory_container() -> InventoryContainer:
    if (os.environ.get("INVENTORY_BACKEND") or "").strip().lower() == "memory":
        logger.info("Inventory container forced to in-memory backend")
        return _build_memory()
    uri = _mongo_uri()
    if uri:
        try:
            container = _build_mongo(uri)
            logger.info("Inventory container using Mongo backend db=%s", _db_name())
            return container
        except Exception as exc:
            logger.warning("Mongo inventory backend unavailable (%s); using memory", exc)
    logger.info("Inventory container using in-memory backend")
    return _build_memory()


def get_inventory_container() -> InventoryContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_inventory_container()
    return _CONTAINER


def set_inventory_container(container: InventoryContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_inventory_container() -> InventoryContainer:
    set_inventory_container(None)
    return get_inventory_container()
