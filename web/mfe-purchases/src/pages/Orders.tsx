import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCancelPurchaseOrderMutation,
  useClosePurchaseOrderMutation,
  useCreatePurchaseOrderMutation,
  useGetPurchaseOrderQuery,
  useLazyGetPurchaseOrderPdfQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListPurchaseOrdersQuery,
  useListVendorsQuery,
  useSendPurchaseOrderMutation,
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

const DEFAULT_FILTERS = { po_number: '', vendor_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'order_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Partially Received', label: 'Partially Received' },
  { id: 'Received', label: 'Received' },
  { id: 'Closed', label: 'Closed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

type LineForm = { product_id: string; qty_ordered: string; rate: string };

export function PurchaseOrdersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListPurchaseOrdersQuery();
  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [createPo, createState] = useCreatePurchaseOrderMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineForm[]>([{ product_id: '', qty_ordered: '1', rate: '0' }]);
  const [formError, setFormError] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'po_number', label: 'PO #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.po_number, filters.po_number)) return false;
      if (!matchesRegex(row.vendor_name, filters.vendor_name)) return false;
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
        id: 'po',
        header: 'PO #',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{asCaption(row.po_number) || String(row.id)}</span>
              <span className="el-customer-sub">{asCaption(row.order_date).slice(0, 10) || '—'}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) => asCaption(row.vendor_name) || '—',
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status) || '—',
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
      const created = await createPo({
        vendor_id: vendorId,
        location_id: locationId,
        notes,
        lines: lines
          .filter((l) => l.product_id)
          .map((l) => ({
            product_id: l.product_id,
            qty_ordered: Number(l.qty_ordered) || 0,
            rate: Number(l.rate) || 0,
          })),
      }).unwrap();
      setOpen(false);
      setVendorId('');
      setNotes('');
      setLines([{ product_id: '', qty_ordered: '1', rate: '0' }]);
      navigate(`/purchases/orders/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Purchases"
        title="Purchase Orders"
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
            New PO
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
              { value: 'po_number', label: 'PO #' },
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

      {isLoading ? <EntityListLoading>Loading purchase orders…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load purchase orders.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No purchase orders found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/orders/${row.id}`)} />
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
        title="New purchase order"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onCreate} disabled={createState.isLoading || !vendorId}>
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Vendor *">
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={String(v.id)} value={String(v.id)}>
                  {asCaption(v.vendor_name || v.name)}
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
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          {lines.map((line, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <FormRow label={idx === 0 ? 'Product *' : 'Product'}>
                <select
                  value={line.product_id}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, product_id: e.target.value };
                    setLines(next);
                  }}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                >
                  <option value="">Select</option>
                  {products.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {asCaption(p.name)} ({asCaption(p.sku)})
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Qty">
                <TextInput
                  value={line.qty_ordered}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, qty_ordered: e.target.value };
                    setLines(next);
                  }}
                />
              </FormRow>
              <FormRow label="Rate">
                <TextInput
                  value={line.rate}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, rate: e.target.value };
                    setLines(next);
                  }}
                />
              </FormRow>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLines([...lines, { product_id: '', qty_ordered: '1', rate: '0' }])}
          >
            Add line
          </Button>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh list
          </Button>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetPurchaseOrderQuery(id, { skip: !id });
  const [sendPo] = useSendPurchaseOrderMutation();
  const [cancelPo] = useCancelPurchaseOrderMutation();
  const [closePo] = useClosePurchaseOrderMutation();
  const [fetchPdf] = useLazyGetPurchaseOrderPdfQuery();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(
    () => (data && Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : []),
    [data],
  );

  async function run(action: 'send' | 'cancel' | 'close') {
    setActionError('');
    try {
      if (action === 'send') await sendPo(id).unwrap();
      if (action === 'cancel') await cancelPo(id).unwrap();
      if (action === 'close') await closePo(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Purchase order not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/purchases/orders">← Purchase orders</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.po_number) || id}
          </h2>
          <div style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.vendor_name)} · {asCaption(data.status)} ·{' '}
            {formatMoney(Number(data.total_amount ?? 0))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              setActionError('');
              try {
                const blob = await fetchPdf(id).unwrap();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${asCaption(data.po_number) || id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setActionError(extractError(e));
              }
            }}
          >
            Download PDF
          </Button>
          <Button type="button" variant="ghost" onClick={() => run('send')}>
            Send
          </Button>
          <Button type="button" variant="ghost" onClick={() => run('close')}>
            Close
          </Button>
          <Button type="button" variant="ghost" onClick={() => run('cancel')}>
            Cancel
          </Button>
          <Button type="button" onClick={() => navigate('/purchases/goods-receipt')}>
            Receive goods
          </Button>
        </div>
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Lines</h3>
      <EntityCardGrid>
        {lines.map((line) => (
          <EntityCard
            key={String(line.id || line.product_id)}
            title={asCaption(line.product_name) || asCaption(line.product_id)}
            captions={[
              `Ordered ${Number(line.qty_ordered ?? 0)}`,
              `Received ${Number(line.qty_received ?? 0)}`,
              formatMoney(Number(line.rate ?? 0)),
            ]}
          />
        ))}
      </EntityCardGrid>
    </div>
  );
}
