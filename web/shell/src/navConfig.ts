/** Sidebar + topbar navigation mirroring Streamlit `page_groups` in app.py. */

export type NavItem = { to: string; label: string };

export type NavGroup = {
  /** Empty string = ungrouped home items (Dashboard / MTD). */
  header: string;
  items: NavItem[];
};

/** Left sidebar — same groups Streamlit keeps visible (not topbar-only). */
export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    header: '',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/mtd-dashboard', label: 'MTD' },
    ],
  },
  {
    header: 'Parties',
    items: [
      { to: '/parties/customers', label: 'Customers' },
      { to: '/parties/vendors', label: 'Vendors' },
      { to: '/parties/delivery-partners', label: 'Delivery Partners' },
      { to: '/parties/commission-agents', label: 'Commission Agents' },
      { to: '/parties/workers', label: 'Employees' },
      { to: '/parties/segments', label: 'Segments' },
    ],
  },
  {
    header: 'CRM',
    items: [
      { to: '/crm', label: 'Overview' },
      { to: '/crm/leads', label: 'Leads' },
      { to: '/crm/enquiries', label: 'Enquiries' },
      { to: '/crm/activities', label: 'Activities' },
      { to: '/crm/calendar', label: 'Calendar' },
      { to: '/crm/reports', label: 'Reports' },
      { to: '/crm/scheduled-reports', label: 'Scheduled reports' },
    ],
  },
  {
    header: 'Boutique',
    items: [
      { to: '/boutique', label: 'Overview' },
      { to: '/boutique/orders', label: 'Customization Orders' },
      { to: '/boutique/measurements', label: 'Measurements' },
      { to: '/boutique/items', label: 'Customization Items' },
      { to: '/boutique/time', label: 'Tasks' },
      { to: '/boutique/calendar', label: 'Calendar' },
      { to: '/boutique/reports', label: 'Reports' },
      { to: '/boutique/scheduled-reports', label: 'Scheduled reports' },
    ],
  },
  {
    header: 'Projects',
    items: [
      { to: '/projects', label: 'Overview' },
      { to: '/projects/enquiries', label: 'Enquiries' },
      { to: '/projects/list', label: 'Projects' },
      { to: '/projects/measurements', label: 'Measurements' },
      { to: '/projects/ra-bills', label: 'RA Bills' },
      { to: '/projects/reports', label: 'Reports' },
      { to: '/projects/scheduled-reports', label: 'Scheduled reports' },
      { to: '/projects/settings', label: 'Settings' },
    ],
  },
  {
    header: 'Sales',
    items: [
      { to: '/sales', label: 'Overview' },
      { to: '/sales/estimates', label: 'Estimates' },
      { to: '/sales/quotations', label: 'Quotations' },
      { to: '/sales/orders', label: 'Orders' },
      { to: '/sales/delivery-notes', label: 'Delivery Notes' },
      { to: '/sales/invoices', label: 'Invoices' },
      { to: '/sales/returns', label: 'Returns' },
      { to: '/sales/reports', label: 'Reports' },
      { to: '/sales/scheduled-reports', label: 'Scheduled reports' },
    ],
  },
  {
    header: 'Purchases',
    items: [
      { to: '/purchases', label: 'Overview' },
      { to: '/purchases/orders', label: 'Purchase Orders' },
      { to: '/purchases/goods-receipt', label: 'Goods Receipt' },
      { to: '/purchases/bills', label: 'Bills' },
      { to: '/purchases/returns', label: 'Returns' },
      { to: '/purchases/reports', label: 'Reports' },
      { to: '/purchases/scheduled-reports', label: 'Scheduled reports' },
    ],
  },
  {
    header: 'Inventory',
    items: [
      { to: '/inventory', label: 'Overview' },
      { to: '/inventory/categories', label: 'Categories' },
      { to: '/inventory/products', label: 'Products' },
      { to: '/inventory/stock', label: 'Stock' },
      { to: '/inventory/stock-ledger', label: 'Stock Ledger' },
      { to: '/inventory/movements', label: 'Movements' },
      { to: '/inventory/transfers', label: 'Transfers' },
      { to: '/inventory/customer-prices', label: 'Customer Prices' },
      { to: '/inventory/reports', label: 'Reports' },
      { to: '/inventory/scheduled-reports', label: 'Scheduled reports' },
    ],
  },
  {
    header: 'Production',
    items: [
      { to: '/production', label: 'Overview' },
      { to: '/production/recipes', label: 'Recipes' },
      { to: '/production/batches', label: 'Batches' },
      { to: '/production/day-book', label: 'Day Book' },
      { to: '/production/margins', label: 'Margins' },
      { to: '/production/yield', label: 'Yield' },
      { to: '/production/reports', label: 'Reports' },
      { to: '/production/scheduled-reports', label: 'Scheduled reports' },
    ],
  },
  {
    header: 'Finance',
    items: [
      { to: '/finance', label: 'Overview' },
      { to: '/finance/accounts', label: 'Accounts' },
      { to: '/finance/vouchers', label: 'Vouchers' },
      { to: '/finance/receipts', label: 'Receipts' },
      { to: '/finance/payments', label: 'Payments' },
      { to: '/finance/credit-notes', label: 'Credit Notes' },
      { to: '/finance/debit-notes', label: 'Debit Notes' },
      { to: '/finance/accounting-invoices', label: 'Accounting Invoices' },
      { to: '/finance/journal', label: 'Journal' },
      { to: '/finance/trial-balance', label: 'Trial Balance' },
      { to: '/finance/reports', label: 'Reports' },
      { to: '/finance/export-backup', label: 'Export / Backup' },
    ],
  },
  {
    header: 'System',
    items: [
      { to: '/system', label: 'Settings' },
      { to: '/system/updates', label: 'Updates' },
      { to: '/system/logs', label: 'Logs' },
    ],
  },
];

