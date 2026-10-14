# Inventory foundation

Status of [INV-01](tasks/INV-01-foundation.md). This is a static map of the inventory system as of 2026-10-14. It records owners, state transitions, coverage, and rules that are still undecided.

Evidence is source review of the React shell, `web/mfe-inventory`, `services/inventory/router.py`, `vaybooks/bms/domain/inventory`, application services, repositories, entitlements, and the inventory test files named below. No API was called, no browser walkthrough was run, and no database was written. Latency, payload size, query count, and browser timing are not measured. See [Products vs SKUs](products-vs-skus.md) for the catalog/SKU split.

Coverage words used below:

| Word | Meaning |
| --- | --- |
| Implemented | A code path exists and a named test covers the main behavior. |
| Partial | A code path exists and a gap is visible in that code. |
| Missing | No entity, route, or screen for the capability. |
| Unverified | Code may exist; this review did not trace a complete workflow or run it. |

## Current rules

These are what the code does today. They are not approved policy until the open decisions at the end of this document are resolved.

### Product and SKU ownership

The catalog parent (`CatalogProduct`, collection `inventory_catalog_products`) owns name, categories, unit, HSN, specifications, custom fields, and `is_active`. It has no quantity, cost, or rate. The SKU (`InventoryProduct`, collection `inventory_products`) owns stock, weighted average cost, last purchase rate, selling rate, MRP, GST, barcode, attributes, and `track_batch` / `track_serial`. Sales and purchase lines must resolve to a SKU. A catalog parent id is rejected with "Select a SKU, not a catalog product".

`POST /api/inventory/products` still creates one parent and one SKU. `POST /api/inventory/catalog-products` creates a parent only. Opening quantity is a `Receive` movement on the SKU and requires a location when it is greater than zero. Opening quantity is clamped at zero.

### Location balances

On-hand is stored twice. `InventoryProduct.current_qty` is the company total. `StockBalance` is one quantity per SKU and location. Both update inside `_record_movement`. A movement without a location is rejected. Locations and warehouses are one entity (`Location`, collection `warehouses`) with type Warehouse or Retail Store. Settings owns location screens; inventory only consumes them.

### Units and precision

Quantities are Python `float` values rounded to 2 decimal places. Weighted average cost and last purchase rate inside `apply_landed_cost` round to 4 places. Selling rate, MRP, GST, and customer prices round to 2. There is no decimal quantity type, no unit conversion factor, and no per-unit precision. `units.py` only normalizes the unit code. A serial-tracked goods receipt requires a whole accepted quantity.

### Negative stock

Outflows other than transfer compare the company total and reject when `current_qty` is short by more than 0.001. `Transfer Out` compares only the source location balance. Location deltas have no floor, so a sale, issue, adjustment, or purchase return can make one location negative while the company total is still enough. There is no `allow_negative` setting. A scheduler alerts when either the company total or a location balance is below -0.001. That job detects negatives; it does not prevent them.

### Reservations

`POST /api/inventory/reserves` and its confirm, fail, and get routes store an in-memory lock (`pending`, `confirmed`, `failed`) in `ReserveLockService`. The lock record does not store quantity and does not change `current_qty` or `stock_balances`. These routes have no permission check.

### In-transit stock

There is no in-transit balance bucket. Dispatch writes `Transfer Out`, which reduces the source location and the company total. Receive writes `Transfer In` for the full line quantity. While a transfer is in transit, that quantity is in neither location and is missing from the company total.

### Valuation

The only costing method in code is weighted average, updated by `apply_landed_cost` when a goods receipt is confirmed, when a purchase bill applies stock, and when a production batch is posted. Location stock value in on-hand reporting is quantity times that average. A separate stock-value figure uses selling rate. There is no costing-method field and no inventory FIFO or standard cost. This review found no weighted-average update on transfers, manual adjustments, or returns.

