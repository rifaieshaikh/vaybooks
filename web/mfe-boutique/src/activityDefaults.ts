/** Match Streamlit workspace defaults for required activities. */
const DEFAULT_ON = new Set(['Stitching', 'Handwork', 'Material Purchase']);

export function defaultRequiredActivities(
  activities: Record<string, unknown>[],
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const act of activities) {
    const name = String(act.activity_name || '');
    if (!name) continue;
    map[name] = DEFAULT_ON.has(name);
  }
  // If catalog has none of the defaults, require the first active activity.
  if (Object.keys(map).length > 0 && !Object.values(map).some(Boolean)) {
    const first = String(activities[0]?.activity_name || '');
    if (first) map[first] = true;
  }
  return map;
}

export function hasAnyRequired(map: Record<string, boolean>): boolean {
  return Object.values(map).some(Boolean);
}

export function itemIsReadyForInvoice(
  item: Record<string, unknown>,
  activities: Record<string, unknown>[],
): boolean {
  const itemId = String(item.item_id || item.id || '');
  if (!itemId) return false;
  if (String(item.item_status || '') === 'Completed') return true;
  const required = activities.filter(
    (a) => String(a.bill_id || '') === itemId && a.is_required !== false,
  );
  if (required.length === 0) return false;
  return required.every((a) => {
    const status = String(a.activity_status || a.status || '');
    return status === 'Completed' || status === 'Skipped';
  });
}
