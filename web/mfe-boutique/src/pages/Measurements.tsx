import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateBoutiqueMeasurementMutation,
  useDeleteBoutiqueMeasurementMutation,
  useGetBoutiqueMeasurementQuery,
  useListBoutiqueMeasurementSpecsQuery,
  useListBoutiqueMeasurementsQuery,
  useListCustomersQuery,
  useUpdateBoutiqueMeasurementMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityCard,
  EntityCardGrid,
  ErrorText,
  FormRow,
  ListToolbar,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const DEFAULT_FILTERS = { measurement_number: '', wearer_name: '', person_type: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'measurement_number', desc: true }];

function specApplies(spec: Record<string, unknown>, personType: string): boolean {
  const types = Array.isArray(spec.person_types) ? (spec.person_types as string[]) : [];
  if (types.length === 0) return true;
  return types.includes(personType);
}

function requiredSpecsFor(
  specs: Record<string, unknown>[],
  personType: string,
): Record<string, unknown>[] {
  return specs.filter((s) => Boolean(s.required) && Boolean(s.is_active !== false) && specApplies(s, personType));
}

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
  const [personType, setPersonType] = useState('Men');
  const [wearerName, setWearerName] = useState('');
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const requiredSpecs = useMemo(
    () => requiredSpecsFor(specs, personType),
    [specs, personType],
  );

  useEffect(() => {
    setValues((prev) => {
      const next: Record<string, string> = {};
      for (const s of requiredSpecs) {
        const key = String(s.key);
        next[key] = prev[key] ?? '';
      }
      return next;
    });
  }, [requiredSpecs]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'measurement_number', label: 'Number', type: 'text' },
      { key: 'wearer_name', label: 'Wearer', type: 'text' },
      { key: 'person_type', label: 'Person type', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.measurement_number, filters.measurement_number)) return false;
      if (!matchesRegex(row.wearer_name, filters.wearer_name)) return false;
      if (!matchesRegex(row.person_type, filters.person_type)) return false;
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
    const missing = requiredSpecs.filter((s) => !String(values[String(s.key)] || '').trim());
    if (missing.length) {
      setFormError(
        `Missing required measurements: ${missing.map((s) => asCaption(s.label || s.key)).join(', ')}`,
      );
      return;
    }
    try {
      const created = await createMeas({
        customer_id: customerId,
        person_type: personType,
        wearer_name: wearerName,
        notes,
        values: requiredSpecs.map((s) => ({
          key: String(s.key),
          value: String(values[String(s.key)] || '').trim(),
        })),
      }).unwrap();
      setOpen(false);
      navigate(`/boutique/measurements/${created.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <ListToolbar
        title="Measurements"
        countLabel="records"
        count={filtered.length}
        primaryLabel="New measurement"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load measurements.</ErrorText> : null}
      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={asCaption(row.measurement_number) || String(row.id)}
            captions={[
              asCaption(row.wearer_name),
              asCaption(row.person_type),
              asCaption(row.customer_id),
            ]}
            onView={() => navigate(`/boutique/measurements/${row.id}`)}
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

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
          <FormRow label="Person type">
            <select
              value={personType}
              onChange={(e) => setPersonType(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              {['Men', 'Women', 'Boy Child', 'Girl Child', 'Infant'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Wearer name">
            <TextInput value={wearerName} onChange={(e) => setWearerName(e.target.value)} />
          </FormRow>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          <h4 style={{ margin: '8px 0 0' }}>Required measurements</h4>
          {requiredSpecs.length === 0 ? (
            <p style={{ color: '#667' }}>No required specs for this person type.</p>
          ) : (
            requiredSpecs.map((s) => (
              <FormRow key={String(s.key)} label={`${asCaption(s.label || s.key)} *`}>
                <TextInput
                  value={values[String(s.key)] || ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [String(s.key)]: e.target.value }))
                  }
                />
              </FormRow>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

export function BoutiqueMeasurementDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetBoutiqueMeasurementQuery(id, { skip: !id });
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const [updateMeas] = useUpdateBoutiqueMeasurementMutation();
  const [deleteMeas] = useDeleteBoutiqueMeasurementMutation();
  const [wearerName, setWearerName] = useState('');
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');

  const personType = asCaption(data?.person_type) || 'Men';
  const requiredSpecs = useMemo(
    () => requiredSpecsFor(specs, personType),
    [specs, personType],
  );

  useEffect(() => {
    if (!data) return;
    setWearerName(String(data.wearer_name || ''));
    setNotes(String(data.notes || ''));
    const existing = Array.isArray(data.values) ? (data.values as Record<string, unknown>[]) : [];
    const map: Record<string, string> = {};
    for (const row of existing) {
      map[String(row.field_key || row.key)] = String(row.value ?? '');
    }
    for (const s of requiredSpecs) {
      const key = String(s.key);
      if (!(key in map)) map[key] = '';
    }
    setValues(map);
  }, [data, requiredSpecs]);

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Measurement not found.</ErrorText>;

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link to="/boutique/measurements">← Measurements</Link>
      </p>
      <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>
        {asCaption(data.measurement_number) || id}
      </h2>
      <p style={{ color: '#667', marginBottom: 16 }}>
        {personType} · Customer {asCaption(data.customer_id)}
      </p>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <div style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
        <FormRow label="Wearer name">
          <TextInput value={wearerName} onChange={(e) => setWearerName(e.target.value)} />
        </FormRow>
        <FormRow label="Notes">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormRow>
        <h4 style={{ margin: '8px 0 0' }}>Measurements</h4>
        {requiredSpecs.map((s) => (
          <FormRow key={String(s.key)} label={`${asCaption(s.label || s.key)} *`}>
            <TextInput
              value={values[String(s.key)] || ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [String(s.key)]: e.target.value }))
              }
            />
          </FormRow>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="button"
            onClick={async () => {
              setActionError('');
              try {
                await updateMeas({
                  id,
                  body: {
                    wearer_name: wearerName,
                    notes,
                    values: Object.entries(values).map(([key, value]) => ({ key, value })),
                  },
                }).unwrap();
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
