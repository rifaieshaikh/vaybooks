import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCancelCrmActivityMutation,
  useCompleteCrmActivityMutation,
  useCreateCrmActivityMutation,
  useDeleteCrmActivityMutation,
  useGetCrmActivityQuery,
  useListCrmActivitiesQuery,
  useListCrmLeadsQuery,
  useListCrmOwnersQuery,
  useRestoreCrmEntityMutation,
  useUpdateCrmActivityMutation,
} from '@vaybooks/store';
import {
  Button,
  Drawer,
  EntityDetailBack,
  EntityDetailBanner,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityDetailTabs,
  EntityListActions,
  EntityListEmpty,
  EntityListFoot,
  EntityListFilterSort,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  ErrorText,
  FormRow,
  PAGE_SIZE,
  PaginationBar,
  displayName,
  pageCount,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import {
  AttachmentList,
  AuditPanel,
  CustomFieldsForm,
  LocationSelect,
  SavedListViewsBar,
  SectionForm,
  StatusPill,
  parseEntityWorkspaceTab,
  type EntityWorkspaceTab,
} from '../components';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../calendarHelpers';
import { crmDetailPath } from '../collectionsAging';
import { crmPagedItems, useCrmCan, useCrmFieldVisibility, useCrmSettingsCatalogs } from '../hooks';
import {
  CRM_DATE_RANGE_FIELDS,
  DEFAULT_ACTIVITY_FILTERS,
  DEFAULT_ACTIVITY_SORT,
  mergeAppliedFilters,
  sortQueryParams,
} from '../listHelpers';
import { asCaption, extractError } from '../utils';

const FALLBACK_ACTIVITY_TYPES = [
  'Called',
  'Meeting',
  'General Follow-up',
  'WhatsApp Message',
  'Email',
  'Note',
];

const ACTIVITY_STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Cancelled', label: 'Cancelled' },
  { id: 'corrections', label: 'Corrections queue' },
] as const;

const LIFECYCLE_CHIPS = [
  { id: 'active', label: 'Active' },
  { id: 'deleted', label: 'Deleted' },
] as const;

type ActivityRow = Record<string, unknown>;

const ACTIVITY_SORT_OPTIONS = [
  { value: 'activity_type', label: 'Type' },
  { value: 'scheduled_at', label: 'Scheduled' },
  { value: 'created_at', label: 'Created' },
  { value: 'status', label: 'Status' },
  { value: 'party_name', label: 'Party' },
];

