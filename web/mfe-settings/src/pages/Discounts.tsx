import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCan,
  useCreateDiscountRuleMutation,
  useDeleteDiscountRuleMutation,
  useListCatalogProductsQuery,
  useListCustomersQuery,
  useListDiscountRulesQuery,
  useListInventoryCategoriesQuery,
  useListInventorySkusQuery,
  useListPartySegmentsQuery,
  useUpdateDiscountRuleMutation,
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
  Select,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { extractError } from '../utils';

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  product: 'Product',
  category: 'Category',
  customer: 'Customer',
  seasonal: 'Seasonal',
};

const APPLY_OPTIONS = [
  { key: 'sales_order', label: 'Sales order' },
  { key: 'sales_invoice', label: 'Sales invoice' },
  { key: 'boutique_invoice', label: 'Boutique invoice' },
] as const;

const APPLY_LABELS: Record<string, string> = Object.fromEntries(
  APPLY_OPTIONS.map((o) => [o.key, o.label]),
);

const DEFAULT_APPLY = APPLY_OPTIONS.map((o) => o.key);
const DEFAULT_FILTERS = { name: '', scope: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'priority', desc: false }];
const FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  {
    key: 'scope',
    label: 'Scope',
    type: 'select',
    allLabel: 'All scopes',
    options: Object.entries(SCOPE_LABELS).map(([value, label]) => ({ value, label })),
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    allLabel: 'All statuses',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
];

type FormState = {
  name: string;
  scope: string;
  discountType: string;
  value: string;
  priority: string;
  isActive: boolean;
  applyTo: string[];
  productIds: string[];
  catalogProductIds: string[];
  categoryIds: string[];
  customerIds: string[];
  segmentIds: string[];
  useDates: boolean;
  validFrom: string;
  validTo: string;
  maxAmount: string;
};

const emptyForm = (): FormState => ({
  name: '',
  scope: 'global',
  discountType: 'percent',
  value: '10',
  priority: '100',
  isActive: true,
  applyTo: [...DEFAULT_APPLY],
  productIds: [],
  catalogProductIds: [],
  categoryIds: [],
  customerIds: [],
  segmentIds: [],
  useDates: false,
  validFrom: '',
  validTo: '',
  maxAmount: '',
});

