# License consume (app-start)

VayBooks verifies license status on app start via `POST /api/license/verify`. Outcomes drive client `licenseSlice` status and server-side blocking.

## Outcome table

| Outcome | Client status | Server behavior |
|---------|---------------|-----------------|
| Valid | `success` | Allow app; business APIs permitted |
| Proper expired (+ cooling + expiry) | `in_cooling_period` | Notify user; prompt for new license; set `cooling_ends_at` |
| 404 / network / 5xx / malformed | `skipped` | Allow app (no cooling window created) |
| Revoked / invalid key | `expired` (after renew blocked) | Force renew; blocked until valid key submitted |
| Seat exceeded | `success` + notify | Notify user; allow renew/upgrade of seats |

## Cooling vs skip

- Only a **proper expired** response sets `cooling_ends_at` and `expiry`.
- A **skip** never creates an expiry or cooling window.
- On each app start, if `now_utc >= cooling_ends_at`, status becomes `expired` and login/business use is blocked — even if that day's remote call is skipped.

## When expired

- Business APIs return **403 Forbidden**.
- **Allowlist** (still reachable):
  - `GET /api/license/status`
  - `POST /api/license/verify`
  - `POST /api/license/renew`
  - `POST /api/auth/logout`
  - `GET /health`
  - Module health stubs: `GET /api/{module}/health`

## Phase 1 stub env vars

| Variable | Effect |
|----------|--------|
| `LICENSE_API_URL` | External verify URL; unset → `skipped` |
| `LICENSE_FORCE_EXPIRED=1` | Simulate proper expired → `in_cooling_period` |
| `LICENSE_FORCE_REVOKED=1` | Simulate revoked/invalid key |
| `LICENSE_FORCE_SEAT_EXCEEDED=1` | Simulate seat exceeded (notify, renew OK) |
| `LICENSE_COOLING_DAYS` | Cooling window length (default 7) |

## Accepted v1 risk

If the remote license API is permanently unavailable (always 404/errors), verification stays **`skipped`** forever and the org never enters cooling/expired via remote signal. Mitigation: operator monitoring + optional forced expiry policy in a later release.

## Renew flow

1. User submits key via `POST /api/license/renew`.
2. Server re-runs consume logic.
3. On success, status → `success` and business APIs unlock.

Seat-exceeded does **not** block renew/upgrade; user is notified and can submit an updated key.
