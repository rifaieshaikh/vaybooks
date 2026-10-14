import { useEffect, useMemo, useRef, useState } from 'react';
import { useGetWorkingLocationQuery } from '@vaybooks/store';
import { FormRow } from '@vaybooks/ui-kit';
import {
  initialSelectedLocationIds,
  normalizeRealLocationIds,
  partyListLocationParams,
  resolvePartyLocationIdsForSave,
  shouldShowPartyLocationPicker,
  type AccessibleLocation,
  type PartyLocationContext,
} from './partyLocationLogic';

export type { AccessibleLocation, PartyLocationContext };
export {
  initialSelectedLocationIds,
  normalizeRealLocationIds,
  partyListLocationParams,
  resolvePartyLocationIdsForSave,
  shouldShowPartyLocationPicker,
  soleOrWorkingLocationId,
} from './partyLocationLogic';

export function usePartyListLocationFilter(): {
  ready: boolean;
  params: { location_id?: string; location_ids?: string } | null;
} {
  const { data, isSuccess } = useGetWorkingLocationQuery();
  const ctx = useMemo<PartyLocationContext | null>(() => {
    if (!data) return null;
    return {
      workingLocationId: String(data.working_location_id || '').trim(),
      accessible: (data.accessible || []).map((l) => ({
        id: String(l.id),
        code: l.code,
        name: l.name,
      })),
    };
  }, [data]);

  const params = useMemo(() => partyListLocationParams(ctx), [ctx]);
  return { ready: Boolean(isSuccess && params), params };
}

function useWorkingLocationContext(): PartyLocationContext {
  const { data: workingLoc } = useGetWorkingLocationQuery();
  return useMemo(
    () => ({
      workingLocationId: String(workingLoc?.working_location_id || '').trim(),
      accessible: (workingLoc?.accessible || []).map((l) => ({
        id: String(l.id),
        code: l.code,
        name: l.name,
      })),
    }),
    [workingLoc],
  );
}

export function usePartyLocationIds({
  mode,
  existingIds,
  resetKey,
}: {
  mode: 'create' | 'edit';
  existingIds?: string[] | null;
  /** Change to re-init selection (e.g. modal open / row id). */
  resetKey?: string | number | boolean;
}) {
  const ctx = useWorkingLocationContext();
  const showPicker = shouldShowPartyLocationPicker(ctx);
  const existingNorm = normalizeRealLocationIds(existingIds);
  const existingKey = existingNorm.join('|');

  const [locationIds, setLocationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!ctx.workingLocationId && !ctx.accessible.length) return;
    setLocationIds(initialSelectedLocationIds(mode, ctx, existingIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when context / existing / resetKey change
  }, [mode, ctx.workingLocationId, ctx.accessible.map((l) => l.id).join('|'), existingKey, resetKey]);

  function resolveForSave() {
    return resolvePartyLocationIdsForSave({
      mode,
      ctx,
      selectedIds: locationIds,
      existingIds,
    });
  }

  return {
    locationIds,
    setLocationIds,
    showPicker,
    accessible: ctx.accessible,
    resolveForSave,
    workingReady: Boolean(ctx.workingLocationId || ctx.accessible.length),
  };
}

export function PartyLocationMultiSelect({
  value,
  onChange,
  options,
  label = 'Visible at locations',
  required = true,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: AccessibleLocation[];
  label?: string;
  required?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const summary = useMemo(() => {
    if (!options.length) return 'No locations';
    if (value.length === 0) return 'Select locations…';
    if (value.length === options.length) return 'All locations';
    if (value.length === 1) {
      const opt = options.find((o) => o.id === value[0]);
      return opt ? String(opt.name || opt.code || opt.id) : '1 location';
    }
    return `${value.length} locations`;
  }, [options, value]);

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  return (
    <FormRow label={required ? `${label} *` : label}>
      <div ref={rootRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '0.45rem 0.6rem',
            borderRadius: 6,
            border: '1px solid #c5d4ce',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{summary}</span>
          <span aria-hidden style={{ color: '#667' }}>
            ▾
          </span>
        </button>
        {open ? (
          <div
            role="listbox"
            aria-multiselectable
            style={{
              position: 'absolute',
              zIndex: 20,
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              maxHeight: 220,
              overflow: 'auto',
              border: '1px solid #c5d4ce',
              borderRadius: 8,
              background: '#fff',
              boxShadow: '0 8px 24px rgba(24, 92, 76, 0.12)',
              padding: 6,
            }}
          >
            {options.map((opt) => {
              const checked = selectedSet.has(opt.id);
              const caption = [opt.code, opt.name].filter(Boolean).join(' — ') || opt.id;
              return (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '0.35rem 0.45rem',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: checked ? '#eef6f2' : 'transparent',
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(opt.id)} />
                  <span style={{ fontSize: 13 }}>{caption}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    </FormRow>
  );
}

/** Renders the multi-select only when the picker should show. */
export function PartyLocationPicker({
  showPicker,
  locationIds,
  setLocationIds,
  accessible,
}: {
  showPicker: boolean;
  locationIds: string[];
  setLocationIds: (next: string[]) => void;
  accessible: AccessibleLocation[];
}) {
  if (!showPicker) return null;
  return (
    <PartyLocationMultiSelect value={locationIds} onChange={setLocationIds} options={accessible} />
  );
}
