# QA Matrix (Phase 3)

Cross-product checklist for bundle installs, infrastructure variants, and smoke tests before cutover.

## Dimensions

| Axis | Values |
|------|--------|
| **Bundle** | Core, Boutique, Trade, CRM, Projects, Full (see [`installer/bundles.json`](../installer/bundles.json)) |
| **Redis** | On (cloud profile) / Off (desktop profile) |
| **Mongo** | Local (`docker compose` / installer MSI) / Remote (Atlas or shared mongod) |

## Matrix (mark each cell when verified)

| Bundle | Redis off + Mongo local | Redis off + Mongo remote | Redis on + Mongo local | Redis on + Mongo remote |
|--------|-------------------------|--------------------------|------------------------|-------------------------|
| Core | ☐ | ☐ | ☐ | ☐ |
| Boutique | ☐ | ☐ | ☐ | ☐ |
| Trade | ☐ | ☐ | ☐ | ☐ |
| CRM (warn without Sales) | ☐ | ☐ | ☐ | ☐ |
| Projects | ☐ | ☐ | ☐ | ☐ |
| Full | ☐ | ☐ | ☐ | ☐ |

## Per-cell checks

- [ ] Installer / compose starts without error
- [ ] Flags API returns expected enabled modules for bundle
- [ ] Shell routes only show entitled modules (see [`strangler-flags.md`](strangler-flags.md))
- [ ] Login and session persist across refresh
- [ ] License mock / consume path succeeds at app start (desktop + cloud)
- [ ] Contract tests pass for enabled service OpenAPI stubs
- [ ] CRM bundle shows Sales warning when Sales not selected
- [ ] Sales degraded banner when `DEGRADED_PENDING` is true (see `services/sales/degraded.py`)

## Automated suites

| Suite | Command / location | Notes |
|-------|-------------------|-------|
| Contract tests | `pytest tests/contracts/` (when added) | Per-service OpenAPI vs consumer |
| License mock | TBD env `VAYBOOKS_LICENSE_MOCK=1` | No outbound license portal in CI |
| Electron smoke | `cd desktop && npm start` after `-Mode Desktop` | Window loads 5175 or 5173; `vaybooksDesktop.isDesktop === true` |

## Regression gates

- [ ] Streamlit legacy mode still runs via `.\restart_vaybooks.ps1 -Mode Streamlit` until cutover
- [ ] `restart_bms.ps1` deprecation wrapper delegates to `restart_vaybooks.ps1`
- [ ] Parity checklist ([`parity-checklist.md`](parity-checklist.md)) updated for each migrated route
