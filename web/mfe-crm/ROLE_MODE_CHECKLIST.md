# CRM program DoD — role × mode checklist

**Bar is met when:** Phase 8 automated smokes pass **and** this checklist is completed once.

Roles: **Rep** | **Manager** | **Admin**  
Modes: **trade** | **light** | **boutique**

## Automated coverage (implementation sign-off)

| Gate | Result | How |
|---|---|---|
| CRM API suite | Pass | `python -m pytest tests/test_crm_api.py tests/test_crm_collections_aging.py -q` |
| mfe-crm unit smokes | Pass (6) | `npm run test -w mfe-crm` |
| mfe-crm typecheck | Pass | `tsc -p mfe-crm --noEmit` |

Automated smokes cover: soft-delete/restore path helpers, `?tab=` parse, status tones, Collections aging buckets, saved-view apply, list-views/collections/audit/quotation API contracts.

**Code-complete:** Yes — Phases 1–8 + plan leftovers (Collections Drawer, Vitest, this checklist).  
**Human matrix below:** still required once before calling the product bar fully met in production.

## Manual matrix

Mark each cell after manual QA (✓ / N/A).

| Scenario | Rep × trade | Mgr × trade | Admin × light | Rep × boutique |
|---|---|---|---|---|
| Lead create with pack-visible commercial fields | | | | |
| Lead Active → soft-delete → Deleted chip → Restore | | | | |
| Enquiry create quotation blocked without customer | | | | |
| Activity Corrections queue (server filter) + Mark corrected | | | | |
| Calendar create/event Drawer; drag reschedule if kill switch on | | | | |
| Collections visible only when pack on; aging buckets when dues exist | | | | |
| Customer CRM tab 360 (counts, timeline, quick actions) | | | | |
| Saved list view save/load on Leads | | | | |
| Reports run + drilldown + CSV (if export perm) | | | | |
| Settings: mode/packs/catalog chips save (Admin) | | | | |

## Smoke scripts

```bash
# API
cd vaybooks && python -m pytest tests/test_crm_api.py tests/test_crm_collections_aging.py -q

# UI unit smokes
cd vaybooks/web && npm run test -w mfe-crm
```

## Sign-off

- Date: 2026-08-10
- Implementer automated gates: **Pass**
- Human matrix tester:
- Build / commit:
- Result: **Code complete / awaiting human matrix** (notes):
