import { useMemo, useState } from 'react';
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
  useGetCrmSettingsQuery,
  useGetKeyboardShortcutsQuery,
  useGetPrintSettingsQuery,
  useGetProductionSettingsStubQuery,
  useListInventoryLocationsQuery,
  useListMeasurementSpecsQuery,
  useListSettingsActivitiesQuery,
  useListSettingsProjectActivitiesQuery,
  useListSettingsStoreActivitiesQuery,
  useListVendorServicesQuery,
  useUpdateCrmSettingsMutation,
  useUpdateInventoryLocationMutation,
  useUpdateKeyboardShortcutsMutation,
  useUpdateMeasurementSpecMutation,
  useUpdatePrintSettingsMutation,
  useUpdateVendorServiceMutation,
} from '@vaybooks/store';
import {
  Button,
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

export function KeyboardShortcutsPage() {
  const { data, isLoading, error, refetch } = useGetKeyboardShortcutsQuery();
  const [update, updateState] = useUpdateKeyboardShortcutsMutation();
  const parents = (data?.parents as Record<string, string>) || {};
  const actions = (data?.actions as Record<string, string>) || {};
  const [parentDraft, setParentDraft] = useState<Record<string, string>>({});
  const [actionDraft, setActionDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const rows = [
    ...Object.entries(parents).map(([key, chord]) => ({ id: `parent:${key}`, type: 'Page', key, chord: parentDraft[key] ?? chord })),
    ...Object.entries(actions).map(([key, chord]) => ({ id: `action:${key}`, type: 'Action', key, chord: actionDraft[key] ?? chord })),
  ];
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'type', header: 'Type' },
      { key: 'key', header: 'Page' },
      { key: 'chord', header: 'Shortcut' },
    ],
    [],
  );
  async function onSave() {
    setMsg('');
    try {
      await update({ parents: { ...parents, ...parentDraft }, actions: { ...actions, ...actionDraft } }).unwrap();
      setParentDraft({});
      setActionDraft({});
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Keyboard shortcuts</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load shortcuts.</ErrorText> : null}
      <p>Edit a chord and save all changes. Validity and conflicts are checked by the existing PUT API.</p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 720, marginBottom: 16 }}>
        {rows.map((row) => (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 180px', gap: 8, alignItems: 'center' }}>
            <span>{row.type}</span><span>{row.key}</span>
            <input value={row.chord} onChange={(e) => row.type === 'Page'
              ? setParentDraft((draft) => ({ ...draft, [row.key]: e.target.value }))
              : setActionDraft((draft) => ({ ...draft, [row.key]: e.target.value }))} />
          </div>
        ))}
        <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
          {updateState.isLoading ? 'Saving…' : 'Save shortcuts'}
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
          <Button
            type="button"
            onClick={() => {
              setFormError('');
              setName('');
              setDialog(true);
            }}
          >
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
        <EntityListTable columns={columns} rows={pageRows} rowKey={(row) => String(row.id)} />
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

  async function onDelete(id: string) {
    if (!window.confirm('Delete this measurement spec?')) return;
    try {
      await remove(id).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
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
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() => void onDelete(String(row.id))}
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

  async function onDelete(id: string) {
    if (!window.confirm('Delete this location?')) return;
    try {
      await deleteLoc(id).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
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
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() => void onDelete(String(row.id))}
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
        footer={
          <>
            <Button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!name || !code || createState.isLoading || updateState.isLoading}
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
      </Modal>
    </EntityListPage>
  );
}

export function CrmSettingsRedirectPage() {
  const { data, isLoading, error, refetch } = useGetCrmSettingsQuery();
  const [update, updateState] = useUpdateCrmSettingsMutation();
  const [days, setDays] = useState('');
  const [msg, setMsg] = useState('');

  async function onSave() {
    setMsg('');
    try {
      await update({
        default_follow_up_days: Number(days || data?.default_follow_up_days || 3),
      }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  return (
    <div>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>CRM settings</h2>
      <p>
        Uses <code>/api/crm/settings</code>. <Link to="/crm">CRM overview</Link>
      </p>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load CRM settings.</ErrorText> : null}
      {data ? (
        <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
          <FormRow label="Default follow-up days">
            <input
              value={days || String(data.default_follow_up_days ?? '')}
              onChange={(e) => setDays(e.target.value)}
            />
          </FormRow>
          <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
            Save
          </Button>
          {msg ? <p>{msg}</p> : null}
        </div>
      ) : null}
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
