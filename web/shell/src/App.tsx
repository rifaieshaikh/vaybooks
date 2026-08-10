import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useGetSetupStatusQuery, useAppSelector } from '@vaybooks/store';
import { AppLayout } from './components/AppLayout';
import { RequireModule, RequirePermission } from './components/PermissionGate';
import { LicenseBlockedPage } from './components/LicenseBlockedPage';
import { LoginPage } from './components/LoginPage';
import { SetupWizardModal } from './components/SetupWizardModal';
import { useShellKeyboardShortcuts } from './useShellKeyboardShortcuts';
import { ShellListKeyboardProvider } from './ShellListKeyboardProvider';

function ModuleGate({ module }: { module: string }) {
  return (
    <RequireModule module={module}>
      <Outlet />
    </RequireModule>
  );
}
import {
  AccessAuditLogsPage,
  AccessFeatureFlagsPage,
  AccessPermissionsPage,
  AccessPlansPage,
  AccessRoleDetailPage,
  AccessRolesListPage,
  AccessUserDetailPage,
  AccessUsersListPage,
} from '../../mfe-access/src';
import {
  BusinessSettingsPage,
  CrmSettingsRedirectPage,
  CustomizationActivitiesPage,
  DiscountsSettingsPage,
  KeyboardShortcutsPage,
  MeasurementSpecsPage,
  PrintSettingsPage,
  ProjectActivitiesSettingsPage,
  ServicesSettingsPage,
  SettingsHomeRedirect,
  SettingsLocationsPage,
  StoreActivitiesSettingsPage,
} from '../../mfe-settings/src';
import {
  HomeDashboardPage,
  MtdDashboardPage,
  ReportsCatalogPage,
} from '../../mfe-home/src';
import { SchedulersHubPage, SchedulersModulePage } from '../../mfe-schedulers/src';
import { MigrationHubPage } from '../../mfe-migration/src';
import {
  SystemHubPage,
  SystemLogsPage,
  SystemSettingsPage,
  SystemUpdatesPage,
} from '../../mfe-system/src';
import {
  StoreOverviewPage,
  StoreTimePage,
  BusinessCalendarPage,
} from '../../mfe-store/src';
import {
  BusinessOverviewPage,
  BusinessActivitiesPage,
  BusinessTasksPage,
  BusinessTimePage,
  ProductionActivitiesPage,
} from '../../mfe-business/src';
import {
  ProductionBatchDetailPage,
  ProductionBatchesListPage,
  ProductionCalendarPage,
  ProductionDayBookPage,
  ProductionMarginsPage,
  ProductionOverviewPage,
  ProductionRecipesPage,
  ProductionReportsPage,
  ProductionScheduledReportsPage,
  ProductionSettingsPage,
  ProductionYieldPage,
} from '../../mfe-production/src';
import {
  ProjectDetailPage,
  ProjectEnquiriesListPage,
  ProjectEnquiryDetailPage,
  ProjectMeasurementsPage,
  ProjectPortalPage,
  ProjectRaBillsPage,
  ProjectSiteMobilePage,
  ProjectsCalendarPage,
  ProjectsListPage,
  ProjectsOverviewPage,
  ProjectsReportsPage,
  ProjectsScheduledReportsPage,
  ProjectsSettingsPage,
} from '../../mfe-projects/src';
import {
  CrmActivitiesListPage,
  CrmActivityDetailPage,
  CrmCalendarPage,
  CrmCollectionsPage,
  CrmEnquiriesListPage,
  CrmEnquiryDetailPage,
  CrmLeadDetailPage,
  CrmLeadsListPage,
  CrmOverviewPage,
  CrmReportsPage,
  CrmScheduledReportsPage,
} from '../../mfe-crm/src';
import {
  BoutiqueCalendarPage,
  BoutiqueItemDetailPage,
  BoutiqueItemsListPage,
  BoutiqueMeasurementDetailPage,
  BoutiqueMeasurementsListPage,
  BoutiqueOrderDetailPage,
  BoutiqueOrderWorkspacePage,
  BoutiqueOrdersListPage,
  BoutiqueOverviewPage,
  BoutiqueReportsPage,
  BoutiqueScheduledReportsPage,
  BoutiqueTimeLogPage,
  BoutiqueTimePage,
  BoutiqueTaskDetailPage,
} from '../../mfe-boutique/src';
import {
  CommissionAgentDetailPage,
  CommissionAgentsListPage,
  CustomerDetailPage,
  CustomersListPage,
  DeliveryPartnerDetailPage,
  DeliveryPartnersListPage,
  SegmentsListPage,
  VendorDetailPage,
  VendorsListPage,
  WorkersListPage,
} from '../../mfe-parties/src';
import {
  CategoriesListPage,
  CustomerPricesPage,
  InventoryOverviewPage,
  InventoryReportsPage,
  InventoryScheduledReportsPage,
  MovementsListPage,
  ProductDetailPage,
  ProductsListPage,
  StockLedgerPage,
  StockListPage,
  TransferDetailPage,
  TransfersListPage,
} from '../../mfe-inventory/src';
import {
  AccountDetailPage,
  AccountingInvoicesListPage,
  AccountsListPage,
  CreditNotesListPage,
  DebitNotesListPage,
  ExportBackupPage,
  FinanceOverviewPage,
  FinanceReportsPage,
  JournalListPage,
  PaymentsListPage,
  ReceiptsListPage,
  TrialBalancePage,
  VouchersListPage,
} from '../../mfe-finance/src';
import {
  BillEditorPage,
  GoodsReceiptDetailPage,
  GoodsReceiptEditorPage,
  GoodsReceiptListPage,
  PurchaseBillDetailPage,
  PurchaseBillsListPage,
  PurchaseOrderDetailPage,
  PurchaseOrderEditorPage,
  PurchaseOrdersListPage,
  PurchaseReturnDetailPage,
  PurchaseReturnEditorPage,
  PurchaseReturnsListPage,
  PurchasesOverviewPage,
  PurchasesReportsPage,
  PurchasesScheduledReportsPage,
} from '../../mfe-purchases/src';
import {
  DeliveryNoteDetailPage,
  DeliveryNoteEditorPage,
  DeliveryNotesListPage,
  EstimateDetailPage,
  EstimateEditorPage,
  EstimatesListPage,
  InvoiceEditorPage,
  OrderEditorPage,
  QuotationDetailPage,
  QuotationEditorPage,
  QuotationsListPage,
  ReturnEditorPage,
  SalesInvoiceDetailPage,
  SalesInvoicesListPage,
  SalesOrderDetailPage,
  SalesOrdersListPage,
  SalesOverviewPage,
  SalesReportsPage,
  SalesReturnDetailPage,
  SalesReturnsListPage,
  SalesScheduledReportsPage,
} from '../../mfe-sales/src';

