import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FiltersDialog, SortDialog, type FilterFieldDef, type FilterValues, type SortCriterion } from './ListToolbar';
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
  /** Emphasis action (PDF, DN create, Convert, …) — not Delete. */
  primary?: { label: string; onClick: () => void; disabled?: boolean; title?: string };
  openLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
};

export function EntityListActions({
  onOpen,
  onEdit,
  onDelete,
  primary,
  openLabel = 'Open',
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: EntityListActionsProps) {
  if (!onOpen && !onEdit && !onDelete && !primary) return null;
  return (
    <div className="el-actions">
      {onOpen ? (
        <button type="button" className="el-action-btn" onClick={onOpen}>
          {openLabel}
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" className="el-action-btn" onClick={onEdit}>
          {editLabel}
        </button>
      ) : null}
      {primary ? (
        <button
          type="button"
          className="el-action-btn el-action-btn--primary"
          onClick={primary.onClick}
          disabled={primary.disabled}
          title={primary.title}
        >
          {primary.label}
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" className="el-action-btn el-action-btn--danger" onClick={onDelete}>
          {deleteLabel}
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
};

export function EntityListTable<T>({
  columns,
  rows,
  rowKey,
  actions,
  actionsHeader = 'Actions',
}: EntityListTableProps<T>) {
  return (
    <div className="el-table-wrap">
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
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.id} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
              {actions ? <td className="el-actions-cell">{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
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
};

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
}: EntityListFilterSortProps) {
  const [panel, setPanel] = useState<'filters' | 'sort' | null>(null);
  const [filterDraft, setFilterDraft] = useState<FilterValues>(filters);
  const [sortDraft, setSortDraft] = useState<SortCriterion[]>(sort);

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

  const activeCount = useMemo(
    () => dialogFields.reduce((n, f) => n + (Boolean(filters[f.key]?.trim()) ? 1 : 0), 0),
    [dialogFields, filters],
  );

  return (
    <>
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
    </>
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
