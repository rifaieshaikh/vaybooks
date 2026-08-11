from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from vaybooks.bms.domain.inventory.category_tree import build_category_path
from vaybooks.bms.domain.inventory.entities import (
    CatalogProduct,
    InventoryProduct,
    Location,
    ProductCategory,
    ProductUnit,
    StockBalance,
    StockMovement,
    StockTransfer,
    Warehouse,
)
from vaybooks.bms.domain.inventory.field_definitions import ProductFieldDefinition, ProductFieldType
from vaybooks.bms.domain.inventory.rate_history import ProductRatePeriod
from vaybooks.bms.domain.inventory.rate_history_service import ProductRateHistoryService
from vaybooks.bms.domain.inventory.repository import (
    CatalogProductRepository,
    InventoryProductRepository,
    LocationRepository,
    ProductCategoryRepository,
    ProductFieldDefinitionRepository,
    ProductUnitRepository,
    StockBalanceRepository,
    StockMovementRepository,
    StockTransferRepository,
    WarehouseRepository,
)
from vaybooks.bms.domain.inventory.services import InventoryDomainService
from vaybooks.bms.domain.shared.enums import LocationType, StockMovementType


class InventoryAppService:
    def __init__(
        self,
        category_repo: ProductCategoryRepository,
        product_repo: InventoryProductRepository,
        movement_repo: StockMovementRepository,
        unit_repo: Optional[ProductUnitRepository] = None,
        field_def_repo: Optional[ProductFieldDefinitionRepository] = None,
        rate_history: Optional[ProductRateHistoryService] = None,
        warehouse_repo: Optional[WarehouseRepository] = None,
        location_repo: Optional[LocationRepository] = None,
        balance_repo: Optional[StockBalanceRepository] = None,
        transfer_repo: Optional[StockTransferRepository] = None,
        catalog_repo: Optional[CatalogProductRepository] = None,
    ):
        self._rate_history = rate_history
        self._location_repo = location_repo or warehouse_repo
        self._balance_repo = balance_repo
        self._transfer_repo = transfer_repo
        self._catalog_repo = catalog_repo
        self._domain = InventoryDomainService(
            category_repo,
            product_repo,
            movement_repo,
            unit_repo,
            field_def_repo,
            rate_history,
            warehouse_repo=warehouse_repo,
            location_repo=self._location_repo,
            balance_repo=balance_repo,
            transfer_repo=transfer_repo,
            catalog_repo=catalog_repo,
        )
        self._product_repo = product_repo
        self._category_repo = category_repo
        self._unit_repo = unit_repo
        self._field_def_repo = field_def_repo
        self._warehouse_repo = self._location_repo

    def _hydrate_product(self, product: Optional[InventoryProduct]) -> Optional[InventoryProduct]:
        if not product:
            return None
        product = self._domain.resolve_unit_for_product(product)
        if self._rate_history:
            self._rate_history.hydrate_active_values(product.id, product)
        return product

    def list_units(self, active_only: bool = True) -> List[ProductUnit]:
        return self._domain.list_units(active_only=active_only)

    def search_units(
        self, query: str = "", *, active_only: bool = True, limit: int = 10
    ) -> List[ProductUnit]:
        if not self._unit_repo:
            return []
        return self._unit_repo.search(query, active_only=active_only, limit=limit)

    def get_unit(self, unit_id: str) -> Optional[ProductUnit]:
        if not self._unit_repo or not unit_id:
            return None
        return self._unit_repo.find_by_id(unit_id)

    def find_or_create_unit(self, code: str, label: str = "") -> ProductUnit:
        return self._domain.find_or_create_unit(code, label)

    def update_unit(self, unit_id: str, label: str, is_active: bool = True) -> ProductUnit:
        return self._domain.update_unit(unit_id, label, is_active)

    def get_category_path(self, category_id: str) -> str:
        paths = self.category_paths_for([category_id])
        return paths.get(category_id, "")

    def category_paths_for(self, category_ids: List[str]) -> Dict[str, str]:
        ids = [cid for cid in category_ids if cid]
        if not ids:
            return {}
        by_id: Dict[str, ProductCategory] = {
            c.id: c for c in self._category_repo.find_by_ids(ids)
        }
        missing = {
            c.parent_id
            for c in by_id.values()
            if c.parent_id and c.parent_id not in by_id
        }
        while missing:
            parents = self._category_repo.find_by_ids(list(missing))
            missing = set()
            for parent in parents:
                by_id[parent.id] = parent
                if parent.parent_id and parent.parent_id not in by_id:
                    missing.add(parent.parent_id)
        return {cid: build_category_path(cid, by_id) for cid in ids if cid in by_id}

    def list_categories(self, active_only: bool = False) -> List[ProductCategory]:
        return self._category_repo.list_all(active_only=active_only)

    def search_categories(
        self, query: str = "", *, active_only: bool = True, limit: int = 10
    ) -> List[ProductCategory]:
        return self._category_repo.search(query, active_only=active_only, limit=limit)

    def get_category(self, category_id: str) -> Optional[ProductCategory]:
        return self._category_repo.find_by_id(category_id)

    def find_category_by_name(self, name: str) -> Optional[ProductCategory]:
        return self._category_repo.find_by_name((name or "").strip())

    def create_category(
        self,
        name: str,
        description: str = "",
        parent_id: Optional[str] = None,
    ) -> ProductCategory:
        return self._domain.create_category(name, description, parent_id)

    def update_category(
        self,
        category_id: str,
        name: str,
        description: str = "",
        is_active: bool = True,
        parent_id: Optional[str] = None,
    ) -> ProductCategory:
        return self._domain.update_category(
            category_id, name, description, is_active, parent_id
        )

    def delete_category(self, category_id: str) -> None:
        self._domain.delete_category(category_id)

    def list_locations(
        self,
        active_only: bool = False,
        location_type: Optional[LocationType] = None,
    ) -> List[Location]:
        return self._domain.list_locations(
            active_only=active_only, location_type=location_type
        )

    def search_locations(
        self,
        query: str = "",
        *,
        active_only: bool = True,
        limit: int = 10,
        location_type: Optional[LocationType] = None,
    ) -> List[Location]:
        if not self._location_repo:
            return []
        return self._location_repo.search(
            query, active_only=active_only, limit=limit, location_type=location_type
        )

    def get_location(self, location_id: str) -> Optional[Location]:
        return self._domain.get_location(location_id)

    def create_location(
        self,
        code: str,
        name: str,
        address: str = "",
        location_type: LocationType = LocationType.WAREHOUSE,
    ) -> Location:
        return self._domain.create_location(code, name, address, location_type=location_type)

    def update_location(
        self,
        location_id: str,
        code: str,
        name: str,
        address: str = "",
        is_active: bool = True,
        location_type: Optional[LocationType] = None,
    ) -> Location:
        return self._domain.update_location(
            location_id, code, name, address, is_active, location_type=location_type
        )

    def delete_location(self, location_id: str) -> None:
        self._domain.delete_location(location_id)

    # Back-compat warehouse aliases
    def list_warehouses(self, active_only: bool = False) -> List[Warehouse]:
        return self._domain.list_warehouses(active_only=active_only)

    def search_warehouses(
        self, query: str = "", *, active_only: bool = True, limit: int = 10
    ) -> List[Warehouse]:
        if not self._warehouse_repo:
            return []
        return self._warehouse_repo.search(query, active_only=active_only, limit=limit)

    def get_warehouse(self, warehouse_id: str) -> Optional[Warehouse]:
        return self._domain.get_warehouse(warehouse_id)

    def create_warehouse(
        self,
        code: str,
        name: str,
        address: str = "",
    ) -> Warehouse:
        return self._domain.create_warehouse(code, name, address)

    def update_warehouse(
        self,
        warehouse_id: str,
        code: str,
        name: str,
        address: str = "",
        is_active: bool = True,
    ) -> Warehouse:
        return self._domain.update_warehouse(
            warehouse_id, code, name, address, is_active
        )

    def delete_warehouse(self, warehouse_id: str) -> None:
        self._domain.delete_warehouse(warehouse_id)

    def count_products_in_category(self, category_id: str) -> int:
        return self._product_repo.count_by_category(category_id)

    def list_products_in_category(
        self, category_id: str, q: str = ""
    ) -> List[InventoryProduct]:
        products = self._product_repo.list_by_category(category_id)
        needle = (q or "").strip().lower()
        if needle:
            products = [
                product
                for product in products
                if needle in (product.name or "").lower()
                or needle in (product.sku or "").lower()
            ]
        return [self._hydrate_product(product) for product in products if product]

    def add_products_to_category(
        self, category_id: str, product_ids: List[str]
    ) -> Dict[str, List[str]]:
        if not self.get_category(category_id):
            raise ValueError("Category not found")

        result: Dict[str, List[str]] = {
            "added": [],
            "already_present": [],
            "missing": [],
        }
        seen: set[str] = set()
        for product_id in product_ids:
            product_id = (product_id or "").strip()
            if not product_id or product_id in seen:
                continue
            seen.add(product_id)
            # Prefer catalog parent when id is a catalog product or SKU with parent
            catalog = self.get_catalog_product(product_id)
            sku = None if catalog else self._product_repo.find_by_id(product_id)
            if sku and sku.catalog_product_id:
                catalog = self.get_catalog_product(sku.catalog_product_id)
            if catalog:
                if category_id in (catalog.category_ids or []):
                    result["already_present"].append(product_id)
                    continue
                catalog.category_ids = list(catalog.category_ids or []) + [category_id]
                paths = self.category_paths_for(catalog.category_ids)
                catalog.category_names = [paths.get(cid, "") for cid in catalog.category_ids]
                catalog.sync_legacy_category_fields()
                if self._catalog_repo:
                    self._catalog_repo.save(catalog)
                for child in self._product_repo.list_by_catalog_product(catalog.id):
                    child.category_ids = list(catalog.category_ids)
                    child.category_names = list(catalog.category_names)
                    child.sync_legacy_category_fields()
                    self._product_repo.save(child)
                result["added"].append(product_id)
                continue
            if not sku:
                result["missing"].append(product_id)
                continue
            if category_id in (sku.category_ids or []):
                result["already_present"].append(product_id)
                continue
            sku.category_ids = list(sku.category_ids or []) + [category_id]
            paths = self.category_paths_for(sku.category_ids)
            sku.category_names = [paths.get(cid, "") for cid in sku.category_ids]
            sku.sync_legacy_category_fields()
            self._product_repo.save(sku)
            result["added"].append(product_id)
        return result

    @staticmethod
    def _as_date(value: Any) -> Optional[date]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        text = str(value).strip()
        if not text:
            return None
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None

    @staticmethod
    def _date_in_range(
        value: Optional[date],
        start_date: Optional[date],
        end_date: Optional[date],
    ) -> bool:
        if start_date is None and end_date is None:
            return True
        if value is None:
            return False
        if start_date is not None and value < start_date:
            return False
        if end_date is not None and value > end_date:
            return False
        return True

    @staticmethod
    def _period_key(value: date, grain: str) -> str:
        normalized = (grain or "month").strip().lower()
        if normalized == "day":
            return value.isoformat()
        if normalized == "week":
            iso = value.isocalendar()
            return f"{iso.year}-W{iso.week:02d}"
        return f"{value.year:04d}-{value.month:02d}"

    def _category_product_breakdown_rows(self, category_id: str) -> List[dict[str, Any]]:
        """Seed one row per SKU in the category (via parent catalog membership)."""
        skus: List[InventoryProduct] = []
        seen: set[str] = set()
        if self._catalog_repo:
            for catalog in self._catalog_repo.list_by_category(category_id):
                for sku in self._product_repo.list_by_catalog_product(catalog.id):
                    if sku.id in seen:
                        continue
                    seen.add(sku.id)
                    skus.append(sku)
        for sku in self.list_products_in_category(category_id):
            if sku.id in seen:
                continue
            seen.add(sku.id)
            skus.append(sku)
        rows: List[dict[str, Any]] = []
        for product in skus:
            parent_name = ""
            if self._catalog_repo and product.catalog_product_id:
                parent = self._catalog_repo.find_by_id(product.catalog_product_id)
                parent_name = parent.name if parent else ""
            rows.append(
                {
                    "product_id": product.id,
                    "sku_id": product.id,
                    "catalog_product_id": product.catalog_product_id or "",
                    "product_name": product.display_name(parent_name) or product.name,
                    "sku": product.sku,
                    "qty": 0.0,
                    "amount": 0.0,
                }
            )
        return rows

    def category_sales_breakdown(
        self,
        category_id: str,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        grain: str = "month",
    ) -> dict[str, Any]:
        rows = self._category_product_breakdown_rows(category_id)
        by_product = {row["product_id"]: row for row in rows}
        trend_map: dict[str, dict[str, Any]] = {}
        if by_product:
            try:
                from packages.services_kit.sales_container import get_sales_container
                from vaybooks.bms.domain.sales.line_items import parse_sales_line_items_note
                from vaybooks.bms.domain.shared.enums import VoucherType

                accounting = get_sales_container().sales._accounting
                for voucher in accounting.list_vouchers_by_type(VoucherType.SALES_INVOICE):
                    voucher_day = self._as_date(getattr(voucher, "voucher_date", None))
                    if not self._date_in_range(voucher_day, start_date, end_date):
                        continue
                    items, _, _ = parse_sales_line_items_note(
                        getattr(voucher, "description", "") or ""
                    )
                    period = self._period_key(voucher_day or date.today(), grain)
                    for item in items:
                        row = by_product.get(str(item.get("product_id") or "").strip())
                        if not row:
                            continue
                        qty = float(item.get("qty") or 0)
                        amount = float(
                            item.get("line_total")
                            or item.get("taxable_amount")
                            or qty * float(item.get("rate") or 0)
                        )
                        row["qty"] += qty
                        row["amount"] += amount
                        bucket = trend_map.setdefault(
                            period, {"period": period, "qty": 0.0, "amount": 0.0}
                        )
                        bucket["qty"] += qty
                        bucket["amount"] += amount
            except Exception:
                pass
        for row in rows:
            row["qty"] = round(row["qty"], 4)
            row["amount"] = round(row["amount"], 2)
        trend = sorted(trend_map.values(), key=lambda item: item["period"])
        for bucket in trend:
            bucket["qty"] = round(bucket["qty"], 4)
            bucket["amount"] = round(bucket["amount"], 2)
        return {
            "rows": rows,
            "trend": trend,
            "totals": {
                "qty": round(sum(row["qty"] for row in rows), 4),
                "amount": round(sum(row["amount"] for row in rows), 2),
            },
        }

    def category_production_breakdown(
        self,
        category_id: str,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        grain: str = "month",
    ) -> dict[str, Any]:
        rows = self._category_product_breakdown_rows(category_id)
        by_product = {row["product_id"]: row for row in rows}
        trend_map: dict[str, dict[str, Any]] = {}
        if by_product:
            try:
                from packages.services_kit.production_container import get_production_container
                from vaybooks.bms.domain.shared.enums import ProductionBatchStatus

                for batch in get_production_container().production.list_batches():
                    if getattr(batch, "status", None) != ProductionBatchStatus.POSTED:
                        continue
                    batch_day = self._as_date(getattr(batch, "batch_date", None))
                    if not self._date_in_range(batch_day, start_date, end_date):
                        continue
                    period = self._period_key(batch_day or date.today(), grain)
                    for output in getattr(batch, "outputs", []) or []:
                        row = by_product.get(str(getattr(output, "product_id", "") or ""))
                        if not row:
                            continue
                        qty = float(getattr(output, "qty", 0) or 0)
                        row["qty"] += qty
                        bucket = trend_map.setdefault(
                            period, {"period": period, "qty": 0.0}
                        )
                        bucket["qty"] += qty
            except Exception:
                pass
        for row in rows:
            row["qty"] = round(row["qty"], 4)
        trend = sorted(trend_map.values(), key=lambda item: item["period"])
        for bucket in trend:
            bucket["qty"] = round(bucket["qty"], 4)
        return {
            "rows": rows,
            "trend": trend,
            "totals": {"qty": round(sum(row["qty"] for row in rows), 4)},
        }

    def category_customization_breakdown(
        self,
        category_id: str,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        grain: str = "month",
    ) -> dict[str, Any]:
        by_status: dict[str, dict[str, Any]] = {}
        trend_map: dict[str, dict[str, Any]] = {}
        try:
            from packages.services_kit.boutique_container import get_boutique_container

            orders = get_boutique_container().orders._order_repo.list_all()
            for order in orders:
                order_day = self._as_date(getattr(order, "order_date", None))
                if not self._date_in_range(order_day, start_date, end_date):
                    continue
                period = self._period_key(order_day or date.today(), grain)
                for item in getattr(order, "customization_items", []) or []:
                    if getattr(item, "category_id", None) != category_id:
                        continue
                    status = getattr(getattr(item, "item_status", None), "value", None) or "Unknown"
                    sell_amount = float(getattr(item, "sell_amount", 0) or 0)
                    row = by_status.setdefault(
                        status, {"status": status, "count": 0, "sell_amount": 0.0}
                    )
                    row["count"] += 1
                    row["sell_amount"] += sell_amount
                    bucket = trend_map.setdefault(
                        period, {"period": period, "count": 0, "sell_amount": 0.0}
                    )
                    bucket["count"] += 1
                    bucket["sell_amount"] += sell_amount
        except Exception:
            pass
        rows = sorted(by_status.values(), key=lambda row: row["status"])
        for row in rows:
            row["sell_amount"] = round(row["sell_amount"], 2)
        trend = sorted(trend_map.values(), key=lambda item: item["period"])
        for bucket in trend:
            bucket["sell_amount"] = round(bucket["sell_amount"], 2)
        return {
            "rows": rows,
            "trend": trend,
            "totals": {
                "count": sum(row["count"] for row in rows),
                "sell_amount": round(sum(row["sell_amount"] for row in rows), 2),
            },
        }

    def list_field_definitions(self, active_only: bool = False) -> List[ProductFieldDefinition]:
        return self._domain.list_field_definitions(active_only=active_only)

    def create_field_definition(
        self,
        key: str,
        label: str,
        field_type: ProductFieldType,
        **kwargs,
    ) -> ProductFieldDefinition:
        return self._domain.create_field_definition(key, label, field_type, **kwargs)

    def update_field_definition(
        self, definition_id: str, **kwargs
    ) -> ProductFieldDefinition:
        return self._domain.update_field_definition(definition_id, **kwargs)

    def delete_field_definition(self, definition_id: str) -> None:
        self._domain.delete_field_definition(definition_id)

    def list_products(self, active_only: bool = False) -> List[InventoryProduct]:
        products = self._product_repo.list_all(active_only=active_only)
        return [self._hydrate_product(p) for p in products if p]

    def search_products(self, query: str) -> List[InventoryProduct]:
        return [
            self._hydrate_product(p)
            for p in self._product_repo.search(query)
            if p
        ]

    def get_product(self, product_id: str) -> Optional[InventoryProduct]:
        return self._hydrate_product(self._product_repo.find_by_id(product_id))

    def find_product_by_sku(self, sku: str) -> Optional[InventoryProduct]:
        return self._hydrate_product(self._product_repo.find_by_sku((sku or "").strip()))

    def set_product_cost_fields(
        self,
        product_id: str,
        *,
        weighted_avg_cost: Optional[float] = None,
        last_purchase_rate: Optional[float] = None,
    ) -> InventoryProduct:
        product = self._product_repo.find_by_id(product_id)
        if not product:
            raise ValueError("Product not found")
        if weighted_avg_cost is not None:
            product.weighted_avg_cost = round(max(float(weighted_avg_cost), 0.0), 2)
        if last_purchase_rate is not None:
            product.last_purchase_rate = round(max(float(last_purchase_rate), 0.0), 2)
        return self._product_repo.save(product)

    def create_product(
        self,
        sku: str,
        name: str,
        category_ids: Union[str, List[str]],
        opening_qty: float = 0.0,
        *,
        unit_id: str = "",
        unit_code: str = "",
        hsn_sac: str = "",
        selling_rate: float = 0.0,
        mrp: float = 0.0,
        gst_rate: float = 0.0,
        gst_required: bool = False,
        specifications: Optional[Dict[str, str]] = None,
        custom_fields: Optional[Dict[str, Any]] = None,
        pending_category_name: Optional[Union[str, List[str]]] = None,
        pending_unit_code: Optional[str] = None,
        last_purchase_rate: float = 0.0,
        track_batch: bool = False,
        track_serial: bool = False,
        location_id: str = "",
    ) -> InventoryProduct:
        ids = [category_ids] if isinstance(category_ids, str) else list(category_ids)
        ids = self._resolve_pending_category(ids, pending_category_name)
        unit_id = self._resolve_pending_unit(unit_id, pending_unit_code)
        product = self._domain.create_product(
            sku,
            name,
            ids,
            unit_id=unit_id,
            opening_qty=opening_qty,
            hsn_sac=hsn_sac,
            selling_rate=selling_rate,
            mrp=mrp,
            gst_rate=gst_rate,
            gst_required=gst_required,
            specifications=specifications,
            custom_fields=custom_fields,
            track_batch=track_batch,
            track_serial=track_serial,
            location_id=location_id,
        )
        if float(last_purchase_rate or 0) > 0:
            product = self.set_product_cost_fields(
                product.id, last_purchase_rate=last_purchase_rate
            )
        return self._hydrate_product(product)

    def update_product(
        self,
        product_id: str,
        sku: str,
        name: str,
        category_ids: Union[str, List[str]],
        unit_id: str,
        is_active: bool = True,
        *,
        hsn_sac: Optional[str] = None,
        selling_rate: Optional[float] = None,
        mrp: Optional[float] = None,
        gst_rate: Optional[float] = None,
        gst_required: bool = False,
        specifications: Optional[Dict[str, str]] = None,
        custom_fields: Optional[Dict[str, Any]] = None,
        pending_category_name: Optional[Union[str, List[str]]] = None,
        pending_unit_code: Optional[str] = None,
        last_purchase_rate: Optional[float] = None,
        track_batch: Optional[bool] = None,
        track_serial: Optional[bool] = None,
    ) -> InventoryProduct:
        ids = [category_ids] if isinstance(category_ids, str) else list(category_ids)
        ids = self._resolve_pending_category(ids, pending_category_name)
        unit_id = self._resolve_pending_unit(unit_id, pending_unit_code)
        product = self._domain.update_product(
            product_id,
            sku,
            name,
            ids,
            unit_id,
            is_active,
            hsn_sac=hsn_sac,
            selling_rate=selling_rate,
            mrp=mrp,
            gst_rate=gst_rate,
            gst_required=gst_required,
            specifications=specifications,
            custom_fields=custom_fields,
            track_batch=track_batch,
            track_serial=track_serial,
        )
        if last_purchase_rate is not None:
            product = self.set_product_cost_fields(
                product.id, last_purchase_rate=last_purchase_rate
            )
        return self._hydrate_product(product)

    def discontinue_product(self, product_id: str) -> InventoryProduct:
        """Deactivate product and clear remaining stock (ADJUST_OUT per location)."""
        return self._hydrate_product(self._domain.discontinue_product(product_id))

    def _resolve_pending_category(
        self,
        category_ids: List[str],
        pending_name: Optional[Union[str, List[str]]] = None,
    ) -> List[str]:
        if isinstance(pending_name, list):
            names = pending_name
        elif pending_name:
            names = [pending_name]
        else:
            names = []
        for raw in names:
            name = (raw or "").strip()
            if not name:
                continue
            created = self.create_category(name, parent_id=None)
            if created.id not in category_ids:
                category_ids = list(category_ids) + [created.id]
        return category_ids

    def _resolve_pending_unit(
        self, unit_id: str, pending_code: Optional[str]
    ) -> str:
        if unit_id:
            return unit_id
        code = (pending_code or "").strip()
        if not code:
            raise ValueError("Unit is required")
        return self.find_or_create_unit(code).id

    def list_selling_rate_history(self, product_id: str) -> List[ProductRatePeriod]:
        if not self._rate_history:
            return []
        return self._rate_history.list_selling_rates(product_id)

    def list_mrp_history(self, product_id: str) -> List[ProductRatePeriod]:
        if not self._rate_history:
            return []
        return self._rate_history.list_mrp(product_id)

    def list_gst_rate_history(self, product_id: str) -> List[ProductRatePeriod]:
        if not self._rate_history:
            return []
        return self._rate_history.list_gst_rates(product_id)

    def add_scheduled_rate_period(
        self,
        rate_type: str,
        product_id: str,
        *,
        value: float,
        start_date: date,
        end_date: Optional[date] = None,
    ) -> ProductRatePeriod:
        if not self._rate_history:
            raise ValueError("Rate history is not configured")
        return self._rate_history.add_scheduled_period(
            rate_type,
            product_id,
            value=value,
            start_date=start_date,
            end_date=end_date,
        )

    def rate_period_status(self, period: ProductRatePeriod, as_of: Optional[date] = None):
        if not self._rate_history:
            from vaybooks.bms.domain.inventory.rate_history import period_status

            return period_status(period, as_of or date.today())
        return self._rate_history.status_for(period, as_of)

    def get_stock_on_hand(self) -> List[InventoryProduct]:
        return self.list_products(active_only=False)

    def record_manual_movement(
        self,
        product_id: str,
        movement_type: StockMovementType,
        qty: float,
        movement_date: date,
        notes: str = "",
        location_id: Optional[str] = None,
    ):
        return self._domain.record_manual_movement(
            product_id, movement_type, qty, movement_date, notes, location_id=location_id
        )

    def get_product_ledger(self, product_id: str) -> List[dict[str, Any]]:
        return self._domain.get_product_ledger(product_id)

    def get_stock_ledger(self) -> List[dict[str, Any]]:
        return self._domain.get_stock_ledger()

    def apply_sales_movements(
        self,
        voucher_id: str,
        line_items: list[dict],
        movement_date: Optional[date] = None,
    ):
        from vaybooks.bms.domain.shared.enums import StockReferenceType

        return self._domain.record_sale_movements(
            voucher_id,
            line_items,
            StockReferenceType.SALES_INVOICE,
            movement_date,
        )

    def apply_delivery_note_issue(
        self, dn_id: str, lines: list[dict], movement_date: Optional[date] = None
    ):
        return self._domain.apply_delivery_note_issue(dn_id, lines, movement_date)

    def apply_sales_return(
        self, return_id: str, lines: list[dict], movement_date: Optional[date] = None
    ):
        return self._domain.apply_sales_return(return_id, lines, movement_date)

    def apply_purchase_receive(
        self,
        lines: list[dict],
        reference_id: str,
        reference_type=None,
        movement_date: Optional[date] = None,
    ):
        from vaybooks.bms.domain.shared.enums import StockReferenceType

        ref_type = reference_type or StockReferenceType.GRN
        return self._domain.apply_purchase_receive(
            lines, reference_id, ref_type, movement_date
        )

    def apply_purchase_return(
        self, return_id: str, lines: list[dict], movement_date: Optional[date] = None
    ):
        return self._domain.apply_purchase_return(return_id, lines, movement_date)

    def apply_landed_cost(self, lines: list[dict]) -> None:
        self._domain.apply_landed_cost(lines)

    def apply_production_issue(
        self,
        batch_id: str,
        lines: list[dict],
        movement_date: Optional[date] = None,
    ):
        return self._domain.apply_production_issue(batch_id, lines, movement_date)

    def apply_production_receive(
        self,
        batch_id: str,
        lines: list[dict],
        movement_date: Optional[date] = None,
    ):
        return self._domain.apply_production_receive(batch_id, lines, movement_date)

    def reverse_movements_by_reference(self, reference_id: str) -> None:
        self._domain.reverse_movements_by_reference(reference_id)

    def get_stock_balance(self, product_id: str, location_id: str) -> float:
        return self._domain.get_stock_balance(product_id, location_id)

    def list_balances_by_product(self, product_id: str) -> List[StockBalance]:
        return self._domain.list_balances_by_product(product_id)

    def list_balances_by_location(self, location_id: str) -> List[StockBalance]:
        return self._domain.list_balances_by_location(location_id)

    def on_hand_by_location(self) -> List[dict[str, Any]]:
        return self._domain.on_hand_by_location()

    def create_stock_transfer(
        self,
        transfer_number: str,
        from_location_id: str,
        to_location_id: str,
        transfer_date: date,
        lines: list[dict],
        notes: str = "",
        *,
        allowed_location_ids: list[str] | None = None,
        send_in_transit: bool = False,
    ) -> StockTransfer:
        return self._domain.create_stock_transfer(
            transfer_number,
            from_location_id,
            to_location_id,
            transfer_date,
            lines,
            notes,
            allowed_location_ids=allowed_location_ids,
            send_in_transit=send_in_transit,
        )

    def dispatch_stock_transfer(
        self,
        transfer_id: str,
        *,
        allowed_location_ids: list[str] | None = None,
    ) -> StockTransfer:
        return self._domain.dispatch_stock_transfer(
            transfer_id, allowed_location_ids=allowed_location_ids
        )

    def receive_stock_transfer(
        self,
        transfer_id: str,
        *,
        allowed_location_ids: list[str] | None = None,
    ) -> StockTransfer:
        return self._domain.receive_stock_transfer(
            transfer_id, allowed_location_ids=allowed_location_ids
        )

    def cancel_stock_transfer(self, transfer_id: str) -> StockTransfer:
        return self._domain.cancel_stock_transfer(transfer_id)

    def list_stock_transfers(
        self, *, location_ids: list[str] | None = None
    ) -> List[StockTransfer]:
        transfers = self._domain.list_stock_transfers()
        if location_ids is None:
            return transfers
        allowed = {str(i).strip() for i in location_ids if str(i).strip()}
        if not allowed:
            return []
        return [
            t
            for t in transfers
            if t.from_location_id in allowed or t.to_location_id in allowed
        ]

    def get_stock_transfer(self, transfer_id: str) -> Optional[StockTransfer]:
        return self._domain.get_stock_transfer(transfer_id)

    # --- Catalog products / SKUs ---

    def list_catalog_products(self, active_only: bool = False) -> List[CatalogProduct]:
        return self._domain.list_catalog_products(active_only=active_only)

    def search_catalog_products(self, query: str) -> List[CatalogProduct]:
        return self._domain.search_catalog_products(query)

    def get_catalog_product(self, catalog_product_id: str) -> Optional[CatalogProduct]:
        return self._domain.get_catalog_product(catalog_product_id)

    def create_catalog_product(self, name: str, category_ids=None, **kwargs) -> CatalogProduct:
        return self._domain.create_catalog_product(name, category_ids, **kwargs)

    def update_catalog_product(self, catalog_product_id: str, **kwargs) -> CatalogProduct:
        return self._domain.update_catalog_product(catalog_product_id, **kwargs)

    def list_skus_for_catalog(self, catalog_product_id: str) -> List[InventoryProduct]:
        return [
            self._hydrate_product(p)
            for p in self._domain.list_skus_for_catalog(catalog_product_id)
            if p
        ]

    def create_sku_under_catalog(self, catalog_product_id: str, sku: str, **kwargs) -> InventoryProduct:
        return self._hydrate_product(
            self._domain.create_sku_under_catalog(catalog_product_id, sku, **kwargs)
        )

    def merge_catalog_products(
        self,
        target_catalog_product_id: str,
        source_catalog_product_ids: List[str],
        *,
        force: bool = False,
    ) -> CatalogProduct:
        return self._domain.merge_catalog_products(
            target_catalog_product_id,
            source_catalog_product_ids,
            force=force,
        )

    def resolve_inventory_id(self, entity_id: str) -> dict[str, Any]:
        """Resolve an id as SKU and/or catalog product (for deep-link redirects)."""
        sku = self.get_product(entity_id)
        catalog = self.get_catalog_product(entity_id)
        return {
            "id": entity_id,
            "is_sku": bool(sku),
            "is_catalog_product": bool(catalog),
            "sku": sku,
            "catalog_product": catalog,
            "catalog_product_id": (sku.catalog_product_id if sku else "")
            or (catalog.id if catalog else ""),
        }

    def _sku_breakdown_seed_rows(self, sku_ids: List[str]) -> List[dict[str, Any]]:
        rows: List[dict[str, Any]] = []
        for sku_id in sku_ids:
            product = self.get_product(sku_id)
            if not product:
                continue
            parent_name = ""
            if product.catalog_product_id:
                parent = self.get_catalog_product(product.catalog_product_id)
                parent_name = parent.name if parent else ""
            rows.append(
                {
                    "product_id": product.id,
                    "sku_id": product.id,
                    "catalog_product_id": product.catalog_product_id or "",
                    "product_name": product.display_name(parent_name) or product.name,
                    "sku": product.sku,
                    "qty": 0.0,
                    "amount": 0.0,
                }
            )
        return rows

    def catalog_product_sales_breakdown(
        self,
        catalog_product_id: str,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        grain: str = "month",
    ) -> dict[str, Any]:
        skus = self.list_skus_for_catalog(catalog_product_id)
        rows = self._sku_breakdown_seed_rows([s.id for s in skus])
        return self._fill_sales_breakdown_rows(
            rows, start_date=start_date, end_date=end_date, grain=grain
        )

    def sku_sales_breakdown(
        self,
        sku_id: str,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        grain: str = "month",
    ) -> dict[str, Any]:
        rows = self._sku_breakdown_seed_rows([sku_id])
        return self._fill_sales_breakdown_rows(
            rows, start_date=start_date, end_date=end_date, grain=grain
        )

    def _fill_sales_breakdown_rows(
        self,
        rows: List[dict[str, Any]],
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        grain: str = "month",
    ) -> dict[str, Any]:
        by_product = {row["product_id"]: row for row in rows}
        trend_map: dict[str, dict[str, Any]] = {}
        if by_product:
            try:
                from packages.services_kit.sales_container import get_sales_container
                from vaybooks.bms.domain.sales.line_items import parse_sales_line_items_note
                from vaybooks.bms.domain.shared.enums import VoucherType

                accounting = get_sales_container().sales._accounting
                for voucher in accounting.list_vouchers_by_type(VoucherType.SALES_INVOICE):
                    voucher_day = self._as_date(getattr(voucher, "voucher_date", None))
                    if not self._date_in_range(voucher_day, start_date, end_date):
                        continue
                    items, _, _ = parse_sales_line_items_note(
                        getattr(voucher, "description", "") or ""
                    )
                    period = self._period_key(voucher_day or date.today(), grain)
                    for item in items:
                        pid = str(
                            item.get("sku_id") or item.get("product_id") or ""
                        ).strip()
                        row = by_product.get(pid)
                        if not row:
                            continue
                        qty = float(item.get("qty") or 0)
                        amount = float(
                            item.get("line_total")
                            or item.get("taxable_amount")
                            or qty * float(item.get("rate") or 0)
                        )
                        row["qty"] += qty
                        row["amount"] += amount
                        bucket = trend_map.setdefault(
                            period, {"period": period, "qty": 0.0, "amount": 0.0}
                        )
                        bucket["qty"] += qty
                        bucket["amount"] += amount
            except Exception:
                pass
        for row in rows:
            row["qty"] = round(row["qty"], 4)
            row["amount"] = round(row["amount"], 2)
        trend = sorted(trend_map.values(), key=lambda item: item["period"])
        for bucket in trend:
            bucket["qty"] = round(bucket["qty"], 4)
            bucket["amount"] = round(bucket["amount"], 2)
        return {
            "rows": rows,
            "trend": trend,
            "totals": {
                "qty": round(sum(row["qty"] for row in rows), 4),
                "amount": round(sum(row["amount"] for row in rows), 2),
            },
        }

    def catalog_product_spec_insights(self, catalog_product_id: str) -> dict[str, Any]:
        catalog = self.get_catalog_product(catalog_product_id)
        if not catalog:
            return {
                "specifications": [],
                "custom_fields": [],
                "attributes": [],
                "totals": {"sku_count": 0, "on_hand": 0.0},
            }
        skus = self.list_skus_for_catalog(catalog_product_id)
        specs = [
            {"key": k, "value": v, "sku_count": len(skus)}
            for k, v in (catalog.specifications or {}).items()
        ]
        customs = [
            {"key": str(k), "value": str(v), "sku_count": len(skus)}
            for k, v in (catalog.custom_fields or {}).items()
        ]
        attributes: List[dict[str, Any]] = []
        on_hand = 0.0
        for sku in skus:
            on_hand += float(sku.current_qty or 0)
            for key, value in (sku.attributes or {}).items():
                attributes.append(
                    {
                        "key": key,
                        "value": value,
                        "sku_id": sku.id,
                        "sku": sku.sku,
                        "on_hand": float(sku.current_qty or 0),
                        "sales_qty": 0.0,
                    }
                )
        return {
            "specifications": specs,
            "custom_fields": customs,
            "attributes": attributes,
            "totals": {
                "sku_count": len(skus),
                "on_hand": round(on_hand, 4),
            },
        }

    def catalog_product_activity(self, catalog_product_id: str, *, limit: int = 50) -> dict[str, Any]:
        skus = self.list_skus_for_catalog(catalog_product_id)
        events: List[dict[str, Any]] = []
        for sku in skus:
            for row in self.get_product_ledger(sku.id)[:20]:
                events.append(
                    {
                        "type": "stock_movement",
                        "sku_id": sku.id,
                        "sku": sku.sku,
                        "date": row.get("movement_date") or row.get("date"),
                        "label": f"{row.get('movement_type') or row.get('type') or ''} {row.get('qty') or ''}".strip(),
                        "ref": row.get("reference_id"),
                    }
                )
        events.sort(key=lambda e: str(e.get("date") or ""), reverse=True)
        return {"events": events[: max(1, min(int(limit or 50), 200))]}

    def sku_activity(self, sku_id: str, *, limit: int = 50) -> dict[str, Any]:
        events: List[dict[str, Any]] = []
        sku = self.get_product(sku_id)
        if not sku:
            return {"events": []}
        for row in self.get_product_ledger(sku_id)[:50]:
            events.append(
                {
                    "type": "stock_movement",
                    "sku_id": sku.id,
                    "sku": sku.sku,
                    "date": row.get("movement_date") or row.get("date"),
                    "label": f"{row.get('movement_type') or row.get('type') or ''} {row.get('qty') or ''}".strip(),
                    "ref": row.get("reference_id"),
                }
            )
        events.sort(key=lambda e: str(e.get("date") or ""), reverse=True)
        return {"events": events[: max(1, min(int(limit or 50), 200))]}

