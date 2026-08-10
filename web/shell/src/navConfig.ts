/** Sidebar + topbar navigation mirroring Streamlit `page_groups` in app.py. */

export type NavIcon =
  | 'dashboard'
  | 'calendarDays'
  | 'users'
  | 'truck'
  | 'handshake'
  | 'userCog'
  | 'tags'
  | 'layoutGrid'
  | 'userPlus'
  | 'messageSquare'
  | 'activity'
  | 'barChart'
  | 'clock'
  | 'shoppingBag'
  | 'ruler'
  | 'package'
  | 'folderKanban'
  | 'clipboardList'
  | 'fileText'
  | 'fileSignature'
  | 'receipt'
  | 'undo'
  | 'shoppingCart'
  | 'packageCheck'
  | 'boxes'
  | 'warehouse'
  | 'arrowLeftRight'
  | 'badgeDollar'
  | 'flaskConical'
  | 'layers'
  | 'bookOpen'
  | 'percent'
  | 'scale'
  | 'landmark'
  | 'wallet'
  | 'creditCard'
  | 'notebook'
  | 'balanceScale'
  | 'hardDrive'
  | 'settings'
  | 'refreshCw'
  | 'scrollText'
  | 'building'
  | 'mapPin'
  | 'printer'
  | 'keyboard'
  | 'sliders'
  | 'flag'
  | 'shield'
  | 'keyRound'
  | 'usersRound'
  | 'database'
  | 'calendarClock'
  | 'plus';

export type NavItem = {
  to: string;
  label: string;
  icon?: NavIcon;
  /** Org entitlement module id (e.g. sales, crm). */
  module?: string;
  permission?: string;
};

export type NavGroup = {
  /** Empty string = ungrouped home items (Dashboard / MTD). */
  header: string;
  module?: string;
  items: NavItem[];
};

function item(
  to: string,
  label: string,
  module: string,
  permission: string | undefined,
  icon: NavIcon,
): NavItem {
  return { to, label, module, permission, icon };
}

