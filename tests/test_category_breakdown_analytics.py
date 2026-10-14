"""Category breakdown date filters and trend buckets."""

from datetime import date, datetime
from types import SimpleNamespace

from vaybooks.bms.application.inventory.service import InventoryAppService
from tests.conftest import make_inventory_app_service


def _service() -> InventoryAppService:
    return make_inventory_app_service()


def test_period_key_grains():
    day = date(2026, 3, 15)
    assert InventoryAppService._period_key(day, "day") == "2026-03-15"
    assert InventoryAppService._period_key(day, "week") == "2026-W11"
    assert InventoryAppService._period_key(day, "month") == "2026-03"


def test_date_in_range():
    day = date(2026, 2, 10)
    assert InventoryAppService._date_in_range(day, None, None) is True
    assert InventoryAppService._date_in_range(day, date(2026, 2, 1), date(2026, 2, 28)) is True
    assert InventoryAppService._date_in_range(day, date(2026, 3, 1), None) is False
    assert InventoryAppService._date_in_range(None, date(2026, 1, 1), None) is False


def test_sales_breakdown_range_and_trend(monkeypatch):
    service = _service()
    category = service.create_category("Analytics Cat")
    product = service.create_product("AN-1", "Analytics Tee", category.id, opening_qty=0)

    vouchers = [
        SimpleNamespace(
            voucher_date=datetime(2026, 1, 15),
            description="2026-01-15",
            _items=[{"product_id": product.id, "qty": 2, "rate": 100, "line_total": 200}],
        ),
        SimpleNamespace(
            voucher_date=datetime(2026, 2, 10),
            description="2026-02-10",
            _items=[{"product_id": product.id, "qty": 1, "rate": 150, "line_total": 150}],
        ),
        SimpleNamespace(
            voucher_date=datetime(2026, 4, 1),
            description="2026-04-01",
            _items=[{"product_id": product.id, "qty": 5, "rate": 100, "line_total": 500}],
        ),
    ]
    items_by_date = {v.description: v._items for v in vouchers}

    class FakeAccounting:
        def list_vouchers_by_type(self, _voucher_type):
            return vouchers

    class FakeSales:
        _accounting = FakeAccounting()

    class FakeContainer:
        sales = FakeSales()

    monkeypatch.setattr(
        "packages.services_kit.sales_container.get_sales_container",
        lambda: FakeContainer(),
    )

    import vaybooks.bms.domain.sales.line_items as line_items

    monkeypatch.setattr(
        line_items,
        "parse_sales_line_items_note",
        lambda description: (items_by_date.get(description, []), None, None),
    )

    all_time = service.category_sales_breakdown(category.id)
    assert all_time["totals"]["qty"] == 8
    assert all_time["totals"]["amount"] == 850
    assert len(all_time["trend"]) == 3

    ranged = service.category_sales_breakdown(
        category.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 28),
        grain="month",
    )
    assert ranged["totals"]["qty"] == 3
    assert ranged["totals"]["amount"] == 350
    assert [t["period"] for t in ranged["trend"]] == ["2026-01", "2026-02"]

    empty = service.category_sales_breakdown(
        category.id,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 1, 31),
    )
    assert empty["totals"]["qty"] == 0
    assert empty["trend"] == []


def test_production_breakdown_posted_only_and_range(monkeypatch):
    from vaybooks.bms.domain.shared.enums import ProductionBatchStatus

    service = _service()
    category = service.create_category("Prod Cat")
    product = service.create_product("FG-1", "Finished", category.id, opening_qty=0)

    batches = [
        SimpleNamespace(
            status=ProductionBatchStatus.POSTED,
            batch_date=date(2026, 1, 5),
            outputs=[SimpleNamespace(product_id=product.id, qty=10)],
        ),
        SimpleNamespace(
            status=ProductionBatchStatus.DRAFT
            if hasattr(ProductionBatchStatus, "DRAFT")
            else "Draft",
            batch_date=date(2026, 1, 20),
            outputs=[SimpleNamespace(product_id=product.id, qty=99)],
        ),
        SimpleNamespace(
            status=ProductionBatchStatus.POSTED,
            batch_date=date(2026, 3, 1),
            outputs=[SimpleNamespace(product_id=product.id, qty=4)],
        ),
    ]

    class FakeProduction:
        def list_batches(self):
            return batches

    class FakeContainer:
        production = FakeProduction()

    monkeypatch.setattr(
        "packages.services_kit.production_container.get_production_container",
        lambda: FakeContainer(),
    )

    # Fix DRAFT status if enum uses different name
    if not isinstance(batches[1].status, ProductionBatchStatus):
        # pick any non-POSTED
        for status in ProductionBatchStatus:
            if status != ProductionBatchStatus.POSTED:
                batches[1].status = status
                break

    result = service.category_production_breakdown(
        category.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        grain="month",
    )
    assert result["totals"]["qty"] == 10
    assert result["trend"] == [{"period": "2026-01", "qty": 10.0}]


def test_customization_breakdown_uses_order_date(monkeypatch):
    service = _service()
    category = service.create_category("Boutique Cat")

    class Status:
        value = "In Progress"

    orders = [
        SimpleNamespace(
            order_date=date(2026, 1, 12),
            customization_items=[
                SimpleNamespace(
                    category_id=category.id,
                    item_status=Status(),
                    sell_amount=500,
                )
            ],
        ),
        SimpleNamespace(
            order_date=date(2026, 3, 8),
            customization_items=[
                SimpleNamespace(
                    category_id=category.id,
                    item_status=Status(),
                    sell_amount=700,
                ),
                SimpleNamespace(
                    category_id="other",
                    item_status=Status(),
                    sell_amount=999,
                ),
            ],
        ),
    ]

    class FakeOrders:
        _order_repo = SimpleNamespace(list_all=lambda: orders)

    class FakeContainer:
        orders = FakeOrders()

    monkeypatch.setattr(
        "packages.services_kit.boutique_container.get_boutique_container",
        lambda: FakeContainer(),
    )

    result = service.category_customization_breakdown(
        category.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        grain="month",
    )
    assert result["totals"]["count"] == 2
    assert result["totals"]["sell_amount"] == 1200
    assert [t["period"] for t in result["trend"]] == ["2026-01", "2026-03"]
    assert result["rows"][0]["status"] == "In Progress"
