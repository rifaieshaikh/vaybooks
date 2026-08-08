import { FormRow, TextInput } from '@vaybooks/ui-kit';
import {
  LocationIdsField,
  PartyAddressTaxFields,
  parseLocationIds,
  type PartyFormValues,
} from './PartyFields';

export function CustomerFormFields({
  values,
  onChange,
  segmentOptions,
}: {
  values: PartyFormValues;
  onChange: (name: string, value: string) => void;
  segmentOptions: { id: string; name: string }[];
}) {
  const selectedSegments = (values.segment_ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Customer Name *">
          <TextInput
            value={values.customer_name || ''}
            onChange={(e) => onChange('customer_name', e.target.value)}
            required
          />
        </FormRow>
        <FormRow label="Contact Person">
          <TextInput
            value={values.contact_person || ''}
            onChange={(e) => onChange('contact_person', e.target.value)}
          />
        </FormRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <FormRow label="Phone Number *">
          <TextInput
            value={values.phone_number || ''}
            placeholder="10-digit mobile"
            onChange={(e) => onChange('phone_number', e.target.value)}
            required
          />
        </FormRow>
        <FormRow label="Alternate Phone">
          <TextInput
            value={values.alternate_phone_number || ''}
            onChange={(e) => onChange('alternate_phone_number', e.target.value)}
          />
        </FormRow>
        <FormRow label="Email">
          <TextInput value={values.email || ''} onChange={(e) => onChange('email', e.target.value)} />
        </FormRow>
      </div>

      <PartyAddressTaxFields values={values} onChange={onChange} />

      <FormRow label="Segments">
        {segmentOptions.length === 0 ? (
          <div style={{ fontSize: 13, color: '#667' }}>
            No party segments defined yet. Add them under Parties → Segments.
          </div>
        ) : (
          <select
            multiple
            value={selectedSegments}
            onChange={(e) => {
              const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
              onChange('segment_ids', ids.join(','));
            }}
            style={{ minHeight: 88, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
          >
            {segmentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </FormRow>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        <input
          type="checkbox"
          checked={values.is_commission_agent === 'true'}
          onChange={(e) => onChange('is_commission_agent', e.target.checked ? 'true' : 'false')}
        />
        Is commission agent
      </label>

      <details style={{ border: '1px solid #e2ebe7', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Notes</summary>
        <FormRow label="Notes">
          <TextInput value={values.notes || ''} onChange={(e) => onChange('notes', e.target.value)} />
        </FormRow>
      </details>

      <LocationIdsField
        value={values.location_ids || 'default'}
        onChange={(v) => onChange('location_ids', v)}
      />
    </div>
  );
}

export function customerBody(v: PartyFormValues) {
  const segment_ids = (v.segment_ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    customer_name: v.customer_name || '',
    phone_number: v.phone_number || '',
    alternate_phone_number: v.alternate_phone_number || undefined,
    email: v.email || '',
    contact_person: v.contact_person || '',
    address_line1: v.address_line1 || '',
    address_line2: v.address_line2 || '',
    city: v.city || '',
    state_code: v.state_code || '',
    pincode: v.pincode || '',
    country: v.country || 'India',
    gstin: v.gstin || '',
    pan: v.pan || '',
    registration_type: v.registration_type || 'Unregistered',
    msme_number: v.msme_number || '',
    notes: v.notes || '',
    location_ids: parseLocationIds(v.location_ids || 'default'),
    is_commission_agent: v.is_commission_agent === 'true',
    segment_ids,
  };
}

export function emptyCustomerForm(): PartyFormValues {
  return {
    country: 'India',
    registration_type: 'Unregistered',
    location_ids: 'default',
    is_commission_agent: 'false',
    segment_ids: '',
  };
}

export function customerToForm(data: Record<string, unknown>): PartyFormValues {
  return {
    customer_name: String(data.customer_name || ''),
    phone_number: String(data.phone_number || ''),
    alternate_phone_number: String(data.alternate_phone_number || ''),
    email: String(data.email || ''),
    contact_person: String(data.contact_person || ''),
    address_line1: String(data.address_line1 || ''),
    address_line2: String(data.address_line2 || ''),
    city: String(data.city || ''),
    state_code: String(data.state_code || ''),
    pincode: String(data.pincode || ''),
    country: String(data.country || 'India'),
    gstin: String(data.gstin || ''),
    pan: String(data.pan || ''),
    registration_type: String(data.registration_type || 'Unregistered'),
    msme_number: String(data.msme_number || ''),
    notes: String(data.notes || ''),
    location_ids: Array.isArray(data.location_ids)
      ? (data.location_ids as string[]).join(', ')
      : 'default',
    is_commission_agent: data.is_commission_agent ? 'true' : 'false',
    segment_ids: Array.isArray(data.segment_ids) ? (data.segment_ids as string[]).join(',') : '',
  };
}
