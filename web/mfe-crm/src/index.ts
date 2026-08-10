export {
  CrmOverviewPage,
  CrmLeadsListPage,
  CrmLeadDetailPage,
  CrmEnquiriesListPage,
  CrmEnquiryDetailPage,
  CrmActivitiesListPage,
  CrmActivityDetailPage,
  CrmCollectionsPage,
  CrmCalendarPage,
  CrmReportsPage,
  CrmScheduledReportsPage,
} from './pages';

export {
  activityEventTitle,
  activityEventTone,
  activityToCalendarEvent,
  crmCalendarRange,
  fromDatetimeLocalValue,
  isOpenActivityStatus,
  slotScheduledAt,
  toDatetimeLocalValue,
} from './calendarHelpers';

export {
  asEntityList,
  asEntityRecord,
  entityCaption,
  entityField,
  entityId,
  formatOutstanding,
  formatOverviewWhen,
} from './overviewHelpers';

export {
  useCrmSettingsCatalogs,
  useCrmFieldVisibility,
  useCrmCan,
  crmPagedItems,
} from './hooks';

export {
  StatusPill,
  crmStatusTone,
  WhatsAppButton,
  buildWhatsAppUrl,
  AttachmentList,
  LocationSelect,
  SectionForm,
  EntityWorkspace,
  parseEntityWorkspaceTab,
  CustomFieldsForm,
} from './components';
export type { CrmStatusPillTone, CrmAttachmentEntityType, EntityWorkspaceTab, CustomFieldDef } from './components';
