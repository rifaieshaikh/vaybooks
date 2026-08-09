import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAddBoutiqueOrderItemMutation,
  useCancelBoutiqueOrderMutation,
  useCompleteBoutiqueActivityMutation,
  useCompleteBoutiqueOrderMutation,
  useConfirmBoutiqueOrderMutation,
  useCreateBoutiqueOrderDeliveryMutation,
  useCreateBoutiqueOrderInvoiceMutation,
  useCreateBoutiqueOrderMutation,
  useGetBoutiqueOrderQuery,
  useListBoutiqueActivitiesQuery,
  useListBoutiqueMeasurementsQuery,
  useListBoutiqueOrderDeliveriesQuery,
  useListBoutiqueOrderExpensesQuery,
  useListBoutiqueOrderInvoicesQuery,
  useListBoutiqueOrdersQuery,
  useLazyGetBoutiqueOrderInvoicePdfQuery,
  useListCustomersQuery,
  useListFinanceAccountsQuery,
  useListInventoryLocationsQuery,
  usePatchBoutiqueOrderMutation,
  useRecordBoutiqueAdvanceMutation,
  useRemoveBoutiqueOrderItemMutation,
  useSkipBoutiqueActivityMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityCard,
  EntityCardGrid,
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
import {
  defaultRequiredActivities,
  hasAnyRequired,
  itemIsReadyForInvoice,
} from '../activityDefaults';
import { asCaption, extractError, formatMoney } from '../utils';

const ORDER_STATUSES = [
  'Draft',
  'In Progress',
  'Ready For Delivery',
  'Invoice Generated',
  'Delivered',
  'Completed',
  'Cancelled',
] as const;

const DEFAULT_FILTERS = { order_number: '', customer_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'order_date', desc: true }];

