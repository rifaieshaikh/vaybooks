import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  useGetKeyboardShortcutsQuery,
  useUpdateKeyboardShortcutsMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityListEmpty,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  ErrorText,
  eventChord,
  formatChordHint,
} from '@vaybooks/ui-kit';
import { extractError } from '../utils';
import './KeyboardShortcuts.css';

type CatalogItem = {
  key?: string;
  nav_key?: string;
  action_id?: string;
  label: string;
  group: string;
  locked?: boolean;
  destructive?: boolean;
  mouse_only?: boolean;
  unbound_stub?: boolean;
  default_chord?: string;
};

type ShortcutRow = {
  id: string;
  kind: 'parent' | 'action';
  key: string;
  label: string;
  group: string;
  locked: boolean;
  mouseOnly: boolean;
  unbound: boolean;
  destructive: boolean;
  chord: string;
  defaultChord: string;
  dirty: boolean;
  catalogIndex: number;
};

/** Stable section order for the settings page (matches app nav domains). */
const SECTION_ORDER = [
  'Home',
  'Parties',
  'CRM',
  'Boutique',
  'Business Ops',
  'Projects',
  'Sales',
  'Purchases',
  'Inventory',
  'Production',
  'Finance',
  'Business',
  'Settings',
  'Access',
  'Schedulers',
  'Migration',
  'System',
  'Customers',
  'Vendors',
  'Orders',
  'Items',
  'List',
  'Dialog',
  'Form',
  'Navigation',
  'Dashboard',
  'Reports',
  'Export',
  'Customization',
  'Other',
];

/** Display labels when catalog metadata is missing (legacy key names). */
const LABEL_ALIASES: Record<string, string> = {
  workers_list: 'Employees',
  mtd_dashboard: 'MTD',
  purchases_list: 'Bills',
  inventory_stock_list: 'Stock',
  sales_orders_list: 'Orders',
  sales_invoices_list: 'Invoices',
  sales_returns_list: 'Returns',
};

function catalogKey(meta: CatalogItem): string {
  return String(meta.key || meta.nav_key || meta.action_id || '').trim();
}

function inferGroup(kind: 'parent' | 'action', key: string): string {
  if (kind === 'action') {
    if (key.startsWith('list.')) return 'List';
    if (key.startsWith('dialog.')) return 'Dialog';
    if (key.startsWith('form.')) return 'Form';
    if (key.startsWith('nav.')) return 'Navigation';
    if (key.startsWith('customers.')) return 'Customers';
    if (key.startsWith('vendors.')) return 'Vendors';
    if (key.startsWith('orders.') || key.startsWith('items.')) return key.startsWith('orders.') ? 'Orders' : 'Items';
    if (key.startsWith('sales.')) return 'Sales';
    if (key.startsWith('purchases.')) return 'Purchases';
    if (key.startsWith('finance.')) return 'Finance';
    if (key.startsWith('system.')) return 'System';
    if (key.startsWith('migration.')) return 'Migration';
    if (key.startsWith('export.')) return 'Export';
    if (key.startsWith('reports.')) return 'Reports';
    if (key.startsWith('dashboard.')) return 'Dashboard';
    if (key.startsWith('settings.')) return 'Settings';
    return 'Other';
  }
  if (key === 'dashboard' || key === 'mtd_dashboard') return 'Home';
  if (
    key.startsWith('customers') ||
    key.startsWith('vendors') ||
    key.startsWith('workers') ||
    key.startsWith('segments') ||
    key.startsWith('delivery_partners') ||
    key.startsWith('commission_agents')
  ) {
    return 'Parties';
  }
  if (key.startsWith('crm_')) return 'CRM';
  if (
    key.startsWith('boutique') ||
    key === 'orders_list' ||
    key === 'items_list' ||
    key === 'measurements_list' ||
    key === 'time_list' ||
    key === 'time_log' ||
    key === 'calendar_list'
  ) {
    return 'Boutique';
  }
  if (key.startsWith('business_ops') || key === 'store_time_list') return 'Business Ops';
  if (key.startsWith('project')) return 'Projects';
  if (key.startsWith('sales') || key === 'estimates_list' || key === 'quotations_list' || key === 'delivery_notes_list') {
    return 'Sales';
  }
  if (key.startsWith('purchase') || key === 'goods_receipt_list') return 'Purchases';
  if (key.startsWith('inventory')) return 'Inventory';
  if (key.startsWith('production')) return 'Production';
  if (
    key.startsWith('finance') ||
    key === 'accounts_list' ||
    key === 'vouchers_list' ||
    key === 'receipts_list' ||
    key === 'payments_list' ||
    key === 'credit_notes_list' ||
    key === 'debit_notes_list' ||
    key === 'accounting_invoices_list' ||
    key === 'journal_list' ||
    key === 'trial_balance_list' ||
    key === 'reports' ||
    key === 'export_backup'
  ) {
    return 'Finance';
  }
  if (key.startsWith('schedulers_')) return 'Schedulers';
  if (key === 'data_migration' || key.startsWith('migration')) return 'Migration';
  if (key.startsWith('users_') || key.startsWith('roles_') || key.startsWith('permissions_') || key === 'audit_logs' || key.startsWith('plans_') || key.startsWith('feature_flags')) {
    return 'Access';
  }
  if (key.startsWith('system_')) return 'System';
  if (key === 'business_settings' || key === 'settings_locations_list' || key === 'store_time_settings') return 'Business';
  if (key.includes('settings') || key.includes('activities') || key === 'services_list' || key === 'discounts_list' || key === 'keyboard_shortcuts' || key === 'print_settings' || key === 'measurement_specs') {
    return 'Settings';
  }
  return 'Other';
}

