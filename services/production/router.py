"""Production recipes and batches API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish

router = APIRouter(prefix="/api/production", tags=["production"])
_RECIPES = MemoryStore()
_BATCHES = MemoryStore()


class RecipeCreate(BaseModel):
    name: str = Field(min_length=1)
    output_product_id: str = Field(min_length=1)
    yield_qty: float = 1.0
    tenant_id: str = "default"


class BatchCreate(BaseModel):
    recipe_id: str = Field(min_length=1)
    planned_qty: float = Field(gt=0)
    status: str = "started"
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "production", "status": "ok"}


@router.get("/recipes")
def list_recipes(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _RECIPES.list(include_deleted=include_deleted)


@router.post("/recipes", status_code=201)
def create_recipe(body: RecipeCreate) -> dict[str, Any]:
    return _RECIPES.create(body.model_dump())


@router.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: str) -> dict[str, Any]:
    return _RECIPES.get(recipe_id)


@router.get("/batches")
def list_batches(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _BATCHES.list(include_deleted=include_deleted)


@router.post("/batches", status_code=201)
def create_batch(body: BatchCreate) -> dict[str, Any]:
    _RECIPES.get(body.recipe_id)
    row = _BATCHES.create(body.model_dump())
    publish(
        "ProductionBatchStarted",
        {
            "batch_id": row["id"],
            "recipe_id": body.recipe_id,
            "planned_qty": body.planned_qty,
            "status": body.status,
        },
    )
    return row


@router.get("/batches/{batch_id}")
def get_batch(batch_id: str) -> dict[str, Any]:
    return _BATCHES.get(batch_id)


@router.post("/batches/{batch_id}/complete")
def complete_batch(batch_id: str) -> dict[str, Any]:
    return _BATCHES.update(batch_id, {"status": "completed"})
