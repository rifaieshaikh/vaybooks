import { useEffect, useState } from 'react';
import {
  useGetBusinessProfileQuery,
  useGetPrefsQuery,
  usePutPrefsMutation,
  useUpdateBusinessProfileMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export function BusinessSettingsPage() {
  const { data, isLoading, error, refetch } = useGetBusinessProfileQuery();
  const prefsQ = useGetPrefsQuery();
  const [update, updateState] = useUpdateBusinessProfileMutation();
  const [putPrefs] = usePutPrefsMutation();
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [fields, setFields] = useState<Record<string, string | boolean>>({});
  const [msg, setMsg] = useState('');

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

  if (isLoading) return <p>Loading…</p>;
  if (error) return <ErrorText>Failed to load business profile.</ErrorText>;
  const setField = (key: string, value: string | boolean) => setFields((current) => ({ ...current, [key]: value }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Business settings</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <FormRow label="Legal name">
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </FormRow>
        <FormRow label="Trade name">
          <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        </FormRow>
        <h3 style={{ marginBottom: 0 }}>Address and contact</h3>
        {(['address_line1', 'address_line2', 'city', 'state_code', 'pincode', 'country', 'phone', 'email'] as const).map((key) => (
          <FormRow key={key} label={key.replace(/_/g, ' ')}>
            <input value={String(fields[key] || '')} onChange={(e) => setField(key, e.target.value)} />
          </FormRow>
        ))}
        <h3 style={{ marginBottom: 0 }}>Tax and customer identity</h3>
        <FormRow label="Registration type"><input value={String(fields.registration_type || '')} onChange={(e) => setField('registration_type', e.target.value)} /></FormRow>
        <FormRow label="GSTIN"><input value={String(fields.gstin || '')} onChange={(e) => setField('gstin', e.target.value)} /></FormRow>
        <FormRow label="PAN"><input value={String(fields.pan || '')} onChange={(e) => setField('pan', e.target.value)} /></FormRow>
        <FormRow label="Composition GST rate"><input type="number" value={String(fields.composition_tax_rate || '')} onChange={(e) => setField('composition_tax_rate', e.target.value)} /></FormRow>
        <label><input type="checkbox" checked={Boolean(fields.require_customer_name)} onChange={(e) => setField('require_customer_name', e.target.checked)} /> Require customer name</label>
        <label><input type="checkbox" checked={Boolean(fields.require_customer_phone)} onChange={(e) => setField('require_customer_phone', e.target.checked)} /> Require customer phone</label>
        <h3 style={{ marginBottom: 0 }}>Invoice and financial year</h3>
        <FormRow label="Invoice numbering"><select value={String(fields.invoice_numbering_mode || 'external')} onChange={(e) => setField('invoice_numbering_mode', e.target.value)}><option value="app">App (auto-generate)</option><option value="external">External</option></select></FormRow>
        <FormRow label="Invoice prefix"><input value={String(fields.invoice_number_prefix || '')} onChange={(e) => setField('invoice_number_prefix', e.target.value)} /></FormRow>
        <FormRow label="FY start month"><input type="number" min="1" max="12" value={String(fields.fy_start_month || 4)} onChange={(e) => setField('fy_start_month', e.target.value)} /></FormRow>
        <FormRow label="Year-end mode"><select value={String(fields.fy_year_end_mode || 'balances_only')} onChange={(e) => setField('fy_year_end_mode', e.target.value)}><option value="balances_only">Balances only</option><option value="full_pending">Full pending</option></select></FormRow>
        <label><input type="checkbox" checked={Boolean(fields.fy_ask_at_start)} onChange={(e) => setField('fy_ask_at_start', e.target.checked)} /> Ask at start of new financial year</label>
        <FormRow label="Timezone">
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
          Save
        </Button>
        {msg ? <p>{msg}</p> : null}
      </div>
    </div>
  );
}
