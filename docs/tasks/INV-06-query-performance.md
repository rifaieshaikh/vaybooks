# INV-06: Scale inventory lists and detail queries

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Confirmed fetch patterns; measurement needed
- Dependencies: 01, 04

## Context

Most lists load full arrays for client filtering/pagination. SKU detail downloads all movements and customer prices then filters by ID. Several list pages eagerly load form-only picker data. Existing inventory indexes already cover common fields.

## Scope

- Introduce server filtering, stable sorting, pagination, and totals with compatibility for array consumers.
- Filter SKU histories in repositories and use bulk reads for related data.
- Load form-only pickers on demand while retaining defaults/loading/error behavior.
- Review broad Inventory cache invalidation.
- Choose indexes from query plans and measured workloads rather than adding speculative indexes.

## Acceptance criteria

- Page loads fetch bounded datasets.
- SKU detail does not download unrelated histories.
- Filtering/sorting cover the entire dataset; exports state their scope.
- Measured outcomes meet task 01 targets.

## Validation

Benchmark agreed fixtures and inspect Mongo query plans/browser requests. Test changing totals, empty pages, stable ordering, stale requests, and legacy callers.
