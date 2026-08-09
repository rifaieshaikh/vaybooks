import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreatePurchaseBillMutation,
  useGetPurchaseBillQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListPurchaseBillsQuery,
  useListVendorsQuery,
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

const DEFAULT_FILTERS = {
  vendor_bill_number: '',
  vendor_name: '',
  voucher_number: '',
  has_voucher: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'bill_date', desc: true }];
const VOUCHER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'yes', label: 'Has voucher' },
  { id: 'no', label: 'No voucher' },
];

export function PurchaseBillsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListPurchaseBillsQuery();
  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [createBill, createState] = useCreatePurchaseBillMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'vendor_bill_number', label: 'Vendor bill #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'voucher_number', label: 'Voucher #', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.vendor_bill_number, filters.vendor_bill_number)) return false;
      if (!matchesRegex(row.vendor_name || row.party_name, filters.vendor_name)) return false;
      if (!matchesRegex(row.voucher_number, filters.voucher_number)) return false;
      const hasVoucher = Boolean(String(row.voucher_number || '').trim());
      if (filters.has_voucher === 'yes' && !hasVoucher) return false;
      if (filters.has_voucher === 'no' && hasVoucher) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type BillRow = (typeof data)[number];

  const columns: EntityListColumn<BillRow>[] = useMemo(
    () => [
      {
        id: 'bill',
        header: 'Bill #',
        render: (row) => {
          const title =
            asCaption(row.vendor_bill_number) || asCaption(row.voucher_number) || String(row.id);
          const desc = asCaption(row.description || row.caption);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{title}</span>
                <span className="el-customer-sub">
                  {asCaption(row.bill_date).slice(0, 10) || '—'}
                  {desc && desc.length <= 80 ? ` · ${desc}` : ''}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) => asCaption(row.vendor_name || row.party_name) || '—',
      },
      {
        id: 'voucher',
        header: 'Voucher #',
        render: (row) => asCaption(row.voucher_number) || '—',
      },
      {
        id: 'amount',
        header: 'Amount',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.total ?? row.amount ?? 0)),
      },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const created = await createBill({
        vendor_id: vendorId,
        vendor_bill_number: billNumber,
        location_id: locationId,
        lines: [{ product_id: productId, qty: Number(qty) || 0, rate: Number(rate) || 0 }],
      }).unwrap();
      setOpen(false);
      navigate(`/purchases/bills/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Purchases"
        title="Purchase Bills"
        count={`${filtered.length} ${filtered.length === 1 ? 'bill' : 'bills'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setOpen(true);
              if (!locationId && locations[0]) setLocationId(String(locations[0].id));
            }}
          >
            New bill
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Voucher"
            value={filters.has_voucher || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, has_voucher: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={VOUCHER_CHIPS}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['has_voucher']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'bill_date', label: 'Date' },
              { value: 'total', label: 'Amount' },
              { value: 'voucher_number', label: 'Voucher #' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading bills…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load bills.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No bills found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/bills/${row.id}`)} />
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
        title="New purchase bill"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              disabled={createState.isLoading || !vendorId || !billNumber || !productId}
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
          <FormRow label="Vendor bill # *">
            <TextInput value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
          </FormRow>
          <FormRow label="Location">
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">None</option>
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

export function PurchaseBillDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useGetPurchaseBillQuery(id, { skip: !id });

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Purchase bill not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/purchases/bills">← Bills</Link>
      </p>
      <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>
        {asCaption(data.vendor_bill_number) || asCaption(data.voucher_number) || id}
      </h2>
      <div style={{ color: '#667', marginBottom: 16 }}>
        {asCaption(data.vendor_name || data.party_name)} · {asCaption(data.bill_date).slice(0, 10)} ·{' '}
        {formatMoney(Number(data.total ?? data.amount ?? 0))}
      </div>
      <p>{asCaption(data.description)}</p>
    </div>
  );
}
