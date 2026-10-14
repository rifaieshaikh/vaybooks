# Inventory management task backlog

Goal: a complete, reliable inventory management system covering catalog products, SKUs, location stock, stock counts, movements, warehouse transfers, transaction integrations, pricing, valuation, traceability, replenishment, and reports.

Created: 2026-10-14. The user requested tasks first and explicitly prohibited application-code changes. These are planning documents; no task authorizes implementation. All tasks are in Backlog.

## Tasks

| Task | Priority | Outcome |
| --- | --- | --- |
| [INV-01](INV-01-foundation.md) | P1 | Define the complete inventory system |
| [INV-02](INV-02-product-save-preservation.md) | P0 | Prevent product saves from erasing specifications |
| [INV-03](INV-03-lifecycle-and-merge.md) | P0 | Make deactivation and merging safe |
| [INV-04](INV-04-catalog-and-skus.md) | P1 | Complete catalog and SKU management |
| [INV-05](INV-05-permissions.md) | P1 | Align inventory permissions |
| [INV-06](INV-06-query-performance.md) | P1 | Scale inventory lists and detail queries |
| [INV-07](INV-07-stock-and-counts.md) | P1 | Complete stock reconciliation and count workflows |
| [INV-08](INV-08-warehouse-transfers.md) | P1 | Complete reliable warehouse transfers |
| [INV-09](INV-09-transaction-integrations.md) | P1 | Verify purchasing, sales, and production integration |
| [INV-10](INV-10-pricing-and-valuation.md) | P1 | Complete pricing and inventory valuation |
| [INV-11](INV-11-traceability-and-replenishment.md) | P2 | Assess traceability and replenishment |
| [INV-12](INV-12-navigation-and-reporting.md) | P1 | Make inventory navigation and reports trustworthy |

P0: critical correctness or stock-impact issues. P1: core workflows and scalability. P2: capabilities to assess after foundational rules are established.

## Sequence

1. Define scope/rules (01) and prepare data preservation (02).
2. Resolve lifecycle safety and permissions (03, 05).
3. Complete catalog management and measured query optimization (04, 06).
4. Establish stock reconciliation and transfers (07, 08).
5. Verify integrations and pricing/valuation (09, 10).
6. Complete reporting (12) and assess traceability/replenishment (11).

## Evidence and limitations

Static review covered inventory screens, shell navigation, shared RTK Query endpoints, API routes, and application/domain/repository code. See [product/SKU reference](../products-vs-skus.md) and the [inventory foundation](../inventory-foundation.md) from INV-01. Confirmed defects, business-rule decisions, and unverified capabilities are distinguished in each task. INV-01 is complete: the capability matrix is recorded, and the representative fixture was measured on an isolated database that was then dropped. Its open business rules are still not approved policy. The measured list APIs miss the agreed speed targets; that work is INV-06.

No production benchmark was performed. Previously run catalog/SKU domain suites passed 11 tests, which does not establish full system coverage or cover the identified UI/API defects.

## Completion standard

A task is complete only when its acceptance criteria have evidence: applicable regression tests, UI/API verification, measured performance for optimization tasks, and migration/compatibility notes. Stock-changing verification must use isolated data. Resolve business-rule decisions before dependent implementation.
