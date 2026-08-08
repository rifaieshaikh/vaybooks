import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import {
  useCreateWorkerMutation,
  useDeactivateWorkerMutation,
  useListWorkersQuery,
  useUpdateWorkerMutation,
  useCreatePartySegmentMutation,
  useDeletePartySegmentMutation,
  useListPartySegmentsQuery,
  useUpdatePartySegmentMutation,
} from '@vaybooks/store';
import { useMemo, useState } from 'react';
import { LocationIdsField, parseLocationIds } from '../components/PartyFields';
import { Modal } from '../components/Modal';
import { PartyCard, PartyCardGrid } from '../components/PartyCard';
import {
  ListToolbar,
  PAGE_SIZE,
  PaginationBar,
  type FilterFieldDef,
  type SortCriterion,
} from '../components/ListToolbar';
import { displayName, matchesRegex, pageCount, paginate, sortRows } from '../components/listUtils';

const DEFAULT_WORKER_FILTERS = { worker_name: '', active: '' };
const DEFAULT_WORKER_SORT: SortCriterion[] = [{ key: 'worker_name', desc: false }];
const WORKER_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'worker_name', label: 'Name', type: 'text' },
  {
    key: 'active',
    label: 'Active',
    type: 'select',
    options: [
      { value: 'yes', label: 'Active' },
      { value: 'no', label: 'Inactive' },
    ],
  },
];

