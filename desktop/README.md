# VayBooks Desktop (Electron)

Desktop shell that wraps the VayBooks web UI. Packaged builds load the combined API origin; development can use Vite.

## Prerequisites

- Node.js 18+
- For local API: VayBooks combined process on `http://127.0.0.1:8000`

## Development

```powershell
# From vaybooks/
.\restart_vaybooks.ps1 -Mode Desktop

cd web
npm run dev:desktop

cd ../desktop
npm install
npm start
```

Unpackaged Electron probes Vite on `5175` then `5173`.

## Production / installer

```powershell
cd desktop
npm install
npm run pack
# Output: dist/win-unpacked/VayBooks.exe (productName VayBooks, appId com.vaybooks.bms)
```

Packaged Electron reads `API_BASE_URL` / `VAYBOOKS_UI_URL` from the environment or `%VAYBOOKS_DATA_DIR%\config\config.toml`, defaulting to `http://127.0.0.1:8000/`.

## Environment

| Variable | Purpose |
|----------|---------|
| `VAYBOOKS_UI_URL` / `API_BASE_URL` | UI origin (local API or remote host) |
| `VAYBOOKS_DATA_DIR` | Config/data directory |
| `VAYBOOKS_UI_ROOT` | (API service) path to staged `ui/` static files |

## Security

- `contextIsolation: true`
- `nodeIntegration: false`
- AppUserModelID: `com.vaybooks.bms`
