import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useAssignCrmLeadMutation,
  useBulkAssignCrmLeadsMutation,
  useBulkStatusCrmLeadsMutation,
  useConvertCrmLeadMutation,
  useCreateCrmLeadMutation,
  useDeleteCrmLeadMutation,
  useDetectCrmLeadDuplicatesMutation,
  useGetCrmLeadQuery,
  useGetCrmLeadTimelineQuery,
  useListCrmEnquiriesQuery,
  useListCrmLeadsQuery,
  useListCrmOwnersQuery,
  useMarkCrmLeadLostMutation,
  useReopenCrmLeadMutation,
  useRestoreCrmEntityMutation,
  useSetCrmLeadStatusMutation,
  useUpdateCrmLeadMutation,
} from '@vaybooks/store';
import {
  Button,
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
  Drawer,
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
  BulkActionBar,
  CustomFieldsForm,
  EMPTY_LEAD_COMMERCIAL,
  ImportLeadsModal,
  KanbanBoard,
  LeadCommercialFieldGroups,
  LocationSelect,
  SavedListViewsBar,
  SectionForm,
  StatusPill,
  TimelineComposer,
  WhatsAppButton,
  leadCommercialPayload,
  parseEntityWorkspaceTab,
  type EntityWorkspaceTab,
  type LeadCommercialValues,
} from '../components';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../calendarHelpers';
import { crmDetailPath } from '../collectionsAging';
import { crmPagedItems, useCrmCan, useCrmFieldVisibility, useCrmSettingsCatalogs } from '../hooks';
import {
  CRM_DATE_RANGE_FIELDS,
  DEFAULT_LEAD_FILTERS,
  DEFAULT_LEAD_SORT,
  mergeAppliedFilters,
  sortQueryParams,
} from '../listHelpers';
import { asCaption, downloadCsv, extractError } from '../utils';

const LIFECYCLE_CHIPS = [
  { id: 'active', label: 'Active' },
  { id: 'deleted', label: 'Deleted' },
] as const;

const FALLBACK_LEAD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Follow-up Required',
  'Interested',
  'Not Interested',
  'On Hold',
  'Converted',
  'Lost',
];

type LeadRow = Record<string, unknown>;

const LEAD_SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'created_at', label: 'Created' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'next_follow_up_at', label: 'Next follow-up' },
];

