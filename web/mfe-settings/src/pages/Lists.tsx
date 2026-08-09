import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  useCreateDiscountRuleMutation,
  useCreateInventoryLocationMutation,
  useCreateMeasurementSpecMutation,
  useCreateSettingsActivityMutation,
  useCreateSettingsProjectActivityMutation,
  useCreateSettingsStoreActivityMutation,
  useCreateVendorServiceMutation,
  useDeleteInventoryLocationMutation,
  useGetCrmSettingsQuery,
  useGetKeyboardShortcutsQuery,
  useGetPrintSettingsQuery,
  useGetProductionSettingsStubQuery,
  useListDiscountRulesQuery,
  useListInventoryLocationsQuery,
  useListMeasurementSpecsQuery,
  useListSettingsActivitiesQuery,
  useListSettingsProjectActivitiesQuery,
  useListSettingsStoreActivitiesQuery,
  useListVendorServicesQuery,
  useUpdateCrmSettingsMutation,
  useUpdateDiscountRuleMutation,
  useUpdateInventoryLocationMutation,
  useUpdateKeyboardShortcutsMutation,
  useUpdateMeasurementSpecMutation,
  useUpdatePrintSettingsMutation,
  useUpdateVendorServiceMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

const ACTIVITY_CATEGORY = 'In House Service';

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

export function CustomizationActivitiesPage() {
  const { data = [], isLoading, error, refetch } = useListSettingsActivitiesQuery();
  const [create, createState] = useCreateSettingsActivityMutation();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'activity_name', header: 'Name' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  );
  async function onCreate() {
    setFormError('');
    try {
      await create({
        activity_name: name,
        activity_category: ACTIVITY_CATEGORY,
        default_hourly_expense: 0,
      }).unwrap();
      setName('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Customization activities</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} />
    </div>
  );
}

export function StoreActivitiesSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListSettingsStoreActivitiesQuery();
  const [create, createState] = useCreateSettingsStoreActivityMutation();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'activity_name', header: 'Name' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  );
  async function onCreate() {
    setFormError('');
    try {
      await create({
        activity_name: name,
        activity_category: ACTIVITY_CATEGORY,
        default_hourly_expense: 50,
      }).unwrap();
      setName('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Store activities</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} />
    </div>
  );
}

export function ProjectActivitiesSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListSettingsProjectActivitiesQuery();
  const [create, createState] = useCreateSettingsProjectActivityMutation();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'activity_name', header: 'Name' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  );
  async function onCreate() {
    setFormError('');
    try {
      await create({
        activity_name: name,
        activity_category: ACTIVITY_CATEGORY,
        default_hourly_rate: 100,
      }).unwrap();
      setName('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Project activities</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} />
    </div>
  );
}

export function MeasurementSpecsPage() {
  const { data = [], isLoading, error, refetch } = useListMeasurementSpecsQuery();
  const [create, createState] = useCreateMeasurementSpecMutation();
  const [update] = useUpdateMeasurementSpecMutation();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [personTypes, setPersonTypes] = useState('Men');
  const [section, setSection] = useState('Torso');
  const [valueType, setValueType] = useState('number');
  const [unit, setUnit] = useState('inch');
  const [required, setRequired] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [helpText, setHelpText] = useState('');
  const [options, setOptions] = useState('');
  const [formError, setFormError] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'key', header: 'Key' },
      { key: 'label', header: 'Label' },
      { key: 'section', header: 'Section' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      await create({
        key,
        label: label || key,
        person_types: personTypes.split(',').map((value) => value.trim()).filter(Boolean),
        section,
        value_type: valueType,
        unit,
        required,
        sort_order: Number(sortOrder) || 0,
        help_text: helpText,
        options: options.split(',').map((value) => value.trim()).filter(Boolean),
      }).unwrap();
      setKey('');
      setLabel('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Measurement specs</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end', flexWrap: 'wrap' }}>
        <FormRow label="Key">
          <input value={key} onChange={(e) => setKey(e.target.value)} />
        </FormRow>
        <FormRow label="Label">
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormRow>
        <FormRow label="Person types (comma separated)"><input value={personTypes} onChange={(e) => setPersonTypes(e.target.value)} /></FormRow>
        <FormRow label="Section"><input value={section} onChange={(e) => setSection(e.target.value)} /></FormRow>
        <FormRow label="Value type"><select value={valueType} onChange={(e) => setValueType(e.target.value)}><option value="number">Number</option><option value="text">Text</option><option value="select">Select</option></select></FormRow>
        <FormRow label="Unit"><input value={unit} onChange={(e) => setUnit(e.target.value)} /></FormRow>
        <FormRow label="Sort order"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></FormRow>
        <FormRow label="Help text"><input value={helpText} onChange={(e) => setHelpText(e.target.value)} /></FormRow>
        <FormRow label="Options (comma separated)"><input value={options} onChange={(e) => setOptions(e.target.value)} /></FormRow>
        <label><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required</label>
        <Button type="button" onClick={onCreate} disabled={!key.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load specs.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} onRowClick={async (row) => {
        try {
          await update({ id: String(row.id), body: { is_active: !row.is_active } }).unwrap();
          refetch();
        } catch (e) { setFormError(extractError(e)); }
      }} />
      <p style={{ opacity: 0.7 }}>Click a spec to toggle active. Delete is available only for API-backed records through the REST endpoint.</p>
    </div>
  );
}

