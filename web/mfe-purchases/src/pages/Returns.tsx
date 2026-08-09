import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreatePurchaseReturnMutation,
  useGetPurchaseReturnQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListPurchaseReturnsQuery,
  useListVendorsQuery,
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

const DEFAULT_FILTERS = { return_number: '', vendor_name: '', amount: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'return_date', desc: true }];

export function PurchaseReturnsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListPurchaseReturnsQuery();
  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [createReturn, createState] = useCreatePurchaseReturnMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [notes, setNotes] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'return_number', label: 'Return #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.return_number, filters.return_number)) return false;
      if (!matchesRegex(row.vendor_name, filters.vendor_name)) return false;
      const amount = Number(row.total_amount ?? 0);
      if (filters.amount === 'with' && !(Math.abs(amount) > 0.01)) return false;
      if (filters.amount === 'zero' && Math.abs(amount) >= 0.01) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type ReturnRow = (typeof data)[number];

  const columns: EntityListColumn<ReturnRow>[] = useMemo(
    () => [
      {
        id: 'return',
        header: 'Return #',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{asCaption(row.return_number) || String(row.id)}</span>
              <span className="el-customer-sub">{asCaption(row.return_date).slice(0, 10) || '—'}</span>
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
      const created = await createReturn({
        vendor_id: vendorId,
        location_id: locationId,
        notes,
        lines: [{ product_id: productId, qty: Number(qty) || 0, rate: Number(rate) || 0 }],
      }).unwrap();
      setOpen(false);
      navigate(`/purchases/returns/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Purchases"
        title="Purchase Returns"
        count={`${filtered.length} ${filtered.length === 1 ? 'return' : 'returns'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setOpen(true);
              if (!locationId && locations[0]) setLocationId(String(locations[0].id));
            }}
          >
            New return
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Amount"
            value={filters.amount || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, amount: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'with', label: 'With amount' },
              { id: 'zero', label: 'Zero' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['amount']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'return_date', label: 'Date' },
              { value: 'return_number', label: 'Return #' },
              { value: 'total_amount', label: 'Amount' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading returns…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load returns.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No returns found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/returns/${row.id}`)} />
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
        title="New purchase return"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              disabled={createState.isLoading || !vendorId || !productId}
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
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function PurchaseReturnDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useGetPurchaseReturnQuery(id, { skip: !id });
  const lines = useMemo(
    () => (data && Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : []),
    [data],
  );

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Purchase return not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/purchases/returns">← Returns</Link>
      </p>
      <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>
        {asCaption(data.return_number) || id}
      </h2>
      <div style={{ color: '#667', marginBottom: 16 }}>
        {asCaption(data.vendor_name)} · {asCaption(data.return_date).slice(0, 10)} ·{' '}
        {formatMoney(Number(data.total_amount ?? 0))}
      </div>
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
