import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCreateInventoryProductMutation,
  useGetInventoryProductQuery,
  useListInventoryCategoriesQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useUpdateInventoryProductMutation,
} from '@vaybooks/store';
import {
  Button,
  ChipsMultiPicker,
  DataTable,
  EntityDetailBack,
  EntityDetailForm,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityDetailTabs,
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
  StatusPill,
  TextInput,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SearchableSelectOption,
  type SortCriterion,
  type StatusPillTone,
} from '@vaybooks/ui-kit';
import { toCategoryOptions, toLocationOptions, withNoneOption } from '../pickerOptions';

type ProductDetailTab = 'details' | 'pricing' | 'stock';

function stockStatusTone(status: unknown): StatusPillTone {
  const s = String(status || '');
  if (s === 'In') return 'success';
  if (s === 'Low') return 'warn';
  if (s === 'Out') return 'danger';
  return 'neutral';
}

type ProductFormValues = {
  sku: string;
  name: string;
  category_ids: string[];
  unit_code: string;
  hsn_sac: string;
  selling_rate: string;
  mrp: string;
  gst_rate: string;
  opening_qty: string;
  location_id: string;
  is_active: boolean;
};

function emptyProductForm(): ProductFormValues {
  return {
    sku: '',
    name: '',
    category_ids: [],
    unit_code: 'pcs',
    hsn_sac: '',
    selling_rate: '0',
    mrp: '0',
    gst_rate: '0',
    opening_qty: '0',
    location_id: '',
    is_active: true,
  };
}

function productToForm(row: Record<string, unknown>): ProductFormValues {
  return {
    sku: String(row.sku || ''),
    name: String(row.name || ''),
    category_ids: Array.isArray(row.category_ids) ? (row.category_ids as unknown[]).map(String) : [],
    unit_code: String(row.unit || row.unit_code || 'pcs'),
    hsn_sac: String(row.hsn_sac || ''),
    selling_rate: String(row.selling_rate ?? 0),
    mrp: String(row.mrp ?? 0),
    gst_rate: String(row.gst_rate ?? 0),
    opening_qty: String(row.opening_qty ?? 0),
    location_id: String(row.location_id || ''),
    is_active: row.is_active !== false,
  };
}

function productBody(v: ProductFormValues) {
  return {
    sku: v.sku.trim(),
    name: v.name.trim(),
    category_ids: v.category_ids,
    unit_code: v.unit_code || 'pcs',
    hsn_sac: v.hsn_sac || '',
    selling_rate: Number(v.selling_rate) || 0,
    mrp: Number(v.mrp) || 0,
    gst_rate: Number(v.gst_rate) || 0,
    opening_qty: Number(v.opening_qty) || 0,
    location_id: v.location_id || '',
    is_active: v.is_active,
  };
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Save failed');
  }
  return 'Save failed';
}

function stockStatusLabel(status: unknown): string {
  const s = String(status || '');
  if (s === 'In') return 'In stock';
  if (s === 'Low') return 'Low stock';
  if (s === 'Out') return 'Out of stock';
  return s || 'Unknown';
}

const DEFAULT_PRODUCT_FILTERS = { sku: '', name: '', hsn_sac: '', active: '', stock: '' };
const DEFAULT_PRODUCT_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];
const STOCK_CHIP_OPTIONS = [
  { id: 'In', label: 'In stock' },
  { id: 'Low', label: 'Low' },
  { id: 'Out', label: 'Out' },
] as const;

function ProductFormFields({
  values,
  onChange,
  categoryOptions,
  locationOptions,
}: {
  values: ProductFormValues;
  onChange: (n: keyof ProductFormValues, v: string | boolean | string[]) => void;
  categoryOptions: SearchableSelectOption[];
  locationOptions: SearchableSelectOption[];
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="SKU *">
          <TextInput value={values.sku} onChange={(e) => onChange('sku', e.target.value)} required />
        </FormRow>
        <FormRow label="Name *">
          <TextInput value={values.name} onChange={(e) => onChange('name', e.target.value)} required />
        </FormRow>
      </div>
      <FormRow label="Categories">
        <ChipsMultiPicker
          options={categoryOptions}
          value={values.category_ids}
          onChange={(next) => onChange('category_ids', next)}
          placeholder="Add category"
          emptyMessage="No categories yet."
        />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Unit code">
          <TextInput value={values.unit_code} onChange={(e) => onChange('unit_code', e.target.value)} />
        </FormRow>
        <FormRow label="HSN / SAC">
          <TextInput value={values.hsn_sac} onChange={(e) => onChange('hsn_sac', e.target.value)} />
        </FormRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <FormRow label="Selling rate">
          <TextInput type="number" value={values.selling_rate} onChange={(e) => onChange('selling_rate', e.target.value)} />
        </FormRow>
        <FormRow label="MRP">
          <TextInput type="number" value={values.mrp} onChange={(e) => onChange('mrp', e.target.value)} />
        </FormRow>
        <FormRow label="GST rate %">
          <TextInput type="number" value={values.gst_rate} onChange={(e) => onChange('gst_rate', e.target.value)} />
        </FormRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Opening qty (new products only)">
          <TextInput type="number" value={values.opening_qty} onChange={(e) => onChange('opening_qty', e.target.value)} />
        </FormRow>
        <FormRow label="Opening location">
          <SearchableSelect
            options={withNoneOption(locationOptions, '— Default location —')}
            value={values.location_id}
            placeholder="Select location"
            onChange={(next) => onChange('location_id', next)}
          />
        </FormRow>
      </div>
      <FormRow label="Status">
        <select
          value={values.is_active ? 'yes' : 'no'}
          onChange={(e) => onChange('is_active', e.target.value === 'yes')}
          style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
        >
          <option value="yes">Active</option>
          <option value="no">Inactive</option>
        </select>
      </FormRow>
    </div>
  );
}

