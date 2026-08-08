import { useMemo, useState } from 'react';
import {
  useCompleteStoreTimeEntryMutation,
  useCreateStoreTimeEntryMutation,
  useDeleteStoreTimeEntryMutation,
  useListStoreActivitiesQuery,
  useListStoreTimeEntriesQuery,
  useListWorkersQuery,
} from '@vaybooks/store';
import {
  Button,
  EntityCard,
  EntityCardGrid,
  ErrorText,
  FormRow,
  ListToolbar,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const DEFAULT_FILTERS = { worker_name: '', activity_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'work_date', desc: true }];

export function StoreTimePage() {
  const { data = [], isLoading, error, refetch } = useListStoreTimeEntriesQuery();
  const { data: activities = [] } = useListStoreActivitiesQuery({ active_only: true });
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const [createEntry, createState] = useCreateStoreTimeEntryMutation();
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

  const trackable = useMemo(
    () => activities.filter((a) => a.requires_time_tracking !== false),
    [activities],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'worker_name', label: 'Worker', type: 'text' },
      { key: 'activity_name', label: 'Activity', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.worker_name, filters.worker_name)) return false;
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
      if (!matchesRegex(row.status, filters.status)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

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

  return (
    <div>
      <ListToolbar
        title="Business Tasks"
        countLabel="entries"
        count={filtered.length}
        primaryLabel="Log time"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load business tasks.</ErrorText> : null}
      {!isLoading && !error && filtered.length === 0 ? (
        <p style={{ color: '#667' }}>No business tasks logged yet.</p>
      ) : (
        <EntityCardGrid>
          {pageRows.map((row) => (
            <EntityCard
              key={String(row.id)}
              title={asCaption(row.activity_name) || String(row.id)}
              captions={[
                asCaption(row.worker_name),
                String(row.work_date || '').slice(0, 10),
                `${asCaption(row.start_time)}–${asCaption(row.end_time)}`,
                asCaption(row.status),
                `${Number(row.duration_minutes ?? 0)} min`,
              ]}
              onEdit={() => {
                if (String(row.status) !== 'Completed') {
                  void completeEntry(String(row.id)).then(() => refetch());
                } else if (window.confirm('Delete this time entry?')) {
                  void deleteEntry(String(row.id)).then(() => refetch());
                }
              }}
            />
          ))}
        </EntityCardGrid>
      )}
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPageChange={setPage} />

      <Modal
        open={open}
        title="Log business task"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onCreate()} disabled={createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Create'}
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
        </div>
      </Modal>
    </div>
  );
}
