import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGetKeyboardShortcutsQuery } from '@vaybooks/store';

/** Streamlit parent shortcut keys → React shell routes. */
const PARENT_ROUTES: Record<string, string> = {
  dashboard: '/',
  mtd_dashboard: '/mtd-dashboard',
  customers_list: '/parties/customers',
  vendors_list: '/parties/vendors',
  delivery_partners_list: '/parties/delivery-partners',
  commission_agents_list: '/parties/commission-agents',
  workers_list: '/parties/employees',
  segments_list: '/parties/segments',
  crm_dashboard: '/crm',
  crm_leads_list: '/crm/leads',
  crm_enquiries_list: '/crm/enquiries',
  crm_activities_list: '/crm/activities',
  crm_calendar: '/crm/calendar',
  crm_reports: '/crm/reports',
  crm_scheduled_reports: '/crm/scheduled-reports',
  boutique_overview: '/boutique',
  orders_list: '/boutique/orders',
  items_list: '/boutique/items',
  measurements_list: '/boutique/measurements',
  time_list: '/boutique/time',
  time_log: '/boutique/time-log',
  calendar_list: '/boutique/calendar',
  boutique_reports: '/boutique/reports',
  boutique_scheduled_reports: '/boutique/scheduled-reports',
  business_ops_overview: '/business',
  business_ops_tasks: '/business/tasks',
  store_time_list: '/business/time',
  store_time_settings: '/store-time',
  projects_dashboard: '/projects',
  project_enquiries_list: '/projects/enquiries',
  projects_list: '/projects/list',
  project_measurements_list: '/projects/measurements',
  project_ra_bills_list: '/projects/ra-bills',
  projects_reports: '/projects/reports',
  projects_scheduled_reports: '/projects/scheduled-reports',
  projects_settings: '/projects/settings',
  sales_overview: '/sales',
  estimates_list: '/sales/estimates',
  quotations_list: '/sales/quotations',
  sales_orders_list: '/sales/orders',
  delivery_notes_list: '/sales/delivery-notes',
  sales_invoices_list: '/sales/invoices',
  sales_returns_list: '/sales/returns',
  sales_reports: '/sales/reports',
  sales_scheduled_reports: '/sales/scheduled-reports',
  purchases_overview: '/purchases',
  purchase_orders_list: '/purchases/orders',
  goods_receipt_list: '/purchases/goods-receipt',
  purchases_list: '/purchases/bills',
  purchase_returns_list: '/purchases/returns',
  purchases_reports: '/purchases/reports',
  purchases_scheduled_reports: '/purchases/scheduled-reports',
  inventory_overview: '/inventory',
  inventory_categories_list: '/inventory/categories',
  inventory_products_list: '/inventory/products',
  inventory_stock_list: '/inventory/stock',
  inventory_stock_ledger_list: '/inventory/stock-ledger',
  inventory_movements_list: '/inventory/movements',
  inventory_customer_prices_list: '/inventory/customer-prices',
  inventory_transfers_list: '/inventory/transfers',
  inventory_reports: '/inventory/reports',
  inventory_scheduled_reports: '/inventory/scheduled-reports',
  production_dashboard: '/production',
  production_recipes: '/production/recipes',
  production_batches: '/production/batches',
  production_day_book: '/production/day-book',
  production_margins: '/production/margins',
  production_yield: '/production/yield',
  production_reports: '/production/reports',
  production_scheduled_reports: '/production/scheduled-reports',
  production_settings: '/production/settings',
  finance_overview: '/finance',
  accounts_list: '/finance/accounts',
  vouchers_list: '/finance/vouchers',
  receipts_list: '/finance/receipts',
  payments_list: '/finance/payments',
  credit_notes_list: '/finance/credit-notes',
  debit_notes_list: '/finance/debit-notes',
  accounting_invoices_list: '/finance/accounting-invoices',
  journal_list: '/finance/journal',
  trial_balance_list: '/finance/trial-balance',
  reports: '/finance/reports',
  export_backup: '/finance/export-backup',
  data_migration: '/migration',
  business_settings: '/business-settings',
  settings_locations_list: '/settings-locations',
  print_settings: '/settings/print',
  customization_activities_list: '/settings/activities',
  project_activities_list: '/settings/project-activities',
  store_activities_list: '/settings/store-activities',
  business_activities_list: '/settings/business-activities',
  production_activities_list: '/settings/production-activities',
  measurement_specs: '/settings/measurement-specs',
  services_list: '/settings/services',
  discounts_list: '/settings/discounts',
  crm_settings: '/settings/crm',
  keyboard_shortcuts: '/settings/keyboard',
  users_settings: '/access/users',
  roles_settings: '/access/roles',
  permissions_settings: '/access/permissions',
  audit_logs: '/access/audit-logs',
  plans_settings: '/access/plans',
  feature_flags_settings: '/access/feature-flags',
  schedulers_crm: '/schedulers/crm',
  schedulers_sales: '/schedulers/sales',
  schedulers_purchases: '/schedulers/purchases',
  schedulers_inventory: '/schedulers/inventory',
  schedulers_production: '/schedulers/production',
  schedulers_boutique: '/schedulers/boutique',
  schedulers_projects: '/schedulers/projects',
  system_settings: '/system/settings',
  system_updates: '/system/updates',
  system_logs: '/system/logs',
};

