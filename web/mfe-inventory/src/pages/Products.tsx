import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCan,
  useCreateCatalogProductMutation,
  useCreateCatalogSkuMutation,
  useCreateProductFieldDefinitionMutation,
  useDisposeCatalogStockMutation,
  useLazyGetCatalogProductQuery,
  useGetCatalogProductActivityQuery,
  useGetCatalogProductQuery,
  useGetCatalogProductSpecInsightsQuery,
  useListCatalogProductsQuery,
  useListInventoryCategoriesQuery,
  useListProductFieldDefinitionsQuery,
  useListInventoryLocationsQuery,
  useListInventoryUnitsQuery,
  useEnsureVendorMutation,
  useGetWorkingLocationQuery,
  useListVendorsQuery,
  useMergeCatalogProductsMutation,
  useResolveInventoryEntityQuery,
  useUpdateCatalogProductMutation,
} from '@vaybooks/store';
import {
  Button,
  ChipsMultiPicker,
  ConfirmDialog,
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
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
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
  pageCount,
  paginate,
  type EntityListColumn,
  type SearchableSelectOption,
} from '@vaybooks/ui-kit';
import { toCategoryOptions, toLocationOptions, toUnitOptions, resolveUnitId, unitCodeForId, withNoneOption } from '../pickerOptions';

type ProductDetailTab = 'overview' | 'skus' | 'spec' | 'activity';

type SupplierDraft = {
  vendor_id: string;
  vendor_sku: string;
  order_qty: string;
  minimum_order_qty: string;
  lead_time_days: string;
  is_preferred: boolean;
};

type SupplierPayloadRow = {
  vendor_id: string;
  vendor_sku: string;
  order_qty: number;
  minimum_order_qty: number;
  lead_time_days: number;
  is_preferred: boolean;
};

function blankSupplier(preferred = false): SupplierDraft {
  return {
    vendor_id: '',
    vendor_sku: '',
    order_qty: '',
    minimum_order_qty: '',
    lead_time_days: '',
    is_preferred: preferred,
  };
}

function qtyText(value: unknown): string {
  return value == null || value === '' ? '' : String(value);
}

type CatalogForm = {
  name: string;
  category_ids: string[];
  unit_id: string;
  hsn_sac: string;
  brand: string;
  suppliers: SupplierDraft[];
  is_active: boolean;
};

function emptyCatalogForm(): CatalogForm {
  return {
    name: '',
    category_ids: [],
    unit_id: '',
    hsn_sac: '',
    brand: '',
    suppliers: [],
    is_active: true,
  };
}

function suppliersFromProduct(raw: unknown): SupplierDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      vendor_id: String(row.vendor_id || ''),
      vendor_sku: String(row.vendor_sku || ''),
      order_qty: qtyText(row.order_qty),
      minimum_order_qty: qtyText(row.minimum_order_qty),
      lead_time_days: qtyText(row.lead_time_days),
      is_preferred: row.is_preferred === true,
    };
  });
}

function wholeQty(text: string, label: string): { error: string } | { value: number } {
  if (text === '') return { value: 0 };
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) return { error: `${label} must be a whole number` };
  return { value };
}

function supplierPayload(rows: SupplierDraft[]): { error: string } | { rows: SupplierPayloadRow[] } {
  const out: SupplierPayloadRow[] = [];
  const seen = new Set<string>();
  let preferred = 0;
  for (const row of rows) {
    const vendorId = row.vendor_id.trim();
    const vendorSku = row.vendor_sku.trim();
    const orderText = row.order_qty.trim();
    const minimumText = row.minimum_order_qty.trim();
    const leadText = row.lead_time_days.trim();
    if (!vendorId && !vendorSku && !orderText && !minimumText && !leadText && !row.is_preferred) continue;
    if (!vendorId) return { error: 'Each supplier needs a vendor' };
    if (seen.has(vendorId)) return { error: 'A vendor can only be added once' };
    const orderQty = wholeQty(orderText, 'Qty');
    if ('error' in orderQty) return orderQty;
    const minimumQty = wholeQty(minimumText, 'Minimum order qty');
    if ('error' in minimumQty) return minimumQty;
    const lead = wholeQty(leadText, 'Lead time');
    if ('error' in lead) return { error: 'Lead time must be a whole number of days' };
    if (row.is_preferred) preferred += 1;
    seen.add(vendorId);
    out.push({
      vendor_id: vendorId,
      vendor_sku: vendorSku,
      order_qty: orderQty.value,
      minimum_order_qty: minimumQty.value,
      lead_time_days: lead.value,
      is_preferred: row.is_preferred,
    });
  }
  if (preferred > 1) return { error: 'Only one supplier can be preferred' };
  return { rows: out };
}

function specificationsPayload(rows: SkuAttributeRow[]): { error: string } | { specs: Record<string, string> } {
  const specs: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key && !value) continue;
    if (!key || !value) return { error: 'Each specification needs a name and a value' };
    specs[key] = value;
  }
  return { specs };
}

type SkuAttributeRow = { key: string; value: string };

type AddSkuValues = {
  sku: string;
  name_override: string;
  attributes: SkuAttributeRow[];
  barcode: string;
  selling_rate: string;
  mrp: string;
  gst_rate: string;
  gst_required: boolean;
  opening_qty: string;
  location_id: string;
  track_batch: boolean;
  track_serial: boolean;
  is_active: boolean;
};

function emptyAddSkuValues(): AddSkuValues {
  return {
    sku: '',
    name_override: '',
    attributes: [],
    barcode: '',
    selling_rate: '0',
    mrp: '0',
    gst_rate: '0',
    gst_required: false,
    opening_qty: '0',
    location_id: '',
    track_batch: false,
    track_serial: false,
    is_active: true,
  };
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Save failed');
  }
  return 'Save failed';
}

