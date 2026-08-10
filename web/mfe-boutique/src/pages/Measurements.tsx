import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateBoutiqueMeasurementMutation,
  useDeleteBoutiqueMeasurementMutation,
  useGetBoutiqueMeasurementQuery,
  useGetCustomerQuery,
  useLazyGetBoutiqueMeasurementPdfQuery,
  useListBoutiqueMeasurementSpecsQuery,
  useListBoutiqueMeasurementsQuery,
  useListCustomersQuery,
  useUpdateBoutiqueMeasurementMutation,
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
  PaginationBar,
  displayName,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import {
  LIST_PAGE_SIZE,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
} from '../pagedList';
import {
  MeasurementForm,
  type MeasurementFormValue,
  measurementFormMissingRequired,
} from '../MeasurementForm';
import { asCaption, extractError } from '../utils';
import '../MeasurementDetail.css';

const PERSON_TYPES = ['Men', 'Women', 'Boy Child', 'Girl Child', 'Infant'] as const;

const DEFAULT_FILTERS = { measurement_number: '', wearer_name: '', person_type: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'measurement_number', desc: true }];

export function BoutiqueMeasurementsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [form, setForm] = useState<MeasurementFormValue | null>(null);

  const { data, isLoading, error } = useListBoutiqueMeasurementsQuery({
    measurement_number: filters.measurement_number || undefined,
    wearer_name: filters.wearer_name || undefined,
    person_type: filters.person_type || undefined,
    ...sortQueryParams(sort),
    page,
    page_size: LIST_PAGE_SIZE,
  });
  const { data: customers = [] } = useListCustomersQuery();
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const [createMeas, createState] = useCreateBoutiqueMeasurementMutation();

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, LIST_PAGE_SIZE);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cust of customers) {
      const id = String(cust.id || '');
      if (!id) continue;
      map.set(id, asCaption(cust.customer_name || cust.name) || id);
    }
    return map;
  }, [customers]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'measurement_number', label: 'Number', type: 'text' },
      { key: 'wearer_name', label: 'Wearer', type: 'text' },
      {
        key: 'person_type',
        label: 'Person type',
        type: 'select',
        allLabel: 'All types',
        options: PERSON_TYPES.map((t) => ({ value: t, label: t })),
      },
    ],
    [],
  );

  type MeasRow = (typeof pageRows)[number];

  const columns: EntityListColumn<MeasRow>[] = useMemo(
    () => [
      {
        id: 'measurement',
        header: 'Measurement',
        render: (row) => {
          const number = displayName(row, ['measurement_number'], String(row.id));
          const wearer = asCaption(row.wearer_name) || 'No wearer';
          const customer = customerNameById.get(String(row.customer_id || '')) || '—';
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">
                  {wearer} · {customer}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'person_type',
        header: 'Person type',
        render: (row) => {
          const pt = asCaption(row.person_type);
          return <span className={pt ? undefined : 'el-muted'}>{pt || '—'}</span>;
        },
      },
    ],
    [customerNameById],
  );

  async function onCreate() {
    setFormError('');
    if (!customerId) {
      setFormError('Customer is required');
      return;
    }
    if (!form) {
      setFormError('Fill in measurement fields');
      return;
    }
    const missing = measurementFormMissingRequired(specs, form.person_type, form.values);
    if (missing.length) {
      setFormError(`Missing required: ${missing.join(', ')}`);
      return;
    }
    try {
      const created = await createMeas({
        customer_id: customerId,
        person_type: form.person_type,
        wearer_name: form.wearer_name,
        wearer_age: form.wearer_age,
        wearer_height: form.wearer_height,
        wearer_weight: form.wearer_weight,
        unit: form.unit,
        fit_preference: form.fit_preference,
        notes: form.notes,
        print_notes: form.print_notes,
        measured_at: form.measured_at || undefined,
        measured_by: form.measured_by,
        values: form.values,
      }).unwrap();
      setOpen(false);
      navigate(`/boutique/measurements/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Measurements"
        count={`${total} ${total === 1 ? 'measurement' : 'measurements'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setCustomerId('');
              setForm(null);
              setOpen(true);
            }}
          >
            New measurement
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Person type"
            value={filters.person_type || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, person_type: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...PERSON_TYPES.map((t) => ({ id: t, label: t })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['person_type']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'measurement_number', label: 'Number' },
              { value: 'person_type', label: 'Person type' },
              { value: 'wearer_name', label: 'Wearer' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading measurements…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load measurements.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No measurements found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/boutique/measurements/${row.id}`)} />
          )}
        />
      ) : null}

      {!isLoading && !error && total > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar
              page={Math.min(page, pages)}
              pageCount={pages}
              onPage={setPage}
              totalCount={total}
              pageSize={LIST_PAGE_SIZE}
            />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal
        open={open}
        title="New measurement"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onCreate} disabled={createState.isLoading || !customerId}>
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflow: 'auto' }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Customer *">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select customer</option>
              {customers.map((cust) => (
                <option key={String(cust.id)} value={String(cust.id)}>
                  {asCaption(cust.customer_name || cust.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <MeasurementForm onChange={setForm} />
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function BoutiqueMeasurementDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetBoutiqueMeasurementQuery(id, { skip: !id });
  const customerId = data ? String(data.customer_id || '') : '';
  const { data: customer } = useGetCustomerQuery(customerId, { skip: !customerId });
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const [updateMeas, updateState] = useUpdateBoutiqueMeasurementMutation();
  const [deleteMeas, deleteState] = useDeleteBoutiqueMeasurementMutation();
  const [fetchPdf] = useLazyGetBoutiqueMeasurementPdfQuery();
  const [form, setForm] = useState<MeasurementFormValue | null>(null);
  const [actionError, setActionError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const initial = useMemo(() => {
    if (!data) return undefined;
    return {
      person_type: String(data.person_type || 'Men'),
      wearer_name: String(data.wearer_name || ''),
      wearer_age: String(data.wearer_age || ''),
      wearer_height: String(data.wearer_height || ''),
      wearer_weight: String(data.wearer_weight || ''),
      fit_preference: String(data.fit_preference || 'Regular'),
      unit: String(data.unit || 'inch'),
      measured_by: String(data.measured_by || ''),
      measured_at: String(data.measured_at || ''),
      notes: String(data.notes || ''),
      print_notes: String(data.print_notes || ''),
      values: Array.isArray(data.values)
        ? (data.values as MeasurementFormValue['values'])
        : [],
    } satisfies MeasurementFormValue;
  }, [data]);

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  if (isLoading) return <EntityListLoading>Loading measurement…</EntityListLoading>;
  if (error || !data) return <ErrorText>Measurement not found.</ErrorText>;

  const customerName =
    asCaption(customer?.customer_name || customer?.name) || asCaption(data.customer_id) || '—';
  const customerPhone = asCaption(customer?.phone_number || customer?.phone);
  const measurementNumber = asCaption(data.measurement_number) || id;
  const wearer = asCaption(form?.wearer_name || data.wearer_name) || '—';
  const personType = asCaption(form?.person_type || data.person_type) || '—';
  const measuredAt = asCaption(form?.measured_at || data.measured_at).slice(0, 10) || '—';
  const filled = (form?.values || []).filter((v) => String(v.value || '').trim()).length;

  async function onSave() {
    setActionError('');
    setSaveOk(false);
    const payload = form || initial;
    if (!payload) return;
    const missing = measurementFormMissingRequired(specs, payload.person_type, payload.values);
    if (missing.length) {
      setActionError(`Missing required: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      await updateMeas({ id, body: payload }).unwrap();
      setSaveOk(true);
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    } finally {
      setSaving(false);
    }
  }

  async function onPdf() {
    setActionError('');
    try {
      const blob = await fetchPdf(id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${measurementNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  return (
    <div className="md">
      <Link className="md-back" to="/boutique/measurements">
        ← Measurements
      </Link>

      <header className="md-hero">
        <div>
          <p className="md-kicker">Boutique measurement</p>
          <h1>{measurementNumber}</h1>
          <p className="md-lead">
            Reusable for this customer&apos;s future customization orders.
          </p>
        </div>
        <div className="md-hero-actions">
          {customerId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/parties/customers/${customerId}`)}
            >
              Open customer
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void onPdf()}>
            Download PDF
          </Button>
        </div>
      </header>

      <div className="md-snapshot">
        <div className="md-stat">
          <span>Customer</span>
          <strong title={customerName}>
            {customerName}
            {customerPhone ? ` · ${customerPhone}` : ''}
          </strong>
        </div>
        <div className="md-stat">
          <span>Wearer</span>
          <strong>{wearer}</strong>
        </div>
        <div className="md-stat">
          <span>Person type</span>
          <strong>{personType}</strong>
        </div>
        <div className="md-stat">
          <span>Measured</span>
          <strong>
            {measuredAt}
            {filled ? ` · ${filled} values` : ''}
          </strong>
        </div>
      </div>

      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      {saveOk && !actionError ? (
        <p className="md-lead" style={{ color: 'var(--md-accent)', marginBottom: 12 }}>
          Measurement saved.
        </p>
      ) : null}

      <MeasurementForm key={id} initial={initial} layout="detail" onChange={setForm} />

      <div className="md-actions">
        <div className="md-actions-hint">
          Save before using this sheet on a new garment.
        </div>
        <div className="md-actions-right">
          <Button
            type="button"
            variant="ghost"
            disabled={deleteState.isLoading}
            onClick={async () => {
              if (!window.confirm('Delete this measurement?')) return;
              setActionError('');
              try {
                await deleteMeas(id).unwrap();
                navigate('/boutique/measurements');
              } catch (e) {
                setActionError(extractError(e));
              }
            }}
          >
            Delete
          </Button>
          <Button
            type="button"
            disabled={saving || updateState.isLoading}
            onClick={() => void onSave()}
          >
            {saving || updateState.isLoading ? 'Saving…' : 'Save measurement'}
          </Button>
        </div>
      </div>
    </div>
  );
}
