# VayBooks-BMS Installer Build Guide

## Prerequisites

### Windows
- Python 3.11+
- Node.js 18+ (for Electron + desktop-compose UI builds)
- [Inno Setup 6](https://jrsoftware.org/ishelp/)
- Internet access (downloads Python embeddable, NSSM, MongoDB MSI)

### All platforms
- Git
- pip

## Quick Build (Windows)

```powershell
cd installer

# Install build tools
pip install -r requirements-installer.txt
pip install -r ../requirements.txt
pip install -r ../requirements-desktop.txt

# Stage application payload (embedded Python, app, UI, Electron, tools)
python shared/build_app.py --output dist/staging

# Compile installer (requires Inno Setup)
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" windows/inno/VayBooks-BMS.iss

# Generate checksum
python shared/generate_checksum.py dist/VayBooks-BMS-Setup-1.0.0.exe
```

Output: `installer/dist/VayBooks-BMS-Setup-{version}.exe`

Staging layout:

```
dist/staging/
  electron/win-unpacked/VayBooks.exe
  ui/                 # desktop-compose production build
  python/             # embeddable Python
  app/                # services + vaybooks (combined API)
  tools/              # nssm, VayBooks-Launcher
  scripts/            # post_install, bootstrap_setup, validators
  nssm/
  downloads/mongodb.msi
```

## Wizard / silent flags

| Flag | Meaning |
|------|---------|
| `/BACKEND=local\|remote` | Local combined API or thin-client Electron |
| `/API_BASE_URL=` | Required for remote; host must serve UI + `/api` + `/health` |
| `/MONGO=install\|existing` | Local backend only (`local` accepted as alias of install) |
| `/MONGO_URI=` `/DB_NAME=` | Existing Mongo |
| `/MODULES=` | Comma-separated module ids |
| `/ADMIN_USER=` `/ADMIN_PASS=` `/LEGAL_NAME=` `/LICENSE_KEY=` | Local bootstrap |

Secrets are written to `%ProgramData%\VayBooks-BMS\config\setup.json` (ACL'd), not passed through to bootstrap CLI.

## Version Management

```powershell
python shared/generate_version.py --version 1.0.1
python shared/generate_version.py
```

## Publish version.json

```powershell
python shared/publish_release.py `
  --download-url "https://github.com/rifaieshaikh/bms/releases/download/v1.0.0/VayBooks-BMS-Setup-1.0.0.exe" `
  --sha256 "<hex>" `
  --release-notes "## 1.0.0`n- Electron installer" `
  --output dist/version.json
```

## Notes

- Canonical installer tree is `vaybooks/installer` (not the deprecated repo-root `installer/`).
- GA release should wait on Trade or Boutique React parity (see `docs/cutover.md`).
- Local↔remote mode switch after install is out of scope for v1.
