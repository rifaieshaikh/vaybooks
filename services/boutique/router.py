"""Boutique customization orders API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish

router = APIRouter(prefix="/api/boutique", tags=["boutique"])
_ORDERS = MemoryStore()
_ITEMS = MemoryStore()


class BoutiqueOrderCreate(BaseModel):
    customer_id: str = Field(min_length=1)
    status: str = "draft"
    tenant_id: str = "default"
    notes: str = ""


class BoutiqueItemCreate(BaseModel):
    order_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    quantity: float = 1.0


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "boutique", "status": "ok"}


@router.get("/orders")
def list_orders(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ORDERS.list(include_deleted=include_deleted)


@router.post("/orders", status_code=201)
def create_order(body: BoutiqueOrderCreate) -> dict[str, Any]:
    row = _ORDERS.create(body.model_dump())
    publish(
        "BoutiqueOrderCreated",
        {"order_id": row["id"], "customer_id": body.customer_id, "status": body.status},
    )
    return row


@router.get("/orders/{order_id}")
def get_order(order_id: str) -> dict[str, Any]:
    return _ORDERS.get(order_id)


@router.patch("/orders/{order_id}")
def update_order(order_id: str, body: BoutiqueOrderCreate) -> dict[str, Any]:
    return _ORDERS.update(order_id, body.model_dump())


@router.delete("/orders/{order_id}")
def delete_order(order_id: str) -> dict[str, Any]:
    return _ORDERS.soft_delete(order_id)


@router.get("/items")
def list_items(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ITEMS.list(include_deleted=include_deleted)


@router.post("/items", status_code=201)
def create_item(body: BoutiqueItemCreate) -> dict[str, Any]:
    _ORDERS.get(body.order_id)  # ensure order exists
    return _ITEMS.create(body.model_dump())


@router.get("/items/{item_id}")
def get_item(item_id: str) -> dict[str, Any]:
    return _ITEMS.get(item_id)
