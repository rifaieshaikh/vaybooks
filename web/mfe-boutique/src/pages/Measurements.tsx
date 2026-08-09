import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateBoutiqueMeasurementMutation,
  useDeleteBoutiqueMeasurementMutation,
  useGetBoutiqueMeasurementQuery,
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
  PAGE_SIZE,
  PaginationBar,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import {
  MeasurementForm,
  type MeasurementFormValue,
  measurementFormMissingRequired,
} from '../MeasurementForm';
import { asCaption, extractError } from '../utils';

const PERSON_TYPES = ['Men', 'Women', 'Boy Child', 'Girl Child', 'Infant'] as const;

const DEFAULT_FILTERS = { measurement_number: '', wearer_name: '', person_type: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'measurement_number', desc: true }];

export function BoutiqueMeasurementsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListBoutiqueMeasurementsQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const [createMeas, createState] = useCreateBoutiqueMeasurementMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [form, setForm] = useState<MeasurementFormValue | null>(null);

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

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.measurement_number, filters.measurement_number)) return false;
      if (!matchesRegex(row.wearer_name, filters.wearer_name)) return false;
      if (filters.person_type && String(row.person_type || '') !== filters.person_type) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

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
        ...form,
      }).unwrap();
      setOpen(false);
      navigate(`/boutique/measurements/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  type MeasurementRow = (typeof data)[number];

  const columns: EntityListColumn<MeasurementRow>[] = useMemo(
    () => [
      {
        id: 'measurement',
        header: 'Measurement',
        render: (row) => {
          const number = displayName(row, ['measurement_number'], String(row.id));
          const wearer = asCaption(row.wearer_name) || 'No wearer';
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">{wearer}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'person_type',
        header: 'Person type',
        render: (row) => {
          const personType = asCaption(row.person_type);
          return <span className={personType ? undefined : 'el-muted'}>{personType || '—'}</span>;
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => {
          const customer = asCaption(row.customer_id);
          return <span className={customer ? undefined : 'el-muted'}>{customer || '—'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Measurements"
        count={`${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError('');
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

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
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
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const [updateMeas] = useUpdateBoutiqueMeasurementMutation();
  const [deleteMeas] = useDeleteBoutiqueMeasurementMutation();
  const [fetchPdf] = useLazyGetBoutiqueMeasurementPdfQuery();
  const [form, setForm] = useState<MeasurementFormValue | null>(null);
  const [actionError, setActionError] = useState('');

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
    };
  }, [data]);

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Measurement not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/boutique/measurements">← Measurements</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.measurement_number) || id}
          </h2>
          <p style={{ color: '#667', marginBottom: 16 }}>
            {asCaption(data.person_type)} · Customer {asCaption(data.customer_id)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            setActionError('');
            try {
              const blob = await fetchPdf(id).unwrap();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${asCaption(data.measurement_number) || id}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              setActionError(extractError(e));
            }
          }}
        >
          Download PDF
        </Button>
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <div style={{ maxWidth: 640 }}>
        <MeasurementForm key={id} initial={initial} onChange={setForm} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button
            type="button"
            onClick={async () => {
              setActionError('');
              if (!form) return;
              const missing = measurementFormMissingRequired(specs, form.person_type, form.values);
              if (missing.length) {
                setActionError(`Missing required: ${missing.join(', ')}`);
                return;
              }
              try {
                await updateMeas({ id, body: form }).unwrap();
                refetch();
              } catch (e) {
                setActionError(extractError(e));
              }
            }}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
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
        </div>
      </div>
    </div>
  );
}
