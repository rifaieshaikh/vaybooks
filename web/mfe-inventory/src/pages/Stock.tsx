import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCreateInventoryMovementMutation,
  useListInventoryLocationsQuery,
  useListInventoryMovementsQuery,
  useListInventoryProductsQuery,
  useListInventoryStockQuery,
  useListStockLedgerQuery,
} from '@vaybooks/store';
import {
  Button,
  DataTable,
  EntityCard,
  EntityCardGrid,
  ErrorText,
  FormRow,
  ListToolbar,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type DataTableColumn,
  type EntityCardBadge,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';

function stockBadge(status: unknown): EntityCardBadge {
  const s = String(status || '');
  if (s === 'In') return { label: 'In stock', tone: 'green' };
  if (s === 'Low') return { label: 'Low stock', tone: 'red' };
  if (s === 'Out') return { label: 'Out of stock', tone: 'gray' };
  return { label: s || 'Unknown', tone: 'gray' };
}

const MOVEMENT_TYPES = ['Receive', 'Issue', 'Adjust In', 'Adjust Out'];

const DEFAULT_STOCK_FILTERS = { sku: '', name: '', active: '' };
const DEFAULT_STOCK_SORT: SortCriterion[] = [{ key: 'name', desc: false }];

/** Streamlit parity: stock-on-hand cards per product. */
export function StockListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListInventoryStockQuery({ active_only: false });

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_STOCK_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_STOCK_FILTERS });

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'sku', label: 'SKU', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      {
        key: 'active',
        label: 'Active',
        type: 'select',
        allLabel: 'All',
        options: [
          { value: 'yes', label: 'Active only' },
          { value: 'no', label: 'Inactive only' },
        ],
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.sku, filters.sku)) return false;
      if (!matchesRegex(row.name, filters.name)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  return (
    <div>
      <ListToolbar
        title="Stock on Hand"
        countLabel="products"
        count={filtered.length}
        primaryLabel="Refresh"
        onPrimary={() => refetch()}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_STOCK_FILTERS}
        onFiltersChange={(next) => {
          setFilters(next as typeof filters);
          setPage(1);
        }}
        sort={sort}
        defaultSort={DEFAULT_STOCK_SORT}
        sortOptions={[
          { value: 'name', label: 'Name' },
          { value: 'sku', label: 'SKU' },
          { value: 'current_qty', label: 'Qty on hand' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load stock. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 && <p>No stock records found.</p>}

      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={displayName(row, ['name'], 'Unnamed product')}
            captions={[`SKU: ${String(row.sku || '—')}`, `Qty on hand: ${Number(row.current_qty ?? 0)}`]}
            badges={[stockBadge(row.stock_status)]}
            onView={() => navigate(`/inventory/products/${String(row.id)}`)}
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
    </div>
  );
}

const LEDGER_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'movement_date', header: 'Date' },
  { key: 'sku', header: 'SKU' },
  { key: 'product_name', header: 'Product' },
  { key: 'movement_type', header: 'Type' },
  { key: 'qty_in', header: 'Qty In' },
  { key: 'qty_out', header: 'Qty Out' },
  { key: 'location_name', header: 'Location' },
  { key: 'notes', header: 'Notes' },
];

const DEFAULT_LEDGER_FILTERS = { product_name: '', movement_type: '' };
const DEFAULT_LEDGER_SORT: SortCriterion[] = [{ key: 'movement_date', desc: true }];

/** Streamlit parity: full stock ledger table with product / movement-type filters. */
export function StockLedgerPage() {
  const { data = [], isLoading, error, refetch } = useListStockLedgerQuery();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_LEDGER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_LEDGER_FILTERS });

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'product_name', label: 'Product name', type: 'text' },
      {
        key: 'movement_type',
        label: 'Movement type',
        type: 'select',
        allLabel: 'All types',
        options: MOVEMENT_TYPES.map((t) => ({ value: t, label: t })),
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.product_name, filters.product_name)) return false;
      if (filters.movement_type && String(row.movement_type || '') !== filters.movement_type) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pageSize = 25;
  const pages = pageCount(filtered.length, pageSize);
  const pageRows = paginate(filtered, Math.min(page, pages), pageSize);

  return (
    <div>
      <ListToolbar
        title="Stock Ledger"
        countLabel="entries"
        count={filtered.length}
        primaryLabel="Refresh"
        onPrimary={() => refetch()}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_LEDGER_FILTERS}
        onFiltersChange={(next) => {
          setFilters(next as typeof filters);
          setPage(1);
        }}
        sort={sort}
        defaultSort={DEFAULT_LEDGER_SORT}
        sortOptions={[
          { value: 'movement_date', label: 'Date' },
          { value: 'qty_in', label: 'Qty in' },
          { value: 'qty_out', label: 'Qty out' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load the stock ledger. Is the API running?</ErrorText> : null}

      <DataTable columns={LEDGER_COLUMNS} data={pageRows} rowKey={(row) => String(row.id)} />
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
    </div>
  );
}

