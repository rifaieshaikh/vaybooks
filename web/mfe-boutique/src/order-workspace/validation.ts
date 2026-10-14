import { hasAnyRequired } from '../activityDefaults';
import { asCaption } from '../utils';
import { activitiesOf, itemsOf, type ItemLike, type OrderLike, type WorkspaceStep } from './types';

export type Blocker = { step: WorkspaceStep; message: string };

export function confirmBlockers(order: OrderLike | null | undefined): Blocker[] {
  const blockers: Blocker[] = [];
  if (!order) {
    blockers.push({ step: 'customer', message: 'Create a draft order first' });
    return blockers;
  }
  if (!asCaption(order.customer_id)) {
    blockers.push({ step: 'customer', message: 'Customer is required' });
  }
  if (!asCaption(order.location_id) && !asCaption(order.location_name)) {
    blockers.push({ step: 'customer', message: 'Location is required' });
  }
  const items = itemsOf(order);
  if (!items.length) {
    blockers.push({ step: 'garments', message: 'Add at least one garment' });
  }
  const acts = activitiesOf(order);
  for (const item of items) {
    const id = String(item.item_id || item.id || '');
    if (!asCaption(item.description)) {
      blockers.push({ step: 'garments', message: 'Every garment needs a description' });
    }
    const bill = asCaption(item.bill_number);
    const meas = asCaption(item.measurement_id);
    if (!bill && !meas) {
      blockers.push({
        step: 'garments',
        message: `Garment missing bill or measurement (${asCaption(item.description) || id})`,
      });
    }
    const required = acts.filter(
      (a) => String(a.bill_id || '') === id && a.is_required !== false,
    );
    const map: Record<string, boolean> = {};
    for (const a of required) map[String(a.activity_name || '')] = true;
    if (!hasAnyRequired(map) && required.length === 0) {
      blockers.push({
        step: 'garments',
        message: `Select required activities for ${asCaption(item.description) || 'a garment'}`,
      });
    }
  }
  if (!asCaption(order.expected_delivery_date)) {
    blockers.push({ step: 'schedule', message: 'Set expected delivery date' });
  }
  return uniqueBlockers(blockers);
}

export function softHints(order: OrderLike | null | undefined, mediaCount: number): string[] {
  if (!order) return [];
  const hints: string[] = [];
  const items = itemsOf(order);
  if (!items.length) return hints;
  if (mediaCount === 0) hints.push('No reference media attached yet');
  if (!(Number(order.advance_amount) > 0)) hints.push('No advance recorded');
  if (items.some((i) => !asCaption(i.measurement_id))) {
    hints.push('Some garments have no linked measurement');
  }
  if (items.some((i) => !(Number(i.sell_amount) > 0))) {
    hints.push('Some garments have ₹0 estimate amount');
  }
  return hints;
}

export function sellTotal(items: ItemLike[]): number {
  return items.reduce((sum, i) => sum + (Number(i.sell_amount) || 0), 0);
}

function uniqueBlockers(rows: Blocker[]): Blocker[] {
  const seen = new Set<string>();
  return rows.filter((b) => {
    const key = `${b.step}:${b.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
