import { useMemo, useState } from 'react';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

export type ChipsMultiPickerProps = {
  options: SearchableSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

export function ChipsMultiPicker({
  options,
  value,
  onChange,
  placeholder = 'Add…',
  emptyMessage = 'No options yet.',
  disabled = false,
}: ChipsMultiPickerProps) {
  const [pickerValue, setPickerValue] = useState('');

  const byId = useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    for (const opt of options) map.set(opt.value, opt);
    return map;
  }, [options]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const available = useMemo(
    () => options.filter((o) => o.value !== '' && !selectedSet.has(o.value)),
    [options, selectedSet],
  );

  if (options.length === 0) {
    return <div style={{ fontSize: 13, color: '#667' }}>{emptyMessage}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {value.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((id) => {
            const opt = byId.get(id);
            const label = opt?.label ?? id;
            return (
              <span
                key={id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--vb-color-line, #d5e3dc)',
                  background: 'var(--vb-color-surface-muted, #f7faf8)',
                  fontSize: 13,
                }}
              >
                {label}
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  disabled={disabled}
                  onClick={() => onChange(value.filter((v) => v !== id))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: disabled ? 'default' : 'pointer',
                    padding: 0,
                    lineHeight: 1,
                    color: '#5c736a',
                    fontSize: 16,
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      <SearchableSelect
        options={available}
        value={pickerValue}
        placeholder={available.length === 0 ? 'All selected' : placeholder}
        disabled={disabled || available.length === 0}
        onChange={(next) => {
          if (!next || selectedSet.has(next)) return;
          onChange([...value, next]);
          setPickerValue('');
        }}
      />
    </div>
  );
}
