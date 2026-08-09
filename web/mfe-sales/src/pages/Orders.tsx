import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCancelSalesOrderMutation,
  useCloseSalesOrderMutation,
  useCreateSalesOrderMutation,
  useGetSalesOrderQuery,
  useListCustomersQuery,
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

const DEFAULT_FILTERS = { so_number: '', customer_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'order_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'Partially Delivered', label: 'Partially Delivered' },
  { id: 'Delivered', label: 'Delivered' },
  { id: 'Closed', label: 'Closed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function SalesOrdersListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data = [], isLoading, error } = useListSalesOrdersQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [createOrder, createState] = useCreateSalesOrderMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');

  useEffect(() => {
    const cid = params.get('customer_id') || '';
    if (cid) setCustomerId(cid);
    if (params.get('new') === '1') {
      setFormError('');
      setOpen(true);
    }
  }, [params]);

  useEffect(() => {
    if (open && !locationId && locations[0]) setLocationId(String(locations[0].id));
  }, [open, locations, locationId]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'so_number', label: 'SO #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.so_number, filters.so_number)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (filters.status && String(row.status) !== filters.status) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type OrderRow = (typeof data)[number];

  const columns: EntityListColumn<OrderRow>[] = useMemo(
    () => [
      {
        id: 'so_number',
        header: 'SO #',
        render: (row) => (
          <span className="el-customer-name">{asCaption(row.so_number) || String(row.id)}</span>
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
        render: (row) => asCaption(row.order_date).slice(0, 10) || <span className="el-muted">—</span>,
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
      const created = await createOrder({
        customer_id: customerId,
        location_id: locationId,
        lines: [{ product_id: productId, qty: Number(qty) || 0, rate: Number(rate) || 0 }],
      }).unwrap();
      setOpen(false);
      navigate(`/sales/orders/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Sales"
        title="Sales Orders"
        count={`${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setOpen(true);
              if (!locationId && locations[0]) setLocationId(String(locations[0].id));
            }}
          >
            New SO
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
              { value: 'order_date', label: 'Date' },
              { value: 'so_number', label: 'SO #' },
              { value: 'total_amount', label: 'Amount' },
              { value: 'status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading sales orders…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load sales orders.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No sales orders found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/sales/orders/${row.id}`)} />
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
        title="New sales order"
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

export function SalesOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetSalesOrderQuery(id, { skip: !id });
  const [cancelOrder] = useCancelSalesOrderMutation();
  const [closeOrder] = useCloseSalesOrderMutation();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(
    () => (data && Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : []),
    [data],
  );

  async function run(action: 'cancel' | 'close') {
    setActionError('');
    try {
      if (action === 'cancel') await cancelOrder(id).unwrap();
      if (action === 'close') await closeOrder(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Sales order not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/sales/orders">← Sales orders</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.so_number) || id}
          </h2>
          <div style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.customer_name)} · {asCaption(data.status)} ·{' '}
            {formatMoney(Number(data.total_amount ?? 0))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="ghost" onClick={() => run('close')}>
            Close
          </Button>
          <Button type="button" variant="ghost" onClick={() => run('cancel')}>
            Cancel
          </Button>
          <Button type="button" onClick={() => navigate('/sales/delivery-notes')}>
            Delivery note
          </Button>
          <Button type="button" onClick={() => navigate('/sales/invoices')}>
            Invoice
          </Button>
        </div>
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <EntityCardGrid>
        {lines.map((line) => (
          <EntityCard
            key={String(line.id || line.product_id)}
            title={asCaption(line.product_name) || asCaption(line.product_id)}
            captions={[
              `Ordered ${Number(line.qty_ordered ?? line.qty ?? 0)}`,
              formatMoney(Number(line.rate ?? 0)),
            ]}
          />
        ))}
      </EntityCardGrid>
    </div>
  );
}
