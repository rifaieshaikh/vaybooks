import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';

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
  categoryOptions: { id: string; name: string }[];
  locationOptions: { id: string; name: string }[];
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
        {categoryOptions.length === 0 ? (
          <div style={{ fontSize: 13, color: '#667' }}>No categories yet.</div>
        ) : (
          <select
            multiple
            value={values.category_ids}
            onChange={(e) =>
              onChange(
                'category_ids',
                Array.from(e.target.selectedOptions).map((o) => o.value),
              )
            }
            style={{ minHeight: 84, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
          >
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
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
          <select
            value={values.location_id}
            onChange={(e) => onChange('location_id', e.target.value)}
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
    () => categories.map((c) => ({ id: String(c.id), name: String(c.name || c.id) })),
    [categories],
  );
  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: String(l.id), name: String(l.name || l.id) })),
    [locations],
  );
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categoryOptions.forEach((c) => map.set(c.id, c.name));
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
        footer={
          <>
            <Button
              type="button"
              onClick={() => void submitForm()}
              disabled={createState.isLoading || updateState.isLoading}
            >
              {dialog === 'edit' ? 'Save Changes' : 'Create Product'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <ProductFormFields
          values={values}
          onChange={setField}
          categoryOptions={categoryOptions}
          locationOptions={locationOptions}
        />
      </Modal>
    </EntityListPage>
  );
}

/** Streamlit parity: product detail — full field dump plus edit modal. */
export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetInventoryProductQuery(id, { skip: !id });
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: false });
  const { data: locations = [] } = useListInventoryLocationsQuery({ active_only: false });
  const [updateProduct] = useUpdateInventoryProductMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
  const [formError, setFormError] = useState('');

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: String(c.id), name: String(c.name || c.id) })),
    [categories],
  );
  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: String(l.id), name: String(l.name || l.id) })),
    [locations],
  );

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p style={{ color: '#b00020' }}>Product not found.</p>;

  function setField(name: keyof ProductFormValues, value: string | boolean | string[]) {
    setValues((p) => ({ ...p, [name]: value }));
  }

  return (
    <div>
      <p>
        <Link to="/inventory/products">← Products</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>{String(data.name)}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setValues(productToForm(data));
              setEditOpen(true);
            }}
          >
            Edit
          </Button>
        </div>
      </div>
      <p style={{ color: '#567' }}>
        SKU: {String(data.sku)} · Qty on hand: {Number(data.current_qty ?? 0)} · Status: {String(data.stock_status || '—')}
        {data.is_active === false ? ' · Inactive' : ''}
      </p>
      <pre style={{ background: '#f5f5f5', padding: 12, overflow: 'auto', fontSize: 12, marginTop: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>

      <Modal
        title="Edit Product"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                try {
                  await updateProduct({ id, body: productBody(values) }).unwrap();
                  setEditOpen(false);
                  refetch();
                } catch (e: unknown) {
                  setFormError(extractError(e));
                }
              }}
            >
              Save Changes
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <ProductFormFields
          values={values}
          onChange={setField}
          categoryOptions={categoryOptions}
          locationOptions={locationOptions}
        />
      </Modal>
    </div>
  );
}
