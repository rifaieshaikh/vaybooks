import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useAddBoutiqueItemActivityMutation,
  useDeleteBoutiqueTimeEntryMutation,
  useGetBoutiqueItemQuery,
  useListBoutiqueActivitiesQuery,
  useListBoutiqueItemsQuery,
  useListBoutiqueOrderExpensesQuery,
  useListBoutiqueTimeEntriesQuery,
  useRemoveBoutiqueItemActivityMutation,
  useUpdateBoutiqueOrderItemMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailBanner,
  EntityDetailEmptyCta,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityDetailTabs,
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
  StatusPill,
  TextInput,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { ActivityCompleteControls } from '../order-workspace/components/ActivityCompleteControls';
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
import { boutiqueItemStatusTone } from '../boutiqueListHelpers';
import '../order-workspace/OrderWorkspace.css';
import '../BoutiqueList.css';
import '../BoutiqueDetailExtras.css';

const ITEM_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;

const DEFAULT_FILTERS = {
  q: '',
  bill_number: '',
  description: '',
  customer_name: '',
  status: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'bill_number', desc: false }];

type ItemTab = 'details' | 'activities' | 'tasks';

function openItemPath(row: Record<string, unknown>, tab?: ItemTab): string {
  const itemId = String(row.item_id || row.id || '');
  const orderId = String(row.order_id || '');
  const params = new URLSearchParams();
  if (orderId) params.set('orderId', orderId);
  if (tab && tab !== 'details') params.set('tab', tab);
  const qs = params.toString();
  return `/boutique/items/${itemId}${qs ? `?${qs}` : ''}`;
}

