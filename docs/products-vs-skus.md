# Products vs SKUs

Vaybooks splits **catalog products** from **stockable SKUs**.

| | Product | SKU |
|--|---------|-----|
| Role | Catalog + 360° insights | Stock, pricing, document lines |
| Menu | Inventory → Products | Inventory → SKUs |
| API | `/api/inventory/catalog-products` | `/api/inventory/skus` (+ compat `/products`) |
| Stock / sales / PO / GRN | No | Yes |

## Model rules

- Creating a product via flat `POST /api/inventory/products` still creates **one parent + one SKU** (compat).
- Old `/inventory/products/:id` bookmarks that point at a SKU id redirect to `/inventory/skus/:id`.
- Migration `037_catalog_product_parents` backfills 1:1 parents; `038_inventory_skus_entitlements` syncs `inventory.skus.*` keys.
- **Web nav** may still use `inventory.products.view` for the SKUs menu until clients refresh after `038`; prefer `inventory.skus.*` going forward.
- **No Streamlit / desktop Product↔SKU UI changes** in this wave.

## Product 360 / SKU 360

| Tab | Product (catalog) | SKU |
|-----|-------------------|-----|
| Overview | Catalog fields + SKU count | Details (incl. on-hand tagged to SKU) / pricing |
| SKUs | Child SKU list + add SKU + merge parents | — |
| Spec insights | Parent specs/custom fields + attribute×SKU table | — |
| Sales | Invoice lines on child SKUs | Same, filtered to one SKU |
| Purchase | **Posted GRN lines only** (qty × rate) | Same |
| Production | **Posted batch outputs only** | Same |
| Customization | Boutique items with `catalog_product_id` / `sku_id` | Same |
| Activity | Stock movements across child SKUs (v1) | Movements for this SKU |
| Movements / Customer prices | — | Filtered by stockable id |

**Stock ownership:** qty and balances are **tagged to the SKU**. Catalog products do not own a stock ledger. SKU 360 shows on-hand as read-only facts; create/adjust stock via opening qty on SKU create or **Inventory → Stock**.

## Transactional dual-read

Sales and purchase line resolvers accept `sku_id` **or** legacy `product_id` / `item_id`. Catalog product ids are **rejected** (“Select a SKU, not a catalog product”). Resolved lines set both `sku_id` and `product_id` to the stockable id.

Web sales/purchase/production pickers load options from `/inventory/skus` and send both ids. Create shortcut for inventory ops opens `/inventory/skus?new=1`.

## Discounts

`DiscountRule.catalog_product_ids` expands to child SKU ids at evaluate time. Scope `product` accepts either `product_ids` (SKUs) or `catalog_product_ids` (parents). Settings UI has both pickers.

## Demo seed

```bash
python scripts/seed/seed-data.py --list
python scripts/seed/seed-data.py --run product_sku_analytics --yes
```

Pack id `product_sku_analytics` (marker `PROD-SKU-ANALYTICS`) seeds Demo Linen Shirt + Size M/L SKUs with multi-month sales, posted GRNs, production outputs, linked boutique customization, and an optional catalog discount. Re-runs are idempotent.
