import type { SearchableSelectOption } from '@vaybooks/ui-kit';

function asCaption(value: unknown): string {
  return String(value ?? '').trim();
}

export function toProductOptions(rows: Record<string, unknown>[]): SearchableSelectOption[] {
  return rows.map((p) => ({
    value: String(p.id),
    label: asCaption(p.name) || String(p.id),
    sublabel: asCaption(p.sku) || undefined,
  }));
}

export function toLocationOptions(rows: Record<string, unknown>[]): SearchableSelectOption[] {
  return rows.map((l) => ({
    value: String(l.id),
    label: asCaption(l.name) || String(l.id),
    sublabel: asCaption(l.code) || asCaption(l.location_type) || undefined,
  }));
}

export function toCategoryOptions(rows: Record<string, unknown>[]): SearchableSelectOption[] {
  return rows.map((c) => ({
    value: String(c.id),
    label: asCaption(c.name) || String(c.id),
  }));
}

export function toUnitOptions(rows: Record<string, unknown>[]): SearchableSelectOption[] {
  return rows.map((u) => {
    const code = asCaption(u.code);
    const label = asCaption(u.label);
    return {
      value: String(u.id),
      label: label && code && label.toLowerCase() !== code.toLowerCase() ? `${label} (${code})` : label || code || String(u.id),
      sublabel: code || undefined,
    };
  });
}

/** Resolve unit_id (+ code) from BE units list, preferring id then code then pcs/first. */
export function resolveUnitId(
  units: Record<string, unknown>[],
  preferred?: { unit_id?: string; unit_code?: string; unit?: string },
): string {
  const preferredId = asCaption(preferred?.unit_id);
  if (preferredId) {
    const byId = units.find((u) => String(u.id) === preferredId);
    if (byId) return String(byId.id);
  }
  const preferredCode = asCaption(preferred?.unit_code || preferred?.unit).toLowerCase();
  if (preferredCode) {
    const byCode = units.find((u) => asCaption(u.code).toLowerCase() === preferredCode);
    if (byCode) return String(byCode.id);
  }
  const pcs = units.find((u) => asCaption(u.code).toLowerCase() === 'pcs');
  if (pcs) return String(pcs.id);
  return units[0] ? String(units[0].id) : '';
}

export function unitCodeForId(units: Record<string, unknown>[], unitId: string): string {
  const match = units.find((u) => String(u.id) === unitId);
  return asCaption(match?.code) || 'pcs';
}

export function toCustomerOptions(rows: Record<string, unknown>[]): SearchableSelectOption[] {
  return rows.map((c) => ({
    value: String(c.id),
    label: asCaption(c.customer_name || c.name) || String(c.id),
    sublabel: asCaption(c.phone_number || c.mobile) || undefined,
  }));
}

export function withNoneOption(
  options: SearchableSelectOption[],
  label = '— None —',
): SearchableSelectOption[] {
  return [{ value: '', label }, ...options];
}

export function excludeOption(
  options: SearchableSelectOption[],
  id: string | null | undefined,
): SearchableSelectOption[] {
  if (!id) return options;
  return options.filter((o) => o.value !== id);
}

export function customerDisplayName(row: Record<string, unknown> | undefined): string {
  if (!row) return '';
  return asCaption(row.customer_name || row.name) || String(row.id || '');
}
