# Strangler Flags (module visibility)

During the Streamlit → React cutover, **module visibility is driven by the Flags API** behind the gateway—not by hard-coded menu lists in each MFE.

## Principles

1. **Single source of truth** — Enabled modules come from org entitlements + installer bundle + plan, resolved server-side.
2. **Gateway-only** — Clients call `/api/flags` (or equivalent) through the gateway; microservices are not queried directly for menu gating.
3. **Strangler pattern** — Streamlit pages and React routes both consult the same module ids (`core`, `parties`, `sales`, …) from [`vaybooks.bms.domain.entitlements.catalog`](../vaybooks/bms/domain/entitlements/catalog.py).

## Phase 0 bootstrap

[`packages/flags`](../packages/flags/) provides `FlagsService` (in-memory) until the entitlements service is wired:

```python
from packages.flags import FlagsService

flags = FlagsService(enabled_modules=["core", "parties", "sales"])
flags.is_module_enabled("crm")  # False
```

Replace with HTTP-backed flags in Phase 1+:

```
GET /api/flags/modules → { "enabled": ["core", "parties", ...] }
```

## UI behavior

| Layer | Behavior |
|-------|----------|
| **Shell router** | Hide nav entries for disabled modules |
| **MFE lazy routes** | Do not register federated remotes for disabled modules |
| **Desktop compose** | Static bundle includes only modules selected at build/install time |
| **Deep links** | Return 403 or “module not enabled” when flag is off |

## Installer bundles

[`installer/bundles.json`](../installer/bundles.json) seeds the initial enabled set on first run. CRM bundle includes `warn_without: ["sales"]` — flags may enable CRM while Sales is off, but UI should warn on install and in settings.

## Migration checklist

- [ ] Gateway exposes flags endpoint backed by entitlements DB
- [ ] Redux `licenseSlice` / session bootstrap fetches flags after auth
- [ ] Each MFE guards routes with shared `useModuleEnabled("sales")` hook
- [ ] Parity checklist row marked when Streamlit page and React route both respect flags
