# VayBooks-BMS Installation Guide

## System Requirements

### Windows (recommended)
- Windows 10/11 or Windows Server 2019+
- 4 GB RAM minimum (8 GB recommended with local MongoDB + local API)
- 2 GB+ free disk space (more if installing local MongoDB)

### macOS / Linux
- See platform scripts in `installer/macos/` and `installer/linux/`

## Windows Installation (Electron)

The installer ships the **VayBooks Electron** desktop app. Streamlit is not registered as the installed product.

### Interactive install

1. Download `VayBooks-BMS-Setup-{version}.exe` from [GitHub Releases](https://github.com/rifaieshaikh/bms/releases)
2. Run the installer and accept the license
3. **Backend**
   - **Local** — installs the combined API service on this PC (`http://127.0.0.1:8000`)
   - **Remote** — thin client only; enter `API_BASE_URL`. The host must expose `/health` and serve the VayBooks web UI as `text/html` at `/` (plus `/api`)
4. **Database** (local backend only)
   - **Install MongoDB** — MSI local install (`mongodb://localhost:27017`)
   - **Existing** — connection string + database name
5. **Business / modules / admin / license** (local backend only) — company profile, module selection (including Production), owner account, optional license key (fail-soft)
6. Finish — shortcuts are created; launch VayBooks (Electron). To pin to the taskbar: Start Menu → VayBooks-BMS → right-click → Pin to taskbar.

**Note:** Switching between local and remote modes after install is not supported in v1 — uninstall/reinstall with the desired mode.

### Silent install

```powershell
# Local API + existing Mongo
VayBooks-BMS-Setup-1.0.0.exe /SILENT `
  /BACKEND=local `
  /MONGO=existing `
  /MONGO_URI="mongodb+srv://..." `
  /DB_NAME="zahcci_customization" `
  /MODULES="core,parties,inventory,sales,purchases,finance,settings" `
  /ADMIN_USER="owner" `
  /ADMIN_PASS="ChangeMe!" `
  /LEGAL_NAME="My Company"

# Local API + install Mongo
VayBooks-BMS-Setup-1.0.0.exe /SILENT /BACKEND=local /MONGO=install /ADMIN_USER=owner /ADMIN_PASS=ChangeMe!

# Remote thin client (Electron only)
VayBooks-BMS-Setup-1.0.0.exe /SILENT /BACKEND=remote /API_BASE_URL="https://vaybooks.example.com"
```

Silent installs apply the same component selection as the UI (`electron` only for remote; `electron+api` for local; `mongodb` when `/MONGO=install`).

## What Gets Installed

| Location | Contents |
|----------|----------|
| `C:\Program Files\VayBooks-BMS\electron\` | Packaged Electron app (`win-unpacked\VayBooks.exe`) |
| `C:\Program Files\VayBooks-BMS\app\` + `python\` + `ui\` | Local combined API + UI (local backend only) |
| `C:\ProgramData\VayBooks-BMS\` | Config (`config.toml`, `setup.json`), logs, uploads, backups |

## Shortcuts

- **Desktop / Start Menu:** `VayBooks-BMS` — starts the local API service when needed, then opens Electron
- Remote mode opens Electron against `API_BASE_URL` only (no local Windows service)

## Windows Service (local backend)

Service name `VayBooksBMS`:
- Runs `python -m services.combined` on `127.0.0.1:8000`
- Serves packaged UI from `ui\` at `/`
- Logs to `C:\ProgramData\VayBooks-BMS\logs\service.log`

## Uninstall

- Settings → Apps → VayBooks-BMS, or Start Menu uninstaller
- Choose whether to keep ProgramData

## Building from Source

See [installer/README.md](../installer/README.md).
