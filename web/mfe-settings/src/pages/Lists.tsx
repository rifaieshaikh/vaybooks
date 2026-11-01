import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  useCreateInventoryLocationMutation,
  useCreateMeasurementSpecMutation,
  useCreateSettingsActivityMutation,
  useCreateSettingsProjectActivityMutation,
  useCreateSettingsStoreActivityMutation,
  useCreateVendorServiceMutation,
  useDeleteInventoryLocationMutation,
  useDeleteMeasurementSpecMutation,
  useGetCrmNotificationPreferencesQuery,
  useGetCrmSettingsQuery,
  useGetPrintSettingsQuery,
  useGetProductionSettingsStubQuery,
  useListInventoryLocationsQuery,
  useListMeasurementSpecsQuery,
  useListSettingsActivitiesQuery,
  useListSettingsProjectActivitiesQuery,
  useListSettingsStoreActivitiesQuery,
  useListVendorServicesQuery,
  useUpdateCrmNotificationPreferencesMutation,
  useUpdateCrmSettingsMutation,
  useUpdateInventoryLocationMutation,
  useUpdateMeasurementSpecMutation,
  useUpdatePrintSettingsMutation,
  useUpdateVendorServiceMutation,
} from '@vaybooks/store';
import {
  Button,
  ConfirmDialog,
  DataTable,
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
  ModalForm,
  ModalFormActions,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  Select,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type DataTableColumn,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { extractError } from '../utils';

const ACTIVITY_CATEGORY = 'In House Service';

const ACTIVE_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  {
    key: 'active',
    label: 'Active',
    type: 'select',
    allLabel: 'All',
    options: [
      { value: 'yes', label: 'Active' },
      { value: 'no', label: 'Inactive' },
    ],
  },
];

function statusCell(active: boolean | undefined) {
  const on = active !== false;
  return <span className={on ? 'el-advance' : 'el-muted'}>{on ? 'Active' : 'Inactive'}</span>;
}

export function PrintSettingsPage() {
  const { data, isLoading, error, refetch } = useGetPrintSettingsQuery();
  const [update, updateState] = useUpdatePrintSettingsMutation();
  const [bankAccounts, setBankAccounts] = useState('');
  const [templates, setTemplates] = useState('');
  const [msg, setMsg] = useState('');
  const currentBanks = bankAccounts || JSON.stringify(data?.bank_accounts || [], null, 2);
  const currentTemplates = templates || JSON.stringify(data?.document_templates || {}, null, 2);
  const templateMap = (data?.document_templates as Record<string, unknown>) || {};
  const rows = Object.entries(templateMap).map(([key, template]) => ({
    id: key,
    document_type: key,
    default_bank_account_id: String((template as Record<string, unknown>).default_bank_account_id || '—'),
    terms_and_conditions: String((template as Record<string, unknown>).terms_and_conditions || '—'),
  }));
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'document_type', header: 'Document type' },
      { key: 'default_bank_account_id', header: 'Default bank' },
      { key: 'terms_and_conditions', header: 'Terms' },
    ],
    [],
  );
  async function onSave() {
    setMsg('');
    try {
      await update({
        bank_accounts: JSON.parse(currentBanks),
        document_templates: JSON.parse(currentTemplates),
      }).unwrap();
      setMsg('Saved');
      setBankAccounts('');
      setTemplates('');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Print settings</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load print settings.</ErrorText> : null}
      <p>Configure bank accounts and full document defaults (terms, custom fields, policies, and print settings).</p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 900, marginBottom: 16 }}>
        <FormRow label="Bank accounts (id, account_name, bank_name, account_number, ifsc, branch, upi_or_note, qr_code_image, is_active)">
          <textarea rows={8} value={currentBanks} onChange={(e) => setBankAccounts(e.target.value)} />
        </FormRow>
        <FormRow label="Document templates (per type: default_bank_account_id, terms_and_conditions, custom_fields, policies, print_settings)">
          <textarea rows={14} value={currentTemplates} onChange={(e) => setTemplates(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
          {updateState.isLoading ? 'Saving…' : 'Save document defaults'}
        </Button>
        {msg ? <p>{msg}</p> : null}
      </div>
      <DataTable columns={columns} data={rows} rowKey={(row) => String(row.id)} />
    </div>
  );
}

