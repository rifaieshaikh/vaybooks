import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGetKeyboardShortcutsQuery } from '@vaybooks/store';
import { hasActiveDetailKeyboardBack } from '@vaybooks/ui-kit';

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
  inventory_skus_list: '/inventory/skus',
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

/** Global create / jump routes (no path id required). */
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
  'parties.vendors.create': '/parties/vendors?new=1',
  'customers.add': '/parties/customers?new=1',
  'vendors.add': '/parties/vendors?new=1',
  'orders.add': '/boutique/orders/workspace',
  'export.csv.customers': '/finance/export-backup',
  'export.csv.orders': '/finance/export-backup',
  'export.csv.products': '/finance/export-backup',
  'export.csv.vendors': '/finance/export-backup',
  'export.backup.json': '/finance/export-backup',
  'export.backup.zip': '/finance/export-backup',
  'export.backup.save_disk': '/finance/export-backup',
  'export.backup.restore': '/finance/export-backup',
  'migration.download_template': '/migration',
  'migration.apply_profile': '/migration',
  'migration.dry_run': '/migration',
  'migration.confirm_import': '/migration',
  'migration.download_errors': '/migration',
  'system.updates.check': '/system/updates',
  'system.logs.refresh': '/system/logs',
  'reports.export': '/finance/reports',
  'reports.select': '/finance/reports',
  'settings.business.save': '/business-settings',
  'settings.system.save': '/system/settings',
  'dashboard.period.today': '/mtd-dashboard?period=today',
  'dashboard.period.last_7d': '/mtd-dashboard?period=last_7d',
  'dashboard.period.mtd': '/mtd-dashboard?period=mtd',
  'dashboard.period.last_30d': '/mtd-dashboard?period=last_30d',
  'dashboard.period.quarter': '/mtd-dashboard?period=quarter',
};

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
  '/parties/delivery-partners': '/parties/delivery-partners?new=1',
  '/parties/commission-agents': '/parties/commission-agents?new=1',
  '/parties/employees': '/parties/employees?new=1',
  '/inventory/products': '/inventory/skus?new=1',
  '/inventory/skus': '/inventory/skus?new=1',
  '/inventory/categories': '/inventory/categories?new=1',
  '/boutique/orders': '/boutique/orders/workspace',
  '/boutique/items': '/boutique/items?new=1',
  '/crm/leads': '/crm/leads?new=1',
  '/crm/enquiries': '/crm/enquiries?new=1',
  '/crm/activities': '/crm/activities?new=1',
  '/finance/accounts': '/finance/accounts?new=1',
  '/production/batches': '/production/batches?new=1',
  '/production/recipes': '/production/recipes?new=1',
  '/projects/list': '/projects/list?new=1',
  '/projects/enquiries': '/projects/enquiries?new=1',
  '/access/users': '/access/users?new=1',
  '/access/roles': '/access/roles?new=1',
  '/access/plans': '/access/plans?new=1',
  '/business/tasks': '/business/tasks?new=1',
  '/settings/discounts': '/settings/discounts?new=1',
  '/settings/services': '/settings/services?new=1',
  '/settings-locations': '/settings-locations?new=1',
  '/settings/measurement-specs': '/settings/measurement-specs?new=1',
};

const LIST_CHROME_ACTIONS = new Set([
  'list.search.focus',
  'list.row.next',
  'list.row.prev',
  'list.row.open',
  'list.row.edit',
  'list.row.new',
  'list.filters.open',
  'list.sort.open',
  'list.filters.apply',
  'list.filters.clear',
  'list.sort.clear',
  'list.filters.mtd',
  'list.filters.last_30d',
  'list.prev_page',
  'list.next_page',
]);

for (let i = 1; i <= 9; i += 1) {
  LIST_CHROME_ACTIONS.add(`list.view_nth.${i}`);
  LIST_CHROME_ACTIONS.add(`list.edit_nth.${i}`);
}

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

function allowWhileTyping(chord: string): boolean {
  if (/^f\d{1,2}$/.test(chord)) return true;
  if (chord.startsWith('ctrl+') || chord.startsWith('alt+') || chord.startsWith('meta+')) {
    if (chord === 'ctrl+s' || chord === 'meta+s') return false;
    return true;
  }
  return false;
}

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  const parts = p.split('/');
  if (parts.length >= 4 && (parts[parts.length - 1] === 'edit' || parts[parts.length - 1] === 'new')) {
    return parts.slice(0, -1).join('/') || '/';
  }
  if (parts.length >= 4) {
    const last = parts[parts.length - 1];
    if (last && last !== 'new' && !['orders', 'bills', 'returns', 'estimates', 'quotations'].includes(last)) {
      const maybeList = parts.slice(0, -1).join('/');
      if (LIST_PRIMARY_NEW[maybeList]) return maybeList;
    }
  }
  return p;
}

function pathId(pathname: string, prefix: string): string | null {
  const re = new RegExp(`^${prefix}/([^/]+)(?:/|$)`);
  const m = pathname.match(re);
  return m?.[1] && m[1] !== 'new' && m[1] !== 'workspace' ? m[1] : null;
}

