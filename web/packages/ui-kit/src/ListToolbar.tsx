import { Button, FormRow, TextInput } from './controls';
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

function FiltersDialog({
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
      title="Filters"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClear} style={{ flex: 1 }}>
            Clear all
          </Button>
          <Button type="button" onClick={onApply} style={{ flex: 1 }}>
            Apply
          </Button>
        </>
      }
    >
      <div style={{ fontWeight: 650, marginBottom: 10 }}>Filters</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {fields.map((field) => {
          if (field.type === 'text') {
            return (
              <FilterInput
                key={field.key}
                label={field.label}
                value={draft[field.key] || ''}
                placeholder={field.placeholder || 'regex, case-insensitive'}
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

function SortDialog({
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
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClear} style={{ flex: 1 }}>
            Clear sort
          </Button>
          <Button type="button" onClick={onApply} style={{ flex: 1 }}>
            Apply sort
          </Button>
        </>
      }
    >
      <div style={{ fontWeight: 650, marginBottom: 10 }}>Sort by</div>
      <div style={{ display: 'grid', gap: 14 }}>
        {draft.map((level, i) => {
          const usedEarlier = new Set(draft.slice(0, i).map((d) => d.key));
          const available = sortOptions.filter(
            (o) => !usedEarlier.has(o.value) || o.value === level.key,
          );
          return (
            <div
              key={`${level.key}-${i}`}
              style={{ display: 'grid', gridTemplateColumns: i > 0 ? '1fr 1fr auto' : '1fr 1fr', gap: 10, alignItems: 'end' }}
            >
              <FormRow label={draft.length > 1 ? `Field ${i + 1}` : 'Field'}>
                <select
                  value={level.key}
                  onChange={(e) => setLevel(i, { key: e.target.value })}
                  style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
                >
                  {available.map((o) => (
                    <option key={o.value} value={o.value}>
                      {labels[o.value] || o.label}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label={draft.length > 1 ? `Direction ${i + 1}` : 'Direction'}>
                <div style={{ display: 'flex', gap: 12, paddingTop: 6 }}>
                  {(['Ascending', 'Descending'] as const).map((dir) => {
                    const desc = dir === 'Descending';
                    return (
                      <label key={dir} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                        <input
                          type="radio"
                          name={`sort-dir-${i}`}
                          checked={level.desc === desc}
                          onChange={() => setLevel(i, { desc })}
                        />
                        {dir}
                      </label>
                    );
                  })}
                </div>
              </FormRow>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => removeLevel(i)}
                  title="Remove level"
                  style={{ ...iconBtn, minWidth: 36, height: 34, marginBottom: 2 }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {canAdd && (
          <Button type="button" variant="ghost" onClick={addLevel}>
            Add sort level
          </Button>
        )}
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
}: {
  title: string;
  countLabel: string;
  count: number;
  primaryLabel: string;
  onPrimary: () => void;
  filterFields: FilterFieldDef[];
  filters: FilterValues;
  onFiltersChange: (next: FilterValues) => void;
  defaultFilters: FilterValues;
  sortOptions: { value: string; label: string }[];
  sort: SortCriterion[];
  onSortChange: (next: SortCriterion[]) => void;
  defaultSort: SortCriterion[];
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
          <Button type="button" onClick={onPrimary}>
            {primaryLabel}
          </Button>
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
      >
        {options.map((o) => (
          <option key={o.value || '_all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormRow>
  );
}

export function PaginationBar({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
      <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span style={{ fontSize: 13, alignSelf: 'center' }}>
        Page {page} / {pageCount}
      </span>
      <Button type="button" variant="ghost" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

export const PAGE_SIZE = 12;
