import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useConfirmDeliveryNoteMutation,
  useCreateDeliveryNoteMutation,
  useDeliverDeliveryNoteMutation,
  useDispatchDeliveryNoteMutation,
  useGetDeliveryNoteQuery,
  useListCustomersQuery,
  useListDeliveryNotesQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListSalesOrdersQuery,
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
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../utils';

const DEFAULT_FILTERS = { dn_number: '', customer_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'delivery_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'Dispatched', label: 'Dispatched' },
  { id: 'Delivered', label: 'Delivered' },
  { id: 'Partially Delivered', label: 'Partially Delivered' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function DeliveryNotesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListDeliveryNotesQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: orders = [] } = useListSalesOrdersQuery();
  const [createDn, createState] = useCreateDeliveryNoteMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [soId, setSoId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'dn_number', label: 'DN #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.dn_number, filters.dn_number)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (filters.status && String(row.status) !== filters.status) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type DnRow = (typeof data)[number];

  const columns: EntityListColumn<DnRow>[] = useMemo(
    () => [
      {
        id: 'dn_number',
        header: 'DN #',
        render: (row) => (
          <span className="el-customer-name">{asCaption(row.dn_number) || String(row.id)}</span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => asCaption(row.customer_name) || <span className="el-muted">—</span>,
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status) || <span className="el-muted">—</span>,
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) =>
          asCaption(row.delivery_date).slice(0, 10) || <span className="el-muted">—</span>,
      },
      {
        id: 'amount',
        header: 'Amount',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.total_amount ?? 0)),
      },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const created = await createDn({
        customer_id: customerId,
        location_id: locationId,
        sales_order_id: soId || null,
        confirm: true,
        lines: [{ product_id: productId, qty: Number(qty) || 0, rate: Number(rate) || 0 }],
      }).unwrap();
      setOpen(false);
      navigate(`/sales/delivery-notes/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Sales"
        title="Delivery Notes"
        count={`${filtered.length} ${filtered.length === 1 ? 'note' : 'notes'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setOpen(true);
              if (!locationId && locations[0]) setLocationId(String(locations[0].id));
            }}
          >
            New DN
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
            options={STATUS_CHIPS}
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
              { value: 'delivery_date', label: 'Date' },
              { value: 'dn_number', label: 'DN #' },
              { value: 'status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading delivery notes…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load delivery notes.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No delivery notes found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/sales/delivery-notes/${row.id}`)} />
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
        title="New delivery note"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              disabled={createState.isLoading || !customerId || !productId}
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
          <FormRow label="Sales order">
            <select
              value={soId}
              onChange={(e) => setSoId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {asCaption(o.so_number)} — {asCaption(o.customer_name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Location">
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Default</option>
              {locations.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {asCaption(l.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Product *">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {asCaption(p.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormRow label="Qty">
              <TextInput value={qty} onChange={(e) => setQty(e.target.value)} />
            </FormRow>
            <FormRow label="Rate">
              <TextInput value={rate} onChange={(e) => setRate(e.target.value)} />
            </FormRow>
          </div>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function DeliveryNoteDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetDeliveryNoteQuery(id, { skip: !id });
  const [confirmDn] = useConfirmDeliveryNoteMutation();
  const [dispatchDn] = useDispatchDeliveryNoteMutation();
  const [deliverDn] = useDeliverDeliveryNoteMutation();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(
    () => (data && Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : []),
    [data],
  );

  async function run(action: 'confirm' | 'dispatch' | 'deliver') {
    setActionError('');
    try {
      if (action === 'confirm') await confirmDn(id).unwrap();
      if (action === 'dispatch') await dispatchDn(id).unwrap();
      if (action === 'deliver') await deliverDn(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Delivery note not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/sales/delivery-notes">← Delivery notes</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.dn_number) || id}
          </h2>
          <div style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.customer_name)} · {asCaption(data.status)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="ghost" onClick={() => run('confirm')}>
            Confirm
          </Button>
          <Button type="button" variant="ghost" onClick={() => run('dispatch')}>
            Dispatch
          </Button>
          <Button type="button" onClick={() => run('deliver')}>
            Deliver
          </Button>
        </div>
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <EntityCardGrid>
        {lines.map((line) => (
          <EntityCard
            key={String(line.id || line.product_id)}
            title={asCaption(line.product_name) || asCaption(line.product_id)}
            captions={[`Qty ${Number(line.qty ?? 0)}`, formatMoney(Number(line.rate ?? 0))]}
          />
        ))}
      </EntityCardGrid>
    </div>
  );
}
