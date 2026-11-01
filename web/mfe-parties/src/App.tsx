import { Navigate, Route, Routes } from 'react-router-dom';
import {
  CommissionAgentsListPage,
  CustomersListPage,
  CustomerDetailPage,
  DeliveryPartnersListPage,
  DeliveryPartnerDetailPage,
  SegmentsListPage,
  VendorsListPage,
  VendorDetailPage,
  WorkersListPage,
  CommissionAgentDetailPage,
} from './index';

/** Standalone MFE entry — nested under / when hosted alone. */
export default function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="customers" replace />} />
      <Route path="customers" element={<CustomersListPage />} />
      <Route path="customers/:id" element={<CustomerDetailPage />} />
      <Route path="vendors" element={<VendorsListPage />} />
      <Route path="vendors/:id" element={<VendorDetailPage />} />
      <Route path="delivery-partners" element={<DeliveryPartnersListPage />} />
      <Route path="delivery-partners/:id" element={<DeliveryPartnerDetailPage />} />
      <Route path="commission-agents" element={<CommissionAgentsListPage />} />
      <Route path="commission-agents/:id" element={<CommissionAgentDetailPage />} />
      <Route path="workers" element={<WorkersListPage />} />
      <Route path="segments" element={<SegmentsListPage />} />
    </Routes>
  );
}
