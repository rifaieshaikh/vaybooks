"""Sales API — estimates, quotations, orders, DNs, invoices, returns, reports (Mongo)."""

from __future__ import annotations

import csv
import io
import re
from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from packages.services_kit.sales_container import get_sales_container
from services.common.authz import require_permission
from services.finance.router import is_consumer_healthy as finance_healthy
from services.inventory.router import is_consumer_healthy as inventory_healthy
from services.parties.serialize import entity_dict
from services.sales.degraded import is_degraded_pending
from vaybooks.bms.domain.shared.enums import EstimateStatus, QuotationStatus
from vaybooks.bms.domain.shared.exceptions import ValidationError

RECENT_DOC_LIMIT = 5

router = APIRouter(prefix="/api/sales", tags=["sales"])

REPORT_TYPES = [
    "Sales Orders Pipeline",
    "Delivery Pending",
    "Sales by Customer",
    "Sales Returns Summary",
    "SO Status Breakdown",
]


class SalesLineWrite(BaseModel):
    product_id: str = Field(min_length=1)
    qty: float = Field(gt=0)
    rate: float = 0.0
    product_name: str = ""
    discount: float = 0.0
    location_id: str = ""


class PricedDocWrite(BaseModel):
    customer_id: str = Field(min_length=1)
    document_date: Optional[str] = None
    valid_until: Optional[str] = None
    notes: str = ""
    location_id: str = ""
    lines: List[SalesLineWrite] = Field(min_length=1)


class StatusWrite(BaseModel):
    status: str = Field(min_length=1)


class SalesOrderWrite(BaseModel):
    customer_id: str = Field(min_length=1)
    order_date: Optional[str] = None
    expected_date: Optional[str] = None
    notes: str = ""
    location_id: str = ""
    commission_agent_ids: List[str] = Field(default_factory=list)
    sales_rep_ids: List[str] = Field(default_factory=list)
    lines: List[SalesLineWrite] = Field(min_length=1)


class DeliveryNoteWrite(BaseModel):
    customer_id: str = Field(min_length=1)
    delivery_date: Optional[str] = None
    sales_order_id: Optional[str] = None
    sales_invoice_id: Optional[str] = None
    notes: str = ""
    location_id: str = ""
    confirm: bool = False
    delivery_partner_id: str = ""
    lines: List[SalesLineWrite] = Field(min_length=1)


class InvoiceWrite(BaseModel):
    customer_id: str = Field(min_length=1)
    store_account_id: str = Field(min_length=1)
    store_invoice_number: str = ""
    voucher_date: Optional[str] = None
    amount_received: float = 0.0
    discount_amount: float = 0.0
    invoice_discount: float = 0.0
    reference_so_id: Optional[str] = None
    reference_dn_id: Optional[str] = None
    location_id: str = ""
    lines: List[SalesLineWrite] = Field(min_length=1)


class ConvertInvoiceWrite(BaseModel):
    store_account_id: str = Field(min_length=1)
    store_invoice_number: str = ""
    amount_received: float = 0.0
    voucher_date: Optional[str] = None


class ConvertOrderWrite(BaseModel):
    order_date: Optional[str] = None
    expected_date: Optional[str] = None


class ReturnLineWrite(BaseModel):
    product_id: str = Field(min_length=1)
    qty: float = Field(gt=0)
    rate: float = 0.0
    product_name: str = ""


class SalesReturnWrite(BaseModel):
    customer_id: str = Field(min_length=1)
    return_date: Optional[str] = None
    source_invoice_id: Optional[str] = None
    source_dn_id: Optional[str] = None
    notes: str = ""
    return_reason: str = ""
    location_id: str = ""
    restock_items: bool = True
    lines: List[ReturnLineWrite] = Field(min_length=1)


class ReportRunBody(BaseModel):
    report_type: str
    filters: dict[str, Any] = Field(default_factory=dict)


def _svc():
    return get_sales_container().sales


def _reports():
    return get_sales_container().reports


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


def _doc_dict(entity: Any, *, include_lines: bool = True) -> dict[str, Any]:
    data = entity_dict(entity)
    status = data.get("status")
    data["status"] = status.value if hasattr(status, "value") else str(status or "")
    if hasattr(entity, "total_amount"):
        data["total_amount"] = float(getattr(entity, "total_amount", 0) or 0)
    if not include_lines:
        data.pop("lines", None)
    data.pop("document_content", None)
    return data