/** Left sidebar — operational modules only (admin lives in Settings flyout). */
export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    header: '',
    module: 'core',
    items: [
      item('/', 'Dashboard', 'core', 'core.dashboard.view', 'dashboard'),
      item('/mtd-dashboard', 'MTD', 'core', 'core.mtd.view', 'calendarDays'),
    ],
  },
  {
    header: 'Parties',
    module: 'parties',
    items: [
      item('/parties/customers', 'Customers', 'parties', 'parties.customers.view', 'users'),
      item('/parties/vendors', 'Vendors', 'parties', 'parties.vendors.view', 'truck'),
      item(
        '/parties/delivery-partners',
        'Delivery Partners',
        'parties',
        'parties.delivery_partners.view',
        'truck',
      ),
      item(
        '/parties/commission-agents',
        'Commission Agents',
        'parties',
        'parties.commission_agents.view',
        'handshake',
      ),
      item('/parties/workers', 'Employees', 'parties', 'parties.employees.view', 'userCog'),
      item('/parties/segments', 'Segments', 'parties', 'parties.segments.view', 'tags'),
    ],
  },
  {
    header: 'CRM',
    module: 'crm',
    items: [
      item('/crm', 'Overview', 'crm', 'crm.dashboard.view', 'layoutGrid'),
      item('/crm/leads', 'Leads', 'crm', 'crm.leads.view', 'userPlus'),
      item('/crm/enquiries', 'Enquiries', 'crm', 'crm.enquiries.view', 'messageSquare'),
      item('/crm/activities', 'Activities', 'crm', 'crm.activities.view', 'activity'),
      item('/crm/collections', 'Collections', 'crm', 'crm.dashboard.view', 'wallet'),
      item('/crm/calendar', 'Calendar', 'crm', 'crm.calendar.view', 'calendarDays'),
      item('/crm/reports', 'Reports', 'crm', 'crm.reports.view', 'barChart'),
      item('/crm/scheduled-reports', 'Scheduled reports', 'schedulers', 'schedulers.view', 'calendarClock'),
    ],
  },
  {
    header: 'Boutique',
    module: 'boutique',
    items: [
      item('/boutique', 'Overview', 'boutique', 'boutique.overview.view', 'layoutGrid'),
      item('/boutique/orders', 'Customization Orders', 'boutique', 'boutique.orders.view', 'shoppingBag'),
      item('/boutique/measurements', 'Measurements', 'boutique', 'boutique.measurements.view', 'ruler'),
      item('/boutique/items', 'Customization Items', 'boutique', 'boutique.items.view', 'package'),
      item('/boutique/time', 'Tasks', 'boutique', 'boutique.tasks.view', 'clipboardList'),
      item('/boutique/time-log', 'Time log', 'boutique', 'boutique.tasks.view', 'clock'),
      item('/boutique/calendar', 'Calendar', 'boutique', 'boutique.calendar.view', 'calendarDays'),
      item('/boutique/reports', 'Reports', 'boutique', 'boutique.reports.view', 'barChart'),
      item(
        '/boutique/scheduled-reports',
        'Scheduled reports',
        'schedulers',
        'schedulers.view',
        'calendarClock',
      ),
    ],
  },
  {
    header: 'Business',
    module: 'business_ops',
    items: [
      item('/business', 'Overview', 'business_ops', 'business_ops.overview.view', 'layoutGrid'),
      item('/business/tasks', 'Tasks', 'business_ops', 'business_ops.tasks.view', 'clipboardList'),
      item('/business/time', 'Time log', 'business_ops', 'business_ops.time.view', 'clock'),
    ],
  },
  {
    header: 'Projects',
    module: 'projects',
    items: [
      item('/projects', 'Overview', 'projects', 'projects.overview.view', 'layoutGrid'),
      item('/projects/enquiries', 'Enquiries', 'projects', 'projects.enquiries.view', 'messageSquare'),
      item('/projects/list', 'Projects', 'projects', 'projects.projects.view', 'folderKanban'),
      item('/projects/measurements', 'Measurements', 'projects', 'projects.measurements.view', 'ruler'),
      item('/projects/ra-bills', 'RA Bills', 'projects', 'projects.ra_bills.view', 'receipt'),
      item('/projects/reports', 'Reports', 'projects', 'projects.reports.view', 'barChart'),
      item(
        '/projects/scheduled-reports',
        'Scheduled reports',
        'schedulers',
        'schedulers.view',
        'calendarClock',
      ),
      item('/projects/settings', 'Settings', 'projects', 'projects.settings.view', 'settings'),
    ],
  },
  {
    header: 'Sales',
    module: 'sales',
    items: [
      item('/sales', 'Overview', 'sales', 'sales.overview.view', 'layoutGrid'),
      item('/sales/estimates', 'Estimates', 'sales', 'sales.estimates.view', 'fileText'),
      item('/sales/quotations', 'Quotations', 'sales', 'sales.quotations.view', 'fileSignature'),
      item('/sales/orders', 'Orders', 'sales', 'sales.orders.view', 'clipboardList'),
      item('/sales/delivery-notes', 'Delivery Notes', 'sales', 'sales.delivery_notes.view', 'truck'),
      item('/sales/invoices', 'Invoices', 'sales', 'sales.invoices.view', 'receipt'),
      item('/sales/returns', 'Returns', 'sales', 'sales.returns.view', 'undo'),
      item('/sales/reports', 'Reports', 'sales', 'sales.reports.view', 'barChart'),
      item('/sales/scheduled-reports', 'Scheduled reports', 'schedulers', 'schedulers.view', 'calendarClock'),
    ],
  },
  {
    header: 'Purchases',
    module: 'purchases',
    items: [
      item('/purchases', 'Overview', 'purchases', 'purchases.overview.view', 'layoutGrid'),
      item('/purchases/orders', 'Purchase Orders', 'purchases', 'purchases.orders.view', 'shoppingCart'),
      item(
        '/purchases/goods-receipt',
        'Goods Receipt',
        'purchases',
        'purchases.goods_receipt.view',
        'packageCheck',
      ),
      item('/purchases/bills', 'Bills', 'purchases', 'purchases.bills.view', 'receipt'),
      item('/purchases/returns', 'Returns', 'purchases', 'purchases.returns.view', 'undo'),
      item('/purchases/reports', 'Reports', 'purchases', 'purchases.reports.view', 'barChart'),
      item(
        '/purchases/scheduled-reports',
        'Scheduled reports',
        'schedulers',
        'schedulers.view',
        'calendarClock',
      ),
    ],
  },
  {
    header: 'Inventory',
    module: 'inventory',
    items: [
      item('/inventory', 'Overview', 'inventory', 'inventory.overview.view', 'layoutGrid'),
      item('/inventory/categories', 'Categories', 'inventory', 'inventory.categories.view', 'tags'),
      item('/inventory/products', 'Products', 'inventory', 'inventory.products.view', 'package'),
      item('/inventory/stock', 'Stock', 'inventory', 'inventory.stock.view', 'boxes'),
      item('/inventory/stock-ledger', 'Stock Ledger', 'inventory', 'inventory.stock_ledger.view', 'scrollText'),
      item('/inventory/movements', 'Movements', 'inventory', 'inventory.movements.view', 'arrowLeftRight'),
      item('/inventory/transfers', 'Transfers', 'inventory', 'inventory.transfers.view', 'warehouse'),
      item(
        '/inventory/customer-prices',
        'Customer Prices',
        'inventory',
        'inventory.customer_prices.view',
        'badgeDollar',
      ),
      item('/inventory/reports', 'Reports', 'inventory', 'inventory.reports.view', 'barChart'),
      item(
        '/inventory/scheduled-reports',
        'Scheduled reports',
        'schedulers',
        'schedulers.view',
        'calendarClock',
      ),
    ],
  },
  {
    header: 'Production',
    module: 'production',
    items: [
      item('/production', 'Overview', 'production', 'production.overview.view', 'layoutGrid'),
      item('/production/recipes', 'Recipes', 'production', 'production.recipes.view', 'flaskConical'),
      item('/production/batches', 'Batches', 'production', 'production.batches.view', 'layers'),
      item('/production/day-book', 'Day Book', 'production', 'production.day_book.view', 'bookOpen'),
      item('/production/margins', 'Margins', 'production', 'production.margins.view', 'percent'),
      item('/production/yield', 'Yield', 'production', 'production.yield.view', 'scale'),
      item('/production/reports', 'Reports', 'production', 'production.reports.view', 'barChart'),
      item(
        '/production/scheduled-reports',
        'Scheduled reports',
        'schedulers',
        'schedulers.view',
        'calendarClock',
      ),
    ],
  },
  {
    header: 'Finance',
    module: 'finance',
    items: [
      item('/finance', 'Overview', 'finance', 'finance.overview.view', 'layoutGrid'),
      item('/finance/accounts', 'Accounts', 'finance', 'finance.accounts.view', 'landmark'),
      item('/finance/vouchers', 'Vouchers', 'finance', 'finance.vouchers.view', 'receipt'),
      item('/finance/receipts', 'Receipts', 'finance', 'finance.receipts.view', 'wallet'),
      item('/finance/payments', 'Payments', 'finance', 'finance.payments.view', 'creditCard'),
      item('/finance/credit-notes', 'Credit Notes', 'finance', 'finance.credit_notes.view', 'fileText'),
      item('/finance/debit-notes', 'Debit Notes', 'finance', 'finance.debit_notes.view', 'fileText'),
      item(
        '/finance/accounting-invoices',
        'Accounting Invoices',
        'finance',
        'finance.accounting_invoices.view',
        'receipt',
      ),
      item('/finance/journal', 'Journal', 'finance', 'finance.journal.view', 'notebook'),
      item('/finance/trial-balance', 'Trial Balance', 'finance', 'finance.trial_balance.view', 'balanceScale'),
      item('/finance/reports', 'Reports', 'finance', 'finance.reports.view', 'barChart'),
      item('/finance/export-backup', 'Export / Backup', 'finance', 'finance.export.view', 'hardDrive'),
    ],
  },
];