export function CrmActivitiesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const visibility = useCrmFieldVisibility();
  const activityTypes = catalogs.activityTypeLabels.length
    ? catalogs.activityTypeLabels
    : FALLBACK_ACTIVITY_TYPES;

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...DEFAULT_ACTIVITY_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>([...DEFAULT_ACTIVITY_SORT]);
  const statusFilter = filters.status;
  const [lifecycle, setLifecycle] = useState<'active' | 'deleted'>('active');
  const [correctionsOnly, setCorrectionsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [activityType, setActivityType] = useState(activityTypes[0] || 'Called');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [scheduledAt, setScheduledAt] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [locationId, setLocationId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [formError, setFormError] = useState('');

  const showDeleted = lifecycle === 'deleted' && can.deleteActivities;

  const listArgs = useMemo(
    () => ({
      status: correctionsOnly || showDeleted ? undefined : statusFilter || undefined,
      search: search.trim() || undefined,
      assigned_user_id: filters.assigned_user_id || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      ...sortQueryParams(sort),
      page,
      page_size: PAGE_SIZE,
      deleted: (showDeleted ? 'only' : 'exclude') as 'only' | 'exclude',
      ...(correctionsOnly
        ? { needs_correction: true as const, origin: 'Automatic' }
        : {}),
    }),
    [statusFilter, search, filters, sort, page, correctionsOnly, showDeleted],
  );

  function openActivity(id: string) {
    navigate(crmDetailPath('activities', id, { deleted: showDeleted }));
  }

  const { data, isLoading, isFetching, error, refetch } = useListCrmActivitiesQuery(listArgs);
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, {
    skip: !can.viewActivities,
  });
  const { data: leadsPage } = useListCrmLeadsQuery(
    { page_size: 200 },
    { skip: !can.createActivities },
  );
  const [createActivity, createState] = useCreateCrmActivityMutation();

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      {
        key: 'assigned_user_id',
        label: 'Owner',
        type: 'select',
        allLabel: 'All owners',
        options: owners.map((o) => ({ value: o.id, label: o.name })),
      },
      ...CRM_DATE_RANGE_FIELDS,
    ],
    [owners],
  );

  const pageRows = useMemo(() => crmPagedItems<ActivityRow>(data), [data]);
  const leads = useMemo(() => crmPagedItems<ActivityRow>(leadsPage), [leadsPage]);
  const total = Number((data as { total?: number } | undefined)?.total ?? pageRows.length);
  const pages = Math.max(1, pageCount(total, PAGE_SIZE));

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const columns: EntityListColumn<ActivityRow>[] = useMemo(
    () => [
      {
        id: 'activity',
        header: 'Activity',
        render: (row) => {
          const type = displayName(row, ['activity_type'], 'Activity');
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{type}</span>
                <span className="el-customer-sub">{asCaption(row.party_name)}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => <StatusPill status={row.status} />,
      },
      {
        id: 'origin',
        header: 'Origin',
        render: (row) => {
          const origin = String(row.origin || '').trim();
          const needs = Boolean(row.needs_correction);
          return (
            <span>
              {origin || '—'}
              {needs ? (
                <span className="el-status-pill el-status-pill--warn" style={{ marginLeft: 6 }}>
                  Needs correction
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'scheduled',
        header: 'Scheduled',
        render: (row) => {
          const scheduled = String(row.scheduled_at || '').trim();
          return <span className={scheduled ? undefined : 'el-muted'}>{scheduled || '—'}</span>;
        },
      },
      {
        id: 'notes',
        header: 'Notes',
        render: (row) => {
          const text = String(row.notes || '').trim();
          return <span className={text ? undefined : 'el-muted'}>{text || '—'}</span>;
        },
      },
    ],
    [],
  );

  function openCreate(prefillCustomerId = '', prefillActivityType = '') {
    setFormError('');
    setLeadId('');
    setCustomerId(prefillCustomerId);
    const preferred = prefillActivityType.trim();
    setActivityType(
      preferred && activityTypes.includes(preferred)
        ? preferred
        : preferred || activityTypes[0] || 'Called',
    );
    setNotes('');
    setPriority('Medium');
    setScheduledAt('');
    setNextFollowUpAt('');
    setNextAction('');
    setLocationId('');
    setDurationMinutes('');
    setOpen(true);
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    const fromQuery = (searchParams.get('customer_id') || '').trim();
    const typeQuery = (searchParams.get('activity_type') || '').trim();
    openCreate(fromQuery, typeQuery);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    next.delete('customer_id');
    next.delete('activity_type');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function onCreate() {
    setFormError('');
    try {
      const duration =
        visibility.appointmentDuration && durationMinutes.trim() !== ''
          ? Number(durationMinutes)
          : undefined;
      const row = await createActivity({
        activity_type: activityType,
        lead_id: leadId,
        ...(customerId ? { customer_id: customerId } : {}),
        notes,
        priority,
        next_action: nextAction,
        location_id: locationId,
        scheduled_at: scheduledAt ? fromDatetimeLocalValue(scheduledAt) : undefined,
        next_follow_up_at: nextFollowUpAt ? fromDatetimeLocalValue(nextFollowUpAt) : undefined,
        ...(duration != null && Number.isFinite(duration)
          ? { duration_minutes: Math.max(0, Math.round(duration)) }
          : {}),
      }).unwrap();
      setOpen(false);
      navigate(`/crm/activities/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Activities"
        count={`${total} ${total === 1 ? 'activity' : 'activities'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            {can.createActivities && !showDeleted ? (
              <Button type="button" onClick={() => openCreate()}>
                Log activity
              </Button>
            ) : null}
          </>
        }
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search type, party, notes…"
            aria-label="Search activities"
          />
        }
        chips={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {can.deleteActivities ? (
              <EntityListQuickFilters
                ariaLabel="Lifecycle"
                value={lifecycle}
                onChange={(id) => {
                  setLifecycle(id === 'deleted' ? 'deleted' : 'active');
                  setCorrectionsOnly(false);
                  setPage(1);
                }}
                options={[...LIFECYCLE_CHIPS]}
              />
            ) : null}
            {!showDeleted ? (
              <EntityListQuickFilters
                ariaLabel="Status"
                value={correctionsOnly ? 'corrections' : statusFilter || 'all'}
                onChange={(id) => {
                  if (id === 'corrections') {
                    setCorrectionsOnly(true);
                    setFilters((prev) => ({ ...prev, status: '' }));
                  } else {
                    setCorrectionsOnly(false);
                    setFilters((prev) => ({ ...prev, status: id === 'all' ? '' : id }));
                  }
                  setPage(1);
                }}
                options={[...ACTIVITY_STATUS_CHIPS]}
              />
            ) : null}
          </div>
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_ACTIVITY_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters({ ...DEFAULT_ACTIVITY_FILTERS, ...next, status: filters.status });
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_ACTIVITY_SORT}
            sortOptions={ACTIVITY_SORT_OPTIONS}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      <div style={{ margin: '8px 0 12px' }}>
        <SavedListViewsBar
          entity="activity"
          current={{ search, filters, sort }}
          onApply={(viewState) => {
            setSearch(viewState.search);
            setFilters(mergeAppliedFilters(DEFAULT_ACTIVITY_FILTERS, viewState.filters));
            setSort(viewState.sort.length ? viewState.sort : [...DEFAULT_ACTIVITY_SORT]);
            setCorrectionsOnly(false);
            setPage(1);
          }}
        />
      </div>
      {isFetching && !isLoading ? (
        <p className="el-muted" style={{ margin: '0 0 8px' }}>
          Refreshing…
        </p>
      ) : null}

      {isLoading ? <EntityListLoading>Loading activities…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load activities.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>
            {showDeleted
              ? 'No deleted activities'
              : search.trim() ||
                  statusFilter ||
                  correctionsOnly ||
                  filters.assigned_user_id ||
                  filters.date_from ||
                  filters.date_to
                ? 'No matching activities'
                : 'No activities yet'}
          </strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => openActivity(String(row.id))}
          onNew={can.createActivities && !showDeleted ? openCreate : undefined}
          actions={(row) => (
            <EntityListActions onOpen={() => openActivity(String(row.id))} />
          )}
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Drawer
        open={open}
        title="Log activity"
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onCreate()}
              disabled={!leadId || createState.isLoading}
            >
              {createState.isLoading ? 'Saving…' : 'Log activity'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Lead">
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              style={{ width: '100%', minWidth: 200 }}
            >
              <option value="">Select lead…</option>
              {leads.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {String(l.name || l.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Type">
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              style={{ width: '100%' }}
            >
              {activityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {['Low', 'Medium', 'High'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Scheduled at">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </FormRow>
          {visibility.appointmentDuration ? (
            <FormRow label="Duration (minutes)">
              <input
                type="number"
                min={0}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 30"
              />
            </FormRow>
          ) : null}
          <FormRow label="Next follow-up">
            <input
              type="datetime-local"
              value={nextFollowUpAt}
              onChange={(e) => setNextFollowUpAt(e.target.value)}
            />
          </FormRow>
          <FormRow label="Next action">
            <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          </FormRow>
          <FormRow label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          <LocationSelect value={locationId} onChange={setLocationId} />
        </div>
      </Drawer>
    </EntityListPage>
  );
}

export function CrmActivityDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const visibility = useCrmFieldVisibility();
  const workspaceTab = parseEntityWorkspaceTab(searchParams.get('tab'));

  const [includeDeleted, setIncludeDeleted] = useState(searchParams.get('deleted') === '1');
  const getArg = includeDeleted ? { id, include_deleted: true } : id;

  const { data, isLoading, error, refetch, isError } = useGetCrmActivityQuery(getArg, {
    skip: !id,
  });
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, { skip: !can.editActivities });
  const [updateActivity, updateState] = useUpdateCrmActivityMutation();
  const [completeActivity, completeState] = useCompleteCrmActivityMutation();
  const [cancelActivity, cancelState] = useCancelCrmActivityMutation();
  const [deleteActivity, deleteState] = useDeleteCrmActivityMutation();
  const [restoreEntity, restoreState] = useRestoreCrmEntityMutation();

  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [nextAction, setNextAction] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [locationId, setLocationId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (searchParams.get('deleted') === '1') setIncludeDeleted(true);
  }, [searchParams]);

  useEffect(() => {
    if (isError && can.deleteActivities && !includeDeleted) {
      setIncludeDeleted(true);
    }
  }, [isError, can.deleteActivities, includeDeleted]);

  useEffect(() => {
    if (!data) return;
    setNotes(String(data.notes || ''));
    setOutcome(String(data.outcome || ''));
    setPriority(String(data.priority || 'Medium'));
    setNextAction(String(data.next_action || ''));
    setScheduledAt(toDatetimeLocalValue(data.scheduled_at as string | null | undefined));
    setNextFollowUpAt(toDatetimeLocalValue(data.next_follow_up_at as string | null | undefined));
    setLocationId(String(data.location_id || ''));
    setDurationMinutes(
      data.duration_minutes != null && data.duration_minutes !== ''
        ? String(data.duration_minutes)
        : '',
    );
    setAssigneeId(String(data.assigned_user_id || ''));
    setCustomFieldValues(
      data.custom_field_values && typeof data.custom_field_values === 'object'
        ? { ...(data.custom_field_values as Record<string, unknown>) }
        : {},
    );
  }, [data]);

  function setWorkspaceTab(next: ReturnType<typeof parseEntityWorkspaceTab>) {
    const params = new URLSearchParams(searchParams);
    if (next === 'details') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  async function onSave() {
    setMsg('');
    try {
      const duration =
        visibility.appointmentDuration && durationMinutes.trim() !== ''
          ? Number(durationMinutes)
          : undefined;
      await updateActivity({
        id,
        body: {
          notes,
          outcome,
          priority,
          next_action: nextAction,
          scheduled_at: scheduledAt ? fromDatetimeLocalValue(scheduledAt) : null,
          next_follow_up_at: nextFollowUpAt ? fromDatetimeLocalValue(nextFollowUpAt) : null,
          location_id: locationId,
          assigned_user_id: assigneeId,
          assigned_user_name: owners.find((o) => o.id === assigneeId)?.name || '',
          custom_field_values: customFieldValues,
          ...(duration != null && Number.isFinite(duration)
            ? { duration_minutes: Math.max(0, Math.round(duration)) }
            : {}),
        },
      }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onMarkCorrected() {
    setMsg('');
    try {
      await updateActivity({
        id,
        body: { needs_correction: false },
      }).unwrap();
      setMsg('Marked corrected');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onComplete() {
    setMsg('');
    try {
      await completeActivity({
        id,
        outcome: outcome || undefined,
        notes: notes || undefined,
      }).unwrap();
      setMsg('Completed');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onCancel() {
    if (!cancelReason.trim()) {
      setMsg('Cancel reason is required');
      return;
    }
    setMsg('');
    try {
      await cancelActivity({ id, reason: cancelReason }).unwrap();
      setMsg('Cancelled');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onDelete() {
    if (!window.confirm('Soft-delete this activity?')) return;
    setMsg('');
    try {
      await deleteActivity(id).unwrap();
      setMsg('Deleted');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onRestore() {
    setMsg('');
    try {
      await restoreEntity({ entity_type: 'activity', entity_id: id }).unwrap();
      setMsg('Restored');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading activity…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/crm/activities" label="Activities" />
        <ErrorText>Activity not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const isDeleted = Boolean(data.is_deleted);
  const isClosed = ['Completed', 'Cancelled'].includes(String(data.status || ''));
  const attachmentIds = Array.isArray(data.attachment_ids)
    ? data.attachment_ids.map(String)
    : [];
  const ownerName =
    owners.find((o) => o.id === assigneeId)?.name ||
    asCaption(data.assigned_user_name) ||
    'Unassigned';

  const tabOptions: { id: EntityWorkspaceTab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'related', label: 'Related' },
    { id: 'files', label: 'Files' },
    ...(can.viewAudit ? [{ id: 'audit' as const, label: 'Audit' }] : []),
  ];
  const activeTab = tabOptions.some((t) => t.id === workspaceTab) ? workspaceTab : 'details';

  const heroActions = (
    <>
      {can.editActivities && !isDeleted ? (
        <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
          {updateState.isLoading ? 'Saving…' : 'Save'}
        </Button>
      ) : null}
      {can.completeActivities && !isClosed && !isDeleted ? (
        <Button
          type="button"
          onClick={() => void onComplete()}
          disabled={completeState.isLoading}
        >
          Complete
        </Button>
      ) : null}
      {can.editActivities && !isClosed && !isDeleted ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => void onCancel()}
          disabled={cancelState.isLoading}
        >
          Cancel
        </Button>
      ) : null}
      {can.deleteActivities && !isDeleted ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => void onDelete()}
          disabled={deleteState.isLoading}
        >
          Delete
        </Button>
      ) : null}
    </>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/crm/activities" label="Activities" />

      <EntityDetailHero
        kicker="CRM · Activity"
        title={asCaption(data.activity_type)}
        lead={
          <>
            <StatusPill status={data.status} />
            {data.scheduled_at ? (
              <span className="ed-lead-sep"> · {asCaption(data.scheduled_at)}</span>
            ) : null}
            <span className="ed-lead-sep"> · {asCaption(data.origin || 'Manual')}</span>
            {data.needs_correction ? (
              <span className="ed-lead-sep">
                {' '}
                · <span className="el-status-pill el-status-pill--warn">Needs correction</span>
              </span>
            ) : null}
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Activity facts"
        items={[
          { label: 'Status', value: asCaption(data.status) || '—' },
          { label: 'Scheduled', value: asCaption(data.scheduled_at) || '—' },
          { label: 'Owner', value: ownerName },
          { label: 'Priority', value: asCaption(priority) || '—' },
          { label: 'Party', value: asCaption(data.party_name) || '—' },
        ]}
      />

      {isDeleted ? (
        <EntityDetailBanner>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong>Deleted activity</strong>
              <p style={{ margin: '4px 0 0' }}>
                Soft-deleted {asCaption(data.deleted_at) || '—'}. Restore to edit again.
              </p>
            </div>
            {can.deleteActivities ? (
              <Button
                type="button"
                onClick={() => void onRestore()}
                disabled={restoreState.isLoading}
              >
                {restoreState.isLoading ? 'Restoring…' : 'Restore'}
              </Button>
            ) : null}
          </div>
        </EntityDetailBanner>
      ) : null}

      {msg ? <p className="crm-ew-msg">{msg}</p> : null}

      <EntityDetailTabs
        value={activeTab}
        ariaLabel="Activity sections"
        onChange={(next) => setWorkspaceTab(next as EntityWorkspaceTab)}
        options={tabOptions}
      />

      {activeTab === 'details' ? (
        <EntityDetailPanel key="details" title="Details">
          <div className="crm-ew-details-cols">
            <div className="crm-ew-details-main">
              <SectionForm title="Details">
                <p style={{ margin: 0 }}>
                  Party: {asCaption(data.party_name)}
                  {data.lead_id ? (
                    <>
                      {' · '}
                      <Link to={`/crm/leads/${String(data.lead_id)}`}>Lead</Link>
                    </>
                  ) : null}
                  {data.enquiry_id ? (
                    <>
                      {' · '}
                      <Link to={`/crm/enquiries/${String(data.enquiry_id)}`}>Enquiry</Link>
                    </>
                  ) : null}
                </p>
                <FormRow label="Priority">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    disabled={!can.editActivities || isDeleted}
                  >
                    {['Low', 'Medium', 'High'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Scheduled at">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    disabled={!can.editActivities || isDeleted}
                  />
                </FormRow>
                {visibility.appointmentDuration ? (
                  <FormRow label="Duration (minutes)">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      disabled={!can.editActivities || isDeleted}
                      placeholder="e.g. 30"
                    />
                  </FormRow>
                ) : null}
                <FormRow label="Next follow-up">
                  <input
                    type="datetime-local"
                    value={nextFollowUpAt}
                    onChange={(e) => setNextFollowUpAt(e.target.value)}
                    disabled={!can.editActivities || isDeleted}
                  />
                </FormRow>
                <FormRow label="Next action">
                  <input
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    disabled={!can.editActivities || isDeleted}
                  />
                </FormRow>
                <FormRow label="Outcome">
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    disabled={!can.editActivities || isDeleted}
                  >
                    <option value="">Select…</option>
                    {catalogs.activityOutcomes.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    style={{ width: '100%' }}
                    disabled={!can.editActivities || isDeleted}
                  />
                </FormRow>
                <CustomFieldsForm
                  values={customFieldValues}
                  onChange={setCustomFieldValues}
                  disabled={!can.editActivities || isDeleted}
                />
                {!isClosed && !isDeleted ? (
                  <FormRow label="Cancel reason">
                    <input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Required when cancelling"
                    />
                  </FormRow>
                ) : null}
                {can.editActivities && !isDeleted && data.needs_correction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void onMarkCorrected()}
                    disabled={updateState.isLoading}
                  >
                    Mark corrected
                  </Button>
                ) : null}
              </SectionForm>
            </div>
            <aside className="crm-ew-details-rail">
              <div className="crm-ew-rail-card">
                <h3>Owner</h3>
                <FormRow label="Assignee">
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    disabled={!can.editActivities || isDeleted}
                  >
                    <option value="">Unassigned</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <div className="crm-ew-rail-row" style={{ marginTop: 10 }}>
                  <span>Current</span>
                  <strong>{ownerName}</strong>
                </div>
              </div>
              <div className="crm-ew-rail-card">
                <h3>Location</h3>
                <LocationSelect
                  value={locationId}
                  onChange={setLocationId}
                  disabled={!can.editActivities || isDeleted}
                  autoSelect={false}
                />
              </div>
              <div className="crm-ew-rail-card">
                <h3>Dates</h3>
                <div className="crm-ew-rail-row">
                  <span>Created</span>
                  <strong>{asCaption(data.created_at) || '—'}</strong>
                </div>
                <div className="crm-ew-rail-row">
                  <span>Updated</span>
                  <strong>{asCaption(data.updated_at) || '—'}</strong>
                </div>
                <div className="crm-ew-rail-row">
                  <span>Scheduled</span>
                  <strong>{asCaption(data.scheduled_at) || '—'}</strong>
                </div>
                <div className="crm-ew-rail-row">
                  <span>Next follow-up</span>
                  <strong>{asCaption(data.next_follow_up_at) || '—'}</strong>
                </div>
              </div>
            </aside>
          </div>
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'related' ? (
        <EntityDetailPanel key="related" title="Related">
          <div className="crm-ew-related-grid">
            <div className="crm-ew-related-card">
              <h3>Lead</h3>
              {data.lead_id ? (
                <p>
                  <Link to={`/crm/leads/${String(data.lead_id)}`}>Open lead</Link>
                </p>
              ) : (
                <p className="el-muted">No linked lead.</p>
              )}
            </div>
            <div className="crm-ew-related-card">
              <h3>Enquiry</h3>
              {data.enquiry_id ? (
                <p>
                  <Link to={`/crm/enquiries/${String(data.enquiry_id)}`}>Open enquiry</Link>
                </p>
              ) : (
                <p className="el-muted">No linked enquiry.</p>
              )}
            </div>
            <div className="crm-ew-related-card">
              <h3>Customer</h3>
              {data.customer_id ? (
                <p>
                  <Link to={`/parties/customers/${String(data.customer_id)}`}>
                    {asCaption(data.customer_name || data.customer_id)}
                  </Link>
                </p>
              ) : (
                <p className="el-muted">No linked customer.</p>
              )}
            </div>
          </div>
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'files' ? (
        <EntityDetailPanel key="files" title="Files">
          <AttachmentList
            entityType="activity"
            entityId={id}
            attachmentIds={attachmentIds}
            onChanged={() => void refetch()}
            readOnly={isDeleted || !can.editActivities}
          />
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'audit' && can.viewAudit ? (
        <EntityDetailPanel key="audit" title="Audit">
          <AuditPanel entityType="activity" entityId={id} />
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/crm/activities')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}
