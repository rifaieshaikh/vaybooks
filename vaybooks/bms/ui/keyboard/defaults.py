"""Default parent and action shortcut bindings (complete catalog)."""

from __future__ import annotations

from vaybooks.bms.ui.keyboard.registry import (
    ActionShortcut,
    ParentShortcut,
    register_action,
    register_parent,
)

# --- Parents -----------------------------------------------------------------

# Labels match React sidebar/settings nav. Empty default_chord = unbound until assigned.
# workers_list is the Employees page (nav key kept for Streamlit / stored bindings).
_PARENTS = [
    # Home
    ParentShortcut("dashboard", "Dashboard", "Home", "ctrl+h"),
    ParentShortcut("mtd_dashboard", "MTD", "Home", "ctrl+shift+h"),
    # Parties
    ParentShortcut("customers_list", "Customers", "Parties", "ctrl+x", locked=True),
    ParentShortcut("vendors_list", "Vendors", "Parties", "ctrl+shift+v"),
    ParentShortcut("delivery_partners_list", "Delivery Partners", "Parties", "alt+0"),
    ParentShortcut("commission_agents_list", "Commission Agents", "Parties", "alt+shift+0"),
    ParentShortcut("workers_list", "Employees", "Parties", "ctrl+e"),
    ParentShortcut("segments_list", "Segments", "Parties", "ctrl+shift+g"),
    # CRM
    ParentShortcut("crm_dashboard", "Overview", "CRM", "ctrl+alt+6"),
    ParentShortcut("crm_leads_list", "Leads", "CRM", "ctrl+alt+7"),
    ParentShortcut("crm_enquiries_list", "Enquiries", "CRM", "ctrl+alt+8"),
    ParentShortcut("crm_activities_list", "Activities", "CRM", "ctrl+alt+9"),
    ParentShortcut("crm_calendar", "Calendar", "CRM", "alt+a"),
    ParentShortcut("crm_reports", "Reports", "CRM", "ctrl+alt+a"),
    ParentShortcut("crm_scheduled_reports", "Scheduled reports", "CRM", "alt+shift+a"),
    # Boutique
    ParentShortcut("boutique_overview", "Overview", "Boutique", "alt+shift+b"),
    ParentShortcut("orders_list", "Customization Orders", "Boutique", "ctrl+o"),
    ParentShortcut("items_list", "Customization Items", "Boutique", "ctrl+i"),
    ParentShortcut("measurements_list", "Measurements", "Boutique", "ctrl+alt+5"),
    ParentShortcut("time_list", "Tasks", "Boutique", "ctrl+t"),
    ParentShortcut("time_log", "Time log", "Boutique", "alt+b"),
    ParentShortcut("calendar_list", "Calendar", "Boutique", "ctrl+shift+c"),
    ParentShortcut("boutique_reports", "Reports", "Boutique", "alt+shift+t"),
    ParentShortcut("boutique_scheduled_reports", "Scheduled reports", "Boutique", "alt+c"),
    # Business ops
    ParentShortcut("business_ops_overview", "Overview", "Business Ops", "ctrl+alt+c"),
    ParentShortcut("business_ops_tasks", "Tasks", "Business Ops", "alt+shift+c"),
    ParentShortcut("store_time_list", "Time log", "Business Ops", "alt+d"),
    # Projects
    ParentShortcut("projects_dashboard", "Overview", "Projects", "alt+shift+d"),
    ParentShortcut("project_enquiries_list", "Enquiries", "Projects", "alt+e"),
    ParentShortcut("projects_list", "Projects", "Projects", "alt+f"),
    ParentShortcut("project_measurements_list", "Measurements", "Projects", "alt+g"),
    ParentShortcut("project_ra_bills_list", "RA Bills", "Projects", "ctrl+alt+g"),
    ParentShortcut("projects_reports", "Reports", "Projects", "alt+shift+g"),
    ParentShortcut("projects_scheduled_reports", "Scheduled reports", "Projects", "alt+h"),
    ParentShortcut("projects_settings", "Settings", "Projects", "ctrl+alt+h"),
    # Sales
    ParentShortcut("sales_overview", "Overview", "Sales", "alt+shift+o"),
    ParentShortcut("estimates_list", "Estimates", "Sales", "alt+shift+s"),
    ParentShortcut("quotations_list", "Quotations", "Sales", "alt+shift+q"),
    ParentShortcut("sales_orders_list", "Orders", "Sales", "ctrl+shift+o"),
    ParentShortcut("delivery_notes_list", "Delivery Notes", "Sales", "ctrl+shift+d"),
    ParentShortcut("sales_invoices_list", "Invoices", "Sales", "ctrl+shift+i"),
    ParentShortcut("sales_returns_list", "Returns", "Sales", "ctrl+shift+r"),
    ParentShortcut("sales_reports", "Reports", "Sales", "alt+shift+e"),
    ParentShortcut("sales_scheduled_reports", "Scheduled reports", "Sales", "alt+shift+h"),
    # Purchases
    ParentShortcut("purchases_overview", "Overview", "Purchases", "alt+shift+p"),
    ParentShortcut("purchase_orders_list", "Purchase Orders", "Purchases", "alt+p"),
    ParentShortcut("goods_receipt_list", "Goods Receipt", "Purchases", "ctrl+g"),
    ParentShortcut("purchases_list", "Bills", "Purchases", "ctrl+b"),
    ParentShortcut("purchase_returns_list", "Returns", "Purchases", "ctrl+shift+u"),
    ParentShortcut("purchases_reports", "Reports", "Purchases", "alt+shift+r"),
    ParentShortcut("purchases_scheduled_reports", "Scheduled reports", "Purchases", "alt+i"),
    # Inventory
    ParentShortcut("inventory_overview", "Overview", "Inventory", "alt+shift+i"),
    ParentShortcut("inventory_categories_list", "Categories", "Inventory", "ctrl+alt+i"),
    ParentShortcut("inventory_products_list", "Products", "Inventory", "ctrl+shift+k"),
    ParentShortcut("inventory_stock_list", "Stock", "Inventory", "ctrl+shift+w"),
    ParentShortcut("inventory_stock_ledger_list", "Stock Ledger", "Inventory", "ctrl+shift+l"),
    ParentShortcut("inventory_movements_list", "Movements", "Inventory", "ctrl+m"),
    ParentShortcut("inventory_transfers_list", "Transfers", "Inventory", "ctrl+alt+t"),
    ParentShortcut("inventory_customer_prices_list", "Customer Prices", "Inventory", "alt+j"),
    ParentShortcut("inventory_reports", "Reports", "Inventory", "alt+shift+v"),
    ParentShortcut("inventory_scheduled_reports", "Scheduled reports", "Inventory", "ctrl+alt+j"),
    # Production
    ParentShortcut("production_dashboard", "Overview", "Production", "alt+shift+m"),
    ParentShortcut("production_recipes", "Recipes", "Production", "ctrl+alt+r"),
    ParentShortcut("production_batches", "Batches", "Production", "ctrl+alt+b"),
    ParentShortcut("production_day_book", "Day Book", "Production", "ctrl+alt+d"),
    ParentShortcut("production_margins", "Margins", "Production", "alt+shift+j"),
    ParentShortcut("production_yield", "Yield", "Production", "alt+k"),
    ParentShortcut("production_reports", "Reports", "Production", "ctrl+alt+p"),
    ParentShortcut("production_scheduled_reports", "Scheduled reports", "Production", "alt+shift+k"),
    ParentShortcut("production_settings", "Settings", "Production", "alt+l"),
    # Finance
    ParentShortcut("finance_overview", "Overview", "Finance", "alt+shift+f"),
    ParentShortcut("accounts_list", "Accounts", "Finance", "ctrl+a"),
    ParentShortcut("vouchers_list", "Vouchers", "Finance", "ctrl+u"),
    ParentShortcut("receipts_list", "Receipts", "Finance", "ctrl+r"),
    ParentShortcut("payments_list", "Payments", "Finance", "ctrl+y"),
    ParentShortcut("credit_notes_list", "Credit Notes", "Finance", "alt+shift+l"),
    ParentShortcut("debit_notes_list", "Debit Notes", "Finance", "alt+m"),
    ParentShortcut("accounting_invoices_list", "Accounting Invoices", "Finance", "ctrl+shift+a"),
    ParentShortcut("journal_list", "Journal", "Finance", "ctrl+j"),
    ParentShortcut("trial_balance_list", "Trial Balance", "Finance", "ctrl+shift+b"),
    ParentShortcut("reports", "Reports", "Finance", "ctrl+alt+shift+g"),
    ParentShortcut("export_backup", "Export / Backup", "Finance", "ctrl+shift+e"),
    # Business / Settings / Access / System
    ParentShortcut("business_settings", "Business Settings", "Business", "ctrl+,"),
    ParentShortcut("settings_locations_list", "Locations", "Business", "alt+n"),
    ParentShortcut("store_time_settings", "Business Tasks", "Business", "ctrl+alt+n"),
    ParentShortcut("print_settings", "Print", "Settings", "alt+shift+n"),
    ParentShortcut("keyboard_shortcuts", "Keyboard Shortcuts", "Settings", "ctrl+/"),
    ParentShortcut("customization_activities_list", "Customization Activities", "Settings", "alt+o"),
    ParentShortcut("project_activities_list", "Project Activities", "Settings", "alt+q"),
    ParentShortcut("store_activities_list", "Store Activities", "Settings", "ctrl+alt+q"),
    ParentShortcut("business_activities_list", "Business Activities", "Settings", "alt+r"),
    ParentShortcut("production_activities_list", "Production Activities", "Settings", "alt+s"),
    ParentShortcut("measurement_specs", "Measurement Specs", "Settings", "alt+t"),
    ParentShortcut("services_list", "Service Configuration", "Settings", "ctrl+shift+f"),
    ParentShortcut("discounts_list", "Discounts", "Settings", "alt+u"),
    ParentShortcut("crm_settings", "CRM Settings", "Settings", "alt+shift+u"),
    ParentShortcut("users_settings", "Users", "Access", "alt+v"),
    ParentShortcut("roles_settings", "Roles", "Access", "ctrl+alt+v"),
    ParentShortcut("permissions_settings", "Permissions", "Access", "alt+w"),
    ParentShortcut("audit_logs", "Audit Logs", "Access", "ctrl+alt+w"),
    ParentShortcut("plans_settings", "Plans", "Access", "alt+shift+w"),
    ParentShortcut("feature_flags_settings", "Feature Flags", "Access", "alt+x"),
    ParentShortcut("data_migration", "Data Migration", "Migration", "ctrl+alt+1"),
    ParentShortcut("schedulers_crm", "CRM Schedulers", "Schedulers", "ctrl+alt+x"),
    ParentShortcut("schedulers_sales", "Sales Schedulers", "Schedulers", "alt+shift+x"),
    ParentShortcut("schedulers_purchases", "Purchases Schedulers", "Schedulers", "alt+y"),
    ParentShortcut("schedulers_inventory", "Inventory Schedulers", "Schedulers", "ctrl+alt+y"),
    ParentShortcut("schedulers_production", "Production Schedulers", "Schedulers", "alt+shift+y"),
    ParentShortcut("schedulers_boutique", "Boutique Schedulers", "Schedulers", "alt+z"),
    ParentShortcut("schedulers_projects", "Projects Schedulers", "Schedulers", "ctrl+alt+z"),
    ParentShortcut("system_settings", "System Settings", "System", "ctrl+alt+s"),
    ParentShortcut("system_updates", "Updates", "System", "ctrl+alt+u"),
    ParentShortcut("system_logs", "Logs", "System", "ctrl+alt+l"),
]

