# VayBooks URL scheme (Phase 1)

Conventions for React shell routes and REST API paths. `:id` denotes a resource identifier; list pages support query params (`?page=`, `?sort=`, `?filter=`).

## Platform

| UI route | API prefix | Notes |
|----------|------------|-------|
| `/login` | `POST /api/auth/login` | JWT bearer thereafter |
| `/` (home) | `GET /api/home/health` | Dashboard shell |
| — | `GET /health` | Gateway health |
| — | `GET /api/flags/modules` | Enabled modules |
| — | `GET /api/license/status` | License status |

## Parties (`/parties/...`)

| UI route | API |
|----------|-----|
| `/parties/customers` | `GET /api/parties/customers` |
| `/parties/customers/:id` | `GET /api/parties/customers/:id` |
| `/parties/customers/new` | `POST /api/parties/customers` |
| `/parties/vendors` | `GET /api/parties/vendors` |
| `/parties/vendors/:id` | `GET /api/parties/vendors/:id` |
| `/parties/workers` | `GET /api/parties/workers` |
| `/parties/workers/:id` | `GET /api/parties/workers/:id` |
| `/parties/delivery-partners` | `GET /api/parties/delivery-partners` |
| `/parties/commission-agents` | `GET /api/parties/commission-agents` |
| `/parties/segments` | `GET /api/parties/segments` |

## Sales (`/sales/...`)

| UI route | API |
|----------|-----|
| `/sales` (overview) | `GET /api/sales/overview` |
| `/sales/estimates` | `GET /api/sales/estimates` |
| `/sales/estimates/:id` | `GET /api/sales/estimates/:id` |
| `/sales/quotations` | `GET /api/sales/quotations` |
| `/sales/quotations/:id` | `GET /api/sales/quotations/:id` |
| `/sales/orders` | `GET /api/sales/orders` |
| `/sales/orders/:id` | `GET /api/sales/orders/:id` |
| `/sales/delivery-notes` | `GET /api/sales/delivery-notes` |
| `/sales/delivery-notes/:id` | `GET /api/sales/delivery-notes/:id` |
| `/sales/invoices` | `GET /api/sales/invoices` |
| `/sales/invoices/:id` | `GET /api/sales/invoices/:id` |
| `/sales/returns` | `GET /api/sales/returns` |
| `/sales/returns/:id` | `GET /api/sales/returns/:id` |
| `/sales/reports` | `GET /api/sales/reports` |

## Purchases (`/purchases/...`)

| UI route | API |
|----------|-----|
| `/purchases` (overview) | `GET /api/purchases/overview` |
| `/purchases/orders` | `GET /api/purchases/orders` |
| `/purchases/orders/:id` | `GET /api/purchases/orders/:id` |
| `/purchases/goods-receipts` | `GET /api/purchases/goods-receipts` |
| `/purchases/goods-receipts/:id` | `GET /api/purchases/goods-receipts/:id` |
| `/purchases/bills` | `GET /api/purchases/bills` |
| `/purchases/bills/:id` | `GET /api/purchases/bills/:id` |
| `/purchases/returns` | `GET /api/purchases/returns` |
| `/purchases/reports` | `GET /api/purchases/reports` |

## Inventory (`/inventory/...`)

| UI route | API |
|----------|-----|
| `/inventory` (overview) | `GET /api/inventory/overview` |
| `/inventory/categories` | `GET /api/inventory/categories` |
| `/inventory/products` | `GET /api/inventory/products` |
| `/inventory/products/:id` | `GET /api/inventory/products/:id` |
| `/inventory/warehouses` | `GET /api/inventory/warehouses` |
| `/inventory/stock` | `GET /api/inventory/stock` |
| `/inventory/movements` | `GET /api/inventory/movements` |
| `/inventory/transfers` | `GET /api/inventory/transfers` |
| `/inventory/transfers/:id` | `GET /api/inventory/transfers/:id` |
| `/inventory/customer-prices` | `GET /api/inventory/customer-prices` |
| `/inventory/reports` | `GET /api/inventory/reports` |

## Finance (`/finance/...`)

| UI route | API |
|----------|-----|
| `/finance` (overview) | `GET /api/finance/overview` |
| `/finance/accounts` | `GET /api/finance/accounts` |
| `/finance/accounts/:id` | `GET /api/finance/accounts/:id` |
| `/finance/vouchers` | `GET /api/finance/vouchers` |
| `/finance/vouchers/:id` | `GET /api/finance/vouchers/:id` |
| `/finance/receipts` | `GET /api/finance/receipts` |
| `/finance/payments` | `GET /api/finance/payments` |
| `/finance/journal` | `GET /api/finance/journal` |
| `/finance/trial-balance` | `GET /api/finance/trial-balance` |
| `/finance/credit-notes` | `GET /api/finance/credit-notes` |
| `/finance/debit-notes` | `GET /api/finance/debit-notes` |
| `/finance/accounting-invoices` | `GET /api/finance/accounting-invoices` |

