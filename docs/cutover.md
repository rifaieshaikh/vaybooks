# Cutover Plan

The UI is the React shell. The combined FastAPI process is the application server.

## Preconditions

- [ ] [`parity-checklist.md`](parity-checklist.md) — all in-scope routes marked migrated for target bundle(s)
- [ ] [`qa-matrix.md`](qa-matrix.md) — bundle × Redis × Mongo matrix green
- [ ] Contract tests passing for enabled modules
- [ ] Installer uses [`vaybooks/installer`](../installer) only ([`MIGRATION.md`](../installer/MIGRATION.md))
- [ ] Root [`zahcci/installer`](../../installer) marked deprecated, no new releases

## Cutover steps

1. **Default dev entry** — `restart_vaybooks.ps1 -Mode Dev`.
2. **Pilot bundle** — Trade or Boutique tenant on the web stack with Redis + remote Mongo.
3. **Desktop pilot** — Electron + combined API + `npm run dev:desktop`; verify `vaybooksDesktop.isDesktop`.
4. **License consume** — app-start verification on desktop and cloud.
5. **Data migration** — monolith DB → per-service DBs ([`tenancy.md`](tenancy.md)).
6. **Traffic switch** — point users to the Vite shell URL.

## Retired UI

- Windows service runs `python -m services.combined` (see `installer/windows/nssm/install_service.ps1`).
- Docker and cloud docs start the combined API on port 8000 ([`cloud-deployment.md`](cloud-deployment.md)).

## Rollback

Rollback = restore the Mongo backup and redeploy the previous release artifact.

## Success criteria

- All installed bundles match [`bundles.json`](../installer/bundles.json) module sets
- Flags API drives nav for every migrated module ([`strangler-flags.md`](strangler-flags.md))
- Sales module respects `DEGRADED_PENDING` until inventory + finance consumers healthy
- Electron production build loads desktop-compose bundle without Node in renderer

## Timeline reference

| Phase | Scope |
|-------|--------|
| 1c | Electron scaffold, restart scripts, installer bundles doc |
| 3 | Compose, tenancy, files, observability, QA matrix, cutover |