export function WorkersListPage() {
  const { data = [], isLoading, error, refetch } = useListWorkersQuery({ active_only: false });
  const [create] = useCreateWorkerMutation();
  const [update] = useUpdateWorkerMutation();
  const [deactivate] = useDeactivateWorkerMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_WORKER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_WORKER_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('0');
  const [locationIds, setLocationIds] = useState('default');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.worker_name, filters.worker_name)) return false;
      if (filters.active === 'yes' && !row.is_active) return false;
      if (filters.active === 'no' && row.is_active) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submit() {
    setFormError('');
    const body = {
      worker_name: name,
      default_hourly_rate: Number(rate) || 0,
      activity_refs: [] as string[],
      location_ids: parseLocationIds(locationIds),
      is_active: true,
    };
    try {
      if (dialog === 'edit' && editId) await update({ id: editId, body }).unwrap();
      else await create(body).unwrap();
      setDialog(null);
      setName('');
      setRate('0');
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  return (
    <div>
      <ListToolbar
        title="Employees"
        countLabel="employees"
        count={filtered.length}
        primaryLabel="Add Employee"
        onPrimary={() => {
          setEditId(null);
          setName('');
          setRate('0');
          setLocationIds('default');
          setFormError('');
          setDialog('add');
        }}
        filterFields={WORKER_FILTER_FIELDS}
        filters={filters}
        defaultFilters={DEFAULT_WORKER_FILTERS}
        onFiltersChange={(next) => {
          setFilters(next as typeof filters);
          setPage(1);
        }}
        sort={sort}
        defaultSort={DEFAULT_WORKER_SORT}
        sortOptions={[
          { value: 'worker_name', label: 'Name' },
          { value: 'default_hourly_rate', label: 'Rate' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load employees.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 && <p>No employees found.</p>}

      <PartyCardGrid>
        {pageRows.map((row) => (
          <PartyCard
            key={String(row.id)}
            title={displayName(row, ['worker_name'], 'Unnamed')}
            captions={[`Rate ₹${Number(row.default_hourly_rate ?? 0)}`]}
            badges={[
              {
                label: row.is_active ? 'Active' : 'Inactive',
                tone: row.is_active ? 'green' : 'gray',
              },
            ]}
            onEdit={() => {
              setEditId(String(row.id));
              setName(String(row.worker_name || ''));
              setRate(String(row.default_hourly_rate ?? 0));
              setLocationIds(
                Array.isArray(row.location_ids) ? (row.location_ids as string[]).join(', ') : 'default',
              );
              setFormError('');
              setDialog('edit');
            }}
          />
        ))}
      </PartyCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

      <Modal
        title={dialog === 'edit' ? 'Edit Employee' : 'Add Employee'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Employee'}
            </Button>
            {dialog === 'edit' && editId && (
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await deactivate(editId);
                  setDialog(null);
                  refetch();
                }}
              >
                Deactivate
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </FormRow>
          <FormRow label="Default hourly rate">
            <TextInput type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </FormRow>
          <LocationIdsField value={locationIds} onChange={setLocationIds} />
        </div>
      </Modal>
    </div>
  );
}

const DEFAULT_SEGMENT_FILTERS = { name: '', applies: '' };
const DEFAULT_SEGMENT_SORT: SortCriterion[] = [{ key: 'name', desc: false }];
const SEGMENT_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'applies', label: 'Applies to', type: 'text', placeholder: 'customer / vendor' },
];

export function SegmentsListPage() {
  const { data = [], isLoading, error, refetch } = useListPartySegmentsQuery();
  const [create] = useCreatePartySegmentMutation();
  const [update] = useUpdatePartySegmentMutation();
  const [remove] = useDeletePartySegmentMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SEGMENT_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_SEGMENT_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [applies, setApplies] = useState('customer,vendor');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.name, filters.name)) return false;
      if (filters.applies) {
        const appliesTo = Array.isArray(row.applies_to)
          ? (row.applies_to as string[]).join(',')
          : String(row.applies_to || '');
        if (!appliesTo.toLowerCase().includes(filters.applies.toLowerCase())) return false;
      }
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submit() {
    setFormError('');
    const body = {
      name,
      applies_to: applies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      is_active: true,
    };
    try {
      if (dialog === 'edit' && editId) await update({ id: editId, body }).unwrap();
      else await create(body).unwrap();
      setDialog(null);
      setName('');
      setApplies('customer,vendor');
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  return (
    <div>
      <ListToolbar
        title="Party segments"
        countLabel="segments"
        count={filtered.length}
        primaryLabel="Add Segment"
        onPrimary={() => {
          setEditId(null);
          setName('');
          setApplies('customer,vendor');
          setFormError('');
          setDialog('add');
        }}
        filterFields={SEGMENT_FILTER_FIELDS}
        filters={filters}
        defaultFilters={DEFAULT_SEGMENT_FILTERS}
        onFiltersChange={(next) => {
          setFilters(next as typeof filters);
          setPage(1);
        }}
        sort={sort}
        defaultSort={DEFAULT_SEGMENT_SORT}
        sortOptions={[{ value: 'name', label: 'Name' }]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load segments.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 && <p>No segments found.</p>}

      <PartyCardGrid>
        {pageRows.map((row) => {
          const appliesLabel = Array.isArray(row.applies_to)
            ? (row.applies_to as string[]).join(', ')
            : String(row.applies_to || '');
          return (
            <PartyCard
              key={String(row.id)}
              title={displayName(row, ['name'], 'Unnamed')}
              captions={[appliesLabel ? `Applies to: ${appliesLabel}` : '']}
              badges={[
                {
                  label: row.is_active === false ? 'Inactive' : 'Active',
                  tone: row.is_active === false ? 'gray' : 'green',
                },
              ]}
              onEdit={() => {
                setEditId(String(row.id));
                setName(String(row.name || ''));
                setApplies(
                  Array.isArray(row.applies_to)
                    ? (row.applies_to as string[]).join(',')
                    : String(row.applies_to || 'customer,vendor'),
                );
                setFormError('');
                setDialog('edit');
              }}
            />
          );
        })}
      </PartyCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

      <Modal
        title={dialog === 'edit' ? 'Edit Segment' : 'Add Segment'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Segment'}
            </Button>
            {dialog === 'edit' && editId && (
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await remove(editId);
                  setDialog(null);
                  refetch();
                }}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </FormRow>
          <FormRow label="Applies to (customer,vendor)">
            <TextInput value={applies} onChange={(e) => setApplies(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </div>
  );
}
