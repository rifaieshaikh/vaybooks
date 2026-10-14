# INV-10: Complete pricing and inventory valuation

- Status: Backlog; implementation not authorized
- Priority: P1
- Evidence: Existing foundations; confirmed price-list limit
- Dependencies: 01, 07, 09

## Context

Rate history, SKU cost fields, and customer prices exist. _latest_customer_price_rows limits entries to 2,000 before taking the latest per customer/SKU pair, potentially omitting older valid pairs.

## Scope

- Retrieve latest prices across the relevant full dataset with suitable aggregation/pagination.
- Define effective dates, price precedence, GST, MRP, discounts, and customer rates.
- Confirm costing method and treatment of returns/transfers/adjustments/production.
- Provide auditable cost/rate history and stock-to-finance valuation reconciliation.

## Acceptance criteria

- Valid customer/SKU prices are not lost to a global pre-filter limit.
- Transaction-date prices resolve predictably.
- Valuation is reproducible under a documented method.
- Catalog parents never own financial stock quantity.

## Validation

Test over 2,000 price entries, effective dates, backdated transactions, returns, transfers, and permitted fractional/zero/negative quantity cases.
