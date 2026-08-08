"""Production recipes, batches, reports, and settings API (Mongo)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.production_container import get_production_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.production.entities import (
    BatchCost,
    ProductionSettings,
    Recipe,
    RecipeInput,
    RecipeOutput,
    RecipeStage,
)
from vaybooks.bms.domain.shared.enums import (
    ProductionBatchStatus,
    ProductionCostAllocationMethod,
    ProductionOutputRole,
)
from vaybooks.bms.domain.shared.exceptions import DomainError, ValidationError

router = APIRouter(prefix="/api/production", tags=["production"])

REPORT_CATALOG = [
    {"id": "batch_register_report", "title": "Batch Register", "method": "batch_register_report"},
    {"id": "batch_cost_sheet_report", "title": "Batch Cost Sheet", "method": "batch_cost_sheet_report"},
    {"id": "batch_margin_report", "title": "Batch Margin", "method": "batch_margin_report"},
    {
        "id": "yield_variance_report",
        "title": "Yield vs Recipe (variance)",
        "method": "yield_variance_report",
    },
    {
        "id": "production_expense_report",
        "title": "Production Expenses (by type / activity)",
        "method": "production_expense_report",
    },
    {
        "id": "output_summary_report",
        "title": "Output Summary (by product / period)",
        "method": "output_summary_report",
    },
    {"id": "rm_consumption_report", "title": "RM Consumption", "method": "rm_consumption_report"},
    {
        "id": "wip_open_batches_report",
        "title": "WIP / Unposted Batches",
        "method": "wip_open_batches_report",
    },
    {
        "id": "cost_per_unit_trend_report",
        "title": "Cost per Unit Trend",
        "method": "cost_per_unit_trend_report",
    },
    {
        "id": "recipe_master_report",
        "title": "Recipe Master List",
        "method": "recipe_master_report",
    },
]


class RecipeLineIn(BaseModel):
    product_id: str = Field(min_length=1)
    qty: float = 0.0
    expected_qty: float = 0.0
    product_name: str = ""
    unit: str = ""
    scrap_pct: float = 0.0
    role: str = "Main"
    allocation_pct: float = 0.0
    nrv_rate: float = 0.0


class RecipeStageIn(BaseModel):
    name: str = Field(min_length=1)
    sequence: int = 1
    notes: str = ""


class RecipeCreate(BaseModel):
    name: str = Field(min_length=1)
    code: str = ""
    description: str = ""
    base_quantity: float = 1.0
    allocation_method: str = "NRV"
    inputs: List[RecipeLineIn] = Field(default_factory=list)
    outputs: List[RecipeLineIn] = Field(default_factory=list)
    stages: List[RecipeStageIn] = Field(default_factory=list)
    # legacy shim fields
    output_product_id: str = ""
    yield_qty: float = 1.0


class RecipePatch(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    base_quantity: Optional[float] = None
    allocation_method: Optional[str] = None
    is_active: Optional[bool] = None
    inputs: Optional[List[RecipeLineIn]] = None
    outputs: Optional[List[RecipeLineIn]] = None
    stages: Optional[List[RecipeStageIn]] = None


class BatchCreate(BaseModel):
    recipe_id: str = Field(min_length=1)
    batch_number: str = ""
    batch_date: Optional[str] = None
    location_id: str = Field(min_length=1)
    planned_quantity: float = 1.0
    planned_qty: float = 0.0  # legacy alias
    notes: str = ""


class StageCompleteBody(BaseModel):
    stage_id: str = Field(min_length=1)
    notes: Optional[str] = None


class CostWrite(BaseModel):
    cost_type: str = Field(min_length=1)
    amount: float = Field(ge=0)
    activity_id: str = ""
    account_id: str = ""
    description: str = ""


class SettingsPatch(BaseModel):
    wip_account_id: Optional[str] = None
    raw_material_account_id: Optional[str] = None
    finished_goods_account_id: Optional[str] = None
    manufacturing_overhead_account_id: Optional[str] = None
    expense_clearing_account_id: Optional[str] = None
    scrap_account_id: Optional[str] = None
    default_allocation_method: Optional[str] = None


class ReportRunBody(BaseModel):
    report_id: str = ""
    report_type: str = ""
    filters: dict[str, Any] = Field(default_factory=dict)


class PostBody(BaseModel):
    posted_by: str = "api"


def _c():
    return get_production_container()


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, (ValidationError, DomainError)):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _parse_date(value: Optional[str], *, required: bool = False) -> Optional[date]:
    if not value:
        if required:
            raise HTTPException(status_code=400, detail="date is required")
        return None
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _recipe_dict(recipe: Any) -> dict[str, Any]:
    data = entity_dict(recipe)
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("code") or ""),
            str(data.get("name") or ""),
        ]
        if b
    )
    return data


def _batch_dict(batch: Any) -> dict[str, Any]:
    data = entity_dict(batch)
    status = data.get("status")
    data["status"] = status.value if hasattr(status, "value") else str(status or "")
    data["caption"] = " · ".join(
        b
        for b in [
            str(data.get("batch_number") or ""),
            str(data.get("recipe_name") or ""),
            str(data.get("status") or ""),
        ]
        if b
    )
    return data


def _build_recipe(body: RecipeCreate) -> Recipe:
    inputs = [
        RecipeInput(
            product_id=line.product_id,
            qty=float(line.qty or 0),
            product_name=line.product_name,
            unit=line.unit,
            scrap_pct=line.scrap_pct,
        )
        for line in body.inputs
        if line.product_id
    ]
    outputs = [
        RecipeOutput(
            product_id=line.product_id,
            expected_qty=float(line.expected_qty or line.qty or 0),
            product_name=line.product_name,
            unit=line.unit,
            role=ProductionOutputRole(line.role or ProductionOutputRole.MAIN.value),
            allocation_pct=line.allocation_pct,
            nrv_rate=line.nrv_rate,
        )
        for line in body.outputs
        if line.product_id
    ]
    if not outputs and body.output_product_id:
        outputs = [
            RecipeOutput(
                product_id=body.output_product_id,
                expected_qty=float(body.yield_qty or 1),
                role=ProductionOutputRole.MAIN,
            )
        ]
    if not inputs and body.output_product_id:
        # Minimal recipe for smoke tests: same product as input/output at base qty.
        inputs = [
            RecipeInput(product_id=body.output_product_id, qty=float(body.yield_qty or 1))
        ]
    stages = [
        RecipeStage(name=stage.name, sequence=stage.sequence, notes=stage.notes)
        for stage in body.stages
    ]
    return Recipe(
        name=body.name.strip(),
        code=body.code.strip(),
        description=body.description,
        base_quantity=float(body.base_quantity or 1),
        inputs=inputs,
        outputs=outputs,
        stages=stages,
        allocation_method=ProductionCostAllocationMethod(
            body.allocation_method or ProductionCostAllocationMethod.NRV.value
        ),
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "production", "status": "ok", "backend": _c().backend}


@router.get("/overview")
@router.get("/dashboard")
def overview() -> dict[str, Any]:
    try:
        summary = _c().production.dashboard_summary()
        summary["quick_actions"] = [
            {"to": "/production/recipes", "label": "Recipes"},
            {"to": "/production/batches", "label": "Batches"},
            {"to": "/production/day-book", "label": "Day Book"},
            {"to": "/production/margins", "label": "Margins"},
            {"to": "/production/yield", "label": "Yield"},
            {"to": "/production/reports", "label": "Reports"},
        ]
        return summary
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/recipes")
def list_recipes(*, active_only: bool = False) -> list[dict[str, Any]]:
    try:
        return [_recipe_dict(r) for r in _c().production.list_recipes(active_only=active_only)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/recipes", status_code=201)
def create_recipe(body: RecipeCreate) -> dict[str, Any]:
    try:
        recipe = _c().production.save_recipe(_build_recipe(body))
        return _recipe_dict(recipe)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: str) -> dict[str, Any]:
    recipe = _c().production.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="recipe not found")
    return _recipe_dict(recipe)


@router.patch("/recipes/{recipe_id}")
def patch_recipe(recipe_id: str, body: RecipePatch) -> dict[str, Any]:
    recipe = _c().production.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="recipe not found")
    try:
        if body.name is not None:
            recipe.name = body.name
        if body.code is not None:
            recipe.code = body.code
        if body.description is not None:
            recipe.description = body.description
        if body.base_quantity is not None:
            recipe.base_quantity = float(body.base_quantity)
        if body.allocation_method is not None:
            recipe.allocation_method = ProductionCostAllocationMethod(body.allocation_method)
        if body.is_active is not None:
            recipe.is_active = body.is_active
        if body.inputs is not None:
            recipe.inputs = [
                RecipeInput(
                    product_id=line.product_id,
                    qty=float(line.qty or 0),
                    product_name=line.product_name,
                    unit=line.unit,
                    scrap_pct=line.scrap_pct,
                )
                for line in body.inputs
            ]
        if body.outputs is not None:
            recipe.outputs = [
                RecipeOutput(
                    product_id=line.product_id,
                    expected_qty=float(line.expected_qty or line.qty or 0),
                    product_name=line.product_name,
                    unit=line.unit,
                    role=ProductionOutputRole(line.role or ProductionOutputRole.MAIN.value),
                    allocation_pct=line.allocation_pct,
                    nrv_rate=line.nrv_rate,
                )
                for line in body.outputs
            ]
        if body.stages is not None:
            recipe.stages = [
                RecipeStage(name=s.name, sequence=s.sequence, notes=s.notes)
                for s in body.stages
            ]
        return _recipe_dict(_c().production.save_recipe(recipe))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/recipes/{recipe_id}")
def delete_recipe(recipe_id: str) -> dict[str, Any]:
    try:
        _c().production.delete_recipe(recipe_id)
        return {"id": recipe_id, "deleted": True}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/batches")
def list_batches(*, status: Optional[str] = None) -> list[dict[str, Any]]:
    try:
        status_enum = ProductionBatchStatus(status) if status else None
        return [_batch_dict(b) for b in _c().production.list_batches(status_enum)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/batches", status_code=201)
def create_batch(body: BatchCreate) -> dict[str, Any]:
    batch_date = _parse_date(body.batch_date) or date.today()
    planned = float(body.planned_quantity or body.planned_qty or 1.0)
    number = (body.batch_number or "").strip() or f"PB-{uuid4().hex[:8].upper()}"
    try:
        batch = _c().production.create_batch(
            batch_number=number,
            recipe_id=body.recipe_id,
            batch_date=batch_date,
            location_id=body.location_id,
            planned_quantity=planned,
            notes=body.notes,
        )
        publish(
            "ProductionBatchStarted",
            {
                "batch_id": batch.id,
                "recipe_id": body.recipe_id,
                "planned_qty": planned,
                "status": batch.status.value
                if hasattr(batch.status, "value")
                else str(batch.status),
            },
        )
        return _batch_dict(batch)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/batches/{batch_id}")
def get_batch(batch_id: str) -> dict[str, Any]:
    batch = _c().production.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="batch not found")
    return _batch_dict(batch)


@router.post("/batches/{batch_id}/complete")
def complete_batch(batch_id: str, body: Optional[StageCompleteBody] = None) -> dict[str, Any]:
    """Complete a stage when stage_id is provided; otherwise save/advance to In Progress."""
    try:
        if body and body.stage_id:
            return _batch_dict(
                _c().production.complete_stage(batch_id, body.stage_id, notes=body.notes)
            )
        batch = _c().production.get_batch(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="batch not found")
        incomplete = [s for s in batch.stages if not s.completed]
        if incomplete:
            for stage in incomplete:
                batch = _c().production.complete_stage(batch_id, stage.id)
            return _batch_dict(batch)
        return _batch_dict(_c().production.save_batch(batch))
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/batches/{batch_id}/complete-stage")
def complete_stage(batch_id: str, body: StageCompleteBody) -> dict[str, Any]:
    try:
        return _batch_dict(
            _c().production.complete_stage(batch_id, body.stage_id, notes=body.notes)
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/batches/{batch_id}/post")
def post_batch(batch_id: str, body: PostBody | None = None) -> dict[str, Any]:
    try:
        posted_by = body.posted_by if body else "api"
        return _batch_dict(_c().production.post_batch(batch_id, posted_by=posted_by))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/batches/{batch_id}/cancel")
def cancel_batch(batch_id: str) -> dict[str, Any]:
    try:
        return _batch_dict(_c().production.cancel_batch(batch_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/batches/{batch_id}/costs", status_code=201)
def add_cost(batch_id: str, body: CostWrite) -> dict[str, Any]:
    try:
        cost = BatchCost(
            cost_type=body.cost_type,
            amount=body.amount,
            activity_id=body.activity_id,
            account_id=body.account_id,
            description=body.description,
        )
        return _batch_dict(_c().production.add_cost(batch_id, cost))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/batches/{batch_id}/costs/{cost_id}")
def remove_cost(batch_id: str, cost_id: str) -> dict[str, Any]:
    try:
        return _batch_dict(_c().production.remove_cost(batch_id, cost_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/day-book")
def day_book(
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict[str, Any]]:
    end = _parse_date(end_date) or date.today()
    start = _parse_date(start_date) or (end - timedelta(days=30))
    try:
        rows = _c().production.day_book(start, end)
        return [entity_dict(row) for row in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/margins")
def margins() -> list[dict[str, Any]]:
    try:
        rows = _c().reports.batch_margin_report()
        return [entity_dict(row) for row in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/yield")
def yield_report() -> list[dict[str, Any]]:
    try:
        rows = _c().reports.yield_variance_report()
        return [entity_dict(row) for row in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/reports/catalog")
@router.get("/reports")
def reports_catalog() -> dict[str, Any]:
    return {
        "reports": [
            {"id": r["id"], "title": r["title"], "category": "Production"}
            for r in REPORT_CATALOG
        ],
        "report_types": [r["title"] for r in REPORT_CATALOG],
    }


@router.post("/reports/run")
def run_report(body: ReportRunBody) -> dict[str, Any]:
    key = (body.report_id or body.report_type or "").strip()
    match = next(
        (
            r
            for r in REPORT_CATALOG
            if r["id"] == key or r["title"] == key or r["method"] == key
        ),
        None,
    )
    if not match:
        raise HTTPException(status_code=400, detail=f"Unknown report: {key}")
    try:
        method = getattr(_c().reports, match["method"])
        rows = method(body.filters or {})
        return {
            "report_id": match["id"],
            "report_type": match["title"],
            "rows": [entity_dict(row) for row in rows],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/settings")
def get_settings() -> dict[str, Any]:
    try:
        return entity_dict(_c().production.get_settings())
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/settings")
def patch_settings(body: SettingsPatch) -> dict[str, Any]:
    try:
        settings = _c().production.get_settings()
        data = body.model_dump(exclude_unset=True)
        for key, value in data.items():
            if key == "default_allocation_method" and value is not None:
                settings.default_allocation_method = ProductionCostAllocationMethod(value)
            elif hasattr(settings, key) and value is not None:
                setattr(settings, key, value)
        if not isinstance(settings, ProductionSettings):
            settings = ProductionSettings(**entity_dict(settings))
        return entity_dict(_c().production.save_settings(settings))
    except Exception as exc:
        raise _http_err(exc) from exc
