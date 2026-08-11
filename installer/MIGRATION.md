# VayBooks Installer Migration Notes

Phase 1c / Phase 3 installer guidance for the Streamlit → React + microservices cutover.

## Canonical installer location

**Use [`vaybooks/installer`](.) as the single source of truth** for building and shipping VayBooks installers.

The legacy root folder [`zahcci/installer`](../../installer) is **deprecated**. Do not add new scripts, Inno Setup pages, or bundle logic there. Existing copies remain for backward compatibility during transition only.

## Installable bundles

Bundle definitions live in [`bundles.json`](bundles.json). The wizard should let the operator pick one primary bundle (or Full). Module lists map to entitlements in `vaybooks.bms.domain.entitlements.catalog`.

| Bundle | Modules (summary) |
|--------|-------------------|
| **Core** | Core platform: parties, settings |
| **Boutique** | Core + boutique + store + finance |
| **Trade** | Core + inventory + sales + purchases + finance |
| **CRM** | Core + CRM — **warn if Sales is not also selected** |
| **Projects** | Core + projects + finance |
| **Full** | All modules |

### CRM without Sales

The CRM bundle sets `"warn_without": ["sales"]` in `bundles.json`. The installer should show a clear warning when CRM is chosen without Trade/Sales modules: lead conversion and order flows may be limited until Sales is enabled.

## Redis

| Deployment | Redis |
|------------|-------|
| **Desktop installer** | **Optional** — in-process permission cache and job queue when Redis is off |
| **Cloud / web deploy** | **Required** — shared permission cache; arq workers when enabled |

Desktop installs may omit Redis; cloud compose and hosted stacks must provision Redis (see [`docker-compose.yml`](../docker-compose.yml)).

## MongoDB

Use **one `mongod` process with many database names** (one per microservice schema), not one mongod per service:

- Example: `vaybooks_auth`, `vaybooks_parties`, `vaybooks_inventory`, …
- Desktop installer may bundle a local MongoDB MSI or point at an existing instance.
- Connection string: `MONGODB_URI` with per-service database names in service config.

Optional: add separate mongod instances later for large tenants — not required for Phase 1c.

## Related docs

- [`README.md`](README.md) — build and publish guide
- [`../docs/cutover.md`](../docs/cutover.md) — parity checklist and Streamlit retirement
- [`../docs/tenancy.md`](../docs/tenancy.md) — single-tenant desktop vs multi-tenant cloud
- [`../restart_vaybooks.ps1`](../restart_vaybooks.ps1) — local dev / desktop stack starter
