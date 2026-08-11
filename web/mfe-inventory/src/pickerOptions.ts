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
