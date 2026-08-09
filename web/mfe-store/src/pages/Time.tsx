import { useMemo, useState } from 'react';
import {
  useCompleteStoreTimeEntryMutation,
  useCreateStoreTimeEntryMutation,
  useDeleteStoreTimeEntryMutation,
  useListStoreActivitiesQuery,
  useListStoreTimeEntriesQuery,
  useListWorkersQuery,
  useSetStoreTimeEntryStatusMutation,
  useUpdateStoreTimeEntryMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityListActions,
  EntityListEmpty,
  EntityListFilterSort,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  ErrorText,
  FormRow,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const TIME_STATUSES = ['Created', 'Completed'] as const;

const DEFAULT_FILTERS = { worker_name: '', activity_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'work_date', desc: true }];
const FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'worker_name', label: 'Worker', type: 'text' },
  { key: 'activity_name', label: 'Activity', type: 'text' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: TIME_STATUSES.map((value) => ({ value, label: value })),
  },
];

export function StoreTimePage() {
  const { data = [], isLoading, error, refetch } = useListStoreTimeEntriesQuery();
  const { data: activities = [] } = useListStoreActivitiesQuery({ active_only: true });
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const [createEntry, createState] = useCreateStoreTimeEntryMutation();
  const [updateEntry, updateState] = useUpdateStoreTimeEntryMutation();
  const [setStatus, statusState] = useSetStoreTimeEntryStatusMutation();
  const [completeEntry] = useCompleteStoreTimeEntryMutation();
  const [deleteEntry] = useDeleteStoreTimeEntryMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [activityId, setActivityId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [status, setStatusValue] = useState('Created');
  const [editingId, setEditingId] = useState<string | null>(null);

  const trackable = useMemo(
    () => activities.filter((a) => a.requires_time_tracking !== false),
    [activities],
  );
  const activityStatuses = useMemo(() => {
    const selected = activities.find((activity) => String(activity.id) === activityId);
    return Array.isArray(selected?.statuses)
      ? selected.statuses.map((value) => String(value))
      : ['Created', 'Completed'];
  }, [activities, activityId]);

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.worker_name, filters.worker_name)) return false;
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
      if (filters.status && String(row.status || '') !== filters.status) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type TimeRow = (typeof data)[number];

  const columns: EntityListColumn<TimeRow>[] = useMemo(
    () => [
      {
        id: 'activity_name',
        header: 'Activity',
        render: (row) => displayName(row, ['activity_name'], 'Unnamed'),
      },
      {
        id: 'worker_name',
        header: 'Worker',
        render: (row) => {
          const worker = String(row.worker_name || '').trim();
          return <span className={worker ? undefined : 'el-muted'}>{worker || '—'}</span>;
        },
      },
      {
        id: 'work_date',
        header: 'Date',
        render: (row) => String(row.work_date || '').slice(0, 10) || '—',
      },
      {
        id: 'time',
        header: 'Time',
        render: (row) => `${asCaption(row.start_time)}–${asCaption(row.end_time)}`,
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status) || '—',
      },
      {
        id: 'duration',
        header: 'Duration',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => `${Number(row.duration_minutes ?? 0)} min`,
      },
    ],
    [],
  );

  function openEdit(row: TimeRow) {
    setFormError('');
    setEditingId(String(row.id));
    setActivityId(String(row.activity_id ?? ''));
    setWorkerId(String(row.worker_id ?? ''));
    setWorkDate(String(row.work_date || '').slice(0, 10));
    setStartTime(asCaption(row.start_time));
    setEndTime(asCaption(row.end_time));
    setNotes(asCaption(row.notes));
    setStatusValue(asCaption(row.status) || 'Created');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    if (!activityId || !workerId || !workDate) {
      setFormError('Activity, worker, and work date are required');
      return;
    }
    try {
      await createEntry({
        activity_id: activityId,
        worker_id: workerId,
        work_date: workDate,
        start_time: startTime,
        end_time: endTime,
        notes,
      }).unwrap();
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onSave() {
    if (!editingId) {
      await onCreate();
      return;
    }
    setFormError('');
    if (!activityId || !workerId || !workDate) {
      setFormError('Activity, worker, and work date are required');
      return;
    }
    try {
      await updateEntry({
        id: editingId,
        body: {
          activity_id: activityId,
          worker_id: workerId,
          work_date: workDate,
          start_time: startTime,
          end_time: endTime,
          notes,
        },
      }).unwrap();
      setOpen(false);
      setEditingId(null);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onSetStatus(nextStatus: string) {
    if (!editingId) return;
    setFormError('');
    try {
      await setStatus({ id: editingId, status: nextStatus }).unwrap();
      setStatusValue(nextStatus);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onComplete() {
    if (!editingId) return;
    setFormError('');
    try {
      await completeEntry(editingId).unwrap();
      setStatusValue('Completed');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this time entry?')) return;
    setFormError('');
    try {
      await deleteEntry(id).unwrap();
      if (editingId === id) {
        setOpen(false);
        setEditingId(null);
      }
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Store"
        title="Business Tasks"
        count={`${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setEditingId(null);
              setActivityId('');
              setWorkerId('');
              setWorkDate('');
              setStartTime('09:00');
              setEndTime('11:00');
              setNotes('');
              setStatusValue('Created');
              setOpen(true);
            }}
          >
            Log time
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.status || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, status: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...TIME_STATUSES.map((status) => ({ id: status, label: status })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters(next as typeof DEFAULT_FILTERS);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'work_date', label: 'Date' },
              { value: 'worker_name', label: 'Worker' },
              { value: 'status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading business tasks…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load business tasks.</ErrorText> : null}
      {formError && !open ? <ErrorText>{formError}</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No business tasks logged yet.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() => void onDelete(String(row.id))}
            />
          )}
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal
        open={open}
        title={editingId ? 'Edit business task' : 'Log business task'}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
        }}
        footer={
          <>
            {editingId && status !== 'Completed' ? (
              <Button type="button" variant="ghost" onClick={() => void onComplete()}>
                Complete
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={createState.isLoading || updateState.isLoading}>
              {createState.isLoading || updateState.isLoading ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Activity *">
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {trackable.map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {asCaption(a.activity_name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Employee *">
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {workers.map((w) => (
                <option key={String(w.id)} value={String(w.id)}>
                  {asCaption(w.worker_name || w.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Work date *">
            <TextInput type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
          </FormRow>
          <FormRow label="Start">
            <TextInput value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </FormRow>
          <FormRow label="End">
            <TextInput value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </FormRow>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          {editingId ? (
            <FormRow label="Status">
              <select
                value={status}
                onChange={(e) => void onSetStatus(e.target.value)}
                disabled={statusState.isLoading || status === 'Completed'}
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              >
                {activityStatuses.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </FormRow>
          ) : null}
        </div>
      </Modal>
    </EntityListPage>
  );
}
