"""Catalog of optional demo/test seed packs for the interactive seed master."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from pymongo.database import Database

SeedRunner = Callable[[Database], dict[str, Any]]


@dataclass(frozen=True)
class SeedPack:
    id: str
    title: str
    description: str
    marker: str
    how_to_verify: str
    run: SeedRunner


def _run_category_analytics(db: Database) -> dict[str, Any]:
    from vaybooks.bms.infrastructure.db.category_analytics_seed import (
        run_category_analytics_seed,
    )

    return run_category_analytics_seed(db)


def _run_core_seed(db: Database) -> dict[str, Any]:
    from vaybooks.bms.infrastructure.db.seed import run_seed

    run_seed(db)
    return {
        "marker": "CORE-SEED",
        "note": "Baseline activities, CoA, counters, units, locations",
    }


def _run_qa_fixtures(db: Database) -> dict[str, Any]:
    from vaybooks.bms.infrastructure.db.qa_fixtures import (
        ORDER_NUMBER,
        QA_PINNED_ORDER_NUMBERS,
        run_qa_fixtures,
    )

    run_qa_fixtures(db)
    return {
        "marker": "QA-FIXTURES",
        "pinned_orders": list(QA_PINNED_ORDER_NUMBERS),
        "primary_order": ORDER_NUMBER,
    }


def _run_finance_demo(db: Database) -> dict[str, Any]:
    from vaybooks.bms.infrastructure.config.settings import get_settings
    from vaybooks.bms.infrastructure.db.finance_seed import DEMO_PREFIX, seed_finance_demo

    seed_finance_demo(db, get_settings())
    return {
        "marker": DEMO_PREFIX,
        "note": "Demo finance vouchers for Finance UI surfaces",
    }


def _run_product_sku_analytics(db: Database) -> dict[str, Any]:
    from vaybooks.bms.infrastructure.db.product_sku_analytics_seed import (
        run_product_sku_analytics_seed,
    )

    return run_product_sku_analytics_seed(db)


SEED_PACKS: tuple[SeedPack, ...] = (
    SeedPack(
        id="category_analytics",
        title="Category analytics",
        description=(
            "Demo Analytics Wear + 8 products, multi-month sales / production / "
            "customization for category breakdown charts."
        ),
        marker="CAT-ANALYTICS",
        how_to_verify="Inventory -> Categories -> Demo Analytics Wear -> Sales/Production/Customization",
        run=_run_category_analytics,
    ),
    SeedPack(
        id="product_sku_analytics",
        title="Product / SKU analytics",
        description=(
            "Demo Linen Shirt catalog + Size M/L SKUs with multi-month sales, "
            "posted GRNs, production outputs, linked customization, and a "
            "catalog-scoped discount for Product/SKU 360 tabs."
        ),
        marker="PROD-SKU-ANALYTICS",
        how_to_verify=(
            "Inventory -> Products -> Demo Linen Shirt (Sales/Purchase/Production/"
            "Customization) and Inventory -> SKUs (PSA-LINEN-M/L)"
        ),
        run=_run_product_sku_analytics,
    ),
    SeedPack(
        id="core",
        title="Core reference seed",
        description="Baseline catalog data: activities, chart of accounts, counters, units, locations.",
        marker="CORE-SEED",
        how_to_verify="App starts with CoA / units / locations present",
        run=_run_core_seed,
    ),
    SeedPack(
        id="qa_fixtures",
        title="Boutique QA fixtures",
        description="Pinned boutique orders/invoices used by QA and export test cases.",
        marker="QA-FIXTURES",
        how_to_verify="Boutique -> Orders (O-1001, O-1002, O-1004, ZC-2024-0061)",
        run=_run_qa_fixtures,
    ),
    SeedPack(
        id="finance_demo",
        title="Finance demo vouchers",
        description="Tagged [demo-finance] AR/AP/receipt/payment vouchers for Finance UI.",
        marker="[demo-finance]",
        how_to_verify="Finance module lists with [demo-finance] descriptions",
        run=_run_finance_demo,
    ),
)


def pack_by_id(pack_id: str) -> SeedPack | None:
    for pack in SEED_PACKS:
        if pack.id == pack_id:
            return pack
    return None


def packs_by_ids(pack_ids: list[str]) -> list[SeedPack]:
    found: list[SeedPack] = []
    for pack_id in pack_ids:
        pack = pack_by_id(pack_id)
        if pack:
            found.append(pack)
    return found
