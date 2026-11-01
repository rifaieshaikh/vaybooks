/** Normalize overview snapshot entities (API may return dicts via entity_dict). */

export function asEntityRecord(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  return item as Record<string, unknown>;
}

export function asEntityList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    const row = asEntityRecord(item);
    if (row) out.push(row);
  }
  return out;
}

export function entityField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in row && row[key] != null && row[key] !== '') return row[key];
  }
  return undefined;
}

export function entityId(row: Record<string, unknown>, ...keys: string[]): string {
  const keysToTry = keys.length ? keys : ['id', 'customer_id', 'lead_id', 'activity_id'];
  for (const key of keysToTry) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function entityCaption(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function formatOverviewWhen(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value);
  if (s.length >= 16 && (s.includes('T') || s.includes(' '))) {
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {
      /* fall through */
    }
    return s.slice(0, 16).replace('T', ' ');
  }
  return s.slice(0, 10);
}

export function formatOutstanding(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
}
