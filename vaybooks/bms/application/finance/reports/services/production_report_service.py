from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Optional

from vaybooks.bms.domain.shared.enums import ProductionBatchStatus


class ProductionReportService:
    def __init__(self, production_service: Any) -> None:
        self._production = production_service

    @staticmethod
    def _range(filters: Any) -> tuple[Optional[date], Optional[date]]:
        if filters is None:
            return None, None
        value = (
            filters.get("date_range")
            if isinstance(filters, dict)
            else getattr(filters, "date_range", None)
        )
        if isinstance(value, (list, tuple)) and len(value) == 2:
            return value[0], value[1]
        return None, None

    def _batches(self, filters: Any = None):
        start, end = self._range(filters)
        batch_id = (
            str(filters.get("batch_id") or "")
            if isinstance(filters, dict)
            else str(getattr(filters, "batch_id", "") or "")
        )
        recipe_id = (
            str(filters.get("recipe_id") or "")
            if isinstance(filters, dict)
            else str(getattr(filters, "recipe_id", "") or "")
        )
        location_id = (
            str(filters.get("location_id") or "")
            if isinstance(filters, dict)
            else str(getattr(filters, "location_id", "") or "")
        )
        rows = self._production.list_batches()
        return [
            batch
            for batch in rows
            if (not batch_id or batch.id == batch_id)
            and (not recipe_id or batch.recipe_id == recipe_id)
            and (not location_id or batch.location_id == location_id)
            and (not start or batch.batch_date >= start)
            and (not end or batch.batch_date <= end)
        ]

    def batch_register_report(self, filters: Any = None) -> list[dict]:
        return [
            {
                "date": batch.batch_date,
                "batch_number": batch.batch_number,
                "recipe": batch.recipe_name,
                "status": batch.status.value,
                "planned_quantity": batch.planned_quantity,
                "material_cost": batch.material_cost,
                "expense_cost": batch.expense_cost,
                "total_cost": batch.total_cost,
                "expected_sales_value": batch.expected_sales_value,
                "margin": batch.batch_margin,
            }
            for batch in self._batches(filters)
        ]

    def batch_cost_sheet_report(self, filters: Any = None) -> list[dict]:
        rows = []
        for batch in self._batches(filters):
            for output in batch.outputs:
                rows.append(
                    {
                        "date": batch.batch_date,
                        "batch_number": batch.batch_number,
                        "recipe": batch.recipe_name,
                        "output": output.product_name,
                        "role": output.role.value,
                        "quantity": output.qty,
                        "allocated_cost": output.allocated_cost,
                        "cost_per_unit": output.unit_cost,
                        "nrv_rate": output.nrv_rate,
                    }
                )
        return rows

    def batch_margin_report(self, filters: Any = None) -> list[dict]:
        return [
            {
                "date": batch.batch_date,
                "batch_number": batch.batch_number,
                "recipe": batch.recipe_name,
                "total_cost": batch.total_cost,
                "expected_sales_value": batch.expected_sales_value,
                "margin": batch.batch_margin,
                "margin_pct": (
                    round(batch.batch_margin / batch.expected_sales_value * 100, 2)
                    if batch.expected_sales_value
                    else 0
                ),
            }
            for batch in self._batches(filters)
            if batch.status == ProductionBatchStatus.POSTED
        ]

    def yield_variance_report(self, filters: Any = None) -> list[dict]:
        rows = []
        for batch in self._batches(filters):
            recipe = self._production.get_recipe(batch.recipe_id)
            if not recipe:
                continue
            scale = batch.planned_quantity / recipe.base_quantity
            expected = {
                line.product_id: float(line.expected_qty) * scale
                for line in recipe.outputs
            }
            for output in batch.outputs:
                expected_qty = expected.get(output.product_id, 0)
                variance = float(output.qty) - expected_qty
                rows.append(
                    {
                        "date": batch.batch_date,
                        "batch_number": batch.batch_number,
                        "output": output.product_name,
                        "expected_qty": expected_qty,
                        "actual_qty": output.qty,
                        "variance": variance,
                        "variance_pct": (
                            round(variance / expected_qty * 100, 2)
                            if expected_qty
                            else 0
                        ),
                    }
                )
        return rows

    def production_expense_report(self, filters: Any = None) -> list[dict]:
        rows = []
        for batch in self._batches(filters):
            activity_names = {stage.id: stage.name for stage in batch.stages}
            for cost in batch.costs:
                rows.append(
                    {
                        "date": batch.batch_date,
                        "batch_number": batch.batch_number,
                        "cost_type": cost.cost_type,
                        "activity": activity_names.get(cost.activity_id, ""),
                        "description": cost.description,
                        "amount": cost.amount,
                    }
                )
        return rows

    def output_summary_report(self, filters: Any = None) -> list[dict]:
        totals: dict[str, dict] = {}
        for batch in self._batches(filters):
            for output in batch.outputs:
                row = totals.setdefault(
                    output.product_id,
                    {
                        "product": output.product_name,
                        "quantity": 0.0,
                        "allocated_cost": 0.0,
                        "expected_value": 0.0,
                    },
                )
                row["quantity"] += float(output.qty)
                row["allocated_cost"] += float(output.allocated_cost)
                row["expected_value"] += float(output.qty) * float(output.nrv_rate)
        return list(totals.values())

    def rm_consumption_report(self, filters: Any = None) -> list[dict]:
        totals: dict[str, dict] = {}
        for batch in self._batches(filters):
            for issue in batch.issues:
                row = totals.setdefault(
                    issue.product_id,
                    {
                        "product": issue.product_name,
                        "quantity": 0.0,
                        "total_cost": 0.0,
                    },
                )
                row["quantity"] += float(issue.qty)
                row["total_cost"] += float(issue.total_cost)
        return list(totals.values())

    def wip_open_batches_report(self, filters: Any = None) -> list[dict]:
        return [
            {
                "date": batch.batch_date,
                "batch_number": batch.batch_number,
                "recipe": batch.recipe_name,
                "status": batch.status.value,
                "wip_value": batch.total_cost,
                "age_days": (date.today() - batch.batch_date).days,
            }
            for batch in self._batches(filters)
            if batch.status
            in {ProductionBatchStatus.DRAFT, ProductionBatchStatus.IN_PROGRESS}
        ]

    def cost_per_unit_trend_report(self, filters: Any = None) -> list[dict]:
        return [
            {
                "date": batch.batch_date,
                "batch_number": batch.batch_number,
                "product": output.product_name,
                "quantity": output.qty,
                "cost_per_unit": output.unit_cost,
            }
            for batch in self._batches(filters)
            for output in batch.outputs
            if batch.status == ProductionBatchStatus.POSTED
        ]

    def recipe_master_report(self, filters: Any = None) -> list[dict]:
        return [
            {
                "code": recipe.code,
                "name": recipe.name,
                "base_quantity": recipe.base_quantity,
                "allocation_method": recipe.allocation_method.value,
                "inputs": len(recipe.inputs),
                "outputs": len(recipe.outputs),
                "activities": len(recipe.stages),
                "active": recipe.is_active,
            }
            for recipe in self._production.list_recipes(active_only=False)
        ]

    def profitability_summary(self, filters: Any = None) -> dict:
        batches = self._batches(filters)
        posted = [
            batch for batch in batches if batch.status == ProductionBatchStatus.POSTED
        ]
        open_batches = [
            batch
            for batch in batches
            if batch.status
            in {ProductionBatchStatus.DRAFT, ProductionBatchStatus.IN_PROGRESS}
        ]
        total_cost = round(sum(float(batch.total_cost) for batch in posted), 2)
        expected_sales = round(
            sum(float(batch.expected_sales_value) for batch in posted), 2
        )
        margin = round(sum(float(batch.batch_margin) for batch in posted), 2)
        return {
            "batch_count": len(batches),
            "posted_count": len(posted),
            "open_count": len(open_batches),
            "total_cost": total_cost,
            "expected_sales_value": expected_sales,
            "margin": margin,
            "margin_pct": round(margin / expected_sales * 100, 2) if expected_sales else 0,
            "wip_value": round(sum(float(batch.total_cost) for batch in open_batches), 2),
        }

    def recipe_scorecards(self, filters: Any = None) -> list[dict]:
        posted = [
            batch
            for batch in self._batches(filters)
            if batch.status == ProductionBatchStatus.POSTED
        ]
        by_recipe: dict[str, dict] = {}
        for batch in posted:
            row = by_recipe.setdefault(
                batch.recipe_id,
                {
                    "recipe_id": batch.recipe_id,
                    "recipe": batch.recipe_name,
                    "batch_count": 0,
                    "total_cost": 0.0,
                    "expected_sales_value": 0.0,
                    "margin": 0.0,
                    "yield_variance_pct_sum": 0.0,
                    "yield_samples": 0,
                    "unit_cost_sum": 0.0,
                    "unit_cost_samples": 0,
                },
            )
            row["batch_count"] += 1
            row["total_cost"] += float(batch.total_cost)
            row["expected_sales_value"] += float(batch.expected_sales_value)
            row["margin"] += float(batch.batch_margin)

            recipe = self._production.get_recipe(batch.recipe_id)
            if recipe and recipe.base_quantity:
                scale = float(batch.planned_quantity) / float(recipe.base_quantity)
                expected = {
                    line.product_id: float(line.expected_qty) * scale
                    for line in recipe.outputs
                }
                for output in batch.outputs:
                    expected_qty = expected.get(output.product_id, 0)
                    if expected_qty:
                        variance_pct = (
                            (float(output.qty) - expected_qty) / expected_qty * 100
                        )
                        row["yield_variance_pct_sum"] += variance_pct
                        row["yield_samples"] += 1
                    if float(output.qty) > 0:
                        row["unit_cost_sum"] += float(output.unit_cost)
                        row["unit_cost_samples"] += 1

        rows = []
        for row in by_recipe.values():
            sales = float(row["expected_sales_value"])
            margin = float(row["margin"])
            rows.append(
                {
                    "recipe_id": row["recipe_id"],
                    "recipe": row["recipe"],
                    "batch_count": row["batch_count"],
                    "total_cost": round(row["total_cost"], 2),
                    "expected_sales_value": round(sales, 2),
                    "margin": round(margin, 2),
                    "margin_pct": round(margin / sales * 100, 2) if sales else 0,
                    "avg_yield_variance_pct": (
                        round(
                            row["yield_variance_pct_sum"] / row["yield_samples"],
                            2,
                        )
                        if row["yield_samples"]
                        else 0
                    ),
                    "avg_cost_per_unit": (
                        round(row["unit_cost_sum"] / row["unit_cost_samples"], 4)
                        if row["unit_cost_samples"]
                        else 0
                    ),
                }
            )
        return sorted(rows, key=lambda item: item["margin"], reverse=True)

    def material_variance_report(self, filters: Any = None) -> list[dict]:
        rows = []
        for batch in self._batches(filters):
            recipe = self._production.get_recipe(batch.recipe_id)
            if not recipe or not recipe.base_quantity:
                continue
            scale = float(batch.planned_quantity) / float(recipe.base_quantity)
            expected = {
                line.product_id: round(
                    float(line.qty)
                    * scale
                    * (1.0 + max(0.0, float(line.scrap_pct or 0)) / 100.0),
                    4,
                )
                for line in recipe.inputs
            }
            names = {line.product_id: line.product_name for line in recipe.inputs}
            for issue in batch.issues:
                expected_qty = expected.get(issue.product_id, 0)
                actual = float(issue.qty)
                variance = actual - expected_qty
                rows.append(
                    {
                        "date": batch.batch_date,
                        "batch_number": batch.batch_number,
                        "recipe": batch.recipe_name,
                        "product": issue.product_name or names.get(issue.product_id, ""),
                        "expected_qty": expected_qty,
                        "actual_qty": actual,
                        "variance": round(variance, 4),
                        "variance_pct": (
                            round(variance / expected_qty * 100, 2) if expected_qty else 0
                        ),
                    }
                )
        return rows

    def product_profitability_report(self, filters: Any = None) -> list[dict]:
        totals: dict[str, dict] = {}
        for batch in self._batches(filters):
            if batch.status != ProductionBatchStatus.POSTED:
                continue
            for output in batch.outputs:
                row = totals.setdefault(
                    output.product_id,
                    {
                        "product_id": output.product_id,
                        "product": output.product_name,
                        "qty_produced": 0.0,
                        "production_cost": 0.0,
                        "expected_sales_value": 0.0,
                        "qty_sold": 0.0,
                        "sales_value": 0.0,
                    },
                )
                row["qty_produced"] += float(output.qty)
                row["production_cost"] += float(output.allocated_cost)
                row["expected_sales_value"] += float(output.qty) * float(output.nrv_rate)

        sold = self._sales_by_product(filters)
        for product_id, sale in sold.items():
            row = totals.setdefault(
                product_id,
                {
                    "product_id": product_id,
                    "product": sale.get("product") or product_id,
                    "qty_produced": 0.0,
                    "production_cost": 0.0,
                    "expected_sales_value": 0.0,
                    "qty_sold": 0.0,
                    "sales_value": 0.0,
                },
            )
            if not row["product"] or row["product"] == product_id:
                row["product"] = sale.get("product") or row["product"]
            row["qty_sold"] += float(sale.get("qty") or 0)
            row["sales_value"] += float(sale.get("value") or 0)

        rows = []
        for row in totals.values():
            cost = float(row["production_cost"])
            expected_sales = float(row["expected_sales_value"])
            sales_value = float(row["sales_value"])
            qty_sold = float(row["qty_sold"])
            # Realized margin when sales exist; otherwise expected NRV margin.
            if qty_sold > 0 or sales_value > 0:
                # COGS for sold qty at average production unit cost
                unit_cost = (
                    cost / float(row["qty_produced"]) if row["qty_produced"] else 0
                )
                cogs = round(unit_cost * qty_sold, 2)
                margin = round(sales_value - cogs, 2)
                margin_base = sales_value
            else:
                cogs = cost
                margin = round(expected_sales - cost, 2)
                margin_base = expected_sales
            rows.append(
                {
                    "product_id": row["product_id"],
                    "product": row["product"],
                    "qty_produced": round(row["qty_produced"], 4),
                    "production_cost": round(cost, 2),
                    "expected_sales_value": round(expected_sales, 2),
                    "qty_sold": round(qty_sold, 4),
                    "sales_value": round(sales_value, 2),
                    "cogs": cogs,
                    "margin": margin,
                    "margin_pct": round(margin / margin_base * 100, 2) if margin_base else 0,
                    "cost_per_unit": (
                        round(cost / row["qty_produced"], 4)
                        if row["qty_produced"]
                        else 0
                    ),
                }
            )
        return sorted(rows, key=lambda item: item["margin"], reverse=True)

    def _sales_by_product(self, filters: Any = None) -> dict[str, dict]:
        """Aggregate sold qty/value from sales invoices in the filter period."""
        accounting = getattr(self._production, "_accounting", None)
        if accounting is None or not hasattr(accounting, "list_vouchers_by_type"):
            return {}
        try:
            from vaybooks.bms.domain.sales.line_items import parse_sales_line_items_note
            from vaybooks.bms.domain.shared.enums import VoucherType
        except Exception:
            return {}

        start, end = self._range(filters)
        sold: dict[str, dict] = {}
        try:
            vouchers = accounting.list_vouchers_by_type(VoucherType.SALES_INVOICE)
        except Exception:
            return {}
        for voucher in vouchers:
            sale_date = getattr(voucher, "voucher_date", None)
            if hasattr(sale_date, "date") and callable(sale_date.date):
                try:
                    sale_date = sale_date.date()
                except Exception:
                    pass
            if start and sale_date and sale_date < start:
                continue
            if end and sale_date and sale_date > end:
                continue
            items, _, _ = parse_sales_line_items_note(getattr(voucher, "description", "") or "")
            for item in items:
                product_id = str(item.get("product_id") or "").strip()
                if not product_id:
                    continue
                qty = float(item.get("qty") or 0)
                value = float(
                    item.get("line_total")
                    or item.get("taxable_amount")
                    or (qty * float(item.get("rate") or 0))
                )
                row = sold.setdefault(
                    product_id,
                    {
                        "product": item.get("item_name")
                        or item.get("description")
                        or product_id,
                        "qty": 0.0,
                        "value": 0.0,
                    },
                )
                row["qty"] += qty
                row["value"] += value
        return sold

    @staticmethod
    def to_csv(rows: list[dict]) -> str:
        if not rows:
            return ""
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
        return stream.getvalue()
