import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  useCreateDiscountRuleMutation,
  useCreateMeasurementSpecMutation,
  useCreateSettingsActivityMutation,
  useCreateSettingsProjectActivityMutation,
  useCreateSettingsStoreActivityMutation,
  useCreateVendorServiceMutation,
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
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

const ACTIVITY_CATEGORY = 'In House Service';

export function PrintSettingsPage() {
  const { data, isLoading, error, refetch } = useGetPrintSettingsQuery();
  const templates = (data?.document_templates as Record<string, unknown>) || {};
  const rows = Object.keys(templates).map((key) => ({ id: key, document_type: key }));
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [{ key: 'document_type', header: 'Document type' }],
    [],
  );
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
      <p>Bank accounts: {Array.isArray(data?.bank_accounts) ? data.bank_accounts.length : 0}</p>
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

export function KeyboardShortcutsPage() {
  const { data, isLoading, error, refetch } = useGetKeyboardShortcutsQuery();
  const parents = (data?.parents as Record<string, string>) || {};
  const rows = Object.entries(parents).map(([key, chord]) => ({ id: key, key, chord }));
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'key', header: 'Page' },
      { key: 'chord', header: 'Shortcut' },
    ],
    [],
  );
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
      <DataTable columns={columns} rows={rows} />
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
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
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
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
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
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
    </div>
  );
}

export function MeasurementSpecsPage() {
  const { data = [], isLoading, error, refetch } = useListMeasurementSpecsQuery();
  const [create, createState] = useCreateMeasurementSpecMutation();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
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
        person_types: ['Men'],
        section: 'Torso',
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Key">
          <input value={key} onChange={(e) => setKey(e.target.value)} />
        </FormRow>
        <FormRow label="Label">
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!key.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load specs.</ErrorText> : null}
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
    </div>
  );
}

export function ServicesSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListVendorServicesQuery();
  const [create, createState] = useCreateVendorServiceMutation();
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
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
    </div>
  );
}

export function DiscountsSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListDiscountRulesQuery();
  const [create, createState] = useCreateDiscountRuleMutation();
  const [name, setName] = useState('');
  const [value, setValue] = useState('10');
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
        scope: 'global',
        discount_type: 'percent',
        value: Number(value) || 0,
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Percent">
          <input value={value} onChange={(e) => setValue(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load discounts.</ErrorText> : null}
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
    </div>
  );
}

export function SettingsLocationsPage() {
  const { data = [], isLoading, error, refetch } = useListInventoryLocationsQuery();
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'is_active', header: 'Active' },
    ],
    [],
  );
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Locations</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <p>
        Managed via inventory. <Link to="/inventory">Open inventory</Link>
      </p>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load locations.</ErrorText> : null}
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
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
