import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

type SessionSliceState = { session: { accessToken: string | null } };

/** Standard backend-paginated list envelope. */
export type PagedResult<T = Record<string, unknown>> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

/** Normalize legacy bare-array list responses into the paged envelope. */
function asPagedResult<T = Record<string, unknown>>(response: unknown): PagedResult<T> {
  if (Array.isArray(response)) {
    return {
      items: response as T[],
      total: response.length,
      page: 1,
      page_size: response.length,
    };
  }
  const body = (response || {}) as Partial<PagedResult<T>>;
  const items = Array.isArray(body.items) ? body.items : [];
  return {
    items,
    total: Number(body.total ?? items.length),
    page: Number(body.page ?? 1),
    page_size: Number(body.page_size ?? items.length),
  };
}

/** Common query args for sales/purchase document list endpoints. */
export type DocListParams = {
  q?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_desc?: boolean;
  page?: number;
  page_size?: number;
  status?: string;
  [key: string]: string | number | boolean | undefined;
};

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
) => {
  const result = await rawBaseQuery(args, api, extra);
  if (result.error && result.error.status === 401) {
    const url = typeof args === 'string' ? args : args.url;
    if (!String(url).includes('/auth/login')) {
      const { clearSession } = await import('./sessionSlice');
      api.dispatch(clearSession());
      api.dispatch(baseApi.util.resetApiState());
    }
  }
  return result;
};

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
    'SalesOrder',
    'SalesEstimate',
    'SalesQuotation',
    'SalesDeliveryNote',
    'SalesReturn',
    'Sales',
    'PurchaseOrder',
    'PurchaseBill',
    'PurchaseGoodsReceipt',
    'PurchaseReturn',
    'Purchases',
    'BoutiqueOrder',
    'BoutiqueItem',
    'BoutiqueMeasurement',
    'BoutiqueTime',
    'Boutique',
    'StoreActivity',
    'StoreTime',
    'BusinessActivity',
    'BusinessTask',
    'BusinessTime',
    'CrmLead',
    'CrmEnquiry',
    'CrmActivity',
    'CrmListView',
    'SchedulerJob',
    'Project',
    'ProjectEnquiry',
    'Recipe',
    'Batch',
    'Production',
    'MigrationBatch',
    'SystemSetting',
    'AccessUser',
    'AccessRole',
    'AccessPlan',
    'AccessFlag',
    'AccessAudit',
    'AccessPermission',
    'Flags',
    'License',
    'Setup',
    'OrgEntitlement',
    'Home',
    'Reports',
    'Settings',
    'BusinessProfile',
    'PrintSettings',
    'KeyboardShortcuts',
    'SettingsActivity',
    'SettingsStoreActivity',
    'SettingsProjectActivity',
    'MeasurementSpec',
    'VendorService',
    'DiscountRule',
    'Inventory',
    'Finance',
    'SessionLocation',
    'Notifications',
  ],
  endpoints: (build) => ({
    // Auth / license / flags
    login: build.mutation<
      {
        access_token: string;
        token_type: string;
        user: {
          id?: string;
          username: string;
          display_name?: string;
          org_id?: string;
          working_location_id?: string;
          location_ids?: string[];
          role_ids?: string[];
          permissions?: string[];
          enabled_modules?: string[];
        };
      },
      { username: string; password: string; org_id?: string }
    >({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    getSetupStatus: build.query<{ setup_completed: boolean; org_id: string }, void>({
      query: () => '/setup/status',
      providesTags: ['Setup'],
    }),
    getOrgEntitlement: build.query<
      {
        id?: string;
        plan_id?: string;
        enabled_modules?: string[];
        version?: number;
        setup_completed?: boolean;
      },
      void
    >({
      query: () => '/access/org-entitlement',
      providesTags: ['OrgEntitlement'],
    }),
    setOrgModules: build.mutation<
      {
        id?: string;
        enabled_modules?: string[];
        version?: number;
      },
      { modules: string[] }
    >({
      query: (body) => ({ url: '/access/org-entitlement/modules', method: 'PUT', body }),
      invalidatesTags: ['OrgEntitlement', 'Flags', 'AccessPlan'],
    }),
    completeSetup: build.mutation<
      { setup_completed: boolean; org_id: string; idempotent?: boolean },
      {
        business: {
          legal_name?: string;
          trade_name?: string;
          gstin?: string;
          phone?: string;
          email?: string;
          state_code?: string;
          fy_start_month?: number;
        };
        enabled_modules: string[];
        license_key?: string;
        primary_location?: {
          code?: string;
          name?: string;
          location_type?: string;
          address?: string;
        };
      }
    >({
      query: (body) => ({ url: '/setup/complete', method: 'POST', body }),
      invalidatesTags: ['Setup', 'BusinessProfile', 'AccessPlan', 'Flags', 'OrgEntitlement', 'Inventory'],
    }),
    me: build.query<{ user: Record<string, unknown> }, void>({
      query: () => '/auth/me',
    }),
    getWorkingLocation: build.query<
      {
        working_location_id: string;
        allow_all: boolean;
        accessible: { id: string; code: string; name: string }[];
      },
      void
    >({
      query: () => '/auth/working-location',
      providesTags: ['SessionLocation'],
    }),
    setWorkingLocation: build.mutation<
      {
        working_location_id: string;
        allow_all: boolean;
        accessible: { id: string; code: string; name: string }[];
      },
      { working_location_id: string }
    >({
      query: (body) => ({ url: '/auth/working-location', method: 'PUT', body }),
      invalidatesTags: ['SessionLocation'],
    }),
    listNotifications: build.query<Record<string, unknown>[], { limit?: number } | void>({
      query: (args) => ({
        url: '/notifications',
        params: args && 'limit' in args ? { limit: args.limit } : undefined,
      }),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: build.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'POST' }),
      invalidatesTags: ['Notifications'],
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
    homeMtd: build.query<Record<string, unknown>, { period?: string } | void>({
      query: (args) => ({
        url: '/home/mtd',
        params: args?.period ? { period: args.period } : undefined,
      }),
      providesTags: ['Home'],
    }),
    reportsCatalog: build.query<
      { reports: { id: string; title: string; module?: string; href?: string }[] },
      void
    >({
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
    settingsHealth: build.query<Record<string, unknown>, void>({
      query: () => '/settings/health',
      providesTags: ['Settings'],
    }),
    getBusinessProfile: build.query<Record<string, unknown>, void>({
      query: () => '/settings/business',
      providesTags: ['BusinessProfile'],
    }),
    updateBusinessProfile: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/business', method: 'PATCH', body }),
      invalidatesTags: ['BusinessProfile'],
    }),
    getPrintSettings: build.query<Record<string, unknown>, void>({
      query: () => '/settings/print',
      providesTags: ['PrintSettings'],
    }),
    updatePrintSettings: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/print', method: 'PUT', body }),
      invalidatesTags: ['PrintSettings'],
    }),
    getKeyboardShortcuts: build.query<Record<string, unknown>, void>({
      query: () => '/settings/keyboard',
      providesTags: ['KeyboardShortcuts'],
    }),
    updateKeyboardShortcuts: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/keyboard', method: 'PUT', body }),
      invalidatesTags: ['KeyboardShortcuts'],
    }),
    listSettingsActivities: build.query<Record<string, unknown>[], void>({
      query: () => '/settings/activities',
      providesTags: ['SettingsActivity'],
    }),
    createSettingsActivity: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/activities', method: 'POST', body }),
      invalidatesTags: ['SettingsActivity'],
    }),
    listSettingsStoreActivities: build.query<Record<string, unknown>[], void>({
      query: () => '/settings/store-activities',
      providesTags: ['SettingsStoreActivity'],
    }),
    createSettingsStoreActivity: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/store-activities', method: 'POST', body }),
      invalidatesTags: ['SettingsStoreActivity'],
    }),
    listSettingsProjectActivities: build.query<Record<string, unknown>[], void>({
      query: () => '/settings/project-activities',
      providesTags: ['SettingsProjectActivity'],
    }),
    createSettingsProjectActivity: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/project-activities', method: 'POST', body }),
      invalidatesTags: ['SettingsProjectActivity'],
    }),
    listMeasurementSpecs: build.query<Record<string, unknown>[], void>({
      query: () => '/settings/measurement-specs',
      providesTags: ['MeasurementSpec'],
    }),
    createMeasurementSpec: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/measurement-specs', method: 'POST', body }),
      invalidatesTags: ['MeasurementSpec'],
    }),
    updateMeasurementSpec: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/settings/measurement-specs/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['MeasurementSpec'],
    }),
    deleteMeasurementSpec: build.mutation<void, string>({
      query: (id) => ({ url: `/settings/measurement-specs/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MeasurementSpec'],
    }),
    listVendorServices: build.query<Record<string, unknown>[], void>({
      query: () => '/settings/services',
      providesTags: ['VendorService'],
    }),
    createVendorService: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/services', method: 'POST', body }),
      invalidatesTags: ['VendorService'],
    }),
    updateVendorService: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/settings/services/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['VendorService'],
    }),
    listDiscountRules: build.query<
      Record<string, unknown>[],
      { customer_id?: string; active_only?: boolean } | void
    >({
      query: (args) => ({
        url: '/settings/discounts',
        params: args
          ? {
              ...(args.customer_id ? { customer_id: args.customer_id } : {}),
              ...(args.active_only != null ? { active_only: args.active_only } : {}),
            }
          : undefined,
      }),
      providesTags: ['DiscountRule'],
    }),
    createDiscountRule: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/settings/discounts', method: 'POST', body }),
      invalidatesTags: ['DiscountRule'],
    }),
    updateDiscountRule: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/settings/discounts/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['DiscountRule'],
    }),
    deleteDiscountRule: build.mutation<void, string>({
      query: (id) => ({ url: `/settings/discounts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['DiscountRule'],
    }),
    getProductionSettingsStub: build.query<Record<string, unknown>, void>({
      query: () => '/settings/production',
      providesTags: ['Settings'],
    }),

    // Parties — typed resources
    listCustomers: build.query<
      Record<string, unknown>[],
      { q?: string; location_id?: string; location_ids?: string } | void
    >({
      query: (args) => ({
        url: '/parties/customers',
        params: args
          ? {
              ...(args.q ? { q: args.q } : {}),
              ...(args.location_id ? { location_id: args.location_id } : {}),
              ...(args.location_ids ? { location_ids: args.location_ids } : {}),
            }
          : undefined,
      }),
      providesTags: ['Customer'],
    }),
    lookupCustomerByPhone: build.query<Record<string, unknown> | null, string>({
      query: (phone) => ({
        url: '/parties/customers/lookup',
        params: { phone },
      }),
      providesTags: ['Customer'],
    }),
    getCustomerIdentityPolicy: build.query<
      { require_name: boolean; require_phone: boolean },
      void
    >({
      query: () => '/parties/customers/identity-policy',
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
      { id: string; amount: number; mode?: string; reason?: string; voucher_date?: string }
    >({
      query: ({ id, amount, mode, reason, voucher_date }) => ({
        url: `/parties/customers/${id}/settle`,
        method: 'POST',
        body: {
          amount,
          mode: mode || 'park',
          reason: reason || '',
          ...(voucher_date ? { voucher_date } : {}),
        },
      }),
      invalidatesTags: ['Customer'],
    }),
    refundCustomer: build.mutation<
      Record<string, unknown>,
      {
        id: string;
        store_account_id: string;
        amount: number;
        description?: string;
        voucher_date?: string;
      }
    >({
      query: ({ id, store_account_id, amount, description, voucher_date }) => ({
        url: `/parties/customers/${id}/refund`,
        method: 'POST',
        body: {
          store_account_id,
          amount,
          description: description || 'Customer refund',
          ...(voucher_date ? { voucher_date } : {}),
        },
      }),
      invalidatesTags: ['Customer', 'Finance'],
    }),

    getSalesCustomerRelatedSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/sales/customers/${id}/related-summary`,
    }),
    getSalesCustomerProductHistory: build.query<Record<string, unknown>[], string>({
      query: (id) => `/sales/customers/${id}/product-history`,
    }),
    getBoutiqueCustomerRelatedSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/boutique/customers/${id}/related-summary`,
    }),
    getProjectsCustomerRelatedSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/customers/${id}/related-summary`,
    }),

    listVendors: build.query<
      Record<string, unknown>[],
      { q?: string; location_id?: string; location_ids?: string } | void
    >({
      query: (args) => ({
        url: '/parties/vendors',
        params: args
          ? {
              ...(args.q ? { q: args.q } : {}),
              ...(args.location_id ? { location_id: args.location_id } : {}),
              ...(args.location_ids ? { location_ids: args.location_ids } : {}),
            }
          : undefined,
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

    listDeliveryPartners: build.query<
      Record<string, unknown>[],
      { q?: string; location_id?: string; location_ids?: string } | void
    >({
      query: (args) => ({
        url: '/parties/delivery-partners',
        params: args
          ? {
              ...(args.q ? { q: args.q } : {}),
              ...(args.location_id ? { location_id: args.location_id } : {}),
              ...(args.location_ids ? { location_ids: args.location_ids } : {}),
            }
          : undefined,
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

    listCommissionAgents: build.query<
      Record<string, unknown>[],
      { q?: string; location_id?: string; location_ids?: string } | void
    >({
      query: (args) => ({
        url: '/parties/commission-agents',
        params: args
          ? {
              ...(args.q ? { q: args.q } : {}),
              ...(args.location_id ? { location_id: args.location_id } : {}),
              ...(args.location_ids ? { location_ids: args.location_ids } : {}),
            }
          : undefined,
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

    listWorkers: build.query<
      Record<string, unknown>[],
      { active_only?: boolean; location_id?: string; location_ids?: string } | void
    >({
      query: (args) => ({
        url: '/parties/workers',
        params: args
          ? {
              ...('active_only' in args ? { active_only: args.active_only ?? true } : {}),
              ...(args.location_id ? { location_id: args.location_id } : {}),
              ...(args.location_ids ? { location_ids: args.location_ids } : {}),
            }
          : undefined,
      }),
      providesTags: ['Worker'],
    }),
    listWorkerActivityOptions: build.query<
      Record<string, unknown>[],
      { active_only?: boolean } | void
    >({
      query: (args) => ({
        url: '/parties/worker-activity-options',
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
    salesHealth: build.query<Record<string, unknown>, void>({
      query: () => '/sales/health',
      providesTags: ['Sales'],
    }),
    salesOverview: build.query<Record<string, unknown>, void>({
      query: () => '/sales/overview',
      providesTags: ['Sales', 'SalesOrder', 'SalesInvoice', 'SalesDeliveryNote', 'SalesReturn'],
    }),
    listSalesEstimates: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/sales/estimates', params: args || undefined }),
      providesTags: ['SalesEstimate'],
    }),
    getSalesEstimate: build.query<Record<string, unknown>, string>({
      query: (id) => `/sales/estimates/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesEstimate', id }],
    }),
    createSalesEstimate: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/sales/estimates', method: 'POST', body }),
      invalidatesTags: ['SalesEstimate', 'Sales'],
    }),
    updateSalesEstimate: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/sales/estimates/${id}`, method: 'PUT', body }),
      invalidatesTags: ['SalesEstimate', 'Sales'],
    }),
    setSalesEstimateStatus: build.mutation<
      Record<string, unknown>,
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `/sales/estimates/${id}/status`,
        method: 'POST',
        body: { status },
      }),
      invalidatesTags: ['SalesEstimate', 'Sales'],
    }),
    convertEstimateToOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/estimates/${id}/convert-order`, method: 'POST', body: {} }),
      invalidatesTags: ['SalesEstimate', 'SalesOrder', 'Sales'],
    }),
    listSalesQuotations: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/sales/quotations', params: args || undefined }),
      providesTags: ['SalesQuotation'],
    }),
    getSalesQuotation: build.query<Record<string, unknown>, string>({
      query: (id) => `/sales/quotations/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesQuotation', id }],
    }),
    createSalesQuotation: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/sales/quotations', method: 'POST', body }),
      invalidatesTags: ['SalesQuotation', 'Sales'],
    }),
    updateSalesQuotation: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/sales/quotations/${id}`, method: 'PUT', body }),
      invalidatesTags: ['SalesQuotation', 'Sales'],
    }),
    setSalesQuotationStatus: build.mutation<
      Record<string, unknown>,
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `/sales/quotations/${id}/status`,
        method: 'POST',
        body: { status },
      }),
      invalidatesTags: ['SalesQuotation', 'Sales'],
    }),
    convertQuotationToOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/quotations/${id}/convert-order`, method: 'POST', body: {} }),
      invalidatesTags: ['SalesQuotation', 'SalesOrder', 'Sales'],
    }),
    listSalesOrders: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/sales/orders', params: args || undefined }),
      providesTags: ['SalesOrder'],
    }),
    getSalesOrder: build.query<Record<string, unknown>, string>({
      query: (id) => `/sales/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesOrder', id }],
    }),
    createSalesOrder: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/sales/orders', method: 'POST', body }),
      invalidatesTags: ['SalesOrder', 'Sales'],
    }),
    updateSalesOrder: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/sales/orders/${id}`, method: 'PUT', body }),
      invalidatesTags: ['SalesOrder', 'Sales'],
    }),
    cancelSalesOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/orders/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['SalesOrder', 'Sales'],
    }),
    closeSalesOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/orders/${id}/close`, method: 'POST' }),
      invalidatesTags: ['SalesOrder', 'Sales'],
    }),
    convertSalesOrderToInvoice: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/sales/orders/${id}/convert-invoice`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SalesOrder', 'SalesInvoice', 'Sales'],
    }),
    listDeliveryNotes: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/sales/delivery-notes', params: args || undefined }),
      providesTags: ['SalesDeliveryNote'],
    }),
    getDeliveryNote: build.query<Record<string, unknown>, string>({
      query: (id) => `/sales/delivery-notes/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesDeliveryNote', id }],
    }),
    createDeliveryNote: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/sales/delivery-notes', method: 'POST', body }),
      invalidatesTags: ['SalesDeliveryNote', 'SalesOrder', 'Sales', 'Inventory'],
    }),
    updateDeliveryNote: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/sales/delivery-notes/${id}`, method: 'PUT', body }),
      invalidatesTags: ['SalesDeliveryNote', 'Sales', 'Inventory'],
    }),
    confirmDeliveryNote: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/delivery-notes/${id}/confirm`, method: 'POST' }),
      invalidatesTags: ['SalesDeliveryNote', 'Sales'],
    }),
    dispatchDeliveryNote: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/delivery-notes/${id}/dispatch`, method: 'POST' }),
      invalidatesTags: ['SalesDeliveryNote', 'Sales', 'Inventory'],
    }),
    deliverDeliveryNote: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/delivery-notes/${id}/deliver`, method: 'POST' }),
      invalidatesTags: ['SalesDeliveryNote', 'SalesOrder', 'Sales'],
    }),
    cancelDeliveryNote: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/delivery-notes/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['SalesDeliveryNote', 'Sales'],
    }),
    listSalesInvoices: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/sales/invoices', params: args || undefined }),
      providesTags: ['SalesInvoice'],
    }),
    getSalesInvoice: build.query<Record<string, unknown>, string>({
      query: (id) => `/sales/invoices/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesInvoice', id }],
    }),
    getSalesInvoicePdf: build.query<Blob, string>({
      query: (id) => ({
        url: `/sales/invoices/${id}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    createSalesInvoice: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/sales/invoices', method: 'POST', body }),
      invalidatesTags: ['SalesInvoice', 'Sales', 'Finance', 'Inventory'],
    }),
    updateSalesInvoice: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/sales/invoices/${id}`, method: 'PUT', body }),
      invalidatesTags: ['SalesInvoice', 'Sales', 'Finance', 'Inventory'],
    }),
    listSalesReturns: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/sales/returns', params: args || undefined }),
      providesTags: ['SalesReturn'],
    }),
    getSalesReturn: build.query<Record<string, unknown>, string>({
      query: (id) => `/sales/returns/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SalesReturn', id }],
    }),
    createSalesReturn: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/sales/returns', method: 'POST', body }),
      invalidatesTags: ['SalesReturn', 'Sales'],
    }),
    updateSalesReturn: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/sales/returns/${id}`, method: 'PUT', body }),
      invalidatesTags: ['SalesReturn', 'Sales'],
    }),
    approveSalesReturn: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/returns/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['SalesReturn', 'Sales'],
    }),
    rejectSalesReturn: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/sales/returns/${id}/reject`, method: 'POST' }),
      invalidatesTags: ['SalesReturn', 'Sales'],
    }),
    salesReportsCatalog: build.query<{ report_types: string[] }, void>({
      query: () => '/sales/reports',
      providesTags: ['Sales'],
    }),
    runSalesReport: build.mutation<
      { report_type: string; rows: Record<string, unknown>[] },
      { report_type: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/sales/reports/run', method: 'POST', body }),
    }),

    // Purchases
    purchasesHealth: build.query<Record<string, unknown>, void>({
      query: () => '/purchases/health',
      providesTags: ['Purchases'],
    }),
    purchasesOverview: build.query<Record<string, unknown>, void>({
      query: () => '/purchases/overview',
      providesTags: ['Purchases', 'PurchaseOrder', 'PurchaseBill', 'PurchaseGoodsReceipt', 'PurchaseReturn'],
    }),
    listPurchaseOrders: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/purchases/orders', params: args || undefined }),
      providesTags: ['PurchaseOrder'],
    }),
    getPurchaseOrder: build.query<Record<string, unknown>, string>({
      query: (id) => `/purchases/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'PurchaseOrder', id }],
    }),
    getPurchaseOrderPdf: build.query<Blob, string>({
      query: (id) => ({
        url: `/purchases/orders/${id}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    createPurchaseOrder: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/purchases/orders', method: 'POST', body }),
      invalidatesTags: ['PurchaseOrder', 'Purchases'],
    }),
    updatePurchaseOrder: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/purchases/orders/${id}`, method: 'PUT', body }),
      invalidatesTags: ['PurchaseOrder', 'Purchases'],
    }),
    sendPurchaseOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/purchases/orders/${id}/send`, method: 'POST' }),
      invalidatesTags: ['PurchaseOrder', 'Purchases'],
    }),
    cancelPurchaseOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/purchases/orders/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['PurchaseOrder', 'Purchases'],
    }),
    closePurchaseOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/purchases/orders/${id}/close`, method: 'POST' }),
      invalidatesTags: ['PurchaseOrder', 'Purchases'],
    }),
    listGoodsReceipts: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/purchases/goods-receipts', params: args || undefined }),
      providesTags: ['PurchaseGoodsReceipt'],
    }),
    getGoodsReceipt: build.query<Record<string, unknown>, string>({
      query: (id) => `/purchases/goods-receipts/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'PurchaseGoodsReceipt', id }],
    }),
    createGoodsReceipt: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/purchases/goods-receipts', method: 'POST', body }),
      invalidatesTags: ['PurchaseGoodsReceipt', 'PurchaseOrder', 'Purchases', 'Inventory'],
    }),
    confirmGoodsReceipt: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/purchases/goods-receipts/${id}/confirm`, method: 'POST' }),
      invalidatesTags: ['PurchaseGoodsReceipt', 'PurchaseOrder', 'Purchases', 'Inventory'],
    }),
    listPurchaseBills: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/purchases/bills', params: args || undefined }),
      providesTags: ['PurchaseBill'],
    }),
    getPurchaseBill: build.query<Record<string, unknown>, string>({
      query: (id) => `/purchases/bills/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'PurchaseBill', id }],
    }),
    createPurchaseBill: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/purchases/bills', method: 'POST', body }),
      invalidatesTags: ['PurchaseBill', 'Purchases', 'Finance'],
    }),
    updatePurchaseBill: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/purchases/bills/${id}`, method: 'PUT', body }),
      invalidatesTags: ['PurchaseBill', 'Purchases', 'Finance', 'Inventory'],
    }),
    deletePurchaseBill: build.mutation<void, string>({
      query: (id) => ({ url: `/purchases/bills/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PurchaseBill', 'Purchases', 'Finance'],
    }),
    getVendorPurchaseRate: build.query<
      { rate: number },
      { vendor_id: string; product_id: string; item_type?: string }
    >({
      query: (params) => ({ url: '/purchases/vendor-rates', params }),
    }),
    listPurchaseReturns: build.query<PagedResult, DocListParams | void>({
      query: (args) => ({ url: '/purchases/returns', params: args || undefined }),
      providesTags: ['PurchaseReturn'],
    }),
    getPurchaseReturn: build.query<Record<string, unknown>, string>({
      query: (id) => `/purchases/returns/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'PurchaseReturn', id }],
    }),
    createPurchaseReturn: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/purchases/returns', method: 'POST', body }),
      invalidatesTags: ['PurchaseReturn', 'Purchases', 'Inventory', 'Finance'],
    }),
    purchasesReportsCatalog: build.query<{ report_types: string[] }, void>({
      query: () => '/purchases/reports',
      providesTags: ['Purchases'],
    }),
    runPurchasesReport: build.mutation<
      { report_type: string; rows: Record<string, unknown>[] },
      { report_type: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/purchases/reports/run', method: 'POST', body }),
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
    checkInventoryCategoryName: build.query<
      { exists: boolean; id?: string },
      { name: string }
    >({
      query: ({ name }) => ({ url: '/inventory/categories/check-name', params: { name } }),
    }),
    getInventoryCategory: build.query<Record<string, unknown>, string>({
      query: (id) => `/inventory/categories/${id}`,
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
    listInventoryCategoryProducts: build.query<
      Record<string, unknown>[],
      { id: string; q?: string }
    >({
      query: ({ id, q }) => ({
        url: `/inventory/categories/${id}/products`,
        params: q ? { q } : undefined,
      }),
      providesTags: ['Inventory'],
    }),
    addInventoryCategoryProducts: build.mutation<
      { added: string[]; already_present: string[]; missing: string[] },
      { id: string; product_ids: string[] }
    >({
      query: ({ id, product_ids }) => ({
        url: `/inventory/categories/${id}/products`,
        method: 'POST',
        body: { product_ids },
      }),
      invalidatesTags: ['Inventory'],
    }),
    getInventoryCategorySalesBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/categories/${id}/sales-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getInventoryCategoryProductionBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/categories/${id}/production-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getInventoryCategoryCustomizationBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/categories/${id}/customization-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    listInventoryProducts: build.query<
      Record<string, unknown>[],
      { q?: string; active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/inventory/products', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    listCatalogProducts: build.query<
      Record<string, unknown>[],
      { q?: string; active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/inventory/catalog-products', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    createCatalogProduct: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/inventory/catalog-products', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    getCatalogProduct: build.query<Record<string, unknown>, string>({
      query: (id) => `/inventory/catalog-products/${id}`,
      providesTags: ['Inventory'],
    }),
    updateCatalogProduct: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/inventory/catalog-products/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Inventory'],
    }),
    createCatalogSku: build.mutation<
      Record<string, unknown>,
      { catalogProductId: string; body: Record<string, unknown> }
    >({
      query: ({ catalogProductId, body }) => ({
        url: `/inventory/catalog-products/${catalogProductId}/skus`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Inventory'],
    }),
    getCatalogProductSalesBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/catalog-products/${id}/sales-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getCatalogProductPurchaseBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/catalog-products/${id}/purchase-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getCatalogProductProductionBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/catalog-products/${id}/production-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getCatalogProductCustomizationBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/catalog-products/${id}/customization-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getCatalogProductSpecInsights: build.query<Record<string, unknown>, string>({
      query: (id) => `/inventory/catalog-products/${id}/spec-insights`,
      providesTags: ['Inventory'],
    }),
    getCatalogProductActivity: build.query<
      Record<string, unknown>,
      { id: string; limit?: number }
    >({
      query: ({ id, limit }) => ({
        url: `/inventory/catalog-products/${id}/activity`,
        params: limit ? { limit } : undefined,
      }),
      providesTags: ['Inventory'],
    }),
    mergeCatalogProducts: build.mutation<
      Record<string, unknown>,
      {
        target_catalog_product_id: string;
        source_catalog_product_ids: string[];
        force?: boolean;
      }
    >({
      query: (body) => ({
        url: '/inventory/catalog-products/merge',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Inventory'],
    }),
    resolveInventoryEntity: build.query<Record<string, unknown>, string>({
      query: (id) => `/inventory/resolve/${id}`,
      providesTags: ['Inventory'],
    }),
    listInventorySkus: build.query<
      Record<string, unknown>[],
      { q?: string; active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/inventory/skus', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    getSkuSalesBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/skus/${id}/sales-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getSkuPurchaseBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/skus/${id}/purchase-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getSkuProductionBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/skus/${id}/production-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getSkuCustomizationBreakdown: build.query<
      Record<string, unknown>,
      { id: string; start_date?: string; end_date?: string; grain?: string }
    >({
      query: ({ id, start_date, end_date, grain }) => ({
        url: `/inventory/skus/${id}/customization-breakdown`,
        params: {
          ...(start_date ? { start_date } : {}),
          ...(end_date ? { end_date } : {}),
          ...(grain ? { grain } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),
    getSkuActivity: build.query<Record<string, unknown>, { id: string; limit?: number }>({
      query: ({ id, limit }) => ({
        url: `/inventory/skus/${id}/activity`,
        params: limit ? { limit } : undefined,
      }),
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
    updateInventoryLocation: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/inventory/locations/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Inventory', 'SessionLocation'],
    }),
    deleteInventoryLocation: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/inventory/locations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Inventory', 'SessionLocation'],
    }),
    listInventoryUnits: build.query<Record<string, unknown>[], { active_only?: boolean } | void>({
      query: (args) => ({ url: '/inventory/units', params: args || undefined }),
      providesTags: ['Inventory'],
    }),
    listCustomerPrices: build.query<
      Record<string, unknown>[],
      { customer_id?: string } | void
    >({
      query: (args) => ({
        url: '/inventory/customer-prices',
        params: args?.customer_id ? { customer_id: args.customer_id } : undefined,
      }),
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
      { active_only?: boolean; q?: string; store_only?: boolean } | void
    >({
      query: (args) => {
        if (!args) return { url: '/finance/accounts' };
        const params: Record<string, string> = {};
        if (args.active_only != null) params.active_only = args.active_only ? 'true' : 'false';
        if (args.store_only != null) params.store_only = args.store_only ? 'true' : 'false';
        if (args.q) params.q = args.q;
        return { url: '/finance/accounts', params };
      },
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
    deleteFinanceAccount: build.mutation<void, string>({
      query: (id) => ({ url: `/finance/accounts/${id}`, method: 'DELETE' }),
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
    boutiqueHealth: build.query<Record<string, unknown>, void>({
      query: () => '/boutique/health',
      providesTags: ['Boutique'],
    }),
    boutiqueOverview: build.query<
      Record<string, unknown>,
      { start_date?: string; end_date?: string } | void
    >({
      query: (args) => ({
        url: '/boutique/overview',
        params: args || undefined,
      }),
      providesTags: ['Boutique', 'BoutiqueOrder', 'BoutiqueItem', 'BoutiqueMeasurement', 'BoutiqueTime'],
    }),
    listBoutiqueActivities: build.query<Record<string, unknown>[], void>({
      query: () => '/boutique/activities',
      providesTags: ['Boutique'],
    }),
    listBoutiqueOrders: build.query<
      PagedResult,
      {
        q?: string;
        order_number?: string;
        customer_name?: string;
        status?: string;
        sort_by?: string;
        sort_desc?: boolean;
        page?: number;
        page_size?: number;
      } | void
    >({
      query: (args) => ({ url: '/boutique/orders', params: args || undefined }),
      transformResponse: (response: unknown) => asPagedResult(response),
      providesTags: ['BoutiqueOrder'],
    }),
    getBoutiqueOrder: build.query<Record<string, unknown>, string>({
      query: (id) => `/boutique/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'BoutiqueOrder', id }],
    }),
    createBoutiqueOrder: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/boutique/orders', method: 'POST', body }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    patchBoutiqueOrder: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/boutique/orders/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    confirmBoutiqueOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/boutique/orders/${id}/confirm`, method: 'POST' }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique', 'BoutiqueTime'],
    }),
    cancelBoutiqueOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/boutique/orders/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    completeBoutiqueOrder: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/boutique/orders/${id}/complete`, method: 'POST' }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique', 'BoutiqueTime'],
    }),
    addBoutiqueOrderItem: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/items`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'BoutiqueItem', 'Boutique', 'BoutiqueTime'],
    }),
    updateBoutiqueOrderItem: build.mutation<
      Record<string, unknown>,
      { orderId: string; itemId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, itemId, body }) => ({
        url: `/boutique/orders/${orderId}/items/${itemId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'BoutiqueItem', 'Boutique', 'BoutiqueTime'],
    }),
    removeBoutiqueOrderItem: build.mutation<
      Record<string, unknown>,
      { orderId: string; itemId: string }
    >({
      query: ({ orderId, itemId }) => ({
        url: `/boutique/orders/${orderId}/items/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BoutiqueOrder', 'BoutiqueItem', 'Boutique', 'BoutiqueTime'],
    }),
    getBoutiqueOrderCreditBalance: build.query<
      { credit_balance: number; balance?: number; order_id?: string; account_id?: string },
      string
    >({
      query: (orderId) => `/boutique/orders/${orderId}/credit-balance`,
      providesTags: (_r, _e, id) => [{ type: 'BoutiqueOrder', id }],
      transformResponse: (response: Record<string, unknown>) => {
        const credit = Number(response.credit_balance ?? response.balance ?? 0);
        return {
          ...response,
          credit_balance: credit,
          balance: credit,
        };
      },
    }),
    applyBoutiqueOrderCreditAdvance: build.mutation<
      Record<string, unknown>,
      { orderId: string; body?: { amount?: number } }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/advances/credit`,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    listBoutiqueItemAttachments: build.query<
      Record<string, unknown>[],
      { orderId: string; itemId: string; category?: string }
    >({
      query: ({ orderId, itemId, category }) => ({
        url: `/boutique/orders/${orderId}/items/${itemId}/attachments`,
        params: category ? { category } : undefined,
      }),
      providesTags: ['BoutiqueOrder'],
    }),
    uploadBoutiqueItemAttachment: build.mutation<
      Record<string, unknown>,
      { orderId: string; itemId: string; file: File; category: string }
    >({
      query: ({ orderId, itemId, file, category }) => {
        const body = new FormData();
        body.append('file', file);
        body.append('category', category);
        return {
          url: `/boutique/orders/${orderId}/items/${itemId}/attachments`,
          method: 'POST',
          body,
        };
      },
      invalidatesTags: ['BoutiqueOrder'],
    }),
    deleteBoutiqueAttachment: build.mutation<Record<string, unknown>, string>({
      query: (attachmentId) => ({
        url: `/boutique/attachments/${attachmentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BoutiqueOrder'],
    }),
    getBoutiqueItemPdf: build.query<Blob, { orderId: string; itemId: string }>({
      query: ({ orderId, itemId }) => ({
        url: `/boutique/orders/${orderId}/items/${itemId}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    getBoutiqueAdvanceReceiptPdf: build.query<Blob, string>({
      query: (orderId) => ({
        url: `/boutique/orders/${orderId}/advance-receipt.pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    completeBoutiqueActivity: build.mutation<
      Record<string, unknown>,
      { orderId: string; activityId: string; body?: Record<string, unknown> }
    >({
      query: ({ orderId, activityId, body }) => ({
        url: `/boutique/orders/${orderId}/activities/${activityId}/complete`,
        method: 'POST',
        body: body || { completed_by: 'web' },
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique', 'BoutiqueTime'],
    }),
    skipBoutiqueActivity: build.mutation<
      Record<string, unknown>,
      { orderId: string; activityId: string; body?: Record<string, unknown> }
    >({
      query: ({ orderId, activityId, body }) => ({
        url: `/boutique/orders/${orderId}/activities/${activityId}/skip`,
        method: 'POST',
        body: body || { completed_by: 'web' },
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique', 'BoutiqueTime'],
    }),
    addBoutiqueItemActivity: build.mutation<
      Record<string, unknown>,
      { orderId: string; itemId: string; activityId: string }
    >({
      query: ({ orderId, itemId, activityId }) => ({
        url: `/boutique/orders/${orderId}/items/${itemId}/activities`,
        method: 'POST',
        body: { activity_id: activityId },
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    removeBoutiqueItemActivity: build.mutation<
      Record<string, unknown>,
      { orderId: string; activityId: string }
    >({
      query: ({ orderId, activityId }) => ({
        url: `/boutique/orders/${orderId}/activities/${activityId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    recordBoutiqueAdvance: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/advances`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    listBoutiqueOrderInvoices: build.query<Record<string, unknown>[], string>({
      query: (orderId) => `/boutique/orders/${orderId}/invoices`,
      providesTags: ['BoutiqueOrder'],
    }),
    createBoutiqueOrderInvoice: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/invoices`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    listBoutiqueOrderDeliveries: build.query<Record<string, unknown>[], string>({
      query: (orderId) => `/boutique/orders/${orderId}/deliveries`,
      providesTags: ['BoutiqueOrder'],
    }),
    createBoutiqueOrderDelivery: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/deliveries`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    listBoutiqueOrderExpenses: build.query<Record<string, unknown>[], string>({
      query: (orderId) => `/boutique/orders/${orderId}/expenses`,
      providesTags: ['BoutiqueOrder'],
    }),
    createBoutiqueOrderExpense: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/expenses`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    getBoutiqueOrderFinancials: build.query<Record<string, unknown>, string>({
      query: (orderId) => `/boutique/orders/${orderId}/financials`,
      providesTags: (_r, _e, id) => [{ type: 'BoutiqueOrder', id }, 'Boutique'],
    }),
    listBoutiqueOrderVouchers: build.query<
      Record<string, unknown>[],
      { orderId: string; kind?: string }
    >({
      query: ({ orderId, kind }) => ({
        url: `/boutique/orders/${orderId}/vouchers`,
        params: kind ? { kind } : undefined,
      }),
      providesTags: ['BoutiqueOrder'],
    }),
    createBoutiqueOrderReceipt: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/receipts`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    createBoutiqueOrderVendorPayment: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/vendor-payments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    createBoutiqueOrderRefund: build.mutation<
      Record<string, unknown>,
      { orderId: string; body: Record<string, unknown> }
    >({
      query: ({ orderId, body }) => ({
        url: `/boutique/orders/${orderId}/refunds`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueOrder', 'Boutique'],
    }),
    listBoutiqueItems: build.query<
      PagedResult,
      {
        q?: string;
        bill_number?: string;
        description?: string;
        customer_name?: string;
        status?: string;
        sort_by?: string;
        sort_desc?: boolean;
        page?: number;
        page_size?: number;
      } | void
    >({
      query: (args) => ({ url: '/boutique/items', params: args || undefined }),
      transformResponse: (response: unknown) => asPagedResult(response),
      providesTags: ['BoutiqueItem'],
    }),
    getBoutiqueItem: build.query<
      Record<string, unknown>,
      { itemId: string; orderId?: string }
    >({
      query: ({ itemId, orderId }) => ({
        url: `/boutique/items/${itemId}`,
        params: orderId ? { order_id: orderId } : undefined,
      }),
      providesTags: ['BoutiqueItem'],
    }),
    createBoutiqueItem: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/boutique/items', method: 'POST', body }),
      invalidatesTags: ['BoutiqueItem', 'BoutiqueOrder', 'Boutique'],
    }),
    listBoutiqueMeasurementSpecs: build.query<Record<string, unknown>[], void>({
      query: () => '/boutique/measurement-specs',
      providesTags: ['BoutiqueMeasurement'],
    }),
    listBoutiqueMeasurementSections: build.query<Record<string, unknown>[], void>({
      query: () => '/boutique/measurement-sections',
      providesTags: ['BoutiqueMeasurement'],
    }),
    listBoutiqueMeasurements: build.query<
      PagedResult,
      {
        q?: string;
        customer_id?: string;
        measurement_number?: string;
        wearer_name?: string;
        person_type?: string;
        sort_by?: string;
        sort_desc?: boolean;
        page?: number;
        page_size?: number;
      } | void
    >({
      query: (args) => ({ url: '/boutique/measurements', params: args || undefined }),
      transformResponse: (response: unknown) => asPagedResult(response),
      providesTags: ['BoutiqueMeasurement'],
    }),
    getBoutiqueMeasurement: build.query<Record<string, unknown>, string>({
      query: (id) => `/boutique/measurements/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'BoutiqueMeasurement', id }],
    }),
    getBoutiqueMeasurementPdf: build.query<Blob, string>({
      query: (id) => ({
        url: `/boutique/measurements/${id}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    getBoutiqueOrderInvoicePdf: build.query<
      Blob,
      { orderId: string; invoiceId: string }
    >({
      query: ({ orderId, invoiceId }) => ({
        url: `/boutique/orders/${orderId}/invoices/${invoiceId}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    createBoutiqueMeasurement: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/boutique/measurements', method: 'POST', body }),
      invalidatesTags: ['BoutiqueMeasurement', 'Boutique'],
    }),
    updateBoutiqueMeasurement: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/boutique/measurements/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['BoutiqueMeasurement', 'Boutique'],
    }),
    deleteBoutiqueMeasurement: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/boutique/measurements/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BoutiqueMeasurement', 'Boutique'],
    }),
    listBoutiqueTimeEntries: build.query<
      PagedResult,
      {
        q?: string;
        bill_number?: string;
        order_number?: string;
        worker_name?: string;
        activity_name?: string;
        work_date_from?: string;
        work_date_to?: string;
        task_type?: string;
        status?: string;
        sort_by?: string;
        sort_desc?: boolean;
        page?: number;
        page_size?: number;
      } | void
    >({
      query: (args) => ({ url: '/boutique/time-entries', params: args || undefined }),
      transformResponse: (response: unknown) => asPagedResult(response),
      providesTags: ['BoutiqueTime'],
    }),
    getBoutiqueTimeEntry: build.query<Record<string, unknown>, string>({
      query: (id) => `/boutique/time-entries/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'BoutiqueTime', id }, 'BoutiqueTime'],
    }),
    createBoutiqueTimeEntry: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/boutique/time-entries', method: 'POST', body }),
      invalidatesTags: ['BoutiqueTime', 'Boutique'],
    }),
    syncBoutiqueActivityTasks: build.mutation<
      Record<string, unknown>,
      { order_id?: string } | void
    >({
      query: (args) => ({
        url: '/boutique/tasks/sync',
        method: 'POST',
        params: args || undefined,
      }),
      invalidatesTags: ['BoutiqueTime', 'Boutique'],
    }),
    updateBoutiqueTimeEntry: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/boutique/time-entries/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['BoutiqueTime', 'Boutique'],
    }),
    assignBoutiqueTimeEntry: build.mutation<
      Record<string, unknown>,
      { id: string; body: { assignee_worker_id?: string; assignee_name?: string } }
    >({
      query: ({ id, body }) => ({
        url: `/boutique/time-entries/${id}/assign`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BoutiqueTime', 'Boutique'],
    }),
    deleteBoutiqueTimeEntry: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/boutique/time-entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BoutiqueTime', 'Boutique'],
    }),
    boutiqueCalendar: build.query<
      Record<string, unknown>[],
      { start_date?: string; end_date?: string; worker_name?: string } | void
    >({
      query: (args) => ({ url: '/boutique/calendar', params: args || undefined }),
      providesTags: ['BoutiqueTime', 'Boutique'],
    }),
    boutiqueReportsCatalog: build.query<{ report_types: string[] }, void>({
      query: () => '/boutique/reports/catalog',
      providesTags: ['Boutique'],
    }),
    runBoutiqueReport: build.mutation<
      { report_type: string; rows: Record<string, unknown>[] },
      { report_type: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/boutique/reports/run', method: 'POST', body }),
    }),

    // Store
    storeHealth: build.query<Record<string, unknown>, void>({
      query: () => '/store/health',
      providesTags: ['StoreActivity', 'StoreTime'],
    }),
    storeOverview: build.query<Record<string, unknown>, void>({
      query: () => '/store/overview',
      providesTags: ['StoreActivity', 'StoreTime'],
    }),
    listStoreActivities: build.query<
      Record<string, unknown>[],
      { active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/store/activities', params: args || undefined }),
      providesTags: ['StoreActivity'],
    }),
    getStoreActivity: build.query<Record<string, unknown>, string>({
      query: (id) => `/store/activities/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'StoreActivity', id }],
    }),
    createStoreActivity: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/store/activities', method: 'POST', body }),
      invalidatesTags: ['StoreActivity'],
    }),
    updateStoreActivity: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/store/activities/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['StoreActivity'],
    }),
    deactivateStoreActivity: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/store/activities/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: ['StoreActivity'],
    }),
    listStoreTimeEntries: build.query<
      Record<string, unknown>[],
      Record<string, string | undefined> | void
    >({
      query: (args) => ({ url: '/store/time-entries', params: args || undefined }),
      providesTags: ['StoreTime'],
    }),
    getStoreTimeEntry: build.query<Record<string, unknown>, string>({
      query: (id) => `/store/time-entries/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'StoreTime', id }],
    }),
    createStoreTimeEntry: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/store/time-entries', method: 'POST', body }),
      invalidatesTags: ['StoreTime'],
    }),
    updateStoreTimeEntry: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/store/time-entries/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['StoreTime'],
    }),
    setStoreTimeEntryStatus: build.mutation<
      Record<string, unknown>,
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `/store/time-entries/${id}/status`,
        method: 'POST',
        body: { status },
      }),
      invalidatesTags: ['StoreTime'],
    }),
    completeStoreTimeEntry: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/store/time-entries/${id}/complete`, method: 'POST' }),
      invalidatesTags: ['StoreTime'],
    }),
    deleteStoreTimeEntry: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/store/time-entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['StoreTime'],
    }),

    // Business ops
    businessHealth: build.query<Record<string, unknown>, void>({
      query: () => '/business/health',
      providesTags: ['BusinessActivity', 'BusinessTask', 'BusinessTime'],
    }),
    businessOverview: build.query<Record<string, unknown>, void>({
      query: () => '/business/overview',
      providesTags: ['BusinessActivity', 'BusinessTask', 'BusinessTime'],
    }),
    listBusinessActivities: build.query<
      { items: Record<string, unknown>[]; total: number; page: number; page_size: number },
      { active_only?: boolean; page?: number; page_size?: number } | void
    >({
      query: (args) => ({ url: '/business/activities', params: args || undefined }),
      providesTags: ['BusinessActivity'],
    }),
    createBusinessActivity: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/business/activities', method: 'POST', body }),
      invalidatesTags: ['BusinessActivity'],
    }),
    updateBusinessActivity: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/business/activities/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['BusinessActivity'],
    }),
    deactivateBusinessActivity: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/business/activities/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: ['BusinessActivity'],
    }),
    listBusinessTasks: build.query<
      { items: Record<string, unknown>[]; total: number; page: number; page_size: number },
      { page?: number; page_size?: number } | void
    >({
      query: (args) => ({ url: '/business/tasks', params: args || undefined }),
      providesTags: ['BusinessTask'],
    }),
    createBusinessTask: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/business/tasks', method: 'POST', body }),
      invalidatesTags: ['BusinessTask'],
    }),
    updateBusinessTask: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/business/tasks/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['BusinessTask'],
    }),
    assignBusinessTask: build.mutation<
      Record<string, unknown>,
      { id: string; worker_id: string }
    >({
      query: ({ id, worker_id }) => ({
        url: `/business/tasks/${id}/assign`,
        method: 'POST',
        body: { worker_id },
      }),
      invalidatesTags: ['BusinessTask'],
    }),
    setBusinessTaskStatus: build.mutation<
      Record<string, unknown>,
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `/business/tasks/${id}/status`,
        method: 'POST',
        body: { status },
      }),
      invalidatesTags: ['BusinessTask'],
    }),
    completeBusinessTask: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/business/tasks/${id}/complete`, method: 'POST' }),
      invalidatesTags: ['BusinessTask'],
    }),
    deleteBusinessTask: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/business/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BusinessTask'],
    }),
    listBusinessTimeEntries: build.query<
      { items: Record<string, unknown>[]; total: number; page: number; page_size: number },
      { task_id?: string; page?: number; page_size?: number } | void
    >({
      query: (args) => ({ url: '/business/time-entries', params: args || undefined }),
      providesTags: ['BusinessTime'],
    }),
    createBusinessTimeEntry: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/business/time-entries', method: 'POST', body }),
      invalidatesTags: ['BusinessTime', 'BusinessTask'],
    }),
    deleteBusinessTimeEntry: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/business/time-entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BusinessTime'],
    }),
    calculateWorkerSalary: build.mutation<
      Record<string, unknown>,
      { id: string; body: { period_from: string; period_to: string } }
    >({
      query: ({ id, body }) => ({
        url: `/parties/workers/${id}/salary/calculate`,
        method: 'POST',
        body,
      }),
    }),
    payWorkerSalary: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/parties/workers/${id}/salary/pay`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Worker', 'Finance'],
    }),
    listProductionActivities: build.query<
      Record<string, unknown>[],
      { active_only?: boolean } | void
    >({
      query: (args) => ({ url: '/production/activities', params: args || undefined }),
      providesTags: ['Production'],
    }),
    createProductionActivity: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/production/activities', method: 'POST', body }),
      invalidatesTags: ['Production'],
    }),
    updateProductionActivity: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/production/activities/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Production'],
    }),
    deactivateProductionActivity: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/production/activities/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: ['Production'],
    }),

    // CRM
    crmHealth: build.query<Record<string, unknown>, void>({
      query: () => '/crm/health',
    }),
    crmOverview: build.query<Record<string, unknown>, void>({
      query: () => '/crm/overview',
      providesTags: ['CrmLead', 'CrmEnquiry', 'CrmActivity'],
    }),
    listCrmOwners: build.query<
      { id: string; name: string; active: boolean; roles: string[] }[],
      void
    >({
      query: () => '/crm/owners',
    }),
    listCrmLeads: build.query<
      PagedResult,
      {
        status?: string;
        search?: string;
        assigned_user_id?: string;
        source?: string;
        priority?: string;
        date_from?: string;
        date_to?: string;
        sort_by?: string;
        sort_desc?: boolean;
        page?: number;
        page_size?: number;
        deleted?: 'exclude' | 'only' | 'include';
      } | void
    >({
      query: (args) => ({ url: '/crm/leads', params: args || undefined }),
      providesTags: ['CrmLead'],
    }),
    getCrmLead: build.query<
      Record<string, unknown>,
      string | { id: string; include_deleted?: boolean }
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const include_deleted = typeof arg === 'string' ? undefined : arg.include_deleted;
        return {
          url: `/crm/leads/${id}`,
          params: include_deleted ? { include_deleted: true } : undefined,
        };
      },
      providesTags: ['CrmLead'],
    }),
    createCrmLead: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/crm/leads', method: 'POST', body }),
      invalidatesTags: ['CrmLead'],
    }),
    updateCrmLead: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/crm/leads/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['CrmLead'],
    }),
    detectCrmLeadDuplicates: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/crm/leads/detect-duplicates', method: 'POST', body }),
    }),
    bulkAssignCrmLeads: build.mutation<
      Record<string, unknown>,
      { ids: string[]; assigned_user_id: string; assigned_user_name?: string }
    >({
      query: (body) => ({ url: '/crm/leads/bulk-assign', method: 'POST', body }),
      invalidatesTags: ['CrmLead'],
    }),
    bulkStatusCrmLeads: build.mutation<
      Record<string, unknown>,
      { ids: string[]; status: string }
    >({
      query: (body) => ({ url: '/crm/leads/bulk-status', method: 'POST', body }),
      invalidatesTags: ['CrmLead'],
    }),
    importCrmLeadsDryRun: build.mutation<
      Record<string, unknown>,
      {
        rows: Record<string, unknown>[];
        duplicate_policy?: string;
        location_id?: string;
        location_name?: string;
        branch?: string;
        source_filename?: string;
      }
    >({
      query: (body) => ({ url: '/crm/leads/import/dry-run', method: 'POST', body }),
    }),
    importCrmLeadsCommit: build.mutation<
      Record<string, unknown>,
      {
        rows: Record<string, unknown>[];
        duplicate_policy?: string;
        location_id?: string;
        location_name?: string;
        branch?: string;
        source_filename?: string;
      }
    >({
      query: (body) => ({ url: '/crm/leads/import/commit', method: 'POST', body }),
      invalidatesTags: ['CrmLead'],
    }),
    assignCrmLead: build.mutation<
      Record<string, unknown>,
      { id: string; assigned_user_id: string; assigned_user_name?: string }
    >({
      query: ({ id, assigned_user_id, assigned_user_name }) => ({
        url: `/crm/leads/${id}/assign`,
        method: 'POST',
        body: { assigned_user_id, assigned_user_name: assigned_user_name || '' },
      }),
      invalidatesTags: ['CrmLead'],
    }),
    setCrmLeadStatus: build.mutation<Record<string, unknown>, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/crm/leads/${id}/status`,
        method: 'POST',
        body: { status },
      }),
      invalidatesTags: ['CrmLead'],
    }),
    markCrmLeadLost: build.mutation<Record<string, unknown>, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/crm/leads/${id}/mark-lost`,
        method: 'POST',
        body: { reason: reason || '' },
      }),
      invalidatesTags: ['CrmLead'],
    }),
    reopenCrmLead: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/crm/leads/${id}/reopen`, method: 'POST' }),
      invalidatesTags: ['CrmLead'],
    }),
    convertCrmLead: build.mutation<Record<string, unknown>, { id: string; force_new?: boolean }>({
      query: ({ id, force_new }) => ({
        url: `/crm/leads/${id}/convert`,
        method: 'POST',
        body: { force_new: force_new || false },
      }),
      invalidatesTags: ['CrmLead', 'Customer'],
    }),
    getCrmLeadTimeline: build.query<Record<string, unknown>[], string>({
      query: (id) => `/crm/leads/${id}/timeline`,
      providesTags: ['CrmActivity'],
    }),
    deleteCrmLead: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/crm/leads/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CrmLead'],
    }),
    restoreCrmEntity: build.mutation<
      Record<string, unknown>,
      { entity_type: 'lead' | 'enquiry' | 'activity'; entity_id: string }
    >({
      query: ({ entity_type, entity_id }) => ({
        url: `/crm/${entity_type}/${entity_id}/restore`,
        method: 'POST',
      }),
      invalidatesTags: ['CrmLead', 'CrmEnquiry', 'CrmActivity'],
    }),
    getCrmEntityAudit: build.query<
      { items: Record<string, unknown>[]; total: number },
      { entity_type: 'lead' | 'enquiry' | 'activity'; entity_id: string; limit?: number }
    >({
      query: ({ entity_type, entity_id, limit }) => ({
        url: `/crm/${entity_type}/${entity_id}/audit`,
        params: limit ? { limit } : undefined,
      }),
    }),
    listCrmEnquiries: build.query<
      PagedResult,
      {
        status?: string;
        search?: string;
        assigned_user_id?: string;
        date_from?: string;
        date_to?: string;
        sort_by?: string;
        sort_desc?: boolean;
        page?: number;
        page_size?: number;
        deleted?: 'exclude' | 'only' | 'include';
      } | void
    >({
      query: (args) => ({ url: '/crm/enquiries', params: args || undefined }),
      providesTags: ['CrmEnquiry'],
    }),
    getCrmEnquiry: build.query<
      Record<string, unknown>,
      string | { id: string; include_deleted?: boolean }
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const include_deleted = typeof arg === 'string' ? undefined : arg.include_deleted;
        return {
          url: `/crm/enquiries/${id}`,
          params: include_deleted ? { include_deleted: true } : undefined,
        };
      },
      providesTags: ['CrmEnquiry'],
    }),
    createCrmEnquiry: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/crm/enquiries', method: 'POST', body }),
      invalidatesTags: ['CrmEnquiry'],
    }),
    updateCrmEnquiry: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/crm/enquiries/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['CrmEnquiry'],
    }),
    bulkAssignCrmEnquiries: build.mutation<
      Record<string, unknown>,
      { ids: string[]; assigned_user_id: string; assigned_user_name?: string }
    >({
      query: (body) => ({ url: '/crm/enquiries/bulk-assign', method: 'POST', body }),
      invalidatesTags: ['CrmEnquiry'],
    }),
    bulkStatusCrmEnquiries: build.mutation<
      Record<string, unknown>,
      { ids: string[]; status: string; lost_reason?: string }
    >({
      query: (body) => ({ url: '/crm/enquiries/bulk-status', method: 'POST', body }),
      invalidatesTags: ['CrmEnquiry'],
    }),
    createCrmQuotationFromEnquiry: build.mutation<
      Record<string, unknown>,
      {
        enquiry_id: string;
        notes?: string;
        quotation_date?: string;
        valid_until?: string;
      }
    >({
      query: ({ enquiry_id, ...body }) => ({
        url: `/crm/enquiries/${enquiry_id}/create-quotation`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CrmEnquiry'],
    }),
    deleteCrmEnquiry: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/crm/enquiries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CrmEnquiry'],
    }),
    listCrmActivities: build.query<
      PagedResult,
      {
        lead_id?: string;
        enquiry_id?: string;
        status?: string;
        activity_type?: string;
        assigned_user_id?: string;
        search?: string;
        scheduled_from?: string;
        scheduled_to?: string;
        date_from?: string;
        date_to?: string;
        sort_by?: string;
        sort_desc?: boolean;
        needs_correction?: boolean;
        origin?: string;
        page?: number;
        page_size?: number;
        deleted?: 'exclude' | 'only' | 'include';
      } | void
    >({
      query: (args) => ({ url: '/crm/activities', params: args || undefined }),
      providesTags: ['CrmActivity'],
    }),
    getCrmActivity: build.query<
      Record<string, unknown>,
      string | { id: string; include_deleted?: boolean }
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const include_deleted = typeof arg === 'string' ? undefined : arg.include_deleted;
        return {
          url: `/crm/activities/${id}`,
          params: include_deleted ? { include_deleted: true } : undefined,
        };
      },
      providesTags: ['CrmActivity'],
    }),
    createCrmActivity: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/crm/activities', method: 'POST', body }),
      invalidatesTags: ['CrmActivity', 'CrmLead'],
    }),
    updateCrmActivity: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/crm/activities/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['CrmActivity'],
    }),
    completeCrmActivity: build.mutation<
      Record<string, unknown>,
      {
        id: string;
        outcome?: string;
        notes?: string;
        next_action?: string;
        next_follow_up_at?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/crm/activities/${id}/complete`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CrmActivity', 'CrmLead'],
    }),
    cancelCrmActivity: build.mutation<Record<string, unknown>, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/crm/activities/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['CrmActivity'],
    }),
    rescheduleCrmActivity: build.mutation<
      Record<string, unknown>,
      { id: string; scheduled_at: string; reason?: string }
    >({
      query: ({ id, scheduled_at, reason }) => ({
        url: `/crm/activities/${id}/reschedule`,
        method: 'POST',
        body: { scheduled_at, reason: reason || '' },
      }),
      invalidatesTags: ['CrmActivity'],
    }),
    deleteCrmActivity: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/crm/activities/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CrmActivity'],
    }),
    crmCalendar: build.query<
      Record<string, unknown>[],
      {
        scheduled_from?: string;
        scheduled_to?: string;
        assigned_user_id?: string;
        status?: string;
        activity_type?: string;
      } | void
    >({
      query: (args) => ({ url: '/crm/calendar', params: args || undefined }),
      providesTags: ['CrmActivity'],
    }),
    crmReportsCatalog: build.query<
      { reports: { id: string; title: string; category: string }[]; report_types: string[] },
      void
    >({
      query: () => '/crm/reports/catalog',
    }),
    runCrmReport: build.mutation<
      Record<string, unknown>,
      { report_id: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/crm/reports/run', method: 'POST', body }),
    }),
    getCrmSettings: build.query<Record<string, unknown>, void>({
      query: () => '/crm/settings',
      providesTags: ['Settings'],
    }),
    updateCrmSettings: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/crm/settings', method: 'PATCH', body }),
      invalidatesTags: ['Settings'],
    }),
    getCrmNotificationPreferences: build.query<Record<string, unknown>, void>({
      query: () => '/crm/notifications/preferences',
    }),
    updateCrmNotificationPreferences: build.mutation<
      Record<string, unknown>,
      Record<string, unknown>
    >({
      query: (body) => ({ url: '/crm/notifications/preferences', method: 'PATCH', body }),
    }),
    previewCrmWhatsappPaymentReminder: build.mutation<
      Record<string, unknown>,
      Record<string, unknown>
    >({
      query: (body) => ({ url: '/crm/whatsapp/payment-reminder', method: 'POST', body }),
    }),
    getCrmCollections: build.query<Record<string, unknown>, void>({
      query: () => '/crm/collections',
      providesTags: ['CrmActivity'],
    }),
    getCrmCustomerRelated: build.query<
      {
        customer_id: string;
        leads: Record<string, unknown>[];
        enquiries: Record<string, unknown>[];
        activities: Record<string, unknown>[];
        recent_activities?: Record<string, unknown>[];
        timeline?: Record<string, unknown>[];
        last_contact_at?: string | null;
        next_follow_up_at?: string | null;
        outstanding_balance?: number | null;
        open_invoice_outstanding?: number | null;
      },
      string
    >({
      query: (customerId) => `/crm/customers/${customerId}/related`,
      providesTags: ['CrmLead', 'CrmEnquiry', 'CrmActivity'],
    }),
    listCrmReportPresets: build.query<
      { items: Record<string, unknown>[]; total: number },
      void
    >({
      query: () => '/crm/report-presets',
    }),
    createCrmReportPreset: build.mutation<
      Record<string, unknown>,
      { name: string; report_id: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/crm/report-presets', method: 'POST', body }),
    }),
    deleteCrmReportPreset: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/crm/report-presets/${id}`, method: 'DELETE' }),
    }),
    listCrmListViews: build.query<
      { items: Record<string, unknown>[]; total: number },
      { entity: 'lead' | 'enquiry' | 'activity' }
    >({
      query: (args) => ({ url: '/crm/list-views', params: args }),
      providesTags: ['CrmListView'],
    }),
    createCrmListView: build.mutation<
      Record<string, unknown>,
      {
        name: string;
        entity: 'lead' | 'enquiry' | 'activity';
        filters?: Record<string, unknown>;
        sort?: { key: string; desc: boolean }[];
        columns?: string[];
      }
    >({
      query: (body) => ({ url: '/crm/list-views', method: 'POST', body }),
      invalidatesTags: ['CrmListView'],
    }),
    deleteCrmListView: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/crm/list-views/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CrmListView'],
    }),
    uploadCrmAttachment: build.mutation<
      Record<string, unknown>,
      { entity_type: string; entity_id: string; file: File }
    >({
      query: ({ entity_type, entity_id, file }) => {
        const body = new FormData();
        body.append('entity_type', entity_type);
        body.append('entity_id', entity_id);
        body.append('file', file);
        return {
          url: '/crm/attachments',
          method: 'POST',
          body,
        };
      },
      invalidatesTags: ['CrmLead', 'CrmEnquiry', 'CrmActivity'],
    }),
    getCrmAttachment: build.query<Blob, string>({
      query: (attachmentId) => ({
        url: `/crm/attachments/${attachmentId}`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    getCrmAttachmentMeta: build.query<
      {
        id: string;
        name: string;
        content_type: string;
        size_bytes: number;
        entity_type: string;
        entity_id: string;
      },
      string
    >({
      query: (attachmentId) => `/crm/attachments/${attachmentId}/meta`,
    }),
    deleteCrmAttachment: build.mutation<Record<string, unknown>, string>({
      query: (attachmentId) => ({
        url: `/crm/attachments/${attachmentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['CrmLead', 'CrmEnquiry', 'CrmActivity'],
    }),

    // Schedulers
    listSchedulerJobs: build.query<
      Record<string, unknown>[],
      { module?: string } | void
    >({
      query: (args) => ({
        url: '/schedulers/jobs',
        params: args && 'module' in args && args.module ? { module: args.module } : undefined,
      }),
      providesTags: ['SchedulerJob'],
    }),
    createSchedulerJob: build.mutation<
      Record<string, unknown>,
      { name?: string; module: string; cron?: string; job_id?: string; enabled?: boolean }
    >({
      query: (body) => ({ url: '/schedulers/jobs', method: 'POST', body }),
      invalidatesTags: ['SchedulerJob'],
    }),
    runSchedulerJob: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/schedulers/jobs/${id}/run`, method: 'POST' }),
      invalidatesTags: ['SchedulerJob'],
    }),
    updateSchedulerJob: build.mutation<
      Record<string, unknown>,
      { id: string; body: { enabled?: boolean; title?: string; frequency?: string; time_of_day?: string; weekday?: number; interval_days?: number } }
    >({
      query: ({ id, body }) => ({ url: `/schedulers/jobs/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['SchedulerJob'],
    }),
    listSchedulerJobRuns: build.query<Record<string, unknown>[], { id: string; limit?: number }>({
      query: ({ id, limit }) => ({ url: `/schedulers/jobs/${id}/runs`, params: limit ? { limit } : undefined }),
      providesTags: ['SchedulerJob'],
    }),
    listScheduledReports: build.query<Record<string, unknown>[], { module: string }>({
      query: ({ module }) => ({ url: '/schedulers/reports', params: { module } }),
      providesTags: ['SchedulerJob'],
    }),
    updateScheduledReport: build.mutation<
      Record<string, unknown>,
      { module: string; id: string; body: Record<string, unknown> }
    >({
      query: ({ module, id, body }) => ({
        url: `/schedulers/reports/${id}`,
        method: 'PATCH',
        params: { module },
        body,
      }),
      invalidatesTags: ['SchedulerJob'],
    }),
    runScheduledReport: build.mutation<Record<string, unknown>, { module: string; id: string }>({
      query: ({ module, id }) => ({
        url: `/schedulers/reports/${id}/run`,
        method: 'POST',
        params: { module },
      }),
      invalidatesTags: ['SchedulerJob'],
    }),
    listScheduledReportRuns: build.query<
      Record<string, unknown>[],
      { module: string; id: string; limit?: number }
    >({
      query: ({ module, id, limit }) => ({
        url: `/schedulers/reports/${id}/runs`,
        params: { module, ...(limit ? { limit } : {}) },
      }),
      providesTags: ['SchedulerJob'],
    }),

    // Projects
    projectsHealth: build.query<Record<string, unknown>, void>({
      query: () => '/projects/health',
    }),
    projectsOverview: build.query<Record<string, unknown>, void>({
      query: () => '/projects/overview',
      providesTags: ['Project', 'ProjectEnquiry'],
    }),
    listProjects: build.query<Record<string, unknown>[], void>({
      query: () => '/projects',
      providesTags: ['Project'],
    }),
    getProject: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/${id}`,
      providesTags: ['Project'],
    }),
    createProject: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: ['Project'],
    }),
    updateProject: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/projects/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Project'],
    }),
    getProjectWorkspace: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/${id}/workspace`,
      providesTags: ['Project'],
    }),
    listProjectEnquiries: build.query<Record<string, unknown>[], void>({
      query: () => '/projects/enquiries',
      providesTags: ['ProjectEnquiry'],
    }),
    getProjectEnquiry: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/enquiries/${id}`,
      providesTags: ['ProjectEnquiry'],
    }),
    createProjectEnquiry: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/projects/enquiries', method: 'POST', body }),
      invalidatesTags: ['ProjectEnquiry'],
    }),
    listProjectBoq: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/boq`,
      providesTags: ['Project'],
    }),
    createProjectBoqItem: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/boq`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listAllProjectMeasurements: build.query<Record<string, unknown>[], void>({
      query: () => '/projects/measurements',
      providesTags: ['Project'],
    }),
    listProjectMeasurements: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/measurements`,
      providesTags: ['Project'],
    }),
    createProjectMeasurement: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/measurements`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listAllProjectRaBills: build.query<Record<string, unknown>[], void>({
      query: () => '/projects/ra-bills',
      providesTags: ['Project'],
    }),
    listProjectRaBills: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/ra-bills`,
      providesTags: ['Project'],
    }),
    createProjectRaBill: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/ra-bills`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectTime: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/time`,
      providesTags: ['Project'],
    }),
    listProjectDocuments: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/documents`,
      providesTags: ['Project'],
    }),
    listProjectDpr: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/dpr`,
      providesTags: ['Project'],
    }),
    createProjectDpr: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/dpr`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectPortalTokens: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/portal`,
      providesTags: ['Project'],
    }),
    createProjectPortalToken: build.mutation<
      Record<string, unknown>,
      { projectId: string; body?: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/portal`,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['Project'],
    }),
    getProjectSiteMobile: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/${id}/site-mobile`,
      providesTags: ['Project'],
    }),
    projectsReportsCatalog: build.query<{ report_types: string[] }, void>({
      query: () => '/projects/reports/catalog',
    }),
    runProjectsReport: build.mutation<
      Record<string, unknown>,
      { report_type: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/projects/reports/run', method: 'POST', body }),
    }),
    getProjectsSettings: build.query<Record<string, unknown>, void>({
      query: () => '/projects/settings',
      providesTags: ['Settings'],
    }),
    getProjectBudget: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/${id}/budget`,
      providesTags: ['Project'],
    }),
    addProjectBudgetLine: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/budget/lines`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    submitProjectMeasurement: build.mutation<
      Record<string, unknown>,
      { projectId: string; measurementId: string }
    >({
      query: ({ projectId, measurementId }) => ({
        url: `/projects/${projectId}/measurements/${measurementId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    certifyProjectMeasurement: build.mutation<
      Record<string, unknown>,
      { projectId: string; measurementId: string; body?: Record<string, unknown> }
    >({
      query: ({ projectId, measurementId, body }) => ({
        url: `/projects/${projectId}/measurements/${measurementId}/certify`,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['Project'],
    }),
    submitProjectRaBill: build.mutation<
      Record<string, unknown>,
      { projectId: string; raId: string }
    >({
      query: ({ projectId, raId }) => ({
        url: `/projects/${projectId}/ra-bills/${raId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    createProjectExpense: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/expenses`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    createProjectTimeEntry: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/time`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    uploadProjectDocument: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/documents`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    updateProjectEnquiryStatus: build.mutation<
      Record<string, unknown>,
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `/projects/enquiries/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['ProjectEnquiry'],
    }),
    startProjectEnquiryEstimation: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/projects/enquiries/${id}/start-estimation`, method: 'POST' }),
      invalidatesTags: ['ProjectEnquiry', 'Project'],
    }),
    markProjectEnquiryWon: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/projects/enquiries/${id}/mark-won`, method: 'POST' }),
      invalidatesTags: ['ProjectEnquiry'],
    }),
    listProjectActivities: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/activities`,
      providesTags: ['Project'],
    }),
    createProjectActivity: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/activities`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    updateProjectActivity: build.mutation<
      Record<string, unknown>,
      { projectId: string; activityId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, activityId, body }) => ({
        url: `/projects/${projectId}/activities/${activityId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    getProjectCosts: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/${id}/costs`,
      providesTags: ['Project'],
    }),
    listProjectExpenses: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/expenses`,
      providesTags: ['Project'],
    }),
    getProjectClosureBlockers: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/closure-blockers`,
      providesTags: ['Project'],
    }),
    getProjectProfitability: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/${id}/profitability`,
      providesTags: ['Project'],
    }),
    getProjectAccountingSummary: build.query<Record<string, unknown>, string>({
      query: (id) => `/projects/${id}/accounting-summary`,
      providesTags: ['Project'],
    }),
    listProjectQuotations: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/quotations`,
      providesTags: ['Project'],
    }),
    createProjectQuotation: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/quotations`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    sendProjectQuotation: build.mutation<
      Record<string, unknown>,
      { projectId: string; quotationId: string }
    >({
      query: ({ projectId, quotationId }) => ({
        url: `/projects/${projectId}/quotations/${quotationId}/send`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    reviseProjectQuotation: build.mutation<
      Record<string, unknown>,
      { projectId: string; quotationId: string }
    >({
      query: ({ projectId, quotationId }) => ({
        url: `/projects/${projectId}/quotations/${quotationId}/revise`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    acceptProjectQuotation: build.mutation<
      Record<string, unknown>,
      { projectId: string; quotationId: string }
    >({
      query: ({ projectId, quotationId }) => ({
        url: `/projects/${projectId}/quotations/${quotationId}/accept`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectWorkOrders: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/work-orders`,
      providesTags: ['Project'],
    }),
    createProjectWorkOrder: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/work-orders`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    verifyProjectMeasurement: build.mutation<
      Record<string, unknown>,
      { projectId: string; measurementId: string; body?: Record<string, unknown> }
    >({
      query: ({ projectId, measurementId, body }) => ({
        url: `/projects/${projectId}/measurements/${measurementId}/verify`,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['Project'],
    }),
    certifyProjectRaBill: build.mutation<
      Record<string, unknown>,
      { projectId: string; raId: string }
    >({
      query: ({ projectId, raId }) => ({
        url: `/projects/${projectId}/ra-bills/${raId}/certify`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    approveProjectRaBill: build.mutation<
      Record<string, unknown>,
      { projectId: string; raId: string }
    >({
      query: ({ projectId, raId }) => ({
        url: `/projects/${projectId}/ra-bills/${raId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    convertProjectRaToInvoice: build.mutation<
      Record<string, unknown>,
      { projectId: string; raId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, raId, body }) => ({
        url: `/projects/${projectId}/ra-bills/${raId}/convert-invoice`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectInvoices: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/invoices`,
      providesTags: ['Project'],
    }),
    listProjectProformas: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/proformas`,
      providesTags: ['Project'],
    }),
    createProjectProforma: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/proformas`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectVariations: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/variations`,
      providesTags: ['Project'],
    }),
    createProjectVariation: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/variations`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    approveProjectVariation: build.mutation<
      Record<string, unknown>,
      { projectId: string; variationId: string }
    >({
      query: ({ projectId, variationId }) => ({
        url: `/projects/${projectId}/variations/${variationId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectVouchers: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/vouchers`,
      providesTags: ['Project'],
    }),
    createProjectReceipt: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/receipts`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    createProjectVendorPayment: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/vendor-payments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectRetentions: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/retentions`,
      providesTags: ['Project'],
    }),
    releaseProjectRetention: build.mutation<
      Record<string, unknown>,
      { projectId: string; retentionId: string; body?: Record<string, unknown> }
    >({
      query: ({ projectId, retentionId, body }) => ({
        url: `/projects/${projectId}/retentions/${retentionId}/release`,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectRecognition: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/recognition`,
      providesTags: ['Project'],
    }),
    draftProjectRecognition: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/recognition`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    postProjectRecognition: build.mutation<
      Record<string, unknown>,
      { projectId: string; entryId: string }
    >({
      query: ({ projectId, entryId }) => ({
        url: `/projects/${projectId}/recognition/${entryId}/post`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    approveProjectRecognition: build.mutation<
      Record<string, unknown>,
      { projectId: string; entryId: string }
    >({
      query: ({ projectId, entryId }) => ({
        url: `/projects/${projectId}/recognition/${entryId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectReconciliations: build.query<Record<string, unknown>[], string>({
      query: (id) => `/projects/${id}/reconciliations`,
      providesTags: ['Project'],
    }),
    createProjectReconciliation: build.mutation<
      Record<string, unknown>,
      { projectId: string; body: Record<string, unknown> }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/reconciliations`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Project'],
    }),
    listProjectHistory: build.query<
      Record<string, unknown>[],
      string | { id: string; limit?: number }
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const limit = typeof arg === 'string' ? undefined : arg.limit;
        return {
          url: `/projects/${id}/history`,
          params: limit ? { limit } : undefined,
        };
      },
      providesTags: ['Project'],
    }),

    // Production
    productionHealth: build.query<Record<string, unknown>, void>({
      query: () => '/production/health',
      providesTags: ['Production'],
    }),
    productionOverview: build.query<Record<string, unknown>, void>({
      query: () => '/production/overview',
      providesTags: ['Production', 'Recipe', 'Batch'],
    }),
    listRecipes: build.query<Record<string, unknown>[], { active_only?: boolean } | void>({
      query: (args) => ({ url: '/production/recipes', params: args || undefined }),
      providesTags: ['Recipe'],
    }),
    getRecipe: build.query<Record<string, unknown>, string>({
      query: (id) => `/production/recipes/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Recipe', id }],
    }),
    createRecipe: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/production/recipes', method: 'POST', body }),
      invalidatesTags: ['Recipe', 'Production'],
    }),
    updateRecipe: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/production/recipes/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Recipe', 'Production'],
    }),
    deleteRecipe: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/production/recipes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Recipe', 'Production'],
    }),
    listBatches: build.query<Record<string, unknown>[], { status?: string } | void>({
      query: (args) => ({ url: '/production/batches', params: args || undefined }),
      providesTags: ['Batch'],
    }),
    getBatch: build.query<Record<string, unknown>, string>({
      query: (id) => `/production/batches/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Batch', id }],
    }),
    createBatch: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/production/batches', method: 'POST', body }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    updateBatch: build.mutation<
      Record<string, unknown>,
      {
        id: string;
        body: {
          issues?: { id: string; qty?: number; location_id?: string }[];
          outputs?: {
            id: string;
            qty?: number;
            location_id?: string;
            nrv_rate?: number;
            allocation_pct?: number;
          }[];
          notes?: string;
        };
      }
    >({
      query: ({ id, body }) => ({ url: `/production/batches/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    completeBatch: build.mutation<
      Record<string, unknown>,
      { id: string; body?: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/production/batches/${id}/complete`,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    postBatch: build.mutation<
      Record<string, unknown>,
      { id: string; body?: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/production/batches/${id}/post`,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    unpostBatch: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/production/batches/${id}/unpost`, method: 'POST' }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    cancelBatch: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/production/batches/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    completeBatchStage: build.mutation<
      Record<string, unknown>,
      { batchId: string; stage_id: string; notes?: string }
    >({
      query: ({ batchId, stage_id, notes }) => ({
        url: `/production/batches/${batchId}/complete-stage`,
        method: 'POST',
        body: { stage_id, notes: notes || undefined },
      }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    addBatchCost: build.mutation<
      Record<string, unknown>,
      {
        batchId: string;
        body: {
          cost_type: string;
          amount: number;
          activity_id?: string;
          account_id?: string;
          description?: string;
        };
      }
    >({
      query: ({ batchId, body }) => ({
        url: `/production/batches/${batchId}/costs`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    removeBatchCost: build.mutation<Record<string, unknown>, { batchId: string; costId: string }>({
      query: ({ batchId, costId }) => ({
        url: `/production/batches/${batchId}/costs/${costId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Batch', 'Production'],
    }),
    productionDayBook: build.query<
      Record<string, unknown>[],
      { start_date?: string; end_date?: string } | void
    >({
      query: (args) => ({ url: '/production/day-book', params: args || undefined }),
      providesTags: ['Production', 'Batch'],
    }),
    productionMargins: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({ url: '/production/margins', params: args || undefined }),
      providesTags: ['Production', 'Batch'],
    }),
    productionYield: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({ url: '/production/yield', params: args || undefined }),
      providesTags: ['Production', 'Batch'],
    }),
    productionProfitabilitySummary: build.query<
      Record<string, unknown>,
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({
        url: '/production/profitability/summary',
        params: args || undefined,
      }),
      providesTags: ['Production', 'Batch'],
    }),
    productionRecipeScorecards: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({
        url: '/production/profitability/recipes',
        params: args || undefined,
      }),
      providesTags: ['Production', 'Batch', 'Recipe'],
    }),
    productionMaterialVariance: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({
        url: '/production/profitability/material-variance',
        params: args || undefined,
      }),
      providesTags: ['Production', 'Batch'],
    }),
    productionProductProfitability: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({
        url: '/production/profitability/products',
        params: args || undefined,
      }),
      providesTags: ['Production', 'Batch'],
    }),
    productionCostTrend: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({
        url: '/production/profitability/cost-trend',
        params: args || undefined,
      }),
      providesTags: ['Production', 'Batch'],
    }),
    productionRmConsumption: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({
        url: '/production/profitability/rm-consumption',
        params: args || undefined,
      }),
      providesTags: ['Production', 'Batch'],
    }),
    productionWipAging: build.query<
      Record<string, unknown>[],
      {
        start_date?: string;
        end_date?: string;
        recipe_id?: string;
        location_id?: string;
      } | void
    >({
      query: (args) => ({
        url: '/production/profitability/wip',
        params: args || undefined,
      }),
      providesTags: ['Production', 'Batch'],
    }),
    productionReportsCatalog: build.query<
      { reports: { id: string; title: string; category: string }[]; report_types: string[] },
      void
    >({
      query: () => '/production/reports/catalog',
      providesTags: ['Production'],
    }),
    runProductionReport: build.mutation<
      Record<string, unknown>,
      { report_id?: string; report_type?: string; filters?: Record<string, unknown> }
    >({
      query: (body) => ({ url: '/production/reports/run', method: 'POST', body }),
    }),
    getProductionSettings: build.query<Record<string, unknown>, void>({
      query: () => '/production/settings',
      providesTags: ['Settings', 'Production'],
    }),
    updateProductionSettings: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/production/settings', method: 'PATCH', body }),
      invalidatesTags: ['Settings', 'Production'],
    }),

    // Migration
    listMigrationEntities: build.query<{ entities: string[] }, void>({
      query: () => '/migration/entities',
    }),
    getMigrationTemplate: build.query<{ entity: string; csv: string }, string>({
      query: (entity) => `/migration/templates/${encodeURIComponent(entity)}`,
    }),
    listMigrationProfiles: build.query<
      Record<string, unknown>[],
      { entity?: string } | void
    >({
      query: (args) => ({
        url: '/migration/profiles',
        params: args && 'entity' in args && args.entity ? { entity: args.entity } : undefined,
      }),
      providesTags: ['MigrationBatch'],
    }),
    saveMigrationProfile: build.mutation<
      Record<string, unknown>,
      { entity: string; name: string; mapping: Record<string, string> }
    >({
      query: (body) => ({ url: '/migration/profiles', method: 'POST', body }),
      invalidatesTags: ['MigrationBatch'],
    }),
    parseMigration: build.mutation<
      { upload_id: string; filename: string; row_count: number; columns: string[] },
      { filename: string; content_base64: string }
    >({
      query: (body) => ({ url: '/migration/parse', method: 'POST', body }),
    }),
    suggestMigrationMapping: build.mutation<
      { entity: string; mapping: Record<string, string>; missing_required: string[] },
      { entity: string; upload_id: string }
    >({
      query: ({ entity, upload_id }) => ({
        url: '/migration/suggest-mapping',
        method: 'POST',
        params: { entity, upload_id },
      }),
    }),
    previewMigration: build.mutation<
      {
        entity_type: string;
        total_rows: number;
        valid_rows: number;
        can_import: boolean;
        issues: { row: number; message: string; field: string }[];
      },
      { upload_id: string; entity: string; mapping: Record<string, string> }
    >({
      query: (body) => ({ url: '/migration/preview', method: 'POST', body }),
    }),
    runMigration: build.mutation<
      {
        entity_type: string;
        created: number;
        updated: number;
        skipped: number;
        failed: number;
        issues: { row: number; message: string; field: string }[];
      },
      {
        upload_id: string;
        entity: string;
        mapping: Record<string, string>;
        duplicate_policy: 'skip' | 'update' | 'fail' | 'import_as_separate' | 'link_to_customer';
      }
    >({
      query: (body) => ({ url: '/migration/run', method: 'POST', body }),
      invalidatesTags: ['MigrationBatch'],
    }),
    listMigrationBatches: build.query<Record<string, unknown>[], void>({
      query: () => '/migration/batches',
      providesTags: ['MigrationBatch'],
    }),
    createMigrationBatch: build.mutation<
      Record<string, unknown>,
      { source: string; entity: string; upload_id?: string; mapping?: Record<string, string> }
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
    listSystemSettings: build.query<Record<string, unknown>[], void>({
      query: () => '/system/settings',
      providesTags: ['SystemSetting'],
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
    systemUpdates: build.query<Record<string, unknown>, void>({
      query: () => '/system/updates',
      providesTags: ['SystemSetting'],
    }),
    checkSystemUpdates: build.mutation<Record<string, unknown>, void>({
      query: () => ({ url: '/system/updates/check', method: 'POST' }),
      invalidatesTags: ['SystemSetting'],
    }),
    installSystemUpdates: build.mutation<Record<string, unknown>, void>({
      query: () => ({ url: '/system/updates/install', method: 'POST' }),
      invalidatesTags: ['SystemSetting'],
    }),
    listSystemLogs: build.query<Record<string, unknown>[], void>({
      query: () => '/system/logs',
      providesTags: ['SystemSetting'],
    }),
    accessHealth: build.query<Record<string, unknown>, void>({
      query: () => '/access/health',
      providesTags: ['AccessUser'],
    }),
    listAccessUsers: build.query<Record<string, unknown>[], void>({
      query: () => '/access/users',
      providesTags: ['AccessUser'],
    }),
    getAccessUser: build.query<Record<string, unknown>, string>({
      query: (id) => `/access/users/${id}`,
      providesTags: ['AccessUser'],
    }),
    createAccessUser: build.mutation<
      Record<string, unknown>,
      {
        username: string;
        display_name?: string;
        password: string;
        role_ids?: string[];
        location_ids?: string[];
      }
    >({
      query: (body) => ({ url: '/access/users', method: 'POST', body }),
      invalidatesTags: ['AccessUser', 'AccessAudit'],
    }),
    updateAccessUser: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/access/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['AccessUser', 'AccessAudit'],
    }),
    setAccessUserPassword: build.mutation<Record<string, unknown>, { id: string; password: string }>({
      query: ({ id, password }) => ({
        url: `/access/users/${id}/password`,
        method: 'POST',
        body: { password },
      }),
      invalidatesTags: ['AccessUser', 'AccessAudit'],
    }),
    listAccessRoles: build.query<Record<string, unknown>[], void>({
      query: () => '/access/roles',
      providesTags: ['AccessRole'],
    }),
    getAccessRole: build.query<Record<string, unknown>, string>({
      query: (id) => `/access/roles/${id}`,
      providesTags: ['AccessRole'],
    }),
    createAccessRole: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/access/roles', method: 'POST', body }),
      invalidatesTags: ['AccessRole', 'AccessAudit'],
    }),
    updateAccessRole: build.mutation<
      Record<string, unknown>,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({ url: `/access/roles/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['AccessRole', 'AccessAudit'],
    }),
    getAccessPermissions: build.query<Record<string, unknown>, void>({
      query: () => '/access/permissions',
      providesTags: ['AccessPermission'],
    }),
    listAccessPlans: build.query<Record<string, unknown>[], void>({
      query: () => '/access/plans',
      providesTags: ['AccessPlan'],
    }),
    createAccessPlan: build.mutation<Record<string, unknown>, Record<string, unknown>>({
      query: (body) => ({ url: '/access/plans', method: 'POST', body }),
      invalidatesTags: ['AccessPlan', 'AccessAudit'],
    }),
    listAccessFeatureFlags: build.query<Record<string, unknown>[], void>({
      query: () => '/access/feature-flags',
      providesTags: ['AccessFlag'],
    }),
    setAccessFeatureFlag: build.mutation<
      Record<string, unknown>,
      { key: string; enabled: boolean }
    >({
      query: ({ key, enabled }) => ({
        url: `/access/feature-flags/${key}`,
        method: 'PUT',
        body: { enabled },
      }),
      invalidatesTags: ['AccessFlag', 'AccessAudit'],
    }),
    listAccessAuditLogs: build.query<Record<string, unknown>[], void>({
      query: () => '/access/audit-logs',
      providesTags: ['AccessAudit'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetSetupStatusQuery,
  useCompleteSetupMutation,
  useGetOrgEntitlementQuery,
  useSetOrgModulesMutation,
  useMeQuery,
  useGetWorkingLocationQuery,
  useSetWorkingLocationMutation,
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useVerifyLicenseMutation,
  useLicenseStatusQuery,
  useRenewLicenseMutation,
  useGetFlagsQuery,
  useHomeDashboardQuery,
  useHomeMtdQuery,
  useReportsCatalogQuery,
  useGetPrefsQuery,
  usePutPrefsMutation,
  useSettingsHealthQuery,
  useGetBusinessProfileQuery,
  useUpdateBusinessProfileMutation,
  useGetPrintSettingsQuery,
  useUpdatePrintSettingsMutation,
  useGetKeyboardShortcutsQuery,
  useUpdateKeyboardShortcutsMutation,
  useListSettingsActivitiesQuery,
  useCreateSettingsActivityMutation,
  useListSettingsStoreActivitiesQuery,
  useCreateSettingsStoreActivityMutation,
  useListSettingsProjectActivitiesQuery,
  useCreateSettingsProjectActivityMutation,
  useListMeasurementSpecsQuery,
  useCreateMeasurementSpecMutation,
  useUpdateMeasurementSpecMutation,
  useDeleteMeasurementSpecMutation,
  useListVendorServicesQuery,
  useCreateVendorServiceMutation,
  useUpdateVendorServiceMutation,
  useListDiscountRulesQuery,
  useCreateDiscountRuleMutation,
  useUpdateDiscountRuleMutation,
  useDeleteDiscountRuleMutation,
  useGetProductionSettingsStubQuery,
  useListCustomersQuery,
  useLazyListCustomersQuery,
  useLookupCustomerByPhoneQuery,
  useLazyLookupCustomerByPhoneQuery,
  useGetCustomerIdentityPolicyQuery,
  useCreateCustomerMutation,
  useGetCustomerQuery,
  useUpdateCustomerMutation,
  useBlacklistCustomerMutation,
  useGetCustomerSummaryQuery,
  useSettleCustomerMutation,
  useRefundCustomerMutation,
  useGetSalesCustomerRelatedSummaryQuery,
  useGetSalesCustomerProductHistoryQuery,
  useGetBoutiqueCustomerRelatedSummaryQuery,
  useGetProjectsCustomerRelatedSummaryQuery,
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
  useListWorkerActivityOptionsQuery,
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
  useSalesHealthQuery,
  useSalesOverviewQuery,
  useListSalesEstimatesQuery,
  useGetSalesEstimateQuery,
  useCreateSalesEstimateMutation,
  useUpdateSalesEstimateMutation,
  useSetSalesEstimateStatusMutation,
  useConvertEstimateToOrderMutation,
  useListSalesQuotationsQuery,
  useGetSalesQuotationQuery,
  useCreateSalesQuotationMutation,
  useUpdateSalesQuotationMutation,
  useSetSalesQuotationStatusMutation,
  useConvertQuotationToOrderMutation,
  useListSalesOrdersQuery,
  useGetSalesOrderQuery,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderMutation,
  useCancelSalesOrderMutation,
  useCloseSalesOrderMutation,
  useConvertSalesOrderToInvoiceMutation,
  useListDeliveryNotesQuery,
  useGetDeliveryNoteQuery,
  useCreateDeliveryNoteMutation,
  useUpdateDeliveryNoteMutation,
  useConfirmDeliveryNoteMutation,
  useDispatchDeliveryNoteMutation,
  useDeliverDeliveryNoteMutation,
  useCancelDeliveryNoteMutation,
  useListSalesInvoicesQuery,
  useGetSalesInvoiceQuery,
  useLazyGetSalesInvoicePdfQuery,
  useCreateSalesInvoiceMutation,
  useUpdateSalesInvoiceMutation,
  useListSalesReturnsQuery,
  useGetSalesReturnQuery,
  useCreateSalesReturnMutation,
  useUpdateSalesReturnMutation,
  useApproveSalesReturnMutation,
  useRejectSalesReturnMutation,
  useSalesReportsCatalogQuery,
  useRunSalesReportMutation,
  usePurchasesHealthQuery,
  usePurchasesOverviewQuery,
  useListPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useLazyGetPurchaseOrderPdfQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useSendPurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useClosePurchaseOrderMutation,
  useListGoodsReceiptsQuery,
  useGetGoodsReceiptQuery,
  useCreateGoodsReceiptMutation,
  useConfirmGoodsReceiptMutation,
  useListPurchaseBillsQuery,
  useGetPurchaseBillQuery,
  useCreatePurchaseBillMutation,
  useUpdatePurchaseBillMutation,
  useDeletePurchaseBillMutation,
  useGetVendorPurchaseRateQuery,
  useLazyGetVendorPurchaseRateQuery,
  useListPurchaseReturnsQuery,
  useGetPurchaseReturnQuery,
  useCreatePurchaseReturnMutation,
  usePurchasesReportsCatalogQuery,
  useRunPurchasesReportMutation,
  useInventoryHealthQuery,
  useCreateStockReserveMutation,
  useInventoryOverviewQuery,
  useListInventoryCategoriesQuery,
  useLazyCheckInventoryCategoryNameQuery,
  useGetInventoryCategoryQuery,
  useCreateInventoryCategoryMutation,
  useUpdateInventoryCategoryMutation,
  useListInventoryCategoryProductsQuery,
  useAddInventoryCategoryProductsMutation,
  useGetInventoryCategorySalesBreakdownQuery,
  useGetInventoryCategoryProductionBreakdownQuery,
  useGetInventoryCategoryCustomizationBreakdownQuery,
  useListInventoryProductsQuery,
  useListCatalogProductsQuery,
  useCreateCatalogProductMutation,
  useGetCatalogProductQuery,
  useUpdateCatalogProductMutation,
  useCreateCatalogSkuMutation,
  useGetCatalogProductSalesBreakdownQuery,
  useGetCatalogProductPurchaseBreakdownQuery,
  useGetCatalogProductProductionBreakdownQuery,
  useGetCatalogProductCustomizationBreakdownQuery,
  useGetCatalogProductSpecInsightsQuery,
  useGetCatalogProductActivityQuery,
  useMergeCatalogProductsMutation,
  useResolveInventoryEntityQuery,
  useListInventorySkusQuery,
  useGetSkuSalesBreakdownQuery,
  useGetSkuPurchaseBreakdownQuery,
  useGetSkuProductionBreakdownQuery,
  useGetSkuCustomizationBreakdownQuery,
  useGetSkuActivityQuery,
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
  useUpdateInventoryLocationMutation,
  useDeleteInventoryLocationMutation,
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
  useDeleteFinanceAccountMutation,
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
  useBoutiqueHealthQuery,
  useBoutiqueOverviewQuery,
  useListBoutiqueActivitiesQuery,
  useListBoutiqueOrdersQuery,
  useGetBoutiqueOrderQuery,
  useCreateBoutiqueOrderMutation,
  usePatchBoutiqueOrderMutation,
  useConfirmBoutiqueOrderMutation,
  useCancelBoutiqueOrderMutation,
  useCompleteBoutiqueOrderMutation,
  useAddBoutiqueOrderItemMutation,
  useUpdateBoutiqueOrderItemMutation,
  useRemoveBoutiqueOrderItemMutation,
  useGetBoutiqueOrderCreditBalanceQuery,
  useApplyBoutiqueOrderCreditAdvanceMutation,
  useListBoutiqueItemAttachmentsQuery,
  useUploadBoutiqueItemAttachmentMutation,
  useDeleteBoutiqueAttachmentMutation,
  useLazyGetBoutiqueItemPdfQuery,
  useLazyGetBoutiqueAdvanceReceiptPdfQuery,
  useCompleteBoutiqueActivityMutation,
  useSkipBoutiqueActivityMutation,
  useAddBoutiqueItemActivityMutation,
  useRemoveBoutiqueItemActivityMutation,
  useRecordBoutiqueAdvanceMutation,
  useListBoutiqueOrderInvoicesQuery,
  useCreateBoutiqueOrderInvoiceMutation,
  useListBoutiqueOrderDeliveriesQuery,
  useCreateBoutiqueOrderDeliveryMutation,
  useListBoutiqueOrderExpensesQuery,
  useCreateBoutiqueOrderExpenseMutation,
  useGetBoutiqueOrderFinancialsQuery,
  useListBoutiqueOrderVouchersQuery,
  useCreateBoutiqueOrderReceiptMutation,
  useCreateBoutiqueOrderVendorPaymentMutation,
  useCreateBoutiqueOrderRefundMutation,
  useListBoutiqueItemsQuery,
  useGetBoutiqueItemQuery,
  useCreateBoutiqueItemMutation,
  useListBoutiqueMeasurementSpecsQuery,
  useListBoutiqueMeasurementSectionsQuery,
  useListBoutiqueMeasurementsQuery,
  useGetBoutiqueMeasurementQuery,
  useLazyGetBoutiqueMeasurementPdfQuery,
  useLazyGetBoutiqueOrderInvoicePdfQuery,
  useCreateBoutiqueMeasurementMutation,
  useUpdateBoutiqueMeasurementMutation,
  useDeleteBoutiqueMeasurementMutation,
  useListBoutiqueTimeEntriesQuery,
  useGetBoutiqueTimeEntryQuery,
  useCreateBoutiqueTimeEntryMutation,
  useSyncBoutiqueActivityTasksMutation,
  useUpdateBoutiqueTimeEntryMutation,
  useAssignBoutiqueTimeEntryMutation,
  useDeleteBoutiqueTimeEntryMutation,
  useBoutiqueCalendarQuery,
  useBoutiqueReportsCatalogQuery,
  useRunBoutiqueReportMutation,
  useStoreHealthQuery,
  useStoreOverviewQuery,
  useListStoreActivitiesQuery,
  useGetStoreActivityQuery,
  useCreateStoreActivityMutation,
  useUpdateStoreActivityMutation,
  useDeactivateStoreActivityMutation,
  useListStoreTimeEntriesQuery,
  useGetStoreTimeEntryQuery,
  useCreateStoreTimeEntryMutation,
  useUpdateStoreTimeEntryMutation,
  useSetStoreTimeEntryStatusMutation,
  useCompleteStoreTimeEntryMutation,
  useDeleteStoreTimeEntryMutation,
  useBusinessHealthQuery,
  useBusinessOverviewQuery,
  useListBusinessActivitiesQuery,
  useCreateBusinessActivityMutation,
  useUpdateBusinessActivityMutation,
  useDeactivateBusinessActivityMutation,
  useListBusinessTasksQuery,
  useCreateBusinessTaskMutation,
  useUpdateBusinessTaskMutation,
  useAssignBusinessTaskMutation,
  useSetBusinessTaskStatusMutation,
  useCompleteBusinessTaskMutation,
  useDeleteBusinessTaskMutation,
  useListBusinessTimeEntriesQuery,
  useCreateBusinessTimeEntryMutation,
  useDeleteBusinessTimeEntryMutation,
  useCalculateWorkerSalaryMutation,
  usePayWorkerSalaryMutation,
  useListProductionActivitiesQuery,
  useCreateProductionActivityMutation,
  useUpdateProductionActivityMutation,
  useDeactivateProductionActivityMutation,
  useCrmHealthQuery,
  useCrmOverviewQuery,
  useListCrmOwnersQuery,
  useListCrmLeadsQuery,
  useGetCrmLeadQuery,
  useCreateCrmLeadMutation,
  useUpdateCrmLeadMutation,
  useDetectCrmLeadDuplicatesMutation,
  useBulkAssignCrmLeadsMutation,
  useBulkStatusCrmLeadsMutation,
  useImportCrmLeadsDryRunMutation,
  useImportCrmLeadsCommitMutation,
  useAssignCrmLeadMutation,
  useSetCrmLeadStatusMutation,
  useMarkCrmLeadLostMutation,
  useReopenCrmLeadMutation,
  useConvertCrmLeadMutation,
  useGetCrmLeadTimelineQuery,
  useDeleteCrmLeadMutation,
  useRestoreCrmEntityMutation,
  useGetCrmEntityAuditQuery,
  useListCrmEnquiriesQuery,
  useGetCrmEnquiryQuery,
  useCreateCrmEnquiryMutation,
  useUpdateCrmEnquiryMutation,
  useBulkAssignCrmEnquiriesMutation,
  useBulkStatusCrmEnquiriesMutation,
  useCreateCrmQuotationFromEnquiryMutation,
  useDeleteCrmEnquiryMutation,
  useListCrmActivitiesQuery,
  useGetCrmActivityQuery,
  useCreateCrmActivityMutation,
  useUpdateCrmActivityMutation,
  useCompleteCrmActivityMutation,
  useCancelCrmActivityMutation,
  useRescheduleCrmActivityMutation,
  useDeleteCrmActivityMutation,
  useCrmCalendarQuery,
  useCrmReportsCatalogQuery,
  useRunCrmReportMutation,
  useGetCrmSettingsQuery,
  useUpdateCrmSettingsMutation,
  useGetCrmNotificationPreferencesQuery,
  useUpdateCrmNotificationPreferencesMutation,
  usePreviewCrmWhatsappPaymentReminderMutation,
  useGetCrmCollectionsQuery,
  useGetCrmCustomerRelatedQuery,
  useListCrmReportPresetsQuery,
  useCreateCrmReportPresetMutation,
  useDeleteCrmReportPresetMutation,
  useListCrmListViewsQuery,
  useCreateCrmListViewMutation,
  useDeleteCrmListViewMutation,
  useUploadCrmAttachmentMutation,
  useGetCrmAttachmentQuery,
  useLazyGetCrmAttachmentQuery,
  useGetCrmAttachmentMetaQuery,
  useLazyGetCrmAttachmentMetaQuery,
  useDeleteCrmAttachmentMutation,
  useListSchedulerJobsQuery,
  useCreateSchedulerJobMutation,
  useRunSchedulerJobMutation,
  useUpdateSchedulerJobMutation,
  useListSchedulerJobRunsQuery,
  useListScheduledReportsQuery,
  useUpdateScheduledReportMutation,
  useRunScheduledReportMutation,
  useListScheduledReportRunsQuery,
  useProjectsHealthQuery,
  useProjectsOverviewQuery,
  useListProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useGetProjectWorkspaceQuery,
  useListProjectEnquiriesQuery,
  useGetProjectEnquiryQuery,
  useCreateProjectEnquiryMutation,
  useListProjectBoqQuery,
  useCreateProjectBoqItemMutation,
  useListAllProjectMeasurementsQuery,
  useListProjectMeasurementsQuery,
  useCreateProjectMeasurementMutation,
  useListAllProjectRaBillsQuery,
  useListProjectRaBillsQuery,
  useCreateProjectRaBillMutation,
  useListProjectTimeQuery,
  useListProjectDocumentsQuery,
  useListProjectDprQuery,
  useCreateProjectDprMutation,
  useListProjectPortalTokensQuery,
  useCreateProjectPortalTokenMutation,
  useGetProjectSiteMobileQuery,
  useProjectsReportsCatalogQuery,
  useRunProjectsReportMutation,
  useGetProjectsSettingsQuery,
  useGetProjectBudgetQuery,
  useAddProjectBudgetLineMutation,
  useSubmitProjectMeasurementMutation,
  useCertifyProjectMeasurementMutation,
  useSubmitProjectRaBillMutation,
  useCreateProjectExpenseMutation,
  useCreateProjectTimeEntryMutation,
  useUploadProjectDocumentMutation,
  useUpdateProjectEnquiryStatusMutation,
  useStartProjectEnquiryEstimationMutation,
  useMarkProjectEnquiryWonMutation,
  useListProjectActivitiesQuery,
  useCreateProjectActivityMutation,
  useUpdateProjectActivityMutation,
  useGetProjectCostsQuery,
  useListProjectExpensesQuery,
  useGetProjectClosureBlockersQuery,
  useGetProjectProfitabilityQuery,
  useGetProjectAccountingSummaryQuery,
  useListProjectQuotationsQuery,
  useCreateProjectQuotationMutation,
  useSendProjectQuotationMutation,
  useReviseProjectQuotationMutation,
  useAcceptProjectQuotationMutation,
  useListProjectWorkOrdersQuery,
  useCreateProjectWorkOrderMutation,
  useVerifyProjectMeasurementMutation,
  useCertifyProjectRaBillMutation,
  useApproveProjectRaBillMutation,
  useConvertProjectRaToInvoiceMutation,
  useListProjectInvoicesQuery,
  useListProjectProformasQuery,
  useCreateProjectProformaMutation,
  useListProjectVariationsQuery,
  useCreateProjectVariationMutation,
  useApproveProjectVariationMutation,
  useListProjectVouchersQuery,
  useCreateProjectReceiptMutation,
  useCreateProjectVendorPaymentMutation,
  useListProjectRetentionsQuery,
  useReleaseProjectRetentionMutation,
  useListProjectRecognitionQuery,
  useDraftProjectRecognitionMutation,
  usePostProjectRecognitionMutation,
  useApproveProjectRecognitionMutation,
  useListProjectReconciliationsQuery,
  useCreateProjectReconciliationMutation,
  useListProjectHistoryQuery,
  useProductionHealthQuery,
  useProductionOverviewQuery,
  useListRecipesQuery,
  useGetRecipeQuery,
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  useDeleteRecipeMutation,
  useListBatchesQuery,
  useGetBatchQuery,
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useCompleteBatchMutation,
  usePostBatchMutation,
  useUnpostBatchMutation,
  useCancelBatchMutation,
  useCompleteBatchStageMutation,
  useAddBatchCostMutation,
  useRemoveBatchCostMutation,
  useProductionDayBookQuery,
  useProductionMarginsQuery,
  useProductionYieldQuery,
  useProductionProfitabilitySummaryQuery,
  useProductionRecipeScorecardsQuery,
  useProductionMaterialVarianceQuery,
  useProductionProductProfitabilityQuery,
  useProductionCostTrendQuery,
  useProductionRmConsumptionQuery,
  useProductionWipAgingQuery,
  useProductionReportsCatalogQuery,
  useRunProductionReportMutation,
  useGetProductionSettingsQuery,
  useUpdateProductionSettingsMutation,
  useListMigrationEntitiesQuery,
  useGetMigrationTemplateQuery,
  useListMigrationProfilesQuery,
  useSaveMigrationProfileMutation,
  useParseMigrationMutation,
  useSuggestMigrationMappingMutation,
  usePreviewMigrationMutation,
  useRunMigrationMutation,
  useListMigrationBatchesQuery,
  useCreateMigrationBatchMutation,
  useRunMigrationBatchMutation,
  useSystemDiagnosticsQuery,
  useListSystemSettingsQuery,
  useUpsertSystemSettingMutation,
  useSystemUpdatesQuery,
  useCheckSystemUpdatesMutation,
  useInstallSystemUpdatesMutation,
  useListSystemLogsQuery,
  useAccessHealthQuery,
  useListAccessUsersQuery,
  useGetAccessUserQuery,
  useCreateAccessUserMutation,
  useUpdateAccessUserMutation,
  useSetAccessUserPasswordMutation,
  useListAccessRolesQuery,
  useGetAccessRoleQuery,
  useCreateAccessRoleMutation,
  useUpdateAccessRoleMutation,
  useGetAccessPermissionsQuery,
  useListAccessPlansQuery,
  useCreateAccessPlanMutation,
  useListAccessFeatureFlagsQuery,
  useSetAccessFeatureFlagMutation,
  useListAccessAuditLogsQuery,
} = baseApi;
