import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ModalForm,
  ModalFormActions,
  PAGE_SIZE,
  PaginationBar,
  SearchableSelect,
  TextInput,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { toLocationOptions, toProductOptions, withNoneOption } from '../pickerOptions';

function stockStatusLabel(status: unknown): string {
  const s = String(status || '');
  if (s === 'In') return 'In stock';
  if (s === 'Low') return 'Low stock';
  if (s === 'Out') return 'Out of stock';
  return s || 'Unknown';
}

const MOVEMENT_TYPES = ['Receive', 'Issue', 'Adjust In', 'Adjust Out'];
const STOCK_CHIP_OPTIONS = [
  { id: 'In', label: 'In stock' },
  { id: 'Low', label: 'Low' },
  { id: 'Out', label: 'Out' },
] as const;
const MOVEMENT_DIRECTION_OPTIONS = [
  { id: 'In', label: 'In' },
  { id: 'Out', label: 'Out' },
] as const;

const DEFAULT_STOCK_FILTERS = { sku: '', name: '', active: '', stock: '' };
const DEFAULT_STOCK_SORT: SortCriterion[] = [{ key: 'name', desc: false }];

function matchesMovementDirection(row: Record<string, unknown>, direction: string): boolean {
  if (!direction) return true;
  const qtyIn = Number(row.qty_in ?? 0);
  const qtyOut = Number(row.qty_out ?? 0);
  if (direction === 'In') return qtyIn > 0;
  if (direction === 'Out') return qtyOut > 0;
  return true;
}

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
      {
        key: 'stock',
        label: 'Stock status',
        type: 'select',
        allLabel: 'All',
        options: STOCK_CHIP_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
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
      if (filters.stock && String(row.stock_status || '') !== filters.stock) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type StockRow = (typeof data)[number];

  const columns: EntityListColumn<StockRow>[] = useMemo(
    () => [
      {
        id: 'product',
        header: 'Product',
        render: (row) => {
          const name = displayName(row, ['name'], 'Unnamed product');
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{name}</span>
                <span className="el-customer-sub">SKU: {String(row.sku || '—')}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'qty',
        header: 'Qty on hand',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.current_qty ?? 0),
      },
      {
        id: 'stock',
        header: 'Status',
        render: (row) => {
          const status = String(row.stock_status || '');
          const tone = status === 'Low' ? 'el-due' : status === 'Out' ? 'el-muted' : undefined;
          return <span className={tone}>{stockStatusLabel(status)}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Stock on Hand"
        count={`${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}`}
        actions={
          <Button type="button" onClick={() => refetch()}>
            Refresh
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Stock status"
            value={filters.stock || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, stock: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...STOCK_CHIP_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_STOCK_FILTERS}
            excludeKeys={['stock']}
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
        }
      />

      {isLoading ? <EntityListLoading>Loading stock…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load stock. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No stock records found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/inventory/skus/${String(row.id)}`)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/inventory/skus/${String(row.id)}`)} />
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
    </EntityListPage>
  );
}

const DEFAULT_LEDGER_FILTERS = { product_name: '', movement_type: '' };
const DEFAULT_LEDGER_SORT: SortCriterion[] = [{ key: 'movement_date', desc: true }];
const LEDGER_PAGE_SIZE = 25;

const LEDGER_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'product_name', label: 'Product name', type: 'text' },
  {
    key: 'movement_type',
    label: 'Direction',
    type: 'select',
    allLabel: 'All',
    options: MOVEMENT_DIRECTION_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
  },
];

type LedgerRow = Record<string, unknown>;

