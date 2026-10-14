export type WorkspaceStep = 'customer' | 'garments' | 'schedule' | 'review' | 'ops';

export const WORKSPACE_STEPS: { id: WorkspaceStep; label: string; short: string }[] = [
  { id: 'customer', label: 'Customer', short: 'Who' },
  { id: 'garments', label: 'Garments', short: 'What' },
  { id: 'schedule', label: 'Schedule & Payment', short: 'When' },
  { id: 'review', label: 'Review & Confirm', short: 'Confirm' },
  { id: 'ops', label: 'Ops', short: 'Ops' },
];

export type OrderLike = Record<string, unknown>;
export type ItemLike = Record<string, unknown>;
export type MeasurementLike = Record<string, unknown>;

export function orderStatus(order: OrderLike | undefined | null): string {
  return String(order?.order_status || order?.status || '');
}

export function isDraft(order: OrderLike | undefined | null): boolean {
  return orderStatus(order) === 'Draft';
}

export function isInProgress(order: OrderLike | undefined | null): boolean {
  return orderStatus(order) === 'In Progress' || orderStatus(order) === 'IN_PROGRESS';
}

export function isTerminal(order: OrderLike | undefined | null): boolean {
  const s = orderStatus(order);
  return s === 'Cancelled' || s === 'Completed';
}

export function itemsOf(order: OrderLike | undefined | null): ItemLike[] {
  return Array.isArray(order?.customization_items)
    ? (order!.customization_items as ItemLike[])
    : [];
}

export function activitiesOf(order: OrderLike | undefined | null): ItemLike[] {
  return Array.isArray(order?.order_activities)
    ? (order!.order_activities as ItemLike[])
    : [];
}

export function itemId(item: ItemLike): string {
  return String(item.item_id || item.id || '');
}

export function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Draft → wizard; anything else → detail. */
export function boutiqueOrderPath(
  orderId: string,
  statusOrOrder?: string | OrderLike | null,
): string {
  const status =
    typeof statusOrOrder === 'string'
      ? statusOrOrder
      : orderStatus(statusOrOrder);
  if (status === 'Draft' || !status) {
    return `/boutique/orders/workspace?order=${encodeURIComponent(orderId)}`;
  }
  return `/boutique/orders/${orderId}`;
}