export default function App() {
  const accessToken = useAppSelector((s) => s.session.accessToken);
  const licenseStatus = useAppSelector((s) => s.license.status);
  useShellKeyboardShortcuts(Boolean(accessToken) && licenseStatus !== 'expired');

  const setupQ = useGetSetupStatusQuery(undefined, { skip: !accessToken });

  if (!accessToken) {
    return <LoginPage />;
  }

  if (licenseStatus === 'expired') {
    return <LicenseBlockedPage />;
  }

  if (setupQ.isLoading || setupQ.isFetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
        Preparing workspace…
      </div>
    );
  }

  if (setupQ.isError) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <p>Could not load setup status. Check the API and refresh.</p>
      </div>
    );
  }

  if (setupQ.data && !setupQ.data.setup_completed) {
    return (
      <SetupWizardModal
        orgId={setupQ.data.org_id || 'default'}
        onCompleted={() => {
          void setupQ.refetch();
        }}
      />
    );
  }

  return (
    <ShellListKeyboardProvider
      enabled={Boolean(accessToken) && licenseStatus !== 'expired'}
    >
      <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeDashboardPage />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="mtd-dashboard" element={<MtdDashboardPage />} />

        <Route element={<ModuleGate module="parties" />}>
          <Route path="parties" element={<Navigate to="/parties/customers" replace />} />
          <Route
            path="parties/customers"
            element={
              <RequirePermission permission="parties.customers.view">
                <CustomersListPage />
              </RequirePermission>
            }
          />
          <Route
            path="parties/customers/:id"
            element={
              <RequirePermission permission="parties.customers.view">
                <CustomerDetailPage />
              </RequirePermission>
            }
          />
          <Route path="parties/vendors" element={<VendorsListPage />} />
          <Route path="parties/vendors/:id" element={<VendorDetailPage />} />
          <Route path="parties/delivery-partners" element={<DeliveryPartnersListPage />} />
          <Route path="parties/delivery-partners/:id" element={<DeliveryPartnerDetailPage />} />
          <Route path="parties/commission-agents" element={<CommissionAgentsListPage />} />
          <Route path="parties/commission-agents/:id" element={<CommissionAgentDetailPage />} />
          <Route path="parties/workers" element={<WorkersListPage />} />
          <Route path="parties/employees" element={<Navigate to="/parties/workers" replace />} />
          <Route path="parties/segments" element={<SegmentsListPage />} />
          <Route path="party-segments" element={<Navigate to="/parties/segments" replace />} />
        </Route>

        <Route element={<ModuleGate module="crm" />}>
          <Route path="crm" element={<CrmOverviewPage />} />
          <Route path="crm/leads" element={<CrmLeadsListPage />} />
          <Route path="crm/leads/:id" element={<CrmLeadDetailPage />} />
          <Route path="crm/enquiries" element={<CrmEnquiriesListPage />} />
          <Route path="crm/enquiries/:id" element={<CrmEnquiryDetailPage />} />
          <Route path="crm/activities" element={<CrmActivitiesListPage />} />
          <Route path="crm/activities/:id" element={<CrmActivityDetailPage />} />
          <Route path="crm/collections" element={<CrmCollectionsPage />} />
          <Route path="crm/calendar" element={<CrmCalendarPage />} />
          <Route path="crm/reports" element={<CrmReportsPage />} />
          <Route path="crm/scheduled-reports" element={<CrmScheduledReportsPage />} />
        </Route>
        <Route element={<ModuleGate module="boutique" />}>
          <Route path="boutique" element={<BoutiqueOverviewPage />} />
          <Route path="boutique/orders" element={<BoutiqueOrdersListPage />} />
          <Route path="boutique/orders/workspace" element={<BoutiqueOrderWorkspacePage />} />
          <Route path="boutique/orders/:id" element={<BoutiqueOrderDetailPage />} />
          <Route path="boutique/items" element={<BoutiqueItemsListPage />} />
          <Route path="boutique/items/:id" element={<BoutiqueItemDetailPage />} />
          <Route path="boutique/measurements" element={<BoutiqueMeasurementsListPage />} />
          <Route path="boutique/measurements/:id" element={<BoutiqueMeasurementDetailPage />} />
          <Route path="boutique/time" element={<BoutiqueTimePage />} />
          <Route path="boutique/time/:id" element={<BoutiqueTaskDetailPage />} />
          <Route path="boutique/time-log" element={<BoutiqueTimeLogPage />} />
          <Route path="boutique/calendar" element={<BoutiqueCalendarPage />} />
          <Route path="boutique/reports" element={<BoutiqueReportsPage />} />
          <Route path="boutique/scheduled-reports" element={<BoutiqueScheduledReportsPage />} />
        </Route>
        <Route element={<ModuleGate module="projects" />}>
          <Route path="projects" element={<ProjectsOverviewPage />} />
          <Route path="projects/list" element={<ProjectsListPage />} />
          <Route path="projects/list/:id" element={<ProjectDetailPage />} />
          <Route path="projects/calendar" element={<ProjectsCalendarPage />} />
          <Route path="projects/portal/:id" element={<ProjectPortalPage />} />
          <Route path="projects/site-mobile/:id" element={<ProjectSiteMobilePage />} />
          <Route path="projects/enquiries" element={<ProjectEnquiriesListPage />} />
          <Route path="projects/enquiries/:id" element={<ProjectEnquiryDetailPage />} />
          <Route path="projects/measurements" element={<ProjectMeasurementsPage />} />
          <Route path="projects/ra-bills" element={<ProjectRaBillsPage />} />
          <Route path="projects/reports" element={<ProjectsReportsPage />} />
          <Route path="projects/scheduled-reports" element={<ProjectsScheduledReportsPage />} />
          <Route path="projects/settings" element={<ProjectsSettingsPage />} />
        </Route>
        <Route element={<ModuleGate module="sales" />}>
          <Route path="sales" element={<SalesOverviewPage />} />
          <Route path="sales/estimates" element={<EstimatesListPage />} />
          <Route path="sales/estimates/new" element={<EstimateEditorPage />} />
          <Route path="sales/estimates/:id/edit" element={<EstimateEditorPage />} />
          <Route path="sales/estimates/:id" element={<EstimateDetailPage />} />
          <Route path="sales/quotations" element={<QuotationsListPage />} />
          <Route path="sales/quotations/new" element={<QuotationEditorPage />} />
          <Route path="sales/quotations/:id/edit" element={<QuotationEditorPage />} />
          <Route path="sales/quotations/:id" element={<QuotationDetailPage />} />
          <Route path="sales/orders" element={<SalesOrdersListPage />} />
          <Route path="sales/orders/new" element={<OrderEditorPage />} />
          <Route path="sales/orders/:id/edit" element={<OrderEditorPage />} />
          <Route path="sales/orders/:id" element={<SalesOrderDetailPage />} />
          <Route path="sales/delivery-notes" element={<DeliveryNotesListPage />} />
          <Route path="sales/delivery-notes/new" element={<DeliveryNoteEditorPage />} />
          <Route path="sales/delivery-notes/:id/edit" element={<DeliveryNoteEditorPage />} />
          <Route path="sales/delivery-notes/:id" element={<DeliveryNoteDetailPage />} />
          <Route path="sales/invoices" element={<SalesInvoicesListPage />} />
          <Route path="sales/invoices/new" element={<InvoiceEditorPage />} />
          <Route path="sales/invoices/:id/edit" element={<InvoiceEditorPage />} />
          <Route path="sales/invoices/:id" element={<SalesInvoiceDetailPage />} />
          <Route path="sales/returns" element={<SalesReturnsListPage />} />
          <Route path="sales/returns/new" element={<ReturnEditorPage />} />
          <Route path="sales/returns/:id/edit" element={<ReturnEditorPage />} />
          <Route path="sales/returns/:id" element={<SalesReturnDetailPage />} />
          <Route path="sales/reports" element={<SalesReportsPage />} />
          <Route path="sales/scheduled-reports" element={<SalesScheduledReportsPage />} />
        </Route>

        <Route element={<ModuleGate module="purchases" />}>
          <Route path="purchases" element={<PurchasesOverviewPage />} />
          <Route path="purchases/orders" element={<PurchaseOrdersListPage />} />
          <Route path="purchases/orders/new" element={<PurchaseOrderEditorPage />} />
          <Route path="purchases/orders/:id/edit" element={<PurchaseOrderEditorPage />} />
          <Route path="purchases/orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="purchases/goods-receipt" element={<GoodsReceiptListPage />} />
          <Route path="purchases/goods-receipt/new" element={<GoodsReceiptEditorPage />} />
          <Route path="purchases/goods-receipt/:id" element={<GoodsReceiptDetailPage />} />
          <Route path="purchases/bills" element={<PurchaseBillsListPage />} />
          <Route path="purchases/bills/new" element={<BillEditorPage />} />
          <Route path="purchases/bills/:id/edit" element={<BillEditorPage />} />
          <Route path="purchases/bills/:id" element={<PurchaseBillDetailPage />} />
          <Route path="purchases/returns" element={<PurchaseReturnsListPage />} />
          <Route path="purchases/returns/new" element={<PurchaseReturnEditorPage />} />
          <Route path="purchases/returns/:id" element={<PurchaseReturnDetailPage />} />
          <Route path="purchases/reports" element={<PurchasesReportsPage />} />
          <Route path="purchases/scheduled-reports" element={<PurchasesScheduledReportsPage />} />
        </Route>

        <Route element={<ModuleGate module="inventory" />}>
          <Route path="inventory" element={<InventoryOverviewPage />} />
          <Route path="inventory/categories" element={<CategoriesListPage />} />
          <Route path="inventory/products" element={<ProductsListPage />} />
          <Route path="inventory/products/:id" element={<ProductDetailPage />} />
          <Route path="inventory/stock" element={<StockListPage />} />
          <Route path="inventory/stock-ledger" element={<StockLedgerPage />} />
          <Route path="inventory/movements" element={<MovementsListPage />} />
          <Route path="inventory/transfers" element={<TransfersListPage />} />
          <Route path="inventory/transfers/:id" element={<TransferDetailPage />} />
          <Route path="inventory/customer-prices" element={<CustomerPricesPage />} />
          <Route path="inventory/reports" element={<InventoryReportsPage />} />
          <Route path="inventory/scheduled-reports" element={<InventoryScheduledReportsPage />} />
          <Route path="inventory-overview" element={<Navigate to="/inventory" replace />} />
          <Route path="inventory-categories" element={<Navigate to="/inventory/categories" replace />} />
          <Route path="inventory-products" element={<Navigate to="/inventory/products" replace />} />
          <Route path="inventory-stock" element={<Navigate to="/inventory/stock" replace />} />
          <Route path="inventory-stock-ledger" element={<Navigate to="/inventory/stock-ledger" replace />} />
          <Route path="inventory-movements" element={<Navigate to="/inventory/movements" replace />} />
          <Route path="inventory-transfers" element={<Navigate to="/inventory/transfers" replace />} />
          <Route path="inventory-customer-prices" element={<Navigate to="/inventory/customer-prices" replace />} />
          <Route path="inventory-reports" element={<Navigate to="/inventory/reports" replace />} />
        </Route>

        <Route element={<ModuleGate module="production" />}>
          <Route path="production" element={<ProductionOverviewPage />} />
          <Route path="production/recipes" element={<ProductionRecipesPage />} />
          <Route path="production/batches" element={<ProductionBatchesListPage />} />
          <Route path="production/batches/:id" element={<ProductionBatchDetailPage />} />
          <Route path="production/calendar" element={<ProductionCalendarPage />} />
          <Route path="production/day-book" element={<ProductionDayBookPage />} />
          <Route path="production/margins" element={<ProductionMarginsPage />} />
          <Route path="production/yield" element={<ProductionYieldPage />} />
          <Route path="production/reports" element={<ProductionReportsPage />} />
          <Route path="production/scheduled-reports" element={<ProductionScheduledReportsPage />} />
          <Route path="production/settings" element={<ProductionSettingsPage />} />
          <Route path="settings/production-activities" element={<ProductionActivitiesPage />} />
        </Route>

        <Route element={<ModuleGate module="finance" />}>
          <Route path="finance" element={<FinanceOverviewPage />} />
          <Route path="finance/accounts" element={<AccountsListPage />} />
          <Route path="finance/accounts/:id" element={<AccountDetailPage />} />
          <Route path="finance/vouchers" element={<VouchersListPage />} />
          <Route path="finance/receipts" element={<ReceiptsListPage />} />
          <Route path="finance/payments" element={<PaymentsListPage />} />
          <Route path="finance/credit-notes" element={<CreditNotesListPage />} />
          <Route path="finance/debit-notes" element={<DebitNotesListPage />} />
          <Route path="finance/accounting-invoices" element={<AccountingInvoicesListPage />} />
          <Route path="finance/journal" element={<JournalListPage />} />
          <Route path="finance/trial-balance" element={<TrialBalancePage />} />
          <Route path="finance/reports" element={<FinanceReportsPage />} />
          <Route path="finance/export-backup" element={<ExportBackupPage />} />
        </Route>

        <Route element={<ModuleGate module="schedulers" />}>
          <Route path="schedulers" element={<SchedulersHubPage />} />
          <Route path="schedulers/:module" element={<SchedulersModulePage />} />
        </Route>
        <Route element={<ModuleGate module="settings" />}>
          <Route path="access" element={<Navigate to="/access/users" replace />} />
          <Route path="access/users" element={<AccessUsersListPage />} />
          <Route path="access/users/:id" element={<AccessUserDetailPage />} />
          <Route path="access/roles" element={<AccessRolesListPage />} />
          <Route path="access/roles/:id" element={<AccessRoleDetailPage />} />
          <Route path="access/permissions" element={<AccessPermissionsPage />} />
          <Route path="access/audit-logs" element={<AccessAuditLogsPage />} />
          <Route path="access/plans" element={<AccessPlansPage />} />
          <Route path="access/feature-flags" element={<AccessFeatureFlagsPage />} />
          <Route path="settings" element={<SettingsHomeRedirect />} />
          <Route path="settings/print" element={<PrintSettingsPage />} />
          <Route path="settings/keyboard" element={<KeyboardShortcutsPage />} />
          <Route path="settings/services" element={<ServicesSettingsPage />} />
          <Route path="settings/discounts" element={<DiscountsSettingsPage />} />
          <Route path="business-settings" element={<BusinessSettingsPage />} />
          <Route path="settings-locations" element={<SettingsLocationsPage />} />
        </Route>

        <Route element={<ModuleGate module="boutique" />}>
          <Route path="settings/activities" element={<CustomizationActivitiesPage />} />
          <Route path="settings/measurement-specs" element={<MeasurementSpecsPage />} />
        </Route>
        <Route element={<ModuleGate module="projects" />}>
          <Route path="settings/project-activities" element={<ProjectActivitiesSettingsPage />} />
        </Route>
        <Route element={<ModuleGate module="store" />}>
          <Route path="settings/store-activities" element={<StoreActivitiesSettingsPage />} />
          <Route path="store" element={<StoreOverviewPage />} />
          <Route path="store-time" element={<StoreTimePage />} />
          <Route path="business-calendar" element={<BusinessCalendarPage />} />
        </Route>
        <Route element={<ModuleGate module="business_ops" />}>
          <Route path="business" element={<BusinessOverviewPage />} />
          <Route path="business/tasks" element={<BusinessTasksPage />} />
          <Route path="business/time" element={<BusinessTimePage />} />
          <Route path="settings/business-activities" element={<BusinessActivitiesPage />} />
        </Route>
        <Route element={<ModuleGate module="crm" />}>
          <Route path="settings/crm" element={<CrmSettingsRedirectPage />} />
        </Route>
        <Route path="settings/production" element={<Navigate to="/production/settings" replace />} />
        <Route element={<ModuleGate module="system" />}>
          <Route path="system" element={<SystemHubPage />} />
          <Route path="system/settings" element={<SystemSettingsPage />} />
          <Route path="system/updates" element={<SystemUpdatesPage />} />
          <Route path="system/logs" element={<SystemLogsPage />} />
        </Route>

        <Route path="reports" element={<ReportsCatalogPage />} />
        <Route element={<ModuleGate module="migration" />}>
          <Route path="migration" element={<MigrationHubPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ShellListKeyboardProvider>
  );
}
