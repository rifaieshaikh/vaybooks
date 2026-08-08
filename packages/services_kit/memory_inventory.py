"""In-memory inventory repositories for API mode without Mongo.

Implements the repository protocols defined in
``vaybooks.bms.domain.inventory.repository`` using plain in-process dict
stores, following the pattern established by ``memory_parties.py``.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Dict, List, Optional

from vaybooks.bms.domain.inventory.entities import (
    InventoryProduct,
    Location,
    ProductCategory,
    ProductUnit,
    StockBalance,
    StockMovement,
    StockTransfer,
)
from vaybooks.bms.domain.inventory.field_definitions import ProductFieldDefinition
from vaybooks.bms.domain.inventory.rate_history import ProductRatePeriod
from vaybooks.bms.domain.shared.enums import LocationType


class MemoryProductUnitRepository:
    def __init__(self) -> None:
        self._store: Dict[str, ProductUnit] = {}

    def save(self, unit: ProductUnit) -> ProductUnit:
        self._store[unit.id] = deepcopy(unit)
        return deepcopy(unit)

    def find_by_id(self, unit_id: str) -> Optional[ProductUnit]:
        u = self._store.get(unit_id)
        return deepcopy(u) if u else None

    def find_by_code(self, code: str) -> Optional[ProductUnit]:
        code = (code or "").strip().lower()
        if not code:
            return None
        for u in self._store.values():
            if (u.code or "").strip().lower() == code:
                return deepcopy(u)
        return None

    def list_all(self, active_only: bool = True) -> List[ProductUnit]:
        rows = list(self._store.values())
        if active_only:
            rows = [u for u in rows if u.is_active]
        return [deepcopy(u) for u in rows]

    def search(
        self, query: str, *, active_only: bool = True, limit: int = 25
    ) -> List[ProductUnit]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if active_only:
            rows = [u for u in rows if u.is_active]
        if q:
            rows = [
                u
                for u in rows
                if q in (u.code or "").lower() or q in (u.label or "").lower()
            ]
        return [deepcopy(u) for u in rows[:limit]]

    def count_products_using(self, unit_id: str) -> int:
        return 0


class MemoryProductCategoryRepository:
    def __init__(self) -> None:
        self._store: Dict[str, ProductCategory] = {}

    def save(self, category: ProductCategory) -> ProductCategory:
        self._store[category.id] = deepcopy(category)
        return deepcopy(category)

    def find_by_id(self, category_id: str) -> Optional[ProductCategory]:
        c = self._store.get(category_id)
        return deepcopy(c) if c else None

    def find_by_ids(self, category_ids: List[str]) -> List[ProductCategory]:
        wanted = {cid for cid in (category_ids or []) if cid}
        return [deepcopy(c) for c in self._store.values() if c.id in wanted]

    def find_by_name(self, name: str) -> Optional[ProductCategory]:
        needle = (name or "").strip().lower()
        if not needle:
            return None
        for c in self._store.values():
            if (c.name or "").strip().lower() == needle:
                return deepcopy(c)
        return None

    def find_by_parent_and_name(
        self, parent_id: Optional[str], name: str
    ) -> Optional[ProductCategory]:
        needle = (name or "").strip().lower()
        if not needle:
            return None
        for c in self._store.values():
            if c.parent_id == parent_id and (c.name or "").strip().lower() == needle:
                return deepcopy(c)
        return None

    def list_all(self, active_only: bool = True) -> List[ProductCategory]:
        rows = list(self._store.values())
        if active_only:
            rows = [c for c in rows if c.is_active]
        return [deepcopy(c) for c in rows]

    def search(
        self, query: str, *, active_only: bool = True, limit: int = 25
    ) -> List[ProductCategory]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if active_only:
            rows = [c for c in rows if c.is_active]
        if q:
            rows = [c for c in rows if q in (c.name or "").lower()]
        return [deepcopy(c) for c in rows[:limit]]

    def list_children(self, parent_id: Optional[str]) -> List[ProductCategory]:
        return [deepcopy(c) for c in self._store.values() if c.parent_id == parent_id]

    def delete(self, category_id: str) -> None:
        self._store.pop(category_id, None)


class MemoryLocationRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Location] = {}

    def save(self, location: Location) -> Location:
        self._store[location.id] = deepcopy(location)
        return deepcopy(location)

    def find_by_id(self, location_id: str) -> Optional[Location]:
        loc = self._store.get(location_id)
        return deepcopy(loc) if loc else None

    def find_by_code(self, code: str) -> Optional[Location]:
        code = (code or "").strip().lower()
        if not code:
            return None
        for loc in self._store.values():
            if (loc.code or "").strip().lower() == code:
                return deepcopy(loc)
        return None

    def list_all(
        self,
        active_only: bool = True,
        location_type: Optional[LocationType] = None,
    ) -> List[Location]:
        rows = list(self._store.values())
        if active_only:
            rows = [loc for loc in rows if loc.is_active]
        if location_type is not None:
            rows = [loc for loc in rows if loc.location_type == location_type]
        return [deepcopy(loc) for loc in rows]

    def search(
        self,
        query: str,
        *,
        active_only: bool = True,
        limit: int = 25,
        location_type: Optional[LocationType] = None,
    ) -> List[Location]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if active_only:
            rows = [loc for loc in rows if loc.is_active]
        if location_type is not None:
            rows = [loc for loc in rows if loc.location_type == location_type]
        if q:
            rows = [
                loc
                for loc in rows
                if q in (loc.name or "").lower() or q in (loc.code or "").lower()
            ]
        return [deepcopy(loc) for loc in rows[:limit]]

    def delete(self, location_id: str) -> None:
        self._store.pop(location_id, None)


# Back-compat alias during cutover
MemoryWarehouseRepository = MemoryLocationRepository


class MemoryInventoryProductRepository:
    def __init__(self) -> None:
        self._store: Dict[str, InventoryProduct] = {}

    def save(self, product: InventoryProduct) -> InventoryProduct:
        self._store[product.id] = deepcopy(product)
        return deepcopy(product)

    def find_by_id(self, product_id: str) -> Optional[InventoryProduct]:
        p = self._store.get(product_id)
        return deepcopy(p) if p else None

    def find_by_sku(self, sku: str) -> Optional[InventoryProduct]:
        sku = (sku or "").strip().lower()
        if not sku:
            return None
        for p in self._store.values():
            if (p.sku or "").strip().lower() == sku:
                return deepcopy(p)
        return None

    def list_all(self, active_only: bool = True) -> List[InventoryProduct]:
        rows = list(self._store.values())
        if active_only:
            rows = [p for p in rows if p.is_active]
        return [deepcopy(p) for p in rows]

    def list_by_category(self, category_id: str) -> List[InventoryProduct]:
        if not category_id:
            return []
        return [
            deepcopy(p) for p in self._store.values() if category_id in (p.category_ids or [])
        ]

    def count_by_category(self, category_id: str) -> int:
        return len(self.list_by_category(category_id))

    def count_by_unit(self, unit_id: str) -> int:
        if not unit_id:
            return 0
        return sum(1 for p in self._store.values() if p.unit_id == unit_id)

    def search(self, query: str) -> List[InventoryProduct]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if q:
            rows = [
                p
                for p in rows
                if q in (p.name or "").lower()
                or q in (p.sku or "").lower()
                or q in (p.hsn_sac or "").lower()
            ]
        return [deepcopy(p) for p in rows]


class MemoryProductFieldDefinitionRepository:
    def __init__(self) -> None:
        self._store: Dict[str, ProductFieldDefinition] = {}

    def save(self, definition: ProductFieldDefinition) -> ProductFieldDefinition:
        self._store[definition.id] = deepcopy(definition)
        return deepcopy(definition)

    def find_by_id(self, definition_id: str) -> Optional[ProductFieldDefinition]:
        d = self._store.get(definition_id)
        return deepcopy(d) if d else None

    def find_by_key(self, key: str) -> Optional[ProductFieldDefinition]:
        key = (key or "").strip().lower()
        if not key:
            return None
        for d in self._store.values():
            if (d.key or "").strip().lower() == key:
                return deepcopy(d)
        return None

    def list_all(self, active_only: bool = False) -> List[ProductFieldDefinition]:
        rows = list(self._store.values())
        if active_only:
            rows = [d for d in rows if d.is_active]
        return [deepcopy(d) for d in sorted(rows, key=lambda d: d.sort_order)]

    def delete(self, definition_id: str) -> None:
        self._store.pop(definition_id, None)


class MemoryStockMovementRepository:
    def __init__(self) -> None:
        self._store: Dict[str, StockMovement] = {}

    def save(self, movement: StockMovement) -> StockMovement:
        self._store[movement.id] = deepcopy(movement)
        return deepcopy(movement)

    def list_by_product(self, product_id: str) -> List[StockMovement]:
        return [
            deepcopy(m) for m in self._store.values() if m.product_id == product_id
        ]

    def list_all(self) -> List[StockMovement]:
        return [deepcopy(m) for m in self._store.values()]

    def list_by_reference(self, reference_id: str) -> List[StockMovement]:
        if not reference_id:
            return []
        return [
            deepcopy(m) for m in self._store.values() if m.reference_id == reference_id
        ]

    def list_by_location(self, location_id: str) -> List[StockMovement]:
        if not location_id:
            return []
        return [
            deepcopy(m) for m in self._store.values() if m.location_id == location_id
        ]

    def delete(self, movement_id: str) -> None:
        self._store.pop(movement_id, None)


class MemoryStockBalanceRepository:
    def __init__(self) -> None:
        self._store: Dict[str, StockBalance] = {}

    def save(self, balance: StockBalance) -> StockBalance:
        self._store[balance.id] = deepcopy(balance)
        return deepcopy(balance)

    def get(self, product_id: str, location_id: str) -> Optional[StockBalance]:
        if not product_id or not location_id:
            return None
        for b in self._store.values():
            if b.product_id == product_id and b.location_id == location_id:
                return deepcopy(b)
        return None

    def list_by_product(self, product_id: str) -> List[StockBalance]:
        if not product_id:
            return []
        return [deepcopy(b) for b in self._store.values() if b.product_id == product_id]

    def list_by_location(self, location_id: str) -> List[StockBalance]:
        if not location_id:
            return []
        return [
            deepcopy(b) for b in self._store.values() if b.location_id == location_id
        ]

    def list_all(self) -> List[StockBalance]:
        return [deepcopy(b) for b in self._store.values()]

    def delete(self, balance_id: str) -> None:
        self._store.pop(balance_id, None)


class MemoryStockTransferRepository:
    def __init__(self) -> None:
        self._store: Dict[str, StockTransfer] = {}

    def save(self, transfer: StockTransfer) -> StockTransfer:
        self._store[transfer.id] = deepcopy(transfer)
        return deepcopy(transfer)

    def find_by_id(self, transfer_id: str) -> Optional[StockTransfer]:
        t = self._store.get(transfer_id)
        return deepcopy(t) if t else None

    def find_by_number(self, transfer_number: str) -> Optional[StockTransfer]:
        needle = (transfer_number or "").strip().lower()
        if not needle:
            return None
        for t in self._store.values():
            if (t.transfer_number or "").strip().lower() == needle:
                return deepcopy(t)
        return None

    def list_all(self) -> List[StockTransfer]:
        return [deepcopy(t) for t in self._store.values()]

    def delete(self, transfer_id: str) -> None:
        self._store.pop(transfer_id, None)


class MemoryProductRateHistoryRepository:
    def __init__(self) -> None:
        self._store: Dict[str, ProductRatePeriod] = {}

    def save(self, period: ProductRatePeriod) -> ProductRatePeriod:
        self._store[period.id] = deepcopy(period)
        return deepcopy(period)

    def find_by_id(self, period_id: str) -> Optional[ProductRatePeriod]:
        p = self._store.get(period_id)
        return deepcopy(p) if p else None

    def list_for_product(self, product_id: str) -> List[ProductRatePeriod]:
        rows = [deepcopy(p) for p in self._store.values() if p.product_id == product_id]
        rows.sort(key=lambda p: p.start_date, reverse=True)
        return rows

    def delete(self, period_id: str) -> None:
        self._store.pop(period_id, None)


def seed_default_location(repo: MemoryLocationRepository) -> Location:
    """Ensure a "Default" location (code "default") exists and return it."""
    existing = repo.find_by_code("default")
    if existing:
        return existing
    location = Location(
        name="Default",
        code="default",
        location_type=LocationType.WAREHOUSE,
    )
    return repo.save(location)