function useLedgerColumns(): EntityListColumn<LedgerRow>[] {
  return useMemo(
    () => [
      {
        id: 'date',
        header: 'Date',
        render: (row) => String(row.movement_date || '—'),
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
        id: 'type',
        header: 'Type',
        render: (row) => String(row.movement_type || '—'),
      },
      {
        id: 'qty_in',
        header: 'Qty In',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.qty_in ?? 0),
      },
      {
        id: 'qty_out',
        header: 'Qty Out',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.qty_out ?? 0),
      },
      {
        id: 'location',
        header: 'Location',
        render: (row) => String(row.location_name || '—'),
      },
      {
        id: 'notes',
        header: 'Notes',
        render: (row) => {
          const notes = String(row.notes || '').trim();
          return <span className={notes ? undefined : 'el-muted'}>{notes || '—'}</span>;
        },
      },
    ],
    [],
  );
}

/** Streamlit parity: full stock ledger table with product / movement-type filters. */
export function StockLedgerPage() {
  const { data = [], isLoading, error, refetch } = useListStockLedgerQuery();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_LEDGER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_LEDGER_FILTERS });
  const columns = useLedgerColumns();

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.product_name, filters.product_name)) return false;
      if (!matchesMovementDirection(row, filters.movement_type)) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, LEDGER_PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), LEDGER_PAGE_SIZE);

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Stock Ledger"
        count={`${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
        actions={
          <Button type="button" onClick={() => refetch()}>
            Refresh
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Direction"
            value={filters.movement_type || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, movement_type: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...MOVEMENT_DIRECTION_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={LEDGER_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_LEDGER_FILTERS}
            excludeKeys={['movement_type']}
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
        }
      />

      {isLoading ? <EntityListLoading>Loading stock ledger…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load the stock ledger. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No ledger entries found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}
    </EntityListPage>
  );
}

/** Streamlit parity: movement history + "Record Movement" action modal. */
export function MovementsListPage() {
  const [searchParams] = useSearchParams();
  const focusId = (searchParams.get('id') || '').trim();
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
  const columns = useLedgerColumns();

  const productOptions = useMemo(
    () => toProductOptions(products as Record<string, unknown>[]),
    [products],
  );
  const locationOptions = useMemo(
    () => toLocationOptions(locations as Record<string, unknown>[]),
    [locations],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (focusId && String(row.id) !== focusId) return false;
      if (!matchesRegex(row.product_name, filters.product_name)) return false;
      if (!matchesMovementDirection(row, filters.movement_type)) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, focusId, sort]);

  const pages = pageCount(filtered.length, LEDGER_PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), LEDGER_PAGE_SIZE);

  function openRecord() {
    setFormError('');
    setProductId(productOptions[0]?.value || '');
    setMovementType(MOVEMENT_TYPES[0]);
    setQty('1');
    setNotes('');
    setLocationId(locationOptions[0]?.value || '');
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
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Movements"
        count={
          focusId
            ? `Focused on ${focusId}`
            : `${filtered.length} ${filtered.length === 1 ? 'movement' : 'movements'}`
        }
        actions={
          <Button type="button" onClick={openRecord}>
            Record Movement
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Direction"
            value={filters.movement_type || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, movement_type: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...MOVEMENT_DIRECTION_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={LEDGER_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_LEDGER_FILTERS}
            excludeKeys={['movement_type']}
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
        }
      />

      {isLoading ? <EntityListLoading>Loading movements…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load movements. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No movements found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onNew={openRecord}
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal title="Record Movement" open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <ModalForm onSubmit={() => void submitMovement()}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <div style={{ display: 'grid', gap: 10 }}>
            <FormRow label="Product *">
              <SearchableSelect
                options={productOptions}
                value={productId}
                placeholder="Choose a product"
                onChange={setProductId}
              />
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
              <SearchableSelect
                options={withNoneOption(locationOptions, '— Default location —')}
                value={locationId}
                placeholder="Select location"
                onChange={setLocationId}
              />
            </FormRow>
            <FormRow label="Notes">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormRow>
          </div>
          <ModalFormActions
            busy={recordState.isLoading}
            submitLabel="Record Movement"
            busyLabel="Recording…"
            onCancel={() => setDialogOpen(false)}
          />
        </ModalForm>
      </Modal>
    </EntityListPage>
  );
}