Selling rate, MRP, and GST history live on the SKU, with non-overlapping periods. Customer prices are a sales changelog. Listing the latest customer price reads at most 2,000 newest rows, then keeps the first row per customer and SKU, so an older pair can disappear.

### Low stock

Thresholds disagree. The inventory overview treats on-hand below 5 as low. Finance reports and the scheduler default use 2. There is no reorder point, lead time, or target quantity on the SKU.

## Workflows

The React shell is the current UI (`docs/cutover.md`). Streamlit pages under `vaybooks/bms/ui/pages/inventory` are still registered and are not the owner of new work.

| Workflow | Owner | States | Coverage | Evidence |
| --- | --- | --- | --- | --- |
| Overview | `/inventory` → `Overview.tsx`; `GET /api/inventory/overview` | Read-only | Partial | KPI `product_count` counts active SKUs and the screen labels it Products. Low-stock cards open `/inventory/products/:id` with a SKU id; product detail redirects SKU ids to `/inventory/skus/:id`. |
| Categories | `/inventory/categories` and `/:id`; category routes | Active / inactive | Partial | List, create, edit, and deactivate are implemented and permission-gated. Category detail does not assign products or show breakdowns, although those APIs and permissions exist. |
| Catalog products | `/inventory/products` and `/:id`; `/api/inventory/catalog-products` | Active / inactive | Partial | Create, detail, child SKUs, merge, and 360 tabs exist. List responses omit `sku_count`, and the list shows 0. Basic save omits specifications and custom fields; the write model defaults them to empty dictionaries and the update replaces stored values. Spec-insight `sales_qty` is hardcoded to 0. |
| SKUs | `/inventory/skus` and `/:id`; `/api/inventory/products` and `/skus` | Active / inactive | Partial | Create, edit, balances, rate history, and breakdowns exist. Save uses the same omission as catalog products. Lists load the full array and filter in the browser. Navigation uses `inventory.products.view`, not `inventory.skus.view`. |
| Stock on hand | `/inventory/stock`; `GET /api/inventory/stock` | Read-only facts | Partial | Screen filters a full list. Quantity is not edited here. API has no permission dependency. |
| Ledger and movements | `/inventory/stock-ledger`, `/inventory/movements`; `GET/POST /api/inventory/movements` | Posted movement | Partial | Manual types are Receive, Issue, Adjust In, Adjust Out. Quantity must be positive. Ledger reads every movement. Product ledger keeps a running balance that is not split by location. The stock-ledger list has no running balance. |
| Transfers | `/inventory/transfers` and `/:id` | Draft → In Transit → Received; Draft or In Transit → Cancelled | Partial | Dispatch, full receive, and cancel are implemented. Received transfers cannot be cancelled. Cancel of an in-transit transfer reverses its movements. Partial receipt is missing. |
| Customer prices | `/inventory/customer-prices` | Append-only rate rows | Partial | Create and history exist. Latest-price listing is capped at 2,000 rows. |
| Reports | `/inventory/reports` | Run with empty filters | Partial | Catalog and run exist. CSV name follows the selector currently on screen. Scheduled reports is a link to `/schedulers/inventory`. |
| Locations | `/settings-locations`; `/api/inventory/locations` | Active / inactive | Implemented | CRUD is covered by `tests/test_inventory_api.py`. Not an inventory-module screen. |
| Physical stock counts | None | — | Missing | No count document, route, or adjustment-from-count flow. |
| Batch, serial, expiry | Flags on the SKU; batch and serial captured on GRN lines | — | Partial | Flags do not flow onto stock movements. No allocation or expiry field. |
| Replenishment | Low-stock lists and a scheduler alert | — | Partial | Alerts exist. Recommendations that account for open purchases, reservations, and in-transit quantity do not. |

## State transitions

### Catalog parent and SKU

