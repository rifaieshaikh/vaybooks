# Cloud setup wizard

First-run org configuration for cloud (and any install where `OrgEntitlement.setup_completed` is false). Desktop Inno bootstrap completes the same path so the React modal does not appear after a successful local install.

## Trigger

- After login, the shell calls `GET /api/setup/status`.
- If `setup_completed` is false, a **blocking** modal is shown **before** the main app layout (no nav flash).
- Completing the wizard calls `POST /api/setup/complete` (idempotent if already done).

## Multi-tenant orgs

- One organization = one `org_id`, one business profile, one entitlement document.
- Create an org (platform only):

```http
POST /api/orgs
X-Platform-Key: <PLATFORM_API_KEY>
{
  "org_id": "acme",
  "org_name": "Acme Ltd",
  "owner": { "username": "owner", "password": "...", "display_name": "Owner" }
}
```

- Login with `{ "username", "password", "org_id": "acme" }`. JWT includes `org_id`.
- Seeded chart of accounts and counters are tagged with `org_id`.

## Desktop

Installer [`bootstrap_setup.py`](../installer/windows/scripts/bootstrap_setup.py) calls the shared `complete_org_setup` helper for `org_id=default`, sets entitlement `setup_completed=true`, and writes `SETUP_COMPLETED = true` in `config.toml`.

## API gate

Authenticated `/api/*` calls (except allowlisted auth/setup/license/orgs) return **403** `{ "code": "SETUP_REQUIRED" }` until setup is complete.

## Related

- Shared helper: `vaybooks/bms/application/setup/bootstrap.py`
- Tenancy context: `packages/tenancy/context.py`