/** Topbar popovers — Streamlit surfaces these from the header, not the sidebar. */
export const TOPBAR_MENUS = {
  business: {
    title: 'Business',
    items: [
      { to: '/business-settings', label: 'Business Settings' },
      { to: '/settings-locations', label: 'Locations' },
      { to: '/store-time', label: 'Business Tasks' },
    ] as NavItem[],
  },
  access: {
    title: 'Access',
    items: [
      { to: '/access/users', label: 'Users' },
      { to: '/access/roles', label: 'Roles' },
      { to: '/access/permissions', label: 'Permissions' },
      { to: '/access/audit-logs', label: 'Audit Logs' },
      { to: '/access/plans', label: 'Plans' },
      { to: '/access/feature-flags', label: 'Feature Flags' },
    ] as NavItem[],
  },
  settings: {
    title: 'Settings',
    items: [
      { to: '/settings/print', label: 'Print' },
      { to: '/settings/keyboard', label: 'Keyboard Shortcuts' },
      { to: '/settings/activities', label: 'Customization Activities' },
      { to: '/settings/project-activities', label: 'Project Activities' },
      { to: '/settings/store-activities', label: 'Store Activities' },
      { to: '/settings/measurement-specs', label: 'Measurement Specs' },
      { to: '/settings/services', label: 'Service Configuration' },
      { to: '/settings/discounts', label: 'Discounts' },
      { to: '/settings/crm', label: 'CRM Settings' },
      { to: '/settings/production', label: 'Production Settings' },
    ] as NavItem[],
  },
  migration: {
    title: 'Migration',
    items: [{ to: '/migration', label: 'Data Migration' }] as NavItem[],
  },
  schedulers: {
    title: 'Schedulers',
    items: [
      { to: '/schedulers/crm', label: 'CRM' },
      { to: '/schedulers/sales', label: 'Sales' },
      { to: '/schedulers/purchases', label: 'Purchases' },
      { to: '/schedulers/inventory', label: 'Inventory' },
      { to: '/schedulers/production', label: 'Production' },
      { to: '/schedulers/boutique', label: 'Boutique' },
      { to: '/schedulers/projects', label: 'Projects' },
    ] as NavItem[],
  },
};
