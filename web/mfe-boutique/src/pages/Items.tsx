import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useDeleteBoutiqueTimeEntryMutation,
  useGetBoutiqueItemQuery,
  useListBoutiqueItemsQuery,
  useListBoutiqueTimeEntriesQuery,
  useUpdateBoutiqueOrderItemMutation,
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
  PaginationBar,
  TextInput,
  displayName,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { TaskEntryModal } from '../task-log/TaskEntryModal';
import { formatDurationLabel, isActivityTask } from '../task-log/taskTimeUtils';
import {
  LIST_FETCH_ALL_SIZE,
  LIST_PAGE_SIZE,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
} from '../pagedList';
import { asCaption, extractError, formatMoney } from '../utils';
import { activitiesOf, boutiqueOrderPath } from '../order-workspace/types';
import '../ItemDetail.css';

const ITEM_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;

const DEFAULT_FILTERS = { bill_number: '', description: '', customer_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'bill_number', desc: false }];

type ItemTab = 'details' | 'tasks';

export function BoutiqueItemsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useListBoutiqueItemsQuery({
    bill_number: filters.bill_number || undefined,
    description: filters.description || undefined,
    customer_name: filters.customer_name || undefined,
    status: filters.status || undefined,
    ...sortQueryParams(sort),
    page,
    page_size: LIST_PAGE_SIZE,
  });

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, LIST_PAGE_SIZE);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'bill_number', label: 'Bill #', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        allLabel: 'All statuses',
        options: ITEM_STATUSES.map((s) => ({ value: s, label: s })),
      },
    ],
    [],
  );

  type ItemRow = (typeof pageRows)[number];

  const columns: EntityListColumn<ItemRow>[] = useMemo(
    () => [
      {
        id: 'item',
        header: 'Item',
        render: (row) => {
          const title = displayName(row, ['bill_number', 'description'], 'Unnamed item');
          const desc = asCaption(row.description);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{title}</span>
                <span className="el-customer-sub">{desc || 'No description'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => {
          const customer = asCaption(row.customer_name);
          return <span className={customer ? undefined : 'el-muted'}>{customer || '—'}</span>;
        },
      },
      {
        id: 'order',
        header: 'Order',
        render: (row) => {
          const order = asCaption(row.order_number);
          return <span className={order ? undefined : 'el-muted'}>{order || '—'}</span>;
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = asCaption(row.item_status);
          return <span className={status ? undefined : 'el-muted'}>{status || '—'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Customization Items"
        count={`${total} ${total === 1 ? 'item' : 'items'}`}
        actions={
          <Button type="button" onClick={() => navigate('/boutique/orders')}>
            Orders
          </Button>
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
              ...ITEM_STATUSES.map((s) => ({ id: s, label: s })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'bill_number', label: 'Bill #' },
              { value: 'order_number', label: 'Order #' },
              { value: 'customer_name', label: 'Customer' },
              { value: 'item_status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading items…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load items.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No items found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.item_id || row.id)}
          actions={(row) => (
            <EntityListActions
              onOpen={() =>
                navigate(
                  `/boutique/items/${row.item_id || row.id}?orderId=${encodeURIComponent(String(row.order_id || ''))}`,
                )
              }
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

export function BoutiqueItemDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('orderId') || undefined;
  const tab: ItemTab = searchParams.get('tab') === 'tasks' ? 'tasks' : 'details';

  const { data, isLoading, error, refetch } = useGetBoutiqueItemQuery(
    { itemId: id, orderId: orderIdParam },
    { skip: !id },
  );

  const item = useMemo(() => {
    if (!data) return null;
    return ((data.item as Record<string, unknown> | undefined) || data) as Record<
      string,
      unknown
    >;
  }, [data]);

  const order = useMemo(() => {
    if (!data) return null;
    return (data.order as Record<string, unknown> | undefined) || null;
  }, [data]);

  const orderId = String(order?.id || data?.order_id || orderIdParam || '');
  const itemId = String(item?.item_id || item?.id || id);
  const hasMeasurement = Boolean(item?.measurement_id);

  const { data: timeEntriesPage, refetch: refetchTasks } = useListBoutiqueTimeEntriesQuery(
    order
      ? {
          order_number: asCaption(order.order_number) || undefined,
          task_type: 'activity',
          page: 1,
          page_size: LIST_FETCH_ALL_SIZE,
        }
      : undefined,
    { skip: !order },
  );
  const timeEntries = pagedItems(timeEntriesPage);

  const [updateItem, updateState] = useUpdateBoutiqueOrderItemMutation();
  const [deleteEntry] = useDeleteBoutiqueTimeEntryMutation();

  const [billNumber, setBillNumber] = useState('');
  const [description, setDescription] = useState('');
  const [itemEtd, setItemEtd] = useState('');
  const [editError, setEditError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!item) return;
    setBillNumber(asCaption(item.bill_number));
    setDescription(asCaption(item.description));
    setItemEtd(
      asCaption(item.expected_delivery_date).slice(0, 10) ||
        asCaption(order?.expected_delivery_date).slice(0, 10),
    );
  }, [item, order?.expected_delivery_date]);

  const itemTasks = useMemo(
    () =>
      timeEntries.filter(
        (row) =>
          isActivityTask(row) &&
          String(row.bill_id || '') === itemId &&
          (!orderId || String(row.order_id || '') === orderId),
      ),
    [timeEntries, itemId, orderId],
  );

  const itemActivities = useMemo(() => {
    if (!order) return [];
    return activitiesOf(order).filter((a) => String(a.bill_id || '') === itemId);
  }, [order, itemId]);

  const activityProgress = useMemo(() => {
    const total = itemActivities.length;
    const done = itemActivities.filter((a) => {
      const s = asCaption(a.activity_status || a.status);
      return s === 'Completed' || s === 'Skipped';
    }).length;
    return { total, done, pending: total - done };
  }, [itemActivities]);

  const taskTotals = useMemo(() => {
    const byActivity = new Map<string, number>();
    let total = 0;
    for (const row of itemTasks) {
      const name = asCaption(row.activity_name) || 'Task';
      const mins = Number(row.duration_minutes || 0);
      byActivity.set(name, (byActivity.get(name) || 0) + mins);
      total += mins;
    }
    return { byActivity, total };
  }, [itemTasks]);

  function setTab(next: ItemTab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'details') params.delete('tab');
    else params.set('tab', next);
    if (orderIdParam) params.set('orderId', orderIdParam);
    setSearchParams(params, { replace: true });
  }

  async function onSaveItem() {
    setEditError('');
    setSaveOk(false);
    if (!orderId) {
      setEditError('Order is required to edit this item.');
      return;
    }
    if (!description.trim()) {
      setEditError('Description is required.');
      return;
    }
    try {
      await updateItem({
        orderId,
        itemId,
        body: {
          bill_number: hasMeasurement ? asCaption(item?.bill_number) : billNumber,
          description: description.trim(),
          expected_delivery_date: itemEtd || undefined,
        },
      }).unwrap();
      setSaveOk(true);
      refetch();
    } catch (e) {
      setEditError(extractError(e));
    }
  }

  async function onDeleteTask(entryId: string) {
    if (!window.confirm('Delete this task?')) return;
    await deleteEntry(entryId);
    refetchTasks();
  }

  if (isLoading) return <EntityListLoading>Loading item…</EntityListLoading>;
  if (error || !item) return <ErrorText>Item not found.</ErrorText>;

  const orderStatus = asCaption(order?.order_status || order?.status || data?.order_status);
  const orderNumber = asCaption(order?.order_number || data?.order_number);
  const customerName = asCaption(order?.customer_name || data?.customer_name);
  const status = asCaption(item.item_status) || 'Item';
  const billTitle = asCaption(item.bill_number) || id;
  const estimate = formatMoney(Number(item.sell_amount ?? data?.sell_amount ?? 0));
  const margin = formatMoney(Number(item.margin_amount ?? data?.margin_amount ?? 0));

  return (
    <div className="cid">
      <Link className="cid-back" to="/boutique/items">
        ← Customization Items
      </Link>

      <header className="cid-hero">
        <div>
          <p className="cid-kicker">Customization item</p>
          <h1>{billTitle}</h1>
          <p className="cid-lead">
            {asCaption(item.description) || 'No description'} · {status}
          </p>
        </div>
        <div className="cid-hero-actions">
          {orderId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(boutiqueOrderPath(orderId, orderStatus))}
            >
              Open order
            </Button>
          ) : null}
          {item.measurement_id ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/boutique/measurements/${String(item.measurement_id)}`)}
            >
              Measurement
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => navigate('/boutique/time')}>
            Tasks
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/boutique/time-log')}>
            Time log
          </Button>
        </div>
      </header>

      <div className="cid-tabs" role="tablist" aria-label="Item sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'details'}
          className={`cid-tab${tab === 'details' ? ' is-live' : ''}`}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tasks'}
          className={`cid-tab${tab === 'tasks' ? ' is-live' : ''}`}
          onClick={() => setTab('tasks')}
        >
          Tasks ({itemTasks.length})
        </button>
      </div>

      <div className="cid-snapshot">
        <div className="cid-stat">
          <span>Order</span>
          <strong>{orderNumber || '—'}</strong>
        </div>
        <div className="cid-stat">
          <span>Customer</span>
          <strong title={customerName || undefined}>{customerName || '—'}</strong>
        </div>
        <div className="cid-stat">
          <span>Estimate</span>
          <strong>{estimate}</strong>
        </div>
        <div className="cid-stat">
          <span>Margin</span>
          <strong>{margin}</strong>
        </div>
        <div className="cid-stat">
          <span>Time taken</span>
          <strong>{formatDurationLabel(taskTotals.total)}</strong>
        </div>
      </div>

      {tab === 'details' ? (
        <>
          <section className="cid-panel">
            <h2>Item details</h2>
            <p className="cid-panel-note">
              Bill number, description, and garment ETD for this customization.
            </p>
            {editError ? <ErrorText>{editError}</ErrorText> : null}
            {saveOk && !editError ? (
              <p className="cid-panel-note" style={{ color: 'var(--cid-accent)' }}>
                Item saved.
              </p>
            ) : null}
            <div className="cid-grid cid-grid-3">
              <FormRow label="Bill number">
                <TextInput
                  value={billNumber}
                  disabled={hasMeasurement || !orderId}
                  onChange={(e) => setBillNumber(e.target.value)}
                />
              </FormRow>
              <FormRow label="Description *">
                <TextInput
                  value={description}
                  disabled={!orderId}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormRow>
              <FormRow label="Item ETD">
                <input
                  type="date"
                  value={itemEtd}
                  disabled={!orderId}
                  onChange={(e) => setItemEtd(e.target.value)}
                />
              </FormRow>
            </div>
            <div className="cid-link-row">
              {hasMeasurement ? (
                <Link to={`/boutique/measurements/${String(item.measurement_id)}`}>
                  Measurement {asCaption(item.measurement_number) || String(item.measurement_id)}
                </Link>
              ) : (
                <span>No linked measurement</span>
              )}
              {orderId ? (
                <Link to={boutiqueOrderPath(orderId, orderStatus)}>Manage activities on order</Link>
              ) : null}
            </div>
            {!orderId ? (
              <ErrorText>Open this item from an order to edit details.</ErrorText>
            ) : (
              <div className="cid-actions">
                <Button
                  type="button"
                  onClick={() => void onSaveItem()}
                  disabled={updateState.isLoading}
                >
                  {updateState.isLoading ? 'Saving…' : 'Save item'}
                </Button>
              </div>
            )}
          </section>

          <section className="cid-panel">
            <h2>Activities</h2>
            <p className="cid-panel-note">
              {activityProgress.total
                ? `${activityProgress.done}/${activityProgress.total} done · ${activityProgress.pending} pending`
                : 'No activities on this item yet.'}
            </p>
            {itemActivities.length === 0 ? (
              <div className="cid-empty">Add activities from the order garments view.</div>
            ) : (
              <div className="cid-act-list">
                {itemActivities.map((act) => {
                  const actStatus = asCaption(act.activity_status || act.status) || 'Pending';
                  const done = actStatus === 'Completed' || actStatus === 'Skipped';
                  const hours = Number(act.estimated_hours || 0);
                  return (
                    <div key={String(act.order_activity_id || act.id)} className="cid-act-row">
                      <strong>{asCaption(act.activity_name) || 'Activity'}</strong>
                      <em>{hours > 0 ? `${hours}h est` : '—'}</em>
                      <span className={`cid-pill${done ? ' is-done' : ' is-pending'}`}>
                        {actStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}

      {tab === 'tasks' ? (
        <section className="cid-panel">
          <div className="cid-task-head">
            <div>
              <h2>Tasks</h2>
              <p className="cid-panel-note" style={{ marginBottom: 0 }}>
                Log time taken against an activity. Full history is on the{' '}
                <Link to="/boutique/time-log">Time log</Link>.
              </p>
            </div>
            <Button
              type="button"
              disabled={!orderId}
              onClick={() => {
                setEditingEntry(null);
                setTaskModalOpen(true);
              }}
            >
              Record task
            </Button>
          </div>

          {taskTotals.byActivity.size > 0 ? (
            <div className="cid-task-totals">
              {[...taskTotals.byActivity.entries()].map(([name, minutes]) => (
                <div key={name} className="cid-task-total">
                  <span>{name}</span>
                  <strong>{formatDurationLabel(minutes)}</strong>
                </div>
              ))}
              <div className="cid-task-total is-sum">
                <span>Total</span>
                <strong>{formatDurationLabel(taskTotals.total)}</strong>
              </div>
            </div>
          ) : null}

          {itemTasks.length === 0 ? (
            <div className="cid-empty">
              No tasks yet. Record a task to log time taken against an activity.
            </div>
          ) : (
            <div className="cid-task-list">
              {itemTasks.map((row) => (
                <div key={String(row.id)} className="cid-task-row">
                  <div className="cid-task-row-top">
                    <strong>{asCaption(row.activity_name) || 'Task'}</strong>
                    <span className="cid-pill">
                      {formatDurationLabel(Number(row.duration_minutes || 0))}
                    </span>
                  </div>
                  <div className="cid-task-meta">
                    {asCaption(row.work_date).slice(0, 10)} ·{' '}
                    {asCaption(row.start_time).slice(0, 5) || '—'}–
                    {asCaption(row.end_time).slice(0, 5) || '—'}
                    {asCaption(row.worker_name) ? ` · ${asCaption(row.worker_name)}` : ''}
                  </div>
                  {asCaption(row.notes) ? (
                    <div className="cid-task-meta">{asCaption(row.notes)}</div>
                  ) : null}
                  <div className="cid-task-row-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingEntry(row);
                        setTaskModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void onDeleteTask(String(row.id))}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <TaskEntryModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingEntry(null);
        }}
        onSaved={() => {
          refetchTasks();
        }}
        entry={editingEntry}
        lockOrderItem
        prefill={{
          orderId,
          billId: itemId,
        }}
      />
    </div>
  );
}
