"""Inventory API — domain CRUD + reserve/lock consumer for sales stock side-effects."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from packages.messaging.bus import get_bus
from packages.messaging.locking import ReserveLockService
from packages.services_kit.inventory_container import get_inventory_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.enums import StockMovementType, StockTransferStatus
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/inventory", tags=["inventory"])
_locks = ReserveLockService()
_CONSUMER_HEALTHY = True

# In-memory customer price store (sales SOR later; keeps UI working)
_CUSTOMER_PRICES: list[dict[str, Any]] = []


class ReserveRequest(BaseModel):
    key: str = Field(min_length=1)
    qty: float = 1.0


class CategoryWrite(BaseModel):
    name: str = Field(min_length=1)
    parent_id: Optional[str] = None
    description: str = ""
    is_active: bool = True


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


@router.post("/categories", status_code=201)
def create_category(body: CategoryWrite) -> dict[str, Any]:
    try:
        cat = _svc().create_category(
            body.name,
            parent_id=body.parent_id or None,
            description=body.description,
        )
        if not body.is_active:
            cat = _svc().update_category(cat.id, body.name, parent_id=body.parent_id, description=body.description, is_active=False)
    except Exception as exc:
        raise _http_err(exc) from exc
    data = entity_dict(cat)
    data["path"] = _svc().get_category_path(cat.id)
    return data


@router.get("/categories/{category_id}")
def get_category(category_id: str) -> dict[str, Any]:
    cat = _svc().get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="category not found")
    data = entity_dict(cat)
    data["path"] = _svc().get_category_path(cat.id)
    return data


@router.put("/categories/{category_id}")
def update_category(category_id: str, body: CategoryWrite) -> dict[str, Any]:
    try:
        cat = _svc().update_category(
            category_id,
            body.name,
            parent_id=body.parent_id,
            description=body.description,
            is_active=body.is_active,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    data = entity_dict(cat)
    data["path"] = _svc().get_category_path(cat.id)
    return data


# --- Products ------------------------------------------------------------------


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
    except ValueError:
        loc_type = LocationType.WAREHOUSE
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


# --- Customer prices (local stub until sales SOR) ------------------------------


@router.get("/customer-prices")
def list_customer_prices() -> list[dict[str, Any]]:
    # Prefer latest per customer×product
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for row in sorted(_CUSTOMER_PRICES, key=lambda r: r.get("effective_date") or ""):
        latest[(row["customer_id"], row["product_id"])] = row
    return list(latest.values())


@router.post("/customer-prices", status_code=201)
def create_customer_price(body: CustomerPriceWrite) -> dict[str, Any]:
    product = _svc().get_product(body.product_id)
    row = {
        "id": uuid4().hex,
        "customer_id": body.customer_id,
        "customer_name": body.customer_name,
        "product_id": body.product_id,
        "sku": body.sku or (getattr(product, "sku", "") if product else ""),
        "product_name": body.product_name or (getattr(product, "name", "") if product else ""),
        "customer_rate": float(body.rate),
        "selling_rate": float(getattr(product, "selling_rate", 0) or 0) if product else 0.0,
        "effective_date": (_parse_date(body.effective_date)).isoformat(),
        "created_at": datetime.utcnow().isoformat(),
    }
    row["difference"] = round(row["customer_rate"] - row["selling_rate"], 2)
    _CUSTOMER_PRICES.append(row)
    return row


@router.get("/customer-prices/history")
def customer_price_history(
    customer_id: str = Query(...),
    product_id: str = Query(...),
) -> list[dict[str, Any]]:
    return [
        r
        for r in _CUSTOMER_PRICES
        if r["customer_id"] == customer_id and r["product_id"] == product_id
    ]


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
        rows = list_customer_prices()
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
