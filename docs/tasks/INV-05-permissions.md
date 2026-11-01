# INV-05: Align inventory permissions

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Confirmed inconsistency; wider assessment
- Dependencies: 01

## Context

Add SKU accepts inventory.skus.create OR inventory.products.create in product detail, but its API requires inventory.products.create. SKU navigation/endpoints still use product permission keys in several places.

## Scope

- Define permission compatibility and migration rules for Products/SKUs.
- Map actions, keyboard shortcuts, queries, and direct API calls across all inventory screens.
- Check stock-changing location access and visibility of financial analytics.

## Acceptance criteria

- Visible actions match effective API authorization.
- Unauthorized direct calls are rejected.
- Existing roles retain intended access through explicit compatibility rules.
- Location access is consistent for stock changes.

## Validation

Verify viewer, catalog editor, warehouse operator, price editor, and owner roles through API and UI, including denied locations.
