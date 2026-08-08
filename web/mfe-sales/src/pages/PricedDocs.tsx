import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useConvertEstimateToOrderMutation,
  useConvertQuotationToOrderMutation,
  useCreateSalesEstimateMutation,
  useCreateSalesQuotationMutation,
  useGetSalesEstimateQuery,
  useGetSalesQuotationQuery,
  useListCustomersQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListSalesEstimatesQuery,
  useListSalesQuotationsQuery,
  useSetSalesEstimateStatusMutation,
  useSetSalesQuotationStatusMutation,
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

const DEFAULT_FILTERS = { number: '', customer_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

function CreatePricedModal({
  open,
  title,
  onClose,
  onCreate,
  saving,
  formError,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onCreate: (payload: {
    customer_id: string;
    location_id: string;
    lines: { product_id: string; qty: number; rate: number }[];
  }) => Promise<void>;
  saving: boolean;
  formError: string;
}) {
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              void onCreate({
                customer_id: customerId,
                location_id: locationId || (locations[0] ? String(locations[0].id) : ''),
                lines: [{ product_id: productId, qty: Number(qty) || 0, rate: Number(rate) || 0 }],
              })
            }
            disabled={saving || !customerId || !productId}
          >
            {saving ? 'Saving…' : 'Create'}
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
  );
}

export function EstimatesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListSalesEstimatesQuery();
  const [createDoc, createState] = useCreateSalesEstimateMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'number', label: '#', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.estimate_number, filters.number)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (!matchesRegex(row.status, filters.status)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  return (
    <div>
      <ListToolbar
        title="Estimates"
        countLabel="estimates"
        count={filtered.length}
        primaryLabel="New estimate"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
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
          { value: 'created_at', label: 'Created' },
          { value: 'estimate_number', label: '#' },
          { value: 'status', label: 'Status' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load estimates.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 && <p>No estimates found.</p>}
      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={asCaption(row.estimate_number) || String(row.id)}
            captions={[
              asCaption(row.customer_name),
              asCaption(row.status),
              formatMoney(Number(row.total_amount ?? 0)),
            ]}
            onView={() => navigate(`/sales/estimates/${row.id}`)}
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
      <CreatePricedModal
        open={open}
        title="New estimate"
        onClose={() => setOpen(false)}
        saving={createState.isLoading}
        formError={formError}
        onCreate={async (payload) => {
          try {
            const created = await createDoc(payload).unwrap();
            setOpen(false);
            navigate(`/sales/estimates/${created.id}`);
          } catch (e) {
            setFormError(extractError(e));
          }
        }}
      />
    </div>
  );
}

export function QuotationsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListSalesQuotationsQuery();
  const [createDoc, createState] = useCreateSalesQuotationMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'number', label: '#', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.quotation_number, filters.number)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (!matchesRegex(row.status, filters.status)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  return (
    <div>
      <ListToolbar
        title="Quotations"
        countLabel="quotations"
        count={filtered.length}
        primaryLabel="New quotation"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
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
          { value: 'created_at', label: 'Created' },
          { value: 'quotation_number', label: '#' },
          { value: 'status', label: 'Status' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load quotations.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 && <p>No quotations found.</p>}
      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={asCaption(row.quotation_number) || String(row.id)}
            captions={[
              asCaption(row.customer_name),
              asCaption(row.status),
              formatMoney(Number(row.total_amount ?? 0)),
            ]}
            onView={() => navigate(`/sales/quotations/${row.id}`)}
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
      <CreatePricedModal
        open={open}
        title="New quotation"
        onClose={() => setOpen(false)}
        saving={createState.isLoading}
        formError={formError}
        onCreate={async (payload) => {
          try {
            const created = await createDoc(payload).unwrap();
            setOpen(false);
            navigate(`/sales/quotations/${created.id}`);
          } catch (e) {
            setFormError(extractError(e));
          }
        }}
      />
    </div>
  );
}

export function EstimateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetSalesEstimateQuery(id, { skip: !id });
  const [setStatus] = useSetSalesEstimateStatusMutation();
  const [convert] = useConvertEstimateToOrderMutation();
  const [actionError, setActionError] = useState('');
  const lines = useMemo(
    () => (data && Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : []),
    [data],
  );

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Estimate not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/sales/estimates">← Estimates</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.estimate_number) || id}
          </h2>
          <div style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.customer_name)} · {asCaption(data.status)} ·{' '}
            {formatMoney(Number(data.total_amount ?? 0))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              void setStatus({ id, status: 'Sent' })
                .unwrap()
                .then(() => refetch())
                .catch((e) => setActionError(extractError(e)))
            }
          >
            Mark sent
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              void setStatus({ id, status: 'Accepted' })
                .unwrap()
                .then(() => refetch())
                .catch((e) => setActionError(extractError(e)))
            }
          >
            Accept
          </Button>
          <Button
            type="button"
            onClick={() =>
              void convert(id)
                .unwrap()
                .then((order) => navigate(`/sales/orders/${order.id}`))
                .catch((e) => setActionError(extractError(e)))
            }
          >
            Convert to SO
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

export function QuotationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetSalesQuotationQuery(id, { skip: !id });
  const [setStatus] = useSetSalesQuotationStatusMutation();
  const [convert] = useConvertQuotationToOrderMutation();
  const [actionError, setActionError] = useState('');
  const lines = useMemo(
    () => (data && Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : []),
    [data],
  );

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Quotation not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/sales/quotations">← Quotations</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.quotation_number) || id}
          </h2>
          <div style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.customer_name)} · {asCaption(data.status)} ·{' '}
            {formatMoney(Number(data.total_amount ?? 0))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              void setStatus({ id, status: 'Sent' })
                .unwrap()
                .then(() => refetch())
                .catch((e) => setActionError(extractError(e)))
            }
          >
            Mark sent
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              void setStatus({ id, status: 'Accepted' })
                .unwrap()
                .then(() => refetch())
                .catch((e) => setActionError(extractError(e)))
            }
          >
            Accept
          </Button>
          <Button
            type="button"
            onClick={() =>
              void convert(id)
                .unwrap()
                .then((order) => navigate(`/sales/orders/${order.id}`))
                .catch((e) => setActionError(extractError(e)))
            }
          >
            Convert to SO
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
