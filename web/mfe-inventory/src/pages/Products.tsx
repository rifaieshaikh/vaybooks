import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCreateCatalogProductMutation,
  useCreateCatalogSkuMutation,
  useGetCatalogProductQuery,
  useGetCatalogProductSalesBreakdownQuery,
  useGetCatalogProductSpecInsightsQuery,
  useGetCatalogProductActivityQuery,
  useListCatalogProductsQuery,
  useListInventoryCategoriesQuery,
  useResolveInventoryEntityQuery,
  useUpdateCatalogProductMutation,
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
  TextInput,
  displayName,
  pageCount,
  paginate,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import { toCategoryOptions } from '../pickerOptions';

type ProductDetailTab =
  | 'overview'
  | 'skus'
  | 'spec'
  | 'sales'
  | 'activity';

type CatalogForm = {
  name: string;
  category_ids: string[];
  unit_code: string;
  hsn_sac: string;
  is_active: boolean;
};

function emptyCatalogForm(): CatalogForm {
  return {
    name: '',
    category_ids: [],
    unit_code: 'pcs',
    hsn_sac: '',
    is_active: true,
  };
}

/** Catalog products list (parents — no stock columns). */
export function ProductsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListCatalogProductsQuery({ active_only: false });
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: true });
  const [createProduct, createState] = useCreateCatalogProductMutation();
  const [dialog, setDialog] = useState(false);
  const [values, setValues] = useState<CatalogForm>(emptyCatalogForm);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setValues(emptyCatalogForm());
      setDialog(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const columns: EntityListColumn[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Product',
        cell: (row) => displayName(row, ['name'], 'Unnamed product'),
      },
      {
        id: 'hsn',
        header: 'HSN',
        cell: (row) => String(row.hsn_sac || '—'),
      },
      {
        id: 'unit',
        header: 'Unit',
        cell: (row) => String(row.unit || row.unit_code || '—'),
      },
      {
        id: 'active',
        header: 'Active',
        cell: (row) => (row.is_active === false ? 'No' : 'Yes'),
      },
    ],
    [],
  );

  const pages = pageCount(data.length);
  const rows = paginate(data, page, PAGE_SIZE);

  async function onCreate() {
    setFormError('');
    if (!values.name.trim()) {
      setFormError('Name is required');
      return;
    }
    try {
      const created = await createProduct({
        name: values.name.trim(),
        category_ids: values.category_ids,
        unit_code: values.unit_code || 'pcs',
        hsn_sac: values.hsn_sac,
        is_active: values.is_active,
      }).unwrap();
      setDialog(false);
      navigate(`/inventory/products/${String(created.id)}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Create failed');
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        title="Products"
        count={`${data.length} ${data.length === 1 ? 'product' : 'products'}`}
        actions={
          <Button type="button" onClick={() => { setValues(emptyCatalogForm()); setDialog(true); }}>
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
        <EntityListTable>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => String(row.id)}
            onActivateRow={(row) => navigate(`/inventory/products/${String(row.id)}`)}
            actions={(row) => (
              <EntityListActions onOpen={() => navigate(`/inventory/products/${String(row.id)}`)} />
            )}
          />
        </EntityListTable>
      ) : null}
      <EntityListFoot>
        <PaginationBar page={page} pageCount={pages} onPageChange={setPage} />
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
          <FormRow label="Unit code">
            <TextInput
              value={values.unit_code}
              onChange={(e) => setValues((v) => ({ ...v, unit_code: e.target.value }))}
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
            submitting={createState.isLoading}
          />
        </ModalForm>
      </Modal>
    </EntityListPage>
  );
}

/** Product 360 — catalog parent with SKUs + insights tabs. */
export function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProductDetailTab>('overview');
  const { data, isLoading, error, refetch } = useGetCatalogProductQuery(id, { skip: !id });
  const { data: resolved } = useResolveInventoryEntityQuery(id, {
    skip: !id || !!data || isLoading,
  });
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: false });
  const [updateProduct, updateState] = useUpdateCatalogProductMutation();
  const [createSku, createSkuState] = useCreateCatalogSkuMutation();
  const [values, setValues] = useState<CatalogForm>(emptyCatalogForm);
  const [skuCode, setSkuCode] = useState('');
  const [skuError, setSkuError] = useState('');
  const [formError, setFormError] = useState('');

  const { data: salesBreakdown } = useGetCatalogProductSalesBreakdownQuery(
    { id, grain: 'month' },
    { skip: !id || tab !== 'sales' },
  );
  const { data: specInsights } = useGetCatalogProductSpecInsightsQuery(id, {
    skip: !id || tab !== 'spec',
  });
  const { data: activity } = useGetCatalogProductActivityQuery(
    { id, limit: 50 },
    { skip: !id || tab !== 'activity' },
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
      unit_code: String(data.unit || data.unit_code || 'pcs'),
      hsn_sac: String(data.hsn_sac || ''),
      is_active: data.is_active !== false,
    });
  }, [data]);

  const skus = useMemo(
    () => (Array.isArray(data?.skus) ? (data.skus as Record<string, unknown>[]) : []),
    [data],
  );

  async function onSave() {
    setFormError('');
    if (!values.name.trim()) {
      setFormError('Name is required');
      return;
    }
    try {
      await updateProduct({
        id,
        body: {
          name: values.name.trim(),
          category_ids: values.category_ids,
          unit_code: values.unit_code || 'pcs',
          hsn_sac: values.hsn_sac,
          is_active: values.is_active,
        },
      }).unwrap();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function onAddSku() {
    setSkuError('');
    if (!skuCode.trim()) {
      setSkuError('SKU code is required');
      return;
    }
    try {
      await createSku({
        catalogProductId: id,
        body: { sku: skuCode.trim(), selling_rate: 0, mrp: 0, gst_rate: 0 },
      }).unwrap();
      setSkuCode('');
      refetch();
    } catch (e) {
      setSkuError(e instanceof Error ? e.message : 'Could not create SKU');
    }
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
        title={String(data.name || 'Product')}
        subtitle="Catalog product — stock and transactions live on SKUs"
      />
      <EntityDetailSnapshot
        ariaLabel="Product facts"
        items={[
          { label: 'SKUs', value: String(data.sku_count ?? skus.length) },
          { label: 'On hand (Σ)', value: String(data.on_hand ?? 0) },
          { label: 'HSN', value: String(data.hsn_sac || '—') },
          { label: 'Active', value: data.is_active === false ? 'No' : 'Yes' },
        ]}
      />
      <EntityDetailTabs
        ariaLabel="Product 360"
        value={tab}
        onChange={(v) => setTab(v as ProductDetailTab)}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'skus', label: 'SKUs' },
          { id: 'spec', label: 'Spec insights' },
          { id: 'sales', label: 'Sales' },
          { id: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'overview' ? (
        <EntityDetailPanel>
          <EntityDetailForm>
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
            <FormRow label="Unit code">
              <TextInput
                value={values.unit_code}
                onChange={(e) => setValues((v) => ({ ...v, unit_code: e.target.value }))}
              />
            </FormRow>
            <FormRow label="HSN">
              <TextInput
                value={values.hsn_sac}
                onChange={(e) => setValues((v) => ({ ...v, hsn_sac: e.target.value }))}
              />
            </FormRow>
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
            {formError ? <ErrorText>{formError}</ErrorText> : null}
          </EntityDetailForm>
          <EntityDetailStickyActions>
            <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
              Save
            </Button>
          </EntityDetailStickyActions>
        </EntityDetailPanel>
      ) : null}

      {tab === 'skus' ? (
        <EntityDetailPanel>
          <FormRow label="Add SKU code">
            <TextInput value={skuCode} onChange={(e) => setSkuCode(e.target.value)} />
          </FormRow>
          {skuError ? <ErrorText>{skuError}</ErrorText> : null}
          <Button type="button" onClick={() => void onAddSku()} disabled={createSkuState.isLoading}>
            Add SKU
          </Button>
          <DataTable
            columns={[
              { id: 'sku', header: 'SKU', cell: (row) => String(row.sku || '') },
              { id: 'name', header: 'Name', cell: (row) => String(row.name || '') },
              {
                id: 'rate',
                header: 'Rate',
                cell: (row) => String(row.selling_rate ?? row.active_selling_rate ?? 0),
              },
              { id: 'qty', header: 'On hand', cell: (row) => String(row.current_qty ?? 0) },
            ]}
            rows={skus}
            rowKey={(row) => String(row.id)}
            onActivateRow={(row) => navigate(`/inventory/skus/${String(row.id)}`)}
            actions={(row) => (
              <EntityListActions onOpen={() => navigate(`/inventory/skus/${String(row.id)}`)} />
            )}
          />
        </EntityDetailPanel>
      ) : null}

      {tab === 'spec' ? (
        <EntityDetailPanel>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(specInsights || {}, null, 2)}
          </pre>
        </EntityDetailPanel>
      ) : null}

      {tab === 'sales' ? (
        <EntityDetailPanel>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(salesBreakdown || {}, null, 2)}
          </pre>
        </EntityDetailPanel>
      ) : null}

      {tab === 'activity' ? (
        <EntityDetailPanel>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(activity || {}, null, 2)}
          </pre>
        </EntityDetailPanel>
      ) : null}
    </EntityDetailPage>
  );
}