/** Create menu — high-frequency entity actions (not admin). */
export const CREATE_ACTIONS: NavItem[] = [
  item('/parties/customers', 'Customer', 'parties', 'parties.customers.view', 'users'),
  item('/sales/orders', 'Sales order', 'sales', 'sales.orders.view', 'clipboardList'),
  item('/sales/invoices', 'Invoice', 'sales', 'sales.invoices.view', 'receipt'),
  item('/boutique/orders/workspace', 'Boutique order', 'boutique', 'boutique.orders.view', 'shoppingBag'),
  item('/purchases/orders', 'Purchase order', 'purchases', 'purchases.orders.view', 'shoppingCart'),
  item('/purchases/bills', 'Purchase bill', 'purchases', 'purchases.bills.view', 'receipt'),
];

/** Settings flyout sections — admin / config / access / tools / system. */
export const SETTINGS_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Business',
    items: [
      item('/business-settings', 'Business Settings', 'settings', 'settings.business.view', 'building'),
      item('/settings-locations', 'Locations', 'settings', 'settings.locations.view', 'mapPin'),
      item('/store-time', 'Business Tasks', 'store', 'parties.store_tasks.view', 'clock'),
    ],
  },
  {
    title: 'Configuration',
    items: [
      item('/settings/print', 'Print', 'settings', 'settings.print.view', 'printer'),
      item('/settings/keyboard', 'Keyboard Shortcuts', 'settings', 'settings.keyboard.view', 'keyboard'),
      item('/settings/activities', 'Customization Activities', 'boutique', 'settings.activities.view', 'activity'),
      item(
        '/settings/project-activities',
        'Project Activities',
        'projects',
        'settings.project_activities.view',
        'activity',
      ),
      item('/settings/store-activities', 'Store Activities', 'store', 'settings.store_activities.view', 'activity'),
      item(
        '/settings/business-activities',
        'Business Activities',
        'business_ops',
        'settings.business_activities.view',
        'activity',
      ),
      item(
        '/settings/production-activities',
        'Production Activities',
        'production',
        'settings.production_activities.view',
        'activity',
      ),
      item(
        '/settings/measurement-specs',
        'Measurement Specs',
        'boutique',
        'settings.measurement_specs.view',
        'ruler',
      ),
      item('/settings/services', 'Service Configuration', 'settings', 'settings.services.view', 'sliders'),
      item('/settings/discounts', 'Discounts', 'settings', 'settings.discounts.view', 'percent'),
      item('/settings/crm', 'CRM Settings', 'crm', 'crm.settings.view', 'settings'),
      item('/settings/production', 'Production Settings', 'production', 'production.settings.view', 'settings'),
    ],
  },
  {
    title: 'Access',
    items: [
      item('/access/users', 'Users', 'settings', 'settings.users.view', 'usersRound'),
      item('/access/roles', 'Roles', 'settings', 'settings.roles.view', 'shield'),
      item('/access/permissions', 'Permissions', 'settings', 'settings.permissions.view', 'keyRound'),
      item('/access/audit-logs', 'Audit Logs', 'settings', 'settings.audit.view', 'scrollText'),
      item('/access/plans', 'Plans', 'settings', 'settings.plans.view', 'badgeDollar'),
      item('/access/feature-flags', 'Feature Flags', 'settings', 'settings.flags.view', 'flag'),
    ],
  },
  {
    title: 'Tools',
    items: [
      item('/migration', 'Data Migration', 'migration', 'migration.view', 'database'),
      item('/schedulers/crm', 'CRM Schedulers', 'schedulers', 'schedulers.view', 'calendarClock'),
      item('/schedulers/sales', 'Sales Schedulers', 'schedulers', 'schedulers.view', 'calendarClock'),
      item('/schedulers/purchases', 'Purchases Schedulers', 'schedulers', 'schedulers.view', 'calendarClock'),
      item('/schedulers/inventory', 'Inventory Schedulers', 'schedulers', 'schedulers.view', 'calendarClock'),
      item('/schedulers/production', 'Production Schedulers', 'schedulers', 'schedulers.view', 'calendarClock'),
      item('/schedulers/boutique', 'Boutique Schedulers', 'schedulers', 'schedulers.view', 'calendarClock'),
      item('/schedulers/projects', 'Projects Schedulers', 'schedulers', 'schedulers.view', 'calendarClock'),
    ],
  },
  {
    title: 'System',
    items: [
      item('/system', 'System Settings', 'system', 'system.settings.view', 'settings'),
      item('/system/updates', 'Updates', 'system', 'system.updates.view', 'refreshCw'),
      item('/system/logs', 'Logs', 'system', 'system.logs.view', 'scrollText'),
    ],
  },
];

