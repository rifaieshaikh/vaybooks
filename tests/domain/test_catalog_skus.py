"""Catalog product + SKU split smoke tests."""

from tests.conftest import create_test_product, make_inventory_app_service


def test_create_product_links_catalog_parent():
    svc = make_inventory_app_service()
    product = create_test_product(svc, "SKU-A1", "Shirt Blue", [])
    assert product.catalog_product_id
    parent = svc.get_catalog_product(product.catalog_product_id)
    assert parent is not None
    assert parent.name == "Shirt Blue"
    skus = svc.list_skus_for_catalog(parent.id)
    assert len(skus) == 1
    assert skus[0].id == product.id


def test_create_sku_under_catalog_separate_stock():
    svc = make_inventory_app_service()
    first = create_test_product(svc, "SKU-M", "Shirt", [])
    parent_id = first.catalog_product_id
    second = svc.create_sku_under_catalog(
        parent_id,
        "SKU-L",
        attributes={"Size": "L"},
        selling_rate=120,
        mrp=200,
        gst_rate=5,
    )
    assert second.catalog_product_id == parent_id
    skus = svc.list_skus_for_catalog(parent_id)
    assert {s.sku for s in skus} == {"SKU-M", "SKU-L"}


def test_merge_catalog_products():
    svc = make_inventory_app_service()
    a = create_test_product(svc, "MERGE-A", "Alpha", [])
    b = create_test_product(svc, "MERGE-B", "Beta", [])
    target = a.catalog_product_id
    source = b.catalog_product_id
    merged = svc.merge_catalog_products(target, [source], force=True)
    assert merged.id == target
    skus = svc.list_skus_for_catalog(target)
    assert {s.sku for s in skus} == {"MERGE-A", "MERGE-B"}
    retired = svc.get_catalog_product(source)
    assert retired is not None
    assert retired.is_active is False


def test_resolve_inventory_id():
    svc = make_inventory_app_service()
    product = create_test_product(svc, "RES-1", "Resolve Me", [])
    resolved = svc.resolve_inventory_id(product.id)
    assert resolved["is_sku"] is True
    assert resolved["catalog_product_id"] == product.catalog_product_id
    parent = svc.resolve_inventory_id(product.catalog_product_id)
    assert parent["is_catalog_product"] is True
