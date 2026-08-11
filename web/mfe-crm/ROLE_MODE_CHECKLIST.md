# CRM program DoD — role × mode matrix

**Bar is met when:** automated smokes pass **and** this matrix is filled against role presets + mode packs.

Roles map to entitlements catalog presets:
- **Rep** = `ROLE_SALES_REP`
- **Mgr** = `ROLE_SALES_MANAGER`
- **Admin** = `ROLE_CRM_ADMIN`

Modes use `useCrmFieldVisibility` defaults:
- **trade** → gstin_address, sku_interest, collections
- **light** → (none)
- **boutique** → appointment_duration

Legend: **✓** = expected pass for that role×mode · **N/A** = blocked by design (missing permission or pack)

## Automated coverage

| Gate | Result | How |
|---|---|---|
| CRM API suite | Pass | `python -m pytest tests/test_crm_api.py tests/test_crm_collections_aging.py -q` |
| mfe-crm unit smokes | Pass (6) | `npm run test -w mfe-crm` |
| mfe-crm typecheck | Pass | `tsc -p mfe-crm --noEmit` |

## Matrix (filled from role presets + pack gates)

| Scenario | Rep × trade | Mgr × trade | Admin × light | Rep × boutique |
|---|---|---|---|---|
| Lead create with pack-visible commercial fields | ✓ GSTIN/SKU shown | ✓ GSTIN/SKU shown | ✓ create works; packs empty so address/GSTIN hidden | ✓ create works; boutique packs hide GSTIN/SKU |
| Lead Active → soft-delete → Deleted chip → Restore | N/A (no `crm.leads.delete`) | N/A (no `crm.leads.delete`) | ✓ (`crm.*`) | N/A (no `crm.leads.delete`) |
| Enquiry create quotation blocked without customer | ✓ | ✓ | ✓ | ✓ |
| Activity Corrections queue + Mark corrected | ✓ (`crm.activities.*`) | ✓ | ✓ | ✓ (+ duration field if scheduling) |
| Calendar create/event Drawer; drag if kill switch on | ✓ view/edit | ✓ `crm.calendar.*` | ✓ | ✓ view/edit |
| Collections visible only when pack on; aging when dues exist | ✓ pack on | ✓ pack on | N/A pack off → empty state + settings link | N/A pack off → empty state |
| Customer CRM tab 360 (counts, timeline, quick actions) | ✓ customers + CRM view | ✓ | ✓ | ✓ |
| Saved list view save/load on Leads | ✓ | ✓ | ✓ | ✓ |
| Reports run + drilldown + CSV (if export perm) | ✓ run/drilldown; CSV N/A (no export) | ✓ including export | ✓ including export | ✓ run/drilldown; CSV N/A |
| Settings: mode/packs/catalog chips save (Admin) | N/A (no settings.edit) | N/A (settings.view only) | ✓ (`crm.*`) | N/A (no settings.edit) |

### Notes by cell group
- Soft-delete/restore is Admin-only under current presets; Rep/Mgr keep Active lists only.
- Collections requires `collections` pack (trade); light/boutique correctly show “not enabled”.
- Boutique mode surfaces `appointment_duration` on activity create/detail; trade/light do not by default.
- Manager can export reports; Rep cannot — CSV button gated by `crm.reports.export`.

## Smoke scripts

```bash
cd vaybooks && python -m pytest tests/test_crm_api.py tests/test_crm_collections_aging.py -q
cd vaybooks/web && npm run test -w mfe-crm
```

## Sign-off

- Date: 2026-08-10
- Method: **Code-path verification** against `catalog.py` role presets + `useCrmFieldVisibility` / `useCrmCan` gates (not live multi-user browser session)
- Automated gates: **Pass**
- Build / commit: `ab54613` on `ui-migration-to-react` (PR #2)
- Result: **Matrix filled · program DoD satisfied for implementation**  
  Optional follow-up: spot-check one Rep×trade and one Admin×light path in a running env if desired.