## Boutique (`/boutique/...`)

| UI route | API |
|----------|-----|
| `/boutique` | `GET /api/boutique/overview` |
| `/boutique/orders` | `GET /api/boutique/orders` |
| `/boutique/orders/:id` | `GET /api/boutique/orders/:id` |
| `/boutique/items` | `GET /api/boutique/items` |
| `/boutique/measurements` | `GET /api/boutique/measurements` |
| `/boutique/time` | `GET /api/boutique/time-entries` |
| `/boutique/calendar` | `GET /api/boutique/calendar` |
| `/boutique/reports` | `GET /api/boutique/reports` |

## Store (`/store/...`)

| UI route | API |
|----------|-----|
| `/store/activities` | `GET /api/store/activities` |
| `/store/time` | `GET /api/store/time-entries` |

## CRM (`/crm/...`)

| UI route | API |
|----------|-----|
| `/crm/leads` | `GET /api/crm/leads` |
| `/crm/leads/:id` | `GET /api/crm/leads/:id` |
| `/crm/activities` | `GET /api/crm/activities` |
| `/crm/activities/:id` | `GET /api/crm/activities/:id` |

## Projects (`/projects/...`)

| UI route | API |
|----------|-----|
| `/projects` | `GET /api/projects` |
| `/projects/:id` | `GET /api/projects/:id` |
| `/projects/enquiries` | `GET /api/projects/enquiries` |
| `/projects/enquiries/:id` | `GET /api/projects/enquiries/:id` |
| `/projects/measurements` | `GET /api/projects/measurements` |
| `/projects/ra-bills` | `GET /api/projects/ra-bills` |
| `/projects/reports` | `GET /api/projects/reports` |
| `/projects/settings` | `GET /api/projects/settings` |

## Production (`/production/...`)

| UI route | API |
|----------|-----|
| `/production` | `GET /api/production/overview` |
| `/production/recipes` | `GET /api/production/recipes` |
| `/production/batches` | `GET /api/production/batches` |
| `/production/batches/:id` | `GET /api/production/batches/:id` |
| `/production/day-book` | `GET /api/production/day-book` |
| `/production/reports` | `GET /api/production/reports` |

## Settings & access

| UI route | API |
|----------|-----|
| `/settings/locations` | `GET /api/settings/locations` |
| `/settings/services` | `GET /api/settings/services` |
| `/settings/discounts` | `GET /api/settings/discounts` |
| `/access/users` | `GET /api/access/users` |
| `/access/roles` | `GET /api/access/roles` |

## Reports, migration, system, schedulers

| UI route | API |
|----------|-----|
| `/reports` | `GET /api/reports` |
| `/migration/export-backup` | `POST /api/migration/export` |
| `/migration/import` | `POST /api/migration/import` |
| `/system/about` | `GET /api/system/about` |
| `/schedulers/crm` | `GET /api/schedulers/crm` |
| `/schedulers/sales` | `GET /api/schedulers/sales` |
| `/schedulers/inventory` | `GET /api/schedulers/inventory` |

## Implemented module APIs (in-memory adapters)

Beyond health, combined mode currently exposes:

| Module | Key endpoints |
|--------|----------------|
| parties | `GET/POST /api/parties`, soft-delete, events |
| sales | `GET/POST /api/sales/invoices` (+ degraded pending) |
| purchases | `GET/POST /api/purchases/orders`, `/bills` |
| inventory | `/reserves` request/confirm/fail |
| finance | `/postings` request/confirm/fail |
| boutique | `/orders`, `/items` |
| store | `/activities`, `/time-entries` |
| crm | `/leads`, `/enquiries`, `/activities` |
| schedulers | `/jobs`, `/jobs/{id}/run` |
| projects | `GET/POST /api/projects`, `/enquiries` |
| production | `/recipes`, `/batches` |
| migration | `/batches`, `/batches/{id}/run` |
| system | `/diagnostics`, `/settings/{key}` |
| access | `/users`, `/roles` (Auth remains SOR for tokens) |
| home | `/dashboard` |
| reports | `/catalog` |
| settings | `/prefs` |

## Module health

Each service still exposes:

```
GET /api/{module}/health  →  { "module": "<name>", "status": "ok" }
```

## Gateway proxy (cloud)

Web shell calls `/api/...` on port **8000**. Vite dev servers proxy `/api` → `http://127.0.0.1:8000`. In microservice mode the gateway forwards to per-module upstreams; in **combined desktop mode** all routers mount in one process (`python -m services.combined`).
