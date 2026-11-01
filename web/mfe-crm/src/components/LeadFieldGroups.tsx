import { FormRow } from '@vaybooks/ui-kit';
import { LocationSelect } from './LocationSelect';
import { SectionForm } from './SectionForm';
import type { useCrmFieldVisibility } from '../hooks/useCrmSettings';

export type LeadCommercialValues = {
  contact_person: string;
  alternate_phone: string;
  email: string;
  address_line1: string;
  address_line2: string;
  area: string;
  city: string;
  state_code: string;
  pincode: string;
  gstin: string;
  estimated_value: string;
  priority: string;
  source: string;
  interested_products: string;
  next_follow_up_at: string;
  notes: string;
  location_id: string;
};

export const EMPTY_LEAD_COMMERCIAL: LeadCommercialValues = {
  contact_person: '',
  alternate_phone: '',
  email: '',
  address_line1: '',
  address_line2: '',
  area: '',
  city: '',
  state_code: '',
  pincode: '',
  gstin: '',
  estimated_value: '',
  priority: 'Medium',
  source: '',
  interested_products: '',
  next_follow_up_at: '',
  notes: '',
  location_id: '',
};

export type EnquiryCommercialValues = {
  party_name: string;
  source: string;
  product_interest: string;
  description: string;
  expected_quantity: string;
  estimated_value: string;
  priority: string;
  expected_decision_at: string;
  next_follow_up_at: string;
  notes: string;
};

export const EMPTY_ENQUIRY_COMMERCIAL: EnquiryCommercialValues = {
  party_name: '',
  source: '',
  product_interest: '',
  description: '',
  expected_quantity: '',
  estimated_value: '',
  priority: 'Medium',
  expected_decision_at: '',
  next_follow_up_at: '',
  notes: '',
};

type Visibility = ReturnType<typeof useCrmFieldVisibility>;

type LeadProps = {
  values: LeadCommercialValues;
  onChange: (patch: Partial<LeadCommercialValues>) => void;
  visibility: Visibility;
  sources?: string[];
  disabled?: boolean;
  showLocation?: boolean;
  locationRequired?: boolean;
  locationAutoSelect?: boolean;
  compact?: boolean;
};

function setField<T extends object>(onChange: (patch: Partial<T>) => void, key: keyof T) {
  return (e: { target: { value: string } }) => onChange({ [key]: e.target.value } as Partial<T>);
}

