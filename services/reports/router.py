"""Reports stub — projected report data placeholder."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "reports", "status": "ok"}


@router.get("/catalog")
def catalog() -> dict[str, object]:
    return {
        "reports": [
            {"id": "sales_summary", "title": "Sales Summary"},
            {"id": "stock_on_hand", "title": "Stock On Hand"},
            {"id": "trial_balance", "title": "Trial Balance"},
        ]
    }