export function CrmLeadsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCrmCan();
  const visibility = useCrmFieldVisibility();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.leadStatuses.length ? catalogs.leadStatuses : FALLBACK_LEAD_STATUSES;
  const statusChips = useMemo(
    () => [{ id: 'all', label: 'All' }, ...statuses.map((s) => ({ id: s, label: s }))],
    [statuses],
  );

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...DEFAULT_LEAD_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>([...DEFAULT_LEAD_SORT]);
  const status = filters.status;
  const [lifecycle, setLifecycle] = useState<'active' | 'deleted'>('active');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'board'>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commercial, setCommercial] = useState<LeadCommercialValues>(EMPTY_LEAD_COMMERCIAL);
  const [formError, setFormError] = useState('');
  const [dupInfo, setDupInfo] = useState<Record<string, unknown> | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const showDeleted = lifecycle === 'deleted' && can.deleteLeads;

  const listArgs = useMemo(
    () => ({
      status: status || undefined,
      search: search.trim() || undefined,
      assigned_user_id: filters.assigned_user_id || undefined,
      priority: filters.priority || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      ...sortQueryParams(sort),
      page: view === 'board' ? 1 : page,
      page_size: view === 'board' ? 200 : PAGE_SIZE,
      deleted: (showDeleted ? 'only' : 'exclude') as 'only' | 'exclude',
    }),
    [status, search, filters, sort, page, view, showDeleted],
  );

  function openLead(id: string) {
    navigate(crmDetailPath('leads', id, { deleted: showDeleted }));
  }

  const { data, isLoading, isFetching, error, refetch } = useListCrmLeadsQuery(listArgs);
  const [createLead, createState] = useCreateCrmLeadMutation();
  const [detectDup] = useDetectCrmLeadDuplicatesMutation();
  const [bulkAssign, bulkAssignState] = useBulkAssignCrmLeadsMutation();
  const [bulkSetStatus, bulkStatusState] = useBulkStatusCrmLeadsMutation();
  const [setLeadStatus] = useSetCrmLeadStatusMutation();

  const { data: owners = [] } = useListCrmOwnersQuery(undefined, {
    skip: !can.assignLeads && !can.viewLeads,
  });

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      {
        key: 'assigned_user_id',
        label: 'Owner',
        type: 'select',
        allLabel: 'All owners',
        options: owners.map((o) => ({ value: o.id, label: o.name })),
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        allLabel: 'All priorities',
        options: [
          { value: 'High', label: 'High' },
          { value: 'Medium', label: 'Medium' },
          { value: 'Low', label: 'Low' },
        ],
      },
      ...CRM_DATE_RANGE_FIELDS,
    ],
    [owners],
  );

  const rows = useMemo(() => crmPagedItems<LeadRow>(data), [data]);
  const total = Number((data as { total?: number } | undefined)?.total ?? rows.length);
  const pages = view === 'board' ? 1 : Math.max(1, pageCount(total, PAGE_SIZE));
  const pageRows = rows;

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const columns: EntityListColumn<LeadRow>[] = useMemo(
    () => [
      {
        id: 'select',
        header: (
          <input
            type="checkbox"
            aria-label="Select all on page"
            checked={pageRows.length > 0 && pageRows.every((r) => selected.has(String(r.id)))}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) pageRows.forEach((r) => next.add(String(r.id)));
              else pageRows.forEach((r) => next.delete(String(r.id)));
              setSelected(next);
            }}
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            aria-label={`Select ${asCaption(row.name)}`}
            checked={selected.has(String(row.id))}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) next.add(String(row.id));
              else next.delete(String(row.id));
              setSelected(next);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: 'lead',
        header: 'Lead',
        render: (row) => {
          const number = displayName(row, ['lead_number'], String(row.id));
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{asCaption(row.name)}</span>
                <span className="el-customer-sub">{number}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'phone',
        header: 'Phone',
        render: (row) => {
          const phoneValue = String(row.phone || '').trim();
          return <span className={phoneValue ? undefined : 'el-muted'}>{phoneValue || '—'}</span>;
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => <StatusPill status={row.status} />,
      },
      {
        id: 'source',
        header: 'Source',
        render: (row) => {
          const value = String(row.source || '').trim();
          return <span className={value ? undefined : 'el-muted'}>{value || '—'}</span>;
        },
      },
      {
        id: 'owner',
        header: 'Owner',
        render: (row) => {
          const value = String(row.assigned_user_name || '').trim();
          return <span className={value ? undefined : 'el-muted'}>{value || '—'}</span>;
        },
      },
    ],
    [pageRows, selected],
  );

  const kanbanColumns = useMemo(
    () => statuses.map((s) => ({ id: s, label: s })),
    [statuses],
  );
  const kanbanCards = useMemo(
    () =>
      rows.map((row) => ({
        id: String(row.id),
        status: String(row.status || statuses[0] || 'New'),
        title: asCaption(row.name),
        subtitle: [row.lead_number, row.phone].filter(Boolean).map(String).join(' · '),
      })),
    [rows, statuses],
  );

  function openCreate() {
    setFormError('');
    setDupInfo(null);
    setAllowDuplicate(false);
    setName('');
    setPhone('');
    setCommercial({
      ...EMPTY_LEAD_COMMERCIAL,
      source: catalogs.leadSources[0] || '',
    });
    setOpen(true);
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function onCreate(forceDuplicate = false) {
    setFormError('');
    try {
      if (!forceDuplicate && !allowDuplicate) {
        const dup = await detectDup({
          name,
          phone,
          email: commercial.email,
          gstin: commercial.gstin,
        }).unwrap();
        if (dup?.is_duplicate) {
          setDupInfo(dup);
          return;
        }
      }
      const row = await createLead({
        name,
        phone,
        ...leadCommercialPayload(commercial),
        allow_duplicate: forceDuplicate || allowDuplicate,
      }).unwrap();
      setOpen(false);
      navigate(`/crm/leads/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onBulkAssign() {
    setBulkMsg('');
    const owner = owners.find((o) => o.id === bulkAssignee);
    try {
      await bulkAssign({
        ids: [...selected],
        assigned_user_id: bulkAssignee,
        assigned_user_name: owner?.name || '',
      }).unwrap();
      setBulkMsg('Assigned');
      setSelected(new Set());
      refetch();
    } catch (e) {
      setBulkMsg(extractError(e));
    }
  }

  async function onBulkStatus() {
    setBulkMsg('');
    try {
      await bulkSetStatus({ ids: [...selected], status: bulkStatus }).unwrap();
      setBulkMsg('Status updated');
      setSelected(new Set());
      refetch();
    } catch (e) {
      setBulkMsg(extractError(e));
    }
  }

  function onExportSelected() {
    const exportRows = pageRows
      .filter((row) => selected.has(String(row.id)))
      .map((row) => ({
        id: row.id,
        lead_number: row.lead_number,
        name: row.name,
        phone: row.phone,
        status: row.status,
        source: row.source,
        assigned_user_name: row.assigned_user_name,
        estimated_value: row.estimated_value,
      }));
    downloadCsv('crm-leads.csv', exportRows);
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Leads"
        count={`${total} ${total === 1 ? 'lead' : 'leads'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <button
              type="button"
              className="el-btn-ghost"
              onClick={() => setView((v) => (v === 'table' ? 'board' : 'table'))}
            >
              {view === 'table' ? 'Board' : 'Table'}
            </button>
            {can.importLeads && !showDeleted ? (
              <button type="button" className="el-btn-ghost" onClick={() => setImportOpen(true)}>
                Import
              </button>
            ) : null}
            {can.createLeads && !showDeleted ? (
              <Button type="button" onClick={openCreate}>
                New lead
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
            placeholder="Search name, phone, status…"
            aria-label="Search leads"
          />
        }
        chips={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {can.deleteLeads ? (
              <EntityListQuickFilters
                ariaLabel="Lifecycle"
                value={lifecycle}
                onChange={(id) => {
                  setLifecycle(id === 'deleted' ? 'deleted' : 'active');
                  setSelected(new Set());
                  setPage(1);
                  if (id === 'deleted') setView('table');
                }}
                options={[...LIFECYCLE_CHIPS]}
              />
            ) : null}
            <EntityListQuickFilters
              ariaLabel="Status"
              value={status || 'all'}
              onChange={(id) => {
                setFilters((prev) => ({ ...prev, status: id === 'all' ? '' : id }));
                setPage(1);
              }}
              options={statusChips}
            />
          </div>
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_LEAD_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters({ ...DEFAULT_LEAD_FILTERS, ...next, status: filters.status });
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_LEAD_SORT}
            sortOptions={LEAD_SORT_OPTIONS}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      <div style={{ margin: '8px 0 12px' }}>
        <SavedListViewsBar
          entity="lead"
          current={{ search, filters, sort }}
          onApply={(viewState) => {
            setSearch(viewState.search);
            setFilters(mergeAppliedFilters(DEFAULT_LEAD_FILTERS, viewState.filters));
            setSort(viewState.sort.length ? viewState.sort : [...DEFAULT_LEAD_SORT]);
            setPage(1);
          }}
        />
      </div>

      {view === 'board' && !showDeleted ? (
        <p className="el-muted" style={{ margin: '0 0 12px' }}>
          Board shows up to 200 records
        </p>
      ) : null}
      {isFetching && !isLoading ? (
        <p className="el-muted" style={{ margin: '0 0 8px' }}>
          Refreshing…
        </p>
      ) : null}

      {bulkMsg ? <p style={{ marginTop: 0 }}>{bulkMsg}</p> : null}
      {!showDeleted ? (
        <BulkActionBar
          selectedCount={selected.size}
          owners={owners}
          statuses={statuses.filter((s) => s !== 'Converted')}
          assigneeId={bulkAssignee}
          onAssigneeChange={setBulkAssignee}
          status={bulkStatus}
          onStatusChange={setBulkStatus}
          onAssign={() => void onBulkAssign()}
          onStatus={() => void onBulkStatus()}
          onClear={() => setSelected(new Set())}
          assignDisabled={!can.assignLeads}
          statusDisabled={!can.editLeads}
          busy={bulkAssignState.isLoading || bulkStatusState.isLoading}
          extra={
            <Button type="button" variant="ghost" onClick={onExportSelected}>
              Export CSV
            </Button>
          }
        />
      ) : null}

      {isLoading && view !== 'board' ? <EntityListLoading>Loading leads…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load leads.</ErrorText> : null}
      {!isLoading && !error && rows.length === 0 && view === 'table' ? (
        <EntityListEmpty>
          <strong>
            {showDeleted
              ? 'No deleted leads'
              : search.trim() ||
                  status ||
                  filters.assigned_user_id ||
                  filters.priority ||
                  filters.date_from ||
                  filters.date_to
                ? 'No matching leads'
                : 'No leads yet'}
          </strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && view === 'table' && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => openLead(String(row.id))}
          onNew={can.createLeads && !showDeleted ? openCreate : undefined}
          actions={(row) => (
            <EntityListActions onOpen={() => openLead(String(row.id))} />
          )}
        />
      ) : null}

      {view === 'board' && !showDeleted && !error ? (
        <KanbanBoard
          columns={kanbanColumns}
          cards={kanbanCards}
          loading={isLoading}
          emptyLabel={
            search.trim() ||
            status ||
            filters.assigned_user_id ||
            filters.date_from ||
            filters.date_to
              ? 'No matching leads'
              : 'No leads yet'
          }
          onOpen={(id) => openLead(id)}
          onMove={
            can.editLeads
              ? async (id, nextStatus) => {
                  await setLeadStatus({ id, status: nextStatus }).unwrap();
                }
              : undefined
          }
        />
      ) : null}

      {!isLoading && !error && view === 'table' && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages || 1)} pageCount={pages || 1} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Drawer
        open={open}
        title="New lead"
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {dupInfo?.is_duplicate ? (
              <Button
                type="button"
                onClick={() => {
                  setAllowDuplicate(true);
                  void onCreate(true);
                }}
                disabled={createState.isLoading}
              >
                Create anyway
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void onCreate(false)}
                disabled={!name.trim() || createState.isLoading}
              >
                {createState.isLoading ? 'Saving…' : 'Create'}
              </Button>
            )}
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          {dupInfo?.is_duplicate ? (
            <ErrorText>
              Possible duplicate
              {dupInfo.lead
                ? ` · existing lead ${asCaption((dupInfo.lead as LeadRow).name)}`
                : ''}
              {dupInfo.customer_name ? ` · customer ${asCaption(dupInfo.customer_name)}` : ''}.
              Confirm to create with allow_duplicate.
            </ErrorText>
          ) : null}
          <FormRow label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormRow>
          <LeadCommercialFieldGroups
            values={commercial}
            onChange={(patch) => setCommercial((f) => ({ ...f, ...patch }))}
            visibility={visibility}
            sources={catalogs.leadSources}
            compact
            showLocation
            locationRequired
            locationAutoSelect
          />
        </div>
      </Drawer>

      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void refetch()}
      />
    </EntityListPage>
  );
}