function parseConflictFields(message: string): string[] {
  const match = /fields:\s*([^(]+)/i.exec(message);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Catalog products list (parents — no stock columns). */
export function ProductsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListCatalogProductsQuery({ active_only: false });
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: true });
  const { data: units = [] } = useListInventoryUnitsQuery({ active_only: true });
  const { data: definitionRows = [] } = useListProductFieldDefinitionsQuery({ active_only: true });
  const [createProduct, createState] = useCreateCatalogProductMutation();
  const [dialog, setDialog] = useState(false);
  const [values, setValues] = useState<CatalogForm>(emptyCatalogForm);
  const [specRows, setSpecRows] = useState<SkuAttributeRow[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string | boolean>>({});
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);

  const unitOptions = useMemo(
    () => toUnitOptions(units as Record<string, unknown>[]),
    [units],
  );
  const createDefinitions = useMemo(
    () =>
      asFieldDefinitions(definitionRows as Record<string, unknown>[]).filter((definition) =>
        fieldApplies(definition, values.category_ids),
      ),
    [definitionRows, values.category_ids],
  );

  function openCreate() {
    setValues({
      ...emptyCatalogForm(),
      unit_id: resolveUnitId(units as Record<string, unknown>[]),
    });
    setSpecRows([]);
    setCustomValues({});
    setFormError('');
    setDialog(true);
  }

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setValues({
        ...emptyCatalogForm(),
        unit_id: resolveUnitId(units as Record<string, unknown>[]),
      });
      setSpecRows([]);
      setCustomValues({});
      setFormError('');
      setDialog(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, units]);

  useEffect(() => {
    if (!dialog || values.unit_id || !(units as Record<string, unknown>[]).length) return;
    setValues((v) => ({
      ...v,
      unit_id: resolveUnitId(units as Record<string, unknown>[], { unit_id: v.unit_id }),
    }));
  }, [dialog, units, values.unit_id]);

  const columns: EntityListColumn<Record<string, unknown>>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Product',
        render: (row) => displayName(row, ['name'], 'Unnamed product'),
      },
      {
        id: 'skus',
        header: 'SKUs',
        render: (row) => Number(row.sku_count ?? 0),
      },
      {
        id: 'hsn',
        header: 'HSN',
        render: (row) => String(row.hsn_sac || '—'),
      },
      {
        id: 'unit',
        header: 'Unit',
        render: (row) => String(row.unit || row.unit_code || '—'),
      },
      {
        id: 'active',
        header: 'Active',
        render: (row) => (row.is_active === false ? 'No' : 'Yes'),
      },
    ],
    [],
  );

  const pages = pageCount(data.length, PAGE_SIZE);
  const rows = paginate(data, page, PAGE_SIZE);

  async function onCreate() {
    setFormError('');
    if (!values.name.trim()) {
      setFormError('Name is required');
      return;
    }
    const unitId =
      values.unit_id || resolveUnitId(units as Record<string, unknown>[]);
    if (!unitId) {
      setFormError('Select a unit');
      return;
    }
    const specs = specificationsPayload(specRows);
    if ('error' in specs) {
      setFormError(specs.error);
      return;
    }
    const fields = customFieldsPayload(createDefinitions, customValues);
    if ('error' in fields) {
      setFormError(fields.error);
      return;
    }
    const suppliers = supplierPayload(values.suppliers);
    if ('error' in suppliers) {
      setFormError(suppliers.error);
      return;
    }
    try {
      const created = await createProduct({
        name: values.name.trim(),
        category_ids: values.category_ids,
        unit_id: unitId,
        unit_code: unitCodeForId(units as Record<string, unknown>[], unitId),
        hsn_sac: values.hsn_sac,
        brand: values.brand.trim(),
        suppliers: suppliers.rows,
        specifications: specs.specs,
        custom_fields: fields.fields,
        is_active: values.is_active,
      }).unwrap();
      setDialog(false);
      navigate(`/inventory/products/${String(created.id)}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        title="Products"
        count={`${data.length} ${data.length === 1 ? 'product' : 'products'}`}
        actions={
          <Button type="button" onClick={openCreate}>
            Add product
          </Button>
        }
      />
      {isLoading ? <EntityListLoading>Loading products…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load products. Is the API running?</ErrorText> : null}
      {!isLoading && !error && data.length === 0 ? (
        <EntityListEmpty>
          <strong>No products found.</strong> Create a catalog product, then add SKUs under it.
        </EntityListEmpty>
      ) : null}
      {!isLoading && data.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          onActivateRow={(row) => navigate(`/inventory/products/${String(row.id)}`)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/inventory/products/${String(row.id)}`)} />
          )}
        />
      ) : null}
      <EntityListFoot>
        <PaginationBar page={page} pageCount={pages} onPage={setPage} />
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </EntityListFoot>

      <Modal open={dialog} wide onClose={() => setDialog(false)} title="Add product">
        <ModalForm
          onSubmit={(e) => {
            e.preventDefault();
            void onCreate();
          }}
        >
          <FormRow label="Name *">
            <TextInput
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Categories">
            <ChipsMultiPicker
              options={toCategoryOptions(categories as Record<string, unknown>[])}
              value={values.category_ids}
              onChange={(ids) => setValues((v) => ({ ...v, category_ids: ids }))}
            />
          </FormRow>
          <div className="ed-grid ed-grid-2">
            <FormRow label="Unit *">
              <SearchableSelect
                options={unitOptions}
                value={values.unit_id}
                placeholder="Select unit"
                onChange={(next) => setValues((v) => ({ ...v, unit_id: next }))}
              />
            </FormRow>
            <FormRow label="Brand">
              <TextInput
                value={values.brand}
                onChange={(e) => setValues((v) => ({ ...v, brand: e.target.value }))}
              />
            </FormRow>
            <FormRow label="HSN">
              <TextInput
                value={values.hsn_sac}
                onChange={(e) => setValues((v) => ({ ...v, hsn_sac: e.target.value }))}
              />
            </FormRow>
          </div>
          <SupplierEditor
            rows={values.suppliers}
            onChange={(suppliers) => setValues((v) => ({ ...v, suppliers }))}
          />
          <SpecificationRows rows={specRows} onChange={setSpecRows} />
          <CustomFieldSection
            definitions={createDefinitions}
            values={customValues}
            onChange={setCustomValues}
          />
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <ModalFormActions
            onCancel={() => setDialog(false)}
            submitLabel="Create product"
            busy={createState.isLoading}
          />
        </ModalForm>
      </Modal>
    </EntityListPage>
  );
}

function AttributeRowsEditor({
  rows,
  onChange,
}: {
  rows: SkuAttributeRow[];
  onChange: (next: SkuAttributeRow[]) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((row, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
          <TextInput
            placeholder="Attribute (e.g. Color)"
            value={row.key}
            onChange={(e) => {
              const next = [...rows];
              next[idx] = { ...row, key: e.target.value };
              onChange(next);
            }}
          />
          <TextInput
            placeholder="Value (e.g. Red)"
            value={row.value}
            onChange={(e) => {
              const next = [...rows];
              next[idx] = { ...row, value: e.target.value };
              onChange(next);
            }}
          />
          <Button type="button" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== idx))}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={() => onChange([...rows, { key: '', value: '' }])}>
        + Add attribute
      </Button>
    </div>
  );
}

type FieldDefinitionRow = {
  id: string;
  key: string;
  label: string;
  field_type: string;
  options: string[];
  required: boolean;
  applies_to_category_ids: string[];
  is_active: boolean;
};

function asFieldDefinitions(rows: Record<string, unknown>[]): FieldDefinitionRow[] {
  return rows.map((row) => ({
    id: String(row.id || ''),
    key: String(row.key || ''),
    label: String(row.label || row.key || 'Field'),
    field_type: String(row.field_type || 'text'),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    required: row.required === true,
    applies_to_category_ids: Array.isArray(row.applies_to_category_ids)
      ? row.applies_to_category_ids.map(String)
      : [],
    is_active: row.is_active !== false,
  }));
}

function fieldApplies(definition: FieldDefinitionRow, categoryIds: string[]): boolean {
  if (!definition.is_active) return false;
  if (definition.applies_to_category_ids.length === 0) return true;
  return definition.applies_to_category_ids.some((id) => categoryIds.includes(id));
}

function specDictToRows(value: unknown): SkuAttributeRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([key, raw]) => ({
    key,
    value: raw == null ? '' : String(raw),
  }));
}

