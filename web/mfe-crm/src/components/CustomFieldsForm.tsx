import { FormRow } from '@vaybooks/ui-kit';
import { useCrmSettingsCatalogs } from '../hooks';

export type CustomFieldDef = {
  key?: string;
  id?: string;
  label?: string;
  type?: string;
  options?: string[];
  required?: boolean;
};

type Props = {
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
};

function fieldKey(def: CustomFieldDef, index: number): string {
  return String(def.key || def.id || `field_${index}`).trim();
}

/** Renders CRM custom fields when enabled in settings. */
export function CustomFieldsForm({ values, onChange, disabled }: Props) {
  const { catalogs } = useCrmSettingsCatalogs();
  if (!catalogs.customFieldsEnabled) return null;
  const defs = (catalogs.customFieldDefs as CustomFieldDef[]) || [];
  if (!defs.length) return null;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h4 style={{ margin: '8px 0 0', color: 'var(--vb-color-primary, #185c4c)' }}>Custom fields</h4>
      {defs.map((def, index) => {
        const key = fieldKey(def, index);
        if (!key) return null;
        const label = String(def.label || key);
        const type = String(def.type || 'text').toLowerCase();
        const value = values[key];
        if (type === 'boolean' || type === 'checkbox') {
          return (
            <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={Boolean(value)}
                disabled={disabled}
                onChange={(e) => onChange({ ...values, [key]: e.target.checked })}
              />
              {label}
            </label>
          );
        }
        if (type === 'select' && Array.isArray(def.options)) {
          return (
            <FormRow key={key} label={label}>
              <select
                value={String(value ?? '')}
                disabled={disabled}
                onChange={(e) => onChange({ ...values, [key]: e.target.value })}
              >
                <option value="">Select…</option>
                {def.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </FormRow>
          );
        }
        if (type === 'number') {
          return (
            <FormRow key={key} label={label}>
              <input
                type="number"
                value={value === undefined || value === null ? '' : String(value)}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...values,
                    [key]: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </FormRow>
          );
        }
        return (
          <FormRow key={key} label={label}>
            <input
              type={type === 'date' ? 'date' : 'text'}
              value={String(value ?? '')}
              disabled={disabled}
              onChange={(e) => onChange({ ...values, [key]: e.target.value })}
            />
          </FormRow>
        );
      })}
    </div>
  );
}