/** Action shortcut keys → create/editor routes (Streamlit F1–F5 parity). */
const ACTION_ROUTES: Record<string, string> = {
  'purchases.orders.create': '/purchases/orders/new',
  'purchases.bills.create': '/purchases/bills/new',
  'sales.estimates.create': '/sales/estimates/new',
  'sales.quotations.create': '/sales/quotations/new',
  'sales.orders.create': '/sales/orders/new',
  'sales.delivery_notes.create': '/sales/delivery-notes/new',
  'sales.invoices.create': '/sales/invoices/new',
  'sales.returns.create': '/sales/returns/new',
  'boutique.orders.create': '/boutique/orders/workspace',
  'parties.customers.create': '/parties/customers?new=1',
};

/** Current list path → create path for list.primary (Ctrl+Shift+N). */
const LIST_PRIMARY_NEW: Record<string, string> = {
  '/sales/estimates': '/sales/estimates/new',
  '/sales/quotations': '/sales/quotations/new',
  '/sales/orders': '/sales/orders/new',
  '/sales/delivery-notes': '/sales/delivery-notes/new',
  '/sales/invoices': '/sales/invoices/new',
  '/sales/returns': '/sales/returns/new',
  '/purchases/orders': '/purchases/orders/new',
  '/purchases/goods-receipt': '/purchases/goods-receipt/new',
  '/purchases/bills': '/purchases/bills/new',
  '/purchases/returns': '/purchases/returns/new',
  '/parties/customers': '/parties/customers?new=1',
  '/parties/vendors': '/parties/vendors?new=1',
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

/** F-keys and modifier chords should work even while typing (Streamlit parity). */
function allowWhileTyping(chord: string): boolean {
  if (/^f\d{1,2}$/.test(chord)) return true;
  if (chord.startsWith('ctrl+') || chord.startsWith('alt+') || chord.startsWith('meta+')) {
    // Let Ctrl+S be handled by DocumentEditor; still allow other ctrl chords for nav/create
    if (chord === 'ctrl+s' || chord === 'meta+s') return false;
    return true;
  }
  return false;
}

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  // Strip /:id and /:id/edit for list.primary lookup
  const parts = p.split('/');
  if (parts.length >= 4 && (parts[parts.length - 1] === 'edit' || parts[parts.length - 1] === 'new')) {
    return parts.slice(0, -1).join('/') || '/';
  }
  if (parts.length >= 4) {
    // /sales/invoices/:id → /sales/invoices
    const last = parts[parts.length - 1];
    if (last && last !== 'new' && !['orders', 'bills', 'returns', 'estimates', 'quotations'].includes(last)) {
      // likely an id
      const maybeList = parts.slice(0, -1).join('/');
      if (LIST_PRIMARY_NEW[maybeList]) return maybeList;
    }
  }
  return p;
}

export function useShellKeyboardShortcuts(enabled = true) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useGetKeyboardShortcutsQuery(undefined, { skip: !enabled });

  useEffect(() => {
    if (!enabled || !data) return;
    const parents = (data.parents || {}) as Record<string, string>;
    const actions = (data.actions || {}) as Record<string, string>;

    // Parents first, then actions overwrite (creates take precedence on shared chords).
    const chordToRoute = new Map<string, string>();
    const chordToAction = new Map<string, string>();
    for (const [key, chord] of Object.entries(parents)) {
      const route = PARENT_ROUTES[key];
      if (route && chord) chordToRoute.set(String(chord).toLowerCase(), route);
    }
    for (const [key, chord] of Object.entries(actions)) {
      const c = String(chord).toLowerCase();
      if (!c) continue;
      chordToAction.set(c, key);
      const route = ACTION_ROUTES[key];
      if (route) chordToRoute.set(c, route);
    }

    function onKeyDown(e: KeyboardEvent) {
      const chord = eventChord(e);
      if (!chord) return;

      const typing = isTypingTarget(e.target);
      if (typing && !allowWhileTyping(chord)) return;

      // list.primary → create on current list
      const actionId = chordToAction.get(chord);
      if (actionId === 'list.primary') {
        const listPath = normalizePath(location.pathname);
        const createPath = LIST_PRIMARY_NEW[listPath];
        if (createPath) {
          e.preventDefault();
          navigate(createPath);
        }
        return;
      }

      // nav.back
      if (actionId === 'nav.back') {
        e.preventDefault();
        navigate(-1);
        return;
      }

      // dialog.save is handled by DocumentEditor (Ctrl+S)
      if (actionId === 'dialog.save') return;

      // List row / search chords are handled by EntityListTable via ListKeyboardBindingsProvider
      if (
        actionId === 'list.search.focus' ||
        actionId === 'list.row.next' ||
        actionId === 'list.row.prev' ||
        actionId === 'list.row.open' ||
        actionId === 'list.row.edit' ||
        actionId === 'list.row.new'
      ) {
        return;
      }

      const route = chordToRoute.get(chord);
      if (!route) return;
      e.preventDefault();
      navigate(route);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data, enabled, navigate, location.pathname]);
}
