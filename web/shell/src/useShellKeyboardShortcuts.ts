import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetKeyboardShortcutsQuery } from '@vaybooks/store';

/** Streamlit parent shortcut keys → React shell routes. */
const PARENT_ROUTES: Record<string, string> = {
  dashboard: '/',
  mtd_dashboard: '/mtd',
  customers_list: '/parties/customers',
  vendors_list: '/parties/vendors',
  workers_list: '/parties/employees',
  segments_list: '/parties/segments',
  boutique_overview: '/boutique',
  orders_list: '/boutique/orders',
  items_list: '/boutique/items',
  measurements_list: '/boutique/measurements',
  time_list: '/boutique/time',
  calendar_list: '/boutique/calendar',
  boutique_reports: '/boutique/reports',
  sales_overview: '/sales',
  sales_orders_list: '/sales/orders',
  delivery_notes_list: '/sales/delivery-notes',
  sales_invoices_list: '/sales/invoices',
  sales_returns_list: '/sales/returns',
  sales_reports: '/sales/reports',
  purchases_overview: '/purchases',
  purchase_orders_list: '/purchases/orders',
  goods_receipt_list: '/purchases/goods-receipt',
  purchases_list: '/purchases/bills',
  purchase_returns_list: '/purchases/returns',
  purchases_reports: '/purchases/reports',
  inventory_overview: '/inventory',
  inventory_categories_list: '/inventory/categories',
  inventory_products_list: '/inventory/products',
  inventory_stock_list: '/inventory/stock',
  inventory_stock_ledger_list: '/inventory/stock-ledger',
  inventory_movements_list: '/inventory/movements',
  inventory_customer_prices_list: '/inventory/customer-prices',
  inventory_transfers_list: '/inventory/transfers',
  inventory_reports: '/inventory/reports',
  production_dashboard: '/production',
  production_recipes: '/production/recipes',
  production_batches: '/production/batches',
  production_day_book: '/production/day-book',
  production_reports: '/production/reports',
  finance_overview: '/finance',
  accounts_list: '/finance/accounts',
  vouchers_list: '/finance/vouchers',
  receipts_list: '/finance/receipts',
  payments_list: '/finance/payments',
  accounting_invoices_list: '/finance/accounting-invoices',
  journal_list: '/finance/journal',
  trial_balance_list: '/finance/trial-balance',
  reports: '/finance/reports',
  export_backup: '/finance/export-backup',
  data_migration: '/migration',
  business_settings: '/business-settings',
  settings_locations_list: '/settings-locations',
  customization_activities_list: '/settings/activities',
  services_list: '/settings/services',
  keyboard_shortcuts: '/settings/keyboard',
  system_settings: '/system/settings',
  system_updates: '/system/updates',
  system_logs: '/system/logs',
};

const ACTION_ROUTES: Record<string, string> = {
  'sales.orders.create': '/sales/orders',
  'purchases.bills.create': '/purchases/bills',
  'boutique.orders.create': '/boutique/orders/workspace',
  'parties.customers.create': '/parties/customers',
};

function eventChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (key === 'control' || key === 'shift' || key === 'alt' || key === 'meta') return '';
  parts.push(key === ' ' ? 'space' : key);
  return parts.join('+');
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function useShellKeyboardShortcuts(enabled = true) {
  const navigate = useNavigate();
  const { data } = useGetKeyboardShortcutsQuery(undefined, { skip: !enabled });

  useEffect(() => {
    if (!enabled || !data) return;
    const parents = (data.parents || {}) as Record<string, string>;
    const actions = (data.actions || {}) as Record<string, string>;
    const chordToRoute = new Map<string, string>();
    for (const [key, chord] of Object.entries(parents)) {
      const route = PARENT_ROUTES[key];
      if (route && chord) chordToRoute.set(String(chord).toLowerCase(), route);
    }
    for (const [key, chord] of Object.entries(actions)) {
      const route = ACTION_ROUTES[key];
      if (route && chord) chordToRoute.set(String(chord).toLowerCase(), route);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const chord = eventChord(e);
      if (!chord) return;
      const route = chordToRoute.get(chord);
      if (!route) return;
      e.preventDefault();
      navigate(route);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data, enabled, navigate]);
}