function asDateInput(value: unknown): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function valueCaption(row: Record<string, unknown>): string {
  const n = Number(row.value) || 0;
  if (String(row.discount_type) === 'fixed') {
    return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${n}%`;
}

function validityShort(row: Record<string, unknown>): string {
  const from = asDateInput(row.valid_from);
  const to = asDateInput(row.valid_to);
  if (!from && !to) return 'Always on';
  return `${from || '…'} → ${to || '…'}`;
}

function formFromRule(row: Record<string, unknown>): FormState {
  const apply = Array.isArray(row.apply_to)
    ? (row.apply_to as string[]).filter((k) => k in APPLY_LABELS)
    : [...DEFAULT_APPLY];
  const from = asDateInput(row.valid_from);
  const to = asDateInput(row.valid_to);
  return {
    name: String(row.name || ''),
    scope: String(row.scope || 'global'),
    discountType: String(row.discount_type || 'percent'),
    value: String(row.value ?? '0'),
    priority: String(row.priority ?? 100),
    isActive: row.is_active !== false,
    applyTo: apply.length ? apply : [...DEFAULT_APPLY],
    productIds: Array.isArray(row.product_ids) ? (row.product_ids as string[]).map(String) : [],
    catalogProductIds: Array.isArray(row.catalog_product_ids)
      ? (row.catalog_product_ids as string[]).map(String)
      : [],
    categoryIds: Array.isArray(row.category_ids) ? (row.category_ids as string[]).map(String) : [],
    customerIds: Array.isArray(row.customer_ids) ? (row.customer_ids as string[]).map(String) : [],
    segmentIds: Array.isArray(row.segment_ids) ? (row.segment_ids as string[]).map(String) : [],
    useDates: Boolean(from || to),
    validFrom: from,
    validTo: to,
    maxAmount:
      row.max_discount_amount != null && row.max_discount_amount !== ''
        ? String(row.max_discount_amount)
        : '',
  };
}

function idsForScope(form: FormState) {
  const scope = form.scope;
  return {
    product_ids: scope === 'product' || scope === 'seasonal' ? form.productIds : [],
    catalog_product_ids:
      scope === 'product' || scope === 'seasonal' ? form.catalogProductIds : [],
    category_ids: scope === 'category' || scope === 'seasonal' ? form.categoryIds : [],
    customer_ids: scope === 'customer' || scope === 'seasonal' ? form.customerIds : [],
    segment_ids: scope === 'customer' ? form.segmentIds : [],
  };
}

function EntityPicker({
  label,
  options,
  selected,
  onChange,
  required,
  emptyHint,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
  emptyHint?: string;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q]);

  if (options.length === 0) {
    return (
      <div style={{ padding: '0.75rem', border: '1px dashed #c9d8d0', borderRadius: 8, background: '#f4f8f6' }}>
        <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>{label}</strong>
        <p style={{ margin: 0, fontSize: 13, color: '#5a6f66' }}>
          {emptyHint || `No ${label.toLowerCase()} available yet.`}
        </p>
      </div>
    );
  }

  return (
    <FormRow label={`${label}${required ? ' *' : ''}`}>
      <div style={{ display: 'grid', gap: 6 }}>
        {options.length > 8 ? (
          <TextInput
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
          />
        ) : null}
        <div
          style={{
            maxHeight: options.length <= 5 ? undefined : 160,
            overflow: 'auto',
            border: '1px solid #e2ebe6',
            borderRadius: 8,
            padding: 4,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '0.55rem', fontSize: 12, color: '#5a6f66' }}>No matches</div>
          ) : (
            filtered.map((o) => {
              const checked = selected.includes(o.id);
              return (
                <label
                  key={o.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '0.45rem 0.5rem',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      onChange(
                        checked ? selected.filter((id) => id !== o.id) : [...selected, o.id],
                      );
                    }}
                  />
                  <span>{o.label}</span>
                </label>
              );
            })
          )}
        </div>
        <span style={{ fontSize: 12, color: '#5a6f66' }}>{selected.length} selected</span>
      </div>
    </FormRow>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#5a6f66',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export function DiscountsSettingsPage() {
  const can = useCan();
  const canEdit = can('settings.discounts.edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListDiscountRulesQuery();
  const [createRule, createState] = useCreateDiscountRuleMutation();
  const [updateRule, updateState] = useUpdateDiscountRuleMutation();
  const [deleteRule, deleteState] = useDeleteDiscountRuleMutation();

  const { data: products = [] } = useListInventorySkusQuery({ active_only: true }, { skip: !canEdit });
  const { data: catalogProducts = [] } = useListCatalogProductsQuery(
    { active_only: true },
    { skip: !canEdit },
  );
  const { data: categories = [] } = useListInventoryCategoriesQuery({ active_only: true }, { skip: !canEdit });
  const { data: customers = [] } = useListCustomersQuery(undefined, { skip: !canEdit });
  const { data: segments = [] } = useListPartySegmentsQuery(
    { applies_to: 'customer', active_only: true },
    { skip: !canEdit },
  );

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const rows = (data as Record<string, unknown>[]).filter((row) => {
      if (!matchesRegex(row.name, filters.name)) return false;
      if (filters.scope && String(row.scope) !== filters.scope) return false;
      if (filters.status === 'active' && row.is_active === false) return false;
      if (filters.status === 'inactive' && row.is_active !== false) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);
  const canMove = canEdit && sort[0]?.key === 'priority' && !sort[0]?.desc;

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: String(p.id),
        label: `${String(p.name || p.id)}${p.sku ? ` (${p.sku})` : ''}`,
      })),
    [products],
  );
  const catalogProductOptions = useMemo(
    () =>
      catalogProducts.map((p) => ({
        id: String(p.id),
        label: `${String(p.name || p.id)}${p.sku ? ` (${p.sku})` : ''}`,
      })),
    [catalogProducts],
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: String(c.id), label: String(c.name || c.id) })),
    [categories],
  );
  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        id: String(c.id),
        label: String(c.customer_name || c.name || c.phone_number || c.id),
      })),
    [customers],
  );
  const segmentOptions = useMemo(
    () => segments.map((s) => ({ id: String(s.id), label: String(s.name || s.id) })),
    [segments],
  );

  type DiscountRow = Record<string, unknown>;

  function openAdd(prefill?: { customerId?: string }) {
    setFormError('');
    setEditId('');
    const next = emptyForm();
    if (prefill?.customerId) {
      next.scope = 'customer';
      next.customerIds = [prefill.customerId];
    }
    setForm(next);
    setDialog('add');
  }

  useEffect(() => {
    if (!canEdit || searchParams.get('new') !== '1') return;
    const customerId = (searchParams.get('customer_id') || '').trim();
    openAdd(customerId ? { customerId } : undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    next.delete('customer_id');
    setSearchParams(next, { replace: true });
  }, [canEdit, searchParams, setSearchParams]);

  function openEdit(row: DiscountRow) {
    setFormError('');
    setEditId(String(row.id));
    setForm(formFromRule(row));
    setDialog('edit');
  }

  function openDelete(row: DiscountRow) {
    setFormError('');
    setEditId(String(row.id));
    setForm(formFromRule(row));
    setDialog('delete');
  }

  function patchForm(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function toggleApply(key: string) {
    setForm((prev) => ({
      ...prev,
      applyTo: prev.applyTo.includes(key)
        ? prev.applyTo.filter((k) => k !== key)
        : [...prev.applyTo, key],
    }));
  }

  function validateForm(forCreate: boolean): string {
    if (!form.name.trim()) return 'Name is required';
    if (form.discountType === 'percent' && Number(form.value) > 100) {
      return 'Discount percentage cannot exceed 100';
    }
    if (
      form.scope === 'product' &&
      form.productIds.length === 0 &&
      form.catalogProductIds.length === 0
    ) {
      return 'Select at least one product or catalog product';
    }
    if (form.scope === 'category' && form.categoryIds.length === 0) {
      return 'Select at least one category';
    }
    if (form.scope === 'customer' && form.customerIds.length === 0 && form.segmentIds.length === 0) {
      return 'Select at least one customer or segment';
    }
    if (form.scope === 'seasonal' && forCreate && (!form.validFrom || !form.validTo)) {
      return 'Seasonal discounts require valid from and valid to';
    }
    if (form.applyTo.length === 0) return 'Select at least one document type';
    return '';
  }

  function buildBody(forCreate: boolean): Record<string, unknown> {
    const ids = idsForScope(form);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      scope: form.scope,
      discount_type: form.discountType,
      value: Number(form.value) || 0,
      priority: Number(form.priority) || 100,
      is_active: form.isActive,
      apply_to: form.applyTo,
      max_discount_amount: form.maxAmount ? Number(form.maxAmount) : undefined,
      ...ids,
    };
    if (forCreate) {
      const useDates = form.scope === 'seasonal' || form.useDates;
      if (useDates) {
        body.valid_from = form.validFrom || undefined;
        body.valid_to = form.validTo || undefined;
      }
    }
    return body;
  }

  async function onSave(e?: FormEvent) {
    e?.preventDefault();
    const forCreate = dialog === 'add';
    const err = validateForm(forCreate);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      if (forCreate) await createRule(buildBody(true)).unwrap();
      else await updateRule({ id: editId, body: buildBody(false) }).unwrap();
      setDialog(null);
      refetch();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmDelete() {
    if (!editId) return;
    setFormError('');
    setBusy(true);
    try {
      await deleteRule(editId).unwrap();
      setDialog(null);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onMove(ruleId: string, direction: 'up' | 'down') {
    if (!canMove) return;
    const ordered = sortRows(data as Record<string, unknown>[], [
      { key: 'priority', desc: false },
      { key: 'name', desc: false },
      { key: 'id', desc: false },
    ]);
    const idx = ordered.findIndex((r) => String(r.id) === ruleId);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    const next = [...ordered];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setBusy(true);
    setFormError('');
    try {
      for (let i = 0; i < next.length; i++) {
        const desired = (i + 1) * 10;
        if (Number(next[i].priority) !== desired) {
          await updateRule({ id: String(next[i].id), body: { priority: desired } }).unwrap();
        }
      }
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  const saving = busy || createState.isLoading || updateState.isLoading || deleteState.isLoading;
  const showDates = form.scope === 'seasonal' || form.useDates;
  const editRule = (data as Record<string, unknown>[]).find((r) => String(r.id) === editId);

  const columns: EntityListColumn<DiscountRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Discount',
        render: (row) => {
          const apply =
            Array.isArray(row.apply_to) && row.apply_to.length
              ? (row.apply_to as string[]).map((k) => APPLY_LABELS[k] || k).join(' · ')
              : 'No documents';
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">
                  {displayName(row, ['name'], 'Untitled')}
                </span>
                <span className="el-customer-sub">{apply}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'value',
        header: 'Value',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => (
          <span>
            {valueCaption(row)}
            <span className="el-muted" style={{ display: 'block', fontSize: 11 }}>
              {String(row.discount_type) === 'fixed' ? 'Fixed' : 'Percent'}
            </span>
          </span>
        ),
      },
      {
        id: 'scope',
        header: 'Scope',
        render: (row) => {
          const scope = String(row.scope || 'global');
          return SCOPE_LABELS[scope] || scope;
        },
      },
      {
        id: 'priority',
        header: 'Priority',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => String(row.priority ?? '—'),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => (
          <span className={row.is_active === false ? 'el-muted' : 'el-advance'}>
            {row.is_active === false ? 'Inactive' : 'Active'}
          </span>
        ),
      },
      {
        id: 'validity',
        header: 'Validity',
        render: (row) => <span className="el-muted">{validityShort(row)}</span>,
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Pricing"
        title="Discounts"
        count={`${filtered.length} ${filtered.length === 1 ? 'rule' : 'rules'}${
          canMove ? ' · Use ↑↓ to change precedence' : ''
        }`}
        actions={
          canEdit ? (
            <Button type="button" onClick={() => openAdd()}>
              Add discount
            </Button>
          ) : null
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.status || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, status: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Inactive' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'priority', label: 'Priority' },
              { value: 'name', label: 'Name' },
              { value: 'created_at', label: 'Created' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {formError && !dialog ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading ? <EntityListLoading>Loading discounts…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load discounts.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No discount rules yet.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onEditRow={canEdit ? (row) => openEdit(row) : undefined}
          onNew={canEdit ? () => openAdd() : undefined}
          actions={(row) =>
            canEdit ? (
              <div className="el-actions">
                {canMove ? (
                  <>
                    <button
                      type="button"
                      className="el-action-btn"
                      disabled={saving}
                      onClick={() => void onMove(String(row.id), 'up')}
                      title="Higher precedence"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="el-action-btn"
                      disabled={saving}
                      onClick={() => void onMove(String(row.id), 'down')}
                      title="Lower precedence"
                    >
                      ↓
                    </button>
                  </>
                ) : null}
                <EntityListActions
                  onEdit={() => openEdit(row)}
                  onDelete={() => openDelete(row)}
                />
              </div>
            ) : null
          }
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
        title={dialog === 'add' ? 'Add discount' : 'Edit discount'}
        open={dialog === 'add' || dialog === 'edit'}
        onClose={() => setDialog(null)}
        wide
        footer={
          <>
            {dialog === 'edit' ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialog('delete')}
                disabled={saving}
                style={{ color: '#b42318', marginRight: 'auto' }}
              >
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || !form.name.trim()}
            >
              {dialog === 'add' ? 'Create rule' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form
          style={{ display: 'grid', gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(e);
          }}
        >
          {formError ? <ErrorText>{formError}</ErrorText> : null}

          <FormSection title="Rule">
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <FormRow label="Name *">
                  <TextInput
                    value={form.name}
                    onChange={(e) => patchForm({ name: e.target.value })}
                    placeholder="e.g. Festival weekend 10%"
                    required
                  />
                </FormRow>
              </div>
              <FormRow label="Scope *">
                <Select value={form.scope} onChange={(e) => patchForm({ scope: e.target.value })}>
                  {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Type *">
                <Select
                  value={form.discountType}
                  onChange={(e) => patchForm({ discountType: e.target.value })}
                >
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </Select>
              </FormRow>
              <FormRow label={form.discountType === 'fixed' ? 'Amount (₹) *' : 'Percent *'}>
                <TextInput
                  type="number"
                  min={0}
                  max={form.discountType === 'percent' ? 100 : undefined}
                  step="0.1"
                  value={form.value}
                  onChange={(e) => patchForm({ value: e.target.value })}
                />
              </FormRow>
              <FormRow label="Priority">
                <TextInput
                  type="number"
                  min={1}
                  value={form.priority}
                  onChange={(e) => patchForm({ priority: e.target.value })}
                />
              </FormRow>
              <FormRow label="Max amount (₹)">
                <TextInput
                  type="number"
                  min={0}
                  value={form.maxAmount}
                  onChange={(e) => patchForm({ maxAmount: e.target.value })}
                />
              </FormRow>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => patchForm({ isActive: e.target.checked })}
                />
                Active
              </label>
            </div>
            <p className="el-muted" style={{ margin: 0, fontSize: 13 }}>
              Lower priority number = higher precedence.
            </p>
          </FormSection>

          <FormSection title="Applies to">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {APPLY_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0.45rem 0.7rem',
                    border: '1px solid #e2ebe6',
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.applyTo.includes(opt.key)}
                    onChange={() => toggleApply(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </FormSection>

          {form.scope !== 'global' ? (
            <FormSection title="Targets">
              {form.scope === 'seasonal' ? (
                <p className="el-muted" style={{ margin: 0, fontSize: 13 }}>
                  Only one active seasonal campaign is allowed. Optional filters narrow who or what it
                  covers.
                </p>
              ) : null}
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {form.scope === 'product' ? (
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <EntityPicker
                        label="SKUs"
                        required={form.catalogProductIds.length === 0}
                        options={productOptions}
                        selected={form.productIds}
                        onChange={(productIds) => patchForm({ productIds })}
                        emptyHint="Add SKUs in Inventory before creating a product discount."
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <EntityPicker
                        label="Catalog products"
                        required={form.productIds.length === 0}
                        options={catalogProductOptions}
                        selected={form.catalogProductIds}
                        onChange={(catalogProductIds) => patchForm({ catalogProductIds })}
                        emptyHint="Add catalog products in Inventory to target a whole catalog product."
                      />
                    </div>
                    <p className="el-muted" style={{ margin: 0, fontSize: 12, gridColumn: '1 / -1' }}>
                      Select SKUs, catalog products, or both — either is enough to scope this rule.
                    </p>
                  </>
                ) : null}
                {form.scope === 'category' ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <EntityPicker
                      label="Categories"
                      required
                      options={categoryOptions}
                      selected={form.categoryIds}
                      onChange={(categoryIds) => patchForm({ categoryIds })}
                      emptyHint="Add categories in Inventory before creating a category discount."
                    />
                  </div>
                ) : null}
                {form.scope === 'customer' ? (
                  <>
                    <EntityPicker
                      label="Customers"
                      options={customerOptions}
                      selected={form.customerIds}
                      onChange={(customerIds) => patchForm({ customerIds })}
                      emptyHint="No customers yet."
                    />
                    <EntityPicker
                      label="Segments"
                      options={segmentOptions}
                      selected={form.segmentIds}
                      onChange={(segmentIds) => patchForm({ segmentIds })}
                      emptyHint="No customer segments yet."
                    />
                  </>
                ) : null}
                {form.scope === 'seasonal' ? (
                  <>
                    {customerOptions.length > 0 ? (
                      <EntityPicker
                        label="Customers (optional)"
                        options={customerOptions}
                        selected={form.customerIds}
                        onChange={(customerIds) => patchForm({ customerIds })}
                      />
                    ) : null}
                    {productOptions.length > 0 ? (
                      <EntityPicker
                        label="SKUs (optional)"
                        options={productOptions}
                        selected={form.productIds}
                        onChange={(productIds) => patchForm({ productIds })}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '0.75rem',
                          border: '1px dashed #c9d8d0',
                          borderRadius: 8,
                          background: '#f4f8f6',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>SKUs</strong>
                        <p style={{ margin: 0, fontSize: 13, color: '#5a6f66' }}>
                          None yet — campaign won’t filter by SKU.
                        </p>
                      </div>
                    )}
                    {catalogProductOptions.length > 0 ? (
                      <EntityPicker
                        label="Catalog products (optional)"
                        options={catalogProductOptions}
                        selected={form.catalogProductIds}
                        onChange={(catalogProductIds) => patchForm({ catalogProductIds })}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '0.75rem',
                          border: '1px dashed #c9d8d0',
                          borderRadius: 8,
                          background: '#f4f8f6',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>Catalog products</strong>
                        <p style={{ margin: 0, fontSize: 13, color: '#5a6f66' }}>
                          None yet — campaign won’t filter by catalog product.
                        </p>
                      </div>
                    )}
                    {categoryOptions.length > 0 ? (
                      <EntityPicker
                        label="Categories (optional)"
                        options={categoryOptions}
                        selected={form.categoryIds}
                        onChange={(categoryIds) => patchForm({ categoryIds })}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '0.75rem',
                          border: '1px dashed #c9d8d0',
                          borderRadius: 8,
                          background: '#f4f8f6',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>Categories</strong>
                        <p style={{ margin: 0, fontSize: 13, color: '#5a6f66' }}>
                          None yet — campaign won’t filter by category.
                        </p>
                      </div>
                    )}
                    {customerOptions.length === 0 ? (
                      <div
                        style={{
                          padding: '0.75rem',
                          border: '1px dashed #c9d8d0',
                          borderRadius: 8,
                          background: '#f4f8f6',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>Customers</strong>
                        <p style={{ margin: 0, fontSize: 13, color: '#5a6f66' }}>
                          None yet — campaign applies without a customer filter.
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </FormSection>
          ) : null}

          <FormSection title="Schedule">
            {dialog === 'edit' ? (
              <p
                style={{
                  margin: 0,
                  padding: '0.75rem 0.9rem',
                  borderRadius: 8,
                  background: '#f4f8f6',
                  color: '#5a6f66',
                  fontSize: 13,
                }}
              >
                Validity: {validityShort(editRule || {})}. Date ranges are set when creating a rule.
              </p>
            ) : (
              <>
                {form.scope !== 'seasonal' ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.useDates}
                      onChange={(e) => patchForm({ useDates: e.target.checked })}
                    />
                    Limit by date range
                  </label>
                ) : (
                  <p className="el-muted" style={{ margin: 0, fontSize: 13 }}>
                    Seasonal campaigns require a validity window.
                  </p>
                )}
                {showDates ? (
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                    <FormRow label={form.scope === 'seasonal' ? 'Valid from *' : 'Valid from'}>
                      <TextInput
                        type="date"
                        value={form.validFrom}
                        onChange={(e) => patchForm({ validFrom: e.target.value })}
                      />
                    </FormRow>
                    <FormRow label={form.scope === 'seasonal' ? 'Valid to *' : 'Valid to'}>
                      <TextInput
                        type="date"
                        value={form.validTo}
                        onChange={(e) => patchForm({ validTo: e.target.value })}
                      />
                    </FormRow>
                  </div>
                ) : null}
              </>
            )}
          </FormSection>
        </form>
      </Modal>

      <Modal
        title="Delete discount"
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onConfirmDelete()}
              disabled={saving}
              style={{ background: '#b42318' }}
            >
              Delete
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <p>
          Delete <strong>{form.name || 'this rule'}</strong>? This cannot be undone.
        </p>
      </Modal>
    </EntityListPage>
  );
}