export function BoutiqueItemsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const { data, isLoading, error, isFetching, refetch } = useListBoutiqueItemsQuery({
    q: filters.q || undefined,
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
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.bill_number ||
      filters.description ||
      filters.customer_name ||
      filters.status,
  );

  const pagePulse = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    for (const row of pageRows) {
      const s = asCaption(row.item_status).toLowerCase();
      if (s.includes('complete')) completed += 1;
      else if (s.includes('progress')) inProgress += 1;
      else pending += 1;
    }
    return { pending, inProgress, completed };
  }, [pageRows]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'bill_number', label: 'Bill #', type: 'text' },
      { key: 'description', label: 'Garment', type: 'text' },
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

  function openItem(row: ItemRow, tab?: ItemTab) {
    navigate(openItemPath(row, tab));
  }

  function openOrder(row: ItemRow, event?: MouseEvent) {
    event?.stopPropagation();
    const orderId = String(row.order_id || '');
    if (!orderId) return;
    navigate(boutiqueOrderPath(orderId, asCaption(row.order_status)));
  }

  const columns: EntityListColumn<ItemRow>[] = useMemo(
    () => [
      {
        id: 'item',
        header: 'Garment',
        render: (row) => {
          const bill = asCaption(row.bill_number) || 'No bill #';
          const desc = asCaption(row.description) || 'No description';
          return (
            <div className="bl-primary">
              <div className="bl-primary-title">{bill}</div>
              <div className="bl-primary-sub">{desc}</div>
            </div>
          );
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => {
          const customer = asCaption(row.customer_name);
          const phone = asCaption(row.phone_number);
          if (!customer) return <span className="el-muted">—</span>;
          return (
            <div className="bl-meta">
              <strong>{customer}</strong>
              {phone ? <span>{phone}</span> : null}
            </div>
          );
        },
      },
      {
        id: 'order',
        header: 'Order',
        render: (row) => {
          const order = asCaption(row.order_number);
          if (!order) return <span className="el-muted">—</span>;
          return (
            <button type="button" className="bl-link" onClick={(e) => openOrder(row, e)}>
              {order}
            </button>
          );
        },
      },
      {
        id: 'etd',
        header: 'ETD',
        render: (row) => {
          const etd = asCaption(row.expected_delivery_date).slice(0, 10);
          return <span className={etd ? undefined : 'el-muted'}>{etd || '—'}</span>;
        },
      },
      {
        id: 'estimate',
        header: 'Estimate',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const amount = Number(row.sell_amount ?? 0);
          return (
            <span className={amount ? undefined : 'el-muted'}>
              {amount ? formatMoney(amount) : '—'}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = asCaption(row.item_status);
          return <StatusPill status={status || '—'} tone={boutiqueItemStatusTone(status)} />;
        },
      },
    ],
    // navigate is stable; openOrder closes over it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <EntityListPage className="bl-page">
      <EntityListHero
        kicker="Boutique"
        title="Customization Items"
        count={`${total} ${total === 1 ? 'garment' : 'garments'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" variant="ghost" onClick={() => navigate('/boutique/measurements')}>
              Measurements
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/boutique/orders')}>
              Orders
            </Button>
            <Button type="button" onClick={() => navigate('/boutique/orders/workspace')}>
              New order
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
            placeholder="Search bill #, garment, customer, or order…"
            aria-label="Search customization items"
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
              ...ITEM_STATUSES.map((s) => ({ id: s, label: s })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['status', 'q']}
            onFiltersChange={(next) => {
              setFilters({ ...DEFAULT_FILTERS, ...next, q: filters.q, status: filters.status });
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'bill_number', label: 'Bill #' },
              { value: 'order_number', label: 'Order #' },
              { value: 'customer_name', label: 'Customer' },
              { value: 'item_status', label: 'Status' },
              { value: 'sell_amount', label: 'Estimate' },
              { value: 'expected_delivery_date', label: 'ETD' },
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
                <strong>{pagePulse.pending}</strong> pending
              </span>
              <span>
                <strong>{pagePulse.inProgress}</strong> in progress
              </span>
              <span>
                <strong>{pagePulse.completed}</strong> completed
              </span>
              <span className="el-muted">on this page</span>
            </div>
          ) : null
        }
      />

      {isLoading ? <EntityListLoading>Loading garments…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load customization items.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{hasActiveFilters ? 'No matching garments' : 'No garments yet'}</strong>
          <p>
            {hasActiveFilters
              ? 'Clear search or status filters to see more garments.'
              : 'Add garments on a customization order, then manage them here.'}
          </p>
          <div className="bl-empty-cta">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFilters({ ...DEFAULT_FILTERS });
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <Button type="button" onClick={() => navigate('/boutique/orders/workspace')}>
              New order
            </Button>
          </div>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.item_id || row.id)}
          keyboardNav
          onActivateRow={(row) => openItem(row)}
          onNew={() => navigate('/boutique/orders/workspace')}
          actions={(row) => (
            <EntityListActions
              onOpen={() => openItem(row)}
              openLabel="Open"
              primary={{
                label: 'Log time',
                onClick: () => openItem(row, 'tasks'),
                title: 'Record task time for this garment',
              }}
              onEdit={
                row.order_id
                  ? () => openOrder(row)
                  : undefined
              }
              editLabel="Order"
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
          {isFetching && !isLoading ? (
            <span className="el-muted" style={{ fontSize: '0.8rem' }}>
              Updating…
            </span>
          ) : null}
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
  const tabParam = searchParams.get('tab');
  const tab: ItemTab =
    tabParam === 'tasks' ? 'tasks' : tabParam === 'activities' ? 'activities' : 'details';

  const { data, isLoading, error, refetch } = useGetBoutiqueItemQuery(
    { itemId: id, orderId: orderIdParam },
    { skip: !id },
  );
  const { data: catalog = [] } = useListBoutiqueActivitiesQuery();

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
  const readOnly = !orderId;

  const { data: expenses = [], refetch: refetchExpenses } = useListBoutiqueOrderExpensesQuery(
    orderId,
    { skip: !orderId },
  );

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
  const [addActivity, addActivityState] = useAddBoutiqueItemActivityMutation();
  const [removeActivity] = useRemoveBoutiqueItemActivityMutation();

  const [billNumber, setBillNumber] = useState('');
  const [description, setDescription] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [itemEtd, setItemEtd] = useState('');
  const [editError, setEditError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Record<string, unknown> | null>(null);
  const [taskPrefillActivityId, setTaskPrefillActivityId] = useState<string | undefined>();
  const [addActivityId, setAddActivityId] = useState('');

  useEffect(() => {
    if (!searchParams.get('task')) return;
    openRecordTask();
    const params = new URLSearchParams(searchParams);
    params.delete('task');
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!item) return;
    setBillNumber(asCaption(item.bill_number));
    setDescription(asCaption(item.description));
    setSellAmount(String(Number(item.sell_amount ?? 0) || ''));
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
    const totalActs = itemActivities.length;
    const done = itemActivities.filter((a) => {
      const s = asCaption(a.activity_status || a.status);
      return s === 'Completed' || s === 'Skipped';
    }).length;
    return { total: totalActs, done, pending: totalActs - done };
  }, [itemActivities]);

  const taskTotals = useMemo(() => {
    const byActivity = new Map<string, number>();
    let totalMins = 0;
    for (const row of itemTasks) {
      const name = asCaption(row.activity_name) || 'Task';
      const mins = Number(row.duration_minutes || 0);
      byActivity.set(name, (byActivity.get(name) || 0) + mins);
      totalMins += mins;
    }
    return { byActivity, total: totalMins };
  }, [itemTasks]);

  function setTab(next: ItemTab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'details') params.delete('tab');
    else params.set('tab', next);
    if (orderIdParam) params.set('orderId', orderIdParam);
    else if (orderId) params.set('orderId', orderId);
    setSearchParams(params, { replace: true });
  }

  function openRecordTask(activityId?: string) {
    setEditingEntry(null);
    setTaskPrefillActivityId(activityId);
    setTaskModalOpen(true);
    if (tab !== 'tasks') setTab('tasks');
  }

  async function onSaveItem() {
    setEditError('');
    setSaveOk(false);
    if (!orderId) {
      setEditError('Open this garment from an order to edit details.');
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
          sell_amount: Number(sellAmount) || 0,
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

  function onActivityDone() {
    refetch();
    refetchExpenses();
    refetchTasks();
  }

  const catalogActivitiesToAdd = useMemo(() => {
    const onItem = new Set(itemActivities.map((a) => String(a.activity_id || '')));
    return catalog.filter((c) => {
      const cid = String(c.id || '');
      return cid && !onItem.has(cid);
    });
  }, [catalog, itemActivities]);

  async function onAddActivity() {
    if (!orderId || !addActivityId) return;
    await addActivity({ orderId, itemId, activityId: addActivityId }).unwrap();
    setAddActivityId('');
    onActivityDone();
  }

  async function onRemoveActivity(orderActivityId: string, activityName: string) {
    if (!orderId) return;
    if (!window.confirm(`Remove activity "${activityName}" from this garment?`)) return;
    await removeActivity({ orderId, activityId: orderActivityId }).unwrap();
    onActivityDone();
  }

  if (isLoading) return <EntityListLoading>Loading garment…</EntityListLoading>;
  if (error || !item) return <ErrorText>Garment not found.</ErrorText>;

  const orderStatus = asCaption(order?.order_status || order?.status || data?.order_status);
  const orderNumber = asCaption(order?.order_number || data?.order_number);
  const customerName = asCaption(order?.customer_name || data?.customer_name);
  const status = asCaption(item.item_status) || 'Pending';
  const billTitle = asCaption(item.bill_number) || id;
  const garmentTitle = asCaption(item.description) || billTitle;
  const estimate = formatMoney(Number(item.sell_amount ?? data?.sell_amount ?? 0));
  const margin = formatMoney(Number(item.margin_amount ?? data?.margin_amount ?? 0));
  const progressPct =
    activityProgress.total > 0
      ? Math.round((activityProgress.done / activityProgress.total) * 100)
      : 0;

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/boutique/items" label="Customization Items" />

      <EntityDetailHero
        kicker={`Boutique · Item${orderNumber ? ` · ${orderNumber}` : ''}${billTitle ? ` · ${billTitle}` : ''}`}
        title={garmentTitle}
        lead={
          <>
            <StatusPill status={status} tone={boutiqueItemStatusTone(status)} />
            {customerName ? <span className="ed-lead-sep"> · {customerName}</span> : null}
          </>
        }
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => void refetch()}>
              Refresh
            </Button>
            <Button
              type="button"
              disabled={readOnly}
              data-kb-action="items.time.add"
              onClick={() => openRecordTask()}
              title={readOnly ? 'Open from an order to log time' : undefined}
            >
              Log time
            </Button>
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
          </>
        }
      />

      <EntityDetailSnapshot
        items={[
          {
            label: 'Order',
            value: orderId ? (
              <button
                type="button"
                className="ed-inline-link"
                onClick={() => navigate(boutiqueOrderPath(orderId, orderStatus))}
              >
                {orderNumber || 'Open'}
              </button>
            ) : (
              '—'
            ),
          },
          {
            label: 'Customer',
            value: <span title={customerName || undefined}>{customerName || '—'}</span>,
          },
          { label: 'Estimate', value: estimate },
          { label: 'Margin', value: margin },
          { label: 'Time taken', value: formatDurationLabel(taskTotals.total) },
        ]}
      />

      <EntityDetailTabs
        value={tab}
        ariaLabel="Garment sections"
        onChange={(id) => setTab(id as ItemTab)}
        options={[
          { id: 'details', label: 'Details' },
          {
            id: 'activities',
            label: `Activities (${activityProgress.done}/${activityProgress.total || 0})`,
          },
          { id: 'tasks', label: `Time log (${itemTasks.length})` },
        ]}
      />

      {readOnly ? (
        <EntityDetailBanner>
          This garment is missing its order link. Open it from a customization order to edit,
          complete activities, or log time.
        </EntityDetailBanner>
      ) : null}

      {tab === 'details' ? (
        <EntityDetailPanel
          title="Garment details"
          note="Update bill number, description, estimate, and delivery date."
        >
          {editError ? <ErrorText>{editError}</ErrorText> : null}
          {saveOk && !editError ? <p className="ed-panel-note is-ok">Saved.</p> : null}
          <div className="ed-grid ed-grid-2">
            <FormRow label="Bill number">
              <TextInput
                value={billNumber}
                disabled={hasMeasurement || readOnly}
                onChange={(e) => setBillNumber(e.target.value)}
              />
            </FormRow>
            <FormRow label="Item ETD">
              <input
                type="date"
                value={itemEtd}
                disabled={readOnly}
                onChange={(e) => setItemEtd(e.target.value)}
              />
            </FormRow>
            <FormRow label="Description *">
              <TextInput
                value={description}
                disabled={readOnly}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormRow>
            <FormRow label="Estimate (₹)">
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={sellAmount}
                disabled={readOnly}
                onChange={(e) => setSellAmount(e.target.value)}
              />
            </FormRow>
          </div>
          <div className="ed-link-row">
            {hasMeasurement ? (
              <Link to={`/boutique/measurements/${String(item.measurement_id)}`}>
                Measurement {asCaption(item.measurement_number) || String(item.measurement_id)}
              </Link>
            ) : (
              <span>No linked measurement</span>
            )}
          </div>
          <div className="ed-actions">
            <Button
              type="button"
              onClick={() => void onSaveItem()}
              disabled={readOnly || updateState.isLoading}
            >
              {updateState.isLoading ? 'Saving…' : 'Save details'}
            </Button>
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'activities' ? (
        <EntityDetailPanel
          title="Activities"
          note={
            activityProgress.total
              ? `${activityProgress.done} of ${activityProgress.total} complete · complete or skip from here`
              : 'No activities on this garment yet.'
          }
          headerEnd={
            activityProgress.total > 0 ? (
              <div className="bdx-progress" aria-label={`${progressPct}% complete`}>
                <div className="bdx-progress-track">
                  <div className="bdx-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span>{progressPct}%</span>
              </div>
            ) : null
          }
        >
          {itemActivities.length === 0 ? (
            <div className="ed-empty">
              Add required activities from the order garments step.
              {orderId ? (
                <EntityDetailEmptyCta>
                  <Button
                    type="button"
                    onClick={() => navigate(boutiqueOrderPath(orderId, orderStatus))}
                  >
                    Open order
                  </Button>
                </EntityDetailEmptyCta>
              ) : null}
            </div>
          ) : (
            <div className="ow-garment-ops-acts">
              {itemActivities.map((act) => {
                const oaId = String(act.order_activity_id || act.id || '');
                const actName = asCaption(act.activity_name) || asCaption(act.name) || 'Activity';
                return (
                  <div key={oaId} className="bdx-activity-row" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ActivityCompleteControls
                        orderId={orderId}
                        activity={act}
                        catalog={catalog}
                        expenses={expenses}
                        timeEntries={timeEntries}
                        readOnly={readOnly}
                        compact
                        onDone={onActivityDone}
                      />
                    </div>
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        data-kb-action="items.activity.remove"
                        onClick={() => void onRemoveActivity(oaId, actName)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {!readOnly ? (
            <div className="ed-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <FormRow label="Add activity">
                <select
                  value={addActivityId}
                  onChange={(e) => setAddActivityId(e.target.value)}
                  disabled={catalogActivitiesToAdd.length === 0}
                >
                  <option value="">— Choose activity —</option>
                  {catalogActivitiesToAdd.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {asCaption(c.name) || asCaption(c.activity_name) || String(c.id)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <Button
                type="button"
                data-kb-action="items.activity.add"
                disabled={!addActivityId || addActivityState.isLoading}
                onClick={() => void onAddActivity()}
              >
                {addActivityState.isLoading ? 'Adding…' : 'Add activity'}
              </Button>
            </div>
          ) : null}

          {!readOnly && activityProgress.pending > 0 ? (
            <div className="ed-actions">
              <Button type="button" data-kb-action="items.time.add" onClick={() => openRecordTask()}>
                Log time for an activity
              </Button>
            </div>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      {tab === 'tasks' ? (
        <EntityDetailPanel
          title="Time log"
          note={
            <>
              Record time against activities. Full history also lives on the{' '}
              <Link to="/boutique/time-log">Time log</Link>.
            </>
          }
          headerEnd={
            <Button
              type="button"
              disabled={readOnly}
              data-kb-action="items.time.add"
              onClick={() => openRecordTask()}
            >
              Record task
            </Button>
          }
        >
          {taskTotals.byActivity.size > 0 ? (
            <div className="bdx-task-totals">
              {[...taskTotals.byActivity.entries()].map(([name, minutes]) => (
                <div key={name} className="bdx-task-total">
                  <span>{name}</span>
                  <strong>{formatDurationLabel(minutes)}</strong>
                </div>
              ))}
              <div className="bdx-task-total is-sum">
                <span>Total</span>
                <strong>{formatDurationLabel(taskTotals.total)}</strong>
              </div>
            </div>
          ) : null}

          {itemTasks.length === 0 ? (
            <div className="ed-empty">
              No time logged yet.
              {!readOnly ? (
                <EntityDetailEmptyCta>
                  <Button type="button" data-kb-action="items.time.add" onClick={() => openRecordTask()}>
                    Record first task
                  </Button>
                </EntityDetailEmptyCta>
              ) : null}
            </div>
          ) : (
            <div className="bdx-task-list">
              {itemTasks.map((row) => (
                <div key={String(row.id)} className="bdx-task-row">
                  <div className="bdx-task-row-top">
                    <strong>{asCaption(row.activity_name) || 'Task'}</strong>
                    <span className="bdx-pill">
                      {formatDurationLabel(Number(row.duration_minutes || 0))}
                    </span>
                  </div>
                  <div className="bdx-task-meta">
                    {asCaption(row.work_date).slice(0, 10)} ·{' '}
                    {asCaption(row.start_time).slice(0, 5) || '—'}–
                    {asCaption(row.end_time).slice(0, 5) || '—'}
                    {asCaption(row.assignee_name) || asCaption(row.worker_name)
                      ? ` · ${asCaption(row.assignee_name) || asCaption(row.worker_name)}`
                      : ''}
                  </div>
                  {asCaption(row.notes) ? (
                    <div className="bdx-task-meta">{asCaption(row.notes)}</div>
                  ) : null}
                  <div className="bdx-task-row-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigate(`/boutique/time/${String(row.id)}`)}
                    >
                      Open
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingEntry(row);
                        setTaskPrefillActivityId(undefined);
                        setTaskModalOpen(true);
                      }}
                    >
                      Quick edit
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
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/boutique/items')}>
            Back to list
          </Button>
        }
        end={
          !readOnly ? (
            <>
              <Button type="button" variant="ghost" data-kb-action="items.time.add" onClick={() => openRecordTask()}>
                Log time
              </Button>
              {tab === 'details' ? (
                <Button
                  type="button"
                  onClick={() => void onSaveItem()}
                  disabled={updateState.isLoading}
                >
                  {updateState.isLoading ? 'Saving…' : 'Save'}
                </Button>
              ) : null}
            </>
          ) : orderId ? (
            <Button
              type="button"
              onClick={() => navigate(boutiqueOrderPath(orderId, orderStatus))}
            >
              Open order
            </Button>
          ) : null
        }
      />

      <TaskEntryModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingEntry(null);
          setTaskPrefillActivityId(undefined);
        }}
        onSaved={() => {
          refetchTasks();
          refetch();
        }}
        entry={editingEntry}
        lockOrderItem
        prefill={{
          orderId,
          billId: itemId,
          activityId: taskPrefillActivityId,
        }}
      />
    </EntityDetailPage>
  );
}
