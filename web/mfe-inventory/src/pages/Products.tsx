import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCan,
  useCreateCatalogProductMutation,
  useCreateCatalogSkuMutation,
  useGetCatalogProductActivityQuery,
  useGetCatalogProductCustomizationBreakdownQuery,
  useGetCatalogProductPurchaseBreakdownQuery,
  useGetCatalogProductProductionBreakdownQuery,
  useGetCatalogProductQuery,
  useGetCatalogProductSalesBreakdownQuery,
  useGetCatalogProductSpecInsightsQuery,
  useListCatalogProductsQuery,
  useListInventoryCategoriesQuery,
  useListInventoryLocationsQuery,
  useListInventoryUnitsQuery,
  useMergeCatalogProductsMutation,
  useResolveInventoryEntityQuery,
  useUpdateCatalogProductMutation,
} from '@vaybooks/store';
import {
  Button,
  ChipsMultiPicker,
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
import { BreakdownPanel, useBreakdownRange } from '../components/BreakdownPanel';
import { toCategoryOptions, toLocationOptions, toUnitOptions, resolveUnitId, unitCodeForId, withNoneOption } from '../pickerOptions';

type ProductDetailTab =
  | 'overview'
  | 'skus'
  | 'spec'
  | 'sales'
  | 'purchase'
  | 'production'
  | 'customization'
  | 'activity';

type CatalogForm = {
  name: string;
  category_ids: string[];
  unit_id: string;
  hsn_sac: string;
  is_active: boolean;
};

function emptyCatalogForm(): CatalogForm {
  return {
    name: '',
    category_ids: [],
    unit_id: '',
    hsn_sac: '',
    is_active: true,
  };
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
  const [createProduct, createState] = useCreateCatalogProductMutation();
  const [dialog, setDialog] = useState(false);
  const [values, setValues] = useState<CatalogForm>(emptyCatalogForm);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);

  const unitOptions = useMemo(
    () => toUnitOptions(units as Record<string, unknown>[]),
    [units],
  );

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setValues({
        ...emptyCatalogForm(),
        unit_id: resolveUnitId(units as Record<string, unknown>[]),
      });
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
    try {
      const created = await createProduct({
        name: values.name.trim(),
        category_ids: values.category_ids,
        unit_id: unitId,
        unit_code: unitCodeForId(units as Record<string, unknown>[], unitId),
        hsn_sac: values.hsn_sac,
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
          <Button
            type="button"
            onClick={() => {
              setValues({
                ...emptyCatalogForm(),
                unit_id: resolveUnitId(units as Record<string, unknown>[]),
              });
              setDialog(true);
            }}
          >
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

      <Modal open={dialog} onClose={() => setDialog(false)} title="Add product">
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
          <FormRow label="Unit *">
            <SearchableSelect
              options={unitOptions}
              value={values.unit_id}
              placeholder="Select unit"
              onChange={(next) => setValues((v) => ({ ...v, unit_id: next }))}
            />
          </FormRow>
          <FormRow label="HSN">
            <TextInput
              value={values.hsn_sac}
              onChange={(e) => setValues((v) => ({ ...v, hsn_sac: e.target.value }))}
            />
          </FormRow>
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
      { id: 'sales', label: 'Sales', show: canView },
      { id: 'purchase', label: 'Purchase', show: canView },
      { id: 'production', label: 'Production', show: canView },
      { id: 'customization', label: 'Customization', show: canView },
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

  const range = useBreakdownRange();
  const breakdownArgs = useMemo(
    () => ({ id, start_date: range.start, end_date: range.end, grain: range.grain }),
    [id, range.start, range.end, range.grain],
  );

  const { data: salesBreakdown, isLoading: salesLoading } = useGetCatalogProductSalesBreakdownQuery(
    breakdownArgs,
    { skip: !id || !canView || tab !== 'sales' },
  );
  const { data: purchaseBreakdown, isLoading: purchaseLoading } = useGetCatalogProductPurchaseBreakdownQuery(
    breakdownArgs,
    { skip: !id || !canView || tab !== 'purchase' },
  );
  const { data: productionBreakdown, isLoading: productionLoading } =
    useGetCatalogProductProductionBreakdownQuery(breakdownArgs, {
      skip: !id || !canView || tab !== 'production',
    });
  const { data: customizationBreakdown, isLoading: customizationLoading } =
    useGetCatalogProductCustomizationBreakdownQuery(breakdownArgs, {
      skip: !id || !canView || tab !== 'customization',
    });
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
    try {
      await updateProduct({
        id,
        body: {
          name: values.name.trim(),
          category_ids: values.category_ids,
          unit_id: unitId,
          unit_code: unitCodeForId(units as Record<string, unknown>[], unitId),
          hsn_sac: values.hsn_sac,
          is_active: values.is_active,
        },
      }).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
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

  async function submitMerge() {
    setMergeError('');
    if (!id || mergeSourceIds.length === 0) return;
    try {
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
          { label: 'HSN', value: String(data.hsn_sac || '—') },
          { label: 'Active', value: data.is_active === false ? 'No' : 'Yes' },
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
            </div>
            {canEdit ? (
              <FormRow label="Active">
                <label>
                  <input
                    type="checkbox"
                    checked={values.is_active}
                    onChange={(e) => setValues((v) => ({ ...v, is_active: e.target.checked }))}
                  />{' '}
                  Active
                </label>
              </FormRow>
            ) : null}
            {formError ? <ErrorText>{formError}</ErrorText> : null}
          </EntityDetailForm>
          {canEdit ? (
            <EntityDetailStickyActions>
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
            {specLoading ? <EntityListLoading>Loading spec insights…</EntityListLoading> : null}
            {!specLoading ? (
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

      {tab === 'sales' ? (
        <BreakdownPanel
          title="Sales breakdown"
          metricLabel="Sales"
          mode="money"
          range={range}
          data={salesBreakdown}
          isLoading={salesLoading}
          entitySlug={title}
          emptyMessage="No sales data for this range."
        />
      ) : null}

      {tab === 'purchase' ? (
        <BreakdownPanel
          title="Purchase breakdown"
          metricLabel="Purchases"
          mode="money"
          range={range}
          data={purchaseBreakdown}
          isLoading={purchaseLoading}
          entitySlug={title}
          emptyMessage="No purchase data for this range."
        />
      ) : null}

      {tab === 'production' ? (
        <BreakdownPanel
          title="Production breakdown"
          metricLabel="Production"
          mode="qty"
          range={range}
          data={productionBreakdown}
          isLoading={productionLoading}
          entitySlug={title}
          emptyMessage="No production data for this range."
        />
      ) : null}

      {tab === 'customization' ? (
        <BreakdownPanel
          title="Customization breakdown"
          metricLabel="Customization"
          mode="customization"
          range={range}
          data={customizationBreakdown}
          isLoading={customizationLoading}
          entitySlug={title}
          emptyMessage="No customization items for this range."
        />
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
            Selected products' SKUs move under <strong>{title}</strong> and the source products are
            deactivated. This cannot be undone.
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
    </EntityDetailPage>
  );
}