def _invoice_dict(row: dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    data["description"] = _display_description(data.get("description") or data.get("line_items_note"))
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("store_invoice_number") or data.get("voucher_number") or ""),
            str(data.get("customer_name") or data.get("party_name") or ""),
            f"₹{float(data.get('net') or data.get('gross') or data.get('total') or 0):,.2f}",
        ]
        if b
    )
    data.pop("lines", None)
    degraded = is_degraded_pending()
    data["degraded_pending"] = degraded
    data["stock_status"] = "posted" if not degraded else "degraded_pending"
    data["posting_status"] = "posted" if not degraded else "degraded_pending"
    return data


def _line_payloads(lines: List[SalesLineWrite]) -> list[dict[str, Any]]:
    return [line.model_dump() for line in lines]


@router.get("/health")
def health() -> dict[str, object]:
    container = get_sales_container()
    degraded = is_degraded_pending()
    return {
        "module": "sales",
        "status": "ok",
        "backend": container.backend,
        "degraded_pending": degraded,
        "inventory_consumer": inventory_healthy(),
        "finance_consumer": finance_healthy(),
    }


@router.get("/overview")
def overview() -> dict[str, Any]:
    try:
        summary = _reports().dashboard_summary()
        pipeline = _reports().sales_orders_pipeline()[:8]
        pending = _reports().delivery_pending()[:8]

        def _dates(row: dict[str, Any]) -> dict[str, Any]:
            out = dict(row)
            for key in ("order_date", "expected_date", "delivery_date"):
                if hasattr(out.get(key), "isoformat"):
                    out[key] = out[key].isoformat()
            return out

        return {
            "kpis": summary,
            "open_orders": [_dates(r) for r in pipeline],
            "pending_delivery": [_dates(r) for r in pending],
            "quick_actions": [
                {"to": "/sales/orders", "label": "Sales orders"},
                {"to": "/sales/delivery-notes", "label": "Delivery notes"},
                {"to": "/sales/invoices", "label": "Invoices"},
                {"to": "/sales/returns", "label": "Returns"},
                {"to": "/sales/reports", "label": "Reports"},
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/customers/{customer_id}/related-summary")
def customer_related_summary(
    customer_id: str,
    _: str = Depends(
        require_permission("parties.customers.view", "sales.invoices.view")
    ),
) -> dict[str, Any]:
    """Customer-scoped sales counts, recent docs, and optional outstanding."""
    try:
        sales = _svc()
    except Exception:
        return {"available": False}
    if sales is None:
        return {"available": False}

    try:
        customer_account_id = ""
        accounting = None
        try:
            from packages.services_kit.finance_container import get_finance_container

            accounting = get_finance_container().accounting
            acct = accounting.get_customer_account(customer_id) if accounting else None
            customer_account_id = acct.id if acct else ""
        except Exception:
            accounting = None
            customer_account_id = ""

        counts = sales.related_document_counts(
            customer_id, customer_account_id=customer_account_id
        )

        recent: list[dict[str, Any]] = []
        try:
            orders = [
                o
                for o in (sales.list_sales_orders() or [])
                if str(getattr(o, "customer_id", "") or "") == customer_id
            ]
            orders.sort(
                key=lambda o: getattr(o, "order_date", None) or date.min,
                reverse=True,
            )
            for order in orders[:RECENT_DOC_LIMIT]:
                row = _doc_dict(order, include_lines=False)
                row["doc_type"] = "sales_order"
                recent.append(row)
        except Exception:
            recent = []

        payload: dict[str, Any] = {
            "available": True,
            "counts": counts,
            "recent": recent,
        }

        if accounting and customer_account_id:
            try:
                open_rows = accounting.list_open_sales_invoices_for_customer(
                    customer_account_id
                )
                payload["outstanding"] = round(
                    sum(float(r.get("outstanding") or 0) for r in (open_rows or [])),
                    2,
                )
            except Exception:
                pass

        return payload
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/customers/{customer_id}/product-history")
def customer_product_history(
    customer_id: str,
    _: str = Depends(
        require_permission("parties.customers.view", "sales.invoices.view")
    ),
) -> list[dict[str, Any]]:
    """Sales-invoice product lines for one customer (newest first, capped)."""
    try:
        sales = _svc()
    except Exception as exc:
        raise _http_err(exc) from exc
    if sales is None:
        raise HTTPException(status_code=503, detail="Sales service unavailable")
    try:
        return sales.customer_product_history(customer_id, limit=200)
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- Estimates ----


@router.get("/estimates")
def list_estimates() -> list[dict[str, Any]]:
    try:
        return [_doc_dict(e, include_lines=False) for e in _svc().list_estimates()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/estimates", status_code=201)
def create_estimate(body: PricedDocWrite) -> dict[str, Any]:
    try:
        est = _svc().create_estimate(
            customer_id=body.customer_id,
            estimate_date=_parse_date(body.document_date) or date.today(),
            lines=_line_payloads(body.lines),
            valid_until=_parse_date(body.valid_until),
            notes=body.notes,
            location_id=body.location_id,
        )
        return _doc_dict(est)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/estimates/{estimate_id}")
def get_estimate(estimate_id: str) -> dict[str, Any]:
    est = _svc().get_estimate(estimate_id)
    if not est:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return _doc_dict(est)


@router.put("/estimates/{estimate_id}")
def update_estimate(estimate_id: str, body: PricedDocWrite) -> dict[str, Any]:
    try:
        est = _svc().update_estimate(
            estimate_id,
            customer_id=body.customer_id,
            estimate_date=_parse_date(body.document_date) or date.today(),
            lines=_line_payloads(body.lines),
            valid_until=_parse_date(body.valid_until),
            notes=body.notes,
        )
        return _doc_dict(est)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/estimates/{estimate_id}/status")
def set_estimate_status(estimate_id: str, body: StatusWrite) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().set_estimate_status(estimate_id, EstimateStatus(body.status)))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/estimates/{estimate_id}/convert-order", status_code=201)
def convert_estimate_to_order(estimate_id: str, body: ConvertOrderWrite | None = None) -> dict[str, Any]:
    body = body or ConvertOrderWrite()
    try:
        return _doc_dict(
            _svc().convert_estimate_to_sales_order(
                estimate_id,
                order_date=_parse_date(body.order_date),
                expected_date=_parse_date(body.expected_date),
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/estimates/{estimate_id}/convert-invoice", status_code=201)
def convert_estimate_to_invoice(estimate_id: str, body: ConvertInvoiceWrite) -> dict[str, Any]:
    try:
        voucher = _svc().convert_estimate_to_invoice(
            estimate_id,
            store_account_id=body.store_account_id,
            store_invoice_number=body.store_invoice_number or f"EST-{estimate_id[:8]}",
            amount_received=body.amount_received,
            voucher_date=_parse_date(body.voucher_date),
        )
        row = _svc().get_sales_invoice(voucher.id) or {"id": voucher.id}
        return _invoice_dict(row)
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- Quotations ----


@router.get("/quotations")
def list_quotations() -> list[dict[str, Any]]:
    try:
        return [_doc_dict(q, include_lines=False) for q in _svc().list_quotations()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/quotations", status_code=201)
def create_quotation(body: PricedDocWrite) -> dict[str, Any]:
    try:
        quot = _svc().create_quotation(
            customer_id=body.customer_id,
            quotation_date=_parse_date(body.document_date) or date.today(),
            lines=_line_payloads(body.lines),
            valid_until=_parse_date(body.valid_until),
            notes=body.notes,
            location_id=body.location_id,
        )
        return _doc_dict(quot)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/quotations/{quotation_id}")
def get_quotation(quotation_id: str) -> dict[str, Any]:
    quot = _svc().get_quotation(quotation_id)
    if not quot:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _doc_dict(quot)


@router.put("/quotations/{quotation_id}")
def update_quotation(quotation_id: str, body: PricedDocWrite) -> dict[str, Any]:
    try:
        quot = _svc().update_quotation(
            quotation_id,
            customer_id=body.customer_id,
            quotation_date=_parse_date(body.document_date) or date.today(),
            lines=_line_payloads(body.lines),
            valid_until=_parse_date(body.valid_until),
            notes=body.notes,
        )
        return _doc_dict(quot)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/quotations/{quotation_id}/status")
def set_quotation_status(quotation_id: str, body: StatusWrite) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().set_quotation_status(quotation_id, QuotationStatus(body.status)))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/quotations/{quotation_id}/convert-order", status_code=201)
def convert_quotation_to_order(quotation_id: str, body: ConvertOrderWrite | None = None) -> dict[str, Any]:
    body = body or ConvertOrderWrite()
    try:
        return _doc_dict(
            _svc().convert_quotation_to_sales_order(
                quotation_id,
                order_date=_parse_date(body.order_date),
                expected_date=_parse_date(body.expected_date),
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- Orders ----


@router.get("/orders")
def list_orders() -> list[dict[str, Any]]:
    try:
        return [_doc_dict(o, include_lines=False) for o in _svc().list_sales_orders()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders", status_code=201)
def create_order(body: SalesOrderWrite) -> dict[str, Any]:
    try:
        order = _svc().create_sales_order(
            customer_id=body.customer_id,
            order_date=_parse_date(body.order_date) or date.today(),
            lines=_line_payloads(body.lines),
            expected_date=_parse_date(body.expected_date),
            notes=body.notes,
            location_id=body.location_id,
            commission_agent_ids=body.commission_agent_ids,
            sales_rep_ids=body.sales_rep_ids,
        )
        return _doc_dict(order)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/orders/{order_id}")
def get_order(order_id: str) -> dict[str, Any]:
    order = _svc().get_sales_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return _doc_dict(order)


@router.put("/orders/{order_id}")
def update_order(order_id: str, body: SalesOrderWrite) -> dict[str, Any]:
    try:
        order = _svc().update_sales_order(
            order_id,
            customer_id=body.customer_id,
            order_date=_parse_date(body.order_date) or date.today(),
            lines=_line_payloads(body.lines),
            expected_date=_parse_date(body.expected_date),
            notes=body.notes,
            location_id=body.location_id,
        )
        return _doc_dict(order)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().cancel_sales_order(order_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/close")
def close_order(order_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().close_sales_order(order_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/orders/{order_id}/convert-invoice", status_code=201)
def convert_order_to_invoice(order_id: str, body: ConvertInvoiceWrite) -> dict[str, Any]:
    try:
        voucher = _svc().convert_sales_order_to_invoice(
            order_id,
            store_account_id=body.store_account_id,
            store_invoice_number=body.store_invoice_number or f"SO-{order_id[:8]}",
            amount_received=body.amount_received,
            voucher_date=_parse_date(body.voucher_date),
        )
        row = _svc().get_sales_invoice(voucher.id) or {"id": voucher.id}
        return _invoice_dict(row)
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- Delivery notes ----


@router.get("/delivery-notes")
def list_delivery_notes() -> list[dict[str, Any]]:
    try:
        return [_doc_dict(d, include_lines=False) for d in _svc().list_delivery_notes()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/delivery-notes", status_code=201)
def create_delivery_note(body: DeliveryNoteWrite) -> dict[str, Any]:
    try:
        dn = _svc().create_delivery_note(
            customer_id=body.customer_id,
            delivery_date=_parse_date(body.delivery_date) or date.today(),
            lines=_line_payloads(body.lines),
            sales_order_id=body.sales_order_id,
            sales_invoice_id=body.sales_invoice_id,
            notes=body.notes,
            confirm=body.confirm,
            location_id=body.location_id,
            delivery_partner_id=body.delivery_partner_id,
        )
        return _doc_dict(dn)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/delivery-notes/{dn_id}")
def get_delivery_note(dn_id: str) -> dict[str, Any]:
    dn = _svc().get_delivery_note(dn_id)
    if not dn:
        raise HTTPException(status_code=404, detail="Delivery note not found")
    return _doc_dict(dn)


@router.post("/delivery-notes/{dn_id}/confirm")
def confirm_delivery_note(dn_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().confirm_delivery_note(dn_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/delivery-notes/{dn_id}/dispatch")
def dispatch_delivery_note(dn_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().dispatch_delivery_note(dn_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/delivery-notes/{dn_id}/deliver")
def deliver_delivery_note(dn_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().deliver_delivery_note(dn_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/delivery-notes/{dn_id}/cancel")
def cancel_delivery_note(dn_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().cancel_delivery_note(dn_id))
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- Invoices ----


@router.get("/invoices")
def list_invoices() -> list[dict[str, Any]]:
    try:
        return [_invoice_dict(row) for row in _svc().list_sales_invoices()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/invoices", status_code=201)
def create_invoice(body: InvoiceWrite) -> dict[str, Any]:
    try:
        from packages.services_kit.finance_container import get_finance_container

        customer_account = get_finance_container().accounting.get_customer_account(
            body.customer_id
        )
        if not customer_account:
            raise ValueError("Customer account not found")
        lines = _line_payloads(body.lines)
        for line in lines:
            if body.location_id and not line.get("location_id"):
                line["location_id"] = body.location_id
        gross = round(sum(float(l["qty"]) * float(l["rate"]) for l in lines), 2)
        voucher = _svc().create_sales_invoice(
            customer_account_id=customer_account.id,
            store_account_id=body.store_account_id,
            gross_amount=gross,
            discount_amount=body.discount_amount,
            amount_received=body.amount_received,
            store_invoice_number=body.store_invoice_number or f"INV-{date.today().isoformat()}",
            voucher_date=_parse_date(body.voucher_date),
            reference_so_id=body.reference_so_id,
            reference_dn_id=body.reference_dn_id,
            line_items=lines,
            invoice_discount=body.invoice_discount,
            location_id=body.location_id,
        )
        row = _svc().get_sales_invoice(voucher.id) or {"id": voucher.id}
        return _invoice_dict(row)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str) -> dict[str, Any]:
    row = _svc().get_sales_invoice(invoice_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sales invoice not found")
    return _invoice_dict(row)


@router.get("/invoices/{invoice_id}/pdf")
def invoice_pdf(invoice_id: str):
    try:
        from fastapi.responses import Response

        from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
        from pymongo import MongoClient
        from vaybooks.bms.application.settings.business.service import BusinessAppService
        from vaybooks.bms.infrastructure.pdf.sales_doc_pdf import generate_sales_document_pdf
        from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
            MongoBusinessProfileRepository,
        )

        row = _svc().get_sales_invoice(invoice_id)
        if not row:
            raise HTTPException(status_code=404, detail="Sales invoice not found")
        document = _invoice_dict(row)
        if "items" not in document and document.get("lines"):
            document["items"] = document["lines"]
        client = MongoClient(mongo_uri(), serverSelectionTimeoutMS=5000)
        db = client[mongo_db_name()]
        business = BusinessAppService(MongoBusinessProfileRepository(db)).get_profile()
        pdf_bytes = generate_sales_document_pdf("sales_invoice", document, business)
        filename = f"{document.get('store_invoice_number') or document.get('voucher_number') or invoice_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- Returns ----


@router.get("/returns")
def list_returns() -> list[dict[str, Any]]:
    try:
        return [_doc_dict(r, include_lines=False) for r in _svc().list_sales_returns()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/returns", status_code=201)
def create_return(body: SalesReturnWrite) -> dict[str, Any]:
    try:
        ret = _svc().create_sales_return(
            customer_id=body.customer_id,
            return_date=_parse_date(body.return_date) or date.today(),
            lines=[line.model_dump() for line in body.lines],
            source_invoice_id=body.source_invoice_id,
            source_dn_id=body.source_dn_id,
            notes=body.notes,
            return_reason=body.return_reason,
            location_id=body.location_id,
            restock_items=body.restock_items,
        )
        return _doc_dict(ret)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/returns/{return_id}")
def get_return(return_id: str) -> dict[str, Any]:
    ret = _svc().get_sales_return(return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Sales return not found")
    return _doc_dict(ret)


@router.post("/returns/{return_id}/approve")
def approve_return(return_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().approve_sales_return(return_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/returns/{return_id}/reject")
def reject_return(return_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().reject_sales_return(return_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/returns/{return_id}/goods-received")
def goods_received_return(return_id: str) -> dict[str, Any]:
    try:
        return _doc_dict(_svc().mark_sales_return_goods_received(return_id))
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- Reports ----


@router.get("/reports")
def reports_catalog() -> dict[str, Any]:
    return {"report_types": REPORT_TYPES}


def _run_report_rows(report_type: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
    reports = _reports()
    rtype = (report_type or "").strip()
    start = _parse_date(str(filters.get("start") or "") or None)
    end = _parse_date(str(filters.get("end") or "") or None)
    if rtype == "Sales Orders Pipeline":
        rows = reports.sales_orders_pipeline()
    elif rtype == "Delivery Pending":
        rows = reports.delivery_pending()
    elif rtype == "Sales by Customer":
        rows = reports.sales_by_customer(start, end)
    elif rtype == "Sales Returns Summary":
        rows = reports.sales_returns_summary(start, end)
    elif rtype == "SO Status Breakdown":
        rows = reports.so_status_breakdown()
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
        return {"report_type": body.report_type, "rows": _run_report_rows(body.report_type, body.filters or {})}
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
