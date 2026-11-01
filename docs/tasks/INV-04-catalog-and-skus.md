# INV-04: Complete catalog and SKU management

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Confirmed defects and usability gaps
- Dependencies: 01, 02, 03

## Context

Catalog list responses omit sku_count, while the UI defaults it to zero. Products has no search/filter controls despite API q support. HSN propagates on parent edits while other inherited fields do not follow the same behavior.

## Scope

- Return accurate SKU counts through bulk aggregation, avoiding per-parent lookups.
- Add consistent search, category/status filters, sorting, and pagination.
- Define inherited fields versus SKU overrides and restrictions on units after transactions.
- Complete product/variant creation and specification/custom-field editing; retain legacy ID compatibility.

## Acceptance criteria

- List/detail counts agree under a documented active-child rule.
- Products can be found by name, category, and status.
- Parent edits obey explicit inheritance rules without changing historical quantity meaning.
- Variant creation preserves one parent and distinct stockable children.

## Validation

Test zero/multiple/inactive children, overrides, unit changes, legacy links, and representative catalog sizes.