| Action | Effect | Coverage |
| --- | --- | --- |
| Deactivate parent | Clears each active child's stock with Adjust Out notes "Stock cleared on discontinue", then marks those children inactive. | Implemented in `tests/test_inventory_movements.py`. Whether this should happen is undecided. |
| Deactivate SKU | Same stock clear, then `is_active = false`. | Implemented in the same test. |
| Reactivate parent or SKU | Flips `is_active` only. Children stay inactive. Cleared quantity is not restored. | Partial. No dedicated reactivate path. |
| Merge parents | Reparents source SKUs onto the target and copies the target's categories, unit, and HSN. Source parents become inactive. Stock stays on the SKU. Conflicting unit or HSN raises unless `force` is set. | Implemented in `tests/domain/test_catalog_skus.py` and `tests/domain/test_product_sku_finish.py`. |

### Transfer

| From | Action | To | Stock |
| --- | --- | --- | --- |
| — | Create | Draft | None. `send_in_transit` dispatches in the same call. |
| Draft | Dispatch | In Transit | Transfer Out at the source. Company total decreases. |
| In Transit | Receive | Received | Transfer In of the full line quantity at the destination. Company total increases. |
| Draft | Cancel | Cancelled | Status only. |
| In Transit | Cancel | Cancelled | Movements for that transfer are reversed. |
| Received | Cancel | Rejected | No balance change. |

Legacy stored status `Dispatched` reads as In Transit.

### Movements

Inflows: Receive, Adjust In, Purchase Receive, Sales Return, Transfer In. Outflows: Issue, Adjust Out, Sale, Purchase Return, Transfer Out. References: Manual, Sales Invoice, Purchase, Purchase Return, GRN, Delivery Note, Sales Return, Stock Transfer, Production Batch.

`reverse_movements_by_reference` posts the opposite quantity and deletes the original rows. Reversing an inflow fails when the company total is short.

### Documents that change stock

The movement owner is `InventoryDomainService._record_movement`. Callers found in this review:

| Document | Stock effect | Reference |
| --- | --- | --- |
| Purchase order | None. Updates received quantity and PO status only. | — |
| Goods receipt confirm | Purchase Receive for accepted quantity, then weighted average. Damaged and rejected quantities are excluded. Confirm once. | GRN |
| Purchase bill | Purchase Receive only when stock is applied and the bill has no GRN reference. | Purchase |
| Sales order | None. Tracks ordered, delivered, and invoiced quantities. | — |
| Delivery note dispatch | Sale, unless `stock_source` is `invoice`. | Delivery Note |
| Sales invoice | Sale when the invoice has no delivery note. An update with no delivery note reverses and reposts. | Sales Invoice |
| Sales return | Sales Return when goods are received, restock is on, and no voucher already restocked them. | Sales Return |
| Purchase return | Purchase Return on create. | Purchase Return |
| Production post | Issue of inputs, Receive of outputs, then weighted average on outputs. Unpost reverses by batch id. | Production Batch |

Draft documents do not post stock on the paths above. Posting is tied to confirm, dispatch, invoice create, goods received, or batch post.

Double-count risk visible in code: an invoice with no delivery note and a delivery note that is not linked to that invoice can each issue the same goods. A bill with stock applied and a goods receipt that the bill does not reference can each receive. When the documents are linked, the second path is skipped. Whether the UI always links them was not verified.

## Permissions

Entitlement keys live in `vaybooks/bms/domain/entitlements/catalog.py`. The React nav hides items by those keys. Only category routes enforce a permission in the shell. The API enforces permissions on categories, catalog products, catalog merge, SKU breakdowns, and customer prices.

These API routes have no `require_permission`: overview, units, locations, warehouses, legacy product list/create/get/update, stock, stock ledger, movements, transfers (including dispatch, receive, and cancel), reports, and reserves.

`inventory.skus.view`, `inventory.skus.create`, and `inventory.skus.edit` exist from migration `038_inventory_skus_entitlements` and are not checked on `/api/inventory/skus`. Product detail allows add-SKU when the user has `inventory.skus.create` or `inventory.products.create`. The create-SKU API requires `inventory.products.create`.

