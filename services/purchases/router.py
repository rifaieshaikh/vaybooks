"""Purchases API — POs, GRNs, bills, returns, reports (Mongo via PurchaseAppService)."""

from __future__ import annotations

import csv
import io
import re
from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from packages.services_kit.purchases_container import get_purchases_container
from packages.services_kit.paging import (
    DEFAULT_PAGE_SIZE,
    apply_list_query,
    build_mongo_list_filter,
)
from services.finance.router import is_consumer_healthy as finance_healthy
from services.inventory.router import is_consumer_healthy as inventory_healthy
from services.parties.serialize import entity_dict
from services.sales.degraded import is_degraded_pending
from vaybooks.bms.domain.shared.enums import (
    CatalogItemType,
    GoodsReceiptStatus,
    PurchaseOrderStatus,
)
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/purchases", tags=["purchases"])

REPORT_TYPES = [
    "Purchase Orders Pipeline",
    "GRN Pending",
    "Purchases by Vendor",
    "Purchase Returns Summary",
    "PO Status Breakdown",
]


class PoLineWrite(BaseModel):
    product_id: str = Field(min_length=1)
    qty_ordered: float = Field(gt=0)
    rate: float = 0.0
    expense_account_id: str = ""
    product_name: str = ""


class PurchaseOrderWrite(BaseModel):
    vendor_id: str = Field(min_length=1)
    order_date: Optional[str] = None
    expected_date: Optional[str] = None
    notes: str = ""
    project_id: str = ""
    location_id: str = ""
    lines: List[PoLineWrite] = Field(min_length=1)


class GrnLineWrite(BaseModel):
    product_id: str = Field(min_length=1)
    qty_received: float = Field(gt=0)
    rate: float = 0.0
    landed_cost_extra: float = 0.0
    product_name: str = ""
    purchase_order_line_id: str = ""
    batch_number: str = ""
    serial_numbers: List[str] = Field(default_factory=list)


class GoodsReceiptWrite(BaseModel):
    vendor_id: str = Field(min_length=1)
    receipt_date: Optional[str] = None
    purchase_order_id: Optional[str] = None
    location_id: str = Field(min_length=1)
    freight: float = 0.0
    duty: float = 0.0
    other: float = 0.0
    notes: str = ""
    confirm: bool = True
    allow_over_receive: bool = False
    lines: List[GrnLineWrite] = Field(min_length=1)


class BillLineWrite(BaseModel):
    product_id: str = ""
    service_id: str = ""
    qty: float = Field(gt=0)
    rate: float = 0.0
    expense_account_id: str = ""
    description: str = ""
    taxable_amount: Optional[float] = None
    amount: Optional[float] = None


class PurchaseBillWrite(BaseModel):
    vendor_id: str = Field(min_length=1)
    vendor_bill_number: str = Field(min_length=1)
    voucher_date: Optional[str] = None
    due_date: Optional[str] = None
    amount_paid: float = 0.0
    paying_account_id: Optional[str] = None
    reference_po_id: Optional[str] = None
    reference_grn_id: Optional[str] = None
    apply_stock: bool = False
    location_id: str = ""
    location_name: str = ""
    lines: List[BillLineWrite] = Field(min_length=1)


class ReturnLineWrite(BaseModel):
    product_id: str = Field(min_length=1)
    qty: float = Field(gt=0)
    rate: float = 0.0
    product_name: str = ""
    expense_account_id: str = ""


class PurchaseReturnWrite(BaseModel):
    vendor_id: str = Field(min_length=1)
    return_date: Optional[str] = None
    source_bill_id: Optional[str] = None
    source_grn_id: Optional[str] = None
    amount_refunded: float = 0.0
    refund_account_id: Optional[str] = None
    notes: str = ""
    location_id: str = ""
    lines: List[ReturnLineWrite] = Field(min_length=1)


class ReportRunBody(BaseModel):
    report_type: str
    filters: dict[str, Any] = Field(default_factory=dict)


