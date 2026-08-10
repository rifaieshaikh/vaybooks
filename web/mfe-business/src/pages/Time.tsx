import { useMemo, useState } from 'react';
import {
  useCreateBusinessTimeEntryMutation,
  useDeleteBusinessTimeEntryMutation,
  useListBusinessTasksQuery,
  useListBusinessTimeEntriesQuery,
  useListWorkersQuery,
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
import { asCaption, extractError, unwrapPaged } from '../utils';

const DEFAULT_FILTERS = { worker_name: '', activity_name: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'work_date', desc: true }];
const FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'worker_name', label: 'Worker', type: 'text' },
  { key: 'activity_name', label: 'Activity', type: 'text' },
];

export function BusinessTimePage() {
  const { data: raw, isLoading, error, refetch } = useListBusinessTimeEntriesQuery({
    page: 1,
    page_size: 200,
  });
  const data = useMemo(() => unwrapPaged(raw), [raw]);
  const { data: taskRaw } = useListBusinessTasksQuery({ page: 1, page_size: 200 });
  const tasks = useMemo(
    () => unwrapPaged(taskRaw).filter((t) => String(t.status || '') !== 'Completed'),
    [taskRaw],
  );
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const [createEntry, createState] = useCreateBusinessTimeEntryMutation();
  const [deleteEntry] = useDeleteBusinessTimeEntryMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [taskId, setTaskId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.worker_name, filters.worker_name)) return false;
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
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
        render: (row) => asCaption(row.worker_name) || '—',
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
        id: 'duration',
        header: 'Duration',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => `${Number(row.duration_minutes ?? 0)} min`,
      },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    if (!taskId || !workerId || !workDate) {
      setFormError('Task, worker, and work date are required');
      return;
    }
    try {
      await createEntry({
        task_id: taskId,
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

  async function onDelete(id: string) {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      await deleteEntry(id).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Business"
        title="Time log"
        count={`${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setTaskId('');
              setWorkerId('');
              setWorkDate('');
              setStartTime('09:00');
              setEndTime('11:00');
              setNotes('');
              setOpen(true);
            }}
          >
            Log time
          </Button>
        }
        tools={
          <EntityListFilterSort
            filterFields={FILTER_FIELDS}
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
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading time entries…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load time entries.</ErrorText> : null}
      {formError && !open ? <ErrorText>{formError}</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No time logged yet.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onDelete={() => void onDelete(String(row.id))} />
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
        title="Log time"
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
          <FormRow label="Task *">
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {tasks.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {asCaption(t.title || t.activity_name)}
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
    </EntityListPage>
  );
}
