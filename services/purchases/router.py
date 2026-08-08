"""Purchases API — POs and bills with notify to inventory/finance."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish
from services.finance.router import is_consumer_healthy as finance_healthy
from services.inventory.router import is_consumer_healthy as inventory_healthy
from services.sales.degraded import is_degraded_pending

router = APIRouter(prefix="/api/purchases", tags=["purchases"])
_ORDERS = MemoryStore()
_BILLS = MemoryStore()


class PurchaseOrderCreate(BaseModel):
    vendor_id: str = Field(min_length=1)
    total: float = 0.0
    tenant_id: str = "default"


class PurchaseBillCreate(BaseModel):
    vendor_id: str = Field(min_length=1)
    purchase_order_id: str | None = None
    total: float = 0.0
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "module": "purchases",
        "status": "ok",
        "degraded_pending": is_degraded_pending(),
        "inventory_consumer": inventory_healthy(),
        "finance_consumer": finance_healthy(),
    }


@router.get("/orders")
def list_orders(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ORDERS.list(include_deleted=include_deleted)


@router.post("/orders", status_code=201)
def create_order(body: PurchaseOrderCreate) -> dict[str, Any]:
    row = _ORDERS.create(body.model_dump())
    publish(
        "PurchaseOrderCreated",
        {"purchase_order_id": row["id"], "vendor_id": body.vendor_id, "total": body.total},
    )
    return row


@router.get("/orders/{order_id}")
def get_order(order_id: str) -> dict[str, Any]:
    return _ORDERS.get(order_id)


@router.delete("/orders/{order_id}")
def delete_order(order_id: str) -> dict[str, Any]:
    return _ORDERS.soft_delete(order_id)


@router.get("/bills")
def list_bills(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _BILLS.list(include_deleted=include_deleted)


@router.post("/bills", status_code=201)
def create_bill(body: PurchaseBillCreate) -> dict[str, Any]:
    degraded = is_degraded_pending()
    row = _BILLS.create(
        {
            **body.model_dump(),
            "stock_status": "degraded_pending" if degraded else "reserve_requested",
            "posting_status": "degraded_pending" if degraded else "posting_requested",
            "degraded_pending": degraded,
        }
    )
    publish(
        "PurchaseBillPosted",
        {
            "bill_id": row["id"],
            "vendor_id": body.vendor_id,
            "total": body.total,
            "degraded_pending": degraded,
        },
    )
    if not degraded:
        publish("StockReserveRequested", {"key": row["id"], "bill_id": row["id"]})
        publish(
            "FinancePostingRequested",
            {"key": row["id"], "bill_id": row["id"], "amount": body.total},
        )
    return row


@router.get("/bills/{bill_id}")
def get_bill(bill_id: str) -> dict[str, Any]:
    return _BILLS.get(bill_id)