/** Streamlit parity: product catalog list with stock-status badges, filters, add/edit modal. */
export function ProductsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListInventoryProductsQuery({ active_only: false });
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: true });
  const { data: locations = [] } = useListInventoryLocationsQuery({ active_only: true });
  const [createProduct, createState] = useCreateInventoryProductMutation();
  const [updateProduct, updateState] = useUpdateInventoryProductMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_PRODUCT_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_PRODUCT_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
  const [formError, setFormError] = useState('');

  const categoryOptions = useMemo(
    () => toCategoryOptions(categories as Record<string, unknown>[]),
    [categories],
  );
  const locationOptions = useMemo(
    () => toLocationOptions(locations as Record<string, unknown>[]),
    [locations],
  );
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categoryOptions.forEach((c) => map.set(c.value, c.label));
    return map;
  }, [categoryOptions]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'sku', label: 'SKU', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'hsn_sac', label: 'HSN / SAC', type: 'text' },
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
      if (!matchesRegex(row.hsn_sac, filters.hsn_sac)) return false;
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

  type ProductRow = (typeof data)[number];

  function setField(name: keyof ProductFormValues, value: string | boolean | string[]) {
    setValues((p) => ({ ...p, [name]: value }));
  }

  function openAdd() {
    setFormError('');
    setValues(emptyProductForm());
    setEditId(null);
    setDialog('add');
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    openAdd();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  function openEdit(row: ProductRow) {
    setFormError('');
    setEditId(String(row.id));
    setValues(productToForm(row));
    setDialog('edit');
  }

  async function submitForm() {
    setFormError('');
    if (!values.sku.trim() || !values.name.trim()) {
      setFormError('SKU and name are required');
      return;
    }
    try {
      if (dialog === 'add') {
        await createProduct(productBody(values)).unwrap();
      } else if (dialog === 'edit' && editId) {
        await updateProduct({ id: editId, body: productBody(values) }).unwrap();
      }
      setDialog(null);
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
    }
  }

  const columns: EntityListColumn<ProductRow>[] = useMemo(
    () => [
      {
        id: 'product',
        header: 'Product',
        render: (row) => {
          const name = displayName(row, ['name'], 'Unnamed product');
          const sku = String(row.sku || '—');
          const catIds = Array.isArray(row.category_ids) ? (row.category_ids as unknown[]).map(String) : [];
          const catNames =
            Array.isArray(row.category_names) && (row.category_names as unknown[]).length > 0
              ? (row.category_names as unknown[]).map(String)
              : catIds.map((id) => categoryNameById.get(id) || id);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{name}</span>
                <span className="el-customer-sub">
                  SKU: {sku}
                  {catNames.length > 0 ? ` · ${catNames.join(', ')}` : ''}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'qty',
        header: 'Qty',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.current_qty ?? 0),
      },
      {
        id: 'stock',
        header: 'Stock',
        render: (row) => {
          const status = String(row.stock_status || '');
          const tone = status === 'Low' ? 'el-due' : status === 'Out' || row.is_active === false ? 'el-muted' : undefined;
          const label =
            row.is_active === false
              ? `${stockStatusLabel(status)} · Inactive`
              : stockStatusLabel(status);
          return <span className={tone}>{label}</span>;
        },
      },
      {
        id: 'hsn',
        header: 'HSN',
        render: (row) => {
          const hsn = String(row.hsn_sac || '').trim();
          return <span className={hsn ? undefined : 'el-muted'}>{hsn || '—'}</span>;
        },
      },
    ],
    [categoryNameById],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Products"
        count={`${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add Product
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
            defaultFilters={DEFAULT_PRODUCT_FILTERS}
            excludeKeys={['stock']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_PRODUCT_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
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

      {isLoading ? <EntityListLoading>Loading products…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load products. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No products found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/inventory/products/${String(row.id)}`)}
          onEditRow={(row) => openEdit(row)}
          onNew={openAdd}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/inventory/products/${String(row.id)}`)}
              onEdit={() => openEdit(row)}
            />
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
        title={dialog === 'edit' ? 'Edit Product' : 'Add Product'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      >
        <ModalForm onSubmit={() => void submitForm()}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <ProductFormFields
            values={values}
            onChange={setField}
            categoryOptions={categoryOptions}
            locationOptions={locationOptions}
          />
          <ModalFormActions
            busy={createState.isLoading || updateState.isLoading}
            submitLabel={dialog === 'edit' ? 'Save Changes' : 'Create Product'}
            busyLabel="Saving…"
            onCancel={() => setDialog(null)}
          />
        </ModalForm>
      </Modal>
    </EntityListPage>
  );
}

/** Product detail — tabbed Details / Pricing / Stock with searchable pickers. */
export function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetInventoryProductQuery(id, { skip: !id });
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: false });
  const { data: locations = [] } = useListInventoryLocationsQuery({ active_only: false });
  const [updateProduct, updateState] = useUpdateInventoryProductMutation();
  const [tab, setTab] = useState<ProductDetailTab>('details');
  const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
  const [formError, setFormError] = useState('');

  const categoryOptions = useMemo(
    () => toCategoryOptions(categories as Record<string, unknown>[]),
    [categories],
  );
  const locationOptions = useMemo(
    () => toLocationOptions(locations as Record<string, unknown>[]),
    [locations],
  );
  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    locationOptions.forEach((l) => map.set(l.value, l.label));
    return map;
  }, [locationOptions]);

  const balanceRows = useMemo(() => {
    const raw = Array.isArray(data?.balances) ? (data.balances as Record<string, unknown>[]) : [];
    return raw.map((b, i) => ({
      id: String(b.id || `${b.location_id}-${i}`),
      location: locationNameById.get(String(b.location_id || '')) || String(b.location_id || '—'),
      qty: Number(b.qty ?? 0),
    }));
  }, [data, locationNameById]);

  const rateHistoryRows = useMemo(() => {
    const history = (data?.rate_history || {}) as Record<string, unknown>;
    const types: Array<{ key: string; label: string }> = [
      { key: 'selling', label: 'Selling' },
      { key: 'mrp', label: 'MRP' },
      { key: 'gst', label: 'GST' },
    ];
    const rows: Array<{ id: string; type: string; value: number; start_date: string; end_date: string }> = [];
    for (const t of types) {
      const periods = Array.isArray(history[t.key]) ? (history[t.key] as Record<string, unknown>[]) : [];
      periods.forEach((p, i) => {
        rows.push({
          id: String(p.id || `${t.key}-${i}`),
          type: t.label,
          value: Number(p.value ?? 0),
          start_date: String(p.start_date || '—'),
          end_date: p.end_date ? String(p.end_date) : '—',
        });
      });
    }
    return rows;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    setValues(productToForm(data));
    setFormError('');
  }, [data]);

  function setField(name: keyof ProductFormValues, value: string | boolean | string[]) {
    setValues((p) => ({ ...p, [name]: value }));
  }

  async function onSave() {
    setFormError('');
    try {
      await updateProduct({ id, body: productBody(values) }).unwrap();
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
    }
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading product…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/products" label="Products" />
        <ErrorText>Product not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const stockLabel = stockStatusLabel(data.stock_status);
  const heroActions = (
    <>
      <Button type="button" variant="ghost" onClick={() => void refetch()}>
        Refresh
      </Button>
      <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
        {updateState.isLoading ? 'Saving…' : 'Save'}
      </Button>
    </>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/inventory/products" label="Products" />

      <EntityDetailHero
        kicker="Inventory · Product"
        title={displayName(data as Record<string, unknown>, ['name'], String(data.name || id))}
        lead={
          <>
            <StatusPill status={stockLabel} tone={stockStatusTone(data.stock_status)} />
            <span className="ed-lead-sep"> · {String(data.sku || '—')}</span>
            {data.is_active === false ? <span className="ed-lead-sep"> · Inactive</span> : null}
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Product facts"
        items={[
          { label: 'SKU', value: String(data.sku || '—') },
          { label: 'Qty on hand', value: Number(data.current_qty ?? 0) },
          { label: 'Stock', value: stockLabel },
          { label: 'Unit', value: String(data.unit || data.unit_code || '—') },
          { label: 'Active', value: data.is_active === false ? 'No' : 'Yes' },
        ]}
      />

      {formError ? <ErrorText>{formError}</ErrorText> : null}

      <EntityDetailTabs
        value={tab}
        ariaLabel="Product sections"
        onChange={(next) => setTab(next as ProductDetailTab)}
        options={[
          { id: 'details', label: 'Details' },
          { id: 'pricing', label: 'Pricing' },
          { id: 'stock', label: 'Stock' },
        ]}
      />

      {tab === 'details' ? (
        <EntityDetailPanel title="Details" note="Identity, categories, and catalog status.">
          <EntityDetailForm>
            <div className="ed-grid ed-grid-2">
              <FormRow label="SKU *">
                <TextInput value={values.sku} onChange={(e) => setField('sku', e.target.value)} required />
              </FormRow>
              <FormRow label="Name *">
                <TextInput value={values.name} onChange={(e) => setField('name', e.target.value)} required />
              </FormRow>
              <FormRow label="Unit code">
                <TextInput value={values.unit_code} onChange={(e) => setField('unit_code', e.target.value)} />
              </FormRow>
              <FormRow label="HSN / SAC">
                <TextInput value={values.hsn_sac} onChange={(e) => setField('hsn_sac', e.target.value)} />
              </FormRow>
              <FormRow label="Status">
                <select
                  value={values.is_active ? 'yes' : 'no'}
                  onChange={(e) => setField('is_active', e.target.value === 'yes')}
                >
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </select>
              </FormRow>
            </div>
            <FormRow label="Categories">
              <ChipsMultiPicker
                options={categoryOptions}
                value={values.category_ids}
                onChange={(next) => setField('category_ids', next)}
                placeholder="Add category"
                emptyMessage="No categories yet."
              />
            </FormRow>
          </EntityDetailForm>
        </EntityDetailPanel>
      ) : null}

      {tab === 'pricing' ? (
        <EntityDetailPanel title="Pricing" note="Selling rate, MRP, GST, and rate history.">
          <EntityDetailForm>
            <div className="ed-grid ed-grid-3">
              <FormRow label="Selling rate">
                <TextInput
                  type="number"
                  value={values.selling_rate}
                  onChange={(e) => setField('selling_rate', e.target.value)}
                />
              </FormRow>
              <FormRow label="MRP">
                <TextInput type="number" value={values.mrp} onChange={(e) => setField('mrp', e.target.value)} />
              </FormRow>
              <FormRow label="GST rate %">
                <TextInput
                  type="number"
                  value={values.gst_rate}
                  onChange={(e) => setField('gst_rate', e.target.value)}
                />
              </FormRow>
            </div>
          </EntityDetailForm>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 650, marginBottom: 8 }}>Rate history</div>
            {rateHistoryRows.length === 0 ? (
              <p className="ed-panel-note">No rate history.</p>
            ) : (
              <DataTable
                columns={[
                  { key: 'type', header: 'Type' },
                  { key: 'value', header: 'Value' },
                  { key: 'start_date', header: 'Start' },
                  { key: 'end_date', header: 'End' },
                ]}
                data={rateHistoryRows}
                rowKey={(row) => row.id}
              />
            )}
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'stock' ? (
        <EntityDetailPanel title="Stock" note="On-hand quantity, opening stock, and per-location balances.">
          <EntityDetailForm>
            <div className="ed-grid ed-grid-2">
              <FormRow label="Qty on hand">
                <TextInput value={String(Number(data.current_qty ?? 0))} disabled />
              </FormRow>
              <FormRow label="Stock status">
                <TextInput value={stockLabel} disabled />
              </FormRow>
              <FormRow label="Opening qty (new products only)">
                <TextInput
                  type="number"
                  value={values.opening_qty}
                  onChange={(e) => setField('opening_qty', e.target.value)}
                />
              </FormRow>
              <FormRow label="Opening location">
                <SearchableSelect
                  options={withNoneOption(locationOptions, '— Default location —')}
                  value={values.location_id}
                  placeholder="Select location"
                  onChange={(next) => setField('location_id', next)}
                />
              </FormRow>
            </div>
          </EntityDetailForm>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 650, marginBottom: 8 }}>Balances by location</div>
            {balanceRows.length === 0 ? (
              <p className="ed-panel-note">No per-location balances.</p>
            ) : (
              <DataTable
                columns={[
                  { key: 'location', header: 'Location' },
                  { key: 'qty', header: 'Qty' },
                ]}
                data={balanceRows}
                rowKey={(row) => row.id}
              />
            )}
          </div>
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/inventory/products')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}
