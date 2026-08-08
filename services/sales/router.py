"""Sales API — notify-only side effects; degraded pending until consumers healthy."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.events.registry import get_event
from packages.messaging.bus import get_bus
from packages.timeutil.utc import utc_now
from services.finance.router import is_consumer_healthy as finance_healthy
from services.inventory.router import is_consumer_healthy as inventory_healthy
from services.sales.degraded import is_degraded_pending

router = APIRouter(prefix="/api/sales", tags=["sales"])

_INVOICES: dict[str, dict[str, Any]] = {}


class InvoiceCreate(BaseModel):
    customer_id: str = Field(min_length=1, description="UI-supplied party id; no sync Parties lookup")
    total: float = 0.0
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, object]:
    degraded = is_degraded_pending()
    return {
        "module": "sales",
        "status": "ok",
        "degraded_pending": degraded,
        "inventory_consumer": inventory_healthy(),
        "finance_consumer": finance_healthy(),
    }


@router.get("/invoices")
def list_invoices() -> list[dict[str, Any]]:
    return list(_INVOICES.values())


@router.post("/invoices", status_code=201)
def create_invoice(body: InvoiceCreate) -> dict[str, Any]:
    """Create invoice. Stock/ledger side-effects stay pending while degraded."""
    invoice_id = str(uuid4())
    degraded = is_degraded_pending()
    row: dict[str, Any] = {
        "id": invoice_id,
        "customer_id": body.customer_id,
        "total": body.total,
        "tenant_id": body.tenant_id,
        "created_at": utc_now().isoformat(),
        "stock_status": "degraded_pending" if degraded else "reserve_requested",
        "posting_status": "degraded_pending" if degraded else "posting_requested",
        "degraded_pending": degraded,
    }
    _INVOICES[invoice_id] = row

    ev = get_event("SalesInvoicePosted")
    get_bus().publish(
        ev.name,
        {
            "invoice_id": invoice_id,
            "customer_id": body.customer_id,
            "total": body.total,
            "tenant_id": body.tenant_id,
            "degraded_pending": degraded,
        },
        version=ev.version,
    )

    if not degraded:
        get_bus().publish(
            "StockReserveRequested",
            {"key": invoice_id, "invoice_id": invoice_id},
        )
        get_bus().publish(
            "FinancePostingRequested",
            {"key": invoice_id, "invoice_id": invoice_id, "amount": body.total},
        )

    return row


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str) -> dict[str, Any]:
    row = _INVOICES.get(invoice_id)
    if not row:
        raise HTTPException(status_code=404, detail="invoice not found")
    return row
