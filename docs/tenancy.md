# Tenancy

VayBooks supports two deployment tenancy models.

## Desktop (single-tenant)

- One organization per installation.
- `VAYBOOKS_DATA_DIR` marks desktop runtime (`vaybooks.bms.infrastructure.config.runtime`).
- Mongo: typically one logical org; database names still per-service for future split.
- Files: `{VAYBOOKS_DATA_DIR}/files/{org_id}/`
- Redis optional; no cross-tenant cache sharing.
- License: single key bound to machine/org.

**Start:** `.\restart_vaybooks.ps1 -Mode Desktop`

## Cloud (multi-tenant)

- Many organizations on shared infrastructure.
- **Do not** set `VAYBOOKS_DATA_DIR` on cloud hosts.
- Mongo: one `mongod`, many DB names **and** `org_id` on all tenant-scoped documents.
- Redis **required** for permission cache keys scoped by org.
- Files: S3 prefix `{org_id}/files/...`
- Gateway resolves tenant from JWT `org_id` claim; rejects cross-tenant IDs.
- First-run org configuration: see [`cloud-setup-wizard.md`](cloud-setup-wizard.md).

## Database layout

One MongoDB server, multiple database names:

| Database | Service |
|----------|---------|
| `vaybooks_auth` | Auth, sessions |
| `vaybooks_parties` | Customers, vendors, employees |
| `vaybooks_inventory` | Stock, movements |
| … | Per microservice schema |

Org scoping is enforced in application code and (future) row-level guards — not separate mongod per tenant for Phase 1c.

## Migration from Streamlit monolith

Existing installs use a single `MONGODB_DATABASE` (e.g. `zahcci_customization`). Cutover migrations will:

1. Export org entitlements and identity.
2. Split collections into per-service DBs with `org_id` preserved.
3. Re-point services via `MONGODB_URI` + service-specific database env vars.

See [`cutover.md`](cutover.md) for retirement checklist.
