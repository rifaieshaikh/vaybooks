"""Idempotent demo data for Product/SKU 360 analytics tabs.

Test/QA only — orchestrated via seed-data.py:

  python scripts/seed/seed-data.py --run product_sku_analytics --yes
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

from vaybooks.bms.application.finance.accounting.service import AccountingAppService
from vaybooks.bms.application.inventory.service import InventoryAppService
from vaybooks.bms.application.parties.customers.service import CustomerAppService
from vaybooks.bms.application.sales.discounts.service import DiscountAppService
from vaybooks.bms.application.sales.service import SalesAppService
from vaybooks.bms.domain.boutique.orders.entities import CustomizationItem, CustomizationOrder
from vaybooks.bms.domain.purchases.entities import GoodsReceipt, GoodsReceiptLine
from vaybooks.bms.domain.production.entities import BatchOutput, ProductionBatch
from vaybooks.bms.domain.sales.discount_entities import (
    DISCOUNT_TYPE_PERCENT,
    SCOPE_PRODUCT,
    DiscountRule,
)
from vaybooks.bms.domain.parties.customers.entities import CustomerInput
from vaybooks.bms.domain.inventory.rate_history_service import ProductRateHistoryService
from vaybooks.bms.domain.shared.enums import (
    AccountType,
    CustomizationItemStatus,
    GoodsReceiptStatus,
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
    MongoCatalogProductRepository,
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
from vaybooks.bms.infrastructure.repositories.purchases.mongo_purchase_repository import (
    MongoGoodsReceiptRepository,
)
from vaybooks.bms.infrastructure.repositories.sales.mongo_customer_price_repository import (
    MongoCustomerPriceRepository,
)
from vaybooks.bms.infrastructure.repositories.sales.mongo_discount_rule_repository import (
    MongoDiscountRuleRepository,
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

logger = logging.getLogger("vaybooks.bms.product_sku_analytics_seed")

MARKER = "PROD-SKU-ANALYTICS"
CATALOG_NAME = "Demo Linen Shirt"
CUSTOMER = ("9000000091", f"{MARKER} Customer")
SKU_SPECS = (
    ("PSA-LINEN-M", "Size M", {"Size": "M"}, 899.0, 80.0),
    ("PSA-LINEN-L", "Size L", {"Size": "L"}, 949.0, 60.0),
)
MONTHS_BACK = 6
SALES_PER_MONTH = 2
GRN_PER_MONTH = 1
PRODUCTION_PER_MONTH = 1
CUSTOMIZATION_PER_MONTH = 1


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
        catalog_repo=MongoCatalogProductRepository(db),
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
    discounts = DiscountAppService(
        MongoDiscountRuleRepository(db),
        list_sku_ids_for_catalog=lambda catalog_id: [
            sku.id for sku in inventory.list_skus_for_catalog(catalog_id)
        ],
    )
    return accounting, customers, inventory, sales, discounts


def _shift_month(base: date, months_ago: int) -> date:
    year = base.year
    month = base.month - months_ago
    while month <= 0:
        month += 12
        year -= 1
    day = min(base.day, 28)
    return date(year, month, day)


def _activity_dates() -> list[date]:
    today = date.today()
    days: list[date] = []
    for months_ago in range(MONTHS_BACK - 1, -1, -1):
        month_anchor = _shift_month(today.replace(day=1), months_ago)
        for day_offset in (5, 18):
            days.append(date(month_anchor.year, month_anchor.month, min(day_offset, 28)))
    return days


def _product_rate(product) -> float:
    return float(
        getattr(product, "selling_rate", None)
        or getattr(product, "active_selling_rate", None)
        or 100
    )


def _ensure_catalog_and_skus(inventory: InventoryAppService, location_id: str):
    existing_catalogs = [
        row
        for row in inventory.list_catalog_products(active_only=False)
        if CATALOG_NAME in str(getattr(row, "name", "") or "")
        or MARKER in str((getattr(row, "specifications", None) or {}).get("Marker", ""))
    ]
    if existing_catalogs:
        catalog = existing_catalogs[0]
    else:
        catalog = inventory.create_catalog_product(
            CATALOG_NAME,
            category_ids=[],
            unit_code="pcs",
            hsn_sac="6205",
            specifications={"Fabric": "Linen", "Fit": "Regular", "Marker": MARKER},
            custom_fields={"Care": "Hand wash", "Origin": "Demo"},
        )

    inventory.find_or_create_unit("pcs", "Pieces")
    by_sku = {
        str(getattr(row, "sku", "")).upper(): row
        for row in inventory.list_skus_for_catalog(catalog.id)
    }
    skus = []
    for code, label, attrs, rate, opening in SKU_SPECS:
        product = by_sku.get(code)
        if product is None:
            product = inventory.create_sku_under_catalog(
                catalog.id,
                code,
                name_override=f"{CATALOG_NAME} {label}",
                attributes=attrs,
                opening_qty=opening,
                selling_rate=rate,
                mrp=rate + 50,
                gst_rate=5.0,
                location_id=location_id,
            )
        skus.append(product)
    return catalog, [s for s in skus if s]


def _ensure_customer(customers: CustomerAppService, location_ids: list[str]):
    phone, name = CUSTOMER
    existing = customers._customer_repo.find_by_phone(phone)
    if existing:
        return existing
    return customers.create_customer(
        CustomerInput(
            customer_name=name,
            phone_number=phone,
            location_ids=list(location_ids),
        )
    )


def _top_up_stock(inventory: InventoryAppService, skus, location_id: str, target_qty: float = 300.0):
    for product in skus:
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


def _seed_sales(sales, accounting, customer, skus, location_id: str) -> int:
    cash = _ensure_account(accounting, "Cash Drawer", AccountType.ASSET, is_store_account=True)
    _ensure_account(accounting, "Sales", AccountType.REVENUE)
    existing_numbers = {
        str(getattr(v, "store_invoice_number", "") or "")
        for v in accounting.list_vouchers_by_type(VoucherType.SALES_INVOICE)
        if MARKER in str(getattr(v, "store_invoice_number", "") or "")
    }
    created = 0
    customer_account = accounting.get_customer_account(customer.id)
    if not customer_account:
        logger.warning("No AR account for customer %s", customer.id)
        return 0
    for date_idx, voucher_day in enumerate(_activity_dates()):
        for slot in range(SALES_PER_MONTH):
            invoice_no = f"{MARKER}-INV-{voucher_day.strftime('%Y%m%d')}-S{slot + 1}"
            if invoice_no in existing_numbers:
                continue
            sku = skus[(date_idx + slot) % len(skus)]
            qty = float(1 + ((date_idx + slot) % 4))
            rate = _product_rate(sku)
            gross = round(qty * rate, 2)
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
                            "product_id": sku.id,
                            "sku_id": sku.id,
                            "qty": qty,
                            "rate": rate,
                            "description": f"{MARKER} {sku.sku}",
                            "location_id": location_id,
                        }
                    ],
                    voucher_date=voucher_day,
                )
                created += 1
                existing_numbers.add(invoice_no)
            except Exception as exc:
                logger.warning("Product/SKU sale skipped for %s: %s", invoice_no, exc)
    return created


def _seed_grns(db: Database, skus, location_id: str) -> int:
    repo = MongoGoodsReceiptRepository(db)
    existing = {
        str(getattr(g, "grn_number", "") or "")
        for g in repo.list_all()
        if MARKER in str(getattr(g, "grn_number", "") or "")
    }
    created = 0
    today = date.today()
    for months_ago in range(MONTHS_BACK - 1, -1, -1):
        for slot in range(GRN_PER_MONTH):
            receipt_day = _shift_month(today.replace(day=12), months_ago)
            grn_number = f"{MARKER}-GRN-{receipt_day.strftime('%Y%m')}-G{slot + 1}"
            if grn_number in existing:
                continue
            sku = skus[(months_ago + slot) % len(skus)]
            qty = float(10 + months_ago + slot * 2)
            rate = round(_product_rate(sku) * 0.55, 2)
            grn = GoodsReceipt(
                grn_number=grn_number,
                vendor_id=f"{MARKER}-vendor",
                vendor_name=f"{MARKER} Vendor",
                receipt_date=receipt_day,
                location_id=location_id,
                status=GoodsReceiptStatus.RECEIVED,
                notes=f"{MARKER} posted GRN",
                lines=[
                    GoodsReceiptLine(
                        product_id=sku.id,
                        product_name=sku.name,
                        qty_received=qty,
                        qty_accepted=qty,
                        rate=rate,
                    )
                ],
            )
            repo.save(grn)
            created += 1
            existing.add(grn_number)
    return created


def _seed_production(db: Database, skus, location_id: str) -> int:
    repo = MongoProductionBatchRepository(db)
    existing = {
        str(getattr(b, "batch_number", "") or "")
        for b in repo.list_all()
        if MARKER in str(getattr(b, "batch_number", "") or "")
    }
    created = 0
    today = date.today()
    for months_ago in range(MONTHS_BACK - 1, -1, -1):
        for slot in range(PRODUCTION_PER_MONTH):
            batch_day = _shift_month(today.replace(day=20), months_ago)
            batch_number = f"{MARKER}-PB-{batch_day.strftime('%Y%m')}-B{slot + 1}"
            if batch_number in existing:
                continue
            sku = skus[(months_ago + slot) % len(skus)]
            qty = float(6 + months_ago + slot)
            batch = ProductionBatch(
                batch_number=batch_number,
                recipe_id=f"{MARKER}-recipe",
                recipe_name=f"{MARKER} recipe",
                batch_date=batch_day,
                location_id=location_id,
                planned_quantity=qty,
                status=ProductionBatchStatus.POSTED,
                outputs=[
                    BatchOutput(
                        product_id=sku.id,
                        product_name=sku.name,
                        qty=qty,
                        role=ProductionOutputRole.MAIN,
                    )
                ],
                notes=f"{MARKER} seeded posted batch",
            )
            repo.save(batch)
            created += 1
            existing.add(batch_number)
    return created


def _seed_customization(db: Database, catalog_id: str, skus, customer) -> int:
    repo = MongoOrderRepository(db)
    existing = {
        str(getattr(o, "order_number", "") or "")
        for o in repo.list_all()
        if MARKER in str(getattr(o, "order_number", "") or "")
    }
    statuses = [
        CustomizationItemStatus.PENDING,
        CustomizationItemStatus.IN_PROGRESS,
        CustomizationItemStatus.COMPLETED,
    ]
    created = 0
    today = date.today()
    for months_ago in range(MONTHS_BACK - 1, -1, -1):
        for slot in range(CUSTOMIZATION_PER_MONTH):
            order_day = _shift_month(today.replace(day=8), months_ago)
            order_number = f"{MARKER}-O-{order_day.strftime('%Y%m')}-C{slot + 1}"
            if order_number in existing:
                continue
            sku = skus[(months_ago + slot) % len(skus)]
            amount = float(1200 + months_ago * 100 + slot * 150)
            item = CustomizationItem(
                item_id=f"item-psa-{order_day.strftime('%Y%m')}-{slot + 1}",
                bill_number=f"PS-{months_ago * 10 + slot + 1:03d}",
                description=f"{MARKER} alter {sku.sku}",
                sell_amount=amount,
                item_status=statuses[(months_ago + slot) % len(statuses)],
                sku_id=sku.id,
                catalog_product_id=catalog_id,
            )
            order = CustomizationOrder(
                id=f"ord-psa-{order_day.strftime('%Y%m')}-c{slot + 1}",
                order_number=order_number,
                customer_id=customer.id,
                customer_name=getattr(customer, "customer_name", MARKER),
                phone_number=getattr(customer, "phone_number", CUSTOMER[0]),
                order_date=order_day,
                expected_delivery_date=order_day + timedelta(days=10),
                order_status=OrderStatus.IN_PROGRESS,
                customization_items=[item],
            )
            repo.save(order)
            created += 1
            existing.add(order_number)
    return created


def _seed_discount(discounts: DiscountAppService, catalog_id: str) -> int:
    existing = [
        rule
        for rule in discounts.list_rules(active_only=False)
        if MARKER in str(rule.name or "")
    ]
    if existing:
        return 0
    discounts.create_rule(
        DiscountRule(
            name=f"{MARKER} catalog 5%",
            scope=SCOPE_PRODUCT,
            discount_type=DISCOUNT_TYPE_PERCENT,
            value=5.0,
            catalog_product_ids=[catalog_id],
            priority=40,
            is_active=True,
        )
    )
    return 1


def run_product_sku_analytics_seed(db: Database) -> dict:
    """Seed Demo Linen Shirt catalog + SKUs with multi-month analytics data."""
    logger.info("Running product/SKU analytics seed (%s)", MARKER)
    main_id, store_id = ensure_default_locations(db)
    accounting, customers, inventory, sales, discounts = _services(db)

    catalog, skus = _ensure_catalog_and_skus(inventory, main_id)
    if len(skus) < 2:
        raise RuntimeError("Product/SKU analytics seed needs at least 2 SKUs")

    _top_up_stock(inventory, skus, main_id)
    customer = _ensure_customer(customers, [main_id, store_id])
    sales_n = _seed_sales(sales, accounting, customer, skus, main_id)
    grn_n = _seed_grns(db, skus, main_id)
    production_n = _seed_production(db, skus, main_id)
    customization_n = _seed_customization(db, catalog.id, skus, customer)
    discount_n = _seed_discount(discounts, catalog.id)

    summary = {
        "marker": MARKER,
        "catalog_product_id": catalog.id,
        "catalog_name": catalog.name,
        "skus": [str(s.sku) for s in skus],
        "sales_created": sales_n,
        "grn_created": grn_n,
        "production_created": production_n,
        "customization_created": customization_n,
        "discount_created": discount_n,
    }
    logger.info(
        "Product/SKU analytics seed done: sales=%s grn=%s production=%s "
        "customization=%s discount=%s skus=%s catalog=%s",
        sales_n,
        grn_n,
        production_n,
        customization_n,
        discount_n,
        summary["skus"],
        catalog.id,
    )
    return summary


if __name__ == "__main__":
    from vaybooks.bms.infrastructure.config.settings import get_settings
    from vaybooks.bms.infrastructure.db.mongo import get_db

    settings = get_settings()
    run_product_sku_analytics_seed(get_db(settings))
