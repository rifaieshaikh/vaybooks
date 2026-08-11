import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAssignBusinessTaskMutation,
  useCompleteBusinessTaskMutation,
  useCreateBusinessTaskMutation,
  useDeleteBusinessTaskMutation,
  useListBusinessActivitiesQuery,
  useListBusinessTasksQuery,
  useListWorkersQuery,
  useSetBusinessTaskStatusMutation,
  useUpdateBusinessTaskMutation,
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
import { asCaption, extractError, unwrapPaged } from '../utils';

const STATUSES = ['Created', 'Completed'] as const;
const DEFAULT_FILTERS = { title: '', activity_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'updated_at', desc: true }];
const FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'activity_name', label: 'Activity', type: 'text' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: STATUSES.map((value) => ({ value, label: value })),
  },
];

export function BusinessTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: raw, isLoading, error, refetch } = useListBusinessTasksQuery({
    page: 1,
    page_size: 200,
  });
  const data = useMemo(() => unwrapPaged(raw), [raw]);
  const { data: actRaw } = useListBusinessActivitiesQuery({ active_only: true, page: 1, page_size: 200 });
  const activities = useMemo(() => unwrapPaged(actRaw), [actRaw]);
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const [createTask, createState] = useCreateBusinessTaskMutation();
  const [updateTask, updateState] = useUpdateBusinessTaskMutation();
  const [assignTask] = useAssignBusinessTaskMutation();
  const [setStatus] = useSetBusinessTaskStatusMutation();
  const [completeTask] = useCompleteBusinessTaskMutation();
  const [deleteTask] = useDeleteBusinessTaskMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [status, setStatusValue] = useState('Created');

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.title || row.activity_name, filters.title)) return false;
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
      if (filters.status && String(row.status || '') !== filters.status) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);
  type TaskRow = (typeof data)[number];

  const columns: EntityListColumn<TaskRow>[] = useMemo(
    () => [
      {
        id: 'title',
        header: 'Task',
        render: (row) => displayName(row, ['title', 'activity_name'], 'Untitled'),
      },
      {
        id: 'activity_name',
        header: 'Activity',
        render: (row) => asCaption(row.activity_name) || '—',
      },
      {
        id: 'assignee_name',
        header: 'Assignee',
        render: (row) => asCaption(row.assignee_name) || '—',
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status) || '—',
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setEditingId(null);
    setActivityId('');
    setTitle('');
    setNotes('');
    setWorkerId('');
    setStatusValue('Created');
    setOpen(true);
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  function openEdit(row: TaskRow) {
    setFormError('');
    setEditingId(String(row.id));
    setActivityId(String(row.activity_id || ''));
    setTitle(asCaption(row.title));
    setNotes(asCaption(row.notes));
    setWorkerId(String(row.assignee_worker_id || ''));
    setStatusValue(asCaption(row.status) || 'Created');
    setOpen(true);
  }

  async function onSave() {
    setFormError('');
    if (!editingId) {
      if (!activityId) {
        setFormError('Activity is required');
        return;
      }
      try {
        const created = await createTask({
          activity_id: activityId,
          title,
          notes,
          assignee_worker_id: workerId,
        }).unwrap();
        setOpen(false);
        refetch();
        void created;
      } catch (e) {
        setFormError(extractError(e));
      }
      return;
    }
    try {
      await updateTask({
        id: editingId,
        body: {
          title,
          notes,
        },
      }).unwrap();
      if (workerId !== undefined) {
        await assignTask({ id: editingId, worker_id: workerId }).unwrap();
      }
      if (status && status !== 'Created') {
        if (status === 'Completed') {
          await completeTask(editingId).unwrap();
        } else {
          await setStatus({ id: editingId, status }).unwrap();
        }
      }
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteTask(id).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Business"
        title="Tasks"
        count={`${filtered.length} ${filtered.length === 1 ? 'task' : 'tasks'}`}
        actions={
          <Button type="button" onClick={openCreate}>
            New task
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
              ...STATUSES.map((s) => ({ id: s, label: s })),
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
              { value: 'title', label: 'Title' },
              { value: 'activity_name', label: 'Activity' },
              { value: 'status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading tasks…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load tasks.</ErrorText> : null}
      {formError && !open ? <ErrorText>{formError}</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No business tasks yet.</strong> Create a task, assign an employee, then log time.
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onEditRow={(row) => openEdit(row)}
          onNew={openCreate}
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
        title={editingId ? 'Edit task' : 'New task'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={createState.isLoading || updateState.isLoading}
            >
              {createState.isLoading || updateState.isLoading ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          {!editingId ? (
            <FormRow label="Activity *">
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              >
                <option value="">Select…</option>
                {activities.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {asCaption(a.activity_name)}
                  </option>
                ))}
              </select>
            </FormRow>
          ) : null}
          <FormRow label="Title">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormRow>
          <FormRow label="Assignee">
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Unassigned</option>
              {workers.map((w) => (
                <option key={String(w.id)} value={String(w.id)}>
                  {asCaption(w.worker_name || w.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          {editingId ? (
            <FormRow label="Status">
              <select
                value={status}
                onChange={(e) => setStatusValue(e.target.value)}
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
