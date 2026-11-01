# INV-01: Define the complete inventory system

- Status: Complete
- Priority: P1
- Evidence: Static review plus an isolated representative benchmark, 2026-10-14.
- Dependencies: None
- Matrix: [Inventory foundation](../inventory-foundation.md)

## Context

Existing code covers catalog parents, SKUs, location balances, movements, transfers, and integrations. The foundation document maps each workflow to an owner, states, and a coverage status. It also records current stock rules and the decisions that later tasks must not invent.

## Scope

- Map all inventory screens, APIs, repositories, permissions, and tests into an implemented/partial/missing/unverified capability matrix.
- Define product versus SKU ownership, location balances, units and precision, negative stock, reservations, in-transit stock, and valuation rules.
- Measure representative API latency, payload size, database query count, and browser responsiveness; agree workload sizes and targets.

## Acceptance criteria

- Every workflow has a documented owner, state transitions, evidence, and coverage status. Recorded in the foundation matrix.
- Unknown business rules and unsupported capabilities are recorded explicitly. Recorded as open decisions and an unsupported list. They are not approved policy.
- Performance targets and baseline fixtures are documented and agreed. The representative fixture was measured on an isolated database, including browser filter and sort time. Small and large fixtures were not run. The list APIs miss the agreed targets; that gap belongs to INV-06.

## Validation

Review existing tests and trace representative workflows. Done as a static trace. The representative API and browser numbers are in the foundation document. The benchmark database was dropped after the run.
