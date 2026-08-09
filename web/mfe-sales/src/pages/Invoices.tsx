import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCreateSalesInvoiceMutation,
  useGetSalesInvoiceQuery,
  useLazyGetSalesInvoicePdfQuery,
  useListCustomersQuery,
  useListFinanceAccountsQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListSalesInvoicesQuery,
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
  store_invoice_number: '',
  customer_name: '',
  voucher_number: '',
  has_voucher: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'sale_date', desc: true }];
const VOUCHER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'yes', label: 'Has voucher' },
  { id: 'no', label: 'No voucher' },
];

export function SalesInvoicesListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data = [], isLoading, error } = useListSalesInvoicesQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const [createInv, createState] = useCreateSalesInvoiceMutation();

  const storeAccounts = useMemo(
    () => accounts.filter((a) => a.is_store_account === true),
    [accounts],
  );

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [storeAccountId, setStoreAccountId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [amountReceived, setAmountReceived] = useState('0');

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
    if (open && !storeAccountId && storeAccounts[0]) setStoreAccountId(String(storeAccounts[0].id));
  }, [open, locations, locationId, storeAccounts, storeAccountId]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'store_invoice_number', label: 'Invoice #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      { key: 'voucher_number', label: 'Voucher #', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.store_invoice_number, filters.store_invoice_number)) return false;
      if (!matchesRegex(row.customer_name || row.party_name, filters.customer_name)) return false;
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

  type InvoiceRow = (typeof data)[number];

  const columns: EntityListColumn<InvoiceRow>[] = useMemo(
    () => [
      {
        id: 'invoice',
        header: 'Invoice #',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">
                {asCaption(row.store_invoice_number) || asCaption(row.voucher_number) || String(row.id)}
              </span>
              {asCaption(row.voucher_number) && asCaption(row.store_invoice_number) ? (
                <span className="el-customer-sub">{asCaption(row.voucher_number)}</span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) =>
          asCaption(row.customer_name || row.party_name) || <span className="el-muted">—</span>,
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) =>
          asCaption(row.sale_date || row.voucher_date).slice(0, 10) || (
            <span className="el-muted">—</span>
          ),
      },
      {
        id: 'amount',
        header: 'Amount',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.net ?? row.gross ?? row.total ?? 0)),
      },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const created = await createInv({
        customer_id: customerId,
        store_account_id: storeAccountId,
        store_invoice_number: invoiceNumber,
        location_id: locationId,
        amount_received: Number(amountReceived) || 0,
        lines: [
          {
            product_id: productId,
            qty: Number(qty) || 0,
            rate: Number(rate) || 0,
            location_id: locationId,
          },
        ],
      }).unwrap();
      setOpen(false);
      navigate(`/sales/invoices/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Sales"
        title="Sales Invoices"
        count={`${filtered.length} ${filtered.length === 1 ? 'invoice' : 'invoices'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setOpen(true);
              if (!locationId && locations[0]) setLocationId(String(locations[0].id));
              if (!storeAccountId && storeAccounts[0]) setStoreAccountId(String(storeAccounts[0].id));
            }}
          >
            New invoice
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
              { value: 'sale_date', label: 'Date' },
              { value: 'net', label: 'Amount' },
              { value: 'store_invoice_number', label: 'Invoice #' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading invoices…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load invoices.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No invoices found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/sales/invoices/${row.id}`)} />
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
        title="New sales invoice"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              disabled={
                createState.isLoading || !customerId || !storeAccountId || !productId || !invoiceNumber
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
          <FormRow label="Store account *">
            <select
              value={storeAccountId}
              onChange={(e) => setStoreAccountId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select store account</option>
              {storeAccounts.map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {asCaption(a.account_name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Invoice # *">
            <TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <FormRow label="Qty">
              <TextInput value={qty} onChange={(e) => setQty(e.target.value)} />
            </FormRow>
            <FormRow label="Rate">
              <TextInput value={rate} onChange={(e) => setRate(e.target.value)} />
            </FormRow>
            <FormRow label="Received">
              <TextInput value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
            </FormRow>
          </div>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function SalesInvoiceDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useGetSalesInvoiceQuery(id, { skip: !id });
  const [fetchPdf] = useLazyGetSalesInvoicePdfQuery();
  const [pdfError, setPdfError] = useState('');

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Sales invoice not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/sales/invoices">← Invoices</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.store_invoice_number) || asCaption(data.voucher_number) || id}
          </h2>
          <div style={{ color: '#667', marginBottom: 16 }}>
            {asCaption(data.customer_name || data.party_name)} ·{' '}
            {asCaption(data.sale_date || data.voucher_date).slice(0, 10)} ·{' '}
            {formatMoney(Number(data.net ?? data.gross ?? data.total ?? 0))}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            setPdfError('');
            try {
              const blob = await fetchPdf(id).unwrap();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${asCaption(data.store_invoice_number) || id}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              setPdfError(extractError(e));
            }
          }}
        >
          Download PDF
        </Button>
      </div>
      {pdfError ? <ErrorText>{pdfError}</ErrorText> : null}
      <p>{asCaption(data.description)}</p>
    </div>
  );
}
