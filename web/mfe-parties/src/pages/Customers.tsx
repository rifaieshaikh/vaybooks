import {
  Button,
  EntityListActions,
  EntityListEmpty,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListRefreshing,
  EntityListTable,
  ErrorText,
  FiltersDialog,
  PaginationBar,
  SortDialog,
  displayName,
  formatBalance,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type FilterValues,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import {
  useCan,
  useCreateCustomerMutation,
  useListCustomersQuery,
  useListPartySegmentsQuery,
} from '@vaybooks/store';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  CustomerFormFields,
  customerBody,
  emptyCustomerForm,
  validateCustomerForm,
} from '../components/CustomerFormFields';
import { Modal } from '../components/Modal';
import { REGISTRATION_TYPES, type PartyFormValues } from '../components/PartyFields';

export { CustomerDetailPage } from './CustomerDetailPage';

const DEFAULT_CUSTOMER_FILTERS = {
  customer_name: '',
  phone_number: '',
  alternate_phone_number: '',
  gstin: '',
  registration_type: '',
  segment_id: '',
  has_orders: '',
  is_blacklisted: '',
  attention: '',
};

const DEFAULT_CUSTOMER_SORT: SortCriterion[] = [
  { key: 'current_balance', desc: true },
  { key: 'customer_name', desc: false },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

const SORT_OPTIONS = [
  { value: 'current_balance', label: 'Balance' },
  { value: 'customer_name', label: 'Customer name' },
  { value: 'phone_number', label: 'Phone' },
  { value: 'order_count', label: 'Order count' },
  { value: 'gstin', label: 'GSTIN' },
  { value: 'created_at', label: 'Created' },
];

type QuickChip = 'all' | 'due' | 'blacklisted';
type CustomerRow = Record<string, unknown>;

function matchesQuickSearch(row: CustomerRow, search: string): boolean {
  const q = search.trim();
  if (!q) return true;
  return (
    matchesRegex(row.customer_name, q) ||
    matchesRegex(row.phone_number, q) ||
    matchesRegex(row.alternate_phone_number, q) ||
    matchesRegex(row.gstin, q) ||
    matchesRegex(row.contact_person, q)
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function balanceToneClass(tone: ReturnType<typeof formatBalance>['tone']): string {
  if (tone === 'red') return 'el-due';
  if (tone === 'green') return 'el-advance';
  return 'el-settled';
}

function activeQuickChip(filters: typeof DEFAULT_CUSTOMER_FILTERS): QuickChip {
  if (filters.attention === 'due') return 'due';
  if (filters.is_blacklisted === 'blacklisted') return 'blacklisted';
  return 'all';
}

function outstandingLabel(balance: number): string {
  if (Math.abs(balance) < 0.01) return '—';
  return formatBalance(balance).label;
}

export function CustomersListPage() {
  const navigate = useNavigate();
  const can = useCan();
  const canCreate = can('parties.customers.create');
  const { data = [], isLoading, isFetching, error, refetch } = useListCustomersQuery();
  const { data: segments = [] } = useListPartySegmentsQuery({ applies_to: 'customer', active_only: true });
  const [createCustomer, createState] = useCreateCustomerMutation();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_CUSTOMER_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(12);
  const [filters, setFilters] = useState({ ...DEFAULT_CUSTOMER_FILTERS });

  const [panel, setPanel] = useState<'filters' | 'sort' | null>(null);
  const [filterDraft, setFilterDraft] = useState<FilterValues>({ ...DEFAULT_CUSTOMER_FILTERS });
  const [sortDraft, setSortDraft] = useState<SortCriterion[]>(DEFAULT_CUSTOMER_SORT);

  const [addOpen, setAddOpen] = useState(false);
  const [values, setValues] = useState<PartyFormValues>(emptyCustomerForm());
  const [formError, setFormError] = useState('');

  const segmentOptions = useMemo(
    () =>
      segments
        .filter((s) => s.is_active !== false)
        .map((s) => ({ id: String(s.id), name: String(s.name || s.id) })),
    [segments],
  );

  const segmentNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of segmentOptions) m.set(s.id, s.name);
    return m;
  }, [segmentOptions]);

  /** Advanced dialog only — status/attention live on the segmented control. */
  const advancedFilterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'customer_name', label: 'Customer name', type: 'text', placeholder: 'Name contains…' },
      { key: 'phone_number', label: 'Phone', type: 'text', placeholder: 'Phone contains…' },
      {
        key: 'alternate_phone_number',
        label: 'Alternate phone',
        type: 'text',
        placeholder: 'Alternate phone…',
      },
      { key: 'gstin', label: 'GSTIN', type: 'text', placeholder: 'GSTIN contains…' },
      {
        key: 'registration_type',
        label: 'Registration type',
        type: 'select',
        options: REGISTRATION_TYPES.map((t) => ({ value: t, label: t })),
      },
      {
        key: 'segment_id',
        label: 'Segment',
        type: 'select',
        options: segmentOptions.map((s) => ({ value: s.id, label: s.name })),
      },
      {
        key: 'has_orders',
        label: 'Has orders',
        type: 'select',
        options: [
          { value: 'with', label: 'With orders' },
          { value: 'without', label: 'Without orders' },
        ],
      },
    ],
    [segmentOptions],
  );

  const advancedFilterCount = useMemo(
    () => advancedFilterFields.filter((f) => Boolean(filters[f.key as keyof typeof filters])).length,
    [advancedFilterFields, filters],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesQuickSearch(row, search)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (!matchesRegex(row.phone_number, filters.phone_number)) return false;
      if (!matchesRegex(row.alternate_phone_number, filters.alternate_phone_number)) return false;
      if (!matchesRegex(row.gstin, filters.gstin)) return false;
      if (filters.registration_type && String(row.registration_type || '') !== filters.registration_type) {
        return false;
      }
      if (filters.segment_id) {
        const ids = Array.isArray(row.segment_ids) ? (row.segment_ids as string[]) : [];
        if (!ids.includes(filters.segment_id)) return false;
      }
      const oc = Number(row.order_count ?? 0);
      if (filters.has_orders === 'with' && oc <= 0) return false;
      if (filters.has_orders === 'without' && oc > 0) return false;
      if (filters.is_blacklisted === 'active' && row.is_blacklisted) return false;
      if (filters.is_blacklisted === 'blacklisted' && !row.is_blacklisted) return false;
      if (filters.attention === 'due' && !(Number(row.current_balance ?? 0) > 0.01)) return false;
      return true;
    });
    rows = rows.map((row) => ({
      ...row,
      current_balance: Number(row.current_balance ?? 0),
      order_count: Number(row.order_count ?? 0),
    }));
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, search, sort]);

  const pulse = useMemo(() => {
    let dueCount = 0;
    let dueSum = 0;
    for (const row of data) {
      const bal = Number(row.current_balance ?? 0);
      if (bal > 0.01) {
        dueCount += 1;
        dueSum += bal;
      }
    }
    return { dueCount, dueSum };
  }, [data]);

  const pages = pageCount(filtered.length, pageSize);
  const safePage = Math.min(page, pages);
  const pageRows = paginate(filtered, safePage, pageSize);
  const saving = createState.isLoading;
  const chip = activeQuickChip(filters);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  useEffect(() => {
    if (panel === 'filters') setFilterDraft({ ...filters });
  }, [panel, filters]);

  useEffect(() => {
    if (panel === 'sort') setSortDraft(sort.length ? sort : DEFAULT_CUSTOMER_SORT);
  }, [panel, sort]);

  function setField(name: string, value: string) {
    setValues((p) => ({ ...p, [name]: value }));
    if (formError) setFormError('');
  }

  function openAdd() {
    setFormError('');
    setValues(emptyCustomerForm());
    setAddOpen(true);
  }

  function setQuickChip(next: QuickChip) {
    setFilters((prev) => {
      if (next === 'all') return { ...prev, attention: '', is_blacklisted: '' };
      if (next === 'due') return { ...prev, attention: 'due', is_blacklisted: '' };
      return { ...prev, attention: '', is_blacklisted: 'blacklisted' };
    });
    setPage(1);
  }

  function openCustomer(id: string) {
    navigate(`/parties/customers/${id}`);
  }

  async function submitForm() {
    const validation = validateCustomerForm(values);
    if (validation) {
      setFormError(validation);
      return;
    }
    setFormError('');
    try {
      const created = await createCustomer(customerBody(values)).unwrap();
      setAddOpen(false);
      const id = created?.id != null ? String(created.id) : '';
      if (id) {
        navigate(`/parties/customers/${id}`);
        return;
      }
      refetch();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { detail?: string } }).data?.detail || 'Save failed')
          : 'Save failed';
      setFormError(msg);
    }
  }

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Object.entries(filters).some(([k, v]) => Boolean(v) && k in DEFAULT_CUSTOMER_FILTERS);

  const columns: EntityListColumn<CustomerRow>[] = useMemo(
    () => [
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => {
          const name = displayName(row, ['customer_name'], 'Unnamed customer');
          const phone = String(row.phone_number || '').trim();
          const blacklisted = Boolean(row.is_blacklisted);
          return (
            <div className="el-customer">
              <span className="el-avatar" aria-hidden>
                {initialsFor(name)}
              </span>
              <div className="el-customer-meta">
                <span className="el-customer-name">{name}</span>
                <span className="el-customer-sub">{phone || 'No phone on file'}</span>
                {blacklisted ? <span className="el-customer-flag">Blacklisted</span> : null}
              </div>
            </div>
          );
        },
      },
      {
        id: 'outstanding',
        header: 'Outstanding',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const balance = Number(row.current_balance ?? 0);
          const bal = formatBalance(balance);
          return <span className={balanceToneClass(bal.tone)}>{outstandingLabel(balance)}</span>;
        },
      },
      {
        id: 'orders',
        header: 'Orders',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.order_count ?? 0),
      },
      {
        id: 'segment',
        header: 'Segment',
        render: (row) => {
          const segIds = Array.isArray(row.segment_ids) ? (row.segment_ids as string[]) : [];
          const firstSeg = segIds[0] ? segmentNameById.get(String(segIds[0])) || String(segIds[0]) : '';
          const extraSegs = Math.max(0, segIds.length - 1);
          const segLabel = firstSeg
            ? extraSegs > 0
              ? `${firstSeg} +${extraSegs}`
              : firstSeg
            : '—';
          return <span className={firstSeg ? undefined : 'el-muted'}>{segLabel}</span>;
        },
      },
      {
        id: 'gstin',
        header: 'GSTIN',
        render: (row) => {
          const gstin = String(row.gstin || '').trim();
          return (
            <span className={gstin ? 'el-gstin' : 'el-muted'} title={gstin || undefined}>
              {gstin || '—'}
            </span>
          );
        },
      },
    ],
    [segmentNameById],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Parties"
        title="Customers"
        count={
          <>
            {filtered.length} {filtered.length === 1 ? 'customer' : 'customers'}
            {filtered.length !== data.length ? ` · ${data.length} total` : ''}
          </>
        }
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            {canCreate ? (
              <Button type="button" onClick={openAdd}>
                Add Customer
              </Button>
            ) : null}
          </>
        }
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, phone, GSTIN…"
            aria-label="Search customers"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={chip}
            onChange={(next) => setQuickChip(next as QuickChip)}
            options={[
              { id: 'all', label: 'All' },
              { id: 'due', label: 'Due' },
              { id: 'blacklisted', label: 'Blacklisted' },
            ]}
          />
        }
        tools={
          <div className="el-tool-links">
            <button type="button" className="el-tool-link" onClick={() => setPanel('filters')}>
              More filters
              {advancedFilterCount > 0 ? <span className="el-tool-badge">{advancedFilterCount}</span> : null}
            </button>
            <button type="button" className="el-tool-link" onClick={() => setPanel('sort')}>
              Sort
            </button>
          </div>
        }
        summary={
          !isLoading && !error ? (
            <div className="el-pulse">
              <span className="el-pulse-due">
                <strong>{pulse.dueCount}</strong> due
              </span>
              <span>
                <strong>
                  ₹{pulse.dueSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </strong>{' '}
                outstanding
              </span>
            </div>
          ) : null
        }
      />

      {isLoading ? <EntityListLoading>Loading customers…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load customers. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{hasActiveFilters ? 'No matching customers' : 'No customers yet'}</strong>
          <p>
            {hasActiveFilters
              ? 'Try clearing search or filters, or adjust sort to find who you need.'
              : canCreate
                ? 'Add your first customer to start sales, boutique, and project work.'
                : 'Customers will appear here once they are created.'}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setFilters({ ...DEFAULT_CUSTOMER_FILTERS });
                setPage(1);
              }}
            >
              Clear search & filters
            </Button>
          ) : canCreate ? (
            <Button type="button" onClick={openAdd}>
              Add Customer
            </Button>
          ) : null}
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => openCustomer(String(row.id))} />
          )}
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <label className="el-page-size">
            Rows
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="el-foot-pager">
            <PaginationBar
              page={safePage}
              pageCount={pages}
              onPage={setPage}
              totalCount={filtered.length}
              pageSize={pageSize}
            />
          </div>
        </EntityListFoot>
      ) : null}

      {isFetching && !isLoading ? <EntityListRefreshing /> : null}

      <FiltersDialog
        open={panel === 'filters'}
        fields={advancedFilterFields}
        draft={filterDraft}
        onDraftChange={setFilterDraft}
        onClose={() => setPanel(null)}
        onApply={() => {
          setFilters((prev) => ({
            ...prev,
            ...Object.fromEntries(advancedFilterFields.map((f) => [f.key, filterDraft[f.key] || ''])),
          }));
          setPage(1);
          setPanel(null);
        }}
        onClear={() => {
          setFilters((prev) => ({
            ...prev,
            customer_name: '',
            phone_number: '',
            alternate_phone_number: '',
            gstin: '',
            registration_type: '',
            segment_id: '',
            has_orders: '',
          }));
          setPage(1);
          setPanel(null);
        }}
      />

      <SortDialog
        open={panel === 'sort'}
        sortOptions={SORT_OPTIONS}
        draft={sortDraft.length ? sortDraft : DEFAULT_CUSTOMER_SORT}
        onDraftChange={setSortDraft}
        onClose={() => setPanel(null)}
        onApply={() => {
          setSort(sortDraft.length ? sortDraft : DEFAULT_CUSTOMER_SORT);
          setPage(1);
          setPanel(null);
        }}
        onClear={() => {
          setSort([...DEFAULT_CUSTOMER_SORT]);
          setPage(1);
          setPanel(null);
        }}
      />

      <Modal
        title="Add Customer"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        wide
        footer={
          <>
            <Button type="button" onClick={() => void submitForm()} disabled={saving}>
              {saving ? 'Saving…' : 'Create Customer'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <CustomerFormFields values={values} onChange={setField} segmentOptions={segmentOptions} />
      </Modal>
    </EntityListPage>
  );
}
