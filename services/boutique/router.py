"""Boutique API — orders, items, measurements, time, calendar, reports (Mongo)."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from packages.services_kit.boutique_container import get_boutique_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.exceptions import DomainError, ValidationError

router = APIRouter(prefix="/api/boutique", tags=["boutique"])

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
    expected_delivery_date: Optional[str] = None
    customer_specification: str = ""
    measurement_id: Optional[str] = None
    required_activities: dict[str, bool] = Field(default_factory=dict)


class OrderItemUpdate(BaseModel):
    bill_number: str = Field(min_length=1)
    description: str = Field(min_length=1)
    expected_delivery_date: Optional[str] = None
    customer_specification: Optional[str] = None


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


class TimeEntryUpdate(BaseModel):
    work_date: str
    start_time: str = Field(min_length=1)
    end_time: str = Field(min_length=1)
    worker_name: str = ""
    notes: str = ""
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    ends_next_day: bool = False


class ReportRunBody(BaseModel):
    report_type: str
    filters: dict[str, Any] = Field(default_factory=dict)


def _c():
    return get_boutique_container()


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
    return data


def _item_row(row: dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    status = data.get("item_status")
    data["item_status"] = status.value if hasattr(status, "value") else str(status or "")
    ostatus = data.get("order_status")
    data["order_status"] = ostatus.value if hasattr(ostatus, "value") else str(ostatus or "")
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
            str(data.get("activity_name") or data.get("description") or ""),
            f"₹{float(data.get('amount') or 0):,.2f}",
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
def overview() -> dict[str, Any]:
    try:
        today = date.today()
        start = today.replace(day=1)
        summary = _c().reports.dashboard_summary(start, today)
        overdue = _c().reports.overdue_queue(limit=8)
        pending = _c().reports.bills_pending_invoice_queue(limit=8)
        for row in overdue + pending:
            for key, val in list(row.items()):
                if hasattr(val, "isoformat"):
                    row[key] = val.isoformat()
        return {
            "kpis": summary,
            "overdue_orders": overdue,
            "bills_pending_invoice": pending,
            "quick_actions": [
                {"to": "/boutique/orders", "label": "Orders"},
                {"to": "/boutique/items", "label": "Items"},
                {"to": "/boutique/measurements", "label": "Measurements"},
                {"to": "/boutique/time", "label": "Time / tasks"},
                {"to": "/boutique/calendar", "label": "Calendar"},
                {"to": "/boutique/reports", "label": "Reports"},
            ],
        }
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
def list_orders(*, q: str = "") -> list[dict[str, Any]]:
    try:
        orders = _c().orders.search_customization_orders(q or "")
        return [_order_dict(o) for o in orders]
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
        order = _c().orders.update_customization_item(
            order_id,
            item_id,
            body.bill_number,
            body.description,
            expected_delivery_date=_parse_date(body.expected_delivery_date),
            customer_specification=body.customer_specification,
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


@router.post("/orders/{order_id}/activities/{activity_id}/complete")
def complete_activity(order_id: str, activity_id: str, body: ActivityAction) -> dict[str, Any]:
    try:
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
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/activities/{activity_id}/skip")
def skip_activity(order_id: str, activity_id: str, body: ActivityAction) -> dict[str, Any]:
    try:
        return _order_dict(_c().orders.skip_activity(activity_id, body.completed_by))
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


@router.get("/items")
def list_items(*, q: str = "") -> list[dict[str, Any]]:
    try:
        rows = _c().orders.search_customization_items(q or "")
        return [_item_row(r) for r in rows]
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
def list_measurements(*, customer_id: Optional[str] = None) -> list[dict[str, Any]]:
    try:
        if customer_id:
            rows = _c().measurements.list_by_customer(customer_id)
        else:
            rows = _c().measurements.list_all()
        return [_meas_dict(r) for r in rows]
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


def _linked_order_labels(record_id: str) -> list[str]:
    labels: list[str] = []
    for order in _c().orders.search_customization_orders(""):
        for item in getattr(order, "customization_items", None) or []:
            mid = getattr(item, "measurement_id", "") or ""
            if mid == record_id:
                bill = getattr(item, "bill_number", "") or getattr(item, "item_id", "")
                labels.append(f"{getattr(order, 'order_number', order.id)} / {bill}")
    return labels


@router.delete("/measurements/{record_id}")
def delete_measurement(record_id: str) -> dict[str, str]:
    try:
        linked = _linked_order_labels(record_id)
        if linked:
            raise ValidationError(
                "This measurement is linked to customization items and cannot be removed: "
                + "; ".join(linked[:5])
            )
        _c().measurements.delete_record(record_id)
        return {"status": "deleted", "id": record_id}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/time-entries")
def list_time_entries(
    *,
    bill_number: str = "",
    order_number: str = "",
    worker_name: str = "",
    activity_name: str = "",
    work_date_from: Optional[str] = None,
    work_date_to: Optional[str] = None,
) -> list[dict[str, Any]]:
    try:
        rows = _c().time_tracking.search_entries(
            bill_number=bill_number,
            order_number=order_number,
            worker_name=worker_name,
            activity_name=activity_name,
            work_date_from=_parse_date(work_date_from),
            work_date_to=_parse_date(work_date_to),
        )
        return [_time_dict(e) for e in rows]
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
        )
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
        return _time_dict(entry)
    except HTTPException:
        raise
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
