# INV-02: Prevent product saves from erasing specifications

- Status: Complete
- Priority: P0
- Evidence: API regressions in `tests/test_inventory_product_save_preservation.py`
- Dependencies: None

## Context

Products.tsx omits specifications/custom_fields on basic saves. CatalogProductWrite defaults them to empty dictionaries and the update route passes them to the domain service, replacing stored values.

## Scope

- Define omitted versus explicitly empty update semantics.
- Preserve unrelated fields on basic edits while supporting intentional clearing.
- Review other inventory update models for the same omission/default problem.

## Acceptance criteria

- Basic edits preserve specifications and custom fields. An omitted key is `None` and the stored value stays. Covered for catalog products and SKUs.
- Explicit clearing remains possible and respects field validation. `{}` clears specifications. `{}` clears custom fields only when validation allows it.
- Invalid updates leave persisted values unchanged. Custom-field validation runs before a catalog update writes child HSN or clears stock. An invalid SKU update does not rename the SKU or replace its fields.

## Update semantics

| Request | Result |
| --- | --- |
| Key omitted, or JSON `null` | Keep the stored value |
| `{}` or a new map | Replace the stored value after validation |
| Validation error | No catalog, SKU, HSN, or stock write from that request |

The same omit-then-default wipe applied to `track_batch`, `track_serial`, and `last_purchase_rate` on `ProductWrite`, because the SKU form does not send them. An omitted value now keeps the stored flag or rate.

Reviewed, and left as they are:

- `SkuWrite.attributes` defaults to `{}` on create. A new SKU has no stored attributes.
- Category updates already keep omitted description, parent, and active state.
- Location saves send address, type, and active state from the settings form.
- Customer prices are append-only. Report `filters: {}` starts a run; it does not update a stored record.

## Validation

API regressions use the in-memory inventory repositories: omitted values, explicit empty values, and invalid fields. `tests/test_inventory_product_save_preservation.py`.
