/** CRM shared React helpers — settings catalogs and permission gates. */

import { useMemo } from 'react';
import { useCan, useGetCrmSettingsQuery } from '@vaybooks/store';

export type CrmCatalogItem = {
  key?: string;
  label: string;
  active?: boolean;
  sort_order?: number;
  outcome_required?: boolean;
  automatic?: boolean;
};

function activeLabels(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object' && (item as CrmCatalogItem).active !== false)
    .map((item) => String((item as CrmCatalogItem).label || '').trim())
    .filter(Boolean);
}

function activeItems(items: unknown): CrmCatalogItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object' && (item as CrmCatalogItem).active !== false)
    .map((item) => item as CrmCatalogItem)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

/** Load CRM settings catalogs for selects/chips. */
export function useCrmSettingsCatalogs() {
  const query = useGetCrmSettingsQuery();
  const data = query.data;

  const catalogs = useMemo(
    () => ({
      leadSources: activeLabels(data?.lead_sources),
      leadStatuses: activeLabels(data?.lead_statuses),
      enquiryStatuses: activeLabels(data?.enquiry_statuses),
      activityTypes: activeItems(data?.activity_types),
      activityTypeLabels: activeLabels(data?.activity_types),
      activityOutcomes: activeLabels(data?.activity_outcomes),
      lostReasons: activeLabels(data?.lost_reasons),
      calendarDragEnabled: data?.calendar_drag_enabled !== false,
      customFieldsEnabled: data?.custom_fields_enabled !== false,
      crmMode: String(data?.crm_mode || 'trade'),
      fieldPacks: (data?.field_packs as Record<string, unknown>) || {},
      customFieldDefs: Array.isArray(data?.custom_field_defs) ? data.custom_field_defs : [],
    }),
    [data],
  );

  return { ...query, catalogs };
}

const MODE_PACK_DEFAULTS: Record<string, string[]> = {
  trade: ['gstin_address', 'sku_interest', 'collections'],
  retail: ['sku_interest'],
  services: ['appointment_duration'],
  boutique: ['appointment_duration'],
  projects: ['project_site', 'gstin_address'],
  light: [],
};

function resolvePackNames(crmMode: string, fieldPacks: unknown): string[] {
  if (Array.isArray(fieldPacks)) {
    return fieldPacks.map((p) => String(p || '').trim()).filter(Boolean);
  }
  if (!fieldPacks || typeof fieldPacks !== 'object') {
    return MODE_PACK_DEFAULTS[crmMode] || MODE_PACK_DEFAULTS.trade;
  }
  const obj = fieldPacks as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return MODE_PACK_DEFAULTS[crmMode] || MODE_PACK_DEFAULTS.trade;
  }
  // Support { pack: true } / { pack: false } / { pack: { enabled: true } }
  return keys.filter((key) => {
    const val = obj[key];
    if (val === false || val === 0 || val === 'false') return false;
    if (val && typeof val === 'object' && 'enabled' in (val as object)) {
      return (val as { enabled?: unknown }).enabled !== false;
    }
    return val !== undefined;
  });
}

/** Pack-aware commercial field visibility for CRM modes. */
export function useCrmFieldVisibility() {
  const { catalogs } = useCrmSettingsCatalogs();
  const crmMode = catalogs.crmMode || 'trade';
  const packs = useMemo(
    () => resolvePackNames(crmMode, catalogs.fieldPacks),
    [crmMode, catalogs.fieldPacks],
  );
  const has = (name: string) => packs.includes(name);

  return {
    gstinAddress: has('gstin_address'),
    skuInterest: has('sku_interest'),
    appointmentDuration: has('appointment_duration'),
    projectSite: has('project_site'),
    collections: has('collections'),
    crmMode,
    packs,
  };
}

/** Permission helpers aligned to entitlements catalog. */
export function useCrmCan() {
  const can = useCan();
  return {
    viewLeads: can('crm.leads.view'),
    createLeads: can('crm.leads.create'),
    editLeads: can('crm.leads.edit'),
    assignLeads: can('crm.leads.assign'),
    convertLeads: can('crm.leads.convert'),
    deleteLeads: can('crm.leads.delete'),
    viewEnquiries: can('crm.enquiries.view'),
    createEnquiries: can('crm.enquiries.create'),
    editEnquiries: can('crm.enquiries.edit'),
    assignEnquiries: can('crm.enquiries.assign'),
    deleteEnquiries: can('crm.enquiries.delete'),
    viewActivities: can('crm.activities.view'),
    createActivities: can('crm.activities.create'),
    editActivities: can('crm.activities.edit'),
    completeActivities: can('crm.activities.complete'),
    deleteActivities: can('crm.activities.delete'),
    viewCalendar: can('crm.calendar.view'),
    viewReports: can('crm.reports.view'),
    exportReports: can('crm.reports.export'),
    viewSettings: can('crm.settings.view'),
    editSettings: can('crm.settings.edit'),
    importLeads: can('crm.import.run'),
    sendWhatsapp: can('crm.reminders.whatsapp.send'),
    viewAudit: can('crm.audit.view'),
    viewCollections:
      can('crm.dashboard.view') ||
      can('crm.balances.view') ||
      can('crm.credit.view') ||
      can('crm.payment_followups.view'),
  };
}

export function crmPagedItems<T extends Record<string, unknown>>(
  data: { items?: T[] } | T[] | undefined | null,
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items as T[];
  return [];
}