function ActivityListPage({
  kicker,
  title,
  singular,
  useList,
  useCreate,
  createBody,
}: {
  kicker: string;
  title: string;
  singular: string;
  useList: () => {
    data?: Record<string, unknown>[];
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  useCreate: () => readonly [
    (body: Record<string, unknown>) => { unwrap: () => Promise<unknown> },
    { isLoading: boolean },
  ];
  createBody: (name: string) => Record<string, unknown>;
}) {
  const { data = [], isLoading, error, refetch } = useList();
  const [create, createState] = useCreate();
  const [sort, setSort] = useState<SortCriterion[]>([{ key: 'activity_name', desc: false }]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ name: '', active: '' });
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.activity_name, filters.name)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type Row = (typeof data)[number];

  const columns: EntityListColumn<Row>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        render: (row) => displayName(row, ['activity_name'], 'Unnamed'),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => statusCell(row.is_active as boolean | undefined),
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setName('');
    setDialog(true);
  }

  async function onCreate() {
    setFormError('');
    try {
      await create(createBody(name)).unwrap();
      setName('');
      setDialog(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker={kicker}
        title={title}
        count={`${filtered.length} ${filtered.length === 1 ? singular : `${singular}s`}`}
        actions={
          <Button type="button" onClick={openCreate}>
            Add {singular}
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
            filterFields={ACTIVE_FILTER_FIELDS}
            filters={filters}
            defaultFilters={{ name: '', active: '' }}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={[{ key: 'activity_name', desc: false }]}
            sortOptions={[{ value: 'activity_name', label: 'Name' }]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No {singular}s found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onNew={openCreate}
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
        title={`Add ${singular}`}
        open={dialog}
        onClose={() => setDialog(false)}
        footer={
          <>
            <Button type="button" onClick={() => void onCreate()} disabled={!name.trim() || createState.isLoading}>
              Create
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <FormRow label="Name *">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </FormRow>
      </Modal>
    </EntityListPage>
  );
}

export function CustomizationActivitiesPage() {
  return (
    <ActivityListPage
      kicker="Settings"
      title="Customization activities"
      singular="activity"
      useList={useListSettingsActivitiesQuery}
      useCreate={useCreateSettingsActivityMutation}
      createBody={(name) => ({
        activity_name: name,
        activity_category: ACTIVITY_CATEGORY,
        default_hourly_expense: 0,
      })}
    />
  );
}

export function StoreActivitiesSettingsPage() {
  return (
    <ActivityListPage
      kicker="Settings"
      title="Store activities"
      singular="activity"
      useList={useListSettingsStoreActivitiesQuery}
      useCreate={useCreateSettingsStoreActivityMutation}
      createBody={(name) => ({
        activity_name: name,
        activity_category: ACTIVITY_CATEGORY,
        default_hourly_expense: 50,
      })}
    />
  );
}

export function ProjectActivitiesSettingsPage() {
  return (
    <ActivityListPage
      kicker="Settings"
      title="Project activities"
      singular="activity"
      useList={useListSettingsProjectActivitiesQuery}
      useCreate={useCreateSettingsProjectActivityMutation}
      createBody={(name) => ({
        activity_name: name,
        activity_category: ACTIVITY_CATEGORY,
        default_hourly_rate: 100,
      })}
    />
  );
}

type SpecForm = {
  key: string;
  label: string;
  personTypes: string;
  section: string;
  valueType: string;
  unit: string;
  required: boolean;
  sortOrder: string;
  helpText: string;
  options: string;
  isActive: boolean;
};

function emptySpecForm(): SpecForm {
  return {
    key: '',
    label: '',
    personTypes: 'Men',
    section: 'Torso',
    valueType: 'number',
    unit: 'inch',
    required: false,
    sortOrder: '0',
    helpText: '',
    options: '',
    isActive: true,
  };
}

function specFromRow(row: Record<string, unknown>): SpecForm {
  return {
    key: String(row.key || ''),
    label: String(row.label || ''),
    personTypes: Array.isArray(row.person_types)
      ? (row.person_types as string[]).join(', ')
      : String(row.person_types || 'Men'),
    section: String(row.section || 'Torso'),
    valueType: String(row.value_type || 'number'),
    unit: String(row.unit || 'inch'),
    required: Boolean(row.required),
    sortOrder: String(row.sort_order ?? 0),
    helpText: String(row.help_text || ''),
    options: Array.isArray(row.options) ? (row.options as string[]).join(', ') : String(row.options || ''),
    isActive: row.is_active !== false,
  };
}

function specBody(form: SpecForm) {
  return {
    key: form.key,
    label: form.label || form.key,
    person_types: form.personTypes
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    section: form.section,
    value_type: form.valueType,
    unit: form.unit,
    required: form.required,
    sort_order: Number(form.sortOrder) || 0,
    help_text: form.helpText,
    options: form.options
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    is_active: form.isActive,
  };
}

export function MeasurementSpecsPage() {
  const { data = [], isLoading, error, refetch } = useListMeasurementSpecsQuery();
  const [create, createState] = useCreateMeasurementSpecMutation();
  const [update, updateState] = useUpdateMeasurementSpecMutation();
  const [remove] = useDeleteMeasurementSpecMutation();

  const [sort, setSort] = useState<SortCriterion[]>([{ key: 'sort_order', desc: false }]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ name: '', active: '' });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState<SpecForm>(emptySpecForm);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filtered = useMemo(() => {
    let rows = (data as Record<string, unknown>[]).filter((row) => {
      const label = `${row.key || ''} ${row.label || ''}`;
      if (filters.name && !matchesRegex(label, filters.name)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type Row = Record<string, unknown>;

  function openAdd() {
    setFormError('');
    setEditId('');
    setForm(emptySpecForm());
    setDialog('add');
  }

  function openEdit(row: Row) {
    setFormError('');
    setEditId(String(row.id));
    setForm(specFromRow(row));
    setDialog('edit');
  }

  async function onSubmit() {
    setFormError('');
    if (!form.key.trim()) {
      setFormError('Key is required');
      return;
    }
    try {
      if (dialog === 'edit' && editId) {
        await update({ id: editId, body: specBody(form) }).unwrap();
      } else {
        await create(specBody(form)).unwrap();
      }
      setDialog(null);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setFormError('');
    try {
      await remove(deleteTarget.id).unwrap();
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const columns: EntityListColumn<Row>[] = useMemo(
    () => [
      {
        id: 'key',
        header: 'Spec',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{displayName(row, ['label', 'key'], 'Unnamed')}</span>
              <span className="el-customer-sub">{String(row.key || '')}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'section',
        header: 'Section',
        render: (row) => String(row.section || '—'),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => statusCell(row.is_active as boolean | undefined),
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Settings"
        title="Measurement specs"
        count={`${filtered.length} ${filtered.length === 1 ? 'spec' : 'specs'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add spec
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
            filterFields={[
              { key: 'name', label: 'Key / label', type: 'text' },
              ACTIVE_FILTER_FIELDS[1],
            ]}
            filters={filters}
            defaultFilters={{ name: '', active: '' }}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={[{ key: 'sort_order', desc: false }]}
            sortOptions={[
              { value: 'sort_order', label: 'Sort order' },
              { value: 'key', label: 'Key' },
              { value: 'label', label: 'Label' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {formError && !dialog ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading ? <EntityListLoading>Loading specs…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load specs.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No measurement specs found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onEditRow={(row) => openEdit(row)}
          onNew={openAdd}
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() =>
                setDeleteTarget({
                  id: String(row.id),
                  label: displayName(row, ['label', 'key'], 'this measurement spec'),
                })
              }
            />
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
        title={dialog === 'edit' ? 'Edit measurement spec' : 'Add measurement spec'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        wide
        footer={
          <>
            <Button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!form.key.trim() || createState.isLoading || updateState.isLoading}
            >
              {dialog === 'edit' ? 'Save changes' : 'Create'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <FormRow label="Key *">
            <TextInput
              value={form.key}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
              disabled={dialog === 'edit'}
              required
            />
          </FormRow>
          <FormRow label="Label">
            <TextInput
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Person types (comma separated)">
            <TextInput
              value={form.personTypes}
              onChange={(e) => setForm((p) => ({ ...p, personTypes: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Section">
            <TextInput
              value={form.section}
              onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Value type">
            <Select
              value={form.valueType}
              onChange={(e) => setForm((p) => ({ ...p, valueType: e.target.value }))}
            >
              <option value="number">Number</option>
              <option value="text">Text</option>
              <option value="select">Select</option>
            </Select>
          </FormRow>
          <FormRow label="Unit">
            <TextInput
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Sort order">
            <TextInput
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Help text">
            <TextInput
              value={form.helpText}
              onChange={(e) => setForm((p) => ({ ...p, helpText: e.target.value }))}
            />
          </FormRow>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormRow label="Options (comma separated)">
              <TextInput
                value={form.options}
                onChange={(e) => setForm((p) => ({ ...p, options: e.target.value }))}
              />
            </FormRow>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
            />
            Required
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete measurement spec?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.label}”? This cannot be undone.`
            : 'Delete this measurement spec?'
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </EntityListPage>
  );
}

export function ServicesSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListVendorServicesQuery();
  const [create, createState] = useCreateVendorServiceMutation();
  const [update, updateState] = useUpdateVendorServiceMutation();

  const [sort, setSort] = useState<SortCriterion[]>([{ key: 'service_name', desc: false }]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ name: '', active: '' });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('exp-main');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    let rows = (data as Record<string, unknown>[]).filter((row) => {
      if (!matchesRegex(row.service_name, filters.name)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type Row = Record<string, unknown>;

  function openAdd() {
    setFormError('');
    setEditId('');
    setName('');
    setAccountId('exp-main');
    setIsActive(true);
    setDialog('add');
  }

  function openEdit(row: Row) {
    setFormError('');
    setEditId(String(row.id));
    setName(String(row.service_name || ''));
    setAccountId(String(row.expense_account_id || 'exp-main'));
    setIsActive(row.is_active !== false);
    setDialog('edit');
  }

  async function onSubmit() {
    setFormError('');
    try {
      if (dialog === 'edit' && editId) {
        await update({
          id: editId,
          body: {
            service_name: name,
            expense_account_id: accountId,
            is_active: isActive,
          },
        }).unwrap();
      } else {
        await create({ service_name: name, expense_account_id: accountId }).unwrap();
      }
      setDialog(null);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  const columns: EntityListColumn<Row>[] = useMemo(
    () => [
      {
        id: 'service',
        header: 'Service',
        render: (row) => displayName(row, ['service_name'], 'Unnamed'),
      },
      {
        id: 'account',
        header: 'Expense account',
        render: (row) => String(row.expense_account_id || '—'),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => statusCell(row.is_active as boolean | undefined),
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Settings"
        title="Service configuration"
        count={`${filtered.length} ${filtered.length === 1 ? 'service' : 'services'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add service
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
            filterFields={ACTIVE_FILTER_FIELDS}
            filters={filters}
            defaultFilters={{ name: '', active: '' }}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={[{ key: 'service_name', desc: false }]}
            sortOptions={[{ value: 'service_name', label: 'Name' }]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {formError && !dialog ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading ? <EntityListLoading>Loading services…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load services.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No services found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onEditRow={(row) => openEdit(row)}
          onNew={openAdd}
          actions={(row) => <EntityListActions onEdit={() => openEdit(row)} />}
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
        title={dialog === 'edit' ? 'Edit service' : 'Add service'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!name.trim() || createState.isLoading || updateState.isLoading}
            >
              {dialog === 'edit' ? 'Save changes' : 'Create'}
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
          <FormRow label="Expense account id">
            <TextInput value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          </FormRow>
          {dialog === 'edit' ? (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          ) : null}
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function SettingsLocationsPage() {
  const { data = [], isLoading, error, refetch } = useListInventoryLocationsQuery();
  const [createLoc, createState] = useCreateInventoryLocationMutation();
  const [updateLoc, updateState] = useUpdateInventoryLocationMutation();
  const [deleteLoc] = useDeleteInventoryLocationMutation();

  const [sort, setSort] = useState<SortCriterion[]>([{ key: 'name', desc: false }]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ name: '', active: '' });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [locationType, setLocationType] = useState('Warehouse');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filtered = useMemo(() => {
    let rows = (data as Record<string, unknown>[]).filter((row) => {
      const hay = `${row.name || ''} ${row.code || ''}`;
      if (filters.name && !matchesRegex(hay, filters.name)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type Row = Record<string, unknown>;

  function resetForm() {
    setName('');
    setCode('');
    setAddress('');
    setLocationType('Warehouse');
    setIsActive(true);
    setEditId('');
  }

  function openAdd() {
    setFormError('');
    resetForm();
    setDialog('add');
  }

  function openEdit(row: Row) {
    setFormError('');
    setEditId(String(row.id));
    setName(String(row.name || ''));
    setCode(String(row.code || ''));
    setAddress(String(row.address || ''));
    setLocationType(String(row.location_type || 'Warehouse'));
    setIsActive(row.is_active !== false);
    setDialog('edit');
  }

  async function onSubmit() {
    setFormError('');
    const body = {
      name,
      code,
      address,
      location_type: locationType,
      is_active: isActive,
    };
    try {
      if (dialog === 'edit' && editId) {
        await updateLoc({ id: editId, body }).unwrap();
      } else {
        await createLoc(body).unwrap();
      }
      setDialog(null);
      resetForm();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setFormError('');
    try {
      await deleteLoc(deleteTarget.id).unwrap();
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const columns: EntityListColumn<Row>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Location',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{displayName(row, ['name'], 'Unnamed')}</span>
              <span className="el-customer-sub">{String(row.code || '')}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        render: (row) => String(row.location_type || '—'),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => statusCell(row.is_active as boolean | undefined),
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Settings"
        title="Locations"
        count={`${filtered.length} ${filtered.length === 1 ? 'location' : 'locations'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add location
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
            filterFields={[
              { key: 'name', label: 'Name / code', type: 'text' },
              ACTIVE_FILTER_FIELDS[1],
            ]}
            filters={filters}
            defaultFilters={{ name: '', active: '' }}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={[{ key: 'name', desc: false }]}
            sortOptions={[
              { value: 'name', label: 'Name' },
              { value: 'code', label: 'Code' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {formError && !dialog ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading ? <EntityListLoading>Loading locations…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load locations.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No locations yet.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onEditRow={(row) => openEdit(row)}
          onNew={openAdd}
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() =>
                setDeleteTarget({
                  id: String(row.id),
                  name: displayName(row, ['name'], 'this location'),
                })
              }
            />
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
        title={dialog === 'edit' ? 'Edit location' : 'Add location'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      >
        <ModalForm onSubmit={() => void onSubmit()}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <div style={{ display: 'grid', gap: 10 }}>
            <FormRow label="Name *">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
            </FormRow>
            <FormRow label="Code *">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} required />
            </FormRow>
            <FormRow label="Address">
              <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
            </FormRow>
            <FormRow label="Type">
              <Select value={locationType} onChange={(e) => setLocationType(e.target.value)}>
                {['Warehouse', 'Retail Store'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </FormRow>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>
          <ModalFormActions
            busy={createState.isLoading || updateState.isLoading}
            submitLabel={dialog === 'edit' ? 'Save changes' : 'Create'}
            busyLabel="Saving…"
            onCancel={() => setDialog(null)}
            submitDisabled={!name || !code}
          />
        </ModalForm>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete location?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.name}”? This cannot be undone.`
            : 'Delete this location?'
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </EntityListPage>
  );
}

const CRM_MODES = ['trade', 'retail', 'services', 'projects', 'boutique', 'light'] as const;

const CRM_FIELD_PACKS = [
  { key: 'gstin_address', label: 'GSTIN / address' },
  { key: 'sku_interest', label: 'SKU interest' },
  { key: 'appointment_duration', label: 'Appointment duration' },
  { key: 'project_site', label: 'Project site' },
  { key: 'collections', label: 'Collections' },
] as const;

/** Matches useCrmFieldVisibility MODE_PACK_DEFAULTS in mfe-crm. */
const CRM_MODE_PACK_DEFAULTS: Record<string, string[]> = {
  trade: ['gstin_address', 'sku_interest', 'collections'],
  retail: ['sku_interest'],
  services: ['appointment_duration'],
  boutique: ['appointment_duration'],
  projects: ['project_site', 'gstin_address'],
  light: [],
};

const CRM_CATALOG_FIELDS = [
  { key: 'lead_sources', label: 'Lead sources' },
  { key: 'lead_statuses', label: 'Lead statuses' },
  { key: 'enquiry_statuses', label: 'Enquiry statuses' },
  { key: 'activity_types', label: 'Activity types' },
  { key: 'activity_outcomes', label: 'Activity outcomes' },
  { key: 'lost_reasons', label: 'Lost reasons' },
] as const;

const CRM_NOTIF_KEYS = [
  { key: 'activity_due_today', label: 'Activity due today' },
  { key: 'upcoming_visits', label: 'Upcoming visits' },
  { key: 'overdue_follow_ups', label: 'Overdue follow-ups' },
  { key: 'lead_assigned', label: 'Lead assigned' },
  { key: 'enquiry_reassigned', label: 'Enquiry reassigned' },
  { key: 'payment_promises', label: 'Payment promises' },
  { key: 'high_priority_idle', label: 'High-priority idle' },
  { key: 'payment_reminder_due', label: 'Payment reminder due' },
] as const;

const CUSTOM_FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'select'] as const;

type CatalogItem = {
  label: string;
  active?: boolean;
  sort_order?: number;
  outcome_required?: boolean;
  automatic?: boolean;
  key?: string;
};

type CustomFieldDefDraft = {
  key: string;
  label: string;
  type: string;
  options: string;
  required: boolean;
};

function packsFromMode(mode: string): Record<string, boolean> {
  const enabled = new Set(CRM_MODE_PACK_DEFAULTS[mode] || CRM_MODE_PACK_DEFAULTS.trade);
  const next: Record<string, boolean> = {};
  for (const pack of CRM_FIELD_PACKS) {
    next[pack.key] = enabled.has(pack.key);
  }
  return next;
}

function packsFromSettings(fieldPacks: unknown, mode: string): Record<string, boolean> {
  if (Array.isArray(fieldPacks)) {
    const enabled = new Set(fieldPacks.map((p) => String(p || '').trim()).filter(Boolean));
    if (enabled.size === 0) return packsFromMode(mode);
    const next: Record<string, boolean> = {};
    for (const pack of CRM_FIELD_PACKS) {
      next[pack.key] = enabled.has(pack.key);
    }
    return next;
  }
  if (!fieldPacks || typeof fieldPacks !== 'object') {
    return packsFromMode(mode);
  }
  const obj = fieldPacks as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return packsFromMode(mode);
  const next: Record<string, boolean> = {};
  for (const pack of CRM_FIELD_PACKS) {
    const val = obj[pack.key];
    if (val === undefined) {
      next[pack.key] = false;
      continue;
    }
    if (val === false || val === 0 || val === 'false') {
      next[pack.key] = false;
      continue;
    }
    if (val && typeof val === 'object' && 'enabled' in (val as object)) {
      next[pack.key] = (val as { enabled?: unknown }).enabled !== false;
      continue;
    }
    next[pack.key] = true;
  }
  return next;
}

function normalizeCatalogItems(raw: unknown): CatalogItem[] {
  if (!Array.isArray(raw)) return [];
  const items: CatalogItem[] = [];
  raw.forEach((item, index) => {
    if (typeof item === 'string') {
      const label = item.trim();
      if (label) items.push({ label, active: true, sort_order: index });
      return;
    }
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const label = String(row.label || row.name || '').trim();
    if (!label) return;
    items.push({
      label,
      active: row.active !== false,
      sort_order: Number(row.sort_order ?? index),
      outcome_required: Boolean(row.outcome_required),
      automatic: Boolean(row.automatic),
      key: row.key != null ? String(row.key) : undefined,
    });
  });
  return items.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function catalogItemsForSave(items: CatalogItem[]): CatalogItem[] {
  return items.map((item, index) => ({
    ...item,
    label: item.label.trim(),
    active: item.active !== false,
    sort_order: index,
  }));
}

function normalizeCustomFieldDefs(raw: unknown): CustomFieldDefDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const options = Array.isArray(row.options)
      ? row.options.map((o) => String(o)).join(', ')
      : String(row.options || '');
    return {
      key: String(row.key || row.id || `field_${index + 1}`),
      label: String(row.label || ''),
      type: String(row.type || 'text').toLowerCase(),
      options,
      required: Boolean(row.required),
    };
  });
}

function customFieldDefsForSave(defs: CustomFieldDefDraft[]): Record<string, unknown>[] {
  return defs
    .map((def) => {
      const key = def.key.trim();
      if (!key) return null;
      const type = CUSTOM_FIELD_TYPES.includes(def.type as (typeof CUSTOM_FIELD_TYPES)[number])
        ? def.type
        : 'text';
      const row: Record<string, unknown> = {
        key,
        label: def.label.trim() || key,
        type,
        required: Boolean(def.required),
      };
      if (type === 'select') {
        row.options = def.options
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
      }
      return row;
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function LabelListEditor({
  label,
  items,
  onChange,
  showOutcomeRequired = false,
}: {
  label: string;
  items: CatalogItem[];
  onChange: (next: CatalogItem[]) => void;
  showOutcomeRequired?: boolean;
}) {
  const [draft, setDraft] = useState('');

  function addItem() {
    const value = draft.trim();
    if (!value) return;
    if (items.some((item) => item.label.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...items, { label: value, active: true, sort_order: items.length }]);
    setDraft('');
  }

  function move(index: number, delta: number) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(nextIndex, 0, row);
    onChange(next);
  }

  return (
    <FormRow label={label}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.length === 0 ? <span style={{ color: '#667' }}>No items yet</span> : null}
          {items.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                border: '1px solid #d5ddd9',
                borderRadius: 999,
                background: '#f7faf8',
                fontSize: '0.9rem',
              }}
            >
              <span>{item.label}</span>
              {showOutcomeRequired ? (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.outcome_required)}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...item, outcome_required: e.target.checked };
                      onChange(next);
                    }}
                    title="Outcome required"
                  />
                  outcome
                </label>
              ) : null}
              <button type="button" className="el-btn-ghost" onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </button>
              <button
                type="button"
                className="el-btn-ghost"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
              >
                ↓
              </button>
              <button
                type="button"
                className="el-btn-ghost"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                aria-label={`Remove ${item.label}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Add label…"
            style={{ minWidth: 180, flex: 1 }}
          />
          <Button type="button" variant="ghost" onClick={addItem}>
            Add
          </Button>
        </div>
      </div>
    </FormRow>
  );
}

function CustomFieldDefsEditor({
  defs,
  onChange,
}: {
  defs: CustomFieldDefDraft[];
  onChange: (next: CustomFieldDefDraft[]) => void;
}) {
  function updateRow(index: number, patch: Partial<CustomFieldDefDraft>) {
    const next = [...defs];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Custom field definitions</h4>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            onChange([
              ...defs,
              {
                key: `field_${defs.length + 1}`,
                label: '',
                type: 'text',
                options: '',
                required: false,
              },
            ])
          }
        >
          Add field
        </Button>
      </div>
      {defs.length === 0 ? <p style={{ margin: 0, color: '#667' }}>No custom fields defined.</p> : null}
      {defs.map((def, index) => (
        <div
          key={`cdef-${index}`}
          style={{
            display: 'grid',
            gap: 8,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            padding: 12,
            border: '1px solid #e2e8e4',
            borderRadius: 8,
          }}
        >
          <FormRow label="Key">
            <input value={def.key} onChange={(e) => updateRow(index, { key: e.target.value })} />
          </FormRow>
          <FormRow label="Label">
            <input value={def.label} onChange={(e) => updateRow(index, { label: e.target.value })} />
          </FormRow>
          <FormRow label="Type">
            <Select value={def.type} onChange={(e) => updateRow(index, { type: e.target.value })}>
              {CUSTOM_FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormRow>
          {def.type === 'select' ? (
            <FormRow label="Options (comma-separated)">
              <input
                value={def.options}
                onChange={(e) => updateRow(index, { options: e.target.value })}
                placeholder="A, B, C"
              />
            </FormRow>
          ) : null}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'end' }}>
            <input
              type="checkbox"
              checked={def.required}
              onChange={(e) => updateRow(index, { required: e.target.checked })}
            />
            Required
          </label>
          <div style={{ alignSelf: 'end' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(defs.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CrmSettingsRedirectPage() {
  const { data, isLoading, error, refetch } = useGetCrmSettingsQuery();
  const [update, updateState] = useUpdateCrmSettingsMutation();
  const {
    data: notifPrefs,
    isLoading: notifLoading,
    error: notifError,
    refetch: refetchNotif,
  } = useGetCrmNotificationPreferencesQuery();
  const [updateNotif, notifUpdateState] = useUpdateCrmNotificationPreferencesMutation();

  const [catalogs, setCatalogs] = useState<Record<string, CatalogItem[]>>({});
  const [followUpDays, setFollowUpDays] = useState('');
  const [inactivityDays, setInactivityDays] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [paymentTemplate, setPaymentTemplate] = useState('');
  const [paymentOffsets, setPaymentOffsets] = useState('');
  const [orderTriggerStatus, setOrderTriggerStatus] = useState('');
  const [paymentTrigger, setPaymentTrigger] = useState('');
  const [calendarDrag, setCalendarDrag] = useState(true);
  const [customFields, setCustomFields] = useState(true);
  const [crmMode, setCrmMode] = useState('trade');
  const [fieldPacks, setFieldPacks] = useState<Record<string, boolean>>(() => packsFromMode('trade'));
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefDraft[]>([]);
  /** True after the user manually toggles packs; mode change then keeps their choices. */
  const [packsCustomized, setPacksCustomized] = useState(false);
  const [notifDraft, setNotifDraft] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [settingsEpoch, setSettingsEpoch] = useState(0);
  const [notifEpoch, setNotifEpoch] = useState(0);

  useEffect(() => {
    if (!data) return;
    const nextCatalogs: Record<string, CatalogItem[]> = {};
    for (const field of CRM_CATALOG_FIELDS) {
      nextCatalogs[field.key] = normalizeCatalogItems(data[field.key]);
    }
    setCatalogs(nextCatalogs);
    setFollowUpDays(String(data.default_follow_up_days ?? 3));
    setInactivityDays(String(data.default_inactivity_days ?? 30));
    setBusinessName(String(data.business_display_name ?? ''));
    setPaymentTemplate(String(data.payment_reminder_template ?? ''));
    setPaymentOffsets(
      Array.isArray(data.payment_reminder_due_offsets_days)
        ? (data.payment_reminder_due_offsets_days as number[]).join(', ')
        : '0, 3, 7',
    );
    setOrderTriggerStatus(String(data.order_trigger_status ?? 'Confirmed'));
    setPaymentTrigger(String(data.payment_trigger ?? 'receipt_create'));
    setCalendarDrag(data.calendar_drag_enabled !== false);
    setCustomFields(data.custom_fields_enabled !== false);
    const mode = String(data.crm_mode || 'trade');
    setCrmMode(mode);
    setFieldPacks(packsFromSettings(data.field_packs, mode));
    setCustomFieldDefs(normalizeCustomFieldDefs(data.custom_field_defs));
    setPacksCustomized(false);
  }, [data, settingsEpoch]);

  useEffect(() => {
    if (!notifPrefs) return;
    const next: Record<string, boolean> = {};
    for (const item of CRM_NOTIF_KEYS) {
      next[item.key] = notifPrefs[item.key] !== false;
    }
    setNotifDraft(next);
  }, [notifPrefs, notifEpoch]);

  function onModeChange(mode: string) {
    setCrmMode(mode);
    if (!packsCustomized) {
      setFieldPacks(packsFromMode(mode));
    }
  }

  function onPackToggle(key: string, checked: boolean) {
    setPacksCustomized(true);
    setFieldPacks((prev) => ({ ...prev, [key]: checked }));
  }

  async function onSaveSettings() {
    setMsg('');
    try {
      // Checkboxes are the source of truth for field_packs on save.
      const body: Record<string, unknown> = {
        default_follow_up_days: Number(followUpDays || 3),
        default_inactivity_days: Number(inactivityDays || 30),
        business_display_name: businessName,
        payment_reminder_template: paymentTemplate,
        payment_reminder_due_offsets_days: paymentOffsets
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((n) => Number.isFinite(n)),
        order_trigger_status: orderTriggerStatus,
        payment_trigger: paymentTrigger,
        calendar_drag_enabled: calendarDrag,
        custom_fields_enabled: customFields,
        crm_mode: crmMode,
        field_packs: { ...fieldPacks },
        custom_field_defs: customFieldDefsForSave(customFieldDefs),
      };
      for (const field of CRM_CATALOG_FIELDS) {
        body[field.key] = catalogItemsForSave(catalogs[field.key] || []);
      }
      await update(body).unwrap();
      setMsg('CRM settings saved');
      setSettingsEpoch((n) => n + 1);
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onSaveNotifications() {
    setNotifMsg('');
    try {
      await updateNotif(notifDraft).unwrap();
      setNotifMsg('Notification preferences saved');
      setNotifEpoch((n) => n + 1);
      refetchNotif();
    } catch (e) {
      setNotifMsg(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>CRM settings</h2>
        <Link to="/crm">CRM overview</Link>
      </div>
      <p style={{ color: '#667' }}>Configure catalogs, automation defaults, WhatsApp reminders, and kill switches.</p>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load CRM settings.</ErrorText> : null}

      {data ? (
        <div style={{ display: 'grid', gap: 20, maxWidth: 920 }}>
          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Catalogs</h3>
            <p style={{ margin: 0, color: '#667', fontSize: '0.9rem' }}>
              Add, remove, or reorder labels. Activity types can mark outcome required.
            </p>
            {CRM_CATALOG_FIELDS.map((field) => (
              <LabelListEditor
                key={field.key}
                label={field.label}
                items={catalogs[field.key] || []}
                showOutcomeRequired={field.key === 'activity_types'}
                onChange={(next) => setCatalogs((prev) => ({ ...prev, [field.key]: next }))}
              />
            ))}
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Automation</h3>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <FormRow label="Default follow-up days">
                <input
                  type="number"
                  min={0}
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(e.target.value)}
                />
              </FormRow>
              <FormRow label="Default inactivity days">
                <input
                  type="number"
                  min={0}
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(e.target.value)}
                />
              </FormRow>
              <FormRow label="Order trigger status">
                <input
                  value={orderTriggerStatus}
                  onChange={(e) => setOrderTriggerStatus(e.target.value)}
                />
              </FormRow>
              <FormRow label="Payment trigger">
                <input value={paymentTrigger} onChange={(e) => setPaymentTrigger(e.target.value)} />
              </FormRow>
            </div>
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>WhatsApp / payment reminder</h3>
            <FormRow label="Business display name">
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </FormRow>
            <FormRow label="Payment reminder template">
              <textarea
                rows={5}
                value={paymentTemplate}
                onChange={(e) => setPaymentTemplate(e.target.value)}
                style={{ width: '100%' }}
              />
            </FormRow>
            <FormRow label="Reminder due offsets (days, comma-separated)">
              <input value={paymentOffsets} onChange={(e) => setPaymentOffsets(e.target.value)} />
            </FormRow>
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Kill switches</h3>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={calendarDrag}
                onChange={(e) => setCalendarDrag(e.target.checked)}
              />
              Calendar drag enabled
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={customFields}
                onChange={(e) => setCustomFields(e.target.checked)}
              />
              Custom fields enabled
            </label>
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Mode & field packs</h3>
            <FormRow label="CRM mode">
              <Select value={crmMode} onChange={(e) => onModeChange(e.target.value)}>
                {CRM_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </Select>
            </FormRow>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Field packs</span>
              <p style={{ margin: 0, color: '#667', fontSize: '0.9rem' }}>
                Changing mode applies pack presets unless you already customized packs in this
                session. Checkboxes are saved as-is.
              </p>
              {CRM_FIELD_PACKS.map((pack) => (
                <label key={pack.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(fieldPacks[pack.key])}
                    onChange={(e) => onPackToggle(pack.key, e.target.checked)}
                  />
                  {pack.label}
                </label>
              ))}
            </div>
            <CustomFieldDefsEditor defs={customFieldDefs} onChange={setCustomFieldDefs} />
          </section>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button type="button" onClick={() => void onSaveSettings()} disabled={updateState.isLoading}>
              {updateState.isLoading ? 'Saving…' : 'Save CRM settings'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSettingsEpoch((n) => n + 1);
                refetch();
              }}
            >
              Reset
            </Button>
            {msg ? <p style={{ margin: 0 }}>{msg}</p> : null}
          </div>
        </div>
      ) : null}

      <section style={{ display: 'grid', gap: 12, maxWidth: 920, marginTop: 32 }}>
        <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Notification preferences</h3>
        <p style={{ margin: 0, color: '#667', fontSize: '0.9rem' }}>
          Per-user CRM notification toggles from <code>/api/crm/notifications/preferences</code>.
        </p>
        {notifLoading ? <p>Loading preferences…</p> : null}
        {notifError ? <ErrorText>Failed to load notification preferences.</ErrorText> : null}
        {notifPrefs ? (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {CRM_NOTIF_KEYS.map((item) => (
                <label key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={notifDraft[item.key] !== false}
                    onChange={(e) =>
                      setNotifDraft((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                type="button"
                onClick={() => void onSaveNotifications()}
                disabled={notifUpdateState.isLoading}
              >
                {notifUpdateState.isLoading ? 'Saving…' : 'Save notifications'}
              </Button>
              {notifMsg ? <p style={{ margin: 0 }}>{notifMsg}</p> : null}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

export function ProductionSettingsLinkPage() {
  const { data, isLoading } = useGetProductionSettingsStubQuery();
  if (isLoading) return <p>Loading…</p>;
  return (
    <div>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Production settings</h2>
      <p>{String(data?.message || 'Coming soon')}</p>
      <p>
        <Link to="/production">Go to production module</Link>
      </p>
    </div>
  );
}

export function SettingsHomeRedirect() {
  return <Navigate to="/business-settings" replace />;
}
