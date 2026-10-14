import { useEffect, useMemo } from 'react';
import { useGetWorkingLocationQuery, useListInventoryLocationsQuery } from '@vaybooks/store';
import { FormRow } from '@vaybooks/ui-kit';

type Props = {
  value: string;
  onChange: (locationId: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** When true, prefill from working location / first accessible location. */
  autoSelect?: boolean;
  allowEmpty?: boolean;
  id?: string;
};

/**
 * Location picker using session working location + inventory locations list
 * (same pattern as sales/boutique editors).
 */
export function LocationSelect({
  value,
  onChange,
  label = 'Location',
  required,
  disabled,
  autoSelect = true,
  allowEmpty = true,
  id,
}: Props) {
  const { data: locations = [], isLoading } = useListInventoryLocationsQuery({ active_only: true });
  const { data: workingLoc } = useGetWorkingLocationQuery();

  const workingId = String(workingLoc?.working_location_id || '').trim();
  const locationLocked = Boolean(workingId && workingId !== 'ALL');

  const options = useMemo(() => {
    if (workingLoc?.accessible?.length) {
      return workingLoc.accessible.map((l) => ({
        id: String(l.id),
        label: String(l.name || l.code || l.id),
      }));
    }
    return (locations as Record<string, unknown>[]).map((l) => ({
      id: String(l.id),
      label: String(l.name || l.code || l.id),
    }));
  }, [workingLoc, locations]);

  useEffect(() => {
    if (!autoSelect || value) return;
    if (locationLocked) {
      onChange(workingId);
      return;
    }
    if (options[0]) onChange(options[0].id);
  }, [autoSelect, value, locationLocked, workingId, options, onChange]);

  if (locationLocked) {
    const lockedLabel =
      options.find((o) => o.id === workingId)?.label ||
      String(
        (locations as Record<string, unknown>[]).find((l) => String(l.id) === workingId)?.name ||
          workingId,
      );
    return (
      <FormRow label={required ? `${label} *` : label}>
        <input id={id} value={lockedLabel} readOnly disabled />
      </FormRow>
    );
  }

  return (
    <FormRow label={required ? `${label} *` : label}>
      <select
        id={id}
        className="vb-control"
        value={value}
        disabled={disabled || isLoading}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        {allowEmpty ? <option value="">Select…</option> : null}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormRow>
  );
}