const FIELD_TYPE_OPTIONS: SearchableSelectOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Boolean' },
];

function customFieldsPayload(
  definitions: FieldDefinitionRow[],
  values: Record<string, string | boolean>,
): { error: string } | { fields: Record<string, string | number | boolean> } {
  const fields: Record<string, string | number | boolean> = {};
  for (const definition of definitions) {
    const raw = values[definition.key];
    if (definition.field_type === 'boolean') {
      fields[definition.key] = raw === true;
      continue;
    }
    const text = raw == null ? '' : String(raw).trim();
    if (!text) continue;
    if (definition.field_type === 'number') {
      const amount = Number(text);
      if (!Number.isFinite(amount)) return { error: `${definition.label} must be a number` };
      fields[definition.key] = amount;
      continue;
    }
    fields[definition.key] = text;
  }
  return { fields };
}

function SpecificationRows({
  rows,
  onChange,
}: {
  rows: SkuAttributeRow[];
  onChange: (next: SkuAttributeRow[]) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 650 }}>Specifications</div>
        <Button type="button" variant="ghost" onClick={() => onChange([...rows, { key: '', value: '' }])}>
          + Add specification
        </Button>
      </div>
      <p className="ed-panel-note">Free-form details for this product, such as fabric or fit.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
            <TextInput
              aria-label="Specification name"
              placeholder="Name (e.g. Fabric)"
              value={row.key}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, key: e.target.value };
                onChange(next);
              }}
            />
            <TextInput
              aria-label="Specification value"
              placeholder="Value (e.g. Cotton)"
              value={row.value}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, value: e.target.value };
                onChange(next);
              }}
            />
            <Button type="button" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupplierEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: SupplierDraft[];
  onChange: (next: SupplierDraft[]) => void;
  disabled?: boolean;
}) {
  const { data: vendors = [], isLoading: vendorsLoading } = useListVendorsQuery();
  const { data: workingLoc } = useGetWorkingLocationQuery();
  const [ensureVendor] = useEnsureVendorMutation();
  const [knownVendors, setKnownVendors] = useState<{ id: string; name: string }[]>([]);
  const [supplierError, setSupplierError] = useState('');
  const options = useMemo(() => {
    const listed = (vendors as Record<string, unknown>[])
      .map((vendor) => ({
        value: String(vendor.id || ''),
        label: String(vendor.name || vendor.vendor_name || 'Vendor'),
        sublabel: String(vendor.phone_number || ''),
      }))
      .filter((option) => option.value);
    for (const vendor of knownVendors) {
      if (!listed.some((option) => option.value === vendor.id)) {
        listed.push({ value: vendor.id, label: vendor.name, sublabel: '' });
      }
    }
    return listed.sort((a, b) => a.label.localeCompare(b.label));
  }, [vendors, knownVendors]);
  const shown = rows.length > 0 ? rows : [blankSupplier()];

  async function createVendor(index: number, name: string) {
    setSupplierError('');
    const locationId = String(workingLoc?.working_location_id || '').trim();
    if (!locationId) {
      const message = 'Choose a working location before creating a vendor';
      setSupplierError(message);
      throw new Error(message);
    }
    try {
      const created = await ensureVendor({ vendor_name: name, location_ids: [locationId] }).unwrap();
      const id = String(created.id || '');
      const label = String(created.name || created.vendor_name || name);
      setKnownVendors((current) => (current.some((row) => row.id === id) ? current : [...current, { id, name: label }]));
      update(index, { vendor_id: id });
    } catch (e) {
      setSupplierError(extractError(e));
      throw e;
    }
  }

  function update(index: number, patch: Partial<SupplierDraft>) {
    const next = shown.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 650 }}>Suppliers</div>
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange([...rows, blankSupplier(rows.length === 0)])}
          >
            + Add supplier
          </Button>
        )}
      </div>
      <p className="ed-panel-note">
        Search suppliers, or type a name that is not there to add one. Qty is the amount you order. Minimum order qty is the smallest amount that supplier accepts.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {shown.map((row, index) => (
          <div key={index} style={{ display: 'grid', gap: 8 }}>
            <FormRow label="Supplier">
              <SearchableSelect
                options={options}
                value={row.vendor_id}
                placeholder={vendorsLoading ? 'Loading suppliers…' : 'Search suppliers'}
                disabled={disabled}
                onChange={(next) => update(index, { vendor_id: next })}
                onCreate={disabled ? undefined : (name) => createVendor(index, name)}
              />
            </FormRow>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              <FormRow label="Vendor item code">
                <TextInput
                  value={row.vendor_sku}
                  disabled={disabled}
                  onChange={(e) => update(index, { vendor_sku: e.target.value })}
                />
              </FormRow>
              <FormRow label="Qty">
                <TextInput
                  type="number"
                  min={0}
                  value={row.order_qty}
                  disabled={disabled}
                  onChange={(e) => update(index, { order_qty: e.target.value })}
                />
              </FormRow>
              <FormRow label="Minimum order qty">
                <TextInput
                  type="number"
                  min={0}
                  value={row.minimum_order_qty}
                  disabled={disabled}
                  onChange={(e) => update(index, { minimum_order_qty: e.target.value })}
                />
              </FormRow>
              <FormRow label="Lead time (days)">
                <TextInput
                  type="number"
                  min={0}
                  value={row.lead_time_days}
                  disabled={disabled}
                  onChange={(e) => update(index, { lead_time_days: e.target.value })}
                />
              </FormRow>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={row.is_preferred}
                  disabled={disabled}
                  onChange={(e) => {
                    const preferred = e.target.checked;
                    onChange(
                      shown.map((item, i) => ({
                        ...item,
                        is_preferred: i === index ? preferred : preferred ? false : item.is_preferred,
                      })),
                    );
                  }}
                />
                Preferred
              </label>
              {disabled || (rows.length === 0 && !row.vendor_id) ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {supplierError ? <ErrorText>{supplierError}</ErrorText> : null}
    </div>
  );
}

function CustomFieldSection({
  definitions,
  values,
  onChange,
}: {
  definitions: FieldDefinitionRow[];
  values: Record<string, string | boolean>;
  onChange: (next: Record<string, string | boolean>) => void;
}) {
  const [createField, createFieldState] = useCreateProductFieldDefinitionMutation();
  const [adding, setAdding] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);

  function openAddField() {
    setFieldError('');
    setNewLabel('');
    setNewType('text');
    setNewOptions('');
    setNewRequired(false);
    setAdding(true);
  }

  async function onAddField() {
    setFieldError('');
    const label = newLabel.trim();
    if (!label) {
      setFieldError('Custom field label is required');
      return;
    }
    const options = newOptions
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (newType === 'select' && options.length === 0) {
      setFieldError('A select field needs at least one option');
      return;
    }
    try {
      await createField({
        label,
        key: label,
        field_type: newType,
        options,
        required: newRequired,
      }).unwrap();
      setAdding(false);
    } catch (e) {
      setFieldError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 650 }}>Custom fields</div>
        <Button type="button" variant="ghost" onClick={openAddField}>
          + Add custom field
        </Button>
      </div>
      <p className="ed-panel-note">
        A custom field is defined once for the catalog. The value you enter here belongs to this product.
      </p>
      {definitions.length === 0 ? <p className="ed-panel-note">No custom fields defined yet.</p> : null}
      <div style={{ display: 'grid', gap: 10 }}>
        {definitions.map((definition) => (
          <FormRow
            key={definition.id || definition.key}
            label={definition.required ? `${definition.label} *` : definition.label}
          >
            {definition.field_type === 'boolean' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  aria-label={definition.label}
                  checked={values[definition.key] === true}
                  onChange={(e) => onChange({ ...values, [definition.key]: e.target.checked })}
                />
                {values[definition.key] === true ? 'Yes' : 'No'}
              </span>
            ) : definition.field_type === 'select' ? (
              <SearchableSelect
                options={[
                  ...(definition.required ? [] : [{ value: '', label: 'None' }]),
                  ...definition.options.map((option) => ({ value: option, label: option })),
                ]}
                value={String(values[definition.key] ?? '')}
                placeholder={definition.required ? 'Select…' : 'None'}
                onChange={(next) => onChange({ ...values, [definition.key]: next })}
              />
            ) : (
              <TextInput
                aria-label={definition.label}
                type={definition.field_type === 'number' ? 'number' : definition.field_type === 'date' ? 'date' : 'text'}
                value={String(values[definition.key] ?? '')}
                onChange={(e) => onChange({ ...values, [definition.key]: e.target.value })}
              />
            )}
          </FormRow>
        ))}
      </div>
      <Modal
        open={adding}
        compact
        zIndex={1100}
        title="Add custom field"
        onClose={() => {
          if (!createFieldState.isLoading) setAdding(false);
        }}
      >
        <ModalForm
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void onAddField();
          }}
        >
          <p className="ed-panel-note" style={{ marginTop: 0 }}>
            This field is shared across products. You set this product’s value after adding it.
          </p>
          <FormRow label="Label">
            <TextInput
              aria-label="Custom field label"
              placeholder="e.g. Season"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </FormRow>
          <FormRow label="Type">
            <SearchableSelect
              options={FIELD_TYPE_OPTIONS}
              value={newType}
              placeholder="Select type"
              onChange={setNewType}
            />
          </FormRow>
          {newType === 'select' ? (
            <FormRow label="Options">
              <TextInput
                aria-label="Custom field options"
                placeholder="Summer, Winter"
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
              />
            </FormRow>
          ) : null}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
            Required
          </label>
          {fieldError ? <ErrorText>{fieldError}</ErrorText> : null}
          <ModalFormActions
            onCancel={() => setAdding(false)}
            submitLabel="Add field"
            busyLabel="Adding…"
            busy={createFieldState.isLoading}
          />
        </ModalForm>
      </Modal>
    </div>
  );
}

