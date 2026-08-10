import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useBoutiqueCalendarQuery,
  useDeleteBoutiqueTimeEntryMutation,
  useListBoutiqueOrdersQuery,
  useListBoutiqueTimeEntriesQuery,
  useSyncBoutiqueActivityTasksMutation,
} from '@vaybooks/store';
import {
  Button,
  CalendarView,
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
  PaginationBar,
  displayName,
  type CalendarCategory,
  type CalendarEvent,
  type CalendarEventTone,
  type CalendarViewMode,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { TaskEntryModal, type TaskEntryPrefill } from '../task-log/TaskEntryModal';
import { formatDurationLabel } from '../task-log/taskTimeUtils';
import {
  LIST_FETCH_ALL_SIZE,
  LIST_PAGE_SIZE,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
} from '../pagedList';
import { asCaption } from '../utils';
import { boutiqueOrderPath } from '../order-workspace/types';

const TASK_TYPES = [
  { id: 'activity', label: 'Activity' },
  { id: 'etd', label: 'ETD' },
  { id: 'delivery', label: 'Delivery' },
] as const;

const DEFAULT_TASK_FILTERS = {
  worker_name: '',
  activity_name: '',
  order_number: '',
  task_type: 'activity',
};
const DEFAULT_LOG_FILTERS = {
  worker_name: '',
  activity_name: '',
  order_number: '',
  task_type: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'work_date', desc: true }];

function useTaskModalFromQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Record<string, unknown> | null>(null);
  const [prefill, setPrefill] = useState<TaskEntryPrefill | undefined>();

  useEffect(() => {
    const wantsNew = searchParams.get('new') === '1';
    if (!wantsNew) return;
    setEditingEntry(null);
    setPrefill({
      orderId: searchParams.get('orderId') || undefined,
      billId: searchParams.get('billId') || undefined,
      activityId: searchParams.get('activityId') || undefined,
    });
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    next.delete('orderId');
    next.delete('billId');
    next.delete('activityId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    open,
    setOpen,
    editingEntry,
    setEditingEntry,
    prefill,
    setPrefill,
  };
}

export function BoutiqueTimePage() {
  const navigate = useNavigate();
  const [deleteEntry] = useDeleteBoutiqueTimeEntryMutation();
  const [syncTasks, syncState] = useSyncBoutiqueActivityTasksMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_TASK_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [syncMsg, setSyncMsg] = useState('');
  const modal = useTaskModalFromQuery();

  const { data, isLoading, error, refetch } = useListBoutiqueTimeEntriesQuery({
    worker_name: filters.worker_name || undefined,
    activity_name: filters.activity_name || undefined,
    order_number: filters.order_number || undefined,
    task_type: 'activity',
    ...sortQueryParams(sort),
    page,
    page_size: LIST_PAGE_SIZE,
  });

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, LIST_PAGE_SIZE);
  const totalMinutes = useMemo(
    () => pageRows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0),
    [pageRows],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'worker_name', label: 'Worker', type: 'text' },
      { key: 'activity_name', label: 'Activity', type: 'text' },
      { key: 'order_number', label: 'Order #', type: 'text' },
    ],
    [],
  );

  async function onDelete(id: string) {
    if (!window.confirm('Delete this task?')) return;
    await deleteEntry(id);
    refetch();
  }

  type TimeRow = (typeof pageRows)[number];

  const columns: EntityListColumn<TimeRow>[] = useMemo(
    () => [
      {
        id: 'task',
        header: 'Task',
        render: (row) => {
          const activity = displayName(row, ['activity_name'], 'Task');
          const status = asCaption(row.status) || (asCaption(row.start_time) ? 'Completed' : 'Created');
          const date = asCaption(row.work_date).slice(0, 10) || 'No date';
          const est = Number(row.estimated_hours || 0);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">
                  {activity}
                  {est > 0 ? ` · ${est}h est` : ''}
                </span>
                <span className="el-customer-sub">
                  {status} · {date} ·{' '}
                  {asCaption(row.assignee_name) || asCaption(row.worker_name) || 'Unassigned'} ·{' '}
                  {asCaption(row.order_number) || 'No order'} · Bill{' '}
                  {asCaption(row.bill_number) || '—'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = asCaption(row.status) || (asCaption(row.start_time) ? 'Completed' : 'Created');
          return <span>{status}</span>;
        },
      },
      {
        id: 'duration',
        header: 'Time taken',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const mins = Number(row.duration_minutes ?? 0);
          if (!mins && !asCaption(row.start_time)) return '—';
          return formatDurationLabel(mins);
        },
      },
      {
        id: 'window',
        header: 'Hours',
        render: (row) => {
          const start = asCaption(row.start_time).slice(0, 5);
          const end = asCaption(row.end_time).slice(0, 5);
          const label = start || end ? `${start || '—'}–${end || '—'}` : '';
          return <span className={label ? undefined : 'el-muted'}>{label || 'Not scheduled'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Tasks"
        count={`${total} ${total === 1 ? 'task' : 'tasks'} · ${formatDurationLabel(totalMinutes)}`}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => navigate('/boutique/time-log')}>
              Time log
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={syncState.isLoading}
              onClick={async () => {
                setSyncMsg('');
                try {
                  const result = await syncTasks().unwrap();
                  setSyncMsg(
                    `Synced ${Number(result.orders ?? 0)} orders` +
                      (result.tasks_created != null
                        ? ` · ${Number(result.tasks_created)} new tasks`
                        : ''),
                  );
                  refetch();
                } catch {
                  setSyncMsg('Sync failed');
                }
              }}
            >
              {syncState.isLoading ? 'Syncing…' : 'Sync tasks'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                modal.setEditingEntry(null);
                modal.setPrefill(undefined);
                modal.setOpen(true);
              }}
            >
              Record task
            </Button>
          </>
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_TASK_FILTERS}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'work_date', label: 'Date' },
              { value: 'worker_name', label: 'Worker' },
              { value: 'duration_minutes', label: 'Time taken' },
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
      {syncMsg ? <p style={{ color: '#667', marginBottom: 8 }}>{syncMsg}</p> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No tasks found.</strong>
          <span>
            {' '}
            Confirm an order to create tasks for required activities, or click Sync tasks for open
            orders.
          </span>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions
              onOpen={() => {
                modal.setEditingEntry(row);
                modal.setOpen(true);
              }}
              onDelete={() => void onDelete(String(row.id))}
            />
          )}
        />
      ) : null}

      {!isLoading && !error && total > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar
              page={Math.min(page, pages)}
              pageCount={pages}
              onPage={setPage}
              totalCount={total}
              pageSize={LIST_PAGE_SIZE}
            />
          </div>
        </EntityListFoot>
      ) : null}

      <TaskEntryModal
        open={modal.open}
        onClose={() => {
          modal.setOpen(false);
          modal.setEditingEntry(null);
        }}
        onSaved={() => refetch()}
        entry={modal.editingEntry}
        prefill={modal.prefill}
      />
    </EntityListPage>
  );
}