export function CrmLeadDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCrmCan();
  const visibility = useCrmFieldVisibility();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.leadStatuses.length ? catalogs.leadStatuses : FALLBACK_LEAD_STATUSES;
  const workspaceTab = parseEntityWorkspaceTab(searchParams.get('tab'));

  const [includeDeleted, setIncludeDeleted] = useState(searchParams.get('deleted') === '1');
  const getArg = includeDeleted ? { id, include_deleted: true } : id;

  const { data, isLoading, error, refetch, isError } = useGetCrmLeadQuery(getArg, { skip: !id });
  const { data: timeline = [], refetch: refetchTimeline } = useGetCrmLeadTimelineQuery(id, {
    skip: !id,
  });
  const { data: enquiriesPage } = useListCrmEnquiriesQuery(
    { page_size: 50 },
    { skip: !id || !can.viewEnquiries },
  );
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, {
    skip: !can.assignLeads && !can.editLeads,
  });

  useEffect(() => {
    if (searchParams.get('deleted') === '1') setIncludeDeleted(true);
  }, [searchParams]);

  useEffect(() => {
    if (isError && can.deleteLeads && !includeDeleted) {
      setIncludeDeleted(true);
    }
  }, [isError, can.deleteLeads, includeDeleted]);

  const [updateLead, updateState] = useUpdateCrmLeadMutation();
  const [assignLead, assignState] = useAssignCrmLeadMutation();
  const [setStatus, statusState] = useSetCrmLeadStatusMutation();
  const [markLost, lostState] = useMarkCrmLeadLostMutation();
  const [reopenLead, reopenState] = useReopenCrmLeadMutation();
  const [convertLead, convertState] = useConvertCrmLeadMutation();
  const [deleteLead, deleteState] = useDeleteCrmLeadMutation();
  const [restoreEntity, restoreState] = useRestoreCrmEntityMutation();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commercial, setCommercial] = useState<LeadCommercialValues>(EMPTY_LEAD_COMMERCIAL);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatusValue] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!data) return;
    setName(String(data.name || ''));
    setPhone(String(data.phone || ''));
    setCommercial({
      contact_person: String(data.contact_person || ''),
      alternate_phone: String(data.alternate_phone || ''),
      email: String(data.email || ''),
      address_line1: String(data.address_line1 || ''),
      address_line2: String(data.address_line2 || ''),
      area: String(data.area || ''),
      city: String(data.city || ''),
      state_code: String(data.state_code || ''),
      pincode: String(data.pincode || ''),
      gstin: String(data.gstin || ''),
      estimated_value: data.estimated_value == null || data.estimated_value === ''
        ? ''
        : String(data.estimated_value),
      priority: String(data.priority || 'Medium'),
      source: String(data.source || ''),
      interested_products: String(data.interested_products || ''),
      next_follow_up_at: toDatetimeLocalValue(data.next_follow_up_at as string | null | undefined),
      notes: String(data.notes || ''),
      location_id: String(data.location_id || ''),
    });
    setCustomFieldValues(
      data.custom_field_values && typeof data.custom_field_values === 'object'
        ? { ...(data.custom_field_values as Record<string, unknown>) }
        : {},
    );
    setAssigneeId(String(data.assigned_user_id || ''));
    setStatusValue(String(data.status || ''));
    setLostReason(String(data.lost_reason || ''));
  }, [data]);

  const relatedEnquiries = useMemo(() => {
    const items = crmPagedItems<LeadRow>(enquiriesPage);
    return items.filter((e) => String(e.lead_id || '') === id);
  }, [enquiriesPage, id]);

  function setWorkspaceTab(next: ReturnType<typeof parseEntityWorkspaceTab>) {
    const params = new URLSearchParams(searchParams);
    if (next === 'details') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  async function refresh() {
    await Promise.all([refetch(), refetchTimeline()]);
  }

  async function onSave() {
    setMsg('');
    try {
      const payload = leadCommercialPayload(commercial);
      await updateLead({
        id,
        body: {
          name,
          phone,
          ...payload,
          next_follow_up_at: commercial.next_follow_up_at
            ? fromDatetimeLocalValue(commercial.next_follow_up_at)
            : null,
          custom_field_values: customFieldValues,
        },
      }).unwrap();
      setMsg('Saved');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onAssign() {
    setMsg('');
    const owner = owners.find((o) => o.id === assigneeId);
    try {
      await assignLead({
        id,
        assigned_user_id: assigneeId,
        assigned_user_name: owner?.name || '',
      }).unwrap();
      setMsg('Assigned');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onStatus() {
    setMsg('');
    try {
      await setStatus({ id, status }).unwrap();
      setMsg('Status updated');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onMarkLost() {
    setMsg('');
    try {
      await markLost({ id, reason: lostReason }).unwrap();
      setMsg('Marked lost');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onReopen() {
    setMsg('');
    try {
      await reopenLead(id).unwrap();
      setMsg('Reopened');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onConvert() {
    setMsg('');
    try {
      await convertLead({ id }).unwrap();
      setMsg('Converted to customer');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onDelete() {
    if (!window.confirm('Soft-delete this lead?')) return;
    setMsg('');
    try {
      await deleteLead(id).unwrap();
      setMsg('Deleted');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onRestore() {
    setMsg('');
    try {
      await restoreEntity({ entity_type: 'lead', entity_id: id }).unwrap();
      setMsg('Restored');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading lead…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/crm/leads" label="Leads" />
        <ErrorText>Lead not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const isLost = data.status === 'Lost';
  const isConverted = data.status === 'Converted';
  const isDeleted = Boolean(data.is_deleted);
  const attachmentIds = Array.isArray(data.attachment_ids)
    ? data.attachment_ids.map(String)
    : [];
  const timelineItems = Array.isArray(timeline) ? (timeline as LeadRow[]) : [];
  const ownerName =
    owners.find((o) => o.id === assigneeId)?.name ||
    asCaption(data.assigned_user_name) ||
    'Unassigned';

  const tabOptions: { id: EntityWorkspaceTab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'related', label: 'Related' },
    { id: 'files', label: 'Files' },
    ...(can.viewAudit ? [{ id: 'audit' as const, label: 'Audit' }] : []),
  ];
  const activeTab = tabOptions.some((t) => t.id === workspaceTab) ? workspaceTab : 'details';

  const heroActions = (
    <>
      <WhatsAppButton phone={String(data.phone || '')} />
      {can.editLeads && !isDeleted ? (
        <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
          {updateState.isLoading ? 'Saving…' : 'Save'}
        </Button>
      ) : null}
      {can.convertLeads && !isConverted && !isDeleted ? (
        <Button type="button" onClick={() => void onConvert()} disabled={convertState.isLoading}>
          Convert
        </Button>
      ) : null}
      {can.deleteLeads && !isDeleted ? (
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
      <EntityDetailBack to="/crm/leads" label="Leads" />

      <EntityDetailHero
        kicker="CRM · Lead"
        title={asCaption(data.name)}
        lead={
          <>
            <StatusPill status={data.status} />
            <span className="ed-lead-sep"> · {asCaption(data.lead_number)}</span>
            {data.phone ? <span className="ed-lead-sep"> · {asCaption(data.phone)}</span> : null}
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Lead facts"
        items={[
          { label: 'Status', value: asCaption(data.status) || '—' },
          { label: 'Phone', value: asCaption(data.phone) || '—' },
          { label: 'Owner', value: ownerName },
          { label: 'Priority', value: asCaption(data.priority) || '—' },
          { label: 'Next follow-up', value: asCaption(data.next_follow_up_at) || '—' },
        ]}
      />

      {isDeleted ? (
        <EntityDetailBanner>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong>Deleted lead</strong>
              <p style={{ margin: '4px 0 0' }}>
                Soft-deleted {asCaption(data.deleted_at) || '—'}. Restore to edit again.
              </p>
            </div>
            {can.deleteLeads ? (
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
        ariaLabel="Lead sections"
        onChange={(next) => setWorkspaceTab(next as EntityWorkspaceTab)}
        options={tabOptions}
      />

      {activeTab === 'details' ? (
        <EntityDetailPanel key="details" title="Details">
          <div className="crm-ew-details-cols">
            <div className="crm-ew-details-main">
              <SectionForm title="Details">
                <FormRow label="Name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!can.editLeads || isDeleted}
                  />
                </FormRow>
                <FormRow label="Phone">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!can.editLeads || isDeleted}
                  />
                </FormRow>
              </SectionForm>
              <LeadCommercialFieldGroups
                values={commercial}
                onChange={(patch) => setCommercial((f) => ({ ...f, ...patch }))}
                visibility={visibility}
                sources={catalogs.leadSources}
                disabled={!can.editLeads || isDeleted}
                showLocation={false}
              />
              <SectionForm title="Custom fields">
                <CustomFieldsForm
                  values={customFieldValues}
                  onChange={setCustomFieldValues}
                  disabled={!can.editLeads || isDeleted}
                />
              </SectionForm>
              <SectionForm title="Lifecycle">
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                  <FormRow label="Status">
                    <select
                      value={status}
                      onChange={(e) => setStatusValue(e.target.value)}
                      disabled={!can.editLeads || isConverted || isDeleted}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </FormRow>
                  {can.editLeads && !isConverted && !isDeleted ? (
                    <Button
                      type="button"
                      onClick={() => void onStatus()}
                      disabled={!status || statusState.isLoading}
                    >
                      Update status
                    </Button>
                  ) : null}
                  <FormRow label="Lost reason">
                    <select
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      disabled={isDeleted}
                    >
                      <option value="">Select…</option>
                      {catalogs.lostReasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </FormRow>
                  {can.editLeads && !isConverted && !isDeleted ? (
                    <Button
                      type="button"
                      onClick={() => void onMarkLost()}
                      disabled={lostState.isLoading}
                    >
                      Mark lost
                    </Button>
                  ) : null}
                  {isLost && can.editLeads && !isDeleted ? (
                    <Button
                      type="button"
                      onClick={() => void onReopen()}
                      disabled={reopenState.isLoading}
                    >
                      Reopen
                    </Button>
                  ) : null}
                </div>
              </SectionForm>
            </div>
            <aside className="crm-ew-details-rail">
              <div className="crm-ew-rail-card">
                <h3>Owner</h3>
                <FormRow label="Assignee">
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    disabled={!can.assignLeads || isDeleted}
                  >
                    <option value="">Unassigned</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </FormRow>
                {can.assignLeads && !isDeleted ? (
                  <Button
                    type="button"
                    onClick={() => void onAssign()}
                    disabled={!assigneeId || assignState.isLoading}
                    style={{ marginTop: 8 }}
                  >
                    Assign
                  </Button>
                ) : null}
                <div className="crm-ew-rail-row" style={{ marginTop: 10 }}>
                  <span>Current</span>
                  <strong>{ownerName}</strong>
                </div>
              </div>
              <div className="crm-ew-rail-card">
                <h3>Location</h3>
                <LocationSelect
                  value={commercial.location_id}
                  onChange={(locationId) =>
                    setCommercial((f) => ({ ...f, location_id: locationId }))
                  }
                  disabled={!can.editLeads || isDeleted}
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
                  <span>Next follow-up</span>
                  <strong>{asCaption(data.next_follow_up_at) || '—'}</strong>
                </div>
              </div>
              <div className="crm-ew-rail-card">
                <h3>WhatsApp</h3>
                <WhatsAppButton phone={String(data.phone || '')} />
              </div>
            </aside>
          </div>
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'timeline' ? (
        <EntityDetailPanel key="timeline" title="Timeline">
          <div className="crm-ew-timeline">
            {!isDeleted && can.createActivities ? (
              <TimelineComposer leadId={id} onLogged={() => void refresh()} />
            ) : null}
            {timelineItems.length === 0 ? (
              <p className="el-muted">No activity yet.</p>
            ) : (
              <ul className="crm-ew-timeline-list">
                {timelineItems.map((item) => (
                  <li key={String(item.id)} className="crm-ew-timeline-item">
                    <strong>{asCaption(item.activity_type)}</strong>
                    <div className="crm-ew-timeline-meta">
                      {asCaption(item.status)} · {asCaption(item.scheduled_at || item.activity_at)}
                      {item.notes ? ` — ${asCaption(item.notes)}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'related' ? (
        <EntityDetailPanel key="related" title="Related">
          <div className="crm-ew-related-grid">
            <div className="crm-ew-related-card">
              <h3>Customer</h3>
              {data.customer_id ? (
                <p>
                  <Link to={`/parties/customers/${String(data.customer_id)}`}>
                    {asCaption(data.customer_name || data.customer_id)}
                  </Link>
                </p>
              ) : (
                <p className="el-muted">Not converted yet.</p>
              )}
            </div>
            <div className="crm-ew-related-card">
              <h3>Enquiries</h3>
              {relatedEnquiries.length === 0 ? (
                <p className="el-muted">No linked enquiries.</p>
              ) : (
                <ul>
                  {relatedEnquiries.map((enq) => (
                    <li key={String(enq.id)}>
                      <button
                        type="button"
                        className="el-btn-ghost"
                        onClick={() => navigate(`/crm/enquiries/${enq.id}`)}
                      >
                        {asCaption(enq.enquiry_number || enq.id)} · {asCaption(enq.status)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'files' ? (
        <EntityDetailPanel key="files" title="Files">
          <AttachmentList
            entityType="lead"
            entityId={id}
            attachmentIds={attachmentIds}
            onChanged={() => void refresh()}
            readOnly={isDeleted || !can.editLeads}
          />
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'audit' && can.viewAudit ? (
        <EntityDetailPanel key="audit" title="Audit">
          <AuditPanel entityType="lead" entityId={id} />
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/crm/leads')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}
