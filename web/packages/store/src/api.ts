import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

type SessionSliceState = { session: { accessToken: string | null } };

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as SessionSliceState).session.accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => rawBaseQuery(args, api, extra);

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    'Party',
    'Customer',
    'Vendor',
    'DeliveryPartner',
    'CommissionAgent',
    'Worker',
    'PartySegment',
    'SalesInvoice',
    'PurchaseOrder',
    'PurchaseBill',
    'BoutiqueOrder',
    'BoutiqueItem',
    'StoreActivity',
    'StoreTime',
    'CrmLead',
    'CrmEnquiry',
    'CrmActivity',
    'SchedulerJob',
    'Project',
    'ProjectEnquiry',
    'Recipe',
    'Batch',
    'MigrationBatch',
    'SystemSetting',
    'AccessUser',
    'AccessRole',
    'Flags',
    'License',
    'Home',
    'Reports',
    'Settings',
    'Inventory',
    'Finance',
  ],
  endpoints: (build) => ({
    // Auth / license / flags
    login: build.mutation<
      { access_token: string; token_type: string; user: { username: string; display_name?: string } },
      { username: string; password: string }
    >({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    me: build.query<{ user: Record<string, unknown> }, void>({
      query: () => '/auth/me',
    }),
    verifyLicense: build.mutation<
      { status: string; cooling_ends_at?: string; expiry?: string },
      void
    >({
      query: () => ({ url: '/license/verify', method: 'POST' }),
      invalidatesTags: ['License'],
    }),
    licenseStatus: build.query<{ status: string }, void>({
      query: () => '/license/status',
      providesTags: ['License'],
    }),
    renewLicense: build.mutation<{ status: string }, { license_key: string }>({
      query: (body) => ({ url: '/license/renew', method: 'POST', body }),
      invalidatesTags: ['License'],
    }),
    getFlags: build.query<{ modules: string[] }, void>({
      query: () => '/flags/modules',
      providesTags: ['Flags'],
    }),

    // Home / reports / settings
    homeDashboard: build.query<Record<string, unknown>, void>({
      query: () => '/home/dashboard',
      providesTags: ['Home'],
    }),
    reportsCatalog: build.query<{ reports: { id: string; title: string }[] }, void>({
      query: () => '/reports/catalog',
      providesTags: ['Reports'],
    }),
    getPrefs: build.query<{ timezone: string; locale: string }, void>({
      query: () => '/settings/prefs',
      providesTags: ['Settings'],
    }),
    putPrefs: build.mutation<{ timezone: string; locale: string }, Partial<{ timezone: string; locale: string }>>({
      query: (body) => ({ url: '/settings/prefs', method: 'PUT', body }),
      invalidatesTags: ['Settings'],
    }),

    // Parties — typed resources
    listCustomers: build.query<Record<string, unknown>[], { q?: string } | void>({
      query: (args) => ({
        url: '/parties/customers',
        params: args && 'q' in args && args.q ? { q: args.q } : undefined,
      }),
      providesTags: ['Customer'],
    }),
    createCustomer: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/parties/customers', method: 'POST', body }),
      invalidatesTags: ['Customer', 'Party'],
    }),
    getCustomer: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/customers/${id}`,
      providesTags: ['Customer'],
    }),
    updateCustomer: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/parties/customers/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Customer'],
    }),
    blacklistCustomer: build.mutation<
      Record<string, unknown>,
      { id: string; blacklisted: boolean; reason?: string }
    >({
      query: ({ id, blacklisted, reason }) => ({
        url: `/parties/customers/${id}/blacklist`,
        method: 'POST',
        body: { blacklisted, reason: reason || '' },
      }),
      invalidatesTags: ['Customer'],
    }),
    getCustomerSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/customers/${id}/summary`,
    }),
    settleCustomer: build.mutation<
      Record<string, unknown>,
      { id: string; amount: number; mode?: string; reason?: string }
    >({
      query: ({ id, amount, mode, reason }) => ({
        url: `/parties/customers/${id}/settle`,
        method: 'POST',
        body: { amount, mode: mode || 'park', reason: reason || '' },
      }),
      invalidatesTags: ['Customer'],
    }),

    listVendors: build.query<Record<string, unknown>[], { q?: string } | void>({
      query: (args) => ({
        url: '/parties/vendors',
        params: args && 'q' in args && args.q ? { q: args.q } : undefined,
      }),
      providesTags: ['Vendor'],
    }),
    createVendor: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/parties/vendors', method: 'POST', body }),
      invalidatesTags: ['Vendor', 'Party'],
    }),
    getVendor: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/vendors/${id}`,
      providesTags: ['Vendor'],
    }),
    updateVendor: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/parties/vendors/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Vendor'],
    }),
    getVendorSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/vendors/${id}/summary`,
    }),

    listDeliveryPartners: build.query<Record<string, unknown>[], { q?: string } | void>({
      query: (args) => ({
        url: '/parties/delivery-partners',
        params: args && 'q' in args && args.q ? { q: args.q } : undefined,
      }),
      providesTags: ['DeliveryPartner'],
    }),
    createDeliveryPartner: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/parties/delivery-partners', method: 'POST', body }),
      invalidatesTags: ['DeliveryPartner'],
    }),
    getDeliveryPartner: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/delivery-partners/${id}`,
      providesTags: ['DeliveryPartner'],
    }),
    updateDeliveryPartner: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/parties/delivery-partners/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['DeliveryPartner'],
    }),
    getDeliveryPartnerSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/delivery-partners/${id}/summary`,
    }),

    listCommissionAgents: build.query<Record<string, unknown>[], { q?: string } | void>({
      query: (args) => ({
        url: '/parties/commission-agents',
        params: args && 'q' in args && args.q ? { q: args.q } : undefined,
      }),
      providesTags: ['CommissionAgent'],
    }),
    createCommissionAgent: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/parties/commission-agents', method: 'POST', body }),
      invalidatesTags: ['CommissionAgent'],
    }),
    getCommissionAgent: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/commission-agents/${id}`,
      providesTags: ['CommissionAgent'],
    }),
    updateCommissionAgent: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/parties/commission-agents/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['CommissionAgent'],
    }),
    getCommissionAgentSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/commission-agents/${id}/summary`,
    }),

    listWorkers: build.query<Record<string, unknown>[], { active_only?: boolean } | void>({
      query: (args) => ({
        url: '/parties/workers',
        params:
          args && 'active_only' in args
            ? { active_only: args.active_only ?? true }
            : undefined,
      }),
      providesTags: ['Worker'],
    }),
    createWorker: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/parties/workers', method: 'POST', body }),
      invalidatesTags: ['Worker'],
    }),
    getWorker: build.query<Record<string, unknown>, string>({
      query: (id) => `/parties/workers/${id}`,
      providesTags: ['Worker'],
    }),
    updateWorker: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/parties/workers/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Worker'],
    }),
    deactivateWorker: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/parties/workers/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: ['Worker'],
    }),

    listPartySegments: build.query<
      Record<string, unknown>[],
      { active_only?: boolean; applies_to?: string } | void
    >({
      query: (args) => ({
        url: '/parties/segments',
        params: args || undefined,
      }),
      providesTags: ['PartySegment'],
    }),
    createPartySegment: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/parties/segments', method: 'POST', body }),
      invalidatesTags: ['PartySegment'],
    }),
    updatePartySegment: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/parties/segments/${id}`, method: 'PUT', body }),
      invalidatesTags: ['PartySegment'],
    }),
    deletePartySegment: build.mutation<void, string>({
      query: (id) => ({ url: `/parties/segments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PartySegment'],
    }),

    // Legacy shim (other stubs)
    listParties: build.query<Record<string, unknown>[], void>({
      query: () => '/parties',
      providesTags: ['Party'],
    }),
    createParty: build.mutation<Record<string, unknown>, { name: string; kind?: string }>({
      query: (body) => ({ url: '/parties', method: 'POST', body }),
      invalidatesTags: ['Party', 'Customer', 'Vendor'],
    }),

    // Sales
    listSalesInvoices: build.query<Record<string, unknown>[], void>({
      query: () => '/sales/invoices',
      providesTags: ['SalesInvoice'],
    }),
    createSalesInvoice: build.mutation<
      Record<string, unknown>,
      { customer_id: string; total: number }
    >({
      query: (body) => ({ url: '/sales/invoices', method: 'POST', body }),
      invalidatesTags: ['SalesInvoice'],
    }),

    // Purchases
    listPurchaseOrders: build.query<Record<string, unknown>[], void>({
      query: () => '/purchases/orders',
      providesTags: ['PurchaseOrder'],
    }),
    createPurchaseOrder: build.mutation<
      Record<string, unknown>,
      { vendor_id: string; total: number }
    >({
      query: (body) => ({ url: '/purchases/orders', method: 'POST', body }),
      invalidatesTags: ['PurchaseOrder'],
    }),
    listPurchaseBills: build.query<Record<string, unknown>[], void>({
      query: () => '/purchases/bills',
      providesTags: ['PurchaseBill'],
    }),
    createPurchaseBill: build.mutation<
      Record<string, unknown>,
      { vendor_id: string; total: number }
    >({
      query: (body) => ({ url: '/purchases/bills', method: 'POST', body }),
      invalidatesTags: ['PurchaseBill'],
    }),

    // Inventory
    inventoryHealth: build.query<Record<string, unknown>, void>({
      query: () => '/inventory/health',
      providesTags: ['Inventory'],
    }),
    createStockReserve: build.mutation<Record<string, unknown>, { key: string; qty?: number }>({
      query: (body) => ({ url: '/inventory/reserves', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    inventoryOverview: build.query<Record<string, unknown>, void>({
      query: () => '/inventory/overview',
      providesTags: ['Inventory'],
    }),
    listInventoryCategories: build.query<
      Record<string, unknown>[],
      { q?: string; active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/inventory/categories', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    createInventoryCategory: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/inventory/categories', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    updateInventoryCategory: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/inventory/categories/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Inventory'],
    }),
    listInventoryProducts: build.query<
      Record<string, unknown>[],
      { q?: string; active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/inventory/products', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    createInventoryProduct: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/inventory/products', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    getInventoryProduct: build.query<Record<string, unknown>, string>({
      query: (id) => `/inventory/products/${id}`,
      providesTags: ['Inventory'],
    }),
    updateInventoryProduct: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/inventory/products/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Inventory'],
    }),
    listInventoryStock: build.query<Record<string, unknown>[], { active_only?: boolean } | void>({
      query: (args) => ({ url: '/inventory/stock', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    listStockLedger: build.query<Record<string, unknown>[], void>({
      query: () => '/inventory/stock-ledger',
      providesTags: ['Inventory'],
    }),
    listInventoryMovements: build.query<Record<string, unknown>[], void>({
      query: () => '/inventory/movements',
      providesTags: ['Inventory'],
    }),
    createInventoryMovement: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/inventory/movements', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    listInventoryTransfers: build.query<Record<string, unknown>[], void>({
      query: () => '/inventory/transfers',
      providesTags: ['Inventory'],
    }),
    createInventoryTransfer: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/inventory/transfers', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    getInventoryTransfer: build.query<Record<string, unknown>, string>({
      query: (id) => `/inventory/transfers/${id}`,
      providesTags: ['Inventory'],
    }),
    dispatchInventoryTransfer: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/inventory/transfers/${id}/dispatch`, method: 'POST' }),
      invalidatesTags: ['Inventory'],
    }),
    receiveInventoryTransfer: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/inventory/transfers/${id}/receive`, method: 'POST' }),
      invalidatesTags: ['Inventory'],
    }),
    cancelInventoryTransfer: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/inventory/transfers/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['Inventory'],
    }),
    listInventoryLocations: build.query<
      Record<string, unknown>[],
      { q?: string; active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/inventory/locations', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    createInventoryLocation: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/inventory/locations', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    listInventoryUnits: build.query<Record<string, unknown>[], { active_only?: boolean } | void>({
      query: (args) => ({ url: '/inventory/units', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    listCustomerPrices: build.query<Record<string, unknown>[], void>({
      query: () => '/inventory/customer-prices',
      providesTags: ['Inventory'],
    }),
    createCustomerPrice: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/inventory/customer-prices', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    listCustomerPriceHistory: build.query<
      Record<string, unknown>[],
      { customer_id: string; product_id: string }
    >({
      query: (params) => ({ url: '/inventory/customer-prices/history', params }),
      providesTags: ['Inventory'],
    }),
    inventoryReportsCatalog: build.query<{ report_types: string[] }, void>({
      query: () => '/inventory/reports',
      providesTags: ['Inventory'],
    }),
    runInventoryReport: build.mutation<
      Record<string, unknown>,
      { report_type: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/inventory/reports/run', method: 'POST', body }),
    }),

    financeHealth: build.query<Record<string, unknown>, void>({
      query: () => '/finance/health',
      providesTags: ['Finance'],
    }),
    createFinancePosting: build.mutation<
      Record<string, unknown>,
      { key: string; amount?: number }
    >({
      query: (body) => ({ url: '/finance/postings', method: 'POST', body }),
      invalidatesTags: ['Finance'],
    }),
    financeOverview: build.query<Record<string, unknown>, void>({
      query: () => '/finance/overview',
      providesTags: ['Finance'],
    }),
    listFinanceAccounts: build.query<
      Record<string, unknown>[],
      { active_only?: boolean; q?: string } | void
    >({
      query: (args) => ({ url: '/finance/accounts', params: args || undefined }),
      providesTags: ['Finance'],
    }),
    createFinanceAccount: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/finance/accounts', method: 'POST', body }),
      invalidatesTags: ['Finance'],
    }),
    getFinanceAccount: build.query<Record<string, unknown>, string>({
      query: (id) => `/finance/accounts/${id}`,
      providesTags: ['Finance'],
    }),
    updateFinanceAccount: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/finance/accounts/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Finance'],
    }),
    listFinanceAccountLedger: build.query<Record<string, unknown>[], string>({
      query: (id) => `/finance/accounts/${id}/ledger`,
      providesTags: ['Finance'],
    }),
    listFinanceVouchers: build.query<
      Record<string, unknown>[],
      { voucher_type?: string; q?: string } | void
    >({
      query: (args) => ({ url: '/finance/vouchers', params: args || undefined }),
      providesTags: ['Finance'],
    }),
    getFinanceVoucher: build.query<Record<string, unknown>, string>({
      query: (id) => `/finance/vouchers/${id}`,
      providesTags: ['Finance'],
    }),
    listFinanceReceipts: build.query<Record<string, unknown>[], void>({
      query: () => '/finance/receipts',
      providesTags: ['Finance'],
    }),
    createFinanceReceipt: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/finance/receipts', method: 'POST', body }),
      invalidatesTags: ['Finance'],
    }),
    listFinancePayments: build.query<Record<string, unknown>[], void>({
      query: () => '/finance/payments',
      providesTags: ['Finance'],
    }),
    createFinancePayment: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/finance/payments', method: 'POST', body }),
      invalidatesTags: ['Finance'],
    }),
    listFinanceCreditNotes: build.query<Record<string, unknown>[], void>({
      query: () => '/finance/credit-notes',
      providesTags: ['Finance'],
    }),
    createFinanceCreditNote: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/finance/credit-notes', method: 'POST', body }),
      invalidatesTags: ['Finance'],
    }),
    listFinanceDebitNotes: build.query<Record<string, unknown>[], void>({
      query: () => '/finance/debit-notes',
      providesTags: ['Finance'],
    }),
    createFinanceDebitNote: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/finance/debit-notes', method: 'POST', body }),
      invalidatesTags: ['Finance'],
    }),
    listAccountingInvoices: build.query<Record<string, unknown>[], void>({
      query: () => '/finance/accounting-invoices',
      providesTags: ['Finance'],
    }),
    listFinanceJournal: build.query<Record<string, unknown>[], void>({
      query: () => '/finance/journal',
      providesTags: ['Finance'],
    }),
    createFinanceJournal: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/finance/journal', method: 'POST', body }),
      invalidatesTags: ['Finance'],
    }),
    financeTrialBalance: build.query<Record<string, unknown>, void>({
      query: () => '/finance/trial-balance',
      providesTags: ['Finance'],
    }),
    financeReportsCatalog: build.query<{ report_types: string[] }, void>({
      query: () => '/finance/reports',
      providesTags: ['Finance'],
    }),
    runFinanceReport: build.mutation<
      Record<string, unknown>,
      { report_type: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/finance/reports/run', method: 'POST', body }),
    }),

    // Boutique
    listBoutiqueOrders: build.query<Record<string, unknown>[], void>({
      query: () => '/boutique/orders',
      providesTags: ['BoutiqueOrder'],
    }),
    createBoutiqueOrder: build.mutation<
      Record<string, unknown>,
      { customer_id: string; notes?: string }
    >({
      query: (body) => ({ url: '/boutique/orders', method: 'POST', body }),
      invalidatesTags: ['BoutiqueOrder'],
    }),
    listBoutiqueItems: build.query<Record<string, unknown>[], void>({
      query: () => '/boutique/items',
      providesTags: ['BoutiqueItem'],
    }),
    createBoutiqueItem: build.mutation<
      Record<string, unknown>,
      { order_id: string; name: string; quantity?: number }
    >({
      query: (body) => ({ url: '/boutique/items', method: 'POST', body }),
      invalidatesTags: ['BoutiqueItem'],
    }),

    // Store
    listStoreActivities: build.query<Record<string, unknown>[], void>({
      query: () => '/store/activities',
      providesTags: ['StoreActivity'],
    }),
    createStoreActivity: build.mutation<Record<string, unknown>, { name: string }>({
      query: (body) => ({ url: '/store/activities', method: 'POST', body }),
      invalidatesTags: ['StoreActivity'],
    }),
    listStoreTimeEntries: build.query<Record<string, unknown>[], void>({
      query: () => '/store/time-entries',
      providesTags: ['StoreTime'],
    }),
    createStoreTimeEntry: build.mutation<
      Record<string, unknown>,
      { worker_id: string; activity_id: string; hours: number }
    >({
      query: (body) => ({ url: '/store/time-entries', method: 'POST', body }),
      invalidatesTags: ['StoreTime'],
    }),

    // CRM
    listCrmLeads: build.query<Record<string, unknown>[], void>({
      query: () => '/crm/leads',
      providesTags: ['CrmLead'],
    }),
    createCrmLead: build.mutation<Record<string, unknown>, { name: string; source?: string }>({
      query: (body) => ({ url: '/crm/leads', method: 'POST', body }),
      invalidatesTags: ['CrmLead'],
    }),
    listCrmEnquiries: build.query<Record<string, unknown>[], void>({
      query: () => '/crm/enquiries',
      providesTags: ['CrmEnquiry'],
    }),
    createCrmEnquiry: build.mutation<
      Record<string, unknown>,
      { subject: string; lead_id?: string }
    >({
      query: (body) => ({ url: '/crm/enquiries', method: 'POST', body }),
      invalidatesTags: ['CrmEnquiry'],
    }),
    listCrmActivities: build.query<Record<string, unknown>[], void>({
      query: () => '/crm/activities',
      providesTags: ['CrmActivity'],
    }),
    createCrmActivity: build.mutation<
      Record<string, unknown>,
      { kind?: string; notes?: string; lead_id?: string }
    >({
      query: (body) => ({ url: '/crm/activities', method: 'POST', body }),
      invalidatesTags: ['CrmActivity'],
    }),

    // Schedulers
    listSchedulerJobs: build.query<Record<string, unknown>[], void>({
      query: () => '/schedulers/jobs',
      providesTags: ['SchedulerJob'],
    }),
    createSchedulerJob: build.mutation<
      Record<string, unknown>,
      { name: string; module: string; cron?: string }
    >({
      query: (body) => ({ url: '/schedulers/jobs', method: 'POST', body }),
      invalidatesTags: ['SchedulerJob'],
    }),
    runSchedulerJob: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/schedulers/jobs/${id}/run`, method: 'POST' }),
      invalidatesTags: ['SchedulerJob'],
    }),

    // Projects
    listProjects: build.query<Record<string, unknown>[], void>({
      query: () => '/projects',
      providesTags: ['Project'],
    }),
    createProject: build.mutation<
      Record<string, unknown>,
      { name: string; customer_id: string }
    >({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: ['Project'],
    }),
    listProjectEnquiries: build.query<Record<string, unknown>[], void>({
      query: () => '/projects/enquiries',
      providesTags: ['ProjectEnquiry'],
    }),
    createProjectEnquiry: build.mutation<
      Record<string, unknown>,
      { subject: string; project_id?: string }
    >({
      query: (body) => ({ url: '/projects/enquiries', method: 'POST', body }),
      invalidatesTags: ['ProjectEnquiry'],
    }),

    // Production
    listRecipes: build.query<Record<string, unknown>[], void>({
      query: () => '/production/recipes',
      providesTags: ['Recipe'],
    }),
    createRecipe: build.mutation<
      Record<string, unknown>,
      { name: string; output_product_id: string }
    >({
      query: (body) => ({ url: '/production/recipes', method: 'POST', body }),
      invalidatesTags: ['Recipe'],
    }),
    listBatches: build.query<Record<string, unknown>[], void>({
      query: () => '/production/batches',
      providesTags: ['Batch'],
    }),
    createBatch: build.mutation<
      Record<string, unknown>,
      { recipe_id: string; planned_qty: number }
    >({
      query: (body) => ({ url: '/production/batches', method: 'POST', body }),
      invalidatesTags: ['Batch'],
    }),
    completeBatch: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/production/batches/${id}/complete`, method: 'POST' }),
      invalidatesTags: ['Batch'],
    }),

    // Migration
    listMigrationBatches: build.query<Record<string, unknown>[], void>({
      query: () => '/migration/batches',
      providesTags: ['MigrationBatch'],
    }),
    createMigrationBatch: build.mutation<
      Record<string, unknown>,
      { source: string; entity: string }
    >({
      query: (body) => ({ url: '/migration/batches', method: 'POST', body }),
      invalidatesTags: ['MigrationBatch'],
    }),
    runMigrationBatch: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/migration/batches/${id}/run`, method: 'POST' }),
      invalidatesTags: ['MigrationBatch'],
    }),

    // System / Access
    systemDiagnostics: build.query<Record<string, unknown>, void>({
      query: () => '/system/diagnostics',
    }),
    upsertSystemSetting: build.mutation<
      Record<string, unknown>,
      { key: string; value: string }
    >({
      query: ({ key, value }) => ({
        url: `/system/settings/${key}`,
        method: 'PUT',
        body: { key, value },
      }),
      invalidatesTags: ['SystemSetting'],
    }),
    listAccessUsers: build.query<Record<string, unknown>[], void>({
      query: () => '/access/users',
      providesTags: ['AccessUser'],
    }),
    createAccessUser: build.mutation<
      Record<string, unknown>,
      { username: string; display_name?: string; role_ids?: string[] }
    >({
      query: (body) => ({ url: '/access/users', method: 'POST', body }),
      invalidatesTags: ['AccessUser'],
    }),
    listAccessRoles: build.query<Record<string, unknown>[], void>({
      query: () => '/access/roles',
      providesTags: ['AccessRole'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useVerifyLicenseMutation,
  useLicenseStatusQuery,
  useRenewLicenseMutation,
  useGetFlagsQuery,
  useHomeDashboardQuery,
  useReportsCatalogQuery,
  useGetPrefsQuery,
  usePutPrefsMutation,
  useListCustomersQuery,
  useCreateCustomerMutation,
  useGetCustomerQuery,
  useUpdateCustomerMutation,
  useBlacklistCustomerMutation,
  useGetCustomerSummaryQuery,
  useSettleCustomerMutation,
  useListVendorsQuery,
  useCreateVendorMutation,
  useGetVendorQuery,
  useUpdateVendorMutation,
  useGetVendorSummaryQuery,
  useListDeliveryPartnersQuery,
  useCreateDeliveryPartnerMutation,
  useGetDeliveryPartnerQuery,
  useUpdateDeliveryPartnerMutation,
  useGetDeliveryPartnerSummaryQuery,
  useListCommissionAgentsQuery,
  useCreateCommissionAgentMutation,
  useGetCommissionAgentQuery,
  useUpdateCommissionAgentMutation,
  useGetCommissionAgentSummaryQuery,
  useListWorkersQuery,
  useCreateWorkerMutation,
  useGetWorkerQuery,
  useUpdateWorkerMutation,
  useDeactivateWorkerMutation,
  useListPartySegmentsQuery,
  useCreatePartySegmentMutation,
  useUpdatePartySegmentMutation,
  useDeletePartySegmentMutation,
  useListPartiesQuery,
  useCreatePartyMutation,
  useListSalesInvoicesQuery,
  useCreateSalesInvoiceMutation,
  useListPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
  useListPurchaseBillsQuery,
  useCreatePurchaseBillMutation,
  useInventoryHealthQuery,
  useCreateStockReserveMutation,
  useInventoryOverviewQuery,
  useListInventoryCategoriesQuery,
  useCreateInventoryCategoryMutation,
  useUpdateInventoryCategoryMutation,
  useListInventoryProductsQuery,
  useCreateInventoryProductMutation,
  useGetInventoryProductQuery,
  useUpdateInventoryProductMutation,
  useListInventoryStockQuery,
  useListStockLedgerQuery,
  useListInventoryMovementsQuery,
  useCreateInventoryMovementMutation,
  useListInventoryTransfersQuery,
  useCreateInventoryTransferMutation,
  useGetInventoryTransferQuery,
  useDispatchInventoryTransferMutation,
  useReceiveInventoryTransferMutation,
  useCancelInventoryTransferMutation,
  useListInventoryLocationsQuery,
  useCreateInventoryLocationMutation,
  useListInventoryUnitsQuery,
  useListCustomerPricesQuery,
  useCreateCustomerPriceMutation,
  useListCustomerPriceHistoryQuery,
  useInventoryReportsCatalogQuery,
  useRunInventoryReportMutation,
  useFinanceHealthQuery,
  useCreateFinancePostingMutation,
  useFinanceOverviewQuery,
  useListFinanceAccountsQuery,
  useCreateFinanceAccountMutation,
  useGetFinanceAccountQuery,
  useUpdateFinanceAccountMutation,
  useListFinanceAccountLedgerQuery,
  useListFinanceVouchersQuery,
  useGetFinanceVoucherQuery,
  useListFinanceReceiptsQuery,
  useCreateFinanceReceiptMutation,
  useListFinancePaymentsQuery,
  useCreateFinancePaymentMutation,
  useListFinanceCreditNotesQuery,
  useCreateFinanceCreditNoteMutation,
  useListFinanceDebitNotesQuery,
  useCreateFinanceDebitNoteMutation,
  useListAccountingInvoicesQuery,
  useListFinanceJournalQuery,
  useCreateFinanceJournalMutation,
  useFinanceTrialBalanceQuery,
  useFinanceReportsCatalogQuery,
  useRunFinanceReportMutation,
  useListBoutiqueOrdersQuery,
  useCreateBoutiqueOrderMutation,
  useListBoutiqueItemsQuery,
  useCreateBoutiqueItemMutation,
  useListStoreActivitiesQuery,
  useCreateStoreActivityMutation,
  useListStoreTimeEntriesQuery,
  useCreateStoreTimeEntryMutation,
  useListCrmLeadsQuery,
  useCreateCrmLeadMutation,
  useListCrmEnquiriesQuery,
  useCreateCrmEnquiryMutation,
  useListCrmActivitiesQuery,
  useCreateCrmActivityMutation,
  useListSchedulerJobsQuery,
  useCreateSchedulerJobMutation,
  useRunSchedulerJobMutation,
  useListProjectsQuery,
  useCreateProjectMutation,
  useListProjectEnquiriesQuery,
  useCreateProjectEnquiryMutation,
  useListRecipesQuery,
  useCreateRecipeMutation,
  useListBatchesQuery,
  useCreateBatchMutation,
  useCompleteBatchMutation,
  useListMigrationBatchesQuery,
  useCreateMigrationBatchMutation,
  useRunMigrationBatchMutation,
  useSystemDiagnosticsQuery,
  useUpsertSystemSettingMutation,
  useListAccessUsersQuery,
  useCreateAccessUserMutation,
  useListAccessRolesQuery,
} = baseApi;
