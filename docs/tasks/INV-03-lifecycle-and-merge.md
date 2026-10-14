# INV-03: Make deactivation and merging safe

- Status: Backlog; implementation not authorized
- Priority: P0
- Evidence: Confirmed behavior; business decision required
- Dependencies: 01

## Context

Deactivating a parent clears stock through _clear_stock_on_discontinue and deactivates active children. Reactivation does not reactivate children. Merge changes child parents, categories, units, and HSN through multiple writes.

## Scope

- Decide whether deactivation preserves stock, blocks while stocked, or requires a separate disposal workflow.
- Define reactivation and merge conflict rules, including incompatible units and metadata retention.
- Design affected-SKU/stock previews and deliberate confirmation for consequential actions.
- Assess transaction safety, retries, audit records, partial failure, and recovery.

## Acceptance criteria

- Routine metadata edits cannot unexpectedly clear stock.
- Consequential actions describe exact impact.
- Failures and retries preserve consistent or explicitly recoverable state.
- Historical references remain valid.

## Validation

Test stocked/unstocked children, multiple locations, reactivation, unit conflicts, repeated requests, and injected failures; verify balances and audit records.
