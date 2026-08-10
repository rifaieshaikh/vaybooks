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
import {
  useCreateWorkerMutation,
  useDeactivateWorkerMutation,
  useListWorkersQuery,
  useUpdateWorkerMutation,
  useCalculateWorkerSalaryMutation,
  usePayWorkerSalaryMutation,
  useListFinanceAccountsQuery,
  useCreatePartySegmentMutation,
  useDeletePartySegmentMutation,
  useListPartySegmentsQuery,
  useUpdatePartySegmentMutation,
} from '@vaybooks/store';
import { useMemo, useState } from 'react';
import { LocationIdsField, parseLocationIds } from '../components/PartyFields';
import { Modal } from '../components/Modal';

const DEFAULT_WORKER_FILTERS = { worker_name: '', active: '' };
const DEFAULT_WORKER_SORT: SortCriterion[] = [{ key: 'worker_name', desc: false }];
const WORKER_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'worker_name', label: 'Name', type: 'text' },
  {
    key: 'active',
    label: 'Active',
    type: 'select',
    options: [
      { value: 'yes', label: 'Active' },
      { value: 'no', label: 'Inactive' },
    ],
  },
];

export function WorkersListPage() {
  const { data = [], isLoading, error, refetch } = useListWorkersQuery({ active_only: false });
  const [create] = useCreateWorkerMutation();
  const [update] = useUpdateWorkerMutation();
  const [deactivate] = useDeactivateWorkerMutation();
  const [calculateSalary, calcState] = useCalculateWorkerSalaryMutation();
  const [paySalary, payState] = usePayWorkerSalaryMutation();
  const { data: accounts = [] } = useListFinanceAccountsQuery();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_WORKER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_WORKER_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [payDialog, setPayDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('0');
  const [baseSalary, setBaseSalary] = useState('0');
  const [otThreshold, setOtThreshold] = useState('0');
  const [otMult, setOtMult] = useState('1.5');
  const [locationIds, setLocationIds] = useState('default');
  const [formError, setFormError] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [payingAccountId, setPayingAccountId] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.worker_name, filters.worker_name)) return false;
      if (filters.active === 'yes' && !row.is_active) return false;
      if (filters.active === 'no' && row.is_active) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submit() {
    setFormError('');
    const body = {
      worker_name: name,
      default_hourly_rate: Number(rate) || 0,
      base_salary: Number(baseSalary) || 0,
      ot_threshold_hours: Number(otThreshold) || 0,
      ot_multiplier: Number(otMult) || 1.5,
      activity_refs: [] as string[],
      location_ids: parseLocationIds(locationIds),
      is_active: true,
    };
    try {
      if (dialog === 'edit' && editId) await update({ id: editId, body }).unwrap();
      else await create(body).unwrap();
      setDialog(null);
      setName('');
      setRate('0');
      setBaseSalary('0');
      setOtThreshold('0');
      setOtMult('1.5');
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  type WorkerRow = (typeof data)[number];

  function openEdit(row: WorkerRow) {
    setEditId(String(row.id));
    setName(String(row.worker_name || ''));
    setRate(String(row.default_hourly_rate ?? 0));
    setBaseSalary(String(row.base_salary ?? 0));
    setOtThreshold(String(row.ot_threshold_hours ?? 0));
    setOtMult(String(row.ot_multiplier ?? 1.5));
    setLocationIds(
      Array.isArray(row.location_ids) ? (row.location_ids as string[]).join(', ') : 'default',
    );
    setFormError('');
    setDialog('edit');
  }

  function openPay(row: WorkerRow) {
    setEditId(String(row.id));
    setName(String(row.worker_name || ''));
    setPeriodFrom('');
    setPeriodTo('');
    setPayingAccountId('');
    setPreview(null);
    setFormError('');
    setPayDialog(true);
  }

  async function onPreviewSalary() {
    if (!editId || !periodFrom || !periodTo) {
      setFormError('Select a date range');
      return;
    }
    setFormError('');
    try {
      const result = await calculateSalary({
        id: editId,
        body: { period_from: periodFrom, period_to: periodTo },
      }).unwrap();
      setPreview(result);
    } catch {
      setFormError('Salary calculation failed');
    }
  }

  async function onPaySalary() {
    if (!editId || !periodFrom || !periodTo || !payingAccountId) {
      setFormError('Date range and paying account are required');
      return;
    }
    setFormError('');
    try {
      await paySalary({
        id: editId,
        body: {
          period_from: periodFrom,
          period_to: periodTo,
          paying_account_id: payingAccountId,
        },
      }).unwrap();
      setPayDialog(false);
      refetch();
    } catch {
      setFormError('Salary payment failed');
    }
  }

  async function onDeactivate(id: string) {
    if (!window.confirm('Deactivate this employee?')) return;
    await deactivate(id);
    refetch();
  }

  const columns: EntityListColumn<WorkerRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Employee',
        render: (row) => displayName(row, ['worker_name'], 'Unnamed'),
      },
      {
        id: 'rate',
        header: 'Rate',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => `₹${Number(row.default_hourly_rate ?? 0)}`,
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => (
          <span className={row.is_active ? 'el-advance' : 'el-muted'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Parties"
        title="Employees"
        count={`${filtered.length} ${filtered.length === 1 ? 'employee' : 'employees'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditId(null);
              setName('');
              setRate('0');
              setLocationIds('default');
              setFormError('');
              setDialog('add');
            }}
          >
            Add Employee
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.active || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, active: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'yes', label: 'Active' },
              { id: 'no', label: 'Inactive' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={WORKER_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_WORKER_FILTERS}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_WORKER_SORT}
            sortOptions={[
              { value: 'worker_name', label: 'Name' },
              { value: 'default_hourly_rate', label: 'Rate' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading employees…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load employees.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No employees found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={row.is_active ? () => void onDeactivate(String(row.id)) : undefined}
              deleteLabel="Deactivate"
              primary={{ label: 'Pay', onClick: () => openPay(row) }}
            />
          )}
        />
      ) : null}

      {!isLoading && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal
        title={dialog === 'edit' ? 'Edit Employee' : 'Add Employee'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Employee'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </FormRow>
          <FormRow label="Default hourly rate">
            <TextInput type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </FormRow>
          <FormRow label="Base salary (monthly)">
            <TextInput
              type="number"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
            />
          </FormRow>
          <FormRow label="OT threshold (hours)">
            <TextInput
              type="number"
              value={otThreshold}
              onChange={(e) => setOtThreshold(e.target.value)}
            />
          </FormRow>
          <FormRow label="OT multiplier">
            <TextInput type="number" value={otMult} onChange={(e) => setOtMult(e.target.value)} />
          </FormRow>
          <LocationIdsField value={locationIds} onChange={setLocationIds} />
        </div>
      </Modal>

      <Modal
        title={`Salary — ${name || 'Employee'}`}
        open={payDialog}
        onClose={() => setPayDialog(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => void onPreviewSalary()} disabled={calcState.isLoading}>
              {calcState.isLoading ? 'Calculating…' : 'Preview'}
            </Button>
            <Button type="button" onClick={() => void onPaySalary()} disabled={payState.isLoading}>
              {payState.isLoading ? 'Paying…' : 'Record payment'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPayDialog(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="From">
            <TextInput type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </FormRow>
          <FormRow label="To">
            <TextInput type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </FormRow>
          <FormRow label="Paying account">
            <select
              value={payingAccountId}
              onChange={(e) => setPayingAccountId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {String(a.account_name || a.name || a.id)}
                </option>
              ))}
            </select>
          </FormRow>
          {preview ? (
            <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
              <div>
                Hours: {String(preview.attributed_hours ?? 0)} · Total: ₹
                {Number(preview.total ?? 0).toFixed(2)}
              </div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {(Array.isArray(preview.lines) ? preview.lines : []).map((line, idx) => {
                  const item = line as { label?: string; amount?: number };
                  return (
                    <li key={idx}>
                      {item.label}: ₹{Number(item.amount ?? 0).toFixed(2)}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>
    </EntityListPage>
  );
}

const DEFAULT_SEGMENT_FILTERS = { name: '', applies: '', active: '' };
const DEFAULT_SEGMENT_SORT: SortCriterion[] = [{ key: 'name', desc: false }];
const SEGMENT_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'applies', label: 'Applies to', type: 'text', placeholder: 'customer / vendor' },
];

export function SegmentsListPage() {
  const { data = [], isLoading, error, refetch } = useListPartySegmentsQuery();
  const [create] = useCreatePartySegmentMutation();
  const [update] = useUpdatePartySegmentMutation();
  const [remove] = useDeletePartySegmentMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SEGMENT_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_SEGMENT_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [applies, setApplies] = useState('customer,vendor');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.name, filters.name)) return false;
      if (filters.applies) {
        const appliesTo = Array.isArray(row.applies_to)
          ? (row.applies_to as string[]).join(',')
          : String(row.applies_to || '');
        if (!appliesTo.toLowerCase().includes(filters.applies.toLowerCase())) return false;
      }
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submit() {
    setFormError('');
    const body = {
      name,
      applies_to: applies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      is_active: true,
    };
    try {
      if (dialog === 'edit' && editId) await update({ id: editId, body }).unwrap();
      else await create(body).unwrap();
      setDialog(null);
      setName('');
      setApplies('customer,vendor');
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  type SegmentRow = (typeof data)[number];

  function openEdit(row: SegmentRow) {
    setEditId(String(row.id));
    setName(String(row.name || ''));
    setApplies(
      Array.isArray(row.applies_to)
        ? (row.applies_to as string[]).join(',')
        : String(row.applies_to || 'customer,vendor'),
    );
    setFormError('');
    setDialog('edit');
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this segment?')) return;
    await remove(id);
    refetch();
  }

  const columns: EntityListColumn<SegmentRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Segment',
        render: (row) => displayName(row, ['name'], 'Unnamed'),
      },
      {
        id: 'applies',
        header: 'Applies to',
        render: (row) => {
          const appliesLabel = Array.isArray(row.applies_to)
            ? (row.applies_to as string[]).join(', ')
            : String(row.applies_to || '');
          return <span className={appliesLabel ? undefined : 'el-muted'}>{appliesLabel || '—'}</span>;
        },
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
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Parties"
        title="Party segments"
        count={`${filtered.length} ${filtered.length === 1 ? 'segment' : 'segments'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditId(null);
              setName('');
              setApplies('customer,vendor');
              setFormError('');
              setDialog('add');
            }}
          >
            Add Segment
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.active || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, active: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'yes', label: 'Active' },
              { id: 'no', label: 'Inactive' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={SEGMENT_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_SEGMENT_FILTERS}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SEGMENT_SORT}
            sortOptions={[{ value: 'name', label: 'Name' }]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading segments…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load segments.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No segments found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() => void onDelete(String(row.id))}
            />
          )}
        />
      ) : null}

      {!isLoading && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal
        title={dialog === 'edit' ? 'Edit Segment' : 'Add Segment'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Segment'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </FormRow>
          <FormRow label="Applies to (customer,vendor)">
            <TextInput value={applies} onChange={(e) => setApplies(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}
