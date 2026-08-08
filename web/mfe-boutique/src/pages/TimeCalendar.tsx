import { useMemo, useState } from 'react';
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

const DEFAULT_FILTERS = { worker_name: '', activity_name: '', order_number: '' };
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
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.worker_name, filters.worker_name)) return false;
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
      if (!matchesRegex(row.order_number, filters.order_number)) return false;
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

  return (
    <div>
      <ListToolbar
        title="Tasks / Time"
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load time entries.</ErrorText> : null}
      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={`${asCaption(row.work_date).slice(0, 10)} · ${asCaption(row.activity_name)}`}
            captions={[
              asCaption(row.worker_name),
              asCaption(row.order_number),
              `${Number(row.duration_minutes ?? 0)} min`,
              `${asCaption(row.start_time)}–${asCaption(row.end_time)}`,
            ]}
            onEdit={() => {
              if (window.confirm('Delete this time entry?')) {
                deleteEntry(String(row.id)).then(() => refetch());
              }
            }}
          />
        ))}
      </EntityCardGrid>
      <p style={{ color: '#889', fontSize: 13 }}>Edit deletes the time entry (with confirmation).</p>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

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
    </div>
  );
}

export function BoutiqueCalendarPage() {
  const { data = [], isLoading, error, refetch } = useBoutiqueCalendarQuery();
  const byDate = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const row of data) {
      const key = asCaption(row.work_date).slice(0, 10) || 'undated';
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Boutique Calendar</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load calendar.</ErrorText> : null}
      {!isLoading && byDate.length === 0 && (
        <p style={{ color: '#667' }}>No calendar entries in range.</p>
      )}
      {byDate.map(([day, rows]) => (
        <div key={day} style={{ marginBottom: 20 }}>
          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>{day}</h3>
          <EntityCardGrid>
            {rows.map((row) => (
              <EntityCard
                key={String(row.id)}
                title={asCaption(row.activity_name) || asCaption(row.task_type) || 'Task'}
                captions={[
                  asCaption(row.worker_name),
                  asCaption(row.order_number),
                  `${asCaption(row.start_time)}–${asCaption(row.end_time)}`,
                ]}
              />
            ))}
          </EntityCardGrid>
        </div>
      ))}
    </div>
  );
}
