# INV-03: Make deactivation and merging safe

- Status: Complete
- Priority: P0
- Evidence: Domain tests in `tests/domain/test_inventory_lifecycle.py`; movement tests updated in `tests/test_inventory_movements.py`
- Dependencies: 01

## Decision

Deactivation does not clear stock. Quantity is removed only by a separate disposal action that writes Adjust Out with the note "Stock disposed". Disposal is a no-op when on-hand quantity is already zero. The product stays active.

Deactivating a catalog parent marks its active SKUs inactive and tags them with `inactive_via_catalog_id`. Reactivating that parent restores only those tagged SKUs. A direct SKU edit clears the tag, so a later parent reactivation does not undo that choice. Already-inactive SKUs are left alone.

Merge keeps each SKU id, its stock, and its specifications. Source catalog products stay in the catalog as inactive, so their specifications remain. A SKU's categories, unit, and HSN change only when the target has a value for that field. Unit or HSN conflicts raise until `force` is set, and then the target values are kept. There is no multi-document transaction. A failed merge can be retried: each SKU is saved on its own, and a SKU already moved is not listed on the source again.

## Acceptance criteria

- Routine metadata edits cannot unexpectedly clear stock.
- Consequential actions describe exact impact.
- Failures and retries preserve consistent or explicitly recoverable state.
- Historical references remain valid.

## What changed

- `discontinue_product` and catalog deactivation no longer call the stock-clear helper.
- `POST /api/inventory/products/{id}/dispose` and `POST /api/inventory/catalog-products/{id}/dispose` remove on-hand quantity. Both require `inventory.products.edit`.
- Product and SKU screens confirm before deactivation, reactivation of cascaded SKUs, disposal, and merge. The merge confirmation lists each source SKU and its quantity.
- Retry coverage injects a failure on the second SKU save, then merges again and checks that every SKU is on the target with its quantity unchanged.
