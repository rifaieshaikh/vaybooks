import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useBoutiqueCalendarQuery,
  useCreateBoutiqueTimeEntryMutation,
  useDeleteBoutiqueTimeEntryMutation,
  useGetBoutiqueOrderQuery,
  useListBoutiqueOrdersQuery,
  useListBoutiqueTimeEntriesQuery,
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
  type CalendarCategory,
  type CalendarEvent,
  type CalendarEventTone,
  type CalendarViewMode,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

/** Boutique time entries have no approval status — chip by task_type instead. */
const TASK_TYPES = [
  { id: 'activity', label: 'Activity' },
  { id: 'etd', label: 'ETD' },
  { id: 'delivery', label: 'Delivery' },
] as const;

const DEFAULT_FILTERS = { worker_name: '', activity_name: '', order_number: '', task_type: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'work_date', desc: true }];

export function BoutiqueTimePage() {
  const { data = [], isLoading, error, refetch } = useListBoutiqueTimeEntriesQuery();
  const { data: orders = [] } = useListBoutiqueOrdersQuery();
  const [createEntry, createState] = useCreateBoutiqueTimeEntryMutation();
  const [deleteEntry] = useDeleteBoutiqueTimeEntryMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [billId, setBillId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [workerName, setWorkerName] = useState('');

  const { data: orderDetail } = useGetBoutiqueOrderQuery(orderId, { skip: !orderId });

  const items = useMemo(
    () =>
      orderDetail && Array.isArray(orderDetail.customization_items)
        ? (orderDetail.customization_items as Record<string, unknown>[])
        : [],
    [orderDetail],
  );
  const activitiesForBill = useMemo(() => {
    if (!orderDetail || !Array.isArray(orderDetail.order_activities) || !billId) return [];
    return (orderDetail.order_activities as Record<string, unknown>[]).filter(
      (act) => String(act.bill_id || '') === billId,
    );
  }, [orderDetail, billId]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'worker_name', label: 'Worker', type: 'text' },
      { key: 'activity_name', label: 'Activity', type: 'text' },
      { key: 'order_number', label: 'Order #', type: 'text' },
      {
        key: 'task_type',
        label: 'Task type',
        type: 'select',
        allLabel: 'All types',
        options: TASK_TYPES.map((t) => ({ value: t.id, label: t.label })),
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.worker_name, filters.worker_name)) return false;
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
      if (!matchesRegex(row.order_number, filters.order_number)) return false;
      if (filters.task_type) {
        const taskType = String(row.task_type || 'activity');
        if (taskType !== filters.task_type) return false;
      }
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function onCreate() {
    setFormError('');
    if (!orderId || !billId || !activityId || !workDate) {
      setFormError('Order, item, activity, and work date are required');
      return;
    }
    try {
      await createEntry({
        order_id: orderId,
        bill_id: billId,
        activity_id: activityId,
        work_date: workDate,
        start_time: startTime,
        end_time: endTime,
        worker_name: workerName,
      }).unwrap();
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this time entry?')) return;
    await deleteEntry(id);
    refetch();
  }

  type TimeRow = (typeof data)[number];

  const columns: EntityListColumn<TimeRow>[] = useMemo(
    () => [
      {
        id: 'entry',
        header: 'Entry',
        render: (row) => {
          const activity = displayName(row, ['activity_name'], 'Activity');
          const date = asCaption(row.work_date).slice(0, 10) || 'No date';
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">
                  {date} · {activity}
                </span>
                <span className="el-customer-sub">
                  {asCaption(row.worker_name) || 'No worker'} · {asCaption(row.order_number) || 'No order'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'duration',
        header: 'Minutes',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => `${Number(row.duration_minutes ?? 0)}`,
      },
      {
        id: 'window',
        header: 'Time',
        render: (row) => {
          const start = asCaption(row.start_time);
          const end = asCaption(row.end_time);
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
        title="Tasks / Time"
        count={`${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setOpen(true);
            }}
          >
            Log time
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Task type"
            value={filters.task_type || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, task_type: id === 'all' ? '' : id }));
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
            defaultFilters={DEFAULT_FILTERS}
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
              { value: 'duration_minutes', label: 'Minutes' },
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
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No time entries found.</strong>
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
            <Button
              type="button"
              onClick={onCreate}
              disabled={createState.isLoading || !orderId || !billId || !activityId || !workDate}
            >
              {createState.isLoading ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Order *">
            <select
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setBillId('');
                setActivityId('');
              }}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select order</option>
              {orders.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {asCaption(o.order_number)} · {asCaption(o.customer_name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Item / bill *">
            <select
              value={billId}
              onChange={(e) => {
                setBillId(e.target.value);
                setActivityId('');
              }}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={String(item.item_id || item.id)} value={String(item.item_id || item.id)}>
                  {asCaption(item.bill_number)} · {asCaption(item.description)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Activity *">
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select activity</option>
              {activitiesForBill.map((act) => (
                <option key={String(act.order_activity_id)} value={String(act.activity_id)}>
                  {asCaption(act.activity_name)}
                </option>
              ))}
            </select>
          </FormRow>
          {orderId && billId && activitiesForBill.length === 0 ? (
            <ErrorText>
              This item has no activities. Add the item with required activities on the order first.
            </ErrorText>
          ) : null}
          <FormRow label="Work date *">
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormRow label="Start">
              <TextInput value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </FormRow>
            <FormRow label="End">
              <TextInput value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </FormRow>
          </div>
          <FormRow label="Worker">
            <TextInput value={workerName} onChange={(e) => setWorkerName(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function BoutiqueCalendarPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useBoutiqueCalendarQuery();
  const { data: orders = [] } = useListBoutiqueOrdersQuery();
  const [view, setView] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedCategories, setSelectedCategories] = useState(['activity', 'etd', 'delivery', 'order_etd']);

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
        meta: [asCaption(row.worker_name), asCaption(row.order_number)].filter(Boolean).join(' · '),
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
          <Button type="button" onClick={() => navigate('/boutique/time?new=1')}>
            Log time
          </Button>
        </>
      }
      onEventClick={(ev) => {
        const row = ev.payload as Record<string, unknown> | undefined;
        if (!row) return;
        if (row._kind === 'order' || ev.category === 'order_etd') {
          navigate(`/boutique/orders/${String(row.id)}`);
          return;
        }
        const orderId = row.order_id != null ? String(row.order_id) : '';
        if (orderId) navigate(`/boutique/orders/${orderId}`);
        else navigate('/boutique/time');
      }}
      onSlotClick={() => navigate('/boutique/time?new=1')}
    />
  );
}
