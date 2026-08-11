import { Button, FormRow, Select, TextInput } from './controls';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Modal } from './Modal';

export type FilterValues = Record<string, string>;

export type SortCriterion = { key: string; desc: boolean };

export type FilterFieldDef =
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | {
      key: string;
      label: string;
      type: 'select';
      options: { value: string; label: string }[];
      allLabel?: string;
    };

const MAX_SORT_LEVELS = 3;

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4v16M8 4l-3 3M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const iconBtn: CSSProperties = {
  minWidth: 40,
  height: 36,
  padding: '0 0.55rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  border: '1px solid #c5d4ce',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  color: '#185c4c',
};

const chipBtn: CSSProperties = {
  border: '1px solid #c5d4ce',
  background: '#eef6f2',
  color: '#185c4c',
  borderRadius: 999,
  padding: '0.2rem 0.65rem',
  fontSize: 12,
  cursor: 'pointer',
};

function isActiveFilter(value: string | undefined): boolean {
  return Boolean(value && String(value).trim());
}

function countActive(filters: FilterValues, fields: FilterFieldDef[]): number {
  return fields.reduce((n, f) => n + (isActiveFilter(filters[f.key]) ? 1 : 0), 0);
}

function chipLabel(field: FilterFieldDef, value: string): string {
  if (field.type === 'select') {
    const opt = field.options.find((o) => o.value === value);
    return `${field.label}: ${opt?.label ?? value}`;
  }
  return `${field.label}: ${value}`;
}

export function FiltersDialog({
  open,
  fields,
  draft,
  onDraftChange,
  onClose,
  onApply,
  onClear,
}: {
  open: boolean;
  fields: FilterFieldDef[];
  draft: FilterValues;
  onDraftChange: (next: FilterValues) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <Modal
      title="More filters"
      open={open}
      onClose={onClose}
      compact
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClear}>
            Clear all
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onApply}>
            Apply
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#5c736a', lineHeight: 1.4 }}>
        Narrow the list by name, contact, tax, segment, or order activity.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        {fields.map((field) => {
          if (field.type === 'text') {
            return (
              <FilterInput
                key={field.key}
                label={field.label}
                value={draft[field.key] || ''}
                placeholder={field.placeholder || 'Contains…'}
                onChange={(v) => onDraftChange({ ...draft, [field.key]: v })}
              />
            );
          }
          return (
            <FilterSelect
              key={field.key}
              label={field.label}
              value={draft[field.key] || ''}
              onChange={(v) => onDraftChange({ ...draft, [field.key]: v })}
              options={[{ value: '', label: field.allLabel || 'All' }, ...field.options]}
            />
          );
        })}
      </div>
    </Modal>
  );
}

