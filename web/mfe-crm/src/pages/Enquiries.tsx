import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useBulkAssignCrmEnquiriesMutation,
  useBulkStatusCrmEnquiriesMutation,
  useCreateCrmEnquiryMutation,
  useCreateCrmQuotationFromEnquiryMutation,
  useDeleteCrmEnquiryMutation,
  useGetCrmEnquiryQuery,
  useListCrmActivitiesQuery,
  useListCrmEnquiriesQuery,
  useListCrmLeadsQuery,
  useListCrmOwnersQuery,
  useRestoreCrmEntityMutation,
  useUpdateCrmEnquiryMutation,
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
  BulkActionBar,
  CustomFieldsForm,
  EMPTY_ENQUIRY_COMMERCIAL,
  EnquiryCommercialFieldGroups,
  KanbanBoard,
  SavedListViewsBar,
  SectionForm,
  StatusPill,
  TimelineComposer,
  WhatsAppButton,
  enquiryCommercialPayload,
  parseEntityWorkspaceTab,
  type EnquiryCommercialValues,
  type EntityWorkspaceTab,
} from '../components';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../calendarHelpers';
import { crmDetailPath } from '../collectionsAging';
import { crmPagedItems, useCrmCan, useCrmFieldVisibility, useCrmSettingsCatalogs } from '../hooks';
import {
  CRM_DATE_RANGE_FIELDS,
  DEFAULT_ENQUIRY_FILTERS,
  DEFAULT_ENQUIRY_SORT,
  mergeAppliedFilters,
  sortQueryParams,
} from '../listHelpers';
import { asCaption, downloadCsv, extractError } from '../utils';

const FALLBACK_ENQUIRY_STATUSES = ['Open', 'In Progress', 'Won', 'Lost', 'Closed'];

const LIFECYCLE_CHIPS = [
  { id: 'active', label: 'Active' },
  { id: 'deleted', label: 'Deleted' },
] as const;

type EnquiryRow = Record<string, unknown>;

const ENQUIRY_SORT_OPTIONS = [
  { value: 'party_name', label: 'Party' },
  { value: 'enquiry_number', label: 'Enquiry #' },
  { value: 'created_at', label: 'Created' },
  { value: 'status', label: 'Status' },
];

