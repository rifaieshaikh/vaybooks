import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { FiltersDialog, SortDialog, type FilterFieldDef, type FilterValues, type SortCriterion } from './ListToolbar';
import {
  chordMatches,
  eventChord,
  formatChordHint,
  useListKeyboardBindings,
} from './ListKeyboard';
import './EntityList.css';

export type EntityListColumn<T> = {
  id: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type EntityListPageProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function EntityListPage({ children, className, style }: EntityListPageProps) {
  return (
    <div className={['el-page', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

type EntityListHeroProps = {
  kicker?: ReactNode;
  title: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
  chips?: ReactNode;
  tools?: ReactNode;
  summary?: ReactNode;
};

export function EntityListHero({
  kicker,
  title,
  count,
  actions,
  search,
  chips,
  tools,
  summary,
}: EntityListHeroProps) {
  return (
    <>
      <header className="el-hero">
        <div className="el-hero-top">
          <div>
            {kicker ? <p className="el-kicker">{kicker}</p> : null}
            <h1 className="el-title">{title}</h1>
            {count != null ? <p className="el-count">{count}</p> : null}
          </div>
          {actions ? <div className="el-hero-actions">{actions}</div> : null}
        </div>
        {search ? <div className="el-search">{search}</div> : null}
        {chips || tools ? (
          <div className="el-hero-tools">
            <div className="el-hero-chips">{chips ?? null}</div>
            {tools ? <div className="el-hero-tools-end">{tools}</div> : null}
          </div>
        ) : null}
      </header>
      {summary}
    </>
  );
}

type EntityListActionsProps = {
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDeactivate?: () => void;
  onActivate?: () => void;
  /** Emphasis action (PDF, DN create, Convert, …) — not Delete. */
  primary?: { label: string; onClick: () => void; disabled?: boolean; title?: string };
  openLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
  deactivateLabel?: string;
  activateLabel?: string;
  /** Opt-in icon buttons; default keeps text labels for other MFEs. */
  variant?: 'text' | 'icon';
};

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 7l10 10" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

export function EntityListActions({
  onOpen,
  onEdit,
  onDelete,
  onDeactivate,
  onActivate,
  primary,
  openLabel = 'Open',
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  deactivateLabel = 'Deactivate',
  activateLabel = 'Activate',
  variant = 'text',
}: EntityListActionsProps) {
  if (!onOpen && !onEdit && !onDelete && !onDeactivate && !onActivate && !primary) return null;
  const icon = variant === 'icon';
  return (
    <div className="el-actions">
      {onOpen ? (
        <button
          type="button"
          className={icon ? 'el-action-btn el-action-btn--icon' : 'el-action-btn'}
          onClick={onOpen}
          title={openLabel}
          aria-label={openLabel}
        >
          {icon ? <EyeIcon /> : openLabel}
        </button>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          className={icon ? 'el-action-btn el-action-btn--icon' : 'el-action-btn'}
          onClick={onEdit}
          title={editLabel}
          aria-label={editLabel}
        >
          {icon ? <PencilIcon /> : editLabel}
        </button>
      ) : null}
      {onDeactivate ? (
        <button
          type="button"
          className={icon ? 'el-action-btn el-action-btn--icon' : 'el-action-btn'}
          onClick={onDeactivate}
          title={deactivateLabel}
          aria-label={deactivateLabel}
        >
          {icon ? <BanIcon /> : deactivateLabel}
        </button>
      ) : null}
      {onActivate ? (
        <button
          type="button"
          className={icon ? 'el-action-btn el-action-btn--icon' : 'el-action-btn'}
          onClick={onActivate}
          title={activateLabel}
          aria-label={activateLabel}
        >
          {icon ? <CheckCircleIcon /> : activateLabel}
        </button>
      ) : null}
      {primary ? (
        <button
          type="button"
          className="el-action-btn el-action-btn--primary"
          onClick={primary.onClick}
          disabled={primary.disabled}
          title={primary.title || primary.label}
          aria-label={primary.label}
        >
          {primary.label}
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className={
            icon
              ? 'el-action-btn el-action-btn--icon el-action-btn--danger'
              : 'el-action-btn el-action-btn--danger'
          }
          onClick={onDelete}
          title={deleteLabel}
          aria-label={deleteLabel}
        >
          {icon ? <TrashIcon /> : deleteLabel}
        </button>
      ) : null}
    </div>
  );
}

export type StatusPillTone = 'neutral' | 'success' | 'warn' | 'danger';

export function statusPillTone(status: unknown): StatusPillTone {
  const s = String(status || '').toLowerCase();
  if (!s) return 'neutral';
  if (s.includes('cancel') || s.includes('reject') || s.includes('void')) return 'danger';
  if (
    s.includes('close') ||
    s.includes('deliver') ||
    s.includes('received') ||
    s.includes('paid') ||
    s.includes('accept') ||
    s.includes('convert') ||
    s.includes('approve')
  ) {
    return 'success';
  }
  if (
    s.includes('pending') ||
    s.includes('draft') ||
    s.includes('sent') ||
    s.includes('confirm') ||
    s.includes('dispatch') ||
    s.includes('partial')
  ) {
    return 'warn';
  }
  return 'neutral';
}

export function StatusPill({
  status,
  tone,
}: {
  status: unknown;
  tone?: StatusPillTone;
}) {
  const label = String(status || '').trim();
  if (!label) return <span className="el-muted">—</span>;
  const t = tone || statusPillTone(label);
  return <span className={`el-status-pill el-status-pill--${t}`}>{label}</span>;
}

type EntityListTableProps<T> = {
  columns: EntityListColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;
  /** Enable ↑/↓/j/k, Enter, e, /, n shortcuts for this table. */
  keyboardNav?: boolean;
  /** Enter — typically open detail. */
  onActivateRow?: (row: T) => void;
  /** `e` — open edit. */
  onEditRow?: (row: T) => void;
  /** `n` — create new (when not typing). */
  onNew?: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('a, button, input, select, textarea, label, [role="button"]'),
  );
}

/** Last list table the user interacted with (for multi-table pages). */
let lastActiveListTable: HTMLElement | null = null;

export function EntityListTable<T>({
  columns,
  rows,
  rowKey,
  actions,
  actionsHeader = 'Actions',
  keyboardNav = false,
  onActivateRow,
  onEditRow,
  onNew,
}: EntityListTableProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const bindings = useListKeyboardBindings();

  useEffect(() => {
    if (!keyboardNav) return;
    setActiveIdx(0);
  }, [rows, keyboardNav]);

  useEffect(() => {
    if (!keyboardNav || rows.length === 0) return;
    const row = wrapRef.current?.querySelector<HTMLElement>('tr.el-row-active');
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, keyboardNav, rows.length]);

  useEffect(() => {
    if (!keyboardNav) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    function markActive() {
      lastActiveListTable = wrap;
    }
    wrap.addEventListener('pointerdown', markActive);
    wrap.addEventListener('focusin', markActive);
    return () => {
      wrap.removeEventListener('pointerdown', markActive);
      wrap.removeEventListener('focusin', markActive);
    };
  }, [keyboardNav]);

  useEffect(() => {
    if (!keyboardNav) return;

    function onKeyDown(e: KeyboardEvent) {
      const wrap = wrapRef.current;
      const page = wrap?.closest('.el-page');
      if (!wrap || !page) return;

      // When several keyboardNav tables share a page, only the last-interacted one wins
      const siblings = page.querySelectorAll('.el-table-wrap');
      if (siblings.length > 1) {
        if (lastActiveListTable && lastActiveListTable !== wrap) return;
        if (!lastActiveListTable) {
          const first = page.querySelector('.el-table-wrap');
          if (first && first !== wrap) return;
        }
      }

      const chord = eventChord(e);
      if (!chord) return;

      const typing = isTypingTarget(e.target);

      if (chordMatches(chord, bindings.search) && !typing) {
        e.preventDefault();
        const search = page.querySelector<HTMLInputElement>('.el-search input');
        search?.focus();
        search?.select?.();
        return;
      }

      if (!typing && chordMatches(chord, bindings.prevPage)) {
        const btn = page.querySelector<HTMLButtonElement>('[data-el-page-prev]');
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
        return;
      }
      if (!typing && chordMatches(chord, bindings.nextPage)) {
        const btn = page.querySelector<HTMLButtonElement>('[data-el-page-next]');
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      if (!typing) {
        for (let i = 0; i < 9; i += 1) {
          const viewChord = bindings.viewNth?.[i];
          if (viewChord && chordMatches(chord, viewChord) && onActivateRow && rows[i]) {
            e.preventDefault();
            lastActiveListTable = wrap;
            setActiveIdx(i);
            onActivateRow(rows[i]);
            return;
          }
          const editChord = bindings.editNth?.[i];
          if (editChord && chordMatches(chord, editChord) && onEditRow && rows[i]) {
            e.preventDefault();
            lastActiveListTable = wrap;
            setActiveIdx(i);
            onEditRow(rows[i]);
            return;
          }
        }
      }

      if (typing) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (chordMatches(chord, bindings.new) && onNew) {
        e.preventDefault();
        lastActiveListTable = wrap;
        onNew();
        return;
      }

      if (rows.length === 0) return;

      if (chordMatches(chord, bindings.next)) {
        e.preventDefault();
        lastActiveListTable = wrap;
        setActiveIdx((i) => Math.min(i + 1, rows.length - 1));
        return;
      }
      if (chordMatches(chord, bindings.prev)) {
        e.preventDefault();
        lastActiveListTable = wrap;
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (chord === 'home') {
        e.preventDefault();
        setActiveIdx(0);
        return;
      }
      if (chord === 'end') {
        e.preventDefault();
        setActiveIdx(rows.length - 1);
        return;
      }
      if (chordMatches(chord, bindings.open) && onActivateRow) {
        e.preventDefault();
        const row = rows[activeIdx];
        if (row) onActivateRow(row);
        return;
      }
      if (chordMatches(chord, bindings.edit) && onEditRow) {
        e.preventDefault();
        const row = rows[activeIdx];
        if (row) onEditRow(row);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keyboardNav, rows, activeIdx, onActivateRow, onEditRow, onNew, bindings]);

  const hint = useMemo(() => {
    const parts = [
      `${formatChordHint(bindings.search)} search`,
      `${formatChordHint(bindings.next)}/${formatChordHint(bindings.prev)} move`,
      `${formatChordHint(bindings.open)} open`,
      `${formatChordHint(bindings.edit)} edit`,
      `${formatChordHint(bindings.new)} new`,
      'Alt+1–9 view',
      'Alt+Shift+1–9 edit',
    ];
    return parts.join(' · ');
  }, [bindings]);

  return (
    <div className="el-table-wrap" ref={wrapRef}>
      <table className="el-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.id} scope="col" className={col.headerClassName || col.className}>
                {col.header}
              </th>
            ))}
            {actions ? (
              <th scope="col" className="el-col-actions">
                {actionsHeader}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row)}
              className={[
                keyboardNav && index === activeIdx ? 'el-row-active' : '',
                onActivateRow ? 'el-row-clickable' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              onClick={(e) => {
                if (isInteractiveTarget(e.target)) return;
                if (keyboardNav) setActiveIdx(index);
                if (onActivateRow) onActivateRow(row);
              }}
            >
              {columns.map((col) => (
                <td key={col.id} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
              {actions ? (
                <td
                  className="el-actions-cell"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {actions(row)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {keyboardNav ? (
        <p className="el-kbd-hint" aria-hidden="true">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type EntityListStatusProps = {
  children: ReactNode;
  busy?: boolean;
};

export function EntityListLoading({ children = 'Loading…', busy = true }: EntityListStatusProps) {
  return (
    <div className="el-status" aria-busy={busy}>
      <div className="el-loading" />
      <strong>{children}</strong>
    </div>
  );
}

export function EntityListEmpty({ children }: { children: ReactNode }) {
  return <div className="el-status">{children}</div>;
}

export function EntityListFoot({ children }: { children: ReactNode }) {
  return <div className="el-foot">{children}</div>;
}

export function EntityListRefreshing({ children = 'Refreshing…' }: { children?: ReactNode }) {
  return <p className="el-refreshing">{children}</p>;
}

type EntityListFilterSortProps = {
  filterFields: FilterFieldDef[];
  filters: FilterValues;
  defaultFilters: FilterValues;
  onFiltersChange: (next: FilterValues) => void;
  sortOptions: { value: string; label: string }[];
  sort: SortCriterion[];
  defaultSort: SortCriterion[];
  onSortChange: (next: SortCriterion[]) => void;
  /** Keys driven by quick chips — omitted from More filters dialog + badge count. */
  excludeKeys?: string[];
  filtersLabel?: string;
  /** Optional override for list.filters.mtd / list.filters.last_30d. */
  onDatePreset?: (preset: 'mtd' | 'last_30d') => void;
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mtdRange(now = new Date()): { date_from: string; date_to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { date_from: isoDate(from), date_to: isoDate(to) };
}

function last30dRange(now = new Date()): { date_from: string; date_to: string } {
  const to = now;
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { date_from: isoDate(from), date_to: isoDate(to) };
}

function applyDatePresetToFilters(
  filters: FilterValues,
  filterFields: FilterFieldDef[],
  preset: 'mtd' | 'last_30d',
): FilterValues {
  const keys = new Set([...Object.keys(filters), ...filterFields.map((f) => f.key)]);
  const next = { ...filters };
  if (keys.has('month')) {
    next.month = preset === 'mtd' ? 'current' : '';
  }
  const range = preset === 'mtd' ? mtdRange() : last30dRange();
  if (keys.has('date_from') || keys.has('date_to')) {
    next.date_from = range.date_from;
    next.date_to = range.date_to;
  }
  if (keys.has('from_date') || keys.has('to_date')) {
    next.from_date = range.date_from;
    next.to_date = range.date_to;
  }
  return next;
}

/** Filter/sort tool links + dialogs for EntityListHero `tools` slot (right-aligned). */
export function EntityListFilterSort({
  filterFields,
  filters,
  defaultFilters,
  onFiltersChange,
  sortOptions,
  sort,
  defaultSort,
  onSortChange,
  excludeKeys = [],
  filtersLabel = 'More filters',
  onDatePreset,
}: EntityListFilterSortProps) {
  const [panel, setPanel] = useState<'filters' | 'sort' | null>(null);
  const [filterDraft, setFilterDraft] = useState<FilterValues>(filters);
  const [sortDraft, setSortDraft] = useState<SortCriterion[]>(sort);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bindings = useListKeyboardBindings();

  const dialogFields = useMemo(
    () => (excludeKeys.length ? filterFields.filter((f) => !excludeKeys.includes(f.key)) : filterFields),
    [excludeKeys, filterFields],
  );

  useEffect(() => {
    if (panel === 'filters') setFilterDraft(filters);
  }, [panel, filters]);

  useEffect(() => {
    if (panel === 'sort') setSortDraft(sort.length ? sort : defaultSort);
  }, [panel, sort, defaultSort]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const page = wrapRef.current?.closest('.el-page');
      if (!page) return;
      if (isTypingTarget(e.target) && !(e.ctrlKey || e.metaKey || e.altKey)) return;

      const chord = eventChord(e);
      if (!chord) return;

      if (chordMatches(chord, bindings.filtersOpen) && dialogFields.length > 0) {
        e.preventDefault();
        setPanel('filters');
        return;
      }
      if (chordMatches(chord, bindings.sortOpen)) {
        e.preventDefault();
        setPanel('sort');
        return;
      }
      if (chordMatches(chord, bindings.filtersClear) && dialogFields.length > 0) {
        e.preventDefault();
        const cleared = { ...filters };
        for (const f of dialogFields) cleared[f.key] = defaultFilters[f.key] ?? '';
        onFiltersChange(cleared);
        setPanel(null);
        return;
      }
      if (chordMatches(chord, bindings.sortClear)) {
        e.preventDefault();
        onSortChange([...defaultSort]);
        setPanel(null);
        return;
      }
      if (panel === 'filters' && chordMatches(chord, bindings.filtersApply)) {
        e.preventDefault();
        onFiltersChange({
          ...filters,
          ...Object.fromEntries(dialogFields.map((f) => [f.key, filterDraft[f.key] || ''])),
        });
        setPanel(null);
        return;
      }

      if (chordMatches(chord, bindings.filtersMtd)) {
        e.preventDefault();
        if (onDatePreset) onDatePreset('mtd');
        else onFiltersChange(applyDatePresetToFilters(filters, filterFields, 'mtd'));
        setPanel(null);
        return;
      }
      if (chordMatches(chord, bindings.filtersLast30d)) {
        e.preventDefault();
        if (onDatePreset) onDatePreset('last_30d');
        else onFiltersChange(applyDatePresetToFilters(filters, filterFields, 'last_30d'));
        setPanel(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    bindings,
    defaultFilters,
    defaultSort,
    dialogFields,
    filterDraft,
    filterFields,
    filters,
    onDatePreset,
    onFiltersChange,
    onSortChange,
    panel,
  ]);

  const activeCount = useMemo(
    () => dialogFields.reduce((n, f) => n + (Boolean(filters[f.key]?.trim()) ? 1 : 0), 0),
    [dialogFields, filters],
  );

  return (
    <div ref={wrapRef}>
      <div className="el-tool-links">
        {dialogFields.length > 0 ? (
          <button type="button" className="el-tool-link" onClick={() => setPanel('filters')}>
            {filtersLabel}
            {activeCount > 0 ? <span className="el-tool-badge">{activeCount}</span> : null}
          </button>
        ) : null}
        <button type="button" className="el-tool-link" onClick={() => setPanel('sort')}>
          Sort
        </button>
      </div>
      <FiltersDialog
        open={panel === 'filters'}
        fields={dialogFields}
        draft={filterDraft}
        onDraftChange={setFilterDraft}
        onClose={() => setPanel(null)}
        onApply={() => {
          onFiltersChange({
            ...filters,
            ...Object.fromEntries(dialogFields.map((f) => [f.key, filterDraft[f.key] || ''])),
          });
          setPanel(null);
        }}
        onClear={() => {
          const cleared = { ...filters };
          for (const f of dialogFields) cleared[f.key] = defaultFilters[f.key] ?? '';
          onFiltersChange(cleared);
          setPanel(null);
        }}
      />
      <SortDialog
        open={panel === 'sort'}
        sortOptions={sortOptions}
        draft={sortDraft.length ? sortDraft : defaultSort}
        onDraftChange={setSortDraft}
        onClose={() => setPanel(null)}
        onApply={() => {
          onSortChange(sortDraft.length ? sortDraft : defaultSort);
          setPanel(null);
        }}
        onClear={() => {
          onSortChange([...defaultSort]);
          setPanel(null);
        }}
      />
    </div>
  );
}

export type EntityListQuickFilter = { id: string; label: string };

type EntityListQuickFiltersProps = {
  options: EntityListQuickFilter[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
};

/** Segmented quick filters for EntityListHero `chips` slot (left of More filters / Sort). */
export function EntityListQuickFilters({
  options,
  value,
  onChange,
  ariaLabel = 'Quick filters',
}: EntityListQuickFiltersProps) {
  return (
    <div className="el-seg" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
