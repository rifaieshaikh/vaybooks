import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useConfirmGoodsReceiptMutation,
  useCreateGoodsReceiptMutation,
  useGetGoodsReceiptQuery,
  useListGoodsReceiptsQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListPurchaseOrdersQuery,
  useListVendorsQuery,
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
import { asCaption, extractError, formatMoney } from '../utils';

const DEFAULT_FILTERS = { grn_number: '', vendor_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'receipt_date', desc: true }];

export function GoodsReceiptListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListGoodsReceiptsQuery();
  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: orders = [] } = useListPurchaseOrdersQuery();
  const [createGrn, createState] = useCreateGoodsReceiptMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [poId, setPoId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [confirmOnCreate, setConfirmOnCreate] = useState(true);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'grn_number', label: 'GRN #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.grn_number, filters.grn_number)) return false;
      if (!matchesRegex(row.vendor_name, filters.vendor_name)) return false;
      if (!matchesRegex(row.status, filters.status)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function onCreate() {
    setFormError('');
    try {
      const created = await createGrn({
        vendor_id: vendorId,
        location_id: locationId,
        purchase_order_id: poId || null,
        confirm: confirmOnCreate,
        lines: [{ product_id: productId, qty_received: Number(qty) || 0, rate: Number(rate) || 0 }],
      }).unwrap();
      setOpen(false);
      navigate(`/purchases/goods-receipt/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <ListToolbar
        title="Goods Receipt"
        countLabel="receipts"
        count={filtered.length}
        primaryLabel="New GRN"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
          if (!locationId && locations[0]) setLocationId(String(locations[0].id));
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
          { value: 'receipt_date', label: 'Date' },
          { value: 'grn_number', label: 'GRN #' },
          { value: 'total_amount', label: 'Amount' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load goods receipts.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 && <p>No goods receipts found.</p>}

      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={asCaption(row.grn_number) || String(row.id)}
            captions={[
              asCaption(row.vendor_name),
              asCaption(row.status),
              asCaption(row.receipt_date).slice(0, 10),
              formatMoney(Number(row.total_amount ?? 0)),
            ]}
            onView={() => navigate(`/purchases/goods-receipt/${row.id}`)}
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

      <Modal
        open={open}
        title="New goods receipt"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              disabled={createState.isLoading || !vendorId || !locationId || !productId}
            >
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
          <FormRow label="Purchase order">
            <select
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {asCaption(o.po_number)} — {asCaption(o.vendor_name)}
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
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={confirmOnCreate}
              onChange={(e) => setConfirmOnCreate(e.target.checked)}
            />
            Confirm and post stock on create
          </label>
        </div>
      </Modal>
    </div>
  );
}

export function GoodsReceiptDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetGoodsReceiptQuery(id, { skip: !id });
  const [confirmGrn, confirmState] = useConfirmGoodsReceiptMutation();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(
    () => (data && Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : []),
    [data],
  );

  async function onConfirm() {
    setActionError('');
    try {
      await confirmGrn(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Goods receipt not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/purchases/goods-receipt">← Goods receipt</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.grn_number) || id}
          </h2>
          <div style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.vendor_name)} · {asCaption(data.status)} · {asCaption(data.location_name)}
          </div>
        </div>
        {String(data.status) !== 'Received' ? (
          <Button type="button" onClick={onConfirm} disabled={confirmState.isLoading}>
            {confirmState.isLoading ? 'Confirming…' : 'Confirm receipt'}
          </Button>
        ) : null}
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <EntityCardGrid>
        {lines.map((line) => (
          <EntityCard
            key={String(line.id || line.product_id)}
            title={asCaption(line.product_name) || asCaption(line.product_id)}
            captions={[`Qty ${Number(line.qty_received ?? 0)}`, formatMoney(Number(line.rate ?? 0))]}
          />
        ))}
      </EntityCardGrid>
    </div>
  );
}
