import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useAddInventoryCategoryProductsMutation,
  useCan,
  useGetInventoryCategoryCustomizationBreakdownQuery,
  useGetInventoryCategoryProductionBreakdownQuery,
  useGetInventoryCategoryQuery,
  useGetInventoryCategorySalesBreakdownQuery,
  useListInventoryCategoriesQuery,
  useListInventoryCategoryProductsQuery,
  useListInventoryProductsQuery,
  useUpdateInventoryCategoryMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailTabs,
  EntityListEmpty,
  EntityListLoading,
  ErrorText,
  FormRow,
  Modal,
  ModalForm,
  ModalFormActions,
  SearchableSelect,
  StatusPill,
  TextInput,
  displayName,
  type SearchableSelectOption,
} from '@vaybooks/ui-kit';
import { excludeOption, toCategoryOptions, withNoneOption } from '../pickerOptions';
import { downloadCsv } from '../utils';
import './CategoryDetailPage.css';

type TabId = 'overview' | 'items' | 'sales' | 'production' | 'customization';
type RangePreset = 'mtd' | '30' | '90' | 'all' | 'custom';
type Grain = 'day' | 'week' | 'month';

type EditValues = {
  name: string;
  description: string;
  parent_id: string;
  is_active: boolean;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mtdRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function lastNDays(n: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (n - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

function grainForPreset(preset: RangePreset): Grain {
  if (preset === 'mtd') return 'day';
  if (preset === '30') return 'week';
  return 'month';
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Save failed');
  }
  return 'Save failed';
}

function money(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'category';
}

export function CategoryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCan();

  const canOpen = can('inventory.categories.open') || can('inventory.categories.view');
  const canEdit = can('inventory.categories.edit');
  const canDeactivate = can('inventory.categories.deactivate');
  const canOverview = can('inventory.categories.overview.view') || canOpen;
  const canItems = can('inventory.categories.items.view') || canOpen;
  const canItemsAdd = can('inventory.categories.items.add') && can('inventory.products.edit');
  const canSales = can('inventory.categories.sales.view');
  const canProduction = can('inventory.categories.production.view');
  const canCustomization = can('inventory.categories.customization.view');
  const canOpenProduct = can('inventory.products.view');

  const {
    data: fetched,
    isLoading,
    isFetching,
    isUninitialized,
    error,
    refetch,
  } = useGetInventoryCategoryQuery(id, {
    skip: !id || !canOpen,
  });

  const { data: listRows = [] } = useListInventoryCategoriesQuery(
    { active_only: false },
    { skip: !canOpen },
  );
  const listed = useMemo(
    () => (listRows as Record<string, unknown>[]).find((row) => String(row.id) === String(id)),
    [listRows, id],
  );
  const data = (fetched as Record<string, unknown> | undefined) || listed;
  const allCategories = listRows;

  const [updateCategory, updateState] = useUpdateInventoryCategoryMutation();

  const tabs = useMemo(() => {
    const all: { id: TabId; label: string; show: boolean }[] = [
      { id: 'overview', label: 'Overview', show: canOverview },
      { id: 'items', label: 'Items', show: canItems },
      { id: 'sales', label: 'Sales', show: canSales },
      { id: 'production', label: 'Production', show: canProduction },
      { id: 'customization', label: 'Customization', show: canCustomization },
    ];
    return all.filter((t) => t.show);
  }, [canOverview, canItems, canSales, canProduction, canCustomization]);

  const requestedTab = (searchParams.get('tab') || '') as TabId;
  const tab: TabId | '' = tabs.some((t) => t.id === requestedTab)
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

  const [itemSearch, setItemSearch] = useState('');
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedItemSearch(itemSearch.trim()), 200);
    return () => clearTimeout(t);
  }, [itemSearch]);

  const [rangePreset, setRangePreset] = useState<RangePreset>('90');
  const [customStart, setCustomStart] = useState(() => lastNDays(90).start);
  const [customEnd, setCustomEnd] = useState(() => lastNDays(90).end);
  const [salesSearch, setSalesSearch] = useState('');
  const [salesHideZeros, setSalesHideZeros] = useState(true);
  const [productionSearch, setProductionSearch] = useState('');
  const [productionHideZeros, setProductionHideZeros] = useState(true);
  const [customizationSearch, setCustomizationSearch] = useState('');
  const [customizationHideZeros, setCustomizationHideZeros] = useState(false);

  const analyticsRange = useMemo(() => {
    if (rangePreset === 'all') return { start: undefined as string | undefined, end: undefined as string | undefined };
    if (rangePreset === 'mtd') return mtdRange();
    if (rangePreset === '30') return lastNDays(30);
    if (rangePreset === 'custom') return { start: customStart, end: customEnd };
    return lastNDays(90);
  }, [rangePreset, customStart, customEnd]);

  const analyticsGrain = grainForPreset(rangePreset);
  const breakdownArgs = useMemo(
    () => ({
      id,
      start_date: analyticsRange.start,
      end_date: analyticsRange.end,
      grain: analyticsGrain,
    }),
    [id, analyticsRange.start, analyticsRange.end, analyticsGrain],
  );

  const { data: categoryProducts = [], isLoading: itemsLoading, refetch: refetchItems } =
    useListInventoryCategoryProductsQuery(
      { id, q: debouncedItemSearch || undefined },
      { skip: !id || !canItems || tab !== 'items' },
    );

  const { data: salesBreakdown, isLoading: salesLoading } = useGetInventoryCategorySalesBreakdownQuery(
    breakdownArgs,
    { skip: !id || !canSales || tab !== 'sales' },
  );
  const { data: productionBreakdown, isLoading: productionLoading } =
    useGetInventoryCategoryProductionBreakdownQuery(breakdownArgs, {
      skip: !id || !canProduction || tab !== 'production',
    });
  const { data: customizationBreakdown, isLoading: customizationLoading } =
    useGetInventoryCategoryCustomizationBreakdownQuery(breakdownArgs, {
      skip: !id || !canCustomization || tab !== 'customization',
    });

  const salesRows = useMemo(
    () =>
      Array.isArray((salesBreakdown as { rows?: unknown[] } | undefined)?.rows)
        ? ((salesBreakdown as { rows: Record<string, unknown>[] }).rows || [])
        : [],
    [salesBreakdown],
  );
  const salesTrend = useMemo(
    () =>
      Array.isArray((salesBreakdown as { trend?: unknown[] } | undefined)?.trend)
        ? ((salesBreakdown as { trend: Record<string, unknown>[] }).trend || [])
        : [],
    [salesBreakdown],
  );
  const productionRows = useMemo(
    () =>
      Array.isArray((productionBreakdown as { rows?: unknown[] } | undefined)?.rows)
        ? ((productionBreakdown as { rows: Record<string, unknown>[] }).rows || [])
        : [],
    [productionBreakdown],
  );
  const productionTrend = useMemo(
    () =>
      Array.isArray((productionBreakdown as { trend?: unknown[] } | undefined)?.trend)
        ? ((productionBreakdown as { trend: Record<string, unknown>[] }).trend || [])
        : [],
    [productionBreakdown],
  );
  const customizationRows = useMemo(
    () =>
      Array.isArray((customizationBreakdown as { rows?: unknown[] } | undefined)?.rows)
        ? ((customizationBreakdown as { rows: Record<string, unknown>[] }).rows || [])
        : [],
    [customizationBreakdown],
  );
  const customizationTrend = useMemo(
    () =>
      Array.isArray((customizationBreakdown as { trend?: unknown[] } | undefined)?.trend)
        ? ((customizationBreakdown as { trend: Record<string, unknown>[] }).trend || [])
        : [],
    [customizationBreakdown],
  );

  const filteredSalesRows = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    return salesRows.filter((row) => {
      if (salesHideZeros && Number(row.qty ?? 0) === 0 && Number(row.amount ?? 0) === 0) return false;
      if (!q) return true;
      return (
        String(row.product_name || '').toLowerCase().includes(q) ||
        String(row.sku || '').toLowerCase().includes(q)
      );
    });
  }, [salesRows, salesSearch, salesHideZeros]);

  const filteredProductionRows = useMemo(() => {
    const q = productionSearch.trim().toLowerCase();
    return productionRows.filter((row) => {
      if (productionHideZeros && Number(row.qty ?? 0) === 0) return false;
      if (!q) return true;
      return (
        String(row.product_name || '').toLowerCase().includes(q) ||
        String(row.sku || '').toLowerCase().includes(q)
      );
    });
  }, [productionRows, productionSearch, productionHideZeros]);

  const filteredCustomizationRows = useMemo(() => {
    const q = customizationSearch.trim().toLowerCase();
    return customizationRows.filter((row) => {
      if (customizationHideZeros && Number(row.count ?? 0) === 0) return false;
      if (!q) return true;
      return String(row.status || '').toLowerCase().includes(q);
    });
  }, [customizationRows, customizationSearch, customizationHideZeros]);

  const showAnalyticsToolbar =
    tab === 'sales' || tab === 'production' || tab === 'customization';

  const rangeLabel =
    rangePreset === 'all'
      ? 'All time'
      : `${analyticsRange.start || '…'} → ${analyticsRange.end || '…'}`;

  const { data: allProducts = [] } = useListInventoryProductsQuery(
    { active_only: true },
    { skip: !canItemsAdd },
  );
  const [addProducts, addState] = useAddInventoryCategoryProductsMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editValues, setEditValues] = useState<EditValues>({
    name: '',
    description: '',
    parent_id: '',
    is_active: true,
  });
  const [formError, setFormError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addProductIds, setAddProductIds] = useState<string[]>([]);
  const [addPickerSearch, setAddPickerSearch] = useState('');
  const [addMessage, setAddMessage] = useState('');

  const parentOptions = useMemo(
    () => excludeOption(toCategoryOptions(allCategories as Record<string, unknown>[]), id),
    [allCategories, id],
  );

  const memberIds = useMemo(
    () => new Set(categoryProducts.map((p) => String(p.id))),
    [categoryProducts],
  );

  const addProductOptions: SearchableSelectOption[] = useMemo(() => {
    return (allProducts as Record<string, unknown>[])
      .filter((p) => !memberIds.has(String(p.id)))
      .map((p) => {
        const pid = String(p.id);
        return {
          value: pid,
          label: String(p.name || 'Product'),
          sublabel: p.sku ? String(p.sku) : undefined,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allProducts, memberIds]);

  const filteredAddOptions = useMemo(() => {
    const q = addPickerSearch.trim().toLowerCase();
    if (!q) return addProductOptions;
    return addProductOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
        o.value.toLowerCase().includes(q),
    );
  }, [addProductOptions, addPickerSearch]);

  const selectedAddSet = useMemo(() => new Set(addProductIds), [addProductIds]);

  function toggleAddProduct(productId: string) {
    setAddProductIds((prev) =>
      prev.includes(productId) ? prev.filter((x) => x !== productId) : [...prev, productId],
    );
  }

  function openAddItems() {
    setAddMessage('');
    setAddProductIds([]);
    setAddPickerSearch('');
    setAddOpen(true);
  }

  function openEdit() {
    if (!data || !canEdit) return;
    setFormError('');
    setEditValues({
      name: String(data.name || ''),
      description: String(data.description || ''),
      parent_id: String(data.parent_id || ''),
      is_active: data.is_active !== false,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!id) return;
    setFormError('');
    try {
      const body: Record<string, unknown> = {
        name: editValues.name,
        description: editValues.description,
        parent_id: editValues.parent_id || null,
      };
      if (canDeactivate) body.is_active = editValues.is_active;
      await updateCategory({ id, body }).unwrap();
      setEditOpen(false);
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
    }
  }

  async function toggleActive() {
    if (!data || !canDeactivate || !id) return;
    await updateCategory({
      id,
      body: {
        name: String(data.name || ''),
        is_active: data.is_active === false,
      },
    }).unwrap();
    refetch();
  }

  async function submitAddProducts() {
    if (!id || addProductIds.length === 0) return;
    setAddMessage('');
    try {
      const result = await addProducts({ id, product_ids: addProductIds }).unwrap();
      const added = result.added?.length || 0;
      const already = result.already_present?.length || 0;
      const missing = result.missing?.length || 0;
      const parts: string[] = [];
      if (added) parts.push(`Added ${added}`);
      if (already) parts.push(`${already} already in category`);
      if (missing) parts.push(`${missing} not found`);
      setAddMessage(parts.join(' · ') || 'No changes.');
      if (added) {
        setAddProductIds([]);
        setAddPickerSearch('');
        refetchItems();
        refetch();
      }
    } catch (e: unknown) {
      setAddMessage(extractError(e));
    }
  }

  if (!canOpen) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <EntityListEmpty>
          <strong>You do not have permission to open this category.</strong>
        </EntityListEmpty>
      </EntityDetailPage>
    );
  }

  if (!id) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <ErrorText>Category not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  if (isUninitialized || ((isLoading || isFetching) && !data)) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <EntityListLoading>Loading category…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  if (error && !data) {
    const status = Number((error as { status?: number }).status || 0);
    const detail =
      status === 403
        ? 'You do not have permission to open this category.'
        : status === 404
          ? 'Category not found.'
          : extractError(error) || 'Failed to load category.';
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <ErrorText>{detail}</ErrorText>
      </EntityDetailPage>
    );
  }

  if (!data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <ErrorText>Category not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const title = displayName(data as Record<string, unknown>, ['name'], id);
  const path =
    typeof data.path === 'string'
      ? data.path
      : Array.isArray(data.path)
        ? (data.path as string[]).join(' › ')
        : title;
  const inactive = data.is_active === false;

  const heroActions = (
    <>
      {canEdit ? (
        <Button type="button" onClick={openEdit}>
          Edit
        </Button>
      ) : null}
      {canDeactivate ? (
        <Button type="button" onClick={() => void toggleActive()}>
          {inactive ? 'Activate' : 'Deactivate'}
        </Button>
      ) : null}
    </>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/inventory/categories" label="Categories" />

      <EntityDetailHero
        kicker="Inventory · Category"
        title={title}
        lead={
          <>
            <StatusPill status={inactive ? 'Inactive' : 'Active'} tone={inactive ? 'warn' : 'success'} />
            <span className="ed-lead-sep"> · {path}</span>
          </>
        }
        actions={heroActions}
      />

      {canOverview ? (
        <EntityDetailSnapshot
          ariaLabel="Category facts"
          items={[
            { label: 'Path', value: path },
            { label: 'Products', value: Number(data.product_count ?? 0) },
            { label: 'Status', value: inactive ? 'Inactive' : 'Active' },
            { label: 'Description', value: String(data.description || '—') },
          ]}
        />
      ) : null}

      {tabs.length ? (
        <EntityDetailTabs
          value={tab}
          ariaLabel="Category sections"
          onChange={(next) => {
            const params = new URLSearchParams(searchParams);
            params.set('tab', next);
            setSearchParams(params, { replace: true });
          }}
          options={tabs.map((t) => ({ id: t.id, label: t.label }))}
        />
      ) : (
        <EntityListEmpty>
          <strong>No sections available.</strong>
        </EntityListEmpty>
      )}

      {showAnalyticsToolbar ? (
        <div className="cd-analytics-toolbar" role="group" aria-label="Breakdown date range">
          <div className="cd-range-chips">
            {(
              [
                ['mtd', 'MTD'],
                ['30', '30 days'],
                ['90', '90 days'],
                ['all', 'All'],
                ['custom', 'Custom'],
              ] as const
            ).map(([idPreset, label]) => (
              <button
                key={idPreset}
                type="button"
                className={`cd-chip${rangePreset === idPreset ? ' is-active' : ''}`}
                onClick={() => setRangePreset(idPreset)}
              >
                {label}
              </button>
            ))}
          </div>
          {rangePreset === 'custom' ? (
            <div className="cd-custom-dates">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Start date"
              />
              <span>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="End date"
              />
            </div>
          ) : null}
          <span className="cd-range-label">{rangeLabel}</span>
        </div>
      ) : null}

      {tab === 'overview' && canOverview ? (
        <EntityDetailPanel title="Overview" note="Category identity and hierarchy.">
          <div className="ed-grid ed-grid-2">
            <FormRow label="Name">
              <TextInput value={String(data.name || '')} readOnly disabled />
            </FormRow>
            <FormRow label="Parent">
              <TextInput
                value={
                  data.parent_id
                    ? String(
                        (allCategories as Record<string, unknown>[]).find(
                          (c) => String(c.id) === String(data.parent_id),
                        )?.name || data.parent_id,
                      )
                    : '— None (top level) —'
                }
                readOnly
                disabled
              />
            </FormRow>
            <FormRow label="Description">
              <TextInput value={String(data.description || '')} readOnly disabled />
            </FormRow>
            <FormRow label="Status">
              <TextInput value={inactive ? 'Inactive' : 'Active'} readOnly disabled />
            </FormRow>
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'items' && canItems ? (
        <EntityDetailPanel
          title="Items"
          note="Products assigned to this category."
          headerEnd={
            canItemsAdd ? (
              <Button type="button" onClick={openAddItems}>
                Add items
              </Button>
            ) : null
          }
        >
          <div style={{ marginBottom: 12 }}>
            <input
              type="search"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search products in category…"
              aria-label="Search category products"
              style={{ width: '100%', maxWidth: 360, padding: '0.45rem 0.6rem' }}
            />
          </div>
          {itemsLoading ? <EntityListLoading>Loading products…</EntityListLoading> : null}
          {!itemsLoading && categoryProducts.length === 0 ? (
            <EntityListEmpty>
              <strong>No products in this category.</strong>
            </EntityListEmpty>
          ) : null}
          {!itemsLoading && categoryProducts.length > 0 ? (
            <table className="cd-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Product</th>
                  <th align="left">SKU</th>
                  <th align="right">Qty</th>
                  <th align="left">Status</th>
                </tr>
              </thead>
              <tbody>
                {categoryProducts.map((row) => (
                  <tr
                    key={String(row.id)}
                    style={{ cursor: canOpenProduct ? 'pointer' : undefined }}
                    onClick={() => {
                      if (canOpenProduct) navigate(`/inventory/skus/${String(row.id)}`);
                    }}
                  >
                    <td>{String(row.name || '—')}</td>
                    <td>{String(row.sku || '—')}</td>
                    <td align="right">{Number(row.current_qty ?? 0)}</td>
                    <td>{row.is_active === false ? 'Inactive' : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      {tab === 'sales' && canSales ? (
        <EntityDetailPanel
          title="Sales breakdown"
          note={`Sales by product · ${rangeLabel}`}
          headerEnd={
            <Button
              type="button"
              variant="ghost"
              disabled={filteredSalesRows.length === 0}
              onClick={() =>
                downloadCsv(
                  `category-${slugify(title)}-sales-${analyticsRange.start || 'all'}_${analyticsRange.end || 'all'}.csv`,
                  filteredSalesRows.map((row) => ({
                    product: row.product_name,
                    sku: row.sku,
                    qty: row.qty,
                    amount: row.amount,
                  })),
                )
              }
            >
              Download CSV
            </Button>
          }
        >
          <div className="cd-tab-filters">
            <input
              type="search"
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              placeholder="Search product or SKU…"
              aria-label="Search sales rows"
            />
            <label className="cd-check">
              <input
                type="checkbox"
                checked={salesHideZeros}
                onChange={(e) => setSalesHideZeros(e.target.checked)}
              />
              Hide zeros
            </label>
          </div>
          {salesLoading ? <EntityListLoading>Loading sales…</EntityListLoading> : null}
          {!salesLoading && salesTrend.length > 0 ? (
            <div className="cd-chart">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="qty" name="Qty" stroke="#185c4c" dot={false} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="amount"
                    name="Amount"
                    stroke="#c45c26"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          {!salesLoading && filteredSalesRows.length === 0 ? (
            <EntityListEmpty>
              <strong>No sales data for this range.</strong>
            </EntityListEmpty>
          ) : null}
          {!salesLoading && filteredSalesRows.length > 0 ? (
            <table className="cd-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Product</th>
                  <th align="left">SKU</th>
                  <th align="right">Qty</th>
                  <th align="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesRows.map((row) => (
                  <tr key={String(row.product_id || row.sku || row.product_name)}>
                    <td>{String(row.product_name || row.product || '—')}</td>
                    <td>{String(row.sku || '—')}</td>
                    <td align="right">{Number(row.qty ?? 0)}</td>
                    <td align="right">{money(row.amount ?? row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      {tab === 'production' && canProduction ? (
        <EntityDetailPanel
          title="Production breakdown"
          note={`Production output by product · ${rangeLabel}`}
          headerEnd={
            <Button
              type="button"
              variant="ghost"
              disabled={filteredProductionRows.length === 0}
              onClick={() =>
                downloadCsv(
                  `category-${slugify(title)}-production-${analyticsRange.start || 'all'}_${analyticsRange.end || 'all'}.csv`,
                  filteredProductionRows.map((row) => ({
                    product: row.product_name,
                    sku: row.sku,
                    qty: row.qty,
                  })),
                )
              }
            >
              Download CSV
            </Button>
          }
        >
          <div className="cd-tab-filters">
            <input
              type="search"
              value={productionSearch}
              onChange={(e) => setProductionSearch(e.target.value)}
              placeholder="Search product or SKU…"
              aria-label="Search production rows"
            />
            <label className="cd-check">
              <input
                type="checkbox"
                checked={productionHideZeros}
                onChange={(e) => setProductionHideZeros(e.target.checked)}
              />
              Hide zeros
            </label>
          </div>
          {productionLoading ? <EntityListLoading>Loading production…</EntityListLoading> : null}
          {!productionLoading && productionTrend.length > 0 ? (
            <div className="cd-chart">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={productionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="qty" name="Qty" stroke="#185c4c" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          {!productionLoading && filteredProductionRows.length === 0 ? (
            <EntityListEmpty>
              <strong>No production data for this range.</strong>
            </EntityListEmpty>
          ) : null}
          {!productionLoading && filteredProductionRows.length > 0 ? (
            <table className="cd-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Product</th>
                  <th align="left">SKU</th>
                  <th align="right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredProductionRows.map((row) => (
                  <tr key={String(row.product_id || row.sku || row.product_name)}>
                    <td>{String(row.product_name || row.product || '—')}</td>
                    <td>{String(row.sku || '—')}</td>
                    <td align="right">{Number(row.qty ?? row.quantity ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      {tab === 'customization' && canCustomization ? (
        <EntityDetailPanel
          title="Customization breakdown"
          note={`Boutique items tagged with this category · ${rangeLabel}`}
          headerEnd={
            <Button
              type="button"
              variant="ghost"
              disabled={filteredCustomizationRows.length === 0}
              onClick={() =>
                downloadCsv(
                  `category-${slugify(title)}-customization-${analyticsRange.start || 'all'}_${analyticsRange.end || 'all'}.csv`,
                  filteredCustomizationRows.map((row) => ({
                    status: row.status,
                    count: row.count,
                    sell_amount: row.sell_amount,
                  })),
                )
              }
            >
              Download CSV
            </Button>
          }
        >
          <div className="cd-tab-filters">
            <input
              type="search"
              value={customizationSearch}
              onChange={(e) => setCustomizationSearch(e.target.value)}
              placeholder="Search status…"
              aria-label="Search customization rows"
            />
            <label className="cd-check">
              <input
                type="checkbox"
                checked={customizationHideZeros}
                onChange={(e) => setCustomizationHideZeros(e.target.checked)}
              />
              Hide zeros
            </label>
          </div>
          {customizationLoading ? (
            <EntityListLoading>Loading customization…</EntityListLoading>
          ) : null}
          {!customizationLoading ? (
            <>
              <p style={{ marginTop: 0 }}>
                Total items:{' '}
                {Number(
                  (customizationBreakdown as { totals?: { count?: number } })?.totals?.count ?? 0,
                )}
                {' · '}
                Sell amount:{' '}
                {money(
                  (customizationBreakdown as { totals?: { sell_amount?: number } })?.totals
                    ?.sell_amount,
                )}
              </p>
              {customizationTrend.length > 0 ? (
                <div className="cd-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={customizationTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="count"
                        name="Count"
                        stroke="#185c4c"
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="sell_amount"
                        name="Sell amount"
                        stroke="#c45c26"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              {filteredCustomizationRows.length > 0 ? (
                <table className="cd-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th align="left">Status</th>
                      <th align="right">Count</th>
                      <th align="right">Sell amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomizationRows.map((row) => (
                      <tr key={String(row.status)}>
                        <td>{String(row.status || '—')}</td>
                        <td align="right">{Number(row.count ?? 0)}</td>
                        <td align="right">{money(row.sell_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EntityListEmpty>
                  <strong>No customization items for this range.</strong>
                </EntityListEmpty>
              )}
            </>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      <Modal title="Edit Category" open={editOpen} onClose={() => setEditOpen(false)}>
        <ModalForm onSubmit={() => void saveEdit()}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Name">
            <TextInput value={editValues.name} readOnly disabled />
          </FormRow>
          <FormRow label="Description">
            <TextInput
              value={editValues.description}
              onChange={(e) => setEditValues((p) => ({ ...p, description: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Parent category">
            <SearchableSelect
              options={withNoneOption(parentOptions, '— None (top level) —')}
              value={editValues.parent_id}
              placeholder="Select parent"
              onChange={(next) => setEditValues((p) => ({ ...p, parent_id: next }))}
            />
          </FormRow>
          {canDeactivate ? (
            <FormRow label="Status">
              <select
                value={editValues.is_active ? 'yes' : 'no'}
                onChange={(e) =>
                  setEditValues((p) => ({ ...p, is_active: e.target.value === 'yes' }))
                }
                style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
              >
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </select>
            </FormRow>
          ) : null}
          <ModalFormActions
            busy={updateState.isLoading}
            submitLabel="Save Changes"
            busyLabel="Saving…"
            onCancel={() => setEditOpen(false)}
          />
        </ModalForm>
      </Modal>

      <Modal title="Add items" open={addOpen} onClose={() => setAddOpen(false)}>
        <ModalForm
          onSubmit={(e) => {
            e.preventDefault();
            void submitAddProducts();
          }}
        >
          {addMessage ? <p style={{ marginTop: 0 }}>{addMessage}</p> : null}
          <FormRow label="Products">
            <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <input
                type="search"
                value={addPickerSearch}
                onChange={(e) => setAddPickerSearch(e.target.value)}
                placeholder="Search by name or SKU…"
                aria-label="Search products to add"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.45rem 0.6rem',
                  borderRadius: 6,
                  border: '1px solid #c5d4ce',
                }}
              />
              {addProductIds.length > 0 ? (
                <div style={{ fontSize: 13, color: '#5c736a' }}>
                  {addProductIds.length} selected
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setAddProductIds([])}
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
                aria-label="Products to add"
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
                {addProductOptions.length === 0 ? (
                  <div style={{ padding: '0.6rem 0.45rem', fontSize: 13, color: '#667' }}>
                    All products are already in this category.
                  </div>
                ) : null}
                {addProductOptions.length > 0 && filteredAddOptions.length === 0 ? (
                  <div style={{ padding: '0.6rem 0.45rem', fontSize: 13, color: '#667' }}>
                    No products match your search.
                  </div>
                ) : null}
                {filteredAddOptions.map((opt) => {
                  const checked = selectedAddSet.has(opt.value);
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
                        onChange={() => toggleAddProduct(opt.value)}
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
            busy={addState.isLoading}
            submitLabel={
              addProductIds.length > 1
                ? `Add ${addProductIds.length} products`
                : 'Add to category'
            }
            busyLabel="Adding…"
            onCancel={() => setAddOpen(false)}
            submitDisabled={addProductIds.length === 0}
          />
        </ModalForm>
      </Modal>
    </EntityDetailPage>
  );
}