export function ServicesSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListVendorServicesQuery();
  const [create, createState] = useCreateVendorServiceMutation();
  const [update] = useUpdateVendorServiceMutation();
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('exp-main');
  const [formError, setFormError] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'service_name', header: 'Service' },
      { key: 'expense_account_id', header: 'Expense account' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      await create({ service_name: name, expense_account_id: accountId }).unwrap();
      setName('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Service configuration</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Expense account id">
          <input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load services.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} onRowClick={async (row) => {
        try {
          await update({ id: String(row.id), body: {
            service_name: String(row.service_name || ''),
            expense_account_id: String(row.expense_account_id || ''),
            is_active: !row.is_active,
          } }).unwrap();
          refetch();
        } catch (e) { setFormError(extractError(e)); }
      }} />
      <p style={{ opacity: 0.7 }}>Click a service to toggle active.</p>
    </div>
  );
}

export function DiscountsSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListDiscountRulesQuery();
  const [create, createState] = useCreateDiscountRuleMutation();
  const [update] = useUpdateDiscountRuleMutation();
  const [name, setName] = useState('');
  const [value, setValue] = useState('10');
  const [scope, setScope] = useState('global');
  const [discountType, setDiscountType] = useState('percent');
  const [priority, setPriority] = useState('100');
  const [applyTo, setApplyTo] = useState('sales_order,sales_invoice,customization_invoice');
  const [productIds, setProductIds] = useState('');
  const [categoryIds, setCategoryIds] = useState('');
  const [customerIds, setCustomerIds] = useState('');
  const [segmentIds, setSegmentIds] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [formError, setFormError] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'scope', header: 'Scope' },
      { key: 'value', header: 'Value' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      await create({
        name,
        scope,
        discount_type: discountType,
        value: Number(value) || 0,
        priority: Number(priority) || 100,
        apply_to: applyTo.split(',').map((item) => item.trim()).filter(Boolean),
        product_ids: productIds.split(',').map((item) => item.trim()).filter(Boolean),
        category_ids: categoryIds.split(',').map((item) => item.trim()).filter(Boolean),
        customer_ids: customerIds.split(',').map((item) => item.trim()).filter(Boolean),
        segment_ids: segmentIds.split(',').map((item) => item.trim()).filter(Boolean),
        valid_from: validFrom || undefined,
        valid_to: validTo || undefined,
        max_discount_amount: maxAmount ? Number(maxAmount) : undefined,
      }).unwrap();
      setName('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Discounts</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end', flexWrap: 'wrap' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Percent">
          <input value={value} onChange={(e) => setValue(e.target.value)} />
        </FormRow>
        <FormRow label="Scope"><select value={scope} onChange={(e) => setScope(e.target.value)}><option value="global">Global</option><option value="product">Product</option><option value="category">Category</option><option value="customer">Customer</option><option value="seasonal">Seasonal</option></select></FormRow>
        <FormRow label="Type"><select value={discountType} onChange={(e) => setDiscountType(e.target.value)}><option value="percent">Percent</option><option value="fixed">Fixed</option></select></FormRow>
        <FormRow label="Priority"><input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} /></FormRow>
        <FormRow label="Apply to (comma separated)"><input value={applyTo} onChange={(e) => setApplyTo(e.target.value)} /></FormRow>
        <FormRow label="Product IDs"><input value={productIds} onChange={(e) => setProductIds(e.target.value)} /></FormRow>
        <FormRow label="Category IDs"><input value={categoryIds} onChange={(e) => setCategoryIds(e.target.value)} /></FormRow>
        <FormRow label="Customer IDs"><input value={customerIds} onChange={(e) => setCustomerIds(e.target.value)} /></FormRow>
        <FormRow label="Segment IDs"><input value={segmentIds} onChange={(e) => setSegmentIds(e.target.value)} /></FormRow>
        <FormRow label="Valid from"><input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></FormRow>
        <FormRow label="Valid to"><input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></FormRow>
        <FormRow label="Maximum amount"><input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} /></FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load discounts.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} onRowClick={async (row) => {
        try {
          await update({ id: String(row.id), body: { is_active: !row.is_active } }).unwrap();
          refetch();
        } catch (e) { setFormError(extractError(e)); }
      }} />
      <p style={{ opacity: 0.7 }}>Click a rule to toggle active. The API supports full edits and deletion for persisted rules.</p>
    </div>
  );
}

