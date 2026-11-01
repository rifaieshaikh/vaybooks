# INV-12: Make inventory navigation and reports trustworthy

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Confirmed UI/data presentation issues
- Dependencies: 01, 04, 06, 07, 10

## Context

Overview labels stockable product_count as Products and links SKU IDs through the catalog route. Breakdown query errors are not passed to panels. Local date ranges use toISOString. Spec insight sales_qty is hardcoded to zero. CSV names use the current selector even when rows came from another previously executed report.

## Scope

- Align Products/SKUs labels and direct routes across overview/categories/stock.
- Separate loading, empty, denied, failed, and stale states with retry controls.
- Use local calendar date boundaries and validate custom ranges.
- Compute advertised metrics or explicitly mark them unavailable.
- Bind results/CSV names to the executed report; assess export size/pagination.
- Preserve descendant category totals and transfer confirmations.

## Acceptance criteria

- Low-stock cards open SKU detail directly; counts are unambiguous.
- Failures do not look like successful empty/zero results.
- Date boundaries work across positive/negative offsets.
- Metrics explain source, period, and posting rules.
- Changing the selector cannot mislabel displayed/exported results.

## Validation

Test failures/empty/denied responses, date boundaries, invalid ranges, selector changes, category descendants, and sample analytics totals.
