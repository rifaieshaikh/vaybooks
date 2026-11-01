import { useMemo, useState } from 'react';
import {
  useCreateCrmListViewMutation,
  useDeleteCrmListViewMutation,
  useListCrmListViewsQuery,
} from '@vaybooks/store';
import { Button, FormRow, type SortCriterion } from '@vaybooks/ui-kit';
import { applySavedListView } from '../collectionsAging';
import { extractError } from '../utils';

export type CrmListViewEntity = 'lead' | 'enquiry' | 'activity';

export type CrmSavedListView = {
  id: string;
  name: string;
  entity: string;
  filters: Record<string, string>;
  sort: SortCriterion[];
  columns: string[];
};

type SavedListViewsBarProps = {
  entity: CrmListViewEntity;
  current: {
    search: string;
    filters: Record<string, string>;
    sort: SortCriterion[];
  };
  onApply: (view: {
    search: string;
    filters: Record<string, string>;
    sort: SortCriterion[];
  }) => void;
};

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

function asSort(value: unknown): SortCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === 'object' && typeof (row as SortCriterion).key === 'string')
    .map((row) => ({
      key: String((row as SortCriterion).key),
      desc: Boolean((row as SortCriterion).desc),
    }));
}

export function SavedListViewsBar({ entity, current, onApply }: SavedListViewsBarProps) {
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [msg, setMsg] = useState('');
  const { data, refetch } = useListCrmListViewsQuery({ entity });
  const [createView, createState] = useCreateCrmListViewMutation();
  const [deleteView, deleteState] = useDeleteCrmListViewMutation();

  const views = useMemo<CrmSavedListView[]>(() => {
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((row: Record<string, unknown>) => ({
      id: String(row.id || ''),
      name: String(row.name || 'Untitled'),
      entity: String(row.entity || entity),
      filters: asStringRecord(row.filters),
      sort: asSort(row.sort),
      columns: Array.isArray(row.columns)
        ? row.columns.map((c: unknown) => String(c))
        : [],
    }));
  }, [data, entity]);

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMsg('');
    try {
      const filters: Record<string, unknown> = {
        ...current.filters,
        search: current.search,
      };
      await createView({
        name: trimmed,
        entity,
        filters,
        sort: current.sort,
      }).unwrap();
      setName('');
      setMsg('View saved');
      refetch();
    } catch (err) {
      setMsg(extractError(err) || 'Failed to save view');
    }
  }

  function onLoad() {
    const view = views.find((v) => v.id === selectedId);
    if (!view) return;
    onApply(applySavedListView(view));
    setMsg(`Loaded “${view.name}”`);
  }

  async function onDelete() {
    if (!selectedId) return;
    setMsg('');
    try {
      await deleteView(selectedId).unwrap();
      setSelectedId('');
      setMsg('View deleted');
      refetch();
    } catch (err) {
      setMsg(extractError(err) || 'Failed to delete view');
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
      <FormRow label="Save view">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="View name"
          aria-label="Saved view name"
          style={{ minWidth: 140 }}
        />
      </FormRow>
      <Button
        type="button"
        variant="ghost"
        onClick={() => void onSave()}
        disabled={!name.trim() || createState.isLoading}
      >
        Save current view
      </Button>
      <FormRow label="Load view">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label="Load saved view"
          style={{ minWidth: 160 }}
        >
          <option value="">Select…</option>
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
      </FormRow>
      <Button type="button" variant="ghost" onClick={onLoad} disabled={!selectedId}>
        Load
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => void onDelete()}
        disabled={!selectedId || deleteState.isLoading}
      >
        Delete
      </Button>
      {msg ? (
        <span className="el-muted" style={{ alignSelf: 'center' }}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}
