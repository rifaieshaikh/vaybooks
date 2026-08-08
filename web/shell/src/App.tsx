import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppSelector } from '@vaybooks/store';
import { AppLayout } from './components/AppLayout';
import { LicenseBlockedPage } from './components/LicenseBlockedPage';
import { LoginPage } from './components/LoginPage';
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
} from '../../mfe-store/src';
import {
  ProductionBatchDetailPage,
  ProductionBatchesListPage,
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
  ProjectRaBillsPage,
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
  BoutiqueOrdersListPage,
  BoutiqueOverviewPage,
  BoutiqueReportsPage,
  BoutiqueScheduledReportsPage,
  BoutiqueTimePage,
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
  GoodsReceiptDetailPage,
  GoodsReceiptListPage,
  PurchaseBillDetailPage,
  PurchaseBillsListPage,
  PurchaseOrderDetailPage,
  PurchaseOrdersListPage,
  PurchaseReturnDetailPage,
  PurchaseReturnsListPage,
  PurchasesOverviewPage,
  PurchasesReportsPage,
  PurchasesScheduledReportsPage,
} from '../../mfe-purchases/src';
import {
  DeliveryNoteDetailPage,
  DeliveryNotesListPage,
  EstimateDetailPage,
  EstimatesListPage,
  QuotationDetailPage,
  QuotationsListPage,
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

  if (!accessToken) {
    return <LoginPage />;
  }

  if (licenseStatus === 'expired') {
    return <LicenseBlockedPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeDashboardPage />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="mtd-dashboard" element={<MtdDashboardPage />} />

        <Route path="parties" element={<Navigate to="/parties/customers" replace />} />
        <Route path="parties/customers" element={<CustomersListPage />} />
        <Route path="parties/customers/:id" element={<CustomerDetailPage />} />
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

        <Route path="crm" element={<CrmOverviewPage />} />
        <Route path="crm/leads" element={<CrmLeadsListPage />} />
        <Route path="crm/leads/:id" element={<CrmLeadDetailPage />} />
        <Route path="crm/enquiries" element={<CrmEnquiriesListPage />} />
        <Route path="crm/enquiries/:id" element={<CrmEnquiryDetailPage />} />
        <Route path="crm/activities" element={<CrmActivitiesListPage />} />
        <Route path="crm/activities/:id" element={<CrmActivityDetailPage />} />
        <Route path="crm/calendar" element={<CrmCalendarPage />} />
        <Route path="crm/reports" element={<CrmReportsPage />} />
        <Route path="crm/scheduled-reports" element={<CrmScheduledReportsPage />} />
        <Route path="boutique" element={<BoutiqueOverviewPage />} />
        <Route path="boutique/orders" element={<BoutiqueOrdersListPage />} />
        <Route path="boutique/orders/:id" element={<BoutiqueOrderDetailPage />} />
        <Route path="boutique/items" element={<BoutiqueItemsListPage />} />
        <Route path="boutique/items/:id" element={<BoutiqueItemDetailPage />} />
        <Route path="boutique/measurements" element={<BoutiqueMeasurementsListPage />} />
        <Route path="boutique/measurements/:id" element={<BoutiqueMeasurementDetailPage />} />
        <Route path="boutique/time" element={<BoutiqueTimePage />} />
        <Route path="boutique/calendar" element={<BoutiqueCalendarPage />} />
        <Route path="boutique/reports" element={<BoutiqueReportsPage />} />
        <Route path="boutique/scheduled-reports" element={<BoutiqueScheduledReportsPage />} />
        <Route path="projects" element={<ProjectsOverviewPage />} />
        <Route path="projects/list" element={<ProjectsListPage />} />
        <Route path="projects/list/:id" element={<ProjectDetailPage />} />
        <Route path="projects/enquiries" element={<ProjectEnquiriesListPage />} />
        <Route path="projects/enquiries/:id" element={<ProjectEnquiryDetailPage />} />
        <Route path="projects/measurements" element={<ProjectMeasurementsPage />} />
        <Route path="projects/ra-bills" element={<ProjectRaBillsPage />} />
        <Route path="projects/reports" element={<ProjectsReportsPage />} />
        <Route path="projects/scheduled-reports" element={<ProjectsScheduledReportsPage />} />
        <Route path="projects/settings" element={<ProjectsSettingsPage />} />
        <Route path="sales" element={<SalesOverviewPage />} />
        <Route path="sales/estimates" element={<EstimatesListPage />} />
        <Route path="sales/estimates/:id" element={<EstimateDetailPage />} />
        <Route path="sales/quotations" element={<QuotationsListPage />} />
        <Route path="sales/quotations/:id" element={<QuotationDetailPage />} />
        <Route path="sales/orders" element={<SalesOrdersListPage />} />
        <Route path="sales/orders/:id" element={<SalesOrderDetailPage />} />
        <Route path="sales/delivery-notes" element={<DeliveryNotesListPage />} />
        <Route path="sales/delivery-notes/:id" element={<DeliveryNoteDetailPage />} />
        <Route path="sales/invoices" element={<SalesInvoicesListPage />} />
        <Route path="sales/invoices/:id" element={<SalesInvoiceDetailPage />} />
        <Route path="sales/returns" element={<SalesReturnsListPage />} />
        <Route path="sales/returns/:id" element={<SalesReturnDetailPage />} />
        <Route path="sales/reports" element={<SalesReportsPage />} />
        <Route path="sales/scheduled-reports" element={<SalesScheduledReportsPage />} />

        <Route path="purchases" element={<PurchasesOverviewPage />} />
        <Route path="purchases/orders" element={<PurchaseOrdersListPage />} />
        <Route path="purchases/orders/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="purchases/goods-receipt" element={<GoodsReceiptListPage />} />
        <Route path="purchases/goods-receipt/:id" element={<GoodsReceiptDetailPage />} />
        <Route path="purchases/bills" element={<PurchaseBillsListPage />} />
        <Route path="purchases/bills/:id" element={<PurchaseBillDetailPage />} />
        <Route path="purchases/returns" element={<PurchaseReturnsListPage />} />
        <Route path="purchases/returns/:id" element={<PurchaseReturnDetailPage />} />
        <Route path="purchases/reports" element={<PurchasesReportsPage />} />
        <Route path="purchases/scheduled-reports" element={<PurchasesScheduledReportsPage />} />

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

        <Route path="production" element={<ProductionOverviewPage />} />
        <Route path="production/recipes" element={<ProductionRecipesPage />} />
        <Route path="production/batches" element={<ProductionBatchesListPage />} />
        <Route path="production/batches/:id" element={<ProductionBatchDetailPage />} />
        <Route path="production/day-book" element={<ProductionDayBookPage />} />
        <Route path="production/margins" element={<ProductionMarginsPage />} />
        <Route path="production/yield" element={<ProductionYieldPage />} />
        <Route path="production/reports" element={<ProductionReportsPage />} />
        <Route path="production/scheduled-reports" element={<ProductionScheduledReportsPage />} />
        <Route path="production/settings" element={<ProductionSettingsPage />} />

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

        <Route path="schedulers" element={<SchedulersHubPage />} />
        <Route path="schedulers/:module" element={<SchedulersModulePage />} />
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
        <Route path="settings/activities" element={<CustomizationActivitiesPage />} />
        <Route path="settings/project-activities" element={<ProjectActivitiesSettingsPage />} />
        <Route path="settings/store-activities" element={<StoreActivitiesSettingsPage />} />
        <Route path="settings/measurement-specs" element={<MeasurementSpecsPage />} />
        <Route path="settings/services" element={<ServicesSettingsPage />} />
        <Route path="settings/discounts" element={<DiscountsSettingsPage />} />
        <Route path="settings/crm" element={<CrmSettingsRedirectPage />} />
        <Route path="settings/production" element={<Navigate to="/production/settings" replace />} />

        <Route path="system" element={<SystemHubPage />} />
        <Route path="system/settings" element={<SystemSettingsPage />} />
        <Route path="system/updates" element={<SystemUpdatesPage />} />
        <Route path="system/logs" element={<SystemLogsPage />} />

        <Route path="reports" element={<ReportsCatalogPage />} />
        <Route path="migration" element={<MigrationHubPage />} />
        <Route path="store" element={<StoreOverviewPage />} />
        <Route path="store-time" element={<StoreTimePage />} />
        <Route path="business-settings" element={<BusinessSettingsPage />} />
        <Route path="settings-locations" element={<SettingsLocationsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