function CatalogSpecEditor({ product }: { product: Record<string, unknown> }) {
  const productId = String(product.id || '');
  const categoryIds = Array.isArray(product.category_ids)
    ? (product.category_ids as unknown[]).map(String)
    : [];
  const specStamp = JSON.stringify(product.specifications || {});
  const fieldStamp = JSON.stringify(product.custom_fields || {});
  const { data: definitionRows = [] } = useListProductFieldDefinitionsQuery({ active_only: true });
  const [updateProduct, updateState] = useUpdateCatalogProductMutation();
  const [specRows, setSpecRows] = useState<SkuAttributeRow[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    setSpecRows(specDictToRows(product.specifications));
    const raw = product.custom_fields;
    const next: Record<string, string | boolean> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        next[key] = typeof value === 'boolean' ? value : value == null ? '' : String(value);
      }
    }
    setCustomValues(next);
  }, [productId, specStamp, fieldStamp, product.specifications, product.custom_fields]);

  useEffect(() => {
    setSavedNote('');
    setError('');
  }, [productId]);

  const definitions = useMemo(
    () =>
      asFieldDefinitions(definitionRows as Record<string, unknown>[]).filter((definition) =>
        fieldApplies(definition, categoryIds),
      ),
    [definitionRows, categoryIds],
  );

  async function onSave() {
    setError('');
    setSavedNote('');
    const specs = specificationsPayload(specRows);
    if ('error' in specs) {
      setError(specs.error);
      return;
    }
    const fields = customFieldsPayload(definitions, customValues);
    if ('error' in fields) {
      setError(fields.error);
      return;
    }
    try {
      await updateProduct({
        id: productId,
        body: {
          name: String(product.name || '').trim(),
          category_ids: categoryIds,
          unit_id: String(product.unit_id || ''),
          unit_code: String(product.unit || product.unit_code || 'pcs'),
          hsn_sac: String(product.hsn_sac || ''),
          is_active: product.is_active !== false,
          specifications: specs.specs,
          custom_fields: fields.fields,
        },
      }).unwrap();
      setSavedNote('Specifications and custom fields saved.');
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <SpecificationRows
        rows={specRows}
        onChange={(next) => {
          setSpecRows(next);
          setSavedNote('');
        }}
      />
      <CustomFieldSection
        definitions={definitions}
        values={customValues}
        onChange={(next) => {
          setCustomValues(next);
          setSavedNote('');
        }}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {savedNote ? <p className="ed-panel-note">{savedNote}</p> : null}
      <div>
        <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
          {updateState.isLoading ? 'Saving…' : 'Save specifications'}
        </Button>
      </div>
    </div>
  );
}

