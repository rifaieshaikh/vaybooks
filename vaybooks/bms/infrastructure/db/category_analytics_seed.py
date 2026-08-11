"""Idempotent multi-month demo data for category Sales/Production/Customization analytics.

Test/QA only — not run from Streamlit bootstrap or schema migrations.

  python -m vaybooks.bms.infrastructure.db.category_analytics_seed
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

from vaybooks.bms.application.finance.accounting.service import AccountingAppService
from vaybooks.bms.application.inventory.service import InventoryAppService
from vaybooks.bms.application.parties.customers.service import CustomerAppService
from vaybooks.bms.application.sales.service import SalesAppService
from vaybooks.bms.domain.boutique.orders.entities import CustomizationItem, CustomizationOrder
from vaybooks.bms.domain.inventory.entities import ProductCategory
from vaybooks.bms.domain.inventory.rate_history_service import ProductRateHistoryService
from vaybooks.bms.domain.parties.customers.entities import CustomerInput
from vaybooks.bms.domain.production.entities import BatchOutput, ProductionBatch
from vaybooks.bms.domain.shared.enums import (
    AccountType,
    CustomizationItemStatus,
    OrderStatus,
    ProductionBatchStatus,
    ProductionOutputRole,
    StockMovementType,
    VoucherType,
)
from vaybooks.bms.infrastructure.db.location_seed import ensure_default_locations
from vaybooks.bms.infrastructure.repositories.boutique.mongo_order_repository import (
    MongoOrderRepository,
)
from vaybooks.bms.infrastructure.repositories.finance.mongo_accounting_repository import (
    MongoAccountRepository,
    MongoVoucherRepository,
)
from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
    MongoCounterRepository,
)
from vaybooks.bms.infrastructure.repositories.inventory.mongo_inventory_repository import (
    MongoInventoryProductRepository,
    MongoProductCategoryRepository,
    MongoProductFieldDefinitionRepository,
    MongoProductUnitRepository,
    MongoStockMovementRepository,
    MongoWarehouseRepository,
)
from vaybooks.bms.infrastructure.repositories.inventory.mongo_product_rate_history_repository import (
    MongoProductRateHistoryRepository,
)
from vaybooks.bms.infrastructure.repositories.parties.mongo_customer_repository import (
    MongoCustomerRepository,
)
from vaybooks.bms.infrastructure.repositories.production import MongoProductionBatchRepository
from vaybooks.bms.infrastructure.repositories.sales.mongo_customer_price_repository import (
    MongoCustomerPriceRepository,
)
from vaybooks.bms.infrastructure.repositories.sales.mongo_sales_repository import (
    MongoDeliveryNoteRepository,
    MongoEstimateRepository,
    MongoQuotationRepository,
    MongoSalesOrderRepository,
    MongoSalesReturnRepository,
)

if TYPE_CHECKING:
    from pymongo.database import Database

logger = logging.getLogger("vaybooks.bms.category_analytics_seed")

MARKER = "CAT-ANALYTICS"
CATEGORY_NAME = "Demo Analytics Wear"
CUSTOMERS = (
    ("9000000088", f"{MARKER} Customer A"),
    ("9000000089", f"{MARKER} Customer B"),
    ("9000000090", f"{MARKER} Customer C"),
)
PRODUCT_SPECS = (
    ("CAT-TEE", "Analytics Tee", 450.0),
    ("CAT-KURTA", "Analytics Kurta", 890.0),
    ("CAT-DUP", "Analytics Dupatta", 320.0),
    ("CAT-SHIRT", "Analytics Shirt", 620.0),
    ("CAT-PALAZZO", "Analytics Palazzo", 780.0),
    ("CAT-JACKET", "Analytics Jacket", 1450.0),
    ("CAT-SKIRT", "Analytics Skirt", 540.0),
    ("CAT-STOLE", "Analytics Stole", 280.0),
)
MONTHS_BACK = 12
SALES_PER_MONTH = 3
PRODUCTION_PER_MONTH = 2
CUSTOMIZATION_PER_MONTH = 2


def _ensure_account(
    accounting: AccountingAppService,
    name: str,
    account_type: AccountType,
    *,
    is_store_account: bool = False,
):
    existing = accounting.get_account_by_name(name)
    if existing:
        if is_store_account and not getattr(existing, "is_store_account", False):
            return accounting.set_store_account(existing.id, True)
        return existing
    return accounting.create_account(name, account_type.value, is_store_account=is_store_account)


def _services(db: Database):
    account_repo = MongoAccountRepository(db)
    voucher_repo = MongoVoucherRepository(db)
    counter_repo = MongoCounterRepository(db)
    customer_repo = MongoCustomerRepository(db)
    accounting = AccountingAppService(account_repo, voucher_repo, counter_repo)
    customers = CustomerAppService(customer_repo, account_repo)
    rate_history = ProductRateHistoryService(
        MongoProductRateHistoryRepository(db, "product_selling_rate_history"),
        MongoProductRateHistoryRepository(db, "product_mrp_history"),
        MongoProductRateHistoryRepository(db, "product_gst_rate_history"),
    )
    inventory = InventoryAppService(
        MongoProductCategoryRepository(db),
        MongoInventoryProductRepository(db),
        MongoStockMovementRepository(db),
        MongoProductUnitRepository(db),
        MongoProductFieldDefinitionRepository(db),
        rate_history,
        MongoWarehouseRepository(db),
    )
    sales = SalesAppService(
        MongoSalesOrderRepository(db),
        MongoDeliveryNoteRepository(db),
        MongoSalesReturnRepository(db),
        counter_repo,
        accounting,
        inventory,
        customer_service=customers,
        estimate_repo=MongoEstimateRepository(db),
        quotation_repo=MongoQuotationRepository(db),
        customer_price_repo=MongoCustomerPriceRepository(db),
    )
    return accounting, customers, inventory, sales


def _shift_month(base: date, months_ago: int) -> date:
    year = base.year
    month = base.month - months_ago
    while month <= 0:
        month += 12
        year -= 1
    day = min(base.day, 28)
    return date(year, month, day)


def _activity_dates() -> list[date]:
    """Several dated points per month across MONTHS_BACK months."""
    today = date.today()
    days: list[date] = []
    for months_ago in range(MONTHS_BACK - 1, -1, -1):
        month_anchor = _shift_month(today.replace(day=1), months_ago)
        for day_offset in (3, 12, 21):
            days.append(date(month_anchor.year, month_anchor.month, min(day_offset, 28)))
    return days


def _product_rate(product) -> float:
    return float(
        getattr(product, "selling_rate", None)
        or getattr(product, "active_selling_rate", None)
        or 100
    )


def _top_up_stock(inventory: InventoryAppService, products, location_id: str, target_qty: float = 500.0) -> None:
    """Ensure each demo product has enough on-hand qty for dense sales seeding."""
    for product in products:
        current = float(getattr(product, "current_qty", 0) or 0)
        if current >= target_qty:
            continue
        need = round(target_qty - current, 2)
        try:
            inventory.record_manual_movement(
                product.id,
                StockMovementType.RECEIVE,
                need,
                date.today(),
                notes=f"{MARKER} stock top-up",
                location_id=location_id,
            )
        except Exception as exc:
            logger.warning("Stock top-up failed for %s: %s", product.sku, exc)


def _ensure_category_and_products(
    inventory: InventoryAppService, db: Database, location_id: str
):
    category_repo = MongoProductCategoryRepository(db)
    category = category_repo.find_by_name(CATEGORY_NAME)
    if category is None:
        category = ProductCategory(
            name=CATEGORY_NAME,
            description=f"{MARKER} demo category for breakdown analytics",
            is_active=True,
        )
        category = category_repo.save(category)

    unit = inventory.find_or_create_unit("pcs", "Pieces")
    by_sku = {
        str(getattr(row, "sku", "")).upper(): row
        for row in inventory.list_products(active_only=False)
    }
    products = []
    for sku, name, rate in PRODUCT_SPECS:
        product = by_sku.get(sku)
        if product is None:
            product = inventory.create_product(
                sku,
                name,
                category.id,
                opening_qty=250,
                unit_id=unit.id,
                selling_rate=rate,
                mrp=rate,
                hsn_sac="6204",
                gst_rate=5.0,
                location_id=location_id,
            )
        elif category.id not in (product.category_ids or []):
            inventory.add_products_to_category(category.id, [product.id])
            product = inventory.get_product(product.id)
        products.append(product)
    return category, [p for p in products if p]


def _ensure_customers(customers: CustomerAppService, location_ids: list[str]):
    out = []
    for phone, name in CUSTOMERS:
        existing = customers._customer_repo.find_by_phone(phone)
        if existing:
            out.append(existing)
            continue
        out.append(
            customers.create_customer(
                CustomerInput(
                    customer_name=name,
                    phone_number=phone,
                    location_ids=list(location_ids),
                )
            )
        )
    return out


def _seed_sales(
    sales: SalesAppService,
    accounting: AccountingAppService,
    customer_list,
    products,
    location_id: str,
) -> int:
    cash = _ensure_account(accounting, "Cash Drawer", AccountType.ASSET, is_store_account=True)
    _ensure_account(accounting, "Sales", AccountType.REVENUE)

    existing_numbers = {
        str(getattr(v, "store_invoice_number", "") or "")
        for v in accounting.list_vouchers_by_type(VoucherType.SALES_INVOICE)
        if MARKER in str(getattr(v, "store_invoice_number", "") or "")
    }

    created = 0
    # One invoice per activity date × SALES_PER_MONTH slots → denser trend
    for date_idx, voucher_day in enumerate(_activity_dates()):
        for slot in range(SALES_PER_MONTH):
            invoice_no = f"{MARKER}-INV-{voucher_day.strftime('%Y%m%d')}-S{slot + 1}"
            if invoice_no in existing_numbers:
                continue
            customer = customer_list[(date_idx + slot) % len(customer_list)]
            customer_account = accounting.get_customer_account(customer.id)
            if not customer_account:
                logger.warning("No AR account for customer %s", customer.id)
                continue

            p0 = products[(date_idx + slot) % len(products)]
            p1 = products[(date_idx + slot + 2) % len(products)]
            q0 = float(1 + ((date_idx + slot) % 5))
            q1 = float(1 + ((date_idx + slot * 2) % 3))
            r0 = _product_rate(p0)
            r1 = _product_rate(p1)
            gross = round(q0 * r0 + q1 * r1, 2)
            try:
                sales.create_direct_sale(
                    customer_account_id=customer_account.id,
                    store_account_id=cash.id,
                    gross_amount=gross,
                    discount_amount=0,
                    amount_received=gross,
                    store_invoice_number=invoice_no,
                    line_items=[
                        {
                            "product_id": p0.id,
                            "qty": q0,
                            "rate": r0,
                            "description": f"{MARKER} {p0.name}",
                            "location_id": location_id,
                        },
                        {
                            "product_id": p1.id,
                            "qty": q1,
                            "rate": r1,
                            "description": f"{MARKER} {p1.name}",
                            "location_id": location_id,
                        },
                    ],
                    voucher_date=voucher_day,
                )
                created += 1
                existing_numbers.add(invoice_no)
            except Exception as exc:
                logger.warning(
                    "Category analytics sale skipped for %s: %s", invoice_no, exc
                )
    return created


def _seed_production(db: Database, products, location_id: str) -> int:
    try:
        repo = MongoProductionBatchRepository(db)
        existing_numbers = {
            str(getattr(b, "batch_number", "") or "")
            for b in repo.list_all()
            if MARKER in str(getattr(b, "batch_number", "") or "")
        }
        created = 0
        month_dates = []
        today = date.today()
        for months_ago in range(MONTHS_BACK - 1, -1, -1):
            month_dates.append(_shift_month(today.replace(day=15), months_ago))

        for month_idx, batch_day in enumerate(month_dates):
            for slot in range(PRODUCTION_PER_MONTH):
                batch_number = f"{MARKER}-PB-{batch_day.strftime('%Y%m')}-B{slot + 1}"
                if batch_number in existing_numbers:
                    continue
                product = products[(month_idx + slot) % len(products)]
                qty = float(8 + month_idx + slot * 3)
                batch = ProductionBatch(
                    batch_number=batch_number,
                    recipe_id=f"{MARKER}-recipe",
                    recipe_name=f"{MARKER} recipe",
                    batch_date=batch_day.replace(day=min(5 + slot * 10, 28)),
                    location_id=location_id,
                    planned_quantity=qty,
                    status=ProductionBatchStatus.POSTED,
                    outputs=[
                        BatchOutput(
                            product_id=product.id,
                            product_name=product.name,
                            qty=qty,
                            role=ProductionOutputRole.MAIN,
                        )
                    ],
                    notes=f"{MARKER} seeded posted batch",
                )
                repo.save(batch)
                created += 1
                existing_numbers.add(batch_number)
        return created
    except Exception as exc:
        logger.warning("Category analytics production seed failed (soft): %s", exc)
        return 0


def _seed_customization(db: Database, category_id: str, customer_list) -> int:
    repo = MongoOrderRepository(db)
    existing_numbers = {
        str(getattr(o, "order_number", "") or "")
        for o in repo.list_all()
        if MARKER in str(getattr(o, "order_number", "") or "")
    }

    statuses = [
        CustomizationItemStatus.PENDING,
        CustomizationItemStatus.IN_PROGRESS,
        CustomizationItemStatus.COMPLETED,
    ]
    order_statuses = [
        OrderStatus.IN_PROGRESS,
        OrderStatus.READY_FOR_DELIVERY,
        OrderStatus.COMPLETED,
    ]
    created = 0
    month_dates = []
    today = date.today()
    for months_ago in range(MONTHS_BACK - 1, -1, -1):
        month_dates.append(_shift_month(today.replace(day=10), months_ago))

    for month_idx, order_day in enumerate(month_dates):
        for slot in range(CUSTOMIZATION_PER_MONTH):
            order_number = f"{MARKER}-O-{order_day.strftime('%Y%m')}-C{slot + 1}"
            if order_number in existing_numbers:
                continue
            customer = customer_list[(month_idx + slot) % len(customer_list)]
            status = statuses[(month_idx + slot) % len(statuses)]
            order_status = order_statuses[(month_idx + slot) % len(order_statuses)]
            amount_a = float(1800 + month_idx * 120 + slot * 200)
            amount_b = float(950 + month_idx * 80 + slot * 100)
            items = [
                CustomizationItem(
                    item_id=f"item-analytics-{order_day.strftime('%Y%m')}-{slot + 1}a",
                    bill_number=f"ZB-A{month_idx * 10 + slot + 1:03d}",
                    description=f"{MARKER} blouse {month_idx + 1}-{slot + 1}",
                    sell_amount=amount_a,
                    item_status=status,
                    category_id=category_id,
                ),
                CustomizationItem(
                    item_id=f"item-analytics-{order_day.strftime('%Y%m')}-{slot + 1}b",
                    bill_number=f"ZB-B{month_idx * 10 + slot + 1:03d}",
                    description=f"{MARKER} lehenga {month_idx + 1}-{slot + 1}",
                    sell_amount=amount_b,
                    item_status=statuses[(month_idx + slot + 1) % len(statuses)],
                    category_id=category_id,
                ),
            ]
            order = CustomizationOrder(
                id=f"ord-analytics-{order_day.strftime('%Y%m')}-c{slot + 1}",
                order_number=order_number,
                customer_id=customer.id,
                customer_name=customer.customer_name
                if hasattr(customer, "customer_name")
                else str(getattr(customer, "name", MARKER)),
                phone_number=getattr(customer, "phone_number", CUSTOMERS[0][0]),
                order_date=order_day.replace(day=min(8 + slot * 7, 28)),
                expected_delivery_date=order_day + timedelta(days=14 + slot),
                order_status=order_status,
                customization_items=items,
            )
            repo.save(order)
            created += 1
            existing_numbers.add(order_number)
    return created


def run_category_analytics_seed(db: Database) -> dict:
    """Seed Demo Analytics Wear category with multi-month sales/production/customization data."""
    logger.info("Running category analytics seed (%s)", MARKER)
    main_id, store_id = ensure_default_locations(db)
    accounting, customers, inventory, sales = _services(db)

    category, products = _ensure_category_and_products(inventory, db, main_id)
    if not products:
        raise RuntimeError("Category analytics seed could not create products")

    _top_up_stock(inventory, products, main_id)

    customer_list = _ensure_customers(customers, [main_id, store_id])
    sales_n = _seed_sales(sales, accounting, customer_list, products, main_id)
    production_n = _seed_production(db, products, main_id)
    customization_n = _seed_customization(db, category.id, customer_list)
    summary = {
        "marker": MARKER,
        "category_id": category.id,
        "category_name": CATEGORY_NAME,
        "products": len(products),
        "product_skus": [str(p.sku) for p in products],
        "customers": len(customer_list),
        "sales_created": sales_n,
        "production_created": production_n,
        "customization_created": customization_n,
    }
    logger.info(
        "Category analytics seed done: sales=%s production=%s customization=%s "
        "products=%s customers=%s category=%s",
        sales_n,
        production_n,
        customization_n,
        len(products),
        len(customer_list),
        category.id,
    )
    return summary


def main() -> int:
    from vaybooks.bms.infrastructure.config.settings import get_settings
    from vaybooks.bms.infrastructure.db.connection import get_mongo_client_from_settings
    from vaybooks.bms.infrastructure.logging.setup import setup_logging

    setup_logging()
    settings = get_settings()
    client = get_mongo_client_from_settings()
    db = client[settings.db_name]
    run_category_analytics_seed(db)
    print(
        f"Category analytics seed complete (db={settings.db_name}). "
        f"Open inventory category '{CATEGORY_NAME}' to verify breakdowns."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
