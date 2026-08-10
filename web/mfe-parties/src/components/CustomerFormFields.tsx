import { FormRow, TextInput } from '@vaybooks/ui-kit';
import type { CSSProperties } from 'react';
import { PartyAddressTaxFields, type PartyFormValues } from './PartyFields';
import {
  PartyLocationPicker,
  usePartyLocationIds,
  type AccessibleLocation,
} from './PartyLocationFields';

const responsiveRow: CSSProperties = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
};

export function CustomerFormFields({
  values,
  onChange,
  segmentOptions,
  locationPicker,
}: {
  values: PartyFormValues;
  onChange: (name: string, value: string) => void;
  segmentOptions: { id: string; name: string }[];
  locationPicker?: {
    showPicker: boolean;
    locationIds: string[];
    setLocationIds: (next: string[]) => void;
    accessible: AccessibleLocation[];
  };
}) {
  const selectedSegments = (values.segment_ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600, color: '#185c4c' }}>Identity</div>
        <div style={responsiveRow}>
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
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600, color: '#185c4c' }}>Contact</div>
        <div style={responsiveRow}>
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
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600, color: '#185c4c' }}>Address & tax</div>
        <PartyAddressTaxFields values={values} onChange={onChange} />
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600, color: '#185c4c' }}>Segments</div>
        {segmentOptions.length === 0 ? (
          <div style={{ fontSize: 13, color: '#667' }}>
            No party segments defined yet. Add them under Parties → Segments.
          </div>
        ) : (
          <FormRow label="Segments">
            <select
              multiple
              value={selectedSegments}
              onChange={(e) =>
                onChange(
                  'segment_ids',
                  Array.from(e.target.selectedOptions)
                    .map((o) => o.value)
                    .join(','),
                )
              }
              style={{ minHeight: 72, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
            >
              {segmentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormRow>
        )}
      </section>

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

      {locationPicker ? (
        <PartyLocationPicker
          showPicker={locationPicker.showPicker}
          locationIds={locationPicker.locationIds}
          setLocationIds={locationPicker.setLocationIds}
          accessible={locationPicker.accessible}
        />
      ) : null}
    </div>
  );
}

export function validateCustomerForm(v: PartyFormValues): string | null {
  if (!(v.customer_name || '').trim()) return 'Customer name is required.';
  const digits = (v.phone_number || '').replace(/\D/g, '');
  if (digits.length < 10) return 'Enter a valid phone number (at least 10 digits).';
  const email = (v.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return null;
}

export function customerBody(v: PartyFormValues, locationIds: string[]) {
  const segment_ids = (v.segment_ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    customer_name: (v.customer_name || '').trim(),
    phone_number: (v.phone_number || '').trim(),
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
    location_ids: locationIds,
    is_commission_agent: v.is_commission_agent === 'true',
    segment_ids,
  };
}

export function emptyCustomerForm(): PartyFormValues {
  return {
    country: 'India',
    registration_type: 'Unregistered',
    is_commission_agent: 'false',
    segment_ids: '',
  };
}

export function customerLocationIds(data: Record<string, unknown>): string[] {
  return Array.isArray(data.location_ids) ? (data.location_ids as string[]).map(String) : [];
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
    is_commission_agent: data.is_commission_agent ? 'true' : 'false',
    segment_ids: Array.isArray(data.segment_ids) ? (data.segment_ids as string[]).join(',') : '',
  };
}

export { usePartyLocationIds };