## Tests and fixtures

| Area | Tests |
| --- | --- |
| API smoke: category, opening stock, transfer, report, overview, locations | `tests/test_inventory_api.py` |
| Categories and tree | `tests/test_inventory_categories.py`, `tests/integration/test_inventory_category_workflow.py`, `tests/domain/test_category_tree.py` |
| Movements, ledger, reports | `tests/test_inventory_movements.py`, `tests/test_inventory_stock_ledger.py`, `tests/test_inventory_reports.py` |
| Multi-location and transfers | `tests/test_multi_location_inventory.py` |
| Sales, returns, GRN landed cost | `tests/test_inventory_sales_deduct.py`, `tests/test_inventory_sales_return.py`, `tests/test_inventory_purchase_receive.py` |
| Catalog and SKU | `tests/domain/test_catalog_skus.py`, `tests/domain/test_product_sku_finish.py` |
| Search limits | `tests/test_inventory_search_pickers.py` |
| Web unit tests | `web/mfe-inventory/src/__tests__/pickerOptions.test.ts`, `transferConfirm.test.ts` |

No test in this set covers the product-save field wipe, the list `sku_count`, permission mismatches, the 2,000-row customer-price cap, partial transfer receipt, physical counts, or query cost. `web/mfe-inventory/scripts/inventory_ux_smoke.py` opens dialogs; it is not a regression suite.

Existing seeds, for later isolated checks:

| Fixture | Contents |
| --- | --- |
| `product_sku_analytics` | One catalog parent, two SKUs, stock topped toward 300 each, six months of sales, GRN, production, and customization. |
| `category_analytics` | One category, eight SKUs, twelve months of sales, production, and customization. |
| `e2e/helpers/inventory_seed.py` | One category or one product. Not a volume fixture. |
| Demo profile | Defaults of 100 categories and 100 products, and it does not run unless `SEED_PROFILE` is set. |

## Performance baselines

Agreed on 2026-10-14. These sizes and targets are the bar for [INV-06](tasks/INV-06-query-performance.md). The representative fixture was measured. Small and large were not.

| Fixture | Catalog parents | SKUs | Locations | Movements | Customer-price rows |
| --- | --- | --- | --- | --- | --- |
| Small | 100 | 200 | 3 | 1,000 | 500 |
| Representative | 1,000 | 5,000 | 10 | 50,000 | 10,000 |
| Large | 5,000 | 25,000 | 20 | 250,000 | 50,000 |

| Surface | Target |
| --- | --- |
| List APIs (products, SKUs, stock, movements, transfers) | p95 under 300 ms, response under 100 KB for one page, query count independent of total rows |
| SKU detail | p95 under 400 ms, and the request must not include other SKUs' movements or customer prices |
| Browser list | Filtering and sorting the loaded page stays under 100 ms; a filter must apply to the full dataset on the server |

The representative run also loaded 5,000 location balances and 200 draft transfers. It loaded no selling, MRP, or GST history rows. `scripts/benchmarks/inv01_baseline.py` inserted the rows into database `vaybooks_inv01_bench` on `127.0.0.1:27017`, called the API through an in-process test client, and dropped that database afterward. It did not write to any other database. Permission checks were bypassed for the timed calls. Each API figure is the nearest-rank p95 of 3 samples. The browser figures are the nearest-rank p95 of 5 samples in Chrome, timing `JSON.parse`, `filter`, and `sort` on the saved responses. They do not include the network download.

