# INV-02: Prevent product saves from erasing specifications

- Status: Backlog; implementation not authorized
- Priority: P0
- Evidence: Confirmed defect
- Dependencies: None

## Context

Products.tsx omits specifications/custom_fields on basic saves. CatalogProductWrite defaults them to empty dictionaries and the update route passes them to the domain service, replacing stored values.

## Scope

- Define omitted versus explicitly empty update semantics.
- Preserve unrelated fields on basic edits while supporting intentional clearing.
- Review other inventory update models for the same omission/default problem.

## Acceptance criteria

- Basic edits preserve specifications and custom fields.
- Explicit clearing remains possible and respects field validation.
- Invalid updates leave persisted values unchanged.

## Validation

Add API-level regressions for omitted values, explicit empty values, and invalid fields using isolated repositories.