/** @deprecated Prefer SETTINGS_SECTIONS / CREATE_ACTIONS — kept for GlobalSearch Pages/Business/Settings. */
export const TOPBAR_MENUS = {
  business: {
    title: 'Business',
    items: SETTINGS_SECTIONS[0].items,
  },
  access: {
    title: 'Access',
    items: SETTINGS_SECTIONS[2].items,
  },
  settings: {
    title: 'Settings',
    items: SETTINGS_SECTIONS[1].items,
  },
  migration: {
    title: 'Migration',
    items: [SETTINGS_SECTIONS[3].items[0]],
  },
  schedulers: {
    title: 'Schedulers',
    items: SETTINGS_SECTIONS[3].items.slice(1),
  },
};

/** Visible if org module is enabled; then page permission (or module.* key) when known. */
export function navItemVisible(
  item: NavItem,
  opts: {
    moduleEnabled: (mod: string | undefined) => boolean;
    can: (key: string) => boolean;
    hasPermissionList: boolean;
  },
): boolean {
  if (!opts.moduleEnabled(item.module)) return false;
  if (!item.permission) return true;
  if (!opts.hasPermissionList) return true;
  if (opts.can(item.permission)) return true;
  if (item.module && opts.can(`module.${item.module}`)) return true;
  return false;
}
