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
  StatusPill,
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
import { boutiqueItemStatusTone, boutiqueTaskStatus } from '../boutiqueListHelpers';
import { boutiqueOrderPath } from '../order-workspace/types';
import '../BoutiqueList.css';

const TASK_TYPES = [
  { id: 'activity', label: 'Activity' },
  { id: 'etd', label: 'ETD' },
  { id: 'delivery', label: 'Delivery' },
] as const;

const DEFAULT_TASK_FILTERS = {
  q: '',
  worker_name: '',
  activity_name: '',
  order_number: '',
  task_type: 'activity',
  status: '',
};
const DEFAULT_LOG_FILTERS = {
  q: '',
  worker_name: '',
  activity_name: '',
  order_number: '',
  task_type: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'work_date', desc: true }];
const TASK_STATUSES = ['Created', 'Completed'] as const;

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

  const { data, isLoading, error, isFetching, refetch } = useListBoutiqueTimeEntriesQuery({
    q: filters.q || undefined,
    worker_name: filters.worker_name || undefined,
    activity_name: filters.activity_name || undefined,
    order_number: filters.order_number || undefined,
    task_type: 'activity',
    status: filters.status || undefined,
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
  const hasActiveFilters = Boolean(
    filters.q || filters.worker_name || filters.activity_name || filters.order_number || filters.status,
  );
  const pagePulse = useMemo(() => {
    let created = 0;
    let completed = 0;
    for (const row of pageRows) {
      if (boutiqueTaskStatus(row) === 'Completed') completed += 1;
      else created += 1;
    }
    return { created, completed };
  }, [pageRows]);

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

  function openRecord() {
    modal.setEditingEntry(null);
    modal.setPrefill(undefined);
    modal.setOpen(true);
  }

  type TimeRow = (typeof pageRows)[number];

  const columns: EntityListColumn<TimeRow>[] = useMemo(
    () => [
      {
        id: 'task',
        header: 'Task',
        render: (row) => {
          const activity = displayName(row, ['activity_name'], 'Task');
          const date = asCaption(row.work_date).slice(0, 10) || 'No date';
          const est = Number(row.estimated_hours || 0);
          return (
            <div className="bl-primary">
              <div className="bl-primary-title">
                {activity}
                {est > 0 ? ` · ${est}h est` : ''}
              </div>
              <div className="bl-primary-sub">
                {date} · {asCaption(row.assignee_name) || asCaption(row.worker_name) || 'Unassigned'} ·{' '}
                {asCaption(row.order_number) || 'No order'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'bill',
        header: 'Bill',
        render: (row) => {
          const bill = asCaption(row.bill_number);
          return <span className={bill ? undefined : 'el-muted'}>{bill || '—'}</span>;
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = boutiqueTaskStatus(row);
          return <StatusPill status={status} tone={boutiqueItemStatusTone(status)} />;
        },
      },
      {
        id: 'duration',
        header: 'Time taken',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const mins = Number(row.duration_minutes ?? 0);
          if (!mins && !asCaption(row.start_time)) return <span className="el-muted">—</span>;
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
    <EntityListPage className="bl-page">
      <EntityListHero
        kicker="Boutique"
        title="Tasks"
        count={`${total} ${total === 1 ? 'task' : 'tasks'} · ${formatDurationLabel(totalMinutes)}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
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
            <Button type="button" onClick={openRecord}>
              Record task
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={filters.q}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, q: e.target.value }));
              setPage(1);
            }}
            placeholder="Search worker, activity, order, or bill…"
            aria-label="Search tasks"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.status || 'all'}
            onChange={(nextId) => {
              setFilters((prev) => ({ ...prev, status: nextId === 'all' ? '' : nextId }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...TASK_STATUSES.map((s) => ({ id: s, label: s })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_TASK_FILTERS}
            excludeKeys={['q', 'status', 'task_type']}
            onFiltersChange={(next) => {
              setFilters({
                ...DEFAULT_TASK_FILTERS,
                ...next,
                q: filters.q,
                status: filters.status,
                task_type: 'activity',
              });
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
        summary={
          !isLoading && pageRows.length > 0 ? (
            <div className="el-pulse">
              <span>
                <strong>{pagePulse.created}</strong> open
              </span>
              <span>
                <strong>{pagePulse.completed}</strong> logged
              </span>
              <span className="el-muted">
                on this page{isFetching ? ' · Updating…' : ''}
              </span>
            </div>
          ) : null
        }
      />

      {syncMsg ? <p className="bl-sync-note">{syncMsg}</p> : null}
      {isLoading ? <EntityListLoading>Loading tasks…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load tasks.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{hasActiveFilters ? 'No matching tasks' : 'No tasks yet'}</strong>
          <p>
            {hasActiveFilters
              ? 'Clear search or status filters to see more tasks.'
              : 'Confirm an order to create tasks for required activities, or sync open orders.'}
          </p>
          <div className="bl-empty-cta">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFilters({ ...DEFAULT_TASK_FILTERS });
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <Button type="button" onClick={openRecord}>
              Record task
            </Button>
          </div>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/boutique/time/${String(row.id)}`)}
          onNew={openRecord}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/boutique/time/${String(row.id)}`)}
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

  const { data, isLoading, error, isFetching, refetch } = useListBoutiqueTimeEntriesQuery({
    q: filters.q || undefined,
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
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.worker_name ||
      filters.activity_name ||
      filters.order_number ||
      filters.task_type,
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'worker_name', label: 'Worker', type: 'text' },
      { key: 'activity_name', label: 'Activity', type: 'text' },
      { key: 'order_number', label: 'Order #', type: 'text' },
    ],
    [],
  );

  function openEntry(row: Record<string, unknown>) {
    navigate(`/boutique/time/${String(row.id)}?from=log`);
  }

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
          const typeLabel =
            TASK_TYPES.find((t) => t.id === taskType)?.label || taskType;
          return (
            <div className="bl-primary">
              <div className="bl-primary-title">
                {date} · {activity}
              </div>
              <div className="bl-primary-sub">
                {typeLabel} ·{' '}
                {asCaption(row.assignee_name) || asCaption(row.worker_name) || 'No worker'} ·{' '}
                {asCaption(row.order_number) || 'No order'}
                {asCaption(row.bill_number) ? ` · Bill ${asCaption(row.bill_number)}` : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = boutiqueTaskStatus(row);
          return <StatusPill status={status} tone={boutiqueItemStatusTone(status)} />;
        },
      },
      {
        id: 'duration',
        header: 'Time taken',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const mins = Number(row.duration_minutes ?? 0);
          if (!mins && !asCaption(row.start_time)) return <span className="el-muted">—</span>;
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
          return <span className={label ? undefined : 'el-muted'}>{label || '—'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage className="bl-page">
      <EntityListHero
        kicker="Boutique"
        title="Time log"
        count={`${total} ${total === 1 ? 'entry' : 'entries'} · ${formatDurationLabel(totalMinutes)}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" variant="ghost" onClick={() => navigate('/boutique/time')}>
              Tasks
            </Button>
            <Button type="button" onClick={() => navigate('/boutique/time?new=1')}>
              Record task
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={filters.q}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, q: e.target.value }));
              setPage(1);
            }}
            placeholder="Search worker, activity, order, or bill…"
            aria-label="Search time log"
          />
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
            excludeKeys={['q', 'task_type']}
            onFiltersChange={(next) => {
              setFilters({
                ...DEFAULT_LOG_FILTERS,
                ...next,
                q: filters.q,
                task_type: filters.task_type,
              });
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
        summary={
          !isLoading && pageRows.length > 0 ? (
            <div className="el-pulse">
              <span>
                <strong>{formatDurationLabel(totalMinutes)}</strong> on this page
              </span>
              <span className="el-muted">{isFetching ? 'Updating…' : 'Logged time'}</span>
            </div>
          ) : null
        }
      />

      <p className="bl-sync-note">
        Chronological log of time taken across tasks, ETD, and delivery. Manage activity work on{' '}
        <Link to="/boutique/time">Tasks</Link>.
      </p>

      {isLoading ? <EntityListLoading>Loading time log…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load time log.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{hasActiveFilters ? 'No matching entries' : 'No time logged yet'}</strong>
          <p>
            {hasActiveFilters
              ? 'Clear search or type filters to see more entries.'
              : 'Record task time from Tasks, or open an item and log work there.'}
          </p>
          <div className="bl-empty-cta">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFilters({ ...DEFAULT_LOG_FILTERS });
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <Button type="button" onClick={() => navigate('/boutique/time?new=1')}>
              Record task
            </Button>
          </div>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => openEntry(row)}
          onNew={() => navigate('/boutique/time?new=1')}
          actions={(row) => (
            <EntityListActions
              onOpen={() => openEntry(row)}
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