/** Streamlit parity: movement history + "Record Movement" action modal. */
export function MovementsListPage() {
  const { data = [], isLoading, error, refetch } = useListInventoryMovementsQuery();
  const { data: products = [] } = useListInventoryProductsQuery({ active_only: true });
  const { data: locations = [] } = useListInventoryLocationsQuery({ active_only: true });
  const [recordMovement, recordState] = useCreateInventoryMovementMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_LEDGER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_LEDGER_FILTERS });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState(MOVEMENT_TYPES[0]);
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [locationId, setLocationId] = useState('');
  const [formError, setFormError] = useState('');

  const productOptions = useMemo(
    () => products.map((p) => ({ id: String(p.id), label: `${String(p.sku || '')} — ${String(p.name || p.id)}` })),
    [products],
  );
  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: String(l.id), name: String(l.name || l.id) })),
    [locations],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'product_name', label: 'Product name', type: 'text' },
      {
        key: 'movement_type',
        label: 'Movement type',
        type: 'select',
        allLabel: 'All types',
        options: MOVEMENT_TYPES.map((t) => ({ value: t, label: t })),
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.product_name, filters.product_name)) return false;
      if (filters.movement_type && String(row.movement_type || '') !== filters.movement_type) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pageSize = 25;
  const pages = pageCount(filtered.length, pageSize);
  const pageRows = paginate(filtered, Math.min(page, pages), pageSize);

  function openRecord() {
    setFormError('');
    setProductId(productOptions[0]?.id || '');
    setMovementType(MOVEMENT_TYPES[0]);
    setQty('1');
    setNotes('');
    setLocationId(locationOptions[0]?.id || '');
    setDialogOpen(true);
  }

  async function submitMovement() {
    setFormError('');
    if (!productId) {
      setFormError('Choose a product');
      return;
    }
    const qtyNum = Number(qty);
    if (!(qtyNum > 0)) {
      setFormError('Quantity must be greater than zero');
      return;
    }
    try {
      await recordMovement({
        product_id: productId,
        movement_type: movementType,
        qty: qtyNum,
        notes,
        location_id: locationId || undefined,
      }).unwrap();
      setDialogOpen(false);
      refetch();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { detail?: string } }).data?.detail || 'Recording movement failed')
          : 'Recording movement failed';
      setFormError(msg);
    }
  }

  return (
    <div>
      <ListToolbar
        title="Movements"
        countLabel="movements"
        count={filtered.length}
        primaryLabel="Record Movement"
        onPrimary={openRecord}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_LEDGER_FILTERS}
        onFiltersChange={(next) => {
          setFilters(next as typeof filters);
          setPage(1);
        }}
        sort={sort}
        defaultSort={DEFAULT_LEDGER_SORT}
        sortOptions={[
          { value: 'movement_date', label: 'Date' },
          { value: 'qty_in', label: 'Qty in' },
          { value: 'qty_out', label: 'Qty out' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load movements. Is the API running?</ErrorText> : null}

      <DataTable columns={LEDGER_COLUMNS} data={pageRows} rowKey={(row) => String(row.id)} />
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

      <Modal
        title="Record Movement"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => void submitMovement()} disabled={recordState.isLoading}>
              Record Movement
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Product *">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
            >
              <option value="">— Choose a product —</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormRow label="Movement type">
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
              >
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Quantity *">
              <TextInput type="number" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </FormRow>
          </div>
          <FormRow label="Location">
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
            >
              <option value="">— Default location —</option>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </div>
  );
}
