"""Backfill catalog parents for existing inventory SKUs (1:1).

Creates inventory_catalog_products rows and sets catalog_product_id on
inventory_products docs that are missing the link. Idempotent.
"""

from datetime import datetime
from uuid import uuid4

from pymongo.database import Database

from vaybooks.bms.infrastructure.db.indexes import ensure_indexes


def up(db: Database) -> None:
    ensure_indexes(db)
    now = datetime.utcnow()
    products = db.inventory_products
    catalogs = db.inventory_catalog_products

    query = {
        "$or": [
            {"catalog_product_id": {"$exists": False}},
            {"catalog_product_id": None},
            {"catalog_product_id": ""},
        ]
    }
    for doc in products.find(query):
        category_ids = list(doc.get("category_ids") or [])
        category_names = list(doc.get("category_names") or [])
        legacy_id = doc.get("category_id")
        if not category_ids and legacy_id:
            category_ids = [legacy_id]
            legacy_name = doc.get("category_name") or ""
            category_names = [legacy_name] if legacy_name else []

        catalog_id = uuid4().hex
        catalogs.insert_one(
            {
                "_id": catalog_id,
                "name": doc.get("name") or doc.get("sku") or "Product",
                "category_ids": category_ids,
                "category_names": category_names,
                "category_id": category_ids[0] if category_ids else "",
                "category_name": category_names[0] if category_names else "",
                "unit_id": str(doc.get("unit_id") or ""),
                "unit": doc.get("unit") or "pcs",
                "hsn_sac": str(doc.get("hsn_sac") or ""),
                "specifications": dict(doc.get("specifications") or {}),
                "custom_fields": dict(doc.get("custom_fields") or {}),
                "is_active": bool(doc.get("is_active", True)),
                "created_at": doc.get("created_at") or now,
                "updated_at": now,
            }
        )
        products.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "catalog_product_id": catalog_id,
                    "name_override": str(doc.get("name_override") or ""),
                    "attributes": dict(doc.get("attributes") or {}),
                    "barcode": str(doc.get("barcode") or ""),
                    "updated_at": now,
                }
            },
        )