export function CrmEnquiriesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCrmCan();
  const visibility = useCrmFieldVisibility();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.enquiryStatuses.length
    ? catalogs.enquiryStatuses
    : FALLBACK_ENQUIRY_STATUSES;
  const statusChips = useMemo(
    () => [{ id: 'all', label: 'All' }, ...statuses.map((s) => ({ id: s, label: s }))],
    [statuses],
  );

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...DEFAULT_ENQUIRY_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>([...DEFAULT_ENQUIRY_SORT]);
  const status = filters.status;
  const [lifecycle, setLifecycle] = useState<'active' | 'deleted'>('active');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'board'>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [commercial, setCommercial] = useState<EnquiryCommercialValues>(EMPTY_ENQUIRY_COMMERCIAL);
  const [formError, setFormError] = useState('');

  const showDeleted = lifecycle === 'deleted' && can.deleteEnquiries;

  const listArgs = useMemo(
    () => ({
      status: status || undefined,
      search: search.trim() || undefined,
      assigned_user_id: filters.assigned_user_id || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      ...sortQueryParams(sort),
      page: view === 'board' ? 1 : page,
      page_size: view === 'board' ? 200 : PAGE_SIZE,
      deleted: (showDeleted ? 'only' : 'exclude') as 'only' | 'exclude',
    }),
    [status, search, filters, sort, page, view, showDeleted],
  );

  function openEnquiry(id: string) {
    navigate(crmDetailPath('enquiries', id, { deleted: showDeleted }));
  }

  const { data, isLoading, isFetching, error, refetch } = useListCrmEnquiriesQuery(listArgs);
  const { data: leadsPage } = useListCrmLeadsQuery(
    { page_size: 200 },
    { skip: !can.createEnquiries },
  );
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, {
    skip: !can.assignEnquiries && !can.viewEnquiries,
  });
  const [createEnquiry, createState] = useCreateCrmEnquiryMutation();
  const [bulkAssign, bulkAssignState] = useBulkAssignCrmEnquiriesMutation();
  const [bulkSetStatus, bulkStatusState] = useBulkStatusCrmEnquiriesMutation();
  const [updateEnquiry] = useUpdateCrmEnquiryMutation();

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

  const rows = useMemo(() => crmPagedItems<EnquiryRow>(data), [data]);
  const leads = useMemo(() => crmPagedItems<EnquiryRow>(leadsPage), [leadsPage]);
  const total = Number((data as { total?: number } | undefined)?.total ?? rows.length);
  const pages = view === 'board' ? 1 : Math.max(1, pageCount(total, PAGE_SIZE));
  const pageRows = rows;

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const columns: EntityListColumn<EnquiryRow>[] = useMemo(
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
            aria-label={`Select ${asCaption(row.enquiry_number)}`}
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
        id: 'enquiry',
        header: 'Enquiry',
        render: (row) => {
          const number = displayName(row, ['enquiry_number'], String(row.id));
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
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
        id: 'interest',
        header: 'Interest',
        render: (row) => {
          const interest = String(row.product_interest || '').trim();
          return <span className={interest ? undefined : 'el-muted'}>{interest || '—'}</span>;
        },
      },
      {
        id: 'value',
        header: 'Value',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const value = row.estimated_value;
          if (value == null || value === '') return <span className="el-muted">—</span>;
          return asCaption(value);
        },
      },
    ],
    [pageRows, selected],
  );

  const kanbanColumns = useMemo(() => statuses.map((s) => ({ id: s, label: s })), [statuses]);
  const kanbanCards = useMemo(
    () =>
      rows.map((row) => ({
        id: String(row.id),
        status: String(row.status || statuses[0] || 'Open'),
        title: asCaption(row.enquiry_number || row.party_name || row.id),
        subtitle: [row.party_name, row.product_interest].filter(Boolean).map(String).join(' · '),
      })),
    [rows, statuses],
  );

  function openCreate() {
    setFormError('');
    setLeadId('');
    setCommercial({
      ...EMPTY_ENQUIRY_COMMERCIAL,
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

  async function onCreate() {
    setFormError('');
    try {
      const payload = enquiryCommercialPayload(commercial);
      const row = await createEnquiry({
        lead_id: leadId,
        ...payload,
        expected_decision_at: commercial.expected_decision_at
          ? fromDatetimeLocalValue(commercial.expected_decision_at)
          : null,
        next_follow_up_at: commercial.next_follow_up_at
          ? fromDatetimeLocalValue(commercial.next_follow_up_at)
          : null,
      }).unwrap();
      setOpen(false);
      navigate(`/crm/enquiries/${row.id}`);
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
        enquiry_number: row.enquiry_number,
        party_name: row.party_name,
        status: row.status,
        product_interest: row.product_interest,
        estimated_value: row.estimated_value,
        assigned_user_name: row.assigned_user_name,
        customer_id: row.customer_id,
      }));
    downloadCsv('crm-enquiries.csv', exportRows);
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Enquiries"
        count={`${total} ${total === 1 ? 'enquiry' : 'enquiries'}`}
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
            {can.createEnquiries && !showDeleted ? (
              <Button type="button" onClick={openCreate}>
                New enquiry
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
            placeholder="Search party, status, interest…"
            aria-label="Search enquiries"
          />
        }
        chips={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {can.deleteEnquiries ? (
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
            defaultFilters={DEFAULT_ENQUIRY_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters({ ...DEFAULT_ENQUIRY_FILTERS, ...next, status: filters.status });
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_ENQUIRY_SORT}
            sortOptions={ENQUIRY_SORT_OPTIONS}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      <div style={{ margin: '8px 0 12px' }}>
        <SavedListViewsBar
          entity="enquiry"
          current={{ search, filters, sort }}
          onApply={(viewState) => {
            setSearch(viewState.search);
            setFilters(mergeAppliedFilters(DEFAULT_ENQUIRY_FILTERS, viewState.filters));
            setSort(viewState.sort.length ? viewState.sort : [...DEFAULT_ENQUIRY_SORT]);
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
          statuses={statuses}
          assigneeId={bulkAssignee}
          onAssigneeChange={setBulkAssignee}
          status={bulkStatus}
          onStatusChange={setBulkStatus}
          onAssign={() => void onBulkAssign()}
          onStatus={() => void onBulkStatus()}
          onClear={() => setSelected(new Set())}
          assignDisabled={!can.assignEnquiries}
          statusDisabled={!can.editEnquiries}
          busy={bulkAssignState.isLoading || bulkStatusState.isLoading}
          extra={
            <Button type="button" variant="ghost" onClick={onExportSelected}>
              Export CSV
            </Button>
          }
        />
      ) : null}

      {isLoading && view !== 'board' ? (
        <EntityListLoading>Loading enquiries…</EntityListLoading>
      ) : null}
      {error ? <ErrorText>Failed to load enquiries.</ErrorText> : null}
      {!isLoading && !error && rows.length === 0 && view === 'table' ? (
        <EntityListEmpty>
          <strong>
            {showDeleted
              ? 'No deleted enquiries'
              : search.trim() ||
                  status ||
                  filters.assigned_user_id ||
                  filters.date_from ||
                  filters.date_to
                ? 'No matching enquiries'
                : 'No enquiries yet'}
          </strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && view === 'table' && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => openEnquiry(String(row.id))}
          onNew={can.createEnquiries && !showDeleted ? openCreate : undefined}
          actions={(row) => (
            <EntityListActions onOpen={() => openEnquiry(String(row.id))} />
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
              ? 'No matching enquiries'
              : 'No enquiries yet'
          }
          onOpen={(id) => openEnquiry(id)}
          onMove={
            can.editEnquiries
              ? async (id, nextStatus) => {
                  await updateEnquiry({ id, body: { status: nextStatus } }).unwrap();
                }
              : undefined
          }
        />
      ) : null}

      {!isLoading && !error && view === 'table' && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Drawer
        open={open}
        title="New enquiry"
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
              {createState.isLoading ? 'Saving…' : 'Create'}
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
                  {String(l.name || l.lead_number || l.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <EnquiryCommercialFieldGroups
            values={commercial}
            onChange={(patch) => setCommercial((f) => ({ ...f, ...patch }))}
            visibility={visibility}
            sources={catalogs.leadSources}
            compact
          />
        </div>
      </Drawer>
    </EntityListPage>
  );
}

export function CrmEnquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCrmCan();
  const visibility = useCrmFieldVisibility();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.enquiryStatuses.length
    ? catalogs.enquiryStatuses
    : FALLBACK_ENQUIRY_STATUSES;
  const workspaceTab = parseEntityWorkspaceTab(searchParams.get('tab'));

  const [includeDeleted, setIncludeDeleted] = useState(searchParams.get('deleted') === '1');
  const getArg = includeDeleted ? { id, include_deleted: true } : id;

  const { data, isLoading, error, refetch, isError } = useGetCrmEnquiryQuery(getArg, {
    skip: !id,
  });
  const { data: activityPage, refetch: refetchTimeline } = useListCrmActivitiesQuery(
    { enquiry_id: id, page_size: 100 },
    { skip: !id },
  );
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, {
    skip: !can.assignEnquiries && !can.editEnquiries,
  });
  const [updateEnquiry, updateState] = useUpdateCrmEnquiryMutation();
  const [createQuotation, quoteState] = useCreateCrmQuotationFromEnquiryMutation();
  const [deleteEnquiry, deleteState] = useDeleteCrmEnquiryMutation();
  const [restoreEntity, restoreState] = useRestoreCrmEntityMutation();

  const [commercial, setCommercial] = useState<EnquiryCommercialValues>(EMPTY_ENQUIRY_COMMERCIAL);
  const [status, setStatus] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (searchParams.get('deleted') === '1') setIncludeDeleted(true);
  }, [searchParams]);

  useEffect(() => {
    if (isError && can.deleteEnquiries && !includeDeleted) {
      setIncludeDeleted(true);
    }
  }, [isError, can.deleteEnquiries, includeDeleted]);

  useEffect(() => {
    if (!data) return;
    setCommercial({
      party_name: String(data.party_name || ''),
      source: String(data.source || ''),
      product_interest: String(data.product_interest || ''),
      description: String(data.description || ''),
      expected_quantity:
        data.expected_quantity == null || data.expected_quantity === ''
          ? ''
          : String(data.expected_quantity),
      estimated_value: data.estimated_value == null ? '' : String(data.estimated_value),
      priority: String(data.priority || 'Medium'),
      expected_decision_at: toDatetimeLocalValue(
        data.expected_decision_at as string | null | undefined,
      ),
      next_follow_up_at: toDatetimeLocalValue(data.next_follow_up_at as string | null | undefined),
      notes: String(data.notes || ''),
    });
    setStatus(String(data.status || ''));
    setAssignedUserId(String(data.assigned_user_id || ''));
    setCustomFieldValues(
      data.custom_field_values && typeof data.custom_field_values === 'object'
        ? { ...(data.custom_field_values as Record<string, unknown>) }
        : {},
    );
  }, [data]);

  const timelineItems = useMemo(
    () => crmPagedItems<EnquiryRow>(activityPage),
    [activityPage],
  );

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
      const payload = enquiryCommercialPayload(commercial);
      await updateEnquiry({
        id,
        body: {
          ...payload,
          expected_decision_at: commercial.expected_decision_at
            ? fromDatetimeLocalValue(commercial.expected_decision_at)
            : null,
          next_follow_up_at: commercial.next_follow_up_at
            ? fromDatetimeLocalValue(commercial.next_follow_up_at)
            : null,
          status,
          assigned_user_id: assignedUserId,
          assigned_user_name: owners.find((o) => o.id === assignedUserId)?.name || '',
          custom_field_values: customFieldValues,
        },
      }).unwrap();
      setMsg('Saved');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onCreateQuotation() {
    setMsg('');
    try {
      const result = await createQuotation({ enquiry_id: id }).unwrap();
      const quotation = (result.quotation || result) as Record<string, unknown>;
      const qid = String(quotation.id || result.quotation_id || data?.quotation_id || '');
      setMsg('Quotation created');
      refresh();
      if (qid) navigate(`/sales/quotations/${qid}`);
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onDelete() {
    if (!window.confirm('Soft-delete this enquiry?')) return;
    setMsg('');
    try {
      await deleteEnquiry(id).unwrap();
      setMsg('Deleted');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onRestore() {
    setMsg('');
    try {
      await restoreEntity({ entity_type: 'enquiry', entity_id: id }).unwrap();
      setMsg('Restored');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading enquiry…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/crm/enquiries" label="Enquiries" />
        <ErrorText>Enquiry not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const isDeleted = Boolean(data.is_deleted);
  const attachmentIds = Array.isArray(data.attachment_ids)
    ? data.attachment_ids.map(String)
    : [];
  const phone = String(data.phone || data.party_phone || '');
  const ownerName =
    owners.find((o) => o.id === assignedUserId)?.name ||
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
      {phone ? <WhatsAppButton phone={phone} /> : null}
      {can.editEnquiries && !isDeleted ? (
        <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
          {updateState.isLoading ? 'Saving…' : 'Save'}
        </Button>
      ) : null}
      {can.editEnquiries && !isDeleted ? (
        data.customer_id ? (
          <Button
            type="button"
            onClick={() => void onCreateQuotation()}
            disabled={quoteState.isLoading}
          >
            {quoteState.isLoading ? 'Creating…' : 'Create quotation'}
          </Button>
        ) : (
          <Button type="button" disabled title="Link or convert to a customer first">
            Create quotation
          </Button>
        )
      ) : null}
      {can.deleteEnquiries && !isDeleted ? (
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
      <EntityDetailBack to="/crm/enquiries" label="Enquiries" />

      <EntityDetailHero
        kicker="CRM · Enquiry"
        title={asCaption(data.enquiry_number)}
        lead={
          <>
            <StatusPill status={data.status} />
            {data.party_name ? (
              <span className="ed-lead-sep"> · {asCaption(data.party_name)}</span>
            ) : null}
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Enquiry facts"
        items={[
          { label: 'Status', value: asCaption(data.status) || '—' },
          { label: 'Party', value: asCaption(data.party_name) || '—' },
          { label: 'Owner', value: ownerName },
          { label: 'Priority', value: asCaption(data.priority) || '—' },
          { label: 'Next follow-up', value: asCaption(data.next_follow_up_at) || '—' },
        ]}
      />

      {isDeleted ? (
        <EntityDetailBanner>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong>Deleted enquiry</strong>
              <p style={{ margin: '4px 0 0' }}>
                Soft-deleted {asCaption(data.deleted_at) || '—'}. Restore to edit again.
              </p>
            </div>
            {can.deleteEnquiries ? (
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
        ariaLabel="Enquiry sections"
        onChange={(next) => setWorkspaceTab(next as EntityWorkspaceTab)}
        options={tabOptions}
      />

      {activeTab === 'details' ? (
        <EntityDetailPanel key="details" title="Details">
          <div className="crm-ew-details-cols">
            <div className="crm-ew-details-main">
              <EnquiryCommercialFieldGroups
                values={commercial}
                onChange={(patch) => setCommercial((f) => ({ ...f, ...patch }))}
                visibility={visibility}
                sources={catalogs.leadSources}
                disabled={!can.editEnquiries || isDeleted}
              />
              <SectionForm title="Status">
                <FormRow label="Status">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={!can.editEnquiries || isDeleted}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FormRow>
              </SectionForm>
              <SectionForm title="Custom fields">
                <CustomFieldsForm
                  values={customFieldValues}
                  onChange={setCustomFieldValues}
                  disabled={!can.editEnquiries || isDeleted}
                />
              </SectionForm>
            </div>
            <aside className="crm-ew-details-rail">
              <div className="crm-ew-rail-card">
                <h3>Owner</h3>
                <FormRow label="Assignee">
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    disabled={!can.assignEnquiries || isDeleted}
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
                  <span>Expected decision</span>
                  <strong>{asCaption(data.expected_decision_at) || '—'}</strong>
                </div>
                <div className="crm-ew-rail-row">
                  <span>Next follow-up</span>
                  <strong>{asCaption(data.next_follow_up_at) || '—'}</strong>
                </div>
              </div>
              {phone ? (
                <div className="crm-ew-rail-card">
                  <h3>WhatsApp</h3>
                  <WhatsAppButton phone={phone} />
                </div>
              ) : null}
              {data.lead_id ? (
                <div className="crm-ew-rail-card">
                  <h3>Lead</h3>
                  <p style={{ margin: 0 }}>
                    <Link to={`/crm/leads/${String(data.lead_id)}`}>
                      {asCaption(data.lead_id)}
                    </Link>
                  </p>
                </div>
              ) : null}
            </aside>
          </div>
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'timeline' ? (
        <EntityDetailPanel key="timeline" title="Timeline">
          <div className="crm-ew-timeline">
            {!isDeleted && can.createActivities ? (
              <TimelineComposer
                enquiryId={id}
                leadId={data.lead_id ? String(data.lead_id) : undefined}
                onLogged={() => void refresh()}
              />
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
              <h3>Lead</h3>
              {data.lead_id ? (
                <p>
                  <Link to={`/crm/leads/${String(data.lead_id)}`}>
                    {asCaption(data.lead_id)}
                  </Link>
                </p>
              ) : (
                <p className="el-muted">No linked lead.</p>
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
                <div>
                  <p className="el-muted" style={{ marginBottom: 8 }}>
                    Quotation requires a linked customer.
                  </p>
                  {data.lead_id ? (
                    <p style={{ margin: 0 }}>
                      <Link to={`/crm/leads/${String(data.lead_id)}`}>
                        Open lead to convert / link customer
                      </Link>
                    </p>
                  ) : (
                    <p className="el-muted" style={{ margin: 0 }}>
                      No linked lead.
                    </p>
                  )}
                </div>
              )}
            </div>
            {data.quotation_id ? (
              <div className="crm-ew-related-card">
                <h3>Quotation</h3>
                <p>
                  <Link to={`/sales/quotations/${String(data.quotation_id)}`}>
                    {asCaption(data.quotation_id)}
                  </Link>
                </p>
              </div>
            ) : null}
          </div>
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'files' ? (
        <EntityDetailPanel key="files" title="Files">
          <AttachmentList
            entityType="enquiry"
            entityId={id}
            attachmentIds={attachmentIds}
            onChanged={() => void refresh()}
            readOnly={isDeleted || !can.editEnquiries}
          />
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'audit' && can.viewAudit ? (
        <EntityDetailPanel key="audit" title="Audit">
          <AuditPanel entityType="enquiry" entityId={id} />
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/crm/enquiries')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}
