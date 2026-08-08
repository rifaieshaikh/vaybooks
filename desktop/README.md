# VayBooks Desktop (Electron)

Phase 1c desktop shell that wraps the Vite web UI in a hardened Electron window.

## Prerequisites

- Node.js 18+
- VayBooks API running on `http://127.0.0.1:8000` (embedded gateway / combined process)
- Vite UI running via one of:
  - `npm run dev:desktop` in `web/` → [http://127.0.0.1:5175](http://127.0.0.1:5175) (preferred)
  - `npm run dev:shell` in `web/` → [http://127.0.0.1:5173](http://127.0.0.1:5173)

## Quick start

From the `vaybooks/` repo root:

```powershell
.\restart_vaybooks.ps1 -Mode Desktop
```

In another terminal:

```powershell
cd web
npm run dev:desktop
```

Then launch Electron:

```powershell
cd desktop
npm install
npm start
```

Or use `-Mode Dev` on `restart_vaybooks.ps1` to start the API and print UI instructions.

## Environment

| Variable | Purpose |
|----------|---------|
| `VAYBOOKS_UI_URL` | Override UI URL (default: probe 5175, fallback 5173) |
| `VAYBOOKS_DATA_DIR` | Desktop data directory (files, config, local Mongo path hints) |

## Security

- `contextIsolation: true`
- `nodeIntegration: false`
- Preload exposes only `window.vaybooksDesktop.isDesktop === true`

See [`docs/security.md`](../docs/security.md) for hardening notes.
