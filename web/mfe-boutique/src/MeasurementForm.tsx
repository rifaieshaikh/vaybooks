import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useListBoutiqueMeasurementSectionsQuery,
  useListBoutiqueMeasurementSpecsQuery,
} from '@vaybooks/store';
import { FormRow } from '@vaybooks/ui-kit';
import { asCaption } from './utils';

const PERSON_TYPES = ['Men', 'Women', 'Boy Child', 'Girl Child', 'Infant'];
const FIT_OPTIONS = ['Slim', 'Regular', 'Loose', 'Custom'];

export type MeasurementFormValue = {
  person_type: string;
  wearer_name: string;
  wearer_age: string;
  wearer_height: string;
  wearer_weight: string;
  fit_preference: string;
  unit: string;
  measured_by: string;
  measured_at: string;
  notes: string;
  print_notes: string;
  values: { key: string; value: string; unit?: string }[];
};

type Props = {
  initial?: Partial<MeasurementFormValue> & { values?: Record<string, unknown>[] };
  personTypeLocked?: boolean;
  onChange?: (payload: MeasurementFormValue) => void;
};

function specApplies(spec: Record<string, unknown>, personType: string): boolean {
  const types = Array.isArray(spec.person_types) ? (spec.person_types as string[]) : [];
  if (types.length === 0) return true;
  return types.includes(personType);
}

function initialValuesMap(
  values: Record<string, unknown>[] | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of values || []) {
    const key = String(row.key || row.field_key || '');
    if (key) map[key] = String(row.value ?? '');
  }
  return map;
}