| Endpoint | Rows returned | Payload | p95 | Mongo commands on the last sample | Against the list target |
| --- | --- | --- | --- | --- | --- |
| `GET /api/inventory/catalog-products?active_only=false` | 1,000 | 332 KB | 28 ms | 2 | Latency passes. Payload is over 100 KB. |
| `GET /api/inventory/products?active_only=false` | 5,000 | 3.4 MB | 28.4 s | 20,002 | Misses latency, payload, and query count. Samples were 28.4 s, 3.10 s, 3.06 s. The first call was cold; the later calls stay near 3.1 s. |
| `GET /api/inventory/stock?active_only=false` | 5,000 | 3.4 MB | 3.05 s | 20,002 | Misses latency, payload, and query count. |
| `GET /api/inventory/movements` | 50,000 | 15.9 MB | 668 ms | 5 | Misses latency and payload. The command count is small because the ledger reads the movement collection in full. |
| `GET /api/inventory/transfers` | 200 | 77 KB | 10 ms | 2 | Meets the target at this row count only. |
| `GET /api/inventory/customer-prices` | 2,000 of 10,000 | 687 KB | 1.75 s | 10,003 | Misses latency, payload, and query count. The route keeps at most 2,000 newest rows. |
| `GET /api/inventory/products/sku-0` | 1 detail | 856 B | 13 ms | 9 | Meets the detail target. The body has that SKU's balance and empty rate history. It does not include other SKUs' movements. |

The 20,002 commands on the product and stock lists are one collection read plus about four reads per SKU. `list_products` hydrates every row, and hydration resolves the unit and the active selling, MRP, and GST periods one SKU at a time. Customer prices repeat that hydration for each of the 2,000 returned rows.

Browser, after the payload was already in memory:

| Payload | Parse p95 | Filter p95 | Sort p95 |
| --- | --- | --- | --- |
| SKU list, 5,000 rows, 3.4 MB | 8.3 ms | 0.6 ms | 11.7 ms |
| Movements, 50,000 rows, 15.9 MB | 39.1 ms | 0.8 ms | 10.5 ms |

Filtering and sorting the loaded page meets the 100 ms target. The pages still fail the API targets because they download the full collection first. A server-side filter is still required.

## Open decisions

Later tasks must not invent these. Each one is current behavior plus the decision still required.

| Topic | Current behavior | Decision needed before |
| --- | --- | --- |
| Deactivation | Clears stock and deactivates children. Reactivation does not undo either. | [INV-03](tasks/INV-03-lifecycle-and-merge.md) |
| Merge | Rewrites child categories, unit, and HSN. `force` bypasses conflicts. | INV-03 |
| Negative stock | Company total is guarded except on transfer, which guards the source location only. A location can go negative. | [INV-07](tasks/INV-07-stock-and-counts.md) |
| Reservations | In-memory lock only. Quantity is not held. | [INV-09](tasks/INV-09-transaction-integrations.md) |
| In-transit | Quantity leaves the company total on dispatch. No partial receipt. | [INV-08](tasks/INV-08-warehouse-transfers.md) |
| Valuation method | Weighted average on GRN, stocked bills, and production output. | [INV-10](tasks/INV-10-pricing-and-valuation.md) |
| Quantity precision | Float rounded to 2. No unit conversion. | INV-07 |
| Low-stock threshold | Overview uses 5. Finance and the scheduler use 2. No per-SKU reorder point. | [INV-11](tasks/INV-11-traceability-and-replenishment.md) |
| List and detail cost | Full arrays, client filtering. Representative baseline misses the agreed list targets. | [INV-06](tasks/INV-06-query-performance.md) |
| Permission keys | Nav, page, and API do not use the same keys. Several stock routes are open. | [INV-05](tasks/INV-05-permissions.md) |

## Unsupported

These are absent, not merely unverified:

- Physical inventory counts and count-to-adjustment posting.
- An in-transit quantity bucket.
- Partial transfer receipt, shortage, or damage on a transfer line.
- Batch or serial on stock movements, allocation, and expiry.
- Reorder point, lead time, supplier, and replenishment recommendations.
- A costing method other than weighted average.
- Unit conversion.
- Server pagination on the main inventory lists.

[INV-11](tasks/INV-11-traceability-and-replenishment.md) still has to trace batch and serial fields already stored on goods receipts before any new tracking work is scoped. The inventory ledger itself does not store them.
