# INV-09: Verify purchasing, sales, and production integration

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Existing integrations; completeness assessment
- Dependencies: 01, 07, 08

## Context

Sales/purchase lines use stockable IDs. Inventory analytics refer to posted goods receipts and production outputs. Every posting/reversal pathway must be reconciled.

## Scope

- Map inventory effects for PO, GRN, bill, order, delivery note, invoice, return, and production batch.
- Define which linked document owns each movement to prevent double counting.
- Assess reservations, partial fulfillment, rejected receipts, returns, and production inputs/outputs.
- Retain legacy product_id/sku_id compatibility and reject catalog IDs in stock lines.
- Reconcile inventory references with financial documents.

## Acceptance criteria

- Drafts affect physical stock only under an explicit rule.
- Posting/retries change quantities exactly once.
- Partial flows, cancellations, and linked documents do not duplicate stock effects.
- Financial and inventory results follow approved valuation rules.

## Validation

Run isolated purchase-to-receipt, order-to-delivery/invoice, return, cancellation, production, and retry scenarios; assert stock and finance outcomes.