export function MeasurementForm({ initial, personTypeLocked, onChange }: Props) {
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const { data: sections = [] } = useListBoutiqueMeasurementSectionsQuery();
  const [personType, setPersonType] = useState(initial?.person_type || 'Women');
  const [wearerName, setWearerName] = useState(initial?.wearer_name || '');
  const [wearerAge, setWearerAge] = useState(initial?.wearer_age || '');
  const [wearerHeight, setWearerHeight] = useState(initial?.wearer_height || '');
  const [wearerWeight, setWearerWeight] = useState(initial?.wearer_weight || '');
  const [fit, setFit] = useState(initial?.fit_preference || 'Regular');
  const [unit, setUnit] = useState(initial?.unit || 'inch');
  const [measuredBy, setMeasuredBy] = useState(initial?.measured_by || '');
  const [measuredAt, setMeasuredAt] = useState(
    initial?.measured_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes || '');
  const [printNotes, setPrintNotes] = useState(initial?.print_notes || '');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    initialValuesMap(initial?.values as Record<string, unknown>[] | undefined),
  );

  const applicableSpecs = useMemo(
    () =>
      specs.filter(
        (s) => Boolean(s.is_active !== false) && specApplies(s, personType),
      ),
    [specs, personType],
  );

  const sectionRows = useMemo(() => {
    const known = new Set(sections.map((s) => String(s.key)));
    const rows = sections
      .filter((s) => s.is_active !== false)
      .map((s) => ({ key: String(s.key), label: asCaption(s.label || s.key) }));
    if (applicableSpecs.some((s) => !known.has(String(s.section || '')))) {
      rows.push({ key: '__other__', label: 'Other' });
    }
    return rows;
  }, [sections, applicableSpecs]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const values = applicableSpecs
      .map((s) => {
        const key = String(s.key);
        const value = (fieldValues[key] || '').trim();
        if (!value) return null;
        return { key, value, unit: String(s.unit || unit || '') };
      })
      .filter(Boolean) as { key: string; value: string; unit?: string }[];
    onChangeRef.current?.({
      person_type: personType,
      wearer_name: wearerName,
      wearer_age: wearerAge,
      wearer_height: wearerHeight,
      wearer_weight: wearerWeight,
      fit_preference: fit,
      unit,
      measured_by: measuredBy,
      measured_at: measuredAt,
      notes,
      print_notes: printNotes,
      values,
    });
  }, [
    applicableSpecs,
    fieldValues,
    personType,
    wearerName,
    wearerAge,
    wearerHeight,
    wearerWeight,
    fit,
    unit,
    measuredBy,
    measuredAt,
    notes,
    printNotes,
  ]);

  const missingRequired = applicableSpecs.filter(
    (s) => Boolean(s.required) && !(fieldValues[String(s.key)] || '').trim(),
  );

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Person type">
          <select
            value={personType}
            disabled={personTypeLocked}
            onChange={(e) => setPersonType(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          >
            {PERSON_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Wearer name">
          <input value={wearerName} onChange={(e) => setWearerName(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </FormRow>
        <FormRow label="Age">
          <input value={wearerAge} onChange={(e) => setWearerAge(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </FormRow>
        <FormRow label="Height">
          <input value={wearerHeight} onChange={(e) => setWearerHeight(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </FormRow>
        <FormRow label="Weight">
          <input value={wearerWeight} onChange={(e) => setWearerWeight(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </FormRow>
        <FormRow label="Fit">
          <select value={fit} onChange={(e) => setFit(e.target.value)} style={{ width: '100%', padding: 8 }}>
            {FIT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: '100%', padding: 8 }}>
            <option value="inch">inch</option>
            <option value="cm">cm</option>
          </select>
        </FormRow>
        <FormRow label="Measured by">
          <input value={measuredBy} onChange={(e) => setMeasuredBy(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </FormRow>
        <FormRow label="Measured on">
          <input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </FormRow>
      </div>
      <FormRow label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: '100%' }} />
      </FormRow>
      <FormRow label="Print notes">
        <textarea value={printNotes} onChange={(e) => setPrintNotes(e.target.value)} rows={2} style={{ width: '100%' }} />
      </FormRow>

      <p style={{ margin: 0, color: '#667', fontSize: 13 }}>
        {applicableSpecs.length} fields ({applicableSpecs.filter((s) => s.is_core).length} core ·{' '}
        {applicableSpecs.filter((s) => !s.is_core).length} additional)
        {missingRequired.length
          ? ` · missing required: ${missingRequired.map((s) => asCaption(s.label || s.key)).join(', ')}`
          : ''}
      </p>

      {sectionRows.map((section) => {
        const fields = applicableSpecs.filter((s) =>
          section.key === '__other__'
            ? !sections.some((sec) => String(sec.key) === String(s.section || ''))
            : String(s.section || '') === section.key,
        );
        if (!fields.length) return null;
        return (
          <div key={section.key} style={{ display: 'grid', gap: 8 }}>
            <h4 style={{ margin: '8px 0 0', color: 'var(--vb-color-primary, #185c4c)' }}>{section.label}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {fields.map((field) => {
                const key = String(field.key);
                const label = `${asCaption(field.label || key)}${field.required ? ' *' : ''}${
                  field.is_core === false ? ' (extra)' : ''
                }`;
                const options = Array.isArray(field.options) ? (field.options as string[]) : [];
                return (
                  <FormRow key={key} label={label}>
                    {options.length ? (
                      <select
                        value={fieldValues[key] || ''}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
                        style={{ width: '100%', padding: 8 }}
                      >
                        <option value="">—</option>
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={fieldValues[key] || ''}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={field.unit ? `Unit: ${String(field.unit)}` : undefined}
                        style={{ width: '100%', padding: 8 }}
                      />
                    )}
                  </FormRow>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function measurementFormMissingRequired(
  specs: Record<string, unknown>[],
  personType: string,
  values: { key: string; value: string }[],
): string[] {
  const map = new Map(values.map((v) => [v.key, v.value]));
  return specs
    .filter((s) => Boolean(s.required) && Boolean(s.is_active !== false) && specApplies(s, personType))
    .filter((s) => !(map.get(String(s.key)) || '').trim())
    .map((s) => asCaption(s.label || s.key));
}