/** Product 360 — catalog parent with SKUs + insights tabs. */
export function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCan();

  const canView = can('inventory.products.view');
  const canEdit = can('inventory.products.edit');
  const canCreateSku = can('inventory.skus.create') || can('inventory.products.create');
  const canMerge = can('inventory.products.edit');

  const { data, isLoading, error, refetch } = useGetCatalogProductQuery(id, { skip: !id || !canView });
  const { data: resolved } = useResolveInventoryEntityQuery(id, {
    skip: !id || !canView || !!data || isLoading,
  });
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: false });
  const { data: units = [] } = useListInventoryUnitsQuery({ active_only: true });
  const { data: locations = [] } = useListInventoryLocationsQuery({ active_only: true }, { skip: !canCreateSku });
  const { data: otherProducts = [] } = useListCatalogProductsQuery({ active_only: false }, { skip: !canMerge });
  const [updateProduct, updateState] = useUpdateCatalogProductMutation();
  const [createSku, createSkuState] = useCreateCatalogSkuMutation();
  const [mergeProducts, mergeState] = useMergeCatalogProductsMutation();
  const [disposeStock, disposeState] = useDisposeCatalogStockMutation();
  const [loadCatalog] = useLazyGetCatalogProductQuery();
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    run: () => Promise<void>;
  } | null>(null);

  const [values, setValues] = useState<CatalogForm>(emptyCatalogForm);
  const [formError, setFormError] = useState('');

  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const [skuValues, setSkuValues] = useState<AddSkuValues>(emptyAddSkuValues);
  const [skuError, setSkuError] = useState('');

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeForce, setMergeForce] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeConflicts, setMergeConflicts] = useState<string[]>([]);

  const unitOptions = useMemo(
    () => toUnitOptions(units as Record<string, unknown>[]),
    [units],
  );

  const tabs = useMemo(() => {
    const all: { id: ProductDetailTab; label: string; show: boolean }[] = [
      { id: 'overview', label: 'Overview', show: canView },
      { id: 'skus', label: 'SKUs', show: canView },
      { id: 'spec', label: 'Spec insights', show: canView },
      { id: 'activity', label: 'Activity', show: canView },
    ];
    return all.filter((t) => t.show);
  }, [canView]);

  const requestedTab = (searchParams.get('tab') || '') as ProductDetailTab;
  const tab: ProductDetailTab | '' = tabs.some((t) => t.id === requestedTab)
    ? requestedTab
    : tabs[0]?.id || '';

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((t) => t.id === requestedTab)) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tabs[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [tabs, requestedTab, searchParams, setSearchParams]);

  const { data: specInsights, isLoading: specLoading } = useGetCatalogProductSpecInsightsQuery(id, {
    skip: !id || !canView || tab !== 'spec',
  });
  const { data: activity, isLoading: activityLoading } = useGetCatalogProductActivityQuery(
    { id, limit: 50 },
    { skip: !id || !canView || tab !== 'activity' },
  );

  useEffect(() => {
    if (resolved?.is_sku && !resolved?.is_catalog_product) {
      navigate(`/inventory/skus/${id}`, { replace: true });
    }
  }, [resolved, id, navigate]);

  useEffect(() => {
    if (!data) return;
    setValues({
      name: String(data.name || ''),
      category_ids: Array.isArray(data.category_ids)
        ? (data.category_ids as unknown[]).map(String)
        : [],
      unit_id: resolveUnitId(units as Record<string, unknown>[], {
        unit_id: String(data.unit_id || ''),
        unit_code: String(data.unit || data.unit_code || ''),
        unit: String(data.unit || ''),
      }),
      hsn_sac: String(data.hsn_sac || ''),
      brand: String(data.brand || ''),
      suppliers: suppliersFromProduct(data.suppliers),
      is_active: data.is_active !== false,
    });
  }, [data, units]);

  const skus = useMemo(
    () => (Array.isArray(data?.skus) ? (data.skus as Record<string, unknown>[]) : []),
    [data],
  );
  const title = String(data?.name || 'Product');

  const specRows = useMemo(
    () =>
      Array.isArray((specInsights as { specifications?: unknown[] } | undefined)?.specifications)
        ? ((specInsights as { specifications: Record<string, unknown>[] }).specifications || [])
        : [],
    [specInsights],
  );
  const customFieldRows = useMemo(
    () =>
      Array.isArray((specInsights as { custom_fields?: unknown[] } | undefined)?.custom_fields)
        ? ((specInsights as { custom_fields: Record<string, unknown>[] }).custom_fields || [])
        : [],
    [specInsights],
  );
  const attributeRows = useMemo(
    () =>
      Array.isArray((specInsights as { attributes?: unknown[] } | undefined)?.attributes)
        ? ((specInsights as { attributes: Record<string, unknown>[] }).attributes || [])
        : [],
    [specInsights],
  );
  const specTotals = ((specInsights as { totals?: Record<string, unknown> } | undefined)?.totals || {}) as Record<
    string,
    unknown
  >;

  const activityEvents = useMemo(
    () =>
      Array.isArray((activity as { events?: unknown[] } | undefined)?.events)
        ? ((activity as { events: Record<string, unknown>[] }).events || [])
        : [],
    [activity],
  );

  const locationOptions: SearchableSelectOption[] = useMemo(
    () => toLocationOptions(locations as Record<string, unknown>[]),
    [locations],
  );

  const mergeOptions: SearchableSelectOption[] = useMemo(
    () =>
      (otherProducts as Record<string, unknown>[])
        .filter((p) => String(p.id) !== id)
        .map((p) => ({
          value: String(p.id),
          label: String(p.name || 'Product'),
          sublabel: `${Number(p.sku_count ?? 0)} SKUs${p.hsn_sac ? ` · HSN ${String(p.hsn_sac)}` : ''}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [otherProducts, id],
  );
  const filteredMergeOptions = useMemo(() => {
    const q = mergeSearch.trim().toLowerCase();
    if (!q) return mergeOptions;
    return mergeOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [mergeOptions, mergeSearch]);
  const selectedMergeSet = useMemo(() => new Set(mergeSourceIds), [mergeSourceIds]);

  function toggleMergeSource(pid: string) {
    setMergeSourceIds((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));
  }

  function openMerge() {
    setMergeError('');
    setMergeConflicts([]);
    setMergeSourceIds([]);
    setMergeSearch('');
    setMergeForce(false);
    setMergeOpen(true);
  }

  function openAddSku() {
    setSkuError('');
    setSkuValues(emptyAddSkuValues());
    setAddSkuOpen(true);
  }

  async function persistCatalog() {
    const suppliers = supplierPayload(values.suppliers);
    if ('error' in suppliers) {
      setFormError(suppliers.error);
      throw { data: { detail: suppliers.error } };
    }
    const unitId =
      values.unit_id ||
      resolveUnitId(units as Record<string, unknown>[], {
        unit_id: String(data?.unit_id || ''),
        unit: String(data?.unit || ''),
      });
    await updateProduct({
      id,
      body: {
        name: values.name.trim(),
        category_ids: values.category_ids,
        unit_id: unitId,
        unit_code: unitCodeForId(units as Record<string, unknown>[], unitId),
        hsn_sac: values.hsn_sac,
        brand: values.brand.trim(),
        suppliers: suppliers.rows,
        is_active: values.is_active,
      },
    }).unwrap();
    refetch();
  }

  async function onSave() {
    setFormError('');
    if (!values.name.trim()) {
      setFormError('Name is required');
      return;
    }
    const unitId =
      values.unit_id ||
      resolveUnitId(units as Record<string, unknown>[], {
        unit_id: String(data?.unit_id || ''),
        unit: String(data?.unit || ''),
      });
    if (!unitId) {
      setFormError('Select a unit');
      return;
    }
    const wasActive = data?.is_active !== false;
    if (wasActive && !values.is_active) {
      const lines = skus
        .filter((row) => row.is_active !== false)
        .map((row) => `${String(row.sku || row.name || 'SKU')} (${Number(row.current_qty ?? 0)})`)
        .join('; ');
      setConfirm({
        title: 'Deactivate product',
        message: `Stock stays on hand. These SKUs will be marked inactive: ${lines || 'none'}. Use Dispose stock when you want the quantity removed.`,
        confirmLabel: 'Deactivate',
        danger: true,
        run: persistCatalog,
      });
      return;
    }
    if (!wasActive && values.is_active) {
      const restored = skus.filter((row) => String(row.inactive_via_catalog_id || '') === id);
      if (restored.length > 0) {
        const lines = restored.map((row) => String(row.sku || row.name || 'SKU')).join('; ');
        setConfirm({
          title: 'Reactivate product',
          message: `These SKUs will become active again: ${lines}. SKUs you deactivated directly stay inactive. Stock is unchanged.`,
          confirmLabel: 'Reactivate',
          run: persistCatalog,
        });
        return;
      }
    }
    try {
      await persistCatalog();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  function askDispose() {
    const lines = skus
      .filter((row) => Number(row.current_qty ?? 0) > 0)
      .map((row) => `${String(row.sku || row.name || 'SKU')} ${Number(row.current_qty ?? 0)}`)
      .join('; ');
    setConfirm({
      title: 'Dispose stock',
      message: `This writes an Adjust Out for the on-hand quantity and leaves the product active. ${lines}.`,
      confirmLabel: 'Dispose stock',
      danger: true,
      run: async () => {
        await disposeStock(id).unwrap();
        refetch();
      },
    });
  }

  async function submitAddSku() {
    setSkuError('');
    if (!skuValues.sku.trim()) {
      setSkuError('SKU code is required');
      return;
    }
    const opening = Number(skuValues.opening_qty) || 0;
    if (opening > 0 && !skuValues.location_id) {
      setSkuError('Location is required for opening stock');
      return;
    }
    const attributes: Record<string, string> = {};
    for (const row of skuValues.attributes) {
      const k = row.key.trim();
      if (k && row.value.trim()) attributes[k] = row.value.trim();
    }
    try {
      await createSku({
        catalogProductId: id,
        body: {
          sku: skuValues.sku.trim(),
          name_override: skuValues.name_override.trim(),
          attributes,
          barcode: skuValues.barcode.trim(),
          selling_rate: Number(skuValues.selling_rate) || 0,
          mrp: Number(skuValues.mrp) || 0,
          gst_rate: Number(skuValues.gst_rate) || 0,
          gst_required: skuValues.gst_required,
          opening_qty: opening,
          location_id: skuValues.location_id,
          track_batch: skuValues.track_batch,
          track_serial: skuValues.track_serial,
          is_active: skuValues.is_active,
        },
      }).unwrap();
      setAddSkuOpen(false);
      refetch();
    } catch (e) {
      setSkuError(extractError(e));
    }
  }

  async function runMerge() {
    await mergeProducts({
      target_catalog_product_id: id,
      source_catalog_product_ids: mergeSourceIds,
      force: mergeForce,
    }).unwrap();
    setMergeOpen(false);
    setMergeSourceIds([]);
    setMergeForce(false);
    setMergeConflicts([]);
    refetch();
  }

  async function submitMerge() {
    setMergeError('');
    if (!id || mergeSourceIds.length === 0) return;
    try {
      const parts: string[] = [];
      for (const sourceId of mergeSourceIds) {
        const row = await loadCatalog(sourceId).unwrap();
        const children = Array.isArray(row.skus) ? (row.skus as Record<string, unknown>[]) : [];
        const lines = children.map(
          (sku) => `${String(sku.sku || sku.name || 'SKU')} qty ${Number(sku.current_qty ?? 0)}`,
        );
        parts.push(`${String(row.name || 'Product')}: ${lines.join(', ') || 'no SKUs'}`);
      }
      setConfirm({
        title: 'Merge products',
        message: `${parts.join('; ')}. Stock and SKU ids stay. Categories, unit, and HSN become this product's values where this product has them. The other products stay in the catalog as inactive.`,
        confirmLabel: 'Merge',
        danger: true,
        run: runMerge,
      });
    } catch (e) {
      const msg = extractError(e);
      setMergeError(msg);
      setMergeConflicts(parseConflictFields(msg));
    }
  }

  if (!canView) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/products" label="Products" />
        <EntityListEmpty>
          <strong>You do not have permission to open this product.</strong>
        </EntityListEmpty>
      </EntityDetailPage>
    );
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading product…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  if (error && !resolved?.is_sku) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/products" label="Products" />
        <ErrorText>Product not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  if (!data) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Resolving…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/inventory/products" label="Products" />
      <EntityDetailHero
        kicker="Inventory · Product"
        title={title}
        lead="Catalog product — stock and transactions live on SKUs"
        actions={
          canMerge ? (
            <Button type="button" variant="ghost" onClick={openMerge}>
              Merge products
            </Button>
          ) : null
        }
      />
      <EntityDetailSnapshot
        ariaLabel="Product facts"
        items={[
          { label: 'SKUs', value: String(data.sku_count ?? skus.length) },
          { label: 'Brand', value: String(data.brand || '—') },
          { label: 'HSN', value: String(data.hsn_sac || '—') },
          {
            label: 'Status',
            value: (
              <span className={data.is_active === false ? 'ed-pill is-off' : 'ed-pill is-on'}>
                {data.is_active === false ? 'Inactive' : 'Active'}
              </span>
            ),
          },
        ]}
      />
      <EntityDetailTabs
        ariaLabel="Product 360"
        value={tab}
        onChange={(next) => {
          const params = new URLSearchParams(searchParams);
          params.set('tab', next);
          setSearchParams(params, { replace: true });
        }}
        options={tabs.map((t) => ({ id: t.id, label: t.label }))}
      />

      {tab === 'overview' ? (
        <EntityDetailPanel title="Overview" note="Catalog identity only — stock is tagged to each SKU, not this product.">
          <EntityDetailForm>
            <FormRow label="Name *">
              <TextInput
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                disabled={!canEdit}
              />
            </FormRow>
            <FormRow label="Categories">
              <ChipsMultiPicker
                options={toCategoryOptions(categories as Record<string, unknown>[])}
                value={values.category_ids}
                onChange={(ids) => setValues((v) => ({ ...v, category_ids: ids }))}
                disabled={!canEdit}
              />
            </FormRow>
            <div className="ed-grid ed-grid-2">
              <FormRow label="Unit *">
                <SearchableSelect
                  options={unitOptions}
                  value={values.unit_id}
                  placeholder="Select unit"
                  onChange={(next) => setValues((v) => ({ ...v, unit_id: next }))}
                  disabled={!canEdit}
                />
              </FormRow>
              <FormRow label="Brand">
                <TextInput
                  value={values.brand}
                  onChange={(e) => setValues((v) => ({ ...v, brand: e.target.value }))}
                  disabled={!canEdit}
                />
              </FormRow>
              <FormRow label="HSN">
                <TextInput
                  value={values.hsn_sac}
                  onChange={(e) => setValues((v) => ({ ...v, hsn_sac: e.target.value }))}
                  disabled={!canEdit}
                />
              </FormRow>
              <FormRow label="SKU count (read-only)">
                <TextInput value={String(data.sku_count ?? skus.length)} readOnly disabled />
              </FormRow>
              {canEdit ? (
                <FormRow label="Active">
                  <span className="ed-switch">
                    <input
                      type="checkbox"
                      checked={values.is_active}
                      aria-label="Active"
                      onChange={(e) => setValues((v) => ({ ...v, is_active: e.target.checked }))}
                    />
                    <span className="ed-switch-track" aria-hidden="true" />
                    <span className="ed-switch-note">
                      {values.is_active
                        ? 'Shown in the catalog. Stock stays on hand.'
                        : 'Marked inactive. Stock stays on hand.'}
                    </span>
                  </span>
                </FormRow>
              ) : (
                <FormRow label="Active">
                  <TextInput value={data.is_active === false ? 'Inactive' : 'Active'} readOnly disabled />
                </FormRow>
              )}
            </div>
            <SupplierEditor
              rows={values.suppliers}
              disabled={!canEdit}
              onChange={(suppliers) => setValues((v) => ({ ...v, suppliers }))}
            />
            {formError ? <ErrorText>{formError}</ErrorText> : null}
          </EntityDetailForm>
          {canEdit ? (
            <EntityDetailStickyActions>
              {skus.some((row) => Number(row.current_qty ?? 0) > 0) ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={askDispose}
                  disabled={disposeState.isLoading}
                >
                  {disposeState.isLoading ? 'Disposing…' : 'Dispose stock'}
                </Button>
              ) : null}
              <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
                {updateState.isLoading ? 'Saving…' : 'Save'}
              </Button>
            </EntityDetailStickyActions>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      {tab === 'skus' ? (
        <EntityDetailPanel
          title="SKUs"
          note="Purchasable/sellable variants under this catalog product."
          headerEnd={
            canCreateSku ? (
              <Button type="button" onClick={openAddSku}>
                Add SKU
              </Button>
            ) : null
          }
        >
          {skus.length === 0 ? (
            <EntityListEmpty>
              <strong>No SKUs yet.</strong> Add a SKU to start selling and stocking this product.
            </EntityListEmpty>
          ) : (
            <EntityListTable
              columns={[
                { id: 'sku', header: 'SKU', render: (row) => String(row.sku || '') },
                { id: 'name', header: 'Name', render: (row) => String(row.name || '') },
                {
                  id: 'rate',
                  header: 'Rate',
                  render: (row) => String(row.selling_rate ?? row.active_selling_rate ?? 0),
                },
                { id: 'qty', header: 'On hand', render: (row) => String(row.current_qty ?? 0) },
                {
                  id: 'active',
                  header: 'Status',
                  render: (row) => (row.is_active === false ? 'Inactive' : 'Active'),
                },
              ]}
              rows={skus}
              rowKey={(row) => String(row.id)}
              onActivateRow={(row) => navigate(`/inventory/skus/${String(row.id)}`)}
              actions={(row) => (
                <EntityListActions onOpen={() => navigate(`/inventory/skus/${String(row.id)}`)} />
              )}
            />
          )}
        </EntityDetailPanel>
      ) : null}

      {tab === 'spec' ? (
        <>
          <EntityDetailPanel
            title="Specifications & custom fields"
            note="Parent-level values shared across all SKUs."
          >
            {canEdit ? <CatalogSpecEditor product={data} /> : null}
            {!canEdit && specLoading ? <EntityListLoading>Loading spec insights…</EntityListLoading> : null}
            {!canEdit && !specLoading ? (
              <div className="ed-grid ed-grid-2">
                <div>
                  <div style={{ fontWeight: 650, marginBottom: 8 }}>Specifications</div>
                  {specRows.length === 0 ? (
                    <p className="ed-panel-note">No specifications set.</p>
                  ) : (
                    <table className="bp-table">
                      <thead>
                        <tr>
                          <th align="left">Key</th>
                          <th align="left">Value</th>
                          <th align="right">SKUs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {specRows.map((row, i) => (
                          <tr key={`${String(row.key)}-${i}`}>
                            <td>{String(row.key || '—')}</td>
                            <td>{String(row.value || '—')}</td>
                            <td align="right">{Number(row.sku_count ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 650, marginBottom: 8 }}>Custom fields</div>
                  {customFieldRows.length === 0 ? (
                    <p className="ed-panel-note">No custom fields set.</p>
                  ) : (
                    <table className="bp-table">
                      <thead>
                        <tr>
                          <th align="left">Key</th>
                          <th align="left">Value</th>
                          <th align="right">SKUs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customFieldRows.map((row, i) => (
                          <tr key={`${String(row.key)}-${i}`}>
                            <td>{String(row.key || '—')}</td>
                            <td>{String(row.value || '—')}</td>
                            <td align="right">{Number(row.sku_count ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
          </EntityDetailPanel>
          <EntityDetailPanel
            title="Attributes by SKU"
            note={`${attributeRows.length} attribute values across ${Number(specTotals.sku_count ?? 0)} SKUs · On hand Σ ${Number(specTotals.on_hand ?? 0)}`}
          >
            {specLoading ? <EntityListLoading>Loading attributes…</EntityListLoading> : null}
            {!specLoading && attributeRows.length === 0 ? (
              <EntityListEmpty>
                <strong>No SKU attributes recorded.</strong>
              </EntityListEmpty>
            ) : null}
            {!specLoading && attributeRows.length > 0 ? (
              <table className="bp-table">
                <thead>
                  <tr>
                    <th align="left">Attribute</th>
                    <th align="left">Value</th>
                    <th align="left">SKU</th>
                    <th align="right">On hand</th>
                    <th align="right">Sales qty</th>
                  </tr>
                </thead>
                <tbody>
                  {attributeRows.map((row, i) => (
                    <tr key={`${String(row.sku_id)}-${String(row.key)}-${i}`}>
                      <td>{String(row.key || '—')}</td>
                      <td>{String(row.value || '—')}</td>
                      <td>
                        <button
                          type="button"
                          className="ed-inline-link"
                          onClick={() => navigate(`/inventory/skus/${String(row.sku_id)}`)}
                        >
                          {String(row.sku || row.sku_id || '—')}
                        </button>
                      </td>
                      <td align="right">{Number(row.on_hand ?? 0)}</td>
                      <td align="right">{Number(row.sales_qty ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </EntityDetailPanel>
        </>
      ) : null}

      {tab === 'activity' ? (
        <EntityDetailPanel title="Activity" note="Recent stock movements across all SKUs under this product.">
          {activityLoading ? <EntityListLoading>Loading activity…</EntityListLoading> : null}
          {!activityLoading && activityEvents.length === 0 ? (
            <EntityListEmpty>
              <strong>No recent activity.</strong>
            </EntityListEmpty>
          ) : null}
          {!activityLoading && activityEvents.length > 0 ? (
            <table className="bp-table">
              <thead>
                <tr>
                  <th align="left">Date</th>
                  <th align="left">SKU</th>
                  <th align="left">Event</th>
                </tr>
              </thead>
              <tbody>
                {activityEvents.map((e, i) => (
                  <tr key={String(e.ref || `${e.sku_id}-${i}`)}>
                    <td>{String(e.date || '—')}</td>
                    <td>
                      <button
                        type="button"
                        className="ed-inline-link"
                        onClick={() => navigate(`/inventory/skus/${String(e.sku_id)}`)}
                      >
                        {String(e.sku || e.sku_id || '—')}
                      </button>
                    </td>
                    <td>{String(e.label || e.type || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      <Modal title="Add SKU" open={addSkuOpen} onClose={() => setAddSkuOpen(false)}>
        <ModalForm
          onSubmit={(e) => {
            e.preventDefault();
            void submitAddSku();
          }}
        >
          {skuError ? <ErrorText>{skuError}</ErrorText> : null}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormRow label="SKU code *">
                <TextInput
                  value={skuValues.sku}
                  onChange={(e) => setSkuValues((v) => ({ ...v, sku: e.target.value }))}
                  required
                />
              </FormRow>
              <FormRow label="Name override">
                <TextInput
                  placeholder={title}
                  value={skuValues.name_override}
                  onChange={(e) => setSkuValues((v) => ({ ...v, name_override: e.target.value }))}
                />
              </FormRow>
            </div>
            <FormRow label="Attributes">
              <AttributeRowsEditor
                rows={skuValues.attributes}
                onChange={(next) => setSkuValues((v) => ({ ...v, attributes: next }))}
              />
            </FormRow>
            <FormRow label="Barcode">
              <TextInput
                value={skuValues.barcode}
                onChange={(e) => setSkuValues((v) => ({ ...v, barcode: e.target.value }))}
              />
            </FormRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <FormRow label="Selling rate">
                <TextInput
                  type="number"
                  value={skuValues.selling_rate}
                  onChange={(e) => setSkuValues((v) => ({ ...v, selling_rate: e.target.value }))}
                />
              </FormRow>
              <FormRow label="MRP">
                <TextInput
                  type="number"
                  value={skuValues.mrp}
                  onChange={(e) => setSkuValues((v) => ({ ...v, mrp: e.target.value }))}
                />
              </FormRow>
              <FormRow label="GST rate %">
                <TextInput
                  type="number"
                  value={skuValues.gst_rate}
                  onChange={(e) => setSkuValues((v) => ({ ...v, gst_rate: e.target.value }))}
                />
              </FormRow>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormRow label="Opening qty">
                <TextInput
                  type="number"
                  value={skuValues.opening_qty}
                  onChange={(e) => setSkuValues((v) => ({ ...v, opening_qty: e.target.value }))}
                />
              </FormRow>
              <FormRow label="Opening location">
                <SearchableSelect
                  options={withNoneOption(locationOptions, '— Select location —')}
                  value={skuValues.location_id}
                  placeholder="Select location"
                  onChange={(next) => setSkuValues((v) => ({ ...v, location_id: next }))}
                />
              </FormRow>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <label>
                <input
                  type="checkbox"
                  checked={skuValues.gst_required}
                  onChange={(e) => setSkuValues((v) => ({ ...v, gst_required: e.target.checked }))}
                />{' '}
                GST required
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={skuValues.track_batch}
                  onChange={(e) => setSkuValues((v) => ({ ...v, track_batch: e.target.checked }))}
                />{' '}
                Track batch
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={skuValues.track_serial}
                  onChange={(e) => setSkuValues((v) => ({ ...v, track_serial: e.target.checked }))}
                />{' '}
                Track serial
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={skuValues.is_active}
                  onChange={(e) => setSkuValues((v) => ({ ...v, is_active: e.target.checked }))}
                />{' '}
                Active
              </label>
            </div>
          </div>
          <ModalFormActions
            busy={createSkuState.isLoading}
            submitLabel="Create SKU"
            busyLabel="Creating…"
            onCancel={() => setAddSkuOpen(false)}
          />
        </ModalForm>
      </Modal>

      <Modal title="Merge products into this one" open={mergeOpen} onClose={() => setMergeOpen(false)}>
        <ModalForm
          onSubmit={(e) => {
            e.preventDefault();
            void submitMerge();
          }}
        >
          <p style={{ marginTop: 0, fontSize: 13, color: '#5c736a' }}>
            SKUs move under <strong>{title}</strong>. Stock and SKU ids stay. Categories, unit, and
            HSN become this product's values where this product has them. The other products stay in
            the catalog as inactive.
          </p>
          {mergeError ? <ErrorText>{mergeError}</ErrorText> : null}
          {mergeConflicts.length > 0 ? (
            <div
              style={{
                background: '#fff7e6',
                border: '1px solid #f0c36d',
                borderRadius: 8,
                padding: '0.6rem 0.75rem',
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              <strong>Conflicting fields:</strong> {mergeConflicts.join(', ')}
              <label style={{ display: 'block', marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={mergeForce}
                  onChange={(e) => setMergeForce(e.target.checked)}
                />{' '}
                Force merge and keep this product's values for conflicting fields
              </label>
            </div>
          ) : null}
          <FormRow label="Products to merge in">
            <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <input
                type="search"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="Search by name…"
                aria-label="Search products to merge"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.45rem 0.6rem',
                  borderRadius: 6,
                  border: '1px solid #c5d4ce',
                }}
              />
              {mergeSourceIds.length > 0 ? (
                <div style={{ fontSize: 13, color: '#5c736a' }}>
                  {mergeSourceIds.length} selected
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setMergeSourceIds([])}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#1f6b57',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              <div
                role="listbox"
                aria-multiselectable
                aria-label="Products to merge"
                style={{
                  maxHeight: 280,
                  overflow: 'auto',
                  border: '1px solid #c5d4ce',
                  borderRadius: 8,
                  padding: 6,
                  background: '#fff',
                  minWidth: 0,
                }}
              >
                {mergeOptions.length === 0 ? (
                  <div style={{ padding: '0.6rem 0.45rem', fontSize: 13, color: '#667' }}>
                    No other products to merge.
                  </div>
                ) : null}
                {mergeOptions.length > 0 && filteredMergeOptions.length === 0 ? (
                  <div style={{ padding: '0.6rem 0.45rem', fontSize: 13, color: '#667' }}>
                    No products match your search.
                  </div>
                ) : null}
                {filteredMergeOptions.map((opt) => {
                  const checked = selectedMergeSet.has(opt.value);
                  return (
                    <label
                      key={opt.value}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                        gap: 8,
                        alignItems: 'start',
                        padding: '0.4rem 0.45rem',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: checked ? '#eef6f2' : 'transparent',
                        minWidth: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMergeSource(opt.value)}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 13,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={opt.label}
                        >
                          {opt.label}
                        </span>
                        {opt.sublabel ? (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 12,
                              color: '#667',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={opt.sublabel}
                          >
                            {opt.sublabel}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </FormRow>
          <ModalFormActions
            busy={mergeState.isLoading}
            submitLabel={
              mergeSourceIds.length > 1 ? `Merge ${mergeSourceIds.length} products` : 'Merge product'
            }
            busyLabel="Merging…"
            onCancel={() => setMergeOpen(false)}
            submitDisabled={mergeSourceIds.length === 0}
          />
        </ModalForm>
      </Modal>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        danger={Boolean(confirm?.danger)}
        busy={updateState.isLoading || disposeState.isLoading || mergeState.isLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const run = confirm?.run;
          if (!run) return;
          void run()
            .then(() => setConfirm(null))
            .catch((e: unknown) => {
              const msg = extractError(e);
              if (confirm?.title === 'Merge products') {
                setMergeError(msg);
                setMergeConflicts(parseConflictFields(msg));
              } else {
                setFormError(msg);
              }
              setConfirm(null);
            });
        }}
      />
    </EntityDetailPage>
  );
}
