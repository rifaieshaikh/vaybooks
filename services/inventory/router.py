"""Inventory API — domain CRUD + reserve/lock consumer for sales stock side-effects."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from packages.messaging.bus import get_bus
from packages.messaging.locking import ReserveLockService
from packages.services_kit.inventory_container import get_inventory_container
from packages.services_kit.sales_container import get_sales_container
from services.auth.router import _decode_token
from services.common.authz import assert_permissions, require_permission
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.enums import StockMovementType, StockTransferStatus
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/inventory", tags=["inventory"])
_locks = ReserveLockService()
_CONSUMER_HEALTHY = True


class ReserveRequest(BaseModel):
    key: str = Field(min_length=1)
    qty: float = 1.0


class CategoryWrite(BaseModel):
    name: str = Field(min_length=1)
    parent_id: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryProductsAdd(BaseModel):
    product_ids: List[str] = Field(default_factory=list)


class ProductWrite(BaseModel):
    sku: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category_ids: List[str] = Field(default_factory=list)
    unit_id: str = ""
    unit_code: str = "pcs"
    hsn_sac: str = ""
    selling_rate: float = 0.0
    mrp: float = 0.0
    gst_rate: float = 0.0
    gst_required: bool = False
    opening_qty: float = 0.0
    last_purchase_rate: float = 0.0
    track_batch: bool = False
    track_serial: bool = False
    is_active: bool = True
    location_id: str = ""
    specifications: dict[str, str] = Field(default_factory=dict)
    custom_fields: dict[str, Any] = Field(default_factory=dict)


class MovementWrite(BaseModel):
    product_id: str
    movement_type: str = "Receive"
    qty: float = Field(gt=0)
    movement_date: Optional[str] = None
    notes: str = ""
    location_id: Optional[str] = None


class TransferLineWrite(BaseModel):
    product_id: str
    qty: float = Field(gt=0)


class TransferWrite(BaseModel):
    from_location_id: str
    to_location_id: str
    transfer_date: Optional[str] = None
    lines: List[TransferLineWrite] = Field(min_length=1)
    notes: str = ""
    send_in_transit: bool = False
    transfer_number: str = ""


class CustomerPriceWrite(BaseModel):
    customer_id: str
    customer_name: str = ""
    product_id: str
    sku: str = ""
    product_name: str = ""
    rate: float = 0.0
    effective_date: Optional[str] = None


class ReportRunBody(BaseModel):
    report_type: str
    filters: dict[str, Any] = Field(default_factory=dict)


def _svc():
    return get_inventory_container().inventory


def _sales():
    return get_sales_container().sales


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    name = type(exc).__name__
    if "Validation" in name or "Duplicate" in name:
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


def _parse_date(raw: Optional[str]) -> date:
    if not raw:
        return date.today()
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return date.today()


def _parse_optional_date(raw: Optional[str]) -> Optional[date]:
    if not raw or not str(raw).strip():
        return None
    try:
        return date.fromisoformat(str(raw).strip()[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {raw}") from None


def _parse_grain(raw: Optional[str]) -> str:
    grain = (raw or "month").strip().lower()
    if grain not in {"day", "week", "month"}:
        raise HTTPException(status_code=400, detail="grain must be day, week, or month")
    return grain


def _movement_type(raw: str) -> StockMovementType:
    text = (raw or "Receive").strip()
    for m in StockMovementType:
        if m.value.lower() == text.lower() or m.name.lower() == text.lower():
            return m
    return StockMovementType.RECEIVE


def _product_dict(product: Any) -> dict[str, Any]:
    data = entity_dict(product)
    data["selling_rate"] = float(getattr(product, "selling_rate", 0) or data.get("active_selling_rate") or 0)
    data["mrp"] = float(getattr(product, "active_mrp", 0) or 0)
    data["gst_rate"] = float(getattr(product, "active_gst_rate", 0) or 0)
    qty = float(getattr(product, "current_qty", 0) or 0)
    data["current_qty"] = qty
    if qty <= 0:
        data["stock_status"] = "Out"
    elif qty < 5:
        data["stock_status"] = "Low"
    else:
        data["stock_status"] = "In"
    return data


# --- Health / reserves (unchanged contract) ------------------------------------


@router.get("/health")
def health() -> dict[str, object]:
    try:
        backend = get_inventory_container().backend
    except Exception:
        backend = "unknown"
    return {
        "module": "inventory",
        "status": "ok",
        "consumer_healthy": _CONSUMER_HEALTHY,
        "backend": backend,
    }


@router.post("/reserves")
def request_reserve(body: ReserveRequest) -> dict[str, object]:
    record = _locks.request_reserve(f"stock:{body.key}")
    get_bus().publish(
        "StockReserveRequested",
        {"key": body.key, "qty": body.qty, "state": record.state.value},
    )
    return {"key": body.key, "state": record.state.value}


@router.post("/reserves/{key}/confirm")
def confirm_reserve(key: str) -> dict[str, object]:
    record = _locks.confirm(f"stock:{key}")
    get_bus().publish("StockReserveConfirmed", {"key": key, "state": record.state.value})
    return {"key": key, "state": record.state.value}


@router.post("/reserves/{key}/fail")
def fail_reserve(key: str, reason: str = "failed") -> dict[str, object]:
    record = _locks.fail(f"stock:{key}", reason=reason)
    get_bus().publish(
        "StockReserveFailed",
        {"key": key, "state": record.state.value, "reason": reason},
    )
    return {"key": key, "state": record.state.value, "reason": reason}


@router.get("/reserves/{key}")
def get_reserve(key: str) -> dict[str, object]:
    record = _locks.get(f"stock:{key}")
    if not record:
        raise HTTPException(status_code=404, detail="reserve not found")
    return {"key": key, "state": record.state.value, "reason": record.reason}


def is_consumer_healthy() -> bool:
    return _CONSUMER_HEALTHY


# --- Overview ------------------------------------------------------------------


@router.get("/overview")
def overview() -> dict[str, Any]:
    inv = _svc()
    products = inv.list_products(active_only=False)
    active = [p for p in products if getattr(p, "is_active", True)]
    low = [p for p in active if 0 < float(getattr(p, "current_qty", 0) or 0) < 5]
    out = [p for p in active if float(getattr(p, "current_qty", 0) or 0) <= 0]
    value = sum(
        float(getattr(p, "current_qty", 0) or 0) * float(getattr(p, "weighted_avg_cost", 0) or 0)
        for p in active
    )
    return {
        "kpis": {
            "product_count": len(active),
            "low_stock_count": len(low),
            "out_of_stock_count": len(out),
            "stock_value": round(value, 2),
            "category_count": len(inv.list_categories(active_only=True)),
            "location_count": len(inv.list_locations(active_only=True)),
        },
        "low_stock": [_product_dict(p) for p in low[:24]],
    }


# --- Units / locations ---------------------------------------------------------


@router.get("/units")
def list_units(active_only: bool = Query(default=True)) -> list[dict[str, Any]]:
    return [entity_dict(u) for u in _svc().list_units(active_only=active_only)]


@router.get("/locations")
def list_locations(
    q: str = Query(default=""),
    active_only: bool = Query(default=False),
) -> list[dict[str, Any]]:
    inv = _svc()
    if q.strip():
        rows = inv.search_locations(q, active_only=active_only)
    else:
        rows = inv.list_locations(active_only=active_only)
    return [entity_dict(r) for r in rows]


@router.get("/warehouses")
def list_warehouses(active_only: bool = Query(default=False)) -> list[dict[str, Any]]:
    return list_locations(active_only=active_only)


# --- Categories ----------------------------------------------------------------


@router.get("/categories")
def list_categories(
    q: str = Query(default=""),
    active_only: bool = Query(default=False),
    _: str = Depends(require_permission("inventory.categories.view")),
) -> list[dict[str, Any]]:
    inv = _svc()
    if q.strip():
        rows = inv.search_categories(q, active_only=active_only)
    else:
        rows = inv.list_categories(active_only=active_only)
    out = []
    for r in rows:
        data = entity_dict(r)
        data["path"] = inv.get_category_path(r.id)
        data["product_count"] = inv.count_products_in_category(r.id)
        out.append(data)
    return out


@router.get("/categories/check-name")
def check_category_name(
    name: str = Query(..., min_length=1),
    _: str = Depends(require_permission("inventory.categories.view")),
) -> dict[str, Any]:
    category = _svc().find_category_by_name(name)
    return {"exists": bool(category), **({"id": category.id} if category else {})}


@router.post("/categories", status_code=201)
def create_category(
    body: CategoryWrite,
    username: str = Depends(require_permission("inventory.categories.create")),
) -> dict[str, Any]:
    try:
        is_active = True if body.is_active is None else bool(body.is_active)
        if not is_active:
            assert_permissions(username, ("inventory.categories.deactivate",))
        cat = _svc().create_category(
            body.name,
            parent_id=body.parent_id or None,
            description=body.description or "",
        )
        if not is_active:
            cat = _svc().update_category(
                cat.id,
                cat.name,
                parent_id=body.parent_id,
                description=body.description or "",
                is_active=False,
            )
    except Exception as exc:
        raise _http_err(exc) from exc
    data = entity_dict(cat)
    data["path"] = _svc().get_category_path(cat.id)
    return data


@router.get("/categories/{category_id}")
def get_category(
    category_id: str,
    _: str = Depends(require_permission("inventory.categories.view")),
) -> dict[str, Any]:
    cat = _svc().get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="category not found")
    data = entity_dict(cat)
    data["path"] = _svc().get_category_path(cat.id)
    data["product_count"] = _svc().count_products_in_category(cat.id)
    return data


@router.put("/categories/{category_id}")
def update_category(
    category_id: str,
    body: CategoryWrite,
    username: str = Depends(_decode_token),
) -> dict[str, Any]:
    existing = _svc().get_category(category_id)
    if not existing:
        raise HTTPException(status_code=404, detail="category not found")

    fields_set = body.model_fields_set
    next_active = existing.is_active if body.is_active is None else bool(body.is_active)
    next_description = (
        existing.description if "description" not in fields_set else (body.description or "")
    )
    if "parent_id" in fields_set:
        next_parent = body.parent_id
    else:
        next_parent = existing.parent_id

    wants_status = next_active != bool(existing.is_active)
    wants_fields = (next_description != (existing.description or "")) or (
        (next_parent or None) != (existing.parent_id or None)
    )
    permissions = []
    if wants_fields:
        permissions.append("inventory.categories.edit")
    if wants_status:
        permissions.append("inventory.categories.deactivate")
    if not permissions:
        # No-op save still requires being signed in (already via _decode_token).
        pass
    else:
        assert_permissions(username, permissions)
    try:
        cat = _svc().update_category(
            category_id,
            existing.name,
            parent_id=next_parent,
            description=next_description,
            is_active=next_active,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    data = entity_dict(cat)
    data["path"] = _svc().get_category_path(cat.id)
    return data


@router.get("/categories/{category_id}/products")
def list_category_products(
    category_id: str,
    q: str = Query(default=""),
    _: str = Depends(require_permission("inventory.categories.items.view")),
) -> list[dict[str, Any]]:
    return [_product_dict(product) for product in _svc().list_products_in_category(category_id, q)]


@router.post("/categories/{category_id}/products")
def add_category_products(
    category_id: str,
    body: CategoryProductsAdd,
    _: str = Depends(
        require_permission("inventory.categories.items.add", "inventory.products.edit")
    ),
) -> dict[str, List[str]]:
    try:
        return _svc().add_products_to_category(category_id, body.product_ids)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/categories/{category_id}/sales-breakdown")
def category_sales_breakdown(
    category_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    grain: Optional[str] = Query(default="month"),
    _: str = Depends(require_permission("inventory.categories.sales.view")),
) -> dict[str, Any]:
    return _svc().category_sales_breakdown(
        category_id,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
        grain=_parse_grain(grain),
    )


@router.get("/categories/{category_id}/production-breakdown")
def category_production_breakdown(
    category_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    grain: Optional[str] = Query(default="month"),
    _: str = Depends(require_permission("inventory.categories.production.view")),
) -> dict[str, Any]:
    return _svc().category_production_breakdown(
        category_id,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
        grain=_parse_grain(grain),
    )


@router.get("/categories/{category_id}/customization-breakdown")
def category_customization_breakdown(
    category_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    grain: Optional[str] = Query(default="month"),
    _: str = Depends(require_permission("inventory.categories.customization.view")),
) -> dict[str, Any]:
    return _svc().category_customization_breakdown(
        category_id,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
        grain=_parse_grain(grain),
    )


# --- Catalog products + SKUs ---------------------------------------------------


class CatalogProductWrite(BaseModel):
    name: str = Field(min_length=1)
    category_ids: List[str] = Field(default_factory=list)
    unit_id: str = ""
    unit_code: str = "pcs"
    hsn_sac: str = ""
    specifications: dict[str, str] = Field(default_factory=dict)
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class CatalogMergeWrite(BaseModel):
    target_catalog_product_id: str = Field(min_length=1)
    source_catalog_product_ids: List[str] = Field(default_factory=list)
    force: bool = False


class SkuWrite(BaseModel):
    sku: str = Field(min_length=1)
    name_override: str = ""
    attributes: dict[str, str] = Field(default_factory=dict)
    barcode: str = ""
    selling_rate: float = 0.0
    mrp: float = 0.0
    gst_rate: float = 0.0
    gst_required: bool = False
    opening_qty: float = 0.0
    location_id: str = ""
    track_batch: bool = False
    track_serial: bool = False
    is_active: bool = True
    catalog_product_id: str = ""


def _catalog_dict(product: Any) -> dict[str, Any]:
    return entity_dict(product)


@router.get("/catalog-products")
def list_catalog_products(
    q: str = Query(default=""),
    active_only: bool = Query(default=False),
    _: str = Depends(require_permission("inventory.products.view")),
) -> list[dict[str, Any]]:
    inv = _svc()
    if q.strip():
        rows = inv.search_catalog_products(q)
        if active_only:
            rows = [p for p in rows if getattr(p, "is_active", True)]
    else:
        rows = inv.list_catalog_products(active_only=active_only)
    return [_catalog_dict(p) for p in rows]


@router.post("/catalog-products", status_code=201)
def create_catalog_product(
    body: CatalogProductWrite,
    _: str = Depends(require_permission("inventory.products.create")),
) -> dict[str, Any]:
    try:
        product = _svc().create_catalog_product(
            body.name,
            body.category_ids or [],
            unit_id=body.unit_id,
            unit_code=body.unit_code,
            hsn_sac=body.hsn_sac,
            specifications=body.specifications,
            custom_fields=body.custom_fields,
        )
        if not body.is_active:
            product = _svc().update_catalog_product(product.id, is_active=False)
    except Exception as exc:
        raise _http_err(exc) from exc
    return _catalog_dict(product)


@router.post("/catalog-products/merge")
def merge_catalog_products(
    body: CatalogMergeWrite,
    _: str = Depends(require_permission("inventory.products.edit")),
) -> dict[str, Any]:
    try:
        product = _svc().merge_catalog_products(
            body.target_catalog_product_id,
            body.source_catalog_product_ids,
            force=body.force,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return _catalog_dict(product)


@router.get("/catalog-products/{catalog_product_id}")
def get_catalog_product(
    catalog_product_id: str,
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    product = _svc().get_catalog_product(catalog_product_id)
    if not product:
        # Deep-link compat: if id is a SKU, signal redirect target
        resolved = _svc().resolve_inventory_id(catalog_product_id)
        if resolved.get("is_sku"):
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "not_a_catalog_product",
                    "redirect": f"/inventory/skus/{catalog_product_id}",
                    "sku_id": catalog_product_id,
                    "catalog_product_id": resolved.get("catalog_product_id") or "",
                },
            )
        raise HTTPException(status_code=404, detail="catalog product not found")
    data = _catalog_dict(product)
    skus = _svc().list_skus_for_catalog(catalog_product_id)
    data["skus"] = [_product_dict(s) for s in skus]
    data["sku_count"] = len(skus)
    data["on_hand"] = round(sum(float(s.current_qty or 0) for s in skus), 4)
    return data


@router.put("/catalog-products/{catalog_product_id}")
def update_catalog_product(
    catalog_product_id: str,
    body: CatalogProductWrite,
    _: str = Depends(require_permission("inventory.products.edit")),
) -> dict[str, Any]:
    try:
        product = _svc().update_catalog_product(
            catalog_product_id,
            name=body.name,
            category_ids=body.category_ids or [],
            unit_id=body.unit_id or None,
            hsn_sac=body.hsn_sac,
            specifications=body.specifications,
            custom_fields=body.custom_fields,
            is_active=body.is_active,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return _catalog_dict(product)


@router.get("/catalog-products/{catalog_product_id}/skus")
def list_catalog_skus(
    catalog_product_id: str,
    _: str = Depends(require_permission("inventory.products.view")),
) -> list[dict[str, Any]]:
    return [_product_dict(s) for s in _svc().list_skus_for_catalog(catalog_product_id)]


@router.post("/catalog-products/{catalog_product_id}/skus", status_code=201)
def create_catalog_sku(
    catalog_product_id: str,
    body: SkuWrite,
    _: str = Depends(require_permission("inventory.products.create")),
) -> dict[str, Any]:
    location_id = (body.location_id or "").strip()
    if body.opening_qty > 0 and not location_id:
        locs = _svc().list_locations(active_only=True)
        location_id = locs[0].id if locs else ""
    try:
        product = _svc().create_sku_under_catalog(
            catalog_product_id,
            body.sku,
            name_override=body.name_override,
            attributes=body.attributes,
            barcode=body.barcode,
            opening_qty=body.opening_qty,
            selling_rate=body.selling_rate,
            mrp=body.mrp,
            gst_rate=body.gst_rate,
            gst_required=body.gst_required,
            track_batch=body.track_batch,
            track_serial=body.track_serial,
            location_id=location_id,
        )
        if not body.is_active:
            product = _svc().discontinue_product(product.id)
    except Exception as exc:
        raise _http_err(exc) from exc
    return _product_dict(product)


@router.get("/catalog-products/{catalog_product_id}/sales-breakdown")
def catalog_sales_breakdown(
    catalog_product_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    grain: Optional[str] = Query(default="month"),
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    return _svc().catalog_product_sales_breakdown(
        catalog_product_id,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
        grain=_parse_grain(grain),
    )


@router.get("/catalog-products/{catalog_product_id}/spec-insights")
def catalog_spec_insights(
    catalog_product_id: str,
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    return _svc().catalog_product_spec_insights(catalog_product_id)


@router.get("/catalog-products/{catalog_product_id}/activity")
def catalog_activity(
    catalog_product_id: str,
    limit: int = Query(default=50),
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    return _svc().catalog_product_activity(catalog_product_id, limit=limit)


@router.get("/skus")
def list_skus(
    q: str = Query(default=""),
    active_only: bool = Query(default=False),
    _: str = Depends(require_permission("inventory.products.view")),
) -> list[dict[str, Any]]:
    # Compat: SKU list is the stockable inventory_products surface
    return list_products(q=q, active_only=active_only)


@router.get("/skus/{sku_id}")
def get_sku(
    sku_id: str,
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    return get_product(sku_id)


@router.put("/skus/{sku_id}")
def update_sku(
    sku_id: str,
    body: ProductWrite,
    _: str = Depends(require_permission("inventory.products.edit")),
) -> dict[str, Any]:
    return update_product(sku_id, body)


@router.get("/skus/{sku_id}/sales-breakdown")
def sku_sales_breakdown(
    sku_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    grain: Optional[str] = Query(default="month"),
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    return _svc().sku_sales_breakdown(
        sku_id,
        start_date=_parse_optional_date(start_date),
        end_date=_parse_optional_date(end_date),
        grain=_parse_grain(grain),
    )


@router.get("/skus/{sku_id}/activity")
def sku_activity(
    sku_id: str,
    limit: int = Query(default=50),
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    return _svc().sku_activity(sku_id, limit=limit)


@router.get("/resolve/{entity_id}")
def resolve_inventory_entity(
    entity_id: str,
    _: str = Depends(require_permission("inventory.products.view")),
) -> dict[str, Any]:
    resolved = _svc().resolve_inventory_id(entity_id)
    sku = resolved.get("sku")
    catalog = resolved.get("catalog_product")
    return {
        "id": entity_id,
        "is_sku": resolved["is_sku"],
        "is_catalog_product": resolved["is_catalog_product"],
        "catalog_product_id": resolved.get("catalog_product_id") or "",
        "sku": _product_dict(sku) if sku else None,
        "catalog_product": _catalog_dict(catalog) if catalog else None,
    }


# --- Products (compat flat SKU-shaped API) -------------------------------------


@router.get("/products")
def list_products(
    q: str = Query(default=""),
    active_only: bool = Query(default=False),
) -> list[dict[str, Any]]:
    inv = _svc()
    if q.strip():
        rows = inv.search_products(q)
        if active_only:
            rows = [p for p in rows if getattr(p, "is_active", True)]
    else:
        rows = inv.list_products(active_only=active_only)
    return [_product_dict(p) for p in rows]


@router.post("/products", status_code=201)
def create_product(body: ProductWrite) -> dict[str, Any]:
    location_id = (body.location_id or "").strip()
    if body.opening_qty > 0 and not location_id:
        locs = _svc().list_locations(active_only=True)
        location_id = locs[0].id if locs else ""
    try:
        product = _svc().create_product(
            body.sku,
            body.name,
            body.category_ids or [],
            opening_qty=body.opening_qty,
            unit_id=body.unit_id,
            unit_code=body.unit_code,
            pending_unit_code=body.unit_code or None,
            hsn_sac=body.hsn_sac,
            selling_rate=body.selling_rate,
            mrp=body.mrp,
            gst_rate=body.gst_rate,
            gst_required=body.gst_required,
            specifications=body.specifications,
            custom_fields=body.custom_fields,
            last_purchase_rate=body.last_purchase_rate,
            track_batch=body.track_batch,
            track_serial=body.track_serial,
            location_id=location_id,
        )
        if not body.is_active:
            product = _svc().discontinue_product(product.id)
    except Exception as exc:
        raise _http_err(exc) from exc
    return _product_dict(product)


class LocationWrite(BaseModel):
    name: str = Field(min_length=1)
    code: str = Field(min_length=1)
    address: str = ""
    location_type: str = "Warehouse"
    is_active: bool = True


@router.post("/locations", status_code=201)
def create_location(body: LocationWrite) -> dict[str, Any]:
    from vaybooks.bms.domain.shared.enums import LocationType

    try:
        loc_type = LocationType(body.location_type)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="location_type must be 'Warehouse' or 'Retail Store'",
        ) from exc
    try:
        loc = _svc().create_location(
            body.code,
            body.name,
            address=body.address,
            location_type=loc_type,
        )
        if not body.is_active:
            loc = _svc().update_location(
                loc.id, body.code, body.name, address=body.address, is_active=False, location_type=loc_type
            )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(loc)


@router.patch("/locations/{location_id}")
def patch_location(location_id: str, body: LocationWrite) -> dict[str, Any]:
    from vaybooks.bms.domain.shared.enums import LocationType

    try:
        loc_type = LocationType(body.location_type)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="location_type must be 'Warehouse' or 'Retail Store'",
        ) from exc
    try:
        loc = _svc().update_location(
            location_id,
            body.code,
            body.name,
            address=body.address,
            is_active=body.is_active,
            location_type=loc_type,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(loc)


@router.delete("/locations/{location_id}")
def delete_location(location_id: str) -> dict[str, str]:
    try:
        _svc().delete_location(location_id)
    except Exception as exc:
        raise _http_err(exc) from exc
    return {"status": "deleted", "id": location_id}


@router.get("/products/{product_id}")
def get_product(product_id: str) -> dict[str, Any]:
    product = _svc().get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="product not found")
    data = _product_dict(product)
    data["rate_history"] = {
        "selling": [entity_dict(p) for p in _svc().list_selling_rate_history(product_id)],
        "mrp": [entity_dict(p) for p in _svc().list_mrp_history(product_id)],
        "gst": [entity_dict(p) for p in _svc().list_gst_rate_history(product_id)],
    }
    data["balances"] = [entity_dict(b) for b in _svc().list_balances_by_product(product_id)]
    return data


@router.put("/products/{product_id}")
def update_product(product_id: str, body: ProductWrite) -> dict[str, Any]:
    try:
        product = _svc().update_product(
            product_id,
            body.sku,
            body.name,
            body.category_ids or [],
            body.unit_id,
            body.is_active,
            hsn_sac=body.hsn_sac,
            selling_rate=body.selling_rate,
            mrp=body.mrp,
            gst_rate=body.gst_rate,
            gst_required=body.gst_required,
            specifications=body.specifications,
            custom_fields=body.custom_fields,
            pending_unit_code=body.unit_code or None,
            last_purchase_rate=body.last_purchase_rate,
            track_batch=body.track_batch,
            track_serial=body.track_serial,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return _product_dict(product)


# --- Stock / ledger / movements ------------------------------------------------


@router.get("/stock")
def list_stock(active_only: bool = Query(default=True)) -> list[dict[str, Any]]:
    rows = _svc().get_stock_on_hand()
    if active_only:
        rows = [p for p in rows if getattr(p, "is_active", True)]
    return [_product_dict(p) for p in rows]


@router.get("/stock-ledger")
def stock_ledger() -> list[dict[str, Any]]:
    return [entity_dict(r) if not isinstance(r, dict) else r for r in _svc().get_stock_ledger()]


@router.get("/movements")
def list_movements() -> list[dict[str, Any]]:
    return stock_ledger()


@router.post("/movements", status_code=201)
def record_movement(body: MovementWrite) -> dict[str, Any]:
    location_id = (body.location_id or "").strip() or None
    if not location_id:
        locs = _svc().list_locations(active_only=True)
        location_id = locs[0].id if locs else None
    try:
        movement = _svc().record_manual_movement(
            body.product_id,
            _movement_type(body.movement_type),
            body.qty,
            _parse_date(body.movement_date),
            notes=body.notes,
            location_id=location_id,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(movement)


# --- Transfers -----------------------------------------------------------------


@router.get("/transfers")
def list_transfers() -> list[dict[str, Any]]:
    rows = _svc().list_stock_transfers()
    return [entity_dict(r) for r in rows]


@router.post("/transfers", status_code=201)
def create_transfer(body: TransferWrite) -> dict[str, Any]:
    number = (body.transfer_number or "").strip() or f"ST-{uuid4().hex[:8].upper()}"
    try:
        transfer = _svc().create_stock_transfer(
            number,
            body.from_location_id,
            body.to_location_id,
            _parse_date(body.transfer_date),
            [{"product_id": ln.product_id, "qty": ln.qty} for ln in body.lines],
            notes=body.notes,
            send_in_transit=body.send_in_transit,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(transfer)


@router.get("/transfers/{transfer_id}")
def get_transfer(transfer_id: str) -> dict[str, Any]:
    transfer = _svc().get_stock_transfer(transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="transfer not found")
    return entity_dict(transfer)


@router.post("/transfers/{transfer_id}/dispatch")
def dispatch_transfer(transfer_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_svc().dispatch_stock_transfer(transfer_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/transfers/{transfer_id}/receive")
def receive_transfer(transfer_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_svc().receive_stock_transfer(transfer_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/transfers/{transfer_id}/cancel")
def cancel_transfer(transfer_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_svc().cancel_stock_transfer(transfer_id))
    except Exception as exc:
        raise _http_err(exc) from exc


# --- Customer prices (SalesAppService / Mongo) ---------------------------------


def _customer_price_row(entry: Any, *, selling_rate: float = 0.0) -> dict[str, Any]:
    data = entity_dict(entry)
    rate = round(float(getattr(entry, "rate", 0) or data.get("rate") or 0), 2)
    sell = round(float(selling_rate or 0), 2)
    data["customer_rate"] = rate
    data["selling_rate"] = sell
    data["difference"] = round(rate - sell, 2)
    return data


def _latest_customer_price_rows(
    *, customer_id: Optional[str] = None, limit: int = 2000
) -> list[dict[str, Any]]:
    entries = list(_sales().list_customer_prices(limit=limit) or [])
    cid = (customer_id or "").strip()
    if cid:
        entries = [e for e in entries if str(getattr(e, "customer_id", "") or "") == cid]

    # list_customer_prices returns newest-first; keep first (latest) per pair
    latest: dict[tuple[str, str], Any] = {}
    for entry in entries:
        key = (
            str(getattr(entry, "customer_id", "") or ""),
            str(getattr(entry, "product_id", "") or ""),
        )
        if key not in latest:
            latest[key] = entry

    inv = _svc()
    selling_by_product: dict[str, float] = {}
    rows: list[dict[str, Any]] = []
    for entry in latest.values():
        product_id = str(getattr(entry, "product_id", "") or "")
        if product_id and product_id not in selling_by_product:
            product = inv.get_product(product_id)
            selling_by_product[product_id] = (
                float(getattr(product, "selling_rate", 0) or 0) if product else 0.0
            )
        rows.append(
            _customer_price_row(
                entry, selling_rate=selling_by_product.get(product_id, 0.0)
            )
        )
    return rows


@router.get("/customer-prices")
def list_customer_prices(
    customer_id: Optional[str] = Query(default=None),
    _: str = Depends(require_permission("inventory.customer_prices.view")),
) -> list[dict[str, Any]]:
    return _latest_customer_price_rows(customer_id=customer_id)


@router.post("/customer-prices", status_code=201)
def create_customer_price(
    body: CustomerPriceWrite,
    _: str = Depends(require_permission("inventory.customer_prices.edit")),
) -> dict[str, Any]:
    try:
        entry = _sales().create_customer_price(
            customer_id=body.customer_id,
            product_id=body.product_id,
            rate=body.rate,
            effective_date=_parse_date(body.effective_date),
            customer_name=body.customer_name,
            sku=body.sku,
            product_name=body.product_name,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    product = _svc().get_product(body.product_id)
    selling = float(getattr(product, "selling_rate", 0) or 0) if product else 0.0
    return _customer_price_row(entry, selling_rate=selling)


@router.get("/customer-prices/history")
def customer_price_history(
    customer_id: str = Query(...),
    product_id: str = Query(...),
    _: str = Depends(require_permission("inventory.customer_prices.view")),
) -> list[dict[str, Any]]:
    entries = _sales().list_customer_price_history(customer_id, product_id, limit=100)
    product = _svc().get_product(product_id)
    selling = float(getattr(product, "selling_rate", 0) or 0) if product else 0.0
    return [_customer_price_row(e, selling_rate=selling) for e in entries]


# --- Reports -------------------------------------------------------------------

REPORT_TYPES = [
    "Stock on Hand",
    "Stock by Location",
    "Low Stock Alert",
    "Stock Movements",
    "Inventory Valuation",
    "Category Stock Summary",
    "Dead / Slow-Moving Stock",
    "Stock Movement Summary",
    "Cost vs Selling (Stock Margin)",
    "Opening → Closing Stock",
    "HSN Stock Summary",
    "Fast-Moving Stock",
    "Customer Latest Prices",
    "Inactive Products with Stock",
    "Product Rate Card",
]


@router.get("/reports")
def reports_catalog() -> dict[str, Any]:
    return {"report_types": REPORT_TYPES}


@router.post("/reports/run")
def run_report(body: ReportRunBody) -> dict[str, Any]:
    inv = _svc()
    rtype = body.report_type
    rows: list[dict[str, Any]] = []

    if rtype in ("Stock on Hand", "Low Stock Alert", "Inventory Valuation", "Product Rate Card"):
        products = inv.list_products(active_only=rtype != "Inactive Products with Stock")
        for p in products:
            qty = float(getattr(p, "current_qty", 0) or 0)
            if rtype == "Low Stock Alert" and not (0 < qty < 5):
                continue
            if rtype == "Inactive Products with Stock" and (
                getattr(p, "is_active", True) or qty <= 0
            ):
                continue
            cost = float(getattr(p, "weighted_avg_cost", 0) or 0)
            rows.append(
                {
                    "sku": p.sku,
                    "name": p.name,
                    "qty": qty,
                    "selling_rate": float(getattr(p, "selling_rate", 0) or 0),
                    "cost": cost,
                    "value": round(qty * cost, 2),
                    "hsn_sac": getattr(p, "hsn_sac", "") or "",
                }
            )
    elif rtype in ("Stock Movements", "Stock Movement Summary"):
        rows = list(inv.get_stock_ledger())
    elif rtype == "Stock by Location":
        rows = list(inv.on_hand_by_location())
    elif rtype == "Category Stock Summary":
        for cat in inv.list_categories(active_only=False):
            products = [
                p
                for p in inv.list_products(active_only=False)
                if cat.id in (getattr(p, "category_ids", None) or [])
            ]
            qty = sum(float(getattr(p, "current_qty", 0) or 0) for p in products)
            rows.append({"category": cat.name, "product_count": len(products), "qty": qty})
    elif rtype == "Customer Latest Prices":
        rows = _latest_customer_price_rows()
    elif rtype == "HSN Stock Summary":
        buckets: dict[str, dict[str, Any]] = {}
        for p in inv.list_products(active_only=False):
            hsn = (getattr(p, "hsn_sac", "") or "—").strip() or "—"
            b = buckets.setdefault(hsn, {"hsn_sac": hsn, "qty": 0.0, "products": 0})
            b["qty"] += float(getattr(p, "current_qty", 0) or 0)
            b["products"] += 1
        rows = list(buckets.values())
    else:
        # Dead/slow, fast-moving, opening→closing, cost vs selling — approximate from stock
        for p in inv.list_products(active_only=True):
            qty = float(getattr(p, "current_qty", 0) or 0)
            sell = float(getattr(p, "selling_rate", 0) or 0)
            cost = float(getattr(p, "weighted_avg_cost", 0) or 0)
            rows.append(
                {
                    "sku": p.sku,
                    "name": p.name,
                    "qty": qty,
                    "selling_rate": sell,
                    "cost": cost,
                    "margin": round(sell - cost, 2),
                }
            )

    return {"report_type": rtype, "row_count": len(rows), "rows": rows}