# --- Shared / list / dialog actions ------------------------------------------

_ACTIONS = [
    ActionShortcut("list.primary", "Add / Create (list primary)", "List", "ctrl+shift+n"),
    ActionShortcut("list.search.focus", "Focus list search", "List", "/"),
    ActionShortcut("list.row.next", "Next list row", "List", "j"),
    ActionShortcut("list.row.prev", "Previous list row", "List", "k"),
    ActionShortcut("list.row.open", "Open selected list row", "List", "enter"),
    ActionShortcut("list.row.edit", "Edit selected list row", "List", "e"),
    ActionShortcut("list.row.new", "New on current list", "List", "n"),
    ActionShortcut("list.filters.open", "Open Filters", "List", "ctrl+alt+f"),
    ActionShortcut("list.sort.open", "Open Sort", "List", "ctrl+shift+s"),
    ActionShortcut("list.filters.apply", "Apply Filters", "List", "ctrl+enter"),
    ActionShortcut("list.filters.clear", "Clear Filters", "List", "ctrl+1"),
    ActionShortcut("list.sort.clear", "Clear Sort", "List", "ctrl+2"),
    ActionShortcut("list.filters.mtd", "Filter date: MTD", "List", "ctrl+alt+m"),
    ActionShortcut("list.filters.last_30d", "Filter date: Last 30d", "List", "ctrl+alt+0"),
    ActionShortcut("list.prev_page", "Previous page", "List", "alt+left"),
    ActionShortcut("list.next_page", "Next page", "List", "alt+right"),
    ActionShortcut("nav.back", "Back to list", "Navigation", "alt+backspace"),
    ActionShortcut("dialog.save", "Save / Create (dialog)", "Dialog", "ctrl+s"),
    ActionShortcut("dialog.dismiss", "Dismiss dialog", "Dialog", "escape", mouse_only=True),
    ActionShortcut("dialog.open_existing", "Open existing party", "Dialog", "ctrl+alt+o"),
    ActionShortcut("form.add_line", "Add line / item", "Form", "ctrl+shift+."),
    ActionShortcut("form.remove_line", "Remove last line", "Form", "ctrl+shift+backspace"),
    # Domain aliases / actions
    ActionShortcut("customers.add", "Add Customer", "Customers", "ctrl+shift+n"),
    ActionShortcut("customers.create", "Create Customer", "Customers", "ctrl+s"),
    ActionShortcut("customers.save", "Save Customer", "Customers", "ctrl+s"),
    ActionShortcut("customers.open_existing", "Open existing customer", "Customers", "ctrl+alt+o"),
    ActionShortcut("customers.back", "Back to customers", "Customers", "alt+backspace"),
    ActionShortcut("customers.view_orders", "View customer orders", "Customers", "ctrl+alt+o"),
    ActionShortcut("vendors.add", "Add Vendor", "Vendors", "ctrl+shift+n"),
    ActionShortcut("vendors.open_existing", "Open existing vendor", "Vendors", "ctrl+alt+o"),
    ActionShortcut("vendors.record_payment", "Record vendor payment", "Vendors", "ctrl+p"),
    ActionShortcut("orders.add", "New Order", "Orders", "ctrl+shift+n"),
    ActionShortcut("orders.record_invoice", "Record Invoice", "Orders", "ctrl+1"),
    ActionShortcut("orders.record_delivery", "Record Delivery", "Orders", "ctrl+2"),
    ActionShortcut("orders.record_receipt", "Record Receipt", "Orders", "ctrl+3"),
    ActionShortcut("orders.record_payment", "Record Vendor Payment", "Orders", "ctrl+4"),
    ActionShortcut("orders.record_refund", "Record Refund", "Orders", "ctrl+5"),
    ActionShortcut("orders.mark_complete", "Mark Complete", "Orders", "ctrl+shift+m"),
    ActionShortcut(
        "orders.cancel", "Cancel Order", "Orders", "ctrl+shift+delete", destructive=True
    ),
    ActionShortcut("items.activity.add", "Add Activity", "Items", "ctrl+shift+a"),
    ActionShortcut("items.activity.complete", "Complete activity", "Items", "ctrl+shift+c"),
    ActionShortcut("items.activity.skip", "Skip activity", "Items", "ctrl+shift+k"),
    ActionShortcut(
        "items.activity.mark_done", "Mark activity done", "Items", "ctrl+enter"
    ),
    ActionShortcut("items.time.add", "Record Task", "Items", "ctrl+shift+t"),
    ActionShortcut("items.expense.add", "Add Expense", "Items", "ctrl+shift+x"),
    ActionShortcut(
        "items.activity.remove",
        "Remove activity",
        "Items",
        "ctrl+shift+delete",
        destructive=True,
    ),
    ActionShortcut("sales.orders.deliver", "Deliver against SO", "Sales", "ctrl+d"),
    ActionShortcut("sales.deliveries.create_invoice", "Invoice from DN", "Sales", "ctrl+i"),
    ActionShortcut(
        "purchases.orders.create",
        "Create Purchase Order (any screen)",
        "Purchases",
        "f1",
    ),
    ActionShortcut(
        "purchases.bills.create",
        "Create Purchase Bill (any screen)",
        "Purchases",
        "f2",
    ),
    ActionShortcut(
        "sales.estimates.create",
        "Create Estimate (any screen)",
        "Sales",
        "f3",
    ),
    ActionShortcut(
        "sales.orders.create",
        "Create Sales Order (any screen)",
        "Sales",
        "f4",
    ),
    ActionShortcut(
        "sales.invoices.create",
        "Create Sales Invoice (any screen)",
        "Sales",
        "f5",
    ),
    ActionShortcut(
        "sales.quotations.create",
        "Create Quotation (any screen)",
        "Sales",
        "f6",
    ),
    ActionShortcut(
        "sales.delivery_notes.create",
        "Create Delivery Note (any screen)",
        "Sales",
        "f7",
    ),
    ActionShortcut(
        "sales.returns.create",
        "Create Sales Return (any screen)",
        "Sales",
        "f8",
    ),
    ActionShortcut(
        "boutique.orders.create",
        "Create Boutique Order (any screen)",
        "Orders",
        "f9",
    ),
    ActionShortcut(
        "parties.customers.create",
        "Create Customer (any screen)",
        "Customers",
        "ctrl+shift+n",
    ),
    ActionShortcut(
        "parties.vendors.create",
        "Create Vendor (any screen)",
        "Vendors",
        "f10",
    ),
    ActionShortcut(
        "purchases.orders.receive", "Receive against PO", "Purchases", "ctrl+g"
    ),
    ActionShortcut(
        "purchases.orders.print", "Print purchase order PDF", "Purchases", "ctrl+p"
    ),
    ActionShortcut(
        "purchases.bills.delete",
        "Delete purchase bill",
        "Purchases",
        "ctrl+shift+delete",
        destructive=True,
    ),
    ActionShortcut("finance.accounts.ledger", "View Ledger", "Finance", "ctrl+l"),
    ActionShortcut(
        "finance.accounts.delete",
        "Delete account",
        "Finance",
        "ctrl+shift+delete",
        destructive=True,
    ),
    ActionShortcut("system.updates.check", "Check for Updates", "System", "ctrl+alt+k"),
    ActionShortcut(
        "system.updates.install",
        "Install update",
        "System",
        "ctrl+shift+enter",
        destructive=True,
    ),
    ActionShortcut("system.logs.refresh", "Refresh logs", "System", "ctrl+shift+r"),
    ActionShortcut("migration.download_template", "Download template", "Migration", "ctrl+shift+t"),
    ActionShortcut(
        "migration.upload", "Upload file", "Migration", "", mouse_only=True
    ),
    ActionShortcut("migration.apply_profile", "Apply profile", "Migration", "ctrl+shift+p"),
    ActionShortcut("migration.dry_run", "Dry-run import", "Migration", "ctrl+shift+d"),
    ActionShortcut(
        "migration.confirm_import",
        "Confirm import",
        "Migration",
        "ctrl+shift+enter",
        destructive=True,
    ),
    ActionShortcut("migration.download_errors", "Download errors", "Migration", "ctrl+alt+e"),
    ActionShortcut("export.csv.customers", "Export Customers CSV", "Export", "ctrl+alt+1"),
    ActionShortcut("export.csv.orders", "Export Orders CSV", "Export", "ctrl+alt+2"),
    ActionShortcut("export.csv.products", "Export Products CSV", "Export", "ctrl+alt+3"),
    ActionShortcut("export.csv.vendors", "Export Vendors CSV", "Export", "ctrl+alt+4"),
    ActionShortcut("export.backup.json", "Backup JSON", "Export", "ctrl+shift+j"),
    ActionShortcut("export.backup.zip", "Backup ZIP", "Export", "ctrl+shift+z"),
    ActionShortcut("export.backup.save_disk", "Save backup to disk", "Export", "ctrl+shift+b"),
    ActionShortcut(
        "export.backup.restore",
        "Restore backup",
        "Export",
        "ctrl+shift+delete",
        destructive=True,
    ),
    ActionShortcut(
        "reports.export", "Export report", "Reports", "ctrl+shift+e"
    ),
    ActionShortcut("reports.select", "Select report", "Reports", "f11"),
    ActionShortcut("dashboard.period.today", "Period: Today", "Dashboard", "ctrl+1"),
    ActionShortcut("dashboard.period.last_7d", "Period: Last 7d", "Dashboard", "ctrl+2"),
    ActionShortcut("dashboard.period.mtd", "Period: MTD", "Dashboard", "ctrl+3"),
    ActionShortcut("dashboard.period.last_30d", "Period: Last 30d", "Dashboard", "ctrl+4"),
    ActionShortcut("dashboard.period.quarter", "Period: Quarter", "Dashboard", "ctrl+5"),
    ActionShortcut("settings.business.save", "Save business settings", "Settings", "ctrl+s"),
    ActionShortcut("settings.system.save", "Save system settings", "Settings", "ctrl+s"),
]

for i in range(1, 10):
    _ACTIONS.append(
        ActionShortcut(
            f"list.view_nth.{i}", f"View card #{i}", "List", f"alt+{i}"
        )
    )
    _ACTIONS.append(
        ActionShortcut(
            f"list.edit_nth.{i}", f"Edit card #{i}", "List", f"alt+shift+{i}"
        )
    )


def ensure_defaults_loaded(*, force: bool = False) -> None:
    from vaybooks.bms.ui.keyboard import registry as R

    if R.PARENTS and not force:
        return
    R.PARENTS.clear()
    R.ACTIONS.clear()
    for p in _PARENTS:
        register_parent(p)
    for a in _ACTIONS:
        register_action(a)


def default_parents() -> dict[str, str]:
    ensure_defaults_loaded()
    from vaybooks.bms.ui.keyboard.registry import PARENTS

    return {k: p.default_chord for k, p in PARENTS.items() if p.default_chord}


def default_actions() -> dict[str, str]:
    ensure_defaults_loaded()
    from vaybooks.bms.ui.keyboard.registry import ACTIONS

    return {
        k: a.default_chord
        for k, a in ACTIONS.items()
        if a.default_chord and not a.mouse_only
    }
