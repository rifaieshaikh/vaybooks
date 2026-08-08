# VayBooks Phase 0 — Platform Packages

Phase 0 introduces shared platform packages under `packages/` alongside the
existing `vaybooks.bms` monolith. These packages provide stable contracts for
the desktop → web migration without moving domain logic yet.

## Layout

```
packages/
├── reexports/      # Step A shims → vaybooks.bms.domain / .application
├── events/           # Canonical integration event registry
├── auth_cache/       # Permission cache (in-process + Redis)
├── outbox/           # Transactional outbox model + stores
├── timeutil/         # UTC datetime helpers
├── flags/            # Module enablement flags (bootstrap)
└── tools/            # Migration utilities (parity checklist generator)
```

## Package roles

| Package | Purpose |
|---------|---------|
| **reexports** | Stable import paths while code stays in `vaybooks.bms`. |
| **events** | Named, versioned domain/integration events (`EVENT_REGISTRY`). |
| **auth_cache** | `PermissionCache` protocol; desktop uses `InProcessPermissionCache`, web uses `RedisPermissionCache`. |
| **outbox** | Reliable event dispatch via `OutboxMessage` + `OutboxStore` backends. |
| **timeutil** | Consistent UTC timestamps (`utc_now`, `to_utc`). |
| **flags** | In-memory module toggles until entitlements service is wired. |

## Conventions

- **Python 3.11+** — uses `dict | None`, `@dataclass(slots=True)`, etc.
- **Imports** — run from the `vaybooks/` repo root with it on `PYTHONPATH`:
  `python -m packages.tools.generate_parity_checklist`
- **Catalog** — `MODULE_STORE` added to `vaybooks.bms.domain.entitlements.catalog`.
- **Web transactions** — Mongo outbox `append` should join business writes in a
  multi-document transaction when a replica set is available.

## Next phases

1. Move domain modules from `vaybooks.bms.domain` into `packages/` gradually.
2. Wire outbox dispatcher to publish registered events.
3. Replace `FlagsService` with entitlements/plan resolution.
4. Mark routes migrated in `docs/parity-checklist.md` as web parity is achieved.
