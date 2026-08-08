import { FormEvent, useState, type ReactNode } from 'react';
import {
  Button,
  DataTable,
  ErrorText,
  FormRow,
  PageHeader,
  SimpleForm,
  StatusBanner,
  TextInput,
} from '@vaybooks/ui-kit';

export const REGISTRATION_TYPES = ['Unregistered', 'Registered', 'Composition'] as const;

export type PartyFormValues = Record<string, string>;

const ADDRESS_TAX_FIELDS: { name: string; label: string; placeholder?: string }[] = [
  { name: 'address_line1', label: 'Address line 1' },
  { name: 'address_line2', label: 'Address line 2' },
  { name: 'city', label: 'City' },
  { name: 'state_code', label: 'State code', placeholder: '27' },
  { name: 'pincode', label: 'PIN code' },
  { name: 'country', label: 'Country' },
  { name: 'registration_type', label: 'Registration type', placeholder: 'Unregistered' },
  { name: 'gstin', label: 'GSTIN' },
  { name: 'pan', label: 'PAN' },
  { name: 'msme_number', label: 'MSME number' },
];

export function PartyAddressTaxFields({
  values,
  onChange,
}: {
  values: PartyFormValues;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <>
      <details open style={{ border: '1px solid #e2ebe7', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>Address</summary>
        {ADDRESS_TAX_FIELDS.filter((f) =>
          ['address_line1', 'address_line2', 'city', 'state_code', 'pincode', 'country'].includes(f.name),
        ).map((f) => (
          <FormRow key={f.name} label={f.label}>
            <TextInput
              name={f.name}
              value={values[f.name] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          </FormRow>
        ))}
      </details>
      <details open style={{ border: '1px solid #e2ebe7', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>Tax / registration</summary>
        <FormRow label="Registration type">
          <select
            value={values.registration_type || 'Unregistered'}
            onChange={(e) => onChange('registration_type', e.target.value)}
            style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
          >
            {REGISTRATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        {ADDRESS_TAX_FIELDS.filter((f) => ['gstin', 'pan', 'msme_number'].includes(f.name)).map((f) => (
          <FormRow key={f.name} label={f.label}>
            <TextInput
              name={f.name}
              value={values[f.name] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          </FormRow>
        ))}
      </details>
    </>
  );
}

export function LocationIdsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormRow label="Location ids (comma-separated)">
      <TextInput
        value={value}
        placeholder="default"
        onChange={(e) => onChange(e.target.value)}
      />
    </FormRow>
  );
}

export function parseLocationIds(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ['default'];
}

export function PartyListShell({
  title,
  search,
  onSearchChange,
  onRefresh,
  isLoading,
  error,
  columns,
  rows,
  onRowOpen,
  form,
  children,
}: {
  title: string;
  search: string;
  onSearchChange: (v: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  error?: unknown;
  columns: { key: string; header: string }[];
  rows: Record<string, unknown>[];
  onRowOpen?: (row: Record<string, unknown>) => void;
  form?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        actions={
          onRefresh ? (
            <Button variant="ghost" onClick={onRefresh}>
              Refresh
            </Button>
          ) : undefined
        }
      />
      <FormRow label="Search">
        <TextInput value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Name / phone / GSTIN" />
      </FormRow>
      {form}
      {children}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load. Is the API running?</ErrorText> : null}
      <DataTable
        columns={columns as { key: keyof Record<string, unknown> & string; header: string }[]}
        data={rows}
        rowKey={(row) => String(row.id)}
        onRowClick={onRowOpen}
      />
    </div>
  );
}

export function PartyForm({
  initial,
  extraFields,
  onSubmit,
  submitLabel = 'Save',
}: {
  initial?: PartyFormValues;
  extraFields?: ReactNode;
  onSubmit: (values: PartyFormValues) => void | Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<PartyFormValues>({
    country: 'India',
    registration_type: 'Unregistered',
    location_ids: 'default',
    ...(initial || {}),
  });

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <SimpleForm onSubmit={handleSubmit}>
      {extraFields}
      <PartyAddressTaxFields values={values} onChange={setField} />
      <LocationIdsField value={values.location_ids || 'default'} onChange={(v) => setField('location_ids', v)} />
      <FormRow label="Notes">
        <TextInput value={values.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
      </FormRow>
      <Button type="submit">{submitLabel}</Button>
    </SimpleForm>
  );
}

export function DisabledModuleNote() {
  return (
    <StatusBanner>
      Cross-module create actions (Sales Order, PO, etc.) will unlock after those module waves.
    </StatusBanner>
  );
}

export function useDebouncedSearch(initial = '') {
  const [search, setSearch] = useState(initial);
  return { search, setSearch, q: search.trim() };
}
