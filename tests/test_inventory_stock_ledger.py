"""Tests for global stock ledger."""

from datetime import date

from vaybooks.bms.application.inventory.service import InventoryAppService
from vaybooks.bms.domain.shared.enums import StockMovementType
from tests.conftest import make_inventory_app_service


def _service() -> InventoryAppService:
    return make_inventory_app_service()


def test_stock_ledger_returns_enriched_rows():
    service = _service()
    category = service.create_category("Fabric")
    product = service.create_product("SKU-1", "Cotton", category.id, opening_qty=4)
    service.record_manual_movement(
        product.id, StockMovementType.ISSUE, 1, date.today(), "Issue"
    )
    rows = service.get_stock_ledger()
    assert len(rows) == 2
    assert rows[0]["product_name"] == "Cotton"
    assert rows[0]["sku"] == "SKU-1"
    assert rows[0]["category_name"] == "Fabric"
    assert "balance" not in rows[0]
