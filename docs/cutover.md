# Cutover Plan

Final migration from Streamlit monolith to React MFEs + microservices.

## Preconditions

- [ ] [`parity-checklist.md`](parity-checklist.md) — all in-scope routes marked migrated for target bundle(s)
- [ ] [`qa-matrix.md`](qa-matrix.md) — bundle × Redis × Mongo matrix green
- [ ] Contract tests passing for enabled modules
- [ ] Installer uses [`vaybooks/installer`](../installer) only ([`MIGRATION.md`](../installer/MIGRATION.md))
- [ ] Root [`zahcci/installer`](../../installer) marked deprecated, no new releases

## Cutover steps

1. **Freeze Streamlit UX** — no new Streamlit features; bugfixes only.
2. **Default dev entry** — `restart_vaybooks.ps1 -Mode Dev` documented in README; `restart_bms.ps1` prints deprecation.
3. **Pilot bundle** — Trade or Boutique tenant on web stack with Redis + remote Mongo.
4. **Desktop pilot** — Electron + combined API + `npm run dev:desktop`; verify `vaybooksDesktop.isDesktop`.
5. **License consume** — app-start verification on desktop and cloud.
6. **Data migration** — monolith DB → per-service DBs ([`tenancy.md`](tenancy.md)).
7. **Traffic switch** — point users to Vite shell URL; disable Streamlit service in installer.
8. **Retire Streamlit** — remove `-Mode Streamlit` from default docs; keep script one release cycle.

## Retire Streamlit checklist

- [ ] Inno Setup stops registering Streamlit Windows service
- [ ] `run_streamlit.bat` removed or no-op with migration notice
- [ ] Docker/cloud docs updated ([`cloud-deployment.md`](cloud-deployment.md)) — no longer `streamlit run app.py`
- [ ] `app.py` archived or thin redirect for emergency rollback window
- [ ] Support runbook updated ([`rollback-recovery.md`](rollback-recovery.md))

## Rollback

During pilot, keep Streamlit installable via `-Mode Streamlit` and last-known-good installer artifact. Rollback = restore Mongo backup + re-enable Streamlit service.

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
