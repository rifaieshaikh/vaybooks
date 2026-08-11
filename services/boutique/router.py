"""Boutique API — orders, items, measurements, time, calendar, reports (Mongo)."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from packages.services_kit.boutique_container import get_boutique_container
from packages.services_kit.paging import (
    DEFAULT_PAGE_SIZE,
    clamp_page,
    filter_dicts,
    paged_result,
    sort_dicts,
)
from services.boutique.authz import require_boutique_access
from services.common.authz import require_permission
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.exceptions import DomainError, ValidationError

router = APIRouter(
    prefix="/api/boutique",
    tags=["boutique"],
    dependencies=[Depends(require_boutique_access)],
)

RECENT_ORDER_LIMIT = 5

REPORT_TYPES = [
    "Order Pipeline",
    "Overdue Orders",
    "Bills Pending Invoice",
    "Completed Orders",
    "Time Tracking",
    "Worker Productivity",
]


class DraftOrderWrite(BaseModel):
    customer_id: str = Field(min_length=1)
    notes: str = ""
    expected_delivery_date: Optional[str] = None
    location_id: str = ""
    location_name: str = ""


class OrderPatch(BaseModel):
    notes: Optional[str] = None
    expected_delivery_date: Optional[str] = None


class OrderItemWrite(BaseModel):
    description: str = Field(min_length=1)
    bill_number: str = ""
    category_id: Optional[str] = None
    sku_id: Optional[str] = None
    catalog_product_id: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    customer_specification: str = ""
    measurement_id: Optional[str] = None
    required_activities: dict[str, bool] = Field(default_factory=dict)
    activity_estimated_hours: dict[str, float] = Field(default_factory=dict)
    sell_amount: float = 0


class OrderItemUpdate(BaseModel):
    bill_number: str = ""
    description: str = Field(min_length=1)
    category_id: Optional[str] = None
    sku_id: Optional[str] = None
    catalog_product_id: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    customer_specification: Optional[str] = None
    measurement_id: Optional[str] = None
    required_activities: Optional[dict[str, bool]] = None
    activity_estimated_hours: Optional[dict[str, float]] = None
    sell_amount: Optional[float] = None


class ActivityAction(BaseModel):
    completed_by: str = "api"
    purchase_price: float = 0
    selling_price: float = 0
    vendor_or_worker_name: str = ""
    notes: str = ""
    add_expense: bool = True


class AdvanceWrite(BaseModel):
    amount: float = Field(gt=0)
    receiving_account_id: str = Field(min_length=1)


class CreditAdvanceBody(BaseModel):
    amount: Optional[float] = None


class InvoiceWrite(BaseModel):
    bill_ids: List[str] = Field(min_length=1)
    invoice_amount: float = Field(gt=0)
    invoice_date: Optional[str] = None
    discount_amount: float = 0.0
    gst_rate: float = 5.0
    allow_already_invoiced: bool = False


class DeliveryWrite(BaseModel):
    bill_ids: List[str] = Field(min_length=1)
    delivery_date: Optional[str] = None
    delivery_notes: str = ""
    allow_already_delivered: bool = True


class ExpenseWrite(BaseModel):
    expense_name: str = Field(min_length=1)
    expense_source: str = "Other"
    purchase_price: float = Field(gt=0)
    selling_price: float = Field(gt=0)
    quantity: float = 1.0
    expense_date: Optional[str] = None
    bill_id: Optional[str] = None
    activity_id: Optional[str] = None
    vendor_or_worker_name: str = ""
    notes: str = ""


class OrderReceiptWrite(BaseModel):
    amount: float = Field(gt=0)
    receiving_account_id: str = Field(min_length=1)
    description: str = ""
    voucher_date: Optional[str] = None


class OrderVendorPaymentWrite(BaseModel):
    amount: float = Field(gt=0)
    vendor_account_id: str = Field(min_length=1)
    expense_account_id: str = Field(min_length=1)
    paying_account_id: str = Field(min_length=1)
    description: str = ""
    voucher_date: Optional[str] = None
    service_id: Optional[str] = None


class OrderRefundWrite(BaseModel):
    kind: str = Field(min_length=1)  # advance | payment
    amount: float = Field(gt=0)
    store_account_id: str = Field(min_length=1)
    description: str = ""
    voucher_date: Optional[str] = None


class MeasurementWrite(BaseModel):
    customer_id: str = Field(min_length=1)
    person_type: str = "Men"
    order_id: Optional[str] = None
    wearer_name: str = ""
    wearer_age: str = ""
    wearer_height: str = ""
    wearer_weight: str = ""
    unit: str = "inch"
    fit_preference: str = "Regular"
    notes: str = ""
    print_notes: str = ""
    measured_at: Optional[str] = None
    measured_by: str = ""
    values: List[dict[str, Any]] = Field(default_factory=list)


class MeasurementUpdate(BaseModel):
    values: Optional[List[dict[str, Any]]] = None
    wearer_name: Optional[str] = None
    wearer_age: Optional[str] = None
    wearer_height: Optional[str] = None
    wearer_weight: Optional[str] = None
    unit: Optional[str] = None
    fit_preference: Optional[str] = None
    notes: Optional[str] = None
    print_notes: Optional[str] = None
    measured_at: Optional[str] = None
    measured_by: Optional[str] = None
    order_id: Optional[str] = None
    person_type: Optional[str] = None


class TimeEntryWrite(BaseModel):
    order_id: str = Field(min_length=1)
    bill_id: str = Field(min_length=1)
    activity_id: str = Field(min_length=1)
    work_date: str
    start_time: str = Field(min_length=1)
    end_time: str = Field(min_length=1)
    worker_name: str = ""
    notes: str = ""
    ends_next_day: bool = False
    assignee_worker_id: str = ""
    assignee_name: str = ""


class TimeEntryUpdate(BaseModel):
    work_date: str
    start_time: str = Field(min_length=1)
    end_time: str = Field(min_length=1)
    worker_name: str = ""
    notes: str = ""
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    ends_next_day: bool = False
    assignee_worker_id: Optional[str] = None
    assignee_name: Optional[str] = None


class TimeEntryAssign(BaseModel):
    assignee_worker_id: str = ""
    assignee_name: str = ""


class ReportRunBody(BaseModel):
    report_type: str
    filters: dict[str, Any] = Field(default_factory=dict)


def _c():
    return get_boutique_container()


def _validate_category_id(category_id: Optional[str]) -> Optional[str]:
    """Validate an inventory category when the inventory service supports it."""
    normalized = (category_id or "").strip() or None
    if not normalized:
        return None
    try:
        from packages.services_kit.inventory_container import get_inventory_container

        inventory = get_inventory_container().inventory
    except Exception:
        return normalized
    get_category = getattr(inventory, "get_category", None)
    if callable(get_category) and not get_category(normalized):
        raise ValidationError("Inventory category not found")
    return normalized


def _require_activity_on_order(order_id: str, activity_id: str):
    """Ensure path order_id owns the order_activity_id (prevents cross-order misuse)."""
    order = _c().orders.get_order_detail(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.get_activity_by_id(activity_id):
        raise HTTPException(status_code=404, detail="Activity not found on order")
    return order


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, (ValidationError, DomainError)):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _order_dict(order: Any) -> dict[str, Any]:
    data = entity_dict(order)
    status = data.get("order_status")
    data["order_status"] = status.value if hasattr(status, "value") else str(status or "")
    data["status"] = data["order_status"]
    items = []
    for item in getattr(order, "customization_items", None) or []:
        row = entity_dict(item)
        ist = row.get("item_status")
        row["item_status"] = ist.value if hasattr(ist, "value") else str(ist or "")
        items.append(row)
    data["customization_items"] = items
    activities = []
    for act in getattr(order, "order_activities", None) or []:
        row = entity_dict(act)
        ast = row.get("activity_status") or row.get("status")
        row["activity_status"] = (
            ast.value if hasattr(ast, "value") else str(ast or "")
        )
        row["status"] = row["activity_status"]
        row["id"] = row.get("order_activity_id") or row.get("id")
        activities.append(row)
    data["order_activities"] = activities
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("order_number") or ""),
            str(data.get("customer_name") or ""),
            str(data.get("order_status") or ""),
        ]
        if b
    )
    data["advance_voucher"] = None
    try:
        find_advance = getattr(_c().orders, "find_advance_voucher", None)
        order_id = getattr(order, "id", None)
        if find_advance and order_id:
            voucher = find_advance(order_id)
            if voucher:
                amount = 0.0
                if hasattr(voucher, "cash_movement_amount"):
                    try:
                        amount = float(voucher.cash_movement_amount or 0)
                    except Exception:
                        amount = 0.0
                if amount <= 0 and hasattr(voucher, "total_debit"):
                    try:
                        amount = float(voucher.total_debit or 0)
                    except Exception:
                        amount = 0.0
                if amount <= 0:
                    amount = float(getattr(order, "advance_amount", 0) or 0)
                data["advance_voucher"] = {
                    "id": getattr(voucher, "id", None),
                    "voucher_number": getattr(voucher, "voucher_number", None),
                    "amount": amount,
                }
    except Exception:
        data["advance_voucher"] = None
    return data


def _attachment_meta(attachment: Any) -> dict[str, Any]:
    cat = getattr(attachment, "category", None)
    return {
        "id": getattr(attachment, "id", None),
        "order_id": getattr(attachment, "order_id", None),
        "item_id": getattr(attachment, "item_id", None),
        "category": cat.value if hasattr(cat, "value") else str(cat or ""),
        "name": getattr(attachment, "name", "") or "",
        "content_type": getattr(attachment, "content_type", "") or "",
        "size_bytes": int(getattr(attachment, "size_bytes", 0) or 0),
        "uploaded_by": getattr(attachment, "uploaded_by", "") or "",
        "uploaded_at": getattr(attachment, "uploaded_at", None),
    }


def _business_profile():
    from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
    from pymongo import MongoClient
    from vaybooks.bms.application.settings.business.service import BusinessAppService
    from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
        MongoBusinessProfileRepository,
    )

    client = MongoClient(mongo_uri(), serverSelectionTimeoutMS=5000)
    db = client[mongo_db_name()]
    return BusinessAppService(MongoBusinessProfileRepository(db)).get_profile()


def _item_row(row: dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    status = data.get("item_status")
    data["item_status"] = status.value if hasattr(status, "value") else str(status or "")
    ostatus = data.get("order_status")
    data["order_status"] = ostatus.value if hasattr(ostatus, "value") else str(ostatus or "")
    etd = data.get("expected_delivery_date")
    if hasattr(etd, "isoformat"):
        data["expected_delivery_date"] = etd.isoformat()
    data["id"] = data.get("item_id") or data.get("id")
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("bill_number") or ""),
            str(data.get("description") or ""),
            str(data.get("order_number") or ""),
        ]
        if b
    )
    return data


def _meas_dict(record: Any) -> dict[str, Any]:
    data = entity_dict(record)
    pt = data.get("person_type")
    data["person_type"] = pt.value if hasattr(pt, "value") else str(pt or "")
    fit = data.get("fit_preference")
    data["fit_preference"] = fit.value if hasattr(fit, "value") else str(fit or "")
    values = []
    for row in data.get("values") or []:
        if not isinstance(row, dict):
            continue
        item = dict(row)
        if "key" not in item and item.get("field_key"):
            item["key"] = item["field_key"]
        if "field_key" not in item and item.get("key"):
            item["field_key"] = item["key"]
        values.append(item)
    data["values"] = values
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("measurement_number") or ""),
            str(data.get("wearer_name") or data.get("customer_id") or ""),
            str(data.get("person_type") or ""),
        ]
        if b
    )
    return data


def _ensure_default_activities() -> None:
    """Seed Streamlit DEFAULT_ACTIVITIES when the catalog is empty."""
    existing = _c().activities.list_activities(active_only=False)
    if existing:
        return
    from vaybooks.bms.infrastructure.db.seed import DEFAULT_ACTIVITIES

    for row in DEFAULT_ACTIVITIES:
        try:
            _c().activities.create_activity(
                row["activity_name"],
                row["activity_category"],
                default_hourly_expense=float(row.get("default_hourly_expense") or 0),
            )
        except Exception:
            continue


def _activity_dict(act: Any) -> dict[str, Any]:
    data = entity_dict(act)
    for key in ("activity_type", "activity_category"):
        val = data.get(key)
        data[key] = val.value if hasattr(val, "value") else str(val or "")
    return data


def _time_dict(entry: Any) -> dict[str, Any]:
    data = entity_dict(entry)
    tt = data.get("task_type")
    data["task_type"] = tt.value if hasattr(tt, "value") else str(tt or "")
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("work_date") or ""),
            str(data.get("worker_name") or ""),
            str(data.get("activity_name") or ""),
            str(data.get("order_number") or data.get("order_id") or ""),
        ]
        if b
    )
    return data


def _inv_dict(inv: Any) -> dict[str, Any]:
    data = entity_dict(inv)
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("invoice_number") or ""),
            f"₹{float(data.get('invoice_amount') or data.get('grand_total') or 0):,.2f}",
        ]
        if b
    )
    return data


def _del_dict(delivery: Any) -> dict[str, Any]:
    data = entity_dict(delivery)
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("delivery_date") or ""),
            ", ".join(data.get("bill_ids") or []) or str(data.get("id") or ""),
        ]
        if b
    )
    return data


def _exp_dict(expense: Any) -> dict[str, Any]:
    data = entity_dict(expense)
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("activity_name") or data.get("description") or data.get("expense_name") or ""),
            f"₹{float(data.get('amount') or data.get('selling_price') or 0):,.2f}",
        ]
        if b
    )
    return data


def _accounting():
    acct = getattr(_c().orders, "_accounting_service", None)
    if acct:
        return acct
    from packages.services_kit.finance_container import get_finance_container

    return get_finance_container().accounting


def _voucher_dict(voucher: Any) -> dict[str, Any]:
    data = entity_dict(voucher)
    vtype = data.get("voucher_type")
    data["voucher_type"] = vtype.value if hasattr(vtype, "value") else str(vtype or "")
    data["id"] = data.get("id") or getattr(voucher, "id", None)
    data["is_advance_refund"] = bool(getattr(voucher, "is_advance_refund", False))
    try:
        data["cash_amount"] = float(getattr(voucher, "cash_movement_amount", 0) or 0)
    except Exception:
        data["cash_amount"] = 0.0
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("voucher_number") or ""),
            str(data.get("voucher_type") or ""),
            f"₹{float(data.get('cash_amount') or 0):,.2f}",
        ]
        if b
    )
    return data


@router.get("/health")
def health() -> dict[str, object]:
    container = _c()
    return {
        "module": "boutique",
        "status": "ok",
        "backend": container.backend,
    }


@router.get("/overview")
def overview(
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict[str, Any]:
    try:
        today = date.today()
        end = _parse_date(end_date) or today
        start = _parse_date(start_date) or end.replace(day=1)
        if start > end:
            start, end = end, start
        reports = _c().reports
        summary = reports.dashboard_summary(start, end)
        overdue = reports.overdue_queue(limit=8)
        pending = reports.bills_pending_invoice_queue(limit=8)
        for row in overdue + pending:
            for key, val in list(row.items()):
                if hasattr(val, "isoformat"):
                    row[key] = val.isoformat()

        span_days = (end - start).days + 1
        grain = "day" if span_days <= 45 else "week"
        on_time_rows = reports.delivery_on_time_breakdown(start, end)
        on_time = sum(int(r.get("count") or 0) for r in on_time_rows if r.get("outcome") == "On time")
        late = sum(int(r.get("count") or 0) for r in on_time_rows if r.get("outcome") == "Late")
        delivered = on_time + late
        on_time_pct = round((on_time / delivered) * 100, 1) if delivered else None

        return {
            "period": {
                "start": start.isoformat(),
                "end": end.isoformat(),
                "grain": grain,
            },
            "kpis": {
                **summary,
                "on_time_delivery_pct": on_time_pct,
                "deliveries_in_period": delivered,
            },
            "charts": {
                "invoiced_revenue": reports.invoiced_revenue_series(start, end, grain=grain),
                "hours_logged": reports.hours_logged_series(start, end, grain=grain),
                "status_breakdown": reports.status_breakdown(),
                "delivery_on_time": on_time_rows,
                "top_customers": reports.top_customers_by_revenue(start, end, limit=10),
                "hours_by_worker": reports.hours_by_worker(start, end, limit=10),
            },
            "overdue_orders": overdue,
            "bills_pending_invoice": pending,
            "quick_actions": [
                {"to": "/boutique/orders", "label": "Orders"},
                {"to": "/boutique/items", "label": "Items"},
                {"to": "/boutique/measurements", "label": "Measurements"},
                {"to": "/boutique/time", "label": "Tasks"},
                {"to": "/boutique/time-log", "label": "Time log"},
                {"to": "/boutique/calendar", "label": "Calendar"},
                {"to": "/boutique/reports", "label": "Reports"},
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/customers/{customer_id}/related-summary")
def customer_related_summary(
    customer_id: str,
    _: str = Depends(
        require_permission("parties.customers.view", "boutique.orders.view")
    ),
) -> dict[str, Any]:
    """Customer-scoped boutique order summary and recent orders."""
    try:
        orders_svc = _c().orders
    except Exception:
        return {"available": False}
    if orders_svc is None:
        return {"available": False}

    try:
        summary = dict(orders_svc.get_customer_summary(customer_id) or {})
        recent = [
            _order_dict(o)
            for o in orders_svc.list_recent_by_customer(
                customer_id, RECENT_ORDER_LIMIT
            )
        ]

        outstanding = None
        try:
            from packages.services_kit.finance_container import get_finance_container

            accounting = get_finance_container().accounting
            acct = accounting.get_customer_account(customer_id) if accounting else None
            if acct:
                open_rows = accounting.list_open_customization_invoices_for_customer(
                    acct.id
                )
                outstanding = round(
                    sum(float(r.get("outstanding") or 0) for r in (open_rows or [])),
                    2,
                )
        except Exception:
            outstanding = None

        if outstanding is not None:
            summary["outstanding"] = outstanding

        payload: dict[str, Any] = {
            "available": True,
            "summary": summary,
            "recent": recent,
        }
        if outstanding is not None:
            payload["outstanding"] = outstanding
        return payload
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/activities")
def list_activities(*, active_only: bool = True) -> list[dict[str, Any]]:
    try:
        _ensure_default_activities()
        return [
            _activity_dict(a)
            for a in _c().activities.list_activities(active_only=active_only)
        ]
    except Exception as exc:
        raise _http_err(exc) from exc


class ActivityCreate(BaseModel):
    activity_name: str = Field(min_length=1)
    activity_category: str = "In House Service"
    default_hourly_expense: float = 0.0


@router.post("/activities", status_code=201)
def create_activity(body: ActivityCreate) -> dict[str, Any]:
    try:
        act = _c().activities.create_activity(
            body.activity_name,
            body.activity_category,
            default_hourly_expense=body.default_hourly_expense,
        )
        return _activity_dict(act)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders")
def list_orders(
    *,
    q: str = "",
    order_number: str = "",
    customer_name: str = "",
    status: str = "",
    sort_by: str = "order_date",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        page_n, size = clamp_page(page, page_size)
        orders, total = _c().orders.page_customization_orders(
            q=q or "",
            order_number=order_number or "",
            customer_name=customer_name or "",
            status=status or "",
            sort_by=sort_by or "order_date",
            sort_desc=sort_desc,
            page=page_n,
            page_size=size,
        )
        return {
            "items": [_order_dict(o) for o in orders],
            "total": total,
            "page": page_n,
            "page_size": size,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


def _resolve_location(location_id: str, location_name: str) -> tuple[str, str]:
    lid = (location_id or "").strip()
    lname = (location_name or "").strip()
    if lid:
        return lid, lname
    try:
        from packages.services_kit.inventory_container import get_inventory_container

        inventory = get_inventory_container().inventory
        locations = []
        if hasattr(inventory, "list_locations"):
            locations = inventory.list_locations()
        elif hasattr(inventory, "list_warehouses"):
            locations = inventory.list_warehouses()
        if locations:
            first = locations[0]
            return str(getattr(first, "id", "") or ""), str(
                getattr(first, "name", "") or getattr(first, "location_name", "") or ""
            )
    except Exception:
        pass
    return lid, lname


@router.post("/orders", status_code=201)
def create_draft_order(body: DraftOrderWrite) -> dict[str, Any]:
    try:
        location_id, location_name = _resolve_location(body.location_id, body.location_name)
        order = _c().orders.create_draft_order(
            customer_name="",
            phone_number="",
            notes=body.notes,
            expected_delivery_date=_parse_date(body.expected_delivery_date),
            customer_id=body.customer_id,
            require_name=False,
            require_phone=False,
            location_id=location_id,
            location_name=location_name,
        )
        return _order_dict(order)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}")
def get_order(order_id: str) -> dict[str, Any]:
    order = _c().orders.get_order_detail(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_dict(order)


@router.patch("/orders/{order_id}")
def patch_order(order_id: str, body: OrderPatch) -> dict[str, Any]:
    try:
        order = None
        if body.notes is not None:
            order = _c().orders.update_order_notes(order_id, body.notes)
        if body.expected_delivery_date is not None:
            etd = _parse_date(body.expected_delivery_date)
            if not etd:
                raise HTTPException(status_code=400, detail="expected_delivery_date required")
            order = _c().orders.update_order_etd(order_id, etd)
        if order is None:
            order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return _order_dict(order)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/confirm")
def confirm_order(order_id: str) -> dict[str, Any]:
    try:
        return _order_dict(_c().orders.confirm_order(order_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: str) -> dict[str, Any]:
    try:
        return _order_dict(_c().orders.cancel_order(order_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/complete")
def complete_order(order_id: str) -> dict[str, Any]:
    try:
        return _order_dict(_c().orders.complete_order(order_id))
    except Exception as exc:
        raise _http_err(exc) from exc


def _default_required_activities(explicit: dict[str, bool] | None) -> dict[str, bool]:
    """Mirror Streamlit defaults when the client omits required_activities."""
    _ensure_default_activities()
    if explicit:
        return explicit
    defaults = ("Stitching", "Handwork", "Material Purchase")
    catalog = _c().activities.list_activities(active_only=True)
    required: dict[str, bool] = {}
    for act in catalog:
        required[act.activity_name] = act.activity_name in defaults
    if required and not any(required.values()) and catalog:
        required[catalog[0].activity_name] = True
    return required


@router.post("/orders/{order_id}/items", status_code=201)
def add_order_item(order_id: str, body: OrderItemWrite) -> dict[str, Any]:
    try:
        bill = (body.bill_number or "").strip()
        if not bill and not body.measurement_id:
            bill = f"BILL-{uuid.uuid4().hex[:8].upper()}"
        required = _default_required_activities(body.required_activities or None)
        if not any(required.values()):
            raise ValidationError("Select at least one required activity")
        item = _c().orders.add_item_to_order(
            order_id,
            body.description,
            required,
            bill_number=bill or None,
            expected_delivery_date=_parse_date(body.expected_delivery_date),
            customer_specification=body.customer_specification,
            measurement_id=body.measurement_id,
            sell_amount=float(body.sell_amount or 0),
            activity_estimated_hours=body.activity_estimated_hours or {},
            category_id=_validate_category_id(body.category_id),
            sku_id=(body.sku_id or "").strip() or None,
            catalog_product_id=(body.catalog_product_id or "").strip() or None,
        )
        order = _c().orders.get_order_detail(order_id)
        return {
            "item": entity_dict(item),
            "order": _order_dict(order) if order else None,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/orders/{order_id}/items/{item_id}")
def update_order_item(order_id: str, item_id: str, body: OrderItemUpdate) -> dict[str, Any]:
    try:
        fields_set = body.model_fields_set
        kwargs: dict[str, Any] = {}
        if "measurement_id" in fields_set:
            kwargs["measurement_id"] = body.measurement_id if body.measurement_id is not None else ""
        if "category_id" in fields_set:
            kwargs["category_id"] = _validate_category_id(body.category_id)
        if "sku_id" in fields_set:
            kwargs["sku_id"] = (body.sku_id or "").strip() or None
        if "catalog_product_id" in fields_set:
            kwargs["catalog_product_id"] = (body.catalog_product_id or "").strip() or None
        if "required_activities" in fields_set:
            kwargs["required_activities"] = body.required_activities or {}
        if "activity_estimated_hours" in fields_set:
            kwargs["activity_estimated_hours"] = body.activity_estimated_hours or {}
        # Always persist estimate when the client sends it (including 0).
        if "sell_amount" in fields_set:
            kwargs["sell_amount"] = float(body.sell_amount or 0)
        order = _c().orders.update_customization_item(
            order_id,
            item_id,
            body.bill_number,
            body.description,
            expected_delivery_date=_parse_date(body.expected_delivery_date),
            customer_specification=body.customer_specification,
            **kwargs,
        )
        return _order_dict(order)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/orders/{order_id}/items/{item_id}")
def remove_order_item(order_id: str, item_id: str) -> dict[str, Any]:
    try:
        return _order_dict(_c().orders.remove_customization_item(order_id, item_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/items/{item_id}/attachments")
def list_item_attachments(
    order_id: str,
    item_id: str,
    category: Optional[str] = None,
) -> list[dict[str, Any]]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if not order.get_item_by_id(item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        attachments = _c().attachments
        if not attachments:
            return []
        rows = attachments.list_by_item(item_id, category=category or None)
        return [_attachment_meta(a) for a in rows]
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/items/{item_id}/attachments", status_code=201)
async def upload_item_attachment(
    order_id: str,
    item_id: str,
    category: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if not order.get_item_by_id(item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        attachments = _c().attachments
        if not attachments:
            raise ValidationError("Attachment service is unavailable")
        data = await file.read()
        saved = attachments.upload(
            order_id=order_id,
            item_id=item_id,
            category=category,
            name=file.filename or "upload",
            content_type=file.content_type or "application/octet-stream",
            data=data,
        )
        return _attachment_meta(saved)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/attachments/{attachment_id}")
def download_attachment(
    attachment_id: str,
    _: str = Depends(require_permission("boutique.orders.view")),
):
    try:
        attachments = _c().attachments
        if not attachments:
            raise HTTPException(status_code=404, detail="Attachment not found")
        attachment = attachments.get(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        order_id = getattr(attachment, "order_id", "") or ""
        order = _c().orders.get_order_detail(order_id) if order_id else None
        if not order:
            raise HTTPException(status_code=404, detail="Attachment not found")
        payload = attachment.data or b""
        filename = attachment.name or attachment_id
        return StreamingResponse(
            io.BytesIO(payload),
            media_type=attachment.content_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Content-Length": str(len(payload)),
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: str,
    _: str = Depends(require_permission("boutique.orders.edit")),
) -> dict[str, str]:
    try:
        attachments = _c().attachments
        if not attachments:
            raise HTTPException(status_code=404, detail="Attachment not found")
        attachment = attachments.get(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        order_id = getattr(attachment, "order_id", "") or ""
        order = _c().orders.get_order_detail(order_id) if order_id else None
        if not order:
            raise HTTPException(status_code=404, detail="Attachment not found")
        attachments.delete(attachment_id)
        return {"status": "deleted", "id": attachment_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/items/{item_id}/pdf")
def item_pdf(order_id: str, item_id: str):
    try:
        from packages.services_kit.parties_container import get_parties_container
        from vaybooks.bms.infrastructure.pdf.boutique_pdf import (
            generate_customization_item_pdf,
        )

        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        item = order.get_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        customer = get_parties_container().customers.get_customer_detail(
            getattr(order, "customer_id", "") or ""
        )
        business = _business_profile()
        measurement = None
        mid = getattr(item, "measurement_id", None)
        if mid:
            measurement = _c().measurements.get_record(mid)
        media = []
        if _c().attachments:
            media = _c().attachments.list_by_item(item_id)
        pdf_bytes = generate_customization_item_pdf(
            order, item, customer, business, measurement, media
        )
        filename = f"{getattr(item, 'bill_number', item_id)}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/advance-receipt.pdf")
def advance_receipt_pdf(order_id: str):
    try:
        from packages.services_kit.parties_container import get_parties_container
        from vaybooks.bms.infrastructure.pdf.boutique_pdf import generate_advance_receipt_pdf

        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        voucher = _c().orders.find_advance_voucher(order_id)
        if not voucher:
            raise HTTPException(status_code=404, detail="Advance voucher not found")
        customer = get_parties_container().customers.get_customer_detail(
            getattr(order, "customer_id", "") or ""
        )
        business = _business_profile()
        pdf_bytes = generate_advance_receipt_pdf(voucher, order, customer, business)
        filename = f"{getattr(voucher, 'voucher_number', order_id)}-advance.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/activities/{activity_id}/complete")
def complete_activity(order_id: str, activity_id: str, body: ActivityAction) -> dict[str, Any]:
    try:
        _require_activity_on_order(order_id, activity_id)
        # Always validate time-tracking requirements (Streamlit prepare step).
        _c().orders.prepare_complete_activity(activity_id)
        order = _c().orders.complete_activity(
            activity_id,
            body.completed_by,
            purchase_price=body.purchase_price,
            selling_price=body.selling_price,
            vendor_or_worker_name=body.vendor_or_worker_name,
            notes=body.notes,
            add_expense=body.add_expense,
        )
        return _order_dict(order)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/activities/{activity_id}/skip")
def skip_activity(order_id: str, activity_id: str, body: ActivityAction) -> dict[str, Any]:
    try:
        _require_activity_on_order(order_id, activity_id)
        return _order_dict(_c().orders.skip_activity(activity_id, body.completed_by))
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


class ItemActivityWrite(BaseModel):
    activity_id: str = Field(min_length=1)


@router.post("/orders/{order_id}/items/{item_id}/activities", status_code=201)
def add_item_activity(order_id: str, item_id: str, body: ItemActivityWrite) -> dict[str, Any]:
    try:
        order = _c().orders.add_activity_to_item(order_id, item_id, body.activity_id)
        return _order_dict(order)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/orders/{order_id}/activities/{activity_id}")
def remove_item_activity(order_id: str, activity_id: str) -> dict[str, Any]:
    try:
        _require_activity_on_order(order_id, activity_id)
        return _order_dict(_c().orders.remove_activity_from_item(order_id, activity_id))
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/advances", status_code=201)
def record_advance(order_id: str, body: AdvanceWrite) -> dict[str, Any]:
    try:
        order, voucher = _c().orders.record_cash_order_advance(
            order_id, body.amount, body.receiving_account_id
        )
        return {
            "order": _order_dict(order),
            "voucher": entity_dict(voucher) if voucher else None,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/credit-balance")
def order_credit_balance(order_id: str) -> dict[str, Any]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        accounting = getattr(_c().orders, "_accounting_service", None)
        if not accounting:
            return {"order_id": order_id, "credit_balance": 0.0}
        customer_account = accounting.get_customer_account(order.customer_id)
        if not customer_account:
            return {"order_id": order_id, "credit_balance": 0.0}
        balance = float(accounting.customer_credit_balance(customer_account.id) or 0)
        return {"order_id": order_id, "credit_balance": balance}
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/advances/credit", status_code=201)
def apply_credit_advance(
    order_id: str, body: CreditAdvanceBody = CreditAdvanceBody()
) -> dict[str, Any]:
    try:
        order, voucher = _c().orders.apply_customer_credit_as_order_advance(
            order_id, body.amount
        )
        return {
            "order": _order_dict(order),
            "voucher": entity_dict(voucher) if voucher else None,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/invoices")
def list_order_invoices(order_id: str) -> list[dict[str, Any]]:
    try:
        invoices = _c().invoices._invoice_repo.list_by_order(order_id)  # noqa: SLF001
        return [_inv_dict(i) for i in invoices]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/invoices", status_code=201)
def generate_invoice(order_id: str, body: InvoiceWrite) -> dict[str, Any]:
    try:
        inv = _c().invoices.generate_invoice(
            order_id,
            body.bill_ids,
            body.invoice_amount,
            invoice_date=_parse_date(body.invoice_date),
            discount_amount=body.discount_amount,
            gst_rate=body.gst_rate,
            allow_already_invoiced=body.allow_already_invoiced,
        )
        return _inv_dict(inv)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/invoices/{invoice_id}/pdf")
def order_invoice_pdf(order_id: str, invoice_id: str):
    try:
        from fastapi.responses import Response

        from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
        from packages.services_kit.parties_container import get_parties_container
        from pymongo import MongoClient
        from vaybooks.bms.application.settings.business.service import BusinessAppService
        from vaybooks.bms.infrastructure.pdf.boutique_pdf import generate_customization_invoice_pdf
        from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
            MongoBusinessProfileRepository,
        )

        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        invoices = _c().invoices._invoice_repo.list_by_order(order_id)  # noqa: SLF001
        invoice = next((i for i in invoices if str(getattr(i, "id", "")) == invoice_id), None)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        customer = get_parties_container().customers.get_customer_detail(
            getattr(order, "customer_id", "") or ""
        )
        client = MongoClient(mongo_uri(), serverSelectionTimeoutMS=5000)
        db = client[mongo_db_name()]
        business = BusinessAppService(MongoBusinessProfileRepository(db)).get_profile()
        pdf_bytes = generate_customization_invoice_pdf(invoice, order, customer, business)
        filename = f"{getattr(invoice, 'invoice_number', invoice_id)}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/deliveries")
def list_order_deliveries(order_id: str) -> list[dict[str, Any]]:
    try:
        return [_del_dict(d) for d in _c().deliveries.list_by_order(order_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/deliveries", status_code=201)
def record_delivery(order_id: str, body: DeliveryWrite) -> dict[str, Any]:
    try:
        delivery = _c().deliveries.record_delivery(
            order_id,
            body.bill_ids,
            _parse_date(body.delivery_date) or date.today(),
            delivery_notes=body.delivery_notes,
            allow_already_delivered=body.allow_already_delivered,
        )
        return _del_dict(delivery)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/expenses")
def list_order_expenses(order_id: str) -> list[dict[str, Any]]:
    try:
        return [_exp_dict(e) for e in _c().expenses.get_expenses_by_order(order_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/expenses", status_code=201)
def create_order_expense(order_id: str, body: ExpenseWrite) -> dict[str, Any]:
    try:
        expense = _c().expenses.add_expense(
            order_id=order_id,
            expense_date=_parse_date(body.expense_date) or date.today(),
            expense_name=body.expense_name.strip(),
            expense_source=body.expense_source,
            purchase_price=body.purchase_price,
            selling_price=body.selling_price,
            quantity=body.quantity,
            bill_id=body.bill_id,
            activity_id=body.activity_id,
            vendor_or_worker_name=body.vendor_or_worker_name,
            notes=body.notes,
        )
        return _exp_dict(expense)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/financials")
def order_financials(order_id: str) -> dict[str, Any]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        accounting = _accounting()
        expenses = _c().expenses.get_expenses_by_order(order_id)
        expense_purchase = round(
            sum(
                float(getattr(e, "purchase_price", 0) or 0)
                * float(getattr(e, "quantity", 1) or 1)
                for e in expenses
            ),
            2,
        )
        expense_selling = round(
            sum(
                float(getattr(e, "selling_price", 0) or 0)
                * float(getattr(e, "quantity", 1) or 1)
                for e in expenses
            ),
            2,
        )
        items = getattr(order, "customization_items", None) or []
        estimate = round(sum(float(getattr(i, "sell_amount", 0) or 0) for i in items), 2)
        vouchers = accounting.list_vouchers_by_order(order_id) if accounting else []
        from vaybooks.bms.domain.shared.enums import VoucherType

        def _count(vt: Any) -> int:
            return sum(1 for v in vouchers if getattr(v, "voucher_type", None) == vt)

        unapplied = (
            float(accounting.get_order_unapplied_advance(order_id) or 0) if accounting else 0.0
        )
        refundable_payments = (
            float(accounting.get_order_refundable_customer_payments(order_id) or 0)
            if accounting
            else 0.0
        )
        credit_balance = 0.0
        if accounting:
            customer_account = accounting.get_customer_account(order.customer_id)
            if customer_account:
                credit_balance = float(
                    accounting.customer_credit_balance(customer_account.id) or 0
                )
        return {
            "order_id": order_id,
            "estimate_total": estimate,
            "advance_amount": float(getattr(order, "advance_amount", 0) or 0),
            "unapplied_advance": unapplied,
            "refundable_payments": refundable_payments,
            "credit_balance": credit_balance,
            "expense_count": len(expenses),
            "expense_purchase_total": expense_purchase,
            "expense_selling_total": expense_selling,
            "receipt_count": _count(VoucherType.RECEIPT),
            "vendor_payment_count": _count(VoucherType.VENDOR_PAYMENT),
            "refund_count": _count(VoucherType.REFUND),
            "advance_voucher_count": _count(VoucherType.ADVANCE),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}/vouchers")
def list_order_vouchers(order_id: str, *, kind: Optional[str] = None) -> list[dict[str, Any]]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        accounting = _accounting()
        vouchers = accounting.list_vouchers_by_order(order_id) if accounting else []
        from vaybooks.bms.domain.shared.enums import VoucherType

        kind_key = (kind or "").strip().lower()
        kind_map = {
            "receipt": VoucherType.RECEIPT,
            "receipts": VoucherType.RECEIPT,
            "payment": VoucherType.VENDOR_PAYMENT,
            "payments": VoucherType.VENDOR_PAYMENT,
            "vendor_payment": VoucherType.VENDOR_PAYMENT,
            "vendor_payments": VoucherType.VENDOR_PAYMENT,
            "refund": VoucherType.REFUND,
            "refunds": VoucherType.REFUND,
            "advance": VoucherType.ADVANCE,
            "advances": VoucherType.ADVANCE,
        }
        if kind_key:
            wanted = kind_map.get(kind_key)
            if wanted:
                vouchers = [
                    v for v in vouchers if getattr(v, "voucher_type", None) == wanted
                ]
        return [_voucher_dict(v) for v in vouchers]
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/receipts", status_code=201)
def create_order_receipt(order_id: str, body: OrderReceiptWrite) -> dict[str, Any]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        accounting = _accounting()
        customer_account = accounting.get_customer_account(order.customer_id)
        if not customer_account:
            raise ValidationError("Customer account not found")
        description = (body.description or "").strip() or f"Receipt for {order.order_number}"
        voucher = accounting.create_customer_payment(
            receiving_account_id=body.receiving_account_id,
            customer_account_id=customer_account.id,
            amount=body.amount,
            description=description,
            voucher_date=_parse_date(body.voucher_date),
            reference_order_id=order.id,
            location_id=getattr(order, "location_id", "") or "",
            location_name=getattr(order, "location_name", "") or "",
        )
        return {"voucher": _voucher_dict(voucher)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/vendor-payments", status_code=201)
def create_order_vendor_payment(order_id: str, body: OrderVendorPaymentWrite) -> dict[str, Any]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        accounting = _accounting()
        description = (body.description or "").strip() or f"Vendor payment for {order.order_number}"
        voucher = accounting.create_vendor_payment(
            vendor_account_id=body.vendor_account_id,
            expense_account_id=body.expense_account_id,
            paying_account_id=body.paying_account_id,
            amount=body.amount,
            description=description,
            voucher_date=_parse_date(body.voucher_date),
            service_id=body.service_id,
            reference_order_id=order.id,
            location_id=getattr(order, "location_id", "") or "",
            location_name=getattr(order, "location_name", "") or "",
        )
        return {"voucher": _voucher_dict(voucher)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/refunds", status_code=201)
def create_order_refund(order_id: str, body: OrderRefundWrite) -> dict[str, Any]:
    try:
        order = _c().orders.get_order_detail(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        accounting = _accounting()
        customer_account = accounting.get_customer_account(order.customer_id)
        if not customer_account:
            raise ValidationError("Customer account not found")
        kind = (body.kind or "").strip().lower()
        description = (body.description or "").strip() or f"Refund for {order.order_number}"
        if kind == "advance":
            voucher = accounting.create_advance_refund(
                customer_account_id=customer_account.id,
                store_account_id=body.store_account_id,
                amount=body.amount,
                description=description,
                voucher_date=_parse_date(body.voucher_date),
                reference_order_id=order.id,
            )
        elif kind in ("payment", "receipt"):
            voucher = accounting.create_customer_payment_refund(
                customer_account_id=customer_account.id,
                store_account_id=body.store_account_id,
                amount=body.amount,
                description=description,
                voucher_date=_parse_date(body.voucher_date),
                reference_order_id=order.id,
            )
        else:
            raise ValidationError("Refund kind must be 'advance' or 'payment'")
        return {"voucher": _voucher_dict(voucher)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/items")
def list_items(
    *,
    q: str = "",
    bill_number: str = "",
    description: str = "",
    customer_name: str = "",
    status: str = "",
    sort_by: str = "bill_number",
    sort_desc: bool = False,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        rows = [_item_row(r) for r in _c().orders.search_customization_items(q or "")]
        filtered = filter_dicts(
            rows,
            equals={"item_status": status} if status.strip() else None,
            contains={
                "bill_number": bill_number,
                "description": description,
                "customer_name": customer_name,
            },
        )
        sorted_rows = sort_dicts(filtered, sort_by, sort_desc=sort_desc)
        return paged_result(sorted_rows, page=page, page_size=page_size)
    except Exception as exc:
        raise _http_err(exc) from exc


class ItemCreateCompat(BaseModel):
    """Top-level create for combined smoke / simple clients (maps to order item)."""

    order_id: str = Field(min_length=1)
    name: str = ""
    description: str = ""
    bill_number: str = ""
    measurement_id: Optional[str] = None
    required_activities: dict[str, bool] = Field(default_factory=dict)


@router.post("/items", status_code=201)
def create_item_compat(body: ItemCreateCompat) -> dict[str, Any]:
    try:
        desc = (body.description or body.name or "Item").strip()
        bill = (body.bill_number or "").strip()
        if not bill and not body.measurement_id:
            bill = f"BILL-{uuid.uuid4().hex[:8].upper()}"
        required = _default_required_activities(body.required_activities or None)
        if not any(required.values()):
            raise ValidationError("Select at least one required activity")
        item = _c().orders.add_item_to_order(
            body.order_id,
            desc,
            required,
            bill_number=bill or None,
            measurement_id=body.measurement_id,
        )
        row = entity_dict(item)
        row["order_id"] = body.order_id
        row["id"] = row.get("item_id") or row.get("id")
        row["name"] = row.get("description") or desc
        return row
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/items/{item_id}")
def get_item(item_id: str, *, order_id: Optional[str] = None) -> dict[str, Any]:
    try:
        if order_id:
            detail = _c().orders.get_customization_item_detail(order_id, item_id)
            if not detail:
                raise HTTPException(status_code=404, detail="Item not found")
            order, item = detail
            return {
                "item": entity_dict(item),
                "order": _order_dict(order),
            }
        for row in _c().orders.list_all_customization_items():
            if row.get("item_id") == item_id:
                return _item_row(row)
        raise HTTPException(status_code=404, detail="Item not found")
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/measurement-specs")
def list_measurement_specs(*, active_only: bool = True) -> list[dict[str, Any]]:
    try:
        rows = []
        for spec in _c().measurements.list_specs(active_only=active_only):
            data = entity_dict(spec)
            pts = data.get("person_types") or []
            data["person_types"] = [
                p.value if hasattr(p, "value") else str(p) for p in pts
            ]
            vt = data.get("value_type")
            data["value_type"] = vt.value if hasattr(vt, "value") else str(vt or "")
            rows.append(data)
        return rows
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/measurement-sections")
def list_measurement_sections(*, active_only: bool = True) -> list[dict[str, Any]]:
    try:
        rows = _c().measurements.list_sections(active_only=active_only)
        return [entity_dict(r) for r in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/measurements")
def list_measurements(
    *,
    q: str = "",
    customer_id: Optional[str] = None,
    measurement_number: str = "",
    wearer_name: str = "",
    person_type: str = "",
    sort_by: str = "measurement_number",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        if customer_id:
            records = _c().measurements.list_by_customer(customer_id)
        else:
            records = _c().measurements.list_all()
        rows = [_meas_dict(r) for r in records]
        filtered = filter_dicts(
            rows,
            equals={"person_type": person_type} if person_type.strip() else None,
            contains={
                "measurement_number": measurement_number,
                "wearer_name": wearer_name,
            },
        )
        needle = (q or "").strip().lower()
        if needle:
            filtered = [
                r
                for r in filtered
                if needle in str(r.get("measurement_number") or "").lower()
                or needle in str(r.get("wearer_name") or "").lower()
                or needle in str(r.get("person_type") or "").lower()
                or needle in str(r.get("customer_id") or "").lower()
                or needle in str(r.get("caption") or "").lower()
            ]
        sorted_rows = sort_dicts(filtered, sort_by, sort_desc=sort_desc)
        return paged_result(sorted_rows, page=page, page_size=page_size)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/measurements", status_code=201)
def create_measurement(body: MeasurementWrite) -> dict[str, Any]:
    try:
        record = _c().measurements.create_record(
            body.customer_id,
            body.person_type,
            values=body.values or None,
            order_id=body.order_id,
            wearer_name=body.wearer_name,
            wearer_age=body.wearer_age,
            wearer_height=body.wearer_height,
            wearer_weight=body.wearer_weight,
            unit=body.unit,
            fit_preference=body.fit_preference,
            notes=body.notes,
            print_notes=body.print_notes,
            measured_at=_parse_date(body.measured_at),
            measured_by=body.measured_by,
        )
        return _meas_dict(record)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/measurements/{record_id}")
def get_measurement(record_id: str) -> dict[str, Any]:
    record = _c().measurements.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return _meas_dict(record)


@router.get("/measurements/{record_id}/pdf")
def measurement_pdf(record_id: str):
    try:
        from fastapi.responses import Response

        from packages.services_kit.parties_container import get_parties_container
        from vaybooks.bms.application.settings.business.service import BusinessAppService
        from vaybooks.bms.infrastructure.pdf.boutique_pdf import generate_measurement_sheet_pdf
        from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
            MongoBusinessProfileRepository,
        )
        from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
        from pymongo import MongoClient

        record = _c().measurements.get_record(record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Measurement not found")
        customer = get_parties_container().customers.get_customer_detail(record.customer_id)
        if not customer:
            raise ValidationError("Customer not found for measurement")
        client = MongoClient(mongo_uri(), serverSelectionTimeoutMS=5000)
        db = client[mongo_db_name()]
        business = BusinessAppService(MongoBusinessProfileRepository(db)).get_profile()
        pdf_bytes = generate_measurement_sheet_pdf(record, customer, business)
        filename = f"{getattr(record, 'measurement_number', record_id)}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/measurements/{record_id}")
def update_measurement(record_id: str, body: MeasurementUpdate) -> dict[str, Any]:
    try:
        record = _c().measurements.update_record(
            record_id,
            values=body.values,
            wearer_name=body.wearer_name,
            wearer_age=body.wearer_age,
            wearer_height=body.wearer_height,
            wearer_weight=body.wearer_weight,
            unit=body.unit,
            fit_preference=body.fit_preference,
            notes=body.notes,
            print_notes=body.print_notes,
            measured_at=_parse_date(body.measured_at) if body.measured_at is not None else None,
            measured_by=body.measured_by,
            order_id=body.order_id,
            person_type=body.person_type,
        )
        return _meas_dict(record)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/measurements/{record_id}")
def delete_measurement(record_id: str) -> dict[str, str]:
    try:
        _c().measurements.delete_record(record_id)
        return {"status": "deleted", "id": record_id}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/tasks/sync")
def sync_activity_tasks(*, order_id: Optional[str] = None) -> dict[str, Any]:
    """Backfill Created activity tasks for open orders (or one order)."""
    try:
        result = _c().orders.sync_activity_tasks(order_id=order_id)
        return {"status": "ok", **result}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/time-entries")
def list_time_entries(
    *,
    q: str = "",
    bill_number: str = "",
    order_number: str = "",
    worker_name: str = "",
    activity_name: str = "",
    work_date_from: Optional[str] = None,
    work_date_to: Optional[str] = None,
    task_type: str = "",
    status: str = "",
    sort_by: str = "work_date",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        entries = _c().time_tracking.search_entries(
            bill_number=bill_number,
            order_number=order_number,
            worker_name=worker_name,
            activity_name=activity_name,
            work_date_from=_parse_date(work_date_from),
            work_date_to=_parse_date(work_date_to),
        )
        rows = [_time_dict(e) for e in entries]
        needle = (q or "").strip().lower()
        if needle:
            rows = [
                r
                for r in rows
                if needle in str(r.get("worker_name") or "").lower()
                or needle in str(r.get("assignee_name") or "").lower()
                or needle in str(r.get("order_number") or "").lower()
                or needle in str(r.get("activity_name") or "").lower()
                or needle in str(r.get("bill_number") or "").lower()
            ]
        if task_type.strip():
            want = task_type.strip().lower()
            rows = [
                r
                for r in rows
                if str(r.get("task_type") or "activity").lower() == want
            ]
        if status.strip():
            want_status = status.strip()
            rows = [
                r
                for r in rows
                if str(r.get("status") or "") == want_status
                or (
                    want_status == "Completed"
                    and bool(str(r.get("start_time") or "").strip())
                    and not str(r.get("status") or "").strip()
                )
                or (
                    want_status == "Created"
                    and not str(r.get("start_time") or "").strip()
                    and not str(r.get("status") or "").strip()
                )
            ]
        sorted_rows = sort_dicts(rows, sort_by, sort_desc=sort_desc)
        return paged_result(sorted_rows, page=page, page_size=page_size)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/time-entries", status_code=201)
def create_time_entry(body: TimeEntryWrite) -> dict[str, Any]:
    try:
        wd = _parse_date(body.work_date)
        if not wd:
            raise HTTPException(status_code=400, detail="work_date required")
        order = _c().orders.get_order_detail(body.order_id)
        if not order:
            raise ValidationError("Order not found")
        bill = order.get_bill_by_id(body.bill_id)
        if not bill:
            raise ValidationError("Item/bill not found on order")
        if not any(oa.activity_id == body.activity_id for oa in order.order_activities):
            raise ValidationError("Activity is not on this order")
        entry = _c().time_tracking.record_time_entry(
            body.order_id,
            body.bill_id,
            body.activity_id,
            wd,
            body.start_time,
            body.end_time,
            worker_name=body.worker_name,
            notes=body.notes,
            ends_next_day=body.ends_next_day,
            assignee_worker_id=body.assignee_worker_id,
            assignee_name=body.assignee_name or body.worker_name,
        )
        return _time_dict(entry)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/time-entries/{entry_id}")
def get_time_entry(entry_id: str) -> dict[str, Any]:
    try:
        entry = _c().time_tracking.get_entry(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="time entry not found")
        return _time_dict(entry)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/time-entries/{entry_id}")
def update_time_entry(entry_id: str, body: TimeEntryUpdate) -> dict[str, Any]:
    try:
        wd = _parse_date(body.work_date)
        if not wd:
            raise HTTPException(status_code=400, detail="work_date required")
        entry = _c().time_tracking.update_time_entry(
            entry_id,
            wd,
            body.start_time,
            body.end_time,
            worker_name=body.worker_name,
            notes=body.notes,
            activity_id=body.activity_id,
            activity_name=body.activity_name,
            ends_next_day=body.ends_next_day,
        )
        if body.assignee_worker_id is not None or body.assignee_name is not None:
            entry = _c().time_tracking.assign_time_entry(
                entry_id,
                assignee_worker_id=body.assignee_worker_id or "",
                assignee_name=body.assignee_name
                if body.assignee_name is not None
                else entry.assignee_name,
            )
        return _time_dict(entry)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/time-entries/{entry_id}/assign")
def assign_time_entry(entry_id: str, body: TimeEntryAssign) -> dict[str, Any]:
    try:
        entry = _c().time_tracking.assign_time_entry(
            entry_id,
            assignee_worker_id=body.assignee_worker_id,
            assignee_name=body.assignee_name,
        )
        return _time_dict(entry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/time-entries/{entry_id}")
def delete_time_entry(entry_id: str) -> dict[str, str]:
    try:
        _c().time_tracking.delete_time_entry(entry_id)
        return {"status": "deleted", "id": entry_id}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/calendar")
def calendar_feed(
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    worker_name: Optional[str] = None,
    activity_name: Optional[str] = None,
) -> list[dict[str, Any]]:
    try:
        today = date.today()
        start = _parse_date(start_date) or (today - timedelta(days=7))
        end = _parse_date(end_date) or (today + timedelta(days=21))
        rows = _c().time_tracking.list_for_calendar(
            start,
            end,
            worker_name=worker_name,
            activity_name=activity_name,
        )
        return [_time_dict(e) for e in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


def _run_report(report_type: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
    from vaybooks.bms.application.report_filters import (
        CompletedFilter,
        DateRange,
        OrderPipelineFilter,
        OverdueFilter,
        TimeTrackingFilter,
        WorkerProductivityFilter,
    )

    reports = _c().reports
    start = _parse_date(filters.get("start_date")) or date.today().replace(day=1)
    end = _parse_date(filters.get("end_date")) or date.today()
    date_range = DateRange(start=start, end=end)
    if report_type == "Order Pipeline":
        rows = reports.order_pipeline_report(OrderPipelineFilter())
    elif report_type == "Overdue Orders":
        rows = reports.overdue_order_report(OverdueFilter(as_of_date=date.today()))
    elif report_type == "Bills Pending Invoice":
        rows = reports.bills_pending_invoice_report()
    elif report_type == "Completed Orders":
        rows = reports.completed_order_report(CompletedFilter(date_range=date_range))
    elif report_type == "Time Tracking":
        rows = reports.time_tracking_report(TimeTrackingFilter(date_range=date_range))
    elif report_type == "Worker Productivity":
        rows = reports.worker_productivity_report(
            WorkerProductivityFilter(date_range=date_range)
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown report_type: {report_type}")

    out: list[dict[str, Any]] = []
    for row in rows or []:
        if hasattr(row, "__dict__") and not isinstance(row, dict):
            data = entity_dict(row)
        else:
            data = dict(row)
        for key, val in list(data.items()):
            if hasattr(val, "isoformat"):
                data[key] = val.isoformat()
            elif hasattr(val, "value"):
                data[key] = val.value
        out.append(data)
    return out


@router.get("/reports")
@router.get("/reports/catalog")
def reports_catalog() -> dict[str, Any]:
    return {
        "report_types": REPORT_TYPES,
        "catalog": [{"report_type": name, "label": name} for name in REPORT_TYPES],
    }


@router.post("/reports/run")
def reports_run(body: ReportRunBody) -> dict[str, Any]:
    try:
        rows = _run_report(body.report_type, body.filters or {})
        return {"report_type": body.report_type, "rows": rows, "count": len(rows)}
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/reports/export")
def reports_export(body: ReportRunBody) -> StreamingResponse:
    try:
        rows = _run_report(body.report_type, body.filters or {})
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        else:
            buf.write("message\nNo rows\n")
        buf.seek(0)
        filename = body.report_type.replace(" ", "_").lower() + ".csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc
