"""Deactivation keeps stock. Disposal and merge stay retry-safe."""

from datetime import date

import pytest

from tests.conftest import create_test_product, make_inventory_app_service
from vaybooks.bms.domain.shared.enums import StockMovementType
from vaybooks.bms.domain.shared.exceptions import ValidationError


def _adjust_outs(service, product_id: str) -> list[dict]:
    return [
        row
        for row in service.get_product_ledger(product_id)
        if row["movement_type"] == StockMovementType.ADJUST_OUT.value
    ]


def test_parent_deactivation_keeps_stock_and_reactivation_restores_children():
    service = make_inventory_app_service()
    stocked = create_test_product(service, "SKU-M", "Shirt", [], opening_qty=6)
    parent_id = stocked.catalog_product_id
    unstocked = service.create_sku_under_catalog(
        parent_id, "SKU-L", selling_rate=100, mrp=200, gst_rate=5
    )
    manual = service.create_sku_under_catalog(
        parent_id, "SKU-S", selling_rate=100, mrp=200, gst_rate=5
    )
    service.discontinue_product(manual.id)

    service.update_catalog_product(parent_id, name="Shirt", is_active=False)
    stocked = service.get_product(stocked.id)
    unstocked = service.get_product(unstocked.id)
    manual = service.get_product(manual.id)
    assert stocked.current_qty == 6
    assert stocked.is_active is False
    assert stocked.inactive_via_catalog_id == parent_id
    assert unstocked.is_active is False
    assert unstocked.current_qty == 0
    assert _adjust_outs(service, stocked.id) == []
    assert manual.is_active is False
    assert manual.inactive_via_catalog_id == ""

    service.update_catalog_product(parent_id, is_active=True)
    assert service.get_product(stocked.id).is_active is True
    assert service.get_product(unstocked.id).is_active is True
    assert service.get_product(manual.id).is_active is False
    assert service.get_product(stocked.id).current_qty == 6


def test_metadata_edit_does_not_change_stock():
    service = make_inventory_app_service()
    product = create_test_product(service, "SKU-1", "Cotton", [], opening_qty=4)
    service.update_catalog_product(product.catalog_product_id, name="Cotton twill", is_active=True)
    assert service.get_product(product.id).current_qty == 4
    assert _adjust_outs(service, product.id) == []


def test_dispose_clears_each_location_once():
    service = make_inventory_app_service()
    product = create_test_product(service, "SKU-1", "Cotton", [], opening_qty=4)
    other = service.create_location("SHOP", "Shop")
    service.record_manual_movement(
        product.id, StockMovementType.RECEIVE, 3, date.today(), location_id=other.id
    )
    disposed = service.dispose_stock(product.id)
    assert disposed.is_active is True
    assert disposed.current_qty == 0
    outs = _adjust_outs(service, product.id)
    assert len(outs) == 2
    assert {row["qty_out"] for row in outs} == {4, 3}
    assert all("disposed" in (row.get("notes") or "").lower() for row in outs)

    service.dispose_stock(product.id)
    assert len(_adjust_outs(service, product.id)) == 2


def test_merge_conflict_writes_nothing_until_force_and_retry_is_stable():
    service = make_inventory_app_service()
    first = create_test_product(service, "SKU-A", "Alpha", [], opening_qty=2)
    second = create_test_product(service, "SKU-B", "Beta", [], opening_qty=5)
    other_unit = service.find_or_create_unit("mtr", "Metre")
    service.update_catalog_product(second.catalog_product_id, unit_id=other_unit.id)
    target = first.catalog_product_id
    source = second.catalog_product_id

    with pytest.raises(ValidationError, match="unit_id"):
        service.merge_catalog_products(target, [source])
    assert service.get_product(second.id).catalog_product_id == source
    assert service.get_product(second.id).current_qty == 5

    merged = service.merge_catalog_products(target, [source], force=True)
    moved = service.get_product(second.id)
    assert merged.id == target
    assert moved.catalog_product_id == target
    assert moved.unit_id == service.get_catalog_product(target).unit_id
    assert moved.current_qty == 5
    assert service.get_catalog_product(source).is_active is False
    assert service.get_product(second.id).id == second.id

    again = service.merge_catalog_products(target, [source], force=True)
    assert again.id == target
    assert service.get_product(second.id).current_qty == 5


def test_merge_keeps_sku_unit_and_specs_when_target_unit_is_empty():
    service = make_inventory_app_service()
    first = create_test_product(service, "SKU-A", "Alpha", [], opening_qty=2)
    second = create_test_product(service, "SKU-B", "Beta", [], opening_qty=3)
    target = service.get_catalog_product(first.catalog_product_id)
    target.unit_id = ""
    target.unit = ""
    service._domain._catalog_repo.save(target)
    kept_unit = service.get_product(second.id).unit_id
    service.update_product(
        second.id,
        second.sku,
        second.name,
        second.category_ids,
        kept_unit,
        is_active=True,
        selling_rate=100.0,
        mrp=200.0,
        gst_rate=5.0,
        specifications={"weave": "twill"},
    )
    service.merge_catalog_products(first.catalog_product_id, [second.catalog_product_id])
    moved = service.get_product(second.id)
    assert moved.catalog_product_id == first.catalog_product_id
    assert moved.unit_id == kept_unit
    assert moved.specifications.get("weave") == "twill"
    assert moved.current_qty == 3


def test_merge_retry_after_injected_failure_finishes_the_move():
    service = make_inventory_app_service()
    first = create_test_product(service, "SKU-A", "Alpha", [], opening_qty=1)
    parent = first.catalog_product_id
    second = service.create_sku_under_catalog(
        parent, "SKU-B", selling_rate=100, mrp=200, gst_rate=5, opening_qty=2,
        location_id=service.list_locations(active_only=True)[0].id,
    )
    other = create_test_product(service, "SKU-C", "Gamma", [])
    target = other.catalog_product_id
    inner = service._product_repo

    class Flaky:
        def __init__(self):
            self.saves = 0

        def save(self, product):
            self.saves += 1
            if self.saves == 2:
                product.catalog_product_id = parent
                raise RuntimeError("injected")
            return inner.save(product)

        def __getattr__(self, name):
            return getattr(inner, name)

    flaky = Flaky()
    service._product_repo = flaky
    service._domain._product_repo = flaky
    with pytest.raises(RuntimeError, match="injected"):
        service.merge_catalog_products(target, [parent], force=True)

    service._product_repo = inner
    service._domain._product_repo = inner
    service.merge_catalog_products(target, [parent], force=True)
    assert service.get_product(first.id).catalog_product_id == target
    assert service.get_product(second.id).catalog_product_id == target
    assert service.get_product(first.id).current_qty == 1
    assert service.get_product(second.id).current_qty == 2
    assert service.get_catalog_product(parent).is_active is False


def test_catalog_brand_and_suppliers_are_separate_from_specs():
    service = make_inventory_app_service()
    catalog = service.create_catalog_product(
        "Shirt",
        [],
        unit_code="pcs",
        brand="Acme",
        suppliers=[
            {
                "vendor_id": "vendor-1",
                "vendor_sku": "ACM-1",
                "order_qty": 12,
                "minimum_order_qty": 4,
                "lead_time_days": 7,
                "is_preferred": True,
            }
        ],
        specifications={"Fabric": "Cotton"},
    )
    assert catalog.brand == "Acme"
    assert catalog.specifications == {"Fabric": "Cotton"}
    assert catalog.suppliers[0].vendor_id == "vendor-1"
    assert catalog.suppliers[0].order_qty == 12
    assert catalog.suppliers[0].minimum_order_qty == 4
    assert catalog.suppliers[0].is_preferred is True

    saved = service.update_catalog_product(catalog.id, name="Shirt")
    assert saved.brand == "Acme"
    assert saved.suppliers[0].vendor_sku == "ACM-1"
    assert saved.suppliers[0].order_qty == 12
    assert saved.suppliers[0].minimum_order_qty == 4
    assert saved.specifications == {"Fabric": "Cotton"}

    with pytest.raises(ValidationError, match="only be added once"):
        service.update_catalog_product(
            catalog.id,
            suppliers=[
                {"vendor_id": "vendor-1", "lead_time_days": 1},
                {"vendor_id": "vendor-1", "lead_time_days": 2},
            ],
        )
