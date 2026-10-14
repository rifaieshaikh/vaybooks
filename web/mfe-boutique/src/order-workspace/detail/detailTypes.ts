/** Shared helpers for order detail money UI. */

export function isStoreCashAccount(a: Record<string, unknown>): boolean {
  return (
    a.is_store_account === true &&
    !a.linked_customer_id &&
    !a.linked_vendor_id &&
    !a.linked_worker_id &&
    !a.linked_agent_id &&
    !a.linked_delivery_partner_id &&
    a.is_active !== false
  );
}

export function expenseAmount(e: Record<string, unknown>): number {
  if (e.amount != null && Number.isFinite(Number(e.amount))) return Number(e.amount);
  const qty = Number(e.quantity ?? 1) || 1;
  return (Number(e.selling_price) || 0) * qty;
}

export type DetailTab = 'overview' | 'garments' | 'money' | 'billing';
export type MoneySub = 'advance' | 'expenses' | 'receipts' | 'payments' | 'refunds';

export const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'garments', label: 'Garments' },
  { id: 'money', label: 'Money' },
  { id: 'billing', label: 'Billing' },
];

export const MONEY_SUBS: { id: MoneySub; label: string }[] = [
  { id: 'advance', label: 'Advance' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'payments', label: 'Payments' },
  { id: 'refunds', label: 'Refunds' },
];

export function parseDetailTab(raw: string | null): DetailTab {
  const hit = DETAIL_TABS.find((t) => t.id === raw);
  return hit?.id || 'overview';
}

export function parseMoneySub(raw: string | null): MoneySub {
  const hit = MONEY_SUBS.find((t) => t.id === raw);
  return hit?.id || 'advance';
}