function ActivityChecklist({
  activities,
  value,
  onChange,
}: {
  activities: Record<string, unknown>[];
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  if (activities.length === 0) {
    return (
      <ErrorText>
        No boutique activities configured. Add customization activities in Settings first.
      </ErrorText>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {activities.map((act) => {
        const name = String(act.activity_name || '');
        return (
          <label key={String(act.id || name)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={Boolean(value[name])}
              onChange={(e) => onChange({ ...value, [name]: e.target.checked })}
            />
            <span>{name} (required)</span>
          </label>
        );
      })}
    </div>
  );
}

export function BoutiqueOrdersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListBoutiqueOrdersQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: catalog = [] } = useListBoutiqueActivitiesQuery();
  const [createOrder, createState] = useCreateBoutiqueOrderMutation();
  const [addItem] = useAddBoutiqueOrderItemMutation();
  const [patchOrder] = usePatchBoutiqueOrderMutation();
  const [confirmOrder] = useConfirmBoutiqueOrderMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [etd, setEtd] = useState('');
  const [description, setDescription] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [requiredMap, setRequiredMap] = useState<Record<string, boolean>>({});
  const [confirmOnCreate, setConfirmOnCreate] = useState(false);

  useEffect(() => {
    if (catalog.length) setRequiredMap(defaultRequiredActivities(catalog));
  }, [catalog]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'order_number', label: 'Order #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        allLabel: 'All statuses',
        options: ORDER_STATUSES.map((s) => ({ value: s, label: s })),
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.order_number, filters.order_number)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (filters.status) {
        const status = String(row.order_status || row.status || '');
        if (status !== filters.status) return false;
      }
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function onCreateWorkspace() {
    setFormError('');
    if (!customerId) {
      setFormError('Customer is required');
      return;
    }
    if (!locationId) {
      setFormError('Location is required');
      return;
    }
    if (!description.trim()) {
      setFormError('Add at least one item description before creating');
      return;
    }
    if (!catalog.length) {
      setFormError('No boutique activities configured. Open this page again to seed defaults, or add activities in Settings.');
      return;
    }
    if (!hasAnyRequired(requiredMap)) {
      setFormError('Select at least one required activity');
      return;
    }
    if (confirmOnCreate && !etd) {
      setFormError('ETD is required to confirm on create');
      return;
    }
    let orderId = '';
    try {
      const location = locations.find((l) => String(l.id) === locationId);
      const created = await createOrder({
        customer_id: customerId,
        location_id: locationId,
        location_name: asCaption(location?.name),
        notes,
        expected_delivery_date: etd || undefined,
      }).unwrap();
      orderId = String(created.id);
      await addItem({
        orderId,
        body: {
          description: description.trim(),
          bill_number: billNumber.trim() || undefined,
          required_activities: requiredMap,
          expected_delivery_date: etd || undefined,
        },
      }).unwrap();
      if (etd) {
        await patchOrder({ id: orderId, body: { expected_delivery_date: etd } }).unwrap();
      }
      if (confirmOnCreate) {
        await confirmOrder(orderId).unwrap();
      }
      setOpen(false);
      navigate(`/boutique/orders/${orderId}`);
    } catch (e) {
      const msg = extractError(e);
      setFormError(
        orderId
          ? `${msg} (Draft ${orderId} was created — open it to finish adding the item.)`
          : msg,
      );
      if (orderId) {
        // Still land on the draft so the user can recover instead of losing it.
        setOpen(false);
        navigate(`/boutique/orders/${orderId}`);
      }
    }
  }

  type OrderRow = (typeof data)[number];

  const columns: EntityListColumn<OrderRow>[] = useMemo(
    () => [
      {
        id: 'order',
        header: 'Order',
        render: (row) => {
          const number = displayName(row, ['order_number'], String(row.id));
          const customer = asCaption(row.customer_name) || 'No customer';
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">{customer}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = asCaption(row.order_status || row.status);
          return <span className={status ? undefined : 'el-muted'}>{status || '—'}</span>;
        },
      },
      {
        id: 'etd',
        header: 'ETD',
        render: (row) => {
          const etdLabel = asCaption(row.expected_delivery_date).slice(0, 10);
          return <span className={etdLabel ? undefined : 'el-muted'}>{etdLabel || '—'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Customization Orders"
        count={`${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`}
        actions={
          <Button type="button" onClick={() => navigate('/boutique/orders/workspace')}>
            New order
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
              ...ORDER_STATUSES.map((s) => ({ id: s, label: s })),
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
              { value: 'order_date', label: 'Date' },
              { value: 'order_number', label: 'Order #' },
              { value: 'order_status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading orders…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load boutique orders.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No orders found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/boutique/orders/${row.id}`)} />
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
        title="New boutique order"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreateWorkspace}
              disabled={
                createState.isLoading ||
                !customerId ||
                !locationId ||
                !description.trim() ||
                !catalog.length ||
                !hasAnyRequired(requiredMap)
              }
            >
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Customer *">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select customer</option>
              {customers.map((cust) => (
                <option key={String(cust.id)} value={String(cust.id)}>
                  {asCaption(cust.customer_name || cust.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Location *">
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {asCaption(l.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="ETD">
            <input
              type="date"
              value={etd}
              onChange={(e) => setEtd(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </FormRow>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={confirmOnCreate}
              onChange={(e) => setConfirmOnCreate(e.target.checked)}
            />
            Confirm order after create (requires ETD + item + activities)
          </label>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          <FormRow label="Item description *">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <FormRow label="Bill number">
            <TextInput
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="Auto-generated if blank"
            />
          </FormRow>
          <FormRow label="Required activities *">
            <ActivityChecklist activities={catalog} value={requiredMap} onChange={setRequiredMap} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function BoutiqueOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetBoutiqueOrderQuery(id, { skip: !id });
  const { data: invoices = [], refetch: refetchInvoices } = useListBoutiqueOrderInvoicesQuery(id, {
    skip: !id,
  });
  const { data: deliveries = [], refetch: refetchDeliveries } = useListBoutiqueOrderDeliveriesQuery(
    id,
    { skip: !id },
  );
  const { data: expenses = [], refetch: refetchExpenses } = useListBoutiqueOrderExpensesQuery(id, {
    skip: !id,
  });
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const { data: catalog = [] } = useListBoutiqueActivitiesQuery();
  const customerId = String(data?.customer_id || '');
  const { data: customerMeasurements = [] } = useListBoutiqueMeasurementsQuery(
    customerId ? { customer_id: customerId } : undefined,
    { skip: !customerId },
  );
  const [confirmOrder] = useConfirmBoutiqueOrderMutation();
  const [cancelOrder] = useCancelBoutiqueOrderMutation();
  const [completeOrder] = useCompleteBoutiqueOrderMutation();
  const [addItem] = useAddBoutiqueOrderItemMutation();
  const [removeItem] = useRemoveBoutiqueOrderItemMutation();
  const [completeActivity] = useCompleteBoutiqueActivityMutation();
  const [skipActivity] = useSkipBoutiqueActivityMutation();
  const [recordAdvance] = useRecordBoutiqueAdvanceMutation();
  const [createInvoice] = useCreateBoutiqueOrderInvoiceMutation();
  const [createDelivery] = useCreateBoutiqueOrderDeliveryMutation();
  const [patchOrder] = usePatchBoutiqueOrderMutation();
  const [fetchInvoicePdf] = useLazyGetBoutiqueOrderInvoicePdfQuery();

  const [actionError, setActionError] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemBill, setItemBill] = useState('');
  const [itemSpec, setItemSpec] = useState('');
  const [itemMeasurementId, setItemMeasurementId] = useState('');
  const [requiredMap, setRequiredMap] = useState<Record<string, boolean>>({});
  const [advanceAmt, setAdvanceAmt] = useState('');
  const [advanceAccount, setAdvanceAccount] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [etd, setEtd] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('0');
  const [sellAmount, setSellAmount] = useState('0');

  useEffect(() => {
    if (catalog.length) setRequiredMap(defaultRequiredActivities(catalog));
  }, [catalog]);

  useEffect(() => {
    if (data?.expected_delivery_date) {
      setEtd(asCaption(data.expected_delivery_date).slice(0, 10));
    }
  }, [data?.expected_delivery_date]);

  const items = useMemo(
    () =>
      data && Array.isArray(data.customization_items)
        ? (data.customization_items as Record<string, unknown>[])
        : [],
    [data],
  );
  const activities = useMemo(
    () =>
      data && Array.isArray(data.order_activities)
        ? (data.order_activities as Record<string, unknown>[])
        : [],
    [data],
  );

  const readyBillIds = useMemo(
    () =>
      items
        .filter((item) => itemIsReadyForInvoice(item, activities))
        .map((item) => String(item.item_id || item.id))
        .filter(Boolean),
    [items, activities],
  );

  useEffect(() => {
    setSelectedBillIds((prev) => {
      const keep = prev.filter((id) => readyBillIds.includes(id));
      return keep.length ? keep : readyBillIds.slice(0, 1);
    });
  }, [readyBillIds]);

  const storeAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          Boolean(a.is_store_account) ||
          String(a.account_type || '').toLowerCase() === 'asset' ||
          /cash|bank|store/i.test(String(a.account_name || '')),
      ),
    [accounts],
  );

  const status = asCaption(data?.order_status || data?.status);
  const canConfirm =
    status === 'Draft' &&
    items.length > 0 &&
    activities.some((a) => a.is_required !== false) &&
    Boolean(asCaption(data?.expected_delivery_date));
  const canComplete = status === 'Delivered';

  async function run(fn: () => Promise<unknown>) {
    setActionError('');
    try {
      await fn();
      await Promise.all([refetch(), refetchInvoices(), refetchDeliveries(), refetchExpenses()]);
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Order not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/boutique/orders">← Orders</Link>
      </p>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.order_number) || id}
          </h2>
          <div style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.customer_name)} · {status} · ETD{' '}
            {asCaption(data.expected_delivery_date).slice(0, 10)} · Location{' '}
            {asCaption(data.location_name || data.location_id)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {status === 'Draft' ? (
            <Button type="button" variant="ghost" onClick={() => navigate(`/boutique/orders/workspace?order=${id}`)}>
              Resume workspace
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => run(() => confirmOrder(id).unwrap())}
          >
            Confirm
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!canComplete}
            onClick={() => run(() => completeOrder(id).unwrap())}
          >
            Complete
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={status === 'Cancelled' || status === 'Completed'}
            onClick={() => run(() => cancelOrder(id).unwrap())}
          >
            Cancel
          </Button>
        </div>
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      {!canConfirm && status === 'Draft' ? (
        <p style={{ color: '#887', fontSize: 13 }}>
          Confirm needs ETD, at least one item, and at least one required activity on the order.
        </p>
      ) : null}

      <div style={{ display: 'grid', gap: 10, marginBottom: 20, maxWidth: 520 }}>
        <FormRow label="Update ETD">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={etd}
              onChange={(e) => setEtd(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
            <Button
              type="button"
              variant="ghost"
              disabled={!etd}
              onClick={() =>
                run(() => patchOrder({ id, body: { expected_delivery_date: etd } }).unwrap())
              }
            >
              Save ETD
            </Button>
          </div>
        </FormRow>
      </div>

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Items</h3>
      <div style={{ display: 'grid', gap: 10, marginBottom: 12, maxWidth: 560 }}>
        <FormRow label="Description *">
          <TextInput value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
        </FormRow>
        <FormRow label="Bill number">
          <TextInput
            value={itemBill}
            disabled={Boolean(itemMeasurementId)}
            onChange={(e) => setItemBill(e.target.value)}
            placeholder={itemMeasurementId ? 'Assigned from measurement' : 'Auto-generated if blank'}
          />
        </FormRow>
        <FormRow label="Link measurement">
          <select
            value={itemMeasurementId}
            onChange={(e) => {
              setItemMeasurementId(e.target.value);
              if (e.target.value) setItemBill('');
            }}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="">None</option>
            {customerMeasurements.map((m) => (
              <option key={String(m.id)} value={String(m.id)}>
                {asCaption(m.measurement_number)} · {asCaption(m.person_type)} · {asCaption(m.wearer_name)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Customer specification">
          <TextInput value={itemSpec} onChange={(e) => setItemSpec(e.target.value)} />
        </FormRow>
        <FormRow label="Required activities *">
          <ActivityChecklist activities={catalog} value={requiredMap} onChange={setRequiredMap} />
        </FormRow>
        <Button
          type="button"
          disabled={!itemDesc.trim() || !hasAnyRequired(requiredMap)}
          onClick={() =>
            run(async () => {
              await addItem({
                orderId: id,
                body: {
                  description: itemDesc.trim(),
                  bill_number: itemBill.trim() || undefined,
                  measurement_id: itemMeasurementId || undefined,
                  customer_specification: itemSpec,
                  required_activities: requiredMap,
                },
              }).unwrap();
              setItemDesc('');
              setItemBill('');
              setItemSpec('');
              setItemMeasurementId('');
            })
          }
        >
          Add item
        </Button>
      </div>
      <EntityCardGrid>
        {items.map((item) => {
          const itemId = String(item.item_id || item.id);
          const ready = itemIsReadyForInvoice(item, activities);
          return (
            <EntityCard
              key={itemId}
              title={asCaption(item.bill_number) || asCaption(item.description)}
              captions={[
                asCaption(item.description),
                asCaption(item.item_status),
                item.measurement_id
                  ? `Meas ${asCaption(item.measurement_number || item.measurement_id)}`
                  : 'No measurement',
                ready ? 'Ready to invoice/deliver' : 'Activities pending',
              ]}
              badges={[{ label: ready ? 'Ready' : 'In progress', tone: ready ? 'green' : 'blue' }]}
              onView={() => navigate(`/boutique/items/${itemId}?orderId=${encodeURIComponent(id)}`)}
              onEdit={() => {
                if (window.confirm(`Remove item ${asCaption(item.bill_number)}?`)) {
                  run(() => removeItem({ orderId: id, itemId }).unwrap());
                }
              }}
            />
          );
        })}
      </EntityCardGrid>
      <p style={{ color: '#889', fontSize: 13 }}>View opens item detail · Edit removes the item</p>

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginTop: 24 }}>Customer measurements</h3>
      {!customerMeasurements.length ? (
        <p style={{ color: '#667' }}>No measurements for this customer.</p>
      ) : (
        <ul>
          {customerMeasurements.map((m) => (
            <li key={String(m.id)}>
              <Link to={`/boutique/measurements/${m.id}`}>
                {asCaption(m.measurement_number)} · {asCaption(m.person_type)} · {asCaption(m.wearer_name)}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginTop: 24 }}>Activities</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 420, marginBottom: 12 }}>
        <FormRow label="Purchase / expense">
          <TextInput value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
        </FormRow>
        <FormRow label="Selling price">
          <TextInput value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} />
        </FormRow>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {activities.length === 0 ? (
          <p style={{ color: '#667' }}>No activities yet — add an item with required activities.</p>
        ) : null}
        {activities.map((act) => {
          const oaId = String(act.order_activity_id || act.id);
          const actStatus = asCaption(act.activity_status || act.status);
          const done = actStatus === 'Completed' || actStatus === 'Skipped';
          const item = items.find((i) => String(i.item_id || i.id) === String(act.bill_id));
          const cfg = catalog.find((c) => String(c.id) === String(act.activity_id));
          const needsTime = Boolean(cfg?.requires_time_tracking);
          return (
            <div
              key={oaId}
              style={{
                border: '1px solid #d9e3de',
                borderRadius: 10,
                padding: '0.85rem 1rem',
                background: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 650 }}>{asCaption(act.activity_name)}</div>
                <div style={{ color: '#667', fontSize: 13 }}>
                  {actStatus} · Bill {asCaption(item?.bill_number || act.bill_id)}
                  {needsTime ? ' · Log time before Complete' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {needsTime && !done ? (
                  <Button type="button" variant="ghost" onClick={() => navigate('/boutique/time')}>
                    Log time
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={done}
                  onClick={() =>
                    run(() =>
                      completeActivity({
                        orderId: id,
                        activityId: oaId,
                        body: {
                          completed_by: 'web',
                          purchase_price: Number(expenseAmount) || 0,
                          selling_price: Number(sellAmount) || 0,
                          add_expense: Number(expenseAmount) > 0 || needsTime,
                        },
                      }).unwrap(),
                    )
                  }
                >
                  Complete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={done}
                  onClick={() =>
                    run(() =>
                      skipActivity({
                        orderId: id,
                        activityId: oaId,
                        body: { completed_by: 'web' },
                      }).unwrap(),
                    )
                  }
                >
                  Skip
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginTop: 24 }}>Advance</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <TextInput placeholder="Amount" value={advanceAmt} onChange={(e) => setAdvanceAmt(e.target.value)} />
        <select
          value={advanceAccount}
          onChange={(e) => setAdvanceAccount(e.target.value)}
          style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', minWidth: 200 }}
        >
          <option value="">Receiving account (cash/bank)</option>
          {(storeAccounts.length ? storeAccounts : accounts).map((a) => (
            <option key={String(a.id)} value={String(a.id)}>
              {asCaption(a.account_name)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={!advanceAmt || !advanceAccount || Number(advanceAmt) <= 0}
          onClick={() =>
            run(() =>
              recordAdvance({
                orderId: id,
                body: { amount: Number(advanceAmt), receiving_account_id: advanceAccount },
              }).unwrap(),
            )
          }
        >
          Record cash advance
        </Button>
      </div>
      <p style={{ color: '#667' }}>Current advance: {formatMoney(Number(data.advance_amount ?? 0))}</p>

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginTop: 24 }}>Invoices</h3>
      <p style={{ color: '#667', fontSize: 13 }}>
        Only items with all required activities completed/skipped can be invoiced.
      </p>
      <div style={{ display: 'grid', gap: 8, marginBottom: 12, maxWidth: 520 }}>
        {readyBillIds.length === 0 ? (
          <p style={{ color: '#887' }}>No bills ready yet.</p>
        ) : (
          readyBillIds.map((billId) => {
            const item = items.find((i) => String(i.item_id || i.id) === billId);
            return (
              <label key={billId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedBillIds.includes(billId)}
                  onChange={(e) =>
                    setSelectedBillIds((prev) =>
                      e.target.checked ? [...prev, billId] : prev.filter((x) => x !== billId),
                    )
                  }
                />
                <span>
                  {asCaption(item?.bill_number)} · {asCaption(item?.description)}
                </span>
              </label>
            );
          })
        )}
        <TextInput
          placeholder="Invoice amount"
          value={invoiceAmount}
          onChange={(e) => setInvoiceAmount(e.target.value)}
        />
        <Button
          type="button"
          disabled={!invoiceAmount || selectedBillIds.length === 0 || Number(invoiceAmount) <= 0}
          onClick={() =>
            run(() =>
              createInvoice({
                orderId: id,
                body: { bill_ids: selectedBillIds, invoice_amount: Number(invoiceAmount) },
              }).unwrap(),
            )
          }
        >
          Generate invoice
        </Button>
      </div>
      <EntityCardGrid>
        {invoices.map((inv) => (
          <EntityCard
            key={String(inv.id)}
            title={asCaption(inv.invoice_number) || String(inv.id)}
            captions={[formatMoney(Number(inv.invoice_amount ?? inv.grand_total ?? 0))]}
            onView={async () => {
              setActionError('');
              try {
                const blob = await fetchInvoicePdf({
                  orderId: id,
                  invoiceId: String(inv.id),
                }).unwrap();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${asCaption(inv.invoice_number) || inv.id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setActionError(extractError(e));
              }
            }}
          />
        ))}
      </EntityCardGrid>
      <p style={{ color: '#889', fontSize: 13 }}>View downloads invoice PDF</p>

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginTop: 24 }}>Deliveries</h3>
      <Button
        type="button"
        disabled={selectedBillIds.length === 0}
        onClick={() =>
          run(() =>
            createDelivery({
              orderId: id,
              body: { bill_ids: selectedBillIds },
            }).unwrap(),
          )
        }
      >
        Record delivery (selected bills)
      </Button>
      <EntityCardGrid>
        {deliveries.map((d) => (
          <EntityCard
            key={String(d.id)}
            title={asCaption(d.delivery_date).slice(0, 10) || String(d.id)}
            captions={[asCaption((d.bill_ids as string[] | undefined)?.join(', '))]}
          />
        ))}
      </EntityCardGrid>

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginTop: 24 }}>Expenses</h3>
      <EntityCardGrid>
        {expenses.map((e) => (
          <EntityCard
            key={String(e.id)}
            title={asCaption(e.activity_name || e.description) || String(e.id)}
            captions={[formatMoney(Number(e.amount ?? 0))]}
          />
        ))}
      </EntityCardGrid>
    </div>
  );
}
