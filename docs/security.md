# Security

Security baseline for VayBooks web, cloud compose, and Electron desktop.

## Electron hardening

Desktop shell ([`desktop/electron/`](../desktop/electron/)):

| Setting | Value |
|---------|-------|
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| Preload | Minimal `contextBridge` — only `vaybooksDesktop.isDesktop` |
| Navigation | Load `http://127.0.0.1:*` only; block external URLs in `will-navigate` (Phase 1c+) |
| DevTools | Disabled in production builds |

Renderer must treat the app as untrusted web content; all secrets stay in the main process / API.

## Secrets

| Secret | Storage |
|--------|---------|
| `MONGODB_URI` | Env / installer secrets file — never in repo |
| `REDIS_URL` | Env (required cloud) |
| JWT signing key | Env or KMS |
| License key | Installer prompt → encrypted local store |
| S3 credentials | IAM role (cloud) or env |

Do not commit `.env` files. Installer uses post-install scripts to write `%ProgramData%` config.

## Authentication

- JWT issued by Auth service; validated on **every** request via gateway or embedded gateway filter.
- Short-lived access tokens; refresh rotation (Phase 1+).
- Permission cache: Redis (cloud) or in-process (desktop).

## Rate limiting

Gateway placeholders (Phase 3):

- Login: 10 req/min/IP
- API: 100 req/min/user (configurable)
- Upload: size + count limits per org

Return `429` with `Retry-After`.

## Transport

- Cloud: TLS termination at load balancer.
- Desktop: localhost only for Electron → API/UI; no mixed content.

## Dependency hygiene

- Pin Electron and Python deps in lockfiles.
- Run `pip audit` / `npm audit` in CI before release.

See also [`tenancy.md`](tenancy.md) for org isolation and [`files-storage.md`](files-storage.md) for upload boundaries.