/** Context-aware action → route (needs entity id from URL). */
function resolveContextRoute(actionId: string, pathname: string): string | null {
  const soId = pathId(pathname, '/sales/orders');
  if (actionId === 'sales.orders.deliver' && soId) {
    return `/sales/delivery-notes/new?sales_order_id=${soId}`;
  }

  const dnId = pathId(pathname, '/sales/delivery-notes');
  if (actionId === 'sales.deliveries.create_invoice' && dnId) {
    return `/sales/invoices/new?delivery_note_id=${dnId}`;
  }

  const poId = pathId(pathname, '/purchases/orders');
  if (actionId === 'purchases.orders.receive' && poId) {
    return `/purchases/goods-receipt/new?purchase_order_id=${poId}`;
  }

  const acctId = pathId(pathname, '/finance/accounts');
  if (actionId === 'finance.accounts.ledger' && acctId) {
    return `/finance/accounts/${acctId}?tab=ledger`;
  }

  const boutId = pathId(pathname, '/boutique/orders');
  if (boutId) {
    if (actionId === 'orders.record_invoice' || actionId === 'orders.record_delivery') {
      return `/boutique/orders/${boutId}?tab=billing`;
    }
    if (actionId === 'orders.record_receipt') {
      return `/boutique/orders/${boutId}?tab=money&money=receipts`;
    }
    if (actionId === 'orders.record_payment') {
      return `/boutique/orders/${boutId}?tab=money&money=payments`;
    }
    if (actionId === 'orders.record_refund') {
      return `/boutique/orders/${boutId}?tab=money&money=refunds`;
    }
    if (actionId === 'items.expense.add') {
      return `/boutique/orders/${boutId}?tab=money&money=expenses`;
    }
  }

  const itemId = pathId(pathname, '/boutique/items');
  if (itemId && actionId === 'items.time.add') {
    return `/boutique/items/${itemId}?task=1`;
  }

  const custId = pathId(pathname, '/parties/customers');
  if (actionId === 'customers.view_orders' && custId) {
    return `/boutique/orders?customer_id=${custId}`;
  }
  if (actionId === 'customers.back') return '/parties/customers';

  const vendId = pathId(pathname, '/parties/vendors');
  if (actionId === 'vendors.record_payment' && vendId) {
    return `/finance/payments?new=1&vendor_id=${vendId}`;
  }

  return null;
}

function clickKbAction(actionId: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-kb-action="${actionId}"]`);
  if (!el || (el instanceof HTMLButtonElement && el.disabled)) return false;
  el.click();
  return true;
}

export function useShellKeyboardShortcuts(enabled = true) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useGetKeyboardShortcutsQuery(undefined, { skip: !enabled });

  useEffect(() => {
    if (!enabled || !data) return;
    const parents = (data.parents || {}) as Record<string, string>;
    const actions = (data.actions || {}) as Record<string, string>;

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

      if (actionId === 'nav.back' || actionId === 'customers.back') {
        if (document.querySelector('.dd-page, .de-page') || hasActiveDetailKeyboardBack()) return;
        e.preventDefault();
        if (actionId === 'customers.back') navigate('/parties/customers');
        else navigate(-1);
        return;
      }

      if (
        actionId === 'dialog.save' ||
        actionId === 'form.add_line' ||
        actionId === 'form.remove_line' ||
        actionId === 'settings.business.save' ||
        actionId === 'settings.system.save' ||
        actionId === 'customers.create' ||
        actionId === 'customers.save'
      ) {
        // Prefer explicit save button on page when present
        if (actionId && clickKbAction(actionId)) {
          e.preventDefault();
          return;
        }
        if (
          actionId === 'dialog.save' ||
          actionId === 'form.add_line' ||
          actionId === 'form.remove_line'
        ) {
          return;
        }
      }

      if (actionId && LIST_CHROME_ACTIONS.has(actionId)) {
        return;
      }

      // Page-local buttons annotated with data-kb-action
      if (actionId && clickKbAction(actionId)) {
        e.preventDefault();
        return;
      }

      if (actionId === 'reports.select') {
        const sel = document.querySelector<HTMLSelectElement>('[data-kb-action="reports.select"]');
        if (sel) {
          e.preventDefault();
          sel.focus();
          return;
        }
      }

      // Context routes that need the current entity id
      if (actionId) {
        const ctx = resolveContextRoute(actionId, location.pathname);
        if (ctx) {
          e.preventDefault();
          navigate(ctx);
          return;
        }
      }

      // dialog.open_existing → focus list search / open-existing control
      if (
        actionId === 'dialog.open_existing' ||
        actionId === 'customers.open_existing' ||
        actionId === 'vendors.open_existing'
      ) {
        if (clickKbAction('dialog.open_existing') || clickKbAction(actionId)) {
          e.preventDefault();
          return;
        }
        const search = document.querySelector<HTMLInputElement>('.el-search input');
        if (search) {
          e.preventDefault();
          search.focus();
          search.select?.();
          return;
        }
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
