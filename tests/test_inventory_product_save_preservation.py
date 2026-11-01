"""API regressions: omitted product fields are preserved; explicit empties clear."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from packages.services_kit.inventory_container import InventoryContainer, set_inventory_container
from services.auth.router import _decode_token
from services.common import authz
from services.inventory.router import router
from tests.conftest import make_inventory_app_service
from vaybooks.bms.domain.inventory.field_definitions import (
    ProductFieldDefinition,
    ProductFieldType,
)


class _FieldDefinitions:
    def __init__(self) -> None:
        self._rows: dict[str, ProductFieldDefinition] = {}

    def save(self, definition: ProductFieldDefinition) -> ProductFieldDefinition:
        self._rows[definition.id] = definition
        return definition

    def find_by_id(self, definition_id: str):
        return self._rows.get(definition_id)

    def find_by_key(self, key: str):
        for row in self._rows.values():
            if row.key == key:
                return row
        return None

    def list_all(self, active_only: bool = False):
        rows = list(self._rows.values())
        if active_only:
            return [row for row in rows if row.is_active]
        return rows

    def delete(self, definition_id: str) -> None:
        self._rows.pop(definition_id, None)


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch):
    fields = _FieldDefinitions()
    service = make_inventory_app_service(field_def_repo=fields)
    set_inventory_container(
        InventoryContainer(
            backend="memory",
            inventory=service,
            location_repo=service._location_repo,
            product_repo=service._product_repo,
        )
    )
    monkeypatch.setattr(authz, "assert_permissions", lambda username, keys: None)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[_decode_token] = lambda: "tester"
    client = TestClient(app)
    try:
        yield client, service, fields
    finally:
        set_inventory_container(None)


def _product_body(**overrides) -> dict:
    body = {
        "sku": "SKU-1",
        "name": "Linen Shirt",
        "selling_rate": 100,
        "mrp": 200,
        "gst_rate": 5,
        "specifications": {"Fabric": "Linen"},
        "custom_fields": {"season": "Summer"},
        "track_batch": True,
        "track_serial": True,
        "last_purchase_rate": 12,
    }
    body.update(overrides)
    return body


def _season_field(fields: _FieldDefinitions, *, required: bool = False) -> None:
    fields.save(
        ProductFieldDefinition(
            key="season",
            label="Season",
            field_type=ProductFieldType.TEXT,
            required=required,
        )
    )


def test_basic_catalog_edit_preserves_specifications_and_custom_fields(api) -> None:
    client, service, fields = api
    _season_field(fields)
    created = client.post(
        "/api/inventory/catalog-products",
        json={
            "name": "Linen Shirt",
            "unit_code": "pcs",
            "hsn_sac": "5208",
            "specifications": {"Fabric": "Linen", "Fit": "Regular"},
            "custom_fields": {"season": "Summer"},
        },
    )
    assert created.status_code == 201, created.text
    catalog_id = created.json()["id"]
    unit_id = service.find_or_create_unit("pcs").id

    saved = client.put(
        f"/api/inventory/catalog-products/{catalog_id}",
        json={
            "name": "Linen Shirt Updated",
            "category_ids": [],
            "unit_id": unit_id,
            "unit_code": "pcs",
            "hsn_sac": "5208",
            "is_active": True,
        },
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["name"] == "Linen Shirt Updated"
    assert body["specifications"] == {"Fabric": "Linen", "Fit": "Regular"}
    assert body["custom_fields"] == {"season": "Summer"}


def test_explicit_empty_catalog_fields_clear(api) -> None:
    client, _service, fields = api
    _season_field(fields)
    created = client.post(
        "/api/inventory/catalog-products",
        json={
            "name": "Linen Shirt",
            "unit_code": "pcs",
            "specifications": {"Fabric": "Linen"},
            "custom_fields": {"season": "Summer"},
        },
    )
    assert created.status_code == 201, created.text
    catalog_id = created.json()["id"]

    saved = client.put(
        f"/api/inventory/catalog-products/{catalog_id}",
        json={
            "name": "Linen Shirt",
            "specifications": {},
            "custom_fields": {},
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["specifications"] == {}
    assert saved.json()["custom_fields"] == {}


def test_invalid_catalog_update_leaves_stock_hsn_and_fields(api) -> None:
    client, service, fields = api
    fields.save(
        ProductFieldDefinition(
            key="season",
            label="Season",
            field_type=ProductFieldType.SELECT,
            options=["Summer", "Winter"],
            required=True,
        )
    )
    created = client.post(
        "/api/inventory/catalog-products",
        json={
            "name": "Linen Shirt",
            "unit_code": "pcs",
            "hsn_sac": "5208",
            "specifications": {"Fabric": "Linen"},
            "custom_fields": {"season": "Summer"},
        },
    )
    assert created.status_code == 201, created.text
    catalog_id = created.json()["id"]
    location_id = service.list_locations(active_only=True)[0].id
    sku = service.create_sku_under_catalog(
        catalog_id,
        "SKU-M",
        opening_qty=5,
        location_id=location_id,
        selling_rate=100,
        mrp=200,
        gst_rate=5,
    )

    rejected = client.put(
        f"/api/inventory/catalog-products/{catalog_id}",
        json={
            "name": "Should Not Save",
            "hsn_sac": "9999",
            "is_active": False,
            "custom_fields": {"season": "Not a season"},
        },
    )
    assert rejected.status_code == 400, rejected.text

    catalog = service.get_catalog_product(catalog_id)
    stored_sku = service.get_product(sku.id)
    assert catalog is not None and stored_sku is not None
    assert catalog.name == "Linen Shirt"
    assert catalog.hsn_sac == "5208"
    assert catalog.is_active is True
    assert catalog.specifications == {"Fabric": "Linen"}
    assert catalog.custom_fields == {"season": "Summer"}
    assert stored_sku.hsn_sac == "5208"
    assert stored_sku.is_active is True
    assert stored_sku.current_qty == 5


def test_basic_sku_edit_preserves_omitted_fields_and_parent(api) -> None:
    client, service, fields = api
    _season_field(fields)
    created = client.post("/api/inventory/products", json=_product_body())
    assert created.status_code == 201, created.text
    sku_id = created.json()["id"]
    parent_id = created.json()["catalog_product_id"]
    service.update_catalog_product(
        parent_id,
        specifications={"Fabric": "Parent only"},
        custom_fields={"season": "Parent"},
    )

    saved = client.put(
        f"/api/inventory/products/{sku_id}",
        json={
            "sku": "SKU-1",
            "name": "Linen Shirt Updated",
            "selling_rate": 100,
            "mrp": 200,
            "gst_rate": 5,
            "is_active": True,
        },
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["name"] == "Linen Shirt Updated"
    assert body["specifications"] == {"Fabric": "Linen"}
    assert body["custom_fields"] == {"season": "Summer"}
    assert body["track_batch"] is True
    assert body["track_serial"] is True
    assert body["last_purchase_rate"] == 12

    parent = service.get_catalog_product(parent_id)
    assert parent is not None
    assert parent.specifications == {"Fabric": "Parent only"}
    assert parent.custom_fields == {"season": "Parent"}


def test_explicit_empty_sku_fields_clear_sku_and_parent(api) -> None:
    client, service, fields = api
    _season_field(fields)
    created = client.post("/api/inventory/products", json=_product_body())
    assert created.status_code == 201, created.text
    sku_id = created.json()["id"]
    parent_id = created.json()["catalog_product_id"]

    saved = client.put(
        f"/api/inventory/products/{sku_id}",
        json={
            **_product_body(name="Linen Shirt"),
            "specifications": {},
            "custom_fields": {},
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["specifications"] == {}
    assert saved.json()["custom_fields"] == {}
    parent = service.get_catalog_product(parent_id)
    assert parent is not None
    assert parent.specifications == {}
    assert parent.custom_fields == {}


def test_invalid_sku_update_leaves_persisted_values(api) -> None:
    client, service, fields = api
    fields.save(
        ProductFieldDefinition(
            key="season",
            label="Season",
            field_type=ProductFieldType.SELECT,
            options=["Summer", "Winter"],
            required=True,
        )
    )
    created = client.post("/api/inventory/products", json=_product_body())
    assert created.status_code == 201, created.text
    sku_id = created.json()["id"]

    rejected = client.put(
        f"/api/inventory/products/{sku_id}",
        json={
            **_product_body(name="Should Not Save", sku="SKU-2"),
            "custom_fields": {"season": ""},
        },
    )
    assert rejected.status_code == 400, rejected.text
    stored = service.get_product(sku_id)
    assert stored is not None
    assert stored.name == "Linen Shirt"
    assert stored.sku == "SKU-1"
    assert stored.specifications == {"Fabric": "Linen"}
    assert stored.custom_fields == {"season": "Summer"}
