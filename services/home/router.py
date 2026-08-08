"""Home dashboard — aggregate KPIs from ReportAppService + module containers."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from packages.services_kit.reports_container import get_reports_container
from services.parties.serialize import entity_dict

router = APIRouter(prefix="/api/home", tags=["home"])


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return default


def _module_kpis() -> dict[str, Any]:
    """Compose lightweight KPIs from available module containers."""
    extra: dict[str, Any] = {}
    try:
        from packages.services_kit.finance_container import get_finance_container

        fin = get_finance_container()
        accounts = fin.account_repo.list_all() if hasattr(fin.account_repo, "list_all") else []
        extra["finance_accounts"] = len(list(accounts) if accounts is not None else [])
    except Exception:
        pass
    try:
        from packages.services_kit.sales_container import get_sales_container

        sales = get_sales_container().sales
        orders = (
            sales.list_sales_orders()
            if hasattr(sales, "list_sales_orders")
            else []
        )
        extra["sales_orders"] = len(list(orders) if orders is not None else [])
    except Exception:
        pass
    try:
        from packages.services_kit.purchases_container import get_purchases_container

        purchases = get_purchases_container().purchases
        pos = (
            purchases.list_purchase_orders()
            if hasattr(purchases, "list_purchase_orders")
            else []
        )
        extra["purchase_orders"] = len(list(pos) if pos is not None else [])
    except Exception:
        pass
    try:
        from packages.services_kit.boutique_container import get_boutique_container

        boutique = get_boutique_container()
        orders = boutique.orders.list_orders() if hasattr(boutique.orders, "list_orders") else []
        extra["boutique_active_orders"] = len(list(orders) if orders is not None else [])
    except Exception:
        pass
    try:
        from packages.services_kit.crm_container import get_crm_container

        dash = get_crm_container().dashboard
        summary = dash.snapshot() if hasattr(dash, "snapshot") else None
        if isinstance(summary, dict):
            extra["crm_active_leads"] = _safe_int(
                summary.get("total_active_leads") or summary.get("active_leads")
            )
        elif summary is not None:
            data = entity_dict(summary)
            extra["crm_active_leads"] = _safe_int(
                data.get("total_active_leads") or data.get("active_leads")
            )
    except Exception:
        pass
    return extra


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "module": "home",
        "status": "ok",
        "backend": get_reports_container().backend,
    }


@router.get("/dashboard")
def dashboard() -> dict[str, object]:
    reports = get_reports_container().reports
    summary = reports.get_dashboard_summary()
    data = entity_dict(summary)
    metrics = {
        "active_orders": _safe_int(data.get("active_orders")),
        "pending_activity_orders": _safe_int(data.get("pending_activity_orders")),
        "completed_orders": _safe_int(data.get("completed_orders")),
        "delivered_this_month": _safe_int(data.get("delivered_this_month")),
        "total_invoice_this_month": _safe_float(data.get("total_invoice_this_month")),
        "total_advance_this_month": _safe_float(data.get("total_advance_this_month")),
        "total_pending_activities": _safe_int(data.get("total_pending_activities")),
        "inventory_active_products": _safe_int(data.get("inventory_active_products")),
        "inventory_low_stock_count": _safe_int(data.get("inventory_low_stock_count")),
        "inventory_stock_value": _safe_float(data.get("inventory_stock_value")),
        "order_count": _safe_int(data.get("active_orders")),
        "revenue": _safe_float(data.get("total_invoice_this_month")),
    }
    metrics.update(_module_kpis())
    return {
        "status": "ok",
        "metrics": metrics,
        "summary": data,
        "source": "report_app_service",
    }


@router.get("/mtd")
def mtd_dashboard() -> dict[str, object]:
    """Month-to-date view — same summary focused on MTD fields."""
    body = dashboard()
    metrics = body.get("metrics") or {}
    return {
        "status": "ok",
        "metrics": {
            "delivered_this_month": metrics.get("delivered_this_month", 0),
            "total_invoice_this_month": metrics.get("total_invoice_this_month", 0),
            "total_advance_this_month": metrics.get("total_advance_this_month", 0),
            "inventory_movements_this_month": (body.get("summary") or {}).get(
                "inventory_movements_this_month", 0
            ),
            "revenue": metrics.get("revenue", 0),
        },
        "source": "report_app_service",
    }