export function SettingsLocationsPage() {
  const { data = [], isLoading, error, refetch } = useListInventoryLocationsQuery();
  const [createLoc, createState] = useCreateInventoryLocationMutation();
  const [updateLoc] = useUpdateInventoryLocationMutation();
  const [deleteLoc] = useDeleteInventoryLocationMutation();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [locationType, setLocationType] = useState('Warehouse');
  const [editId, setEditId] = useState('');
  const [msg, setMsg] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'location_type', header: 'Type' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  );

  async function onCreate() {
    setMsg('');
    try {
      await createLoc({
        name,
        code,
        address,
        location_type: locationType,
        is_active: true,
      }).unwrap();
      setName('');
      setCode('');
      setAddress('');
      setMsg('Created');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onSaveEdit() {
    if (!editId) return;
    setMsg('');
    try {
      await updateLoc({
        id: editId,
        body: {
          name,
          code,
          address,
          location_type: locationType,
          is_active: true,
        },
      }).unwrap();
      setEditId('');
      setMsg('Updated');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Locations</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Code">
          <input value={code} onChange={(e) => setCode(e.target.value)} />
        </FormRow>
        <FormRow label="Address">
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </FormRow>
        <FormRow label="Type">
          <select value={locationType} onChange={(e) => setLocationType(e.target.value)}>
            {['Warehouse', 'Store', 'Site', 'Other'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        {editId ? (
          <>
            <Button type="button" onClick={onSaveEdit} disabled={!name || !code}>
              Save edit
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditId('')}>
              Cancel
            </Button>
          </>
        ) : (
          <Button type="button" onClick={onCreate} disabled={!name || !code || createState.isLoading}>
            Create
          </Button>
        )}
      </div>
      {msg ? <p>{msg}</p> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load locations.</ErrorText> : null}
      <DataTable
        columns={columns}
        data={data as Record<string, unknown>[]}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          setEditId(String(row.id));
          setName(String(row.name || ''));
          setCode(String(row.code || ''));
          setAddress(String(row.address || ''));
          setLocationType(String(row.location_type || 'Warehouse'));
        }}
      />
      <p style={{ color: '#667', fontSize: 13 }}>Click a row to edit. Use Delete on the selected row below.</p>
      {editId ? (
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            if (!window.confirm('Delete this location?')) return;
            try {
              await deleteLoc(editId).unwrap();
              setEditId('');
              setMsg('Deleted');
              refetch();
            } catch (e) {
              setMsg(extractError(e));
            }
          }}
        >
          Delete selected
        </Button>
      ) : null}
    </div>
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