/** Pack-gated commercial / address blocks for lead create + detail. */
export function LeadCommercialFieldGroups({
  values,
  onChange,
  visibility,
  sources = [],
  disabled,
  showLocation = true,
  locationRequired,
  locationAutoSelect = false,
  compact,
}: LeadProps) {
  const showAddress = visibility.gstinAddress || visibility.projectSite;
  const addressTitle = visibility.gstinAddress
    ? 'Address & GSTIN'
    : 'Project site';

  return (
    <>
      <SectionForm
        title="Contact"
        description={compact ? undefined : 'Additional contact details'}
        style={compact ? { paddingTop: 0, borderBottom: 'none' } : undefined}
      >
        <FormRow label="Contact person">
          <input
            value={values.contact_person}
            onChange={setField(onChange, 'contact_person')}
            disabled={disabled}
          />
        </FormRow>
        <FormRow label="Alternate phone">
          <input
            value={values.alternate_phone}
            onChange={setField(onChange, 'alternate_phone')}
            disabled={disabled}
          />
        </FormRow>
        <FormRow label="Email">
          <input
            type="email"
            value={values.email}
            onChange={setField(onChange, 'email')}
            disabled={disabled}
          />
        </FormRow>
      </SectionForm>

      {showAddress ? (
        <SectionForm title={addressTitle} style={compact ? { borderBottom: 'none' } : undefined}>
          <FormRow label={visibility.projectSite && !visibility.gstinAddress ? 'Site address' : 'Address line 1'}>
            <input
              value={values.address_line1}
              onChange={setField(onChange, 'address_line1')}
              disabled={disabled}
            />
          </FormRow>
          <FormRow label="Address line 2">
            <input
              value={values.address_line2}
              onChange={setField(onChange, 'address_line2')}
              disabled={disabled}
            />
          </FormRow>
          <FormRow label="Area">
            <input value={values.area} onChange={setField(onChange, 'area')} disabled={disabled} />
          </FormRow>
          <FormRow label="City">
            <input value={values.city} onChange={setField(onChange, 'city')} disabled={disabled} />
          </FormRow>
          <FormRow label="State code">
            <input
              value={values.state_code}
              onChange={setField(onChange, 'state_code')}
              disabled={disabled}
              placeholder="e.g. MH"
            />
          </FormRow>
          <FormRow label="Pincode">
            <input
              value={values.pincode}
              onChange={setField(onChange, 'pincode')}
              disabled={disabled}
            />
          </FormRow>
          {visibility.gstinAddress ? (
            <FormRow label="GSTIN">
              <input
                value={values.gstin}
                onChange={setField(onChange, 'gstin')}
                disabled={disabled}
              />
            </FormRow>
          ) : null}
        </SectionForm>
      ) : null}

      <SectionForm title="Commercial" style={compact ? { borderBottom: 'none' } : undefined}>
        <FormRow label="Estimated value">
          <input
            value={values.estimated_value}
            onChange={setField(onChange, 'estimated_value')}
            disabled={disabled}
            inputMode="decimal"
          />
        </FormRow>
        <FormRow label="Priority">
          <select
            value={values.priority}
            onChange={setField(onChange, 'priority')}
            disabled={disabled}
          >
            {['Low', 'Medium', 'High'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Source">
          <select value={values.source} onChange={setField(onChange, 'source')} disabled={disabled}>
            <option value="">Select…</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormRow>
        {visibility.skuInterest ? (
          <FormRow label="Interested products">
            <input
              value={values.interested_products}
              onChange={setField(onChange, 'interested_products')}
              disabled={disabled}
            />
          </FormRow>
        ) : null}
        <FormRow label="Next follow-up">
          <input
            type="datetime-local"
            value={values.next_follow_up_at}
            onChange={setField(onChange, 'next_follow_up_at')}
            disabled={disabled}
          />
        </FormRow>
        {showLocation ? (
          <LocationSelect
            value={values.location_id}
            onChange={(location_id) => onChange({ location_id })}
            disabled={disabled}
            autoSelect={locationAutoSelect}
            required={locationRequired}
          />
        ) : null}
        <FormRow label="Notes">
          <textarea
            value={values.notes}
            onChange={setField(onChange, 'notes')}
            rows={compact ? 2 : 4}
            style={{ width: '100%' }}
            disabled={disabled}
          />
        </FormRow>
      </SectionForm>
    </>
  );
}

type EnquiryProps = {
  values: EnquiryCommercialValues;
  onChange: (patch: Partial<EnquiryCommercialValues>) => void;
  visibility: Visibility;
  sources?: string[];
  disabled?: boolean;
  compact?: boolean;
};

/** Pack-gated commercial fields for enquiry create + detail. */
export function EnquiryCommercialFieldGroups({
  values,
  onChange,
  visibility,
  sources = [],
  disabled,
  compact,
}: EnquiryProps) {
  return (
    <SectionForm
      title="Commercial"
      description={compact ? undefined : 'Enquiry commercial details'}
      style={compact ? { paddingTop: 0, borderBottom: 'none' } : undefined}
    >
      <FormRow label="Party name">
        <input
          value={values.party_name}
          onChange={setField(onChange, 'party_name')}
          disabled={disabled}
        />
      </FormRow>
      <FormRow label="Source">
        <select value={values.source} onChange={setField(onChange, 'source')} disabled={disabled}>
          <option value="">Select…</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormRow>
      {visibility.skuInterest ? (
        <FormRow label="Product interest">
          <input
            value={values.product_interest}
            onChange={setField(onChange, 'product_interest')}
            disabled={disabled}
          />
        </FormRow>
      ) : null}
      <FormRow label={visibility.projectSite ? 'Project site / description' : 'Description'}>
        <textarea
          value={values.description}
          onChange={setField(onChange, 'description')}
          rows={compact ? 2 : 3}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      </FormRow>
      <FormRow label="Expected quantity">
        <input
          value={values.expected_quantity}
          onChange={setField(onChange, 'expected_quantity')}
          disabled={disabled}
          inputMode="decimal"
        />
      </FormRow>
      <FormRow label="Estimated value">
        <input
          value={values.estimated_value}
          onChange={setField(onChange, 'estimated_value')}
          disabled={disabled}
          inputMode="decimal"
        />
      </FormRow>
      <FormRow label="Priority">
        <select
          value={values.priority}
          onChange={setField(onChange, 'priority')}
          disabled={disabled}
        >
          {['Low', 'Medium', 'High'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Expected decision">
        <input
          type="datetime-local"
          value={values.expected_decision_at}
          onChange={setField(onChange, 'expected_decision_at')}
          disabled={disabled}
        />
      </FormRow>
      <FormRow label="Next follow-up">
        <input
          type="datetime-local"
          value={values.next_follow_up_at}
          onChange={setField(onChange, 'next_follow_up_at')}
          disabled={disabled}
        />
      </FormRow>
      <FormRow label="Notes">
        <textarea
          value={values.notes}
          onChange={setField(onChange, 'notes')}
          rows={compact ? 2 : 4}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      </FormRow>
    </SectionForm>
  );
}

/** Build create/update payload fields from lead commercial form values. */
export function leadCommercialPayload(values: LeadCommercialValues): Record<string, unknown> {
  const estimated =
    values.estimated_value.trim() === '' ? undefined : Number(values.estimated_value);
  return {
    contact_person: values.contact_person,
    alternate_phone: values.alternate_phone,
    email: values.email,
    address_line1: values.address_line1,
    address_line2: values.address_line2,
    area: values.area,
    city: values.city,
    state_code: values.state_code,
    pincode: values.pincode,
    gstin: values.gstin,
    estimated_value: Number.isFinite(estimated as number) ? estimated : undefined,
    priority: values.priority,
    source: values.source,
    interested_products: values.interested_products,
    next_follow_up_at: values.next_follow_up_at
      ? new Date(values.next_follow_up_at).toISOString()
      : null,
    notes: values.notes,
    location_id: values.location_id,
  };
}

export function enquiryCommercialPayload(
  values: EnquiryCommercialValues,
): Record<string, unknown> {
  const estimated =
    values.estimated_value.trim() === '' ? undefined : Number(values.estimated_value);
  const qty =
    values.expected_quantity.trim() === '' ? undefined : Number(values.expected_quantity);
  return {
    party_name: values.party_name,
    source: values.source,
    product_interest: values.product_interest,
    description: values.description,
    expected_quantity: Number.isFinite(qty as number) ? qty : undefined,
    estimated_value: Number.isFinite(estimated as number) ? estimated : undefined,
    priority: values.priority,
    expected_decision_at: values.expected_decision_at
      ? new Date(values.expected_decision_at).toISOString()
      : null,
    next_follow_up_at: values.next_follow_up_at
      ? new Date(values.next_follow_up_at).toISOString()
      : null,
    notes: values.notes,
  };
}
