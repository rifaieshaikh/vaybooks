import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppSelector } from '@vaybooks/store';
import { AppLayout } from './components/AppLayout';
import { LicenseBlockedPage } from './components/LicenseBlockedPage';
import { LoginPage } from './components/LoginPage';
import {
  AccessPage,
  BoutiquePage,
  CrmPage,
  HomePage,
  MigrationPage,
  ProductionPage,
  ProjectsPage,
  PurchasesPage,
  ReportsPage,
  SalesPage,
  SchedulersPage,
  SettingsPage,
  StorePage,
  SystemPage,
} from './pages/Modules';
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

/** Unmigrated Streamlit child routes land on the module stub until that wave ships. */
function stubRoutes(prefix: string, element: JSX.Element) {
  return (
    <>
      <Route path={prefix} element={element} />
      <Route path={`${prefix}/*`} element={element} />
    </>
  );
}

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
        <Route index element={<HomePage />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="mtd-dashboard" element={<HomePage />} />

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

        {stubRoutes('crm', <CrmPage />)}
        {stubRoutes('boutique', <BoutiquePage />)}
        {stubRoutes('projects', <ProjectsPage />)}
        {stubRoutes('sales', <SalesPage />)}
        {stubRoutes('purchases', <PurchasesPage />)}

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

        {stubRoutes('production', <ProductionPage />)}

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

        {stubRoutes('schedulers', <SchedulersPage />)}
        {stubRoutes('access', <AccessPage />)}
        {stubRoutes('settings', <SettingsPage />)}
        {stubRoutes('system', <SystemPage />)}

        <Route path="reports" element={<ReportsPage />} />
        <Route path="migration" element={<MigrationPage />} />
        <Route path="store" element={<StorePage />} />
        <Route path="store-time" element={<StorePage />} />
        <Route path="business-settings" element={<SettingsPage />} />
        <Route path="settings-locations" element={<SettingsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
