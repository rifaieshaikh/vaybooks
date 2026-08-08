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
  ErrorText,
  FormRow,
  Modal,
  TextInput,
  matchesRegex,
  sortRows,
  type DataTableColumn,
  type SortCriterion,
} from '@vaybooks/ui-kit';

const PRICE_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'customer_name', header: 'Customer' },
  { key: 'sku', header: 'SKU' },
  { key: 'product_name', header: 'Product' },
  { key: 'customer_rate', header: 'Customer Rate' },
  { key: 'selling_rate', header: 'List Rate' },
  { key: 'difference', header: 'Difference' },
  { key: 'effective_date', header: 'Effective Date' },
];

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

  const [search, setSearch] = useState('');
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

  const filtered = useMemo(() => {
    let rows = data.filter(
      (row) =>
        matchesRegex(row.customer_name, search) ||
        matchesRegex(row.product_name, search) ||
        matchesRegex(row.sku, search),
    );
    rows = sortRows(rows, DEFAULT_SORT);
    return rows;
  }, [data, search]);

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Customer Prices</h2>
          <div style={{ fontSize: 13, color: '#667', marginTop: 4 }}>{filtered.length} prices</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TextInput
            placeholder="Search customer / product / SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <Button type="button" onClick={openAdd}>
            Add Price
          </Button>
        </div>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load customer prices. Is the API running?</ErrorText> : null}
      {!isLoading && !error && filtered.length === 0 && <p>No customer prices found.</p>}

      <DataTable columns={PRICE_COLUMNS} data={filtered} rowKey={(row) => String(row.id)} onRowClick={setHistoryRow} />
      <p style={{ fontSize: 12, color: '#667', marginTop: 6 }}>Click a row to view its price history.</p>

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
    </div>
  );
}
