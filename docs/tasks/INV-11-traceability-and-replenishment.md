# INV-11: Assess traceability and replenishment

- Status: Backlog; implementation not authorized
- Priority: P2
- Evidence: Discovery; do not assume capabilities are missing
- Dependencies: 01, 07, 08, 09

## Context

SKU forms expose batch/serial flags and overview has low-stock records. Full tracking/allocation, expiry, reorder settings, and recommendations remain unverified.

## Scope

- Trace existing batch/serial handling across receipts, transfers, sales, returns, and production.
- Define serial uniqueness, batch reconciliation, expiry, and history lookup.
- Assess location reorder points, lead times, target stock, and suppliers.
- Account for open purchases, reservations, and in-transit stock in recommendations.
- Create implementation subtasks only after identifying actual gaps.

## Acceptance criteria

- Supported serials/batches have complete location/transaction history.
- Flags do not advertise unsupported workflows.
- Alerts/recommendations have inspectable inputs.
- Recommendations do not duplicate existing commitments.

## Validation

Test duplicate/returned/transferred serials, batch splits, expiry, and reorder scenarios with open purchases and reservations.