export function SortDialog({
  open,
  sortOptions,
  draft,
  onDraftChange,
  onClose,
  onApply,
  onClear,
}: {
  open: boolean;
  sortOptions: { value: string; label: string }[];
  draft: SortCriterion[];
  onDraftChange: (next: SortCriterion[]) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const labels = useMemo(
    () => Object.fromEntries(sortOptions.map((o) => [o.value, o.label])),
    [sortOptions],
  );

  function setLevel(index: number, patch: Partial<SortCriterion>) {
    onDraftChange(draft.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeLevel(index: number) {
    if (draft.length <= 1) return;
    onDraftChange(draft.filter((_, i) => i !== index));
  }

  function addLevel() {
    if (draft.length >= MAX_SORT_LEVELS || draft.length >= sortOptions.length) return;
    const used = new Set(draft.map((d) => d.key));
    const next = sortOptions.find((o) => !used.has(o.value));
    if (!next) return;
    onDraftChange([...draft, { key: next.value, desc: true }]);
  }

  const canAdd =
    draft.length < MAX_SORT_LEVELS &&
    draft.length < sortOptions.length &&
    sortOptions.some((o) => !draft.some((d) => d.key === o.value));

  return (
    <Modal
      title="Sort"
      open={open}
      onClose={onClose}
      compact
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClear}>
            Reset
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onApply}>
            Apply
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#5c736a', lineHeight: 1.4 }}>
        Choose how customers are ordered. Add a second level for ties.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        {draft.map((level, i) => {
          const usedEarlier = new Set(draft.slice(0, i).map((d) => d.key));
          const available = sortOptions.filter(
            (o) => !usedEarlier.has(o.value) || o.value === level.key,
          );
          return (
            <div
              key={`${level.key}-${i}`}
              style={{
                display: 'grid',
                gap: 10,
                padding: '0.75rem 0.8rem',
                borderRadius: 10,
                border: '1px solid #d5e3dc',
                background: '#f7faf8',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 650, color: '#5c736a', letterSpacing: '0.04em' }}>
                  {i === 0 ? 'PRIMARY' : `THEN BY ${i + 1}`}
                </span>
                {i > 0 ? (
                  <button
                    type="button"
                    onClick={() => removeLevel(i)}
                    title="Remove level"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#5c736a',
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: '2px 4px',
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <FormRow label="Field">
                <Select value={level.key} onChange={(e) => setLevel(i, { key: e.target.value })}>
                  {available.map((o) => (
                    <option key={o.value} value={o.value}>
                      {labels[o.value] || o.label}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Direction">
                <Select
                  value={level.desc ? 'desc' : 'asc'}
                  onChange={(e) => setLevel(i, { desc: e.target.value === 'desc' })}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </Select>
              </FormRow>
            </div>
          );
        })}
        {canAdd ? (
          <Button type="button" variant="ghost" onClick={addLevel}>
            Add sort level
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

/** Streamlit-parity filter/sort bar: icon buttons open Filters / Sort dialogs. */
export function ListToolbar({
  title,
  countLabel,
  count,
  primaryLabel,
  onPrimary,
  filterFields,
  filters,
  onFiltersChange,
  defaultFilters,
  sortOptions,
  sort,
  onSortChange,
  defaultSort,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onRefresh,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  title: string;
  countLabel: string;
  count: number;
  primaryLabel?: string;
  onPrimary?: () => void;
  filterFields: FilterFieldDef[];
  filters: FilterValues;
  onFiltersChange: (next: FilterValues) => void;
  defaultFilters: FilterValues;
  sortOptions: { value: string; label: string }[];
  sort: SortCriterion[];
  onSortChange: (next: SortCriterion[]) => void;
  defaultSort: SortCriterion[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  const [panel, setPanel] = useState<'filters' | 'sort' | null>(null);
  const [filterDraft, setFilterDraft] = useState<FilterValues>(filters);
  const [sortDraft, setSortDraft] = useState<SortCriterion[]>(sort);

  useEffect(() => {
    if (panel === 'filters') setFilterDraft(filters);
  }, [panel, filters]);

  useEffect(() => {
    if (panel === 'sort') setSortDraft(sort.length ? sort : defaultSort);
  }, [panel, sort, defaultSort]);

  const activeCount = countActive(filters, filterFields);
  const activeChips = filterFields.filter((f) => isActiveFilter(filters[f.key]));

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>{title}</h2>
          <div style={{ fontSize: 13, color: '#667', marginTop: 4 }}>
            {count} {countLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onSearchChange ? (
            <input
              type="search"
              className="vb-control"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || 'Search…'}
              aria-label="Search"
              style={{ minWidth: 200, flex: '1 1 200px', width: 'auto' }}
            />
          ) : null}
          <button
            type="button"
            style={iconBtn}
            title="Filters"
            aria-label="Filters"
            onClick={() => setPanel('filters')}
          >
            <FilterIcon />
            {activeCount > 0 ? <span style={{ fontWeight: 700 }}>{activeCount}</span> : null}
          </button>
          <button type="button" style={iconBtn} title="Sort" aria-label="Sort" onClick={() => setPanel('sort')}>
            <SortIcon />
          </button>
          {onRefresh ? (
            <Button type="button" variant="ghost" onClick={onRefresh}>
              Refresh
            </Button>
          ) : null}
          {pageSize != null && pageSizeOptions && onPageSizeChange ? (
            <label style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center', color: '#456' }}>
              Page size
              <Select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                style={{ width: 'auto', minWidth: '4.5rem', minHeight: '2.1rem' }}
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          {primaryLabel && onPrimary ? (
            <Button type="button" onClick={onPrimary}>
              {primaryLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {activeChips.map((field) => (
            <button
              key={field.key}
              type="button"
              style={chipBtn}
              onClick={() => {
                onFiltersChange({ ...filters, [field.key]: defaultFilters[field.key] ?? '' });
              }}
            >
              ✕ {chipLabel(field, filters[field.key] || '')}
            </button>
          ))}
        </div>
      )}

      <FiltersDialog
        open={panel === 'filters'}
        fields={filterFields}
        draft={filterDraft}
        onDraftChange={setFilterDraft}
        onClose={() => setPanel(null)}
        onApply={() => {
          onFiltersChange(filterDraft);
          setPanel(null);
        }}
        onClear={() => {
          onFiltersChange({ ...defaultFilters });
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

export function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <FormRow label={label}>
      <TextInput value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </FormRow>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <FormRow label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value || '_all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FormRow>
  );
}

export function PaginationBar({
  page,
  pageCount,
  onPage,
  totalCount,
  pageSize,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  totalCount?: number;
  pageSize?: number;
}) {
  if (pageCount <= 0) return null;
  const size = pageSize && pageSize > 0 ? pageSize : 0;
  const total = totalCount ?? 0;
  const start = total === 0 || size === 0 ? 0 : (page - 1) * size + 1;
  const end = size === 0 ? 0 : Math.min(page * size, total);
  const rangeLabel =
    totalCount != null && pageSize != null
      ? total === 0
        ? 'No results'
        : `Showing ${start}–${end} of ${total}`
      : null;

  // Avoid empty spacer on single-page lists that don't request a range label.
  if (pageCount <= 1 && rangeLabel == null) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 16,
      }}
    >
      {rangeLabel ? <span style={{ fontSize: 13, color: '#667' }}>{rangeLabel}</span> : null}
      {pageCount > 1 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={page <= 1}
            data-el-page-prev=""
            onClick={() => onPage(page - 1)}
          >
            Previous
          </Button>
          <span style={{ fontSize: 13, alignSelf: 'center' }}>
            Page {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={page >= pageCount}
            data-el-page-next=""
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </>
      ) : null}
    </div>
  );
}

export const PAGE_SIZE = 12;