function sectionRank(group: string): number {
  const i = SECTION_ORDER.indexOf(group);
  return i >= 0 ? i : SECTION_ORDER.length;
}

function humanizeKey(key: string): string {
  if (LABEL_ALIASES[key]) return LABEL_ALIASES[key];
  return key
    .replace(/^[a-z]+\./, '')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function captureChord(e: ReactKeyboardEvent<HTMLInputElement>): string | null {
  const chord = eventChord(e.nativeEvent);
  if (!chord) return null;
  if (['ctrl', 'alt', 'shift', 'meta'].includes(chord)) return null;
  e.preventDefault();
  e.stopPropagation();
  return chord;
}

function buildRows(
  catalogParents: CatalogItem[],
  catalogActions: CatalogItem[],
  parents: Record<string, string>,
  actions: Record<string, string>,
  parentDraft: Record<string, string>,
  actionDraft: Record<string, string>,
): ShortcutRow[] {
  const rows: ShortcutRow[] = [];
  const seenParents = new Set<string>();
  const seenActions = new Set<string>();

  catalogParents.forEach((meta, index) => {
    const key = catalogKey(meta);
    if (!key) return;
    seenParents.add(key);
    const saved = parents[key] ?? meta.default_chord ?? '';
    const current = parentDraft[key] ?? saved;
    rows.push({
      id: `parent:${key}`,
      kind: 'parent',
      key,
      label: meta.label || humanizeKey(key),
      group: meta.group || inferGroup('parent', key),
      locked: Boolean(meta.locked),
      mouseOnly: false,
      unbound: !(meta.default_chord || parents[key]),
      destructive: false,
      chord: current,
      defaultChord: meta.default_chord || '',
      dirty: key in parentDraft && parentDraft[key] !== saved,
      catalogIndex: index,
    });
  });

  catalogActions.forEach((meta, index) => {
    const key = catalogKey(meta);
    if (!key) return;
    seenActions.add(key);
    const saved = actions[key] ?? meta.default_chord ?? '';
    const current = actionDraft[key] ?? saved;
    rows.push({
      id: `action:${key}`,
      kind: 'action',
      key,
      label: meta.label || humanizeKey(key),
      group: meta.group || inferGroup('action', key),
      locked: Boolean(meta.mouse_only),
      mouseOnly: Boolean(meta.mouse_only),
      unbound: Boolean(meta.unbound_stub),
      destructive: Boolean(meta.destructive),
      chord: current,
      defaultChord: meta.default_chord || '',
      dirty: key in actionDraft && actionDraft[key] !== saved,
      catalogIndex: 10_000 + index,
    });
  });

  // Orphan bindings not in catalog (legacy / custom) — still infer a real section
  let orphanIndex = 20_000;
  for (const [key, chord] of Object.entries(parents)) {
    if (seenParents.has(key)) continue;
    const current = parentDraft[key] ?? chord;
    rows.push({
      id: `parent:${key}`,
      kind: 'parent',
      key,
      label: humanizeKey(key),
      group: inferGroup('parent', key),
      locked: false,
      mouseOnly: false,
      unbound: false,
      destructive: false,
      chord: current,
      defaultChord: chord,
      dirty: key in parentDraft && parentDraft[key] !== chord,
      catalogIndex: orphanIndex++,
    });
  }
  for (const [key, chord] of Object.entries(actions)) {
    if (seenActions.has(key)) continue;
    const current = actionDraft[key] ?? chord;
    rows.push({
      id: `action:${key}`,
      kind: 'action',
      key,
      label: humanizeKey(key),
      group: inferGroup('action', key),
      locked: false,
      mouseOnly: false,
      unbound: false,
      destructive: false,
      chord: current,
      defaultChord: chord,
      dirty: key in actionDraft && actionDraft[key] !== chord,
      catalogIndex: orphanIndex++,
    });
  }

  rows.sort((a, b) => {
    const g = sectionRank(a.group) - sectionRank(b.group);
    if (g !== 0) return g;
    if (a.kind !== b.kind) return a.kind === 'parent' ? -1 : 1;
    return a.catalogIndex - b.catalogIndex || a.label.localeCompare(b.label);
  });

  return rows;
}

export function KeyboardShortcutsPage() {
  const { data, isLoading, error, refetch } = useGetKeyboardShortcutsQuery();
  const [update, updateState] = useUpdateKeyboardShortcutsMutation();
  const [parentDraft, setParentDraft] = useState<Record<string, string>>({});
  const [actionDraft, setActionDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'parent' | 'action'>('all');
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState<'ok' | 'err'>('ok');

  const parents = (data?.parents as Record<string, string>) || {};
  const actions = (data?.actions as Record<string, string>) || {};
  const catalog = (data?.catalog || {}) as {
    parents?: CatalogItem[];
    actions?: CatalogItem[];
  };

  useEffect(() => {
    setParentDraft({});
    setActionDraft({});
  }, [data]);

  const rows = useMemo(
    () =>
      buildRows(
        catalog.parents || [],
        catalog.actions || [],
        parents,
        actions,
        parentDraft,
        actionDraft,
      ),
    [catalog.parents, catalog.actions, parents, actions, parentDraft, actionDraft],
  );

  const pageCount = useMemo(() => rows.filter((r) => r.kind === 'parent').length, [rows]);
  const actionCount = useMemo(() => rows.filter((r) => r.kind === 'action').length, [rows]);

  const groups = useMemo(() => {
    const present = new Set(rows.map((r) => r.group));
    const ordered = SECTION_ORDER.filter((g) => present.has(g));
    for (const g of present) {
      if (!ordered.includes(g)) ordered.push(g);
    }
    return ['all', ...ordered];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (groupFilter !== 'all' && row.group !== groupFilter) return false;
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        row.label.toLowerCase().includes(q) ||
        row.key.toLowerCase().includes(q) ||
        row.chord.toLowerCase().includes(q) ||
        row.group.toLowerCase().includes(q)
      );
    });
  }, [rows, search, groupFilter, kindFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutRow[]>();
    for (const row of filtered) {
      const list = map.get(row.group) || [];
      list.push(row);
      map.set(row.group, list);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => sectionRank(a) - sectionRank(b) || a.localeCompare(b),
    );
  }, [filtered]);

  const dirtyCount = useMemo(
    () => Object.keys(parentDraft).length + Object.keys(actionDraft).length,
    [parentDraft, actionDraft],
  );

  function savedChord(row: ShortcutRow): string {
    if (row.kind === 'parent') return parents[row.key] ?? row.defaultChord ?? '';
    return actions[row.key] ?? row.defaultChord ?? '';
  }

  function setChord(row: ShortcutRow, next: string) {
    if (row.mouseOnly || row.locked) return;
    const normalized = next.trim().toLowerCase();
    const baseline = savedChord(row);
    if (row.kind === 'parent') {
      setParentDraft((d) => {
        const copy = { ...d };
        if (normalized === baseline) delete copy[row.key];
        else copy[row.key] = normalized;
        return copy;
      });
    } else {
      setActionDraft((d) => {
        const copy = { ...d };
        if (normalized === baseline) delete copy[row.key];
        else copy[row.key] = normalized;
        return copy;
      });
    }
  }

  function resetRow(row: ShortcutRow) {
    setChord(row, row.defaultChord || '');
  }

  function discardAll() {
    setParentDraft({});
    setActionDraft({});
    setMsg('');
  }

  async function onSave() {
    setMsg('');
    try {
      const nextParents: Record<string, string> = {};
      const nextActions: Record<string, string> = {};
      for (const [key, chord] of Object.entries(parentDraft)) {
        if (!chord.trim()) {
          setMsgTone('err');
          setMsg(`Page shortcut for ${key} cannot be empty.`);
          return;
        }
        nextParents[key] = chord;
      }
      for (const [key, chord] of Object.entries(actionDraft)) {
        if (!chord.trim()) {
          setMsgTone('err');
          setMsg(`Action shortcut for ${key} cannot be empty.`);
          return;
        }
        nextActions[key] = chord;
      }
      await update({
        parents: { ...parents, ...nextParents },
        actions: { ...actions, ...nextActions },
      }).unwrap();
      setParentDraft({});
      setActionDraft({});
      setMsgTone('ok');
      setMsg('Shortcuts saved');
      refetch();
    } catch (e) {
      setMsgTone('err');
      setMsg(extractError(e));
    }
  }

  return (
    <EntityListPage className="kb-page">
      <EntityListHero
        kicker="Settings"
        title="Keyboard shortcuts"
        count={`${pageCount} pages · ${actionCount} actions`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={updateState.isLoading || dirtyCount === 0}
            >
              {updateState.isLoading ? 'Saving…' : dirtyCount ? `Save ${dirtyCount}` : 'Saved'}
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, key, chord, or section…"
            aria-label="Search shortcuts"
          />
        }
        chips={
          <div className="kb-filters" role="group" aria-label="Shortcut filters">
            <div className="el-seg" role="group" aria-label="Kind">
              {(
                [
                  ['all', 'All'],
                  ['parent', `Pages (${pageCount})`],
                  ['action', `Actions (${actionCount})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={kindFilter === id}
                  onClick={() => setKindFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
        summary={
          <p className="kb-lead">
            Pages and actions are grouped by domain (Parties, CRM, Sales, and so on). Click a
            shortcut field and press the keys you want — conflicts are checked on save.
          </p>
        }
      />

      <div className="kb-groups" role="tablist" aria-label="Shortcut sections">
        {groups.map((g) => {
          const count =
            g === 'all' ? rows.length : rows.filter((r) => r.group === g).length;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={groupFilter === g}
              className={groupFilter === g ? 'kb-group-chip is-active' : 'kb-group-chip'}
              onClick={() => setGroupFilter(g)}
            >
              {g === 'all' ? `All sections (${rows.length})` : `${g} (${count})`}
            </button>
          );
        })}
      </div>

      {isLoading ? <EntityListLoading>Loading shortcuts…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load shortcuts.</ErrorText> : null}

      {!isLoading && !error && filtered.length === 0 ? (
        <EntityListEmpty>
          <strong>No matching shortcuts</strong>
          <p>Try another search or section filter.</p>
        </EntityListEmpty>
      ) : null}

      <div className="kb-sections">
        {grouped.map(([group, items]) => {
          const pageItems = items.filter((r) => r.kind === 'parent');
          const actionItems = items.filter((r) => r.kind === 'action');
          return (
            <section key={group} className="kb-section" id={`kb-section-${group}`}>
              <header className="kb-section-head">
                <h2>{group}</h2>
                <span>
                  {pageItems.length ? `${pageItems.length} page${pageItems.length === 1 ? '' : 's'}` : ''}
                  {pageItems.length && actionItems.length ? ' · ' : ''}
                  {actionItems.length
                    ? `${actionItems.length} action${actionItems.length === 1 ? '' : 's'}`
                    : ''}
                </span>
              </header>

              {pageItems.length > 0 ? (
                <div className="kb-subsection">
                  {actionItems.length > 0 ? <h3 className="kb-subhead">Pages</h3> : null}
                  <ul className="kb-list">{pageItems.map((row) => renderRow(row))}</ul>
                </div>
              ) : null}

              {actionItems.length > 0 ? (
                <div className="kb-subsection">
                  {pageItems.length > 0 ? <h3 className="kb-subhead">Actions</h3> : null}
                  <ul className="kb-list">{actionItems.map((row) => renderRow(row))}</ul>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className={`kb-footer ${dirtyCount ? 'is-dirty' : ''}`}>
        <div className="kb-footer-copy">
          {dirtyCount ? (
            <span>
              <strong>{dirtyCount}</strong> unsaved change{dirtyCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="kb-muted">All shortcuts saved</span>
          )}
          {msg ? (
            <span className={msgTone === 'ok' ? 'kb-msg-ok' : 'kb-msg-err'}>{msg}</span>
          ) : null}
        </div>
        <div className="kb-footer-actions">
          <Button type="button" variant="ghost" disabled={!dirtyCount} onClick={discardAll}>
            Discard
          </Button>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={updateState.isLoading || dirtyCount === 0}
          >
            {updateState.isLoading ? 'Saving…' : 'Save shortcuts'}
          </Button>
        </div>
      </div>
    </EntityListPage>
  );

  function renderRow(row: ShortcutRow) {
    const capturing = capturingId === row.id;
    const editable = !row.locked && !row.mouseOnly;
    return (
      <li
        key={row.id}
        className={[
          'kb-row',
          row.dirty ? 'is-dirty' : '',
          row.locked || row.mouseOnly ? 'is-locked' : '',
          capturing ? 'is-capturing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="kb-row-main">
          <div className="kb-row-title">
            <strong>{row.label}</strong>
            <span className={`kb-pill kb-pill--${row.kind}`}>
              {row.kind === 'parent' ? 'Page' : 'Action'}
            </span>
            {row.locked && !row.mouseOnly ? (
              <span className="kb-pill kb-pill--locked">Locked</span>
            ) : null}
            {row.mouseOnly ? <span className="kb-pill kb-pill--locked">Mouse only</span> : null}
            {row.unbound ? <span className="kb-pill kb-pill--locked">Unbound</span> : null}
            {row.destructive ? <span className="kb-pill kb-pill--danger">Destructive</span> : null}
            {row.dirty ? <span className="kb-pill kb-pill--dirty">Edited</span> : null}
          </div>
          <code className="kb-key">{row.key}</code>
        </div>
        <div className="kb-row-chord">
          <label className="kb-chord-label" htmlFor={row.id}>
            Shortcut
          </label>
          <div className="kb-chord-wrap">
            <input
              id={row.id}
              className="kb-chord-input"
              value={capturing ? '' : row.chord}
              placeholder={
                row.mouseOnly
                  ? 'Mouse only'
                  : capturing
                    ? 'Press keys…'
                    : 'Click, then press keys'
              }
              readOnly={editable}
              disabled={!editable}
              onFocus={() => {
                if (editable) setCapturingId(row.id);
              }}
              onBlur={() => setCapturingId((id) => (id === row.id ? null : id))}
              onChange={(e) => {
                if (editable) setChord(row, e.target.value);
              }}
              onKeyDown={(e) => {
                if (!editable) return;
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setCapturingId(null);
                  (e.target as HTMLInputElement).blur();
                  return;
                }
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  setChord(row, '');
                  return;
                }
                const chord = captureChord(e);
                if (chord) {
                  setChord(row, chord);
                  setCapturingId(null);
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            {row.chord && !capturing ? (
              <span className="kb-chord-pretty" aria-hidden="true">
                {formatChordHint(row.chord)}
              </span>
            ) : null}
          </div>
          <div className="kb-row-actions">
            <button
              type="button"
              className="kb-link"
              disabled={!editable || row.chord === (row.defaultChord || '')}
              onClick={() => resetRow(row)}
            >
              Reset
            </button>
            <button
              type="button"
              className="kb-link"
              disabled={!editable || !row.chord}
              onClick={() => setChord(row, '')}
            >
              Clear
            </button>
          </div>
        </div>
      </li>
    );
  }
}