def _svc():
    return get_purchases_container().purchases


def _reports():
    return get_purchases_container().reports


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _display_description(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<!--\s*[A-Z0-9_]+\s*:.*?-->", "", text, flags=re.DOTALL)
    text = re.sub(r"(?im)^\s*LINES_JSON:.*$", "", text)
    kept: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if (stripped.startswith("{") and stripped.endswith("}")) or (
            stripped.startswith("[") and stripped.endswith("]")
        ):
            continue
        if "{" in stripped:
            before, _, after = stripped.partition("{")
            if after.rstrip().endswith("}") or after.lstrip().startswith('"'):
                stripped = before.strip()
                if not stripped:
                    continue
        kept.append(stripped)
    return " ".join(kept).strip()


def _po_dict(po: Any, *, include_lines: bool = True) -> dict[str, Any]:
    data = entity_dict(po)
    status = data.get("status")
    data["status"] = status.value if hasattr(status, "value") else str(status or "")
    data["total_amount"] = float(getattr(po, "total_amount", 0) or 0)
    if not include_lines:
        data.pop("lines", None)
    return data


def _map_po_page(page: dict[str, Any]) -> dict[str, Any]:
    return {
        "items": [_po_dict(item, include_lines=False) for item in page.get("items") or []],
        "total": int(page.get("total") or 0),
        "page": int(page.get("page") or 1),
        "page_size": int(page.get("page_size") or DEFAULT_PAGE_SIZE),
    }


def _map_grn_page(page: dict[str, Any]) -> dict[str, Any]:
    return {
        "items": [_grn_dict(item, include_lines=False) for item in page.get("items") or []],
        "total": int(page.get("total") or 0),
        "page": int(page.get("page") or 1),
        "page_size": int(page.get("page_size") or DEFAULT_PAGE_SIZE),
    }


def _map_return_page(page: dict[str, Any]) -> dict[str, Any]:
    return {
        "items": [
            _return_dict(item, include_lines=False) for item in page.get("items") or []
        ],
        "total": int(page.get("total") or 0),
        "page": int(page.get("page") or 1),
        "page_size": int(page.get("page_size") or DEFAULT_PAGE_SIZE),
    }


def _grn_dict(grn: Any, *, include_lines: bool = True) -> dict[str, Any]:
    data = entity_dict(grn)
    status = data.get("status")
    data["status"] = status.value if hasattr(status, "value") else str(status or "")
    data["total_amount"] = float(getattr(grn, "total_amount", 0) or 0)
    if not include_lines:
        data.pop("lines", None)
    return data


def _return_dict(ret: Any, *, include_lines: bool = True) -> dict[str, Any]:
    data = entity_dict(ret)
    data["total_amount"] = float(getattr(ret, "total_amount", 0) or 0)
    if not include_lines:
        data.pop("lines", None)
    return data


def _bill_dict(row: dict[str, Any], *, include_lines: bool = False) -> dict[str, Any]:
    data = dict(row)
    data["description"] = _display_description(data.get("description") or data.get("vendor_bill_number"))
    caption_bits = [
        str(data.get("voucher_number") or data.get("vendor_bill_number") or ""),
        str(data.get("vendor_name") or data.get("party_name") or ""),
        f"₹{float(data.get('total') or 0):,.2f}",
    ]
    data["caption"] = " · ".join(b for b in caption_bits if b).strip(" ·")
    if data.get("balance_due") is None and data.get("outstanding") is not None:
        try:
            data["balance_due"] = float(data.get("outstanding") or 0)
        except (TypeError, ValueError):
            data["balance_due"] = data.get("outstanding")
    if data.get("amount_paid") is None and data.get("paid") is not None:
        try:
            data["amount_paid"] = float(data.get("paid") or 0)
        except (TypeError, ValueError):
            data["amount_paid"] = data.get("paid")
    if not include_lines:
        data.pop("lines", None)
    # Avoid dumping embedded JSON into list UIs
    if "vendor_bill_number" in data:
        data["vendor_bill_number"] = _display_description(data.get("vendor_bill_number"))
    return data


@router.get("/health")
def health() -> dict[str, object]:
    container = get_purchases_container()
    return {
        "module": "purchases",
        "status": "ok",
        "backend": container.backend,
        "degraded_pending": is_degraded_pending(),
        "inventory_consumer": inventory_healthy(),
        "finance_consumer": finance_healthy(),
    }


@router.get("/overview")
def overview() -> dict[str, Any]:
    try:
        summary = _reports().dashboard_summary()
        pipeline = _reports().purchase_orders_pipeline()[:8]
        pending = _reports().grn_pending()[:8]
        return {
            "kpis": summary,
            "open_orders": [
                {
                    **row,
                    "order_date": row["order_date"].isoformat()
                    if hasattr(row.get("order_date"), "isoformat")
                    else row.get("order_date"),
                    "expected_date": row["expected_date"].isoformat()
                    if hasattr(row.get("expected_date"), "isoformat")
                    else row.get("expected_date"),
                }
                for row in pipeline
            ],
            "pending_grn": [
                {
                    **row,
                    "order_date": row["order_date"].isoformat()
                    if hasattr(row.get("order_date"), "isoformat")
                    else row.get("order_date"),
                }
                for row in pending
            ],
            "quick_actions": [
                {"to": "/purchases/orders", "label": "Purchase orders"},
                {"to": "/purchases/goods-receipt", "label": "Goods receipt"},
                {"to": "/purchases/bills", "label": "Bills"},
                {"to": "/purchases/returns", "label": "Returns"},
                {"to": "/purchases/reports", "label": "Reports"},
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders")
def list_orders(
    *,
    q: str = "",
    po_number: str = "",
    vendor_name: str = "",
    status: str = "",
    date_from: str = "",
    date_to: str = "",
    sort_by: str = "order_date",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        status_key = status.strip()
        equals: dict[str, str] = {}
        status_nin = None
        if status_key.lower() == "open":
            status_nin = [
                PurchaseOrderStatus.CLOSED.value,
                PurchaseOrderStatus.CANCELLED.value,
            ]
        elif status_key:
            equals["status"] = status_key
        query = build_mongo_list_filter(
            q=q,
            q_fields=("po_number", "vendor_name", "status"),
            equals=equals,
            contains={"po_number": po_number, "vendor_name": vendor_name},
            date_field="order_date",
            date_from=date_from,
            date_to=date_to,
            status_nin=status_nin,
        )
        return _map_po_page(
            _svc().query_purchase_orders(
                query,
                sort_by=sort_by or "order_date",
                sort_desc=sort_desc,
                page=page,
                page_size=page_size,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders", status_code=201)
def create_order(body: PurchaseOrderWrite) -> dict[str, Any]:
    try:
        po = _svc().create_purchase_order(
            vendor_id=body.vendor_id,
            order_date=_parse_date(body.order_date) or date.today(),
            lines=[line.model_dump() for line in body.lines],
            expected_date=_parse_date(body.expected_date),
            notes=body.notes,
            project_id=body.project_id,
            location_id=body.location_id,
        )
        return _po_dict(po)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}")
def get_order(order_id: str) -> dict[str, Any]:
    po = _svc().get_purchase_order(order_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return _po_dict(po)


@router.get("/orders/{order_id}/pdf")
def purchase_order_pdf(order_id: str):
    try:
        from fastapi.responses import Response

        from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
        from packages.services_kit.parties_container import get_parties_container
        from pymongo import MongoClient
        from vaybooks.bms.application.settings.business.service import BusinessAppService
        from vaybooks.bms.infrastructure.pdf.purchase_order_pdf import generate_purchase_order_pdf
        from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
            MongoBusinessProfileRepository,
        )

        po = _svc().get_purchase_order(order_id)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        vendor = None
        try:
            vendor = get_parties_container().vendors.get_vendor_detail(getattr(po, "vendor_id", "") or "")
        except Exception:
            vendor = None
        client = MongoClient(mongo_uri(), serverSelectionTimeoutMS=5000)
        db = client[mongo_db_name()]
        business = BusinessAppService(MongoBusinessProfileRepository(db)).get_profile()
        pdf_bytes = generate_purchase_order_pdf(po, business=business, vendor=vendor)
        filename = f"{getattr(po, 'po_number', None) or order_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.put("/orders/{order_id}")
def update_order(order_id: str, body: PurchaseOrderWrite) -> dict[str, Any]:
    try:
        po = _svc().update_purchase_order(
            order_id,
            vendor_id=body.vendor_id,
            order_date=_parse_date(body.order_date) or date.today(),
            lines=[line.model_dump() for line in body.lines],
            expected_date=_parse_date(body.expected_date),
            notes=body.notes,
        )
        return _po_dict(po)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/send")
def send_order(order_id: str) -> dict[str, Any]:
    try:
        po = _svc().get_purchase_order(order_id)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        if po.status == PurchaseOrderStatus.DRAFT:
            po = _svc().update_purchase_order(
                order_id,
                vendor_id=po.vendor_id,
                order_date=po.order_date,
                lines=[
                    {
                        "product_id": line.product_id,
                        "product_name": line.product_name,
                        "qty_ordered": line.qty_ordered,
                        "rate": line.rate,
                        "expense_account_id": line.expense_account_id,
                    }
                    for line in po.lines
                ],
                expected_date=po.expected_date,
                notes=po.notes,
                status=PurchaseOrderStatus.SENT,
            )
        return _po_dict(po)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: str) -> dict[str, Any]:
    try:
        return _po_dict(_svc().cancel_purchase_order(order_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/close")
def close_order(order_id: str) -> dict[str, Any]:
    try:
        return _po_dict(_svc().close_purchase_order(order_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/goods-receipts")
def list_goods_receipts(
    *,
    q: str = "",
    grn_number: str = "",
    vendor_name: str = "",
    status: str = "",
    date_from: str = "",
    date_to: str = "",
    sort_by: str = "receipt_date",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        status_key = status.strip()
        equals: dict[str, str] = {}
        status_in = None
        if status_key.lower() == "pending":
            status_in = [GoodsReceiptStatus.DRAFT.value]
        elif status_key:
            equals["status"] = status_key
        query = build_mongo_list_filter(
            q=q,
            q_fields=("grn_number", "vendor_name", "status", "po_number"),
            equals=equals,
            contains={"grn_number": grn_number, "vendor_name": vendor_name},
            date_field="receipt_date",
            date_from=date_from,
            date_to=date_to,
            status_in=status_in,
        )
        return _map_grn_page(
            _svc().query_goods_receipts(
                query,
                sort_by=sort_by or "receipt_date",
                sort_desc=sort_desc,
                page=page,
                page_size=page_size,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/goods-receipts", status_code=201)
def create_goods_receipt(body: GoodsReceiptWrite) -> dict[str, Any]:
    try:
        grn = _svc().create_goods_receipt(
            vendor_id=body.vendor_id,
            receipt_date=_parse_date(body.receipt_date) or date.today(),
            lines=[line.model_dump() for line in body.lines],
            purchase_order_id=body.purchase_order_id,
            location_id=body.location_id,
            freight=body.freight,
            duty=body.duty,
            other=body.other,
            notes=body.notes,
            confirm=body.confirm,
            allow_over_receive=body.allow_over_receive,
        )
        return _grn_dict(grn)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/goods-receipts/{grn_id}")
def get_goods_receipt(grn_id: str) -> dict[str, Any]:
    grn = _svc().get_goods_receipt(grn_id)
    if not grn:
        raise HTTPException(status_code=404, detail="Goods receipt not found")
    return _grn_dict(grn)


@router.post("/goods-receipts/{grn_id}/confirm")
def confirm_goods_receipt(grn_id: str) -> dict[str, Any]:
    try:
        return _grn_dict(_svc().confirm_goods_receipt(grn_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/vendor-rates")
def get_vendor_rates(
    vendor_id: str = Query(..., min_length=1),
    product_id: str = Query(..., min_length=1),
    item_type: str = Query("Product"),
) -> dict[str, float]:
    try:
        try:
            catalog_type = CatalogItemType(item_type)
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail=f"Invalid item_type: {item_type}"
            ) from exc
        rate = _svc().get_latest_purchase_rate(catalog_type, product_id, vendor_id)
        return {"rate": float(rate or 0)}
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


def _bill_raw_lines(lines: List[BillLineWrite]) -> list[dict[str, Any]]:
    raw_lines: list[dict[str, Any]] = []
    for line in lines:
        raw = line.model_dump()
        item_id = str(raw.get("product_id") or raw.get("service_id") or "").strip()
        if not item_id:
            raise HTTPException(
                status_code=400, detail="Each bill line needs product_id or service_id"
            )
        raw["item_id"] = item_id
        raw.setdefault("item_type", "Product" if raw.get("product_id") else "Service")
        raw_lines.append(raw)
    return raw_lines


@router.get("/bills")
def list_bills(
    *,
    q: str = "",
    vendor_bill_number: str = "",
    vendor_name: str = "",
    voucher_number: str = "",
    has_voucher: str = "",
    unpaid: str = "",
    date_from: str = "",
    date_to: str = "",
    sort_by: str = "bill_date",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        mongo_filter = build_mongo_list_filter(
            contains={
                "description": vendor_bill_number,
                "voucher_number": voucher_number,
            },
            date_field="voucher_date",
            date_from=date_from,
            date_to=date_to,
        )
        rows = [
            _bill_dict(row)
            for row in _svc().list_purchase_bills(mongo_filter=mongo_filter or None)
        ]
        hv = has_voucher.strip().lower()
        if hv in {"yes", "no"}:
            rows = [
                r
                for r in rows
                if (bool(str(r.get("voucher_number") or "").strip()) == (hv == "yes"))
            ]
        if unpaid.strip() in {"1", "true", "yes"}:
            rows = [
                r
                for r in rows
                if float(r.get("balance_due") or r.get("outstanding") or 0) > 0.01
            ]
        return apply_list_query(
            rows,
            q=q,
            q_fields=(
                "vendor_bill_number",
                "voucher_number",
                "vendor_name",
                "party_name",
            ),
            contains={
                "vendor_bill_number": vendor_bill_number,
                "vendor_name": vendor_name,
                "voucher_number": voucher_number,
            },
            sort_by=sort_by or "bill_date",
            sort_desc=sort_desc,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/bills", status_code=201)
def create_bill(body: PurchaseBillWrite) -> dict[str, Any]:
    try:
        raw_lines = _bill_raw_lines(body.lines)
        voucher = _svc().create_purchase_bill_from_lines(
            vendor_id=body.vendor_id,
            raw_lines=raw_lines,
            vendor_bill_number=body.vendor_bill_number,
            amount_paid=body.amount_paid,
            paying_account_id=body.paying_account_id,
            voucher_date=_parse_date(body.voucher_date),
            due_date=_parse_date(body.due_date),
            reference_po_id=body.reference_po_id,
            reference_grn_id=body.reference_grn_id,
            apply_stock=body.apply_stock,
            location_id=body.location_id,
            location_name=body.location_name,
        )
        row = _svc().get_purchase_bill(voucher.id) or {"id": voucher.id}
        return _bill_dict(row, include_lines=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/bills/{bill_id}")
def get_bill(bill_id: str) -> dict[str, Any]:
    row = _svc().get_purchase_bill(bill_id)
    if not row:
        raise HTTPException(status_code=404, detail="Purchase bill not found")
    return _bill_dict(row, include_lines=True)


@router.put("/bills/{bill_id}")
def update_bill(bill_id: str, body: PurchaseBillWrite) -> dict[str, Any]:
    try:
        raw_lines = _bill_raw_lines(body.lines)
        voucher = _svc().update_purchase_bill_from_lines(
            voucher_id=bill_id,
            vendor_id=body.vendor_id,
            raw_lines=raw_lines,
            vendor_bill_number=body.vendor_bill_number,
            amount_paid=body.amount_paid,
            paying_account_id=body.paying_account_id,
            voucher_date=_parse_date(body.voucher_date),
            due_date=_parse_date(body.due_date),
        )
        row = _svc().get_purchase_bill(voucher.id) or {"id": voucher.id}
        return _bill_dict(row, include_lines=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/returns")
def list_returns(
    *,
    q: str = "",
    return_number: str = "",
    vendor_name: str = "",
    date_from: str = "",
    date_to: str = "",
    sort_by: str = "return_date",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    try:
        query = build_mongo_list_filter(
            q=q,
            q_fields=("return_number", "vendor_name"),
            contains={"return_number": return_number, "vendor_name": vendor_name},
            date_field="return_date",
            date_from=date_from,
            date_to=date_to,
        )
        return _map_return_page(
            _svc().query_purchase_returns(
                query,
                sort_by=sort_by or "return_date",
                sort_desc=sort_desc,
                page=page,
                page_size=page_size,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/returns", status_code=201)
def create_return(body: PurchaseReturnWrite) -> dict[str, Any]:
    try:
        ret = _svc().create_purchase_return(
            vendor_id=body.vendor_id,
            return_date=_parse_date(body.return_date) or date.today(),
            lines=[line.model_dump() for line in body.lines],
            source_bill_id=body.source_bill_id,
            source_grn_id=body.source_grn_id,
            amount_refunded=body.amount_refunded,
            refund_account_id=body.refund_account_id,
            notes=body.notes,
            location_id=body.location_id,
        )
        return _return_dict(ret)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/returns/{return_id}")
def get_return(return_id: str) -> dict[str, Any]:
    ret = _svc().get_purchase_return(return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Purchase return not found")
    return _return_dict(ret)


@router.get("/reports")
def reports_catalog() -> dict[str, Any]:
    return {"report_types": REPORT_TYPES}


def _run_report_rows(report_type: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
    reports = _reports()
    rtype = (report_type or "").strip()
    start = _parse_date(str(filters.get("start") or "") or None)
    end = _parse_date(str(filters.get("end") or "") or None)
    if rtype == "Purchase Orders Pipeline":
        rows = reports.purchase_orders_pipeline()
    elif rtype == "GRN Pending":
        rows = reports.grn_pending()
    elif rtype == "Purchases by Vendor":
        rows = reports.purchases_by_vendor(start, end)
    elif rtype == "Purchase Returns Summary":
        rows = reports.purchase_returns_summary(start, end)
    elif rtype == "PO Status Breakdown":
        rows = reports.po_status_breakdown()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {rtype}")
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row) if isinstance(row, dict) else entity_dict(row)
        for key, value in list(item.items()):
            if hasattr(value, "isoformat"):
                item[key] = value.isoformat()
            elif hasattr(value, "value"):
                item[key] = value.value
        out.append(item)
    return out


@router.post("/reports/run")
def run_report(body: ReportRunBody) -> dict[str, Any]:
    try:
        if body.report_type not in REPORT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unknown report type: {body.report_type}")
        rows = _run_report_rows(body.report_type, body.filters or {})
        return {"report_type": body.report_type, "rows": rows}
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/reports/export")
def export_report(body: ReportRunBody) -> StreamingResponse:
    try:
        if body.report_type not in REPORT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unknown report type: {body.report_type}")
        rows = _run_report_rows(body.report_type, body.filters or {})
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        else:
            buf.write("message\nNo rows\n")
        buf.seek(0)
        filename = re.sub(r"[^a-zA-Z0-9]+", "_", body.report_type).strip("_").lower() or "report"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc
