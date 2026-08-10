import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  EntityListActions,
  EntityListEmpty,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  ErrorText,
  FormRow,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  displayName,
  pageCount,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import {
  AttachmentList,
  AuditPanel,
  BulkActionBar,
  CustomFieldsForm,
  EntityWorkspace,
  ImportLeadsModal,
  KanbanBoard,
  LocationSelect,
  SectionForm,
  StatusPill,
  WhatsAppButton,
} from '../components';
import { crmPagedItems, useCrmCan, useCrmSettingsCatalogs } from '../hooks';
import { asCaption, extractError } from '../utils';

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

export function CrmLeadsListPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.leadStatuses.length ? catalogs.leadStatuses : FALLBACK_LEAD_STATUSES;
  const statusChips = useMemo(
    () => [{ id: 'all', label: 'All' }, ...statuses.map((s) => ({ id: s, label: s }))],
    [statuses],
  );

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
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
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [locationId, setLocationId] = useState('');
  const [formError, setFormError] = useState('');
  const [dupInfo, setDupInfo] = useState<Record<string, unknown> | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const listArgs = useMemo(
    () => ({
      status: status || undefined,
      search: search.trim() || undefined,
      page: view === 'board' ? 1 : page,
      page_size: view === 'board' ? 200 : PAGE_SIZE,
    }),
    [status, search, page, view],
  );

  const { data, isLoading, error, refetch } = useListCrmLeadsQuery(listArgs);
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, { skip: !can.assignLeads });
  const [createLead, createState] = useCreateCrmLeadMutation();
  const [detectDup] = useDetectCrmLeadDuplicatesMutation();
  const [bulkAssign, bulkAssignState] = useBulkAssignCrmLeadsMutation();
  const [bulkSetStatus, bulkStatusState] = useBulkStatusCrmLeadsMutation();
  const [setLeadStatus] = useSetCrmLeadStatusMutation();

  const rows = useMemo(() => crmPagedItems<LeadRow>(data), [data]);
  const total = Number((data as { total?: number } | undefined)?.total ?? rows.length);
  const pages = view === 'board' ? 1 : Math.max(1, pageCount(total, PAGE_SIZE));
  const pageRows = rows;

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
    setEmail('');
    setSource(catalogs.leadSources[0] || '');
    setLocationId('');
    setOpen(true);
  }

  async function onCreate(forceDuplicate = false) {
    setFormError('');
    try {
      if (!forceDuplicate && !allowDuplicate) {
        const dup = await detectDup({ name, phone, email }).unwrap();
        if (dup?.is_duplicate) {
          setDupInfo(dup);
          return;
        }
      }
      const row = await createLead({
        name,
        phone,
        email,
        source,
        location_id: locationId,
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
            {can.importLeads ? (
              <button type="button" className="el-btn-ghost" onClick={() => setImportOpen(true)}>
                Import
              </button>
            ) : null}
            {can.createLeads ? (
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
          <EntityListQuickFilters
            ariaLabel="Status"
            value={status || 'all'}
            onChange={(id) => {
              setStatus(id === 'all' ? '' : id);
              setPage(1);
            }}
            options={statusChips}
          />
        }
      />

      {bulkMsg ? <p style={{ marginTop: 0 }}>{bulkMsg}</p> : null}
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
      />

      {isLoading ? <EntityListLoading>Loading leads…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load leads.</ErrorText> : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EntityListEmpty>
          <strong>{search.trim() || status ? 'No matching leads' : 'No leads yet'}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && view === 'table' && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          onActivateRow={(row) => navigate(`/crm/leads/${row.id}`)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/crm/leads/${row.id}`)} />
          )}
        />
      ) : null}

      {!isLoading && !error && view === 'board' && rows.length > 0 ? (
        <KanbanBoard
          columns={kanbanColumns}
          cards={kanbanCards}
          onOpen={(id) => navigate(`/crm/leads/${id}`)}
          onMove={
            can.editLeads
              ? async (id, nextStatus) => {
                  await setLeadStatus({ id, status: nextStatus }).unwrap();
                  refetch();
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

      <Modal
        open={open}
        title="New lead"
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
          <FormRow label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormRow>
          <FormRow label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Select…</option>
              {catalogs.leadSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormRow>
          <LocationSelect value={locationId} onChange={setLocationId} required />
        </div>
      </Modal>

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
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.leadStatuses.length ? catalogs.leadStatuses : FALLBACK_LEAD_STATUSES;

  const { data, isLoading, error, refetch } = useGetCrmLeadQuery(id, { skip: !id });
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

  const [updateLead, updateState] = useUpdateCrmLeadMutation();
  const [assignLead, assignState] = useAssignCrmLeadMutation();
  const [setStatus, statusState] = useSetCrmLeadStatusMutation();
  const [markLost, lostState] = useMarkCrmLeadLostMutation();
  const [reopenLead, reopenState] = useReopenCrmLeadMutation();
  const [convertLead, convertState] = useConvertCrmLeadMutation();
  const [deleteLead, deleteState] = useDeleteCrmLeadMutation();
  const [restoreEntity, restoreState] = useRestoreCrmEntityMutation();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    source: '',
    notes: '',
    interested_products: '',
    priority: 'Medium',
    location_id: '',
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatusValue] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm({
      name: String(data.name || ''),
      phone: String(data.phone || ''),
      email: String(data.email || ''),
      source: String(data.source || ''),
      notes: String(data.notes || ''),
      interested_products: String(data.interested_products || ''),
      priority: String(data.priority || 'Medium'),
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

  async function refresh() {
    await Promise.all([refetch(), refetchTimeline()]);
  }

  async function onSave() {
    setMsg('');
    try {
      await updateLead({ id, body: { ...form, custom_field_values: customFieldValues } }).unwrap();
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

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Lead not found.</ErrorText>;

  const isLost = data.status === 'Lost';
  const isConverted = data.status === 'Converted';
  const isDeleted = Boolean(data.is_deleted);
  const attachmentIds = Array.isArray(data.attachment_ids)
    ? data.attachment_ids.map(String)
    : [];

  return (
    <div>
      <p>
        <Link to="/crm/leads">← Leads</Link>
      </p>
      {msg ? <p>{msg}</p> : null}
      {isDeleted ? (
        <p style={{ color: 'var(--vb-color-danger, #b42318)' }}>
          This lead is soft-deleted.
          {can.deleteLeads ? (
            <>
              {' '}
              <Button type="button" onClick={() => void onRestore()} disabled={restoreState.isLoading}>
                Restore
              </Button>
            </>
          ) : null}
        </p>
      ) : null}

      <EntityWorkspace
        title={asCaption(data.name)}
        subtitle={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {asCaption(data.lead_number)} · <StatusPill status={data.status} /> ·{' '}
            {asCaption(data.phone)}
          </span>
        }
        headerActions={
          <>
            <WhatsAppButton phone={String(data.phone || '')} />
            {can.convertLeads && !isConverted && !isDeleted ? (
              <Button type="button" onClick={() => void onConvert()} disabled={convertState.isLoading}>
                Convert
              </Button>
            ) : null}
            {can.deleteLeads && !isDeleted ? (
              <Button type="button" variant="ghost" onClick={() => void onDelete()} disabled={deleteState.isLoading}>
                Delete
              </Button>
            ) : null}
          </>
        }
        details={
          <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
            <SectionForm title="Details">
              <FormRow label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={!can.editLeads || isDeleted}
                />
              </FormRow>
              <FormRow label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  disabled={!can.editLeads || isDeleted}
                />
              </FormRow>
              <FormRow label="Email">
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={!can.editLeads || isDeleted}
                />
              </FormRow>
              <FormRow label="Source">
                <select
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  disabled={!can.editLeads || isDeleted}
                >
                  <option value="">Select…</option>
                  {catalogs.leadSources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Interest">
                <input
                  value={form.interested_products}
                  onChange={(e) => setForm((f) => ({ ...f, interested_products: e.target.value }))}
                  disabled={!can.editLeads || isDeleted}
                />
              </FormRow>
              <FormRow label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  disabled={!can.editLeads || isDeleted}
                >
                  {['Low', 'Medium', 'High'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FormRow>
              <LocationSelect
                value={form.location_id}
                onChange={(location_id) => setForm((f) => ({ ...f, location_id }))}
                disabled={!can.editLeads || isDeleted}
                autoSelect={false}
              />
              <FormRow label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  style={{ width: '100%' }}
                  disabled={!can.editLeads || isDeleted}
                />
              </FormRow>
              <CustomFieldsForm
                values={customFieldValues}
                onChange={setCustomFieldValues}
                disabled={!can.editLeads || isDeleted}
              />
              {can.editLeads && !isDeleted ? (
                <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
                  {updateState.isLoading ? 'Saving…' : 'Save'}
                </Button>
              ) : null}
            </SectionForm>

            <SectionForm title="Owner & status">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                <FormRow label="Owner">
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
                  >
                    Assign
                  </Button>
                ) : null}
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
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
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
                  <Button type="button" onClick={() => void onMarkLost()} disabled={lostState.isLoading}>
                    Mark lost
                  </Button>
                ) : null}
                {isLost && can.editLeads && !isDeleted ? (
                  <Button type="button" onClick={() => void onReopen()} disabled={reopenState.isLoading}>
                    Reopen
                  </Button>
                ) : null}
              </div>
            </SectionForm>

            {can.viewAudit ? <AuditPanel entityType="lead" entityId={id} /> : null}
          </div>
        }
        timeline={
          <section>
            {(Array.isArray(timeline) ? timeline : []).length === 0 ? (
              <p className="el-muted">No activity yet.</p>
            ) : (
              <ol>
                {(timeline as LeadRow[]).map((item) => (
                  <li key={String(item.id)}>
                    <strong>{asCaption(item.activity_type)}</strong> · {asCaption(item.status)} ·{' '}
                    {asCaption(item.scheduled_at || item.activity_at)}
                    {item.notes ? ` — ${asCaption(item.notes)}` : ''}
                  </li>
                ))}
              </ol>
            )}
          </section>
        }
        related={
          <div style={{ display: 'grid', gap: 16 }}>
            {data.customer_id ? (
              <SectionForm title="Customer">
                <p style={{ margin: 0 }}>
                  <Link to={`/parties/customers/${String(data.customer_id)}`}>
                    {asCaption(data.customer_name || data.customer_id)}
                  </Link>
                </p>
              </SectionForm>
            ) : (
              <p className="el-muted">Not converted to a customer yet.</p>
            )}
            <SectionForm title="Enquiries">
              {relatedEnquiries.length === 0 ? (
                <p className="el-muted" style={{ margin: 0 }}>
                  No linked enquiries.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
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
            </SectionForm>
          </div>
        }
        files={
          <AttachmentList
            entityType="lead"
            entityId={id}
            attachmentIds={attachmentIds}
            onChanged={() => void refresh()}
            readOnly={isDeleted || !can.editLeads}
          />
        }
      />
    </div>
  );
}