export function BoutiqueTimeLogPage() {
  const navigate = useNavigate();
  const [deleteEntry] = useDeleteBoutiqueTimeEntryMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_LOG_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useListBoutiqueTimeEntriesQuery({
    worker_name: filters.worker_name || undefined,
    activity_name: filters.activity_name || undefined,
    order_number: filters.order_number || undefined,
    task_type: filters.task_type || undefined,
    ...sortQueryParams(sort),
    page,
    page_size: LIST_PAGE_SIZE,
  });

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, LIST_PAGE_SIZE);
  const totalMinutes = useMemo(
    () => pageRows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0),
    [pageRows],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'worker_name', label: 'Worker', type: 'text' },
      { key: 'activity_name', label: 'Activity', type: 'text' },
      { key: 'order_number', label: 'Order #', type: 'text' },
      {
        key: 'task_type',
        label: 'Type',
        type: 'select',
        allLabel: 'All types',
        options: TASK_TYPES.map((t) => ({ value: t.id, label: t.label })),
      },
    ],
    [],
  );

  async function onDelete(id: string) {
    if (!window.confirm('Delete this time log entry?')) return;
    await deleteEntry(id);
    refetch();
  }

  type TimeRow = (typeof pageRows)[number];

  const columns: EntityListColumn<TimeRow>[] = useMemo(
    () => [
      {
        id: 'entry',
        header: 'Log entry',
        render: (row) => {
          const activity = displayName(row, ['activity_name'], 'Entry');
          const date = asCaption(row.work_date).slice(0, 10) || 'No date';
          const taskType = String(row.task_type || 'activity');
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">
                  {date} · {activity}
                </span>
                <span className="el-customer-sub">
                  {taskType} ·{' '}
                  {asCaption(row.assignee_name) || asCaption(row.worker_name) || 'No worker'} ·{' '}
                  {asCaption(row.order_number) || 'No order'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'duration',
        header: 'Time taken',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatDurationLabel(Number(row.duration_minutes ?? 0)),
      },
      {
        id: 'window',
        header: 'Hours',
        render: (row) => {
          const start = asCaption(row.start_time).slice(0, 5);
          const end = asCaption(row.end_time).slice(0, 5);
          const label = start || end ? `${start || '—'}–${end || '—'}` : '';
          return <span className={label ? undefined : 'el-muted'}>{label || '—'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Time log"
        count={`${total} ${total === 1 ? 'entry' : 'entries'} · ${formatDurationLabel(totalMinutes)}`}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => navigate('/boutique/time')}>
              Tasks
            </Button>
            <Button type="button" onClick={() => navigate('/boutique/time?new=1')}>
              Record task
            </Button>
          </>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Entry type"
            value={filters.task_type || 'all'}
            onChange={(nextId) => {
              setFilters((prev) => ({ ...prev, task_type: nextId === 'all' ? '' : nextId }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...TASK_TYPES.map((t) => ({ id: t.id, label: t.label })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_LOG_FILTERS}
            excludeKeys={['task_type']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'work_date', label: 'Date' },
              { value: 'worker_name', label: 'Worker' },
              { value: 'duration_minutes', label: 'Time taken' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#667' }}>
        Chronological log of time taken across tasks, ETD, and delivery milestones. Manage activity
        work on <Link to="/boutique/time">Tasks</Link>.
      </p>

      {isLoading ? <EntityListLoading>Loading time log…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load time log.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No time log entries found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions
              onOpen={() => {
                const orderId = row.order_id != null ? String(row.order_id) : '';
                const billId = row.bill_id != null ? String(row.bill_id) : '';
                if (orderId && billId) {
                  navigate(
                    `/boutique/items/${billId}?orderId=${encodeURIComponent(orderId)}&tab=tasks`,
                  );
                  return;
                }
                navigate('/boutique/time');
              }}
              onDelete={() => void onDelete(String(row.id))}
            />
          )}
        />
      ) : null}

      {!isLoading && !error && total > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar
              page={Math.min(page, pages)}
              pageCount={pages}
              onPage={setPage}
              totalCount={total}
              pageSize={LIST_PAGE_SIZE}
            />
          </div>
        </EntityListFoot>
      ) : null}
    </EntityListPage>
  );
}

export function BoutiqueCalendarPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useBoutiqueCalendarQuery();
  const { data: ordersPage } = useListBoutiqueOrdersQuery({
    page: 1,
    page_size: LIST_FETCH_ALL_SIZE,
  });
  const orders = pagedItems(ordersPage);
  const [view, setView] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedCategories, setSelectedCategories] = useState([
    'activity',
    'etd',
    'delivery',
    'order_etd',
  ]);

  const categories: CalendarCategory[] = [
    { id: 'activity', label: 'Activity', tone: 'primary' },
    { id: 'etd', label: 'ETD task', tone: 'warn' },
    { id: 'delivery', label: 'Delivery task', tone: 'accent' },
    { id: 'order_etd', label: 'Order ETD', tone: 'ok' },
  ];

  const events: CalendarEvent[] = useMemo(() => {
    const fromTasks: CalendarEvent[] = data.map((row) => {
      const taskType = String(row.task_type || 'activity');
      const day = asCaption(row.work_date).slice(0, 10);
      const startTime = asCaption(row.start_time).slice(0, 5);
      const endTime = asCaption(row.end_time).slice(0, 5);
      const start = startTime ? `${day}T${startTime}` : day;
      const end = endTime ? `${day}T${endTime}` : undefined;
      const tone: CalendarEventTone =
        taskType === 'etd' ? 'warn' : taskType === 'delivery' ? 'accent' : 'primary';
      return {
        id: `task-${String(row.id)}`,
        title: asCaption(row.activity_name) || asCaption(row.task_type) || 'Task',
        start,
        end,
        allDay: !startTime,
        category: taskType === 'etd' || taskType === 'delivery' ? taskType : 'activity',
        tone,
        meta: [
          asCaption(row.assignee_name) || asCaption(row.worker_name),
          asCaption(row.order_number),
        ]
          .filter(Boolean)
          .join(' · '),
        payload: row,
      };
    });

    const fromOrders: CalendarEvent[] = orders
      .map((row) => {
        const etd = asCaption(row.expected_delivery_date).slice(0, 10);
        if (!etd) return null;
        return {
          id: `order-etd-${String(row.id)}`,
          title: asCaption(row.order_number) || 'Order ETD',
          start: etd,
          allDay: true,
          category: 'order_etd',
          tone: 'ok' as const,
          meta: asCaption(row.customer_name) || asCaption(row.status) || undefined,
          payload: { ...row, _kind: 'order' },
        };
      })
      .filter(Boolean) as CalendarEvent[];

    return [...fromTasks, ...fromOrders];
  }, [data, orders]);

  return (
    <CalendarView
      kicker="Boutique"
      title="Calendar"
      count={`${events.length} scheduled`}
      events={events}
      view={view}
      onViewChange={setView}
      cursor={cursor}
      onCursorChange={setCursor}
      categories={categories}
      selectedCategories={selectedCategories}
      onCategoriesChange={setSelectedCategories}
      loading={isLoading}
      error={error ? <ErrorText>Failed to load calendar.</ErrorText> : null}
      emptyLabel="No boutique work or delivery dates in view."
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/boutique/time-log')}>
            Time log
          </Button>
          <Button type="button" onClick={() => navigate('/boutique/time?new=1')}>
            Record task
          </Button>
        </>
      }
      onEventClick={(ev) => {
        const row = ev.payload as Record<string, unknown> | undefined;
        if (!row) return;
        if (row._kind === 'order' || ev.category === 'order_etd') {
          navigate(boutiqueOrderPath(String(row.id), String(row.order_status || row.status || '')));
          return;
        }
        const orderId = row.order_id != null ? String(row.order_id) : '';
        const billId = row.bill_id != null ? String(row.bill_id) : '';
        if (orderId && billId) {
          navigate(`/boutique/items/${billId}?orderId=${encodeURIComponent(orderId)}&tab=tasks`);
          return;
        }
        if (orderId) {
          navigate(boutiqueOrderPath(orderId, String(row.order_status || row.status || '')));
          return;
        }
        navigate('/boutique/time');
      }}
      onSlotClick={() => navigate('/boutique/time?new=1')}
    />
  );
}
