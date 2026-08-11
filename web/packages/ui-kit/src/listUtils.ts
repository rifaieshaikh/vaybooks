/** Client-side list filter / sort / page helpers (Streamlit list_view parity). */

import type { SortCriterion } from './ListToolbar';

export function matchesRegex(value: unknown, needle: string): boolean {
  if (!needle.trim()) return true;
  const hay = String(value ?? '').toLowerCase();
  return hay.includes(needle.trim().toLowerCase());
}

function compareValues(av: unknown, bv: unknown, descending: boolean): number {
  if (typeof av === 'number' && typeof bv === 'number') {
    return descending ? bv - av : av - bv;
  }
  const as = String(av ?? '').toLowerCase();
  const bs = String(bv ?? '').toLowerCase();
  if (as < bs) return descending ? 1 : -1;
  if (as > bs) return descending ? -1 : 1;
  return 0;
}

export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sortKeyOrCriteria: string | SortCriterion[],
  descending = true,
): T[] {
  const criteria: SortCriterion[] = Array.isArray(sortKeyOrCriteria)
    ? sortKeyOrCriteria
    : [{ key: sortKeyOrCriteria, desc: descending }];
  const copy = [...rows];
  copy.sort((a, b) => {
    for (const c of criteria) {
      const cmp = compareValues(a[c.key], b[c.key], c.desc);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return copy;
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function displayName(row: Record<string, unknown>, nameKeys: string[], fallback = 'Unnamed'): string {
  for (const k of nameKeys) {
    const v = String(row[k] ?? '').trim();
    if (v) return v;
  }
  const phone = String(row.phone_number ?? '').trim();
  return phone || fallback;
}
