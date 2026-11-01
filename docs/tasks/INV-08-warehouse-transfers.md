# INV-08: Complete reliable warehouse transfers

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Existing workflow; reliability assessment
- Dependencies: 01, 05, 07

## Context

Transfer screens, confirmations, and domain operations exist. End-to-end reliability and partial receipt support need assessment.

## Scope

- Document allowed draft/dispatch/in-transit/receive/cancel transitions.
- Validate accessible distinct locations, quantities, and availability.
- Assess partial receipts, shortages/damage, batch/serial allocation, and reversals.
- Make repeated operations safe and expose source movement references.

## Acceptance criteria

- Stock changes exactly once per transition.
- Source/destination/in-transit balances reconcile.
- Invalid transitions change no balances.
- Receipt differences have an explicit auditable resolution.

## Validation

Test full lifecycle, retries, concurrent dispatches, insufficient stock, cancellations, and failures between related writes.
