import { useEffect, useState } from 'react';
import {
  setEnabledModules,
  setPermissions,
  useAppDispatch,
  useGetBusinessProfileQuery,
  useGetOrgEntitlementQuery,
  useGetPrefsQuery,
  useMeQuery,
  usePutPrefsMutation,
  useSetOrgModulesMutation,
  useUpdateBusinessProfileMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

const ALL_MODULES = [
  'core',
  'parties',
  'crm',
  'boutique',
  'store',
  'projects',
  'sales',
  'purchases',
  'inventory',
  'production',
  'finance',
  'schedulers',
  'migration',
  'settings',
  'system',
] as const;

const MODULE_LABELS: Record<string, string> = {
  core: 'Core',
  parties: 'Parties',
  crm: 'CRM',
  boutique: 'Boutique',
  store: 'Store',
  projects: 'Projects',
  sales: 'Sales',
  purchases: 'Purchases',
  inventory: 'Inventory',
  production: 'Production',
  finance: 'Finance',
  schedulers: 'Schedulers',
  migration: 'Migration',
  settings: 'Settings',
  system: 'System',
};

const LOCKED_MODULES = new Set(['core', 'parties', 'settings']);

const INDIAN_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

const FY_MONTHS = [
  { v: 1, label: 'January' },
  { v: 2, label: 'February' },
  { v: 3, label: 'March' },
  { v: 4, label: 'April' },
  { v: 5, label: 'May' },
  { v: 6, label: 'June' },
  { v: 7, label: 'July' },
  { v: 8, label: 'August' },
  { v: 9, label: 'September' },
  { v: 10, label: 'October' },
  { v: 11, label: 'November' },
  { v: 12, label: 'December' },
];

const REG_TYPES = ['Unregistered', 'Registered', 'Composition'] as const;

export function BusinessSettingsPage() {
  const dispatch = useAppDispatch();
  const { data, isLoading, error, refetch } = useGetBusinessProfileQuery();
  const prefsQ = useGetPrefsQuery();
  const entQ = useGetOrgEntitlementQuery();
  const [update, updateState] = useUpdateBusinessProfileMutation();
  const [putPrefs] = usePutPrefsMutation();
  const [setModules, modulesState] = useSetOrgModulesMutation();
  const meQ = useMeQuery();
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [fields, setFields] = useState<Record<string, string | boolean>>({});
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [modulesMsg, setModulesMsg] = useState('');

  useEffect(() => {
    if (data) {
      setLegalName(String(data.legal_name || ''));
      setTradeName(String(data.trade_name || ''));
      setFields({
        address_line1: String(data.address_line1 || ''),
        address_line2: String(data.address_line2 || ''),
        city: String(data.city || ''),
        state_code: String(data.state_code || ''),
        pincode: String(data.pincode || ''),
        country: String(data.country || 'India'),
        phone: String(data.phone || ''),
        email: String(data.email || ''),
        gstin: String(data.gstin || ''),
        pan: String(data.pan || ''),
        registration_type: String(data.registration_type || 'Unregistered'),
        composition_tax_rate: String(data.composition_tax_rate ?? ''),
        require_customer_name: Boolean(data.require_customer_name),
        require_customer_phone: Boolean(data.require_customer_phone),
        invoice_numbering_mode: String(data.invoice_numbering_mode || 'external'),
        invoice_number_prefix: String(data.invoice_number_prefix || ''),
        fy_start_month: String(data.fy_start_month || 4),
        fy_year_end_mode: String(data.fy_year_end_mode || 'balances_only'),
        fy_ask_at_start: Boolean(data.fy_ask_at_start),
      });
    }
  }, [data]);

  useEffect(() => {
    if (prefsQ.data?.timezone) setTimezone(prefsQ.data.timezone);
  }, [prefsQ.data]);

  useEffect(() => {
    const mods = entQ.data?.enabled_modules;
    if (Array.isArray(mods)) {
      const next = [...mods.map(String)];
      for (const locked of LOCKED_MODULES) {
        if (!next.includes(locked)) next.unshift(locked);
      }
      setSelectedModules(next);
    }
  }, [entQ.data]);

  async function onSave() {
    setMsg('');
    try {
      await update({
        legal_name: legalName,
        trade_name: tradeName,
        ...fields,
        composition_tax_rate: Number(fields.composition_tax_rate || 0),
        fy_start_month: Number(fields.fy_start_month || 4),
      }).unwrap();
      await putPrefs({ timezone }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  function toggleModule(mod: string) {
    if (LOCKED_MODULES.has(mod)) return;
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  async function onSaveModules() {
    setModulesMsg('');
    try {
      const body = Array.from(new Set([...LOCKED_MODULES, ...selectedModules]));
      const res = await setModules({ modules: body }).unwrap();
      const saved = (res.enabled_modules || body).map(String);
      setSelectedModules(saved);
      dispatch(setEnabledModules(saved));
      const meResult = await meQ.refetch();
      const meUser = meResult.data?.user as
        | { enabled_modules?: unknown[]; permissions?: unknown[] }
        | undefined;
      if (meUser) {
        if (Array.isArray(meUser.enabled_modules)) {
          dispatch(setEnabledModules(meUser.enabled_modules.map(String)));
        }
        if (Array.isArray(meUser.permissions)) {
          dispatch(setPermissions(meUser.permissions.map(String)));
        }
      }
      setModulesMsg('Enabled modules updated.');
      void entQ.refetch();
    } catch (e) {
      setModulesMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error) return <ErrorText>Failed to load business profile.</ErrorText>;
  const setField = (key: string, value: string | boolean) =>
    setFields((current) => ({ ...current, [key]: value }));
  const isComposition = String(fields.registration_type) === 'Composition';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Business settings</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <h3 style={{ marginBottom: 0 }}>Identity</h3>
        <FormRow label="Legal name">
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </FormRow>
        <FormRow label="Trade name">
          <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        </FormRow>

        <h3 style={{ marginBottom: 0 }}>Address and contact</h3>
        <FormRow label="Address line 1">
          <input value={String(fields.address_line1 || '')} onChange={(e) => setField('address_line1', e.target.value)} />
        </FormRow>
        <FormRow label="Address line 2">
          <input value={String(fields.address_line2 || '')} onChange={(e) => setField('address_line2', e.target.value)} />
        </FormRow>
        <FormRow label="City">
          <input value={String(fields.city || '')} onChange={(e) => setField('city', e.target.value)} />
        </FormRow>
        <FormRow label="State">
          <select value={String(fields.state_code || '')} onChange={(e) => setField('state_code', e.target.value)}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Pincode">
          <input value={String(fields.pincode || '')} onChange={(e) => setField('pincode', e.target.value)} />
        </FormRow>
        <FormRow label="Country">
          <input value={String(fields.country || '')} onChange={(e) => setField('country', e.target.value)} />
        </FormRow>
        <FormRow label="Phone">
          <input value={String(fields.phone || '')} onChange={(e) => setField('phone', e.target.value)} />
        </FormRow>
        <FormRow label="Email">
          <input value={String(fields.email || '')} onChange={(e) => setField('email', e.target.value)} />
        </FormRow>

        <h3 style={{ marginBottom: 0 }}>Tax and customer identity</h3>
        <FormRow label="Registration type">
          <select
            value={String(fields.registration_type || 'Unregistered')}
            onChange={(e) => setField('registration_type', e.target.value)}
          >
            {REG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="GSTIN">
          <input value={String(fields.gstin || '')} onChange={(e) => setField('gstin', e.target.value)} />
        </FormRow>
        <FormRow label="PAN">
          <input value={String(fields.pan || '')} onChange={(e) => setField('pan', e.target.value)} />
        </FormRow>
        {isComposition ? (
          <FormRow label="Composition GST rate">
            <input
              type="number"
              value={String(fields.composition_tax_rate || '')}
              onChange={(e) => setField('composition_tax_rate', e.target.value)}
            />
          </FormRow>
        ) : null}
        <label>
          <input
            type="checkbox"
            checked={Boolean(fields.require_customer_name)}
            onChange={(e) => setField('require_customer_name', e.target.checked)}
          />{' '}
          Require customer name
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(fields.require_customer_phone)}
            onChange={(e) => setField('require_customer_phone', e.target.checked)}
          />{' '}
          Require customer phone
        </label>

        <h3 style={{ marginBottom: 0 }}>Invoice and financial year</h3>
        <FormRow label="Invoice numbering">
          <select
            value={String(fields.invoice_numbering_mode || 'external')}
            onChange={(e) => setField('invoice_numbering_mode', e.target.value)}
          >
            <option value="app">App (auto-generate)</option>
            <option value="external">External</option>
          </select>
        </FormRow>
        <FormRow label="Invoice prefix">
          <input
            value={String(fields.invoice_number_prefix || '')}
            onChange={(e) => setField('invoice_number_prefix', e.target.value)}
          />
        </FormRow>
        <FormRow label="FY start month">
          <select
            value={String(fields.fy_start_month || 4)}
            onChange={(e) => setField('fy_start_month', e.target.value)}
          >
            {FY_MONTHS.map((m) => (
              <option key={m.v} value={m.v}>
                {m.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Year-end mode">
          <select
            value={String(fields.fy_year_end_mode || 'balances_only')}
            onChange={(e) => setField('fy_year_end_mode', e.target.value)}
          >
            <option value="balances_only">Balances only</option>
            <option value="full_pending">Full pending</option>
          </select>
        </FormRow>
        <label>
          <input
            type="checkbox"
            checked={Boolean(fields.fy_ask_at_start)}
            onChange={(e) => setField('fy_ask_at_start', e.target.checked)}
          />{' '}
          Ask at start of new financial year
        </label>
        <FormRow label="Timezone">
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
          Save
        </Button>
        {msg ? <p>{msg}</p> : null}

        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #d5e0da', margin: '8px 0' }} />
        <h3 style={{ marginBottom: 0 }}>Enabled modules</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#556' }}>
          Controls which product modules appear in the left panel (combined with plan, feature flags, and
          role permissions).
        </p>
        {entQ.isLoading ? (
          <p>Loading modules…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {ALL_MODULES.map((mod) => (
              <label key={mod} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={selectedModules.includes(mod)}
                  disabled={LOCKED_MODULES.has(mod)}
                  onChange={() => toggleModule(mod)}
                />
                {MODULE_LABELS[mod] || mod}
              </label>
            ))}
          </div>
        )}
        <Button type="button" onClick={onSaveModules} disabled={modulesState.isLoading || entQ.isLoading}>
          Save modules
        </Button>
        {modulesMsg ? <p>{modulesMsg}</p> : null}
      </div>
    </div>
  );
}
