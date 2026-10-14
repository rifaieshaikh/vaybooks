# INV-07: Complete stock reconciliation and count workflows

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Existing foundations; completeness assessment
- Dependencies: 01, 03, 05, 06

## Context

Location balances, ledger, and manual movements exist. Physical stock-count coverage and complete reconciliation need verification.

## Scope

- Define on-hand/available/reserved/in-transit displays as required by approved rules.
- Provide SKU/location/date/reference filters and opening/inflow/outflow/closing reconciliation.
- Assess stock counts and implement missing count-to-approved-adjustment steps.
- Require appropriate location, reason, reference, and permissions for adjustments.
- Define precision, backdated movements, reversals, and negative stock policy.

## Acceptance criteria

- Closing quantity reconciles by SKU/location.
- Counts produce auditable adjustments instead of silently overwriting balances.
- Repeated/invalid adjustments do not create duplicate effects.
- Stock facts are distinct from editable metadata.

## Validation

Test variances, partial counts, concurrent movements, backdated entries, reversals, fractional quantities, and multi-location reconciliation.
