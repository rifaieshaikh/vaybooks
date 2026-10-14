/** Pure helpers for Collections aging buckets (unit-tested). */

export type AgingRow = Record<string, unknown>;

export const AGING_BUCKETS = [
  { id: 'current', label: 'Current', min: Number.NEGATIVE_INFINITY, max: 0 },
  { id: '1-30', label: '1–30 days', min: 1, max: 30 },
  { id: '31-60', label: '31–60 days', min: 31, max: 60 },
  { id: '61-90', label: '61–90 days', min: 61, max: 90 },
  { id: '90+', label: '90+ days', min: 91, max: Number.POSITIVE_INFINITY },
] as const;

export function daysPastDue(row: AgingRow, today = new Date()): number | null {
  if (row.days_past_due != null && row.days_past_due !== '') {
    const n = Number(row.days_past_due);
    return Number.isFinite(n) ? n : null;
  }
  const due = row.due_date || row.oldest_due_date;
  if (!due) return null;
  const d = new Date(String(due));
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((start.getTime() - d.getTime()) / 86400000);
}

export function rowHasAgingFields(row: AgingRow): boolean {
  return (
    (row.due_date != null && String(row.due_date).trim() !== '') ||
    (row.oldest_due_date != null && String(row.oldest_due_date).trim() !== '') ||
    (row.days_past_due != null && String(row.days_past_due).trim() !== '')
  );
}

export function groupByAgingBucket(
  rows: AgingRow[],
  options: { agingAvailable?: boolean; today?: Date } = {},
): { id: string; label: string; rows: AgingRow[] }[] {
  const agingAvailable = options.agingAvailable ?? false;
  const today = options.today ?? new Date();
  const hasAging = agingAvailable || rows.some(rowHasAgingFields);
  if (!hasAging) return [];
  return AGING_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    rows: rows.filter((row) => {
      const days = daysPastDue(row, today);
      if (days == null) return false;
      return days >= bucket.min && days <= bucket.max;
    }),
  })).filter((g) => g.rows.length > 0);
}

/** Apply a saved list view onto list UI state (search + filters + sort). */
export function applySavedListView(view: {
  filters?: Record<string, string>;
  sort?: { key: string; desc?: boolean }[];
}): {
  search: string;
  filters: Record<string, string>;
  sort: { key: string; desc: boolean }[];
} {
  const filters = { ...(view.filters || {}) };
  const search = filters.search || '';
  delete filters.search;
  return {
    search,
    filters,
    sort: (view.sort || []).map((s) => ({ key: s.key, desc: Boolean(s.desc) })),
  };
}

/** Detail URL helper: deleted records open with include_deleted intent. */
export function crmDetailPath(
  entity: 'leads' | 'enquiries' | 'activities',
  id: string,
  options: { deleted?: boolean; tab?: string } = {},
): string {
  const params = new URLSearchParams();
  if (options.deleted) params.set('deleted', '1');
  if (options.tab) params.set('tab', options.tab);
  const qs = params.toString();
  return `/crm/${entity}/${id}${qs ? `?${qs}` : ''}`;
}
