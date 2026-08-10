import { useMemo, useState } from 'react';
import {
  useCreateCustomerPriceMutation,
  useListCustomerPriceHistoryQuery,
  useListCustomerPricesQuery,
  useListInventoryProductsQuery,
} from '@vaybooks/store';
import {
  Button,
  DataTable,
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

const DEFAULT_PRICE_FILTERS = { customer_name: '', product_name: '', sku: '', rate_diff: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Save failed');
  }
  return 'Save failed';
}

/** Streamlit parity: customer-specific price list, add-price modal, per-row history modal. */
export function CustomerPricesPage() {
  const { data = [], isLoading, error, refetch } = useListCustomerPricesQuery();
  const { data: products = [] } = useListInventoryProductsQuery({ active_only: true });
  const [createPrice, createState] = useCreateCustomerPriceMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_PRICE_FILTERS });
  const [addOpen, setAddOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [productId, setProductId] = useState('');
  const [rate, setRate] = useState('0');
  const [formError, setFormError] = useState('');

  const [historyRow, setHistoryRow] = useState<Record<string, unknown> | null>(null);

  const productOptions = useMemo(
    () => products.map((p) => ({ id: String(p.id), label: `${String(p.sku || '')} — ${String(p.name || p.id)}` })),
    [products],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'customer_name', label: 'Customer', type: 'text' },
      { key: 'product_name', label: 'Product', type: 'text' },
      { key: 'sku', label: 'SKU', type: 'text' },
      {
        key: 'rate_diff',
        label: 'Rate difference',
        type: 'select',
        allLabel: 'All',
        options: [
          { value: 'higher', label: 'Above list' },
          { value: 'lower', label: 'Below list' },
          { value: 'same', label: 'Same as list' },
        ],
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (!matchesRegex(row.product_name, filters.product_name)) return false;
      if (!matchesRegex(row.sku, filters.sku)) return false;
      if (filters.rate_diff) {
        const diff = Number(row.difference ?? 0);
        if (filters.rate_diff === 'higher' && !(diff > 0)) return false;
        if (filters.rate_diff === 'lower' && !(diff < 0)) return false;
        if (filters.rate_diff === 'same' && diff !== 0) return false;
      }
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type PriceRow = (typeof data)[number];

  const historyQuery = useListCustomerPriceHistoryQuery(
    { customer_id: String(historyRow?.customer_id || ''), product_id: String(historyRow?.product_id || '') },
    { skip: !historyRow },
  );

  function openAdd() {
    setFormError('');
    setCustomerId('');
    setCustomerName('');
    setProductId(productOptions[0]?.id || '');
    setRate('0');
    setAddOpen(true);
  }

  async function submitAdd() {
    setFormError('');
    if (!customerId.trim() || !productId) {
      setFormError('Customer and product are required');
      return;
    }
    try {
      await createPrice({
        customer_id: customerId.trim(),
        customer_name: customerName.trim(),
        product_id: productId,
        rate: Number(rate) || 0,
      }).unwrap();
      setAddOpen(false);
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
    }
  }

  const columns: EntityListColumn<PriceRow>[] = useMemo(
    () => [
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => String(row.customer_name || row.customer_id || '—'),
      },
      {
        id: 'product',
        header: 'Product',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{String(row.product_name || '—')}</span>
              <span className="el-customer-sub">SKU: {String(row.sku || '—')}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'customer_rate',
        header: 'Customer Rate',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.customer_rate ?? 0),
      },
      {
        id: 'selling_rate',
        header: 'List Rate',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.selling_rate ?? 0),
      },
      {
        id: 'difference',
        header: 'Difference',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.difference ?? 0),
      },
      {
        id: 'effective_date',
        header: 'Effective Date',
        render: (row) => String(row.effective_date || '—'),
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Customer Prices"
        count={`${filtered.length} ${filtered.length === 1 ? 'price' : 'prices'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add Price
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Rate difference"
            value={filters.rate_diff || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, rate_diff: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'higher', label: 'Above list' },
              { id: 'lower', label: 'Below list' },
              { id: 'same', label: 'Same' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_PRICE_FILTERS}
            excludeKeys={['rate_diff']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'customer_name', label: 'Customer' },
              { value: 'product_name', label: 'Product' },
              { value: 'customer_rate', label: 'Customer rate' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading customer prices…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load customer prices. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No customer prices found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => setHistoryRow(row)}
          onNew={openAdd}
          actions={(row) => (
            <EntityListActions openLabel="History" onOpen={() => setHistoryRow(row)} />
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
        title="Add Customer Price"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => void submitAdd()} disabled={createState.isLoading}>
              Save Price
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormRow label="Customer ID *">
              <TextInput value={customerId} onChange={(e) => setCustomerId(e.target.value)} required />
            </FormRow>
            <FormRow label="Customer name">
              <TextInput value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </FormRow>
          </div>
          <FormRow label="Product *">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
            >
              <option value="">— Choose —</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Rate *">
            <TextInput type="number" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </FormRow>
        </div>
      </Modal>

      <Modal
        title={historyRow ? `Price History — ${String(historyRow.customer_name || historyRow.customer_id || '')}` : 'Price History'}
        open={historyRow !== null}
        onClose={() => setHistoryRow(null)}
        footer={
          <Button type="button" variant="ghost" onClick={() => setHistoryRow(null)}>
            Close
          </Button>
        }
      >
        {historyQuery.isLoading && <p>Loading…</p>}
        {historyQuery.error ? <ErrorText>Failed to load price history.</ErrorText> : null}
        {!historyQuery.isLoading && (historyQuery.data || []).length === 0 && <p>No price history for this customer / product.</p>}
        {(historyQuery.data || []).length > 0 && (
          <DataTable
            columns={[
              { key: 'customer_rate', header: 'Customer Rate' },
              { key: 'selling_rate', header: 'List Rate' },
              { key: 'difference', header: 'Difference' },
              { key: 'effective_date', header: 'Effective Date' },
            ]}
            data={historyQuery.data || []}
            rowKey={(row) => String(row.id)}
          />
        )}
      </Modal>
    </EntityListPage>
  );
}
