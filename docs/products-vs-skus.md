# Products vs SKUs

Vaybooks splits **catalog products** from **stockable SKUs**.

| | Product | SKU |
|--|---------|-----|
| Role | Catalog + 360° insights | Stock, pricing, document lines |
| Menu | Inventory → Products | Inventory → SKUs |
| API | `/api/inventory/catalog-products` | `/api/inventory/skus` (+ compat `/products`) |
| Stock / sales / PO / GRN | No | Yes |

- Creating a product via flat `POST /api/inventory/products` still creates **one parent + one SKU** (compat).
- Old `/inventory/products/:id` bookmarks that point at a SKU id redirect to `/inventory/skus/:id`.
- Migration `037_catalog_product_parents` backfills 1:1 parents; `038_inventory_skus_entitlements` syncs `inventory.skus.*` keys.
