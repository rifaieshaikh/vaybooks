import type { FilterFieldDef, FilterValues, SortCriterion } from '@vaybooks/ui-kit';

export const CRM_DATE_RANGE_FIELDS: FilterFieldDef[] = [
  { key: 'date_from', label: 'From date', type: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'date_to', label: 'To date', type: 'text', placeholder: 'YYYY-MM-DD' },
];

export const DEFAULT_LEAD_FILTERS: FilterValues = {
  status: '',
  assigned_user_id: '',
  priority: '',
  date_from: '',
  date_to: '',
};

export const DEFAULT_ENQUIRY_FILTERS: FilterValues = {
  status: '',
  assigned_user_id: '',
  date_from: '',
  date_to: '',
};

export const DEFAULT_ACTIVITY_FILTERS: FilterValues = {
  status: '',
  assigned_user_id: '',
  date_from: '',
  date_to: '',
};

export const DEFAULT_LEAD_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];
export const DEFAULT_ENQUIRY_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];
export const DEFAULT_ACTIVITY_SORT: SortCriterion[] = [{ key: 'scheduled_at', desc: false }];

export function ownerFilterField(
  owners: { id: string; name: string }[],
): FilterFieldDef {
  return {
    key: 'assigned_user_id',
    label: 'Owner',
    type: 'select',
    allLabel: 'All owners',
    options: owners.map((o) => ({ value: o.id, label: o.name })),
  };
}

export function mergeAppliedFilters(
  defaults: FilterValues,
  incoming: Record<string, string>,
): FilterValues {
  const next = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (key in incoming) next[key] = String(incoming[key] ?? '');
  }
  return next;
}

export function sortQueryParams(sort: SortCriterion[]): {
  sort_by?: string;
  sort_desc?: boolean;
} {
  const primary = sort[0];
  if (!primary?.key) return {};
  return { sort_by: primary.key, sort_desc: Boolean(primary.desc) };
}
