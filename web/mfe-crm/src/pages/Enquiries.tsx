import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useBulkAssignCrmEnquiriesMutation,
  useBulkStatusCrmEnquiriesMutation,
  useCreateCrmEnquiryMutation,
  useCreateCrmQuotationFromEnquiryMutation,
  useDeleteCrmEnquiryMutation,
  useGetCrmEnquiryQuery,
  useListCrmEnquiriesQuery,
  useListCrmLeadsQuery,
  useListCrmOwnersQuery,
  useRestoreCrmEntityMutation,
  useUpdateCrmEnquiryMutation,
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
  KanbanBoard,
  SectionForm,
  StatusPill,
  WhatsAppButton,
} from '../components';
import { crmPagedItems, useCrmCan, useCrmSettingsCatalogs } from '../hooks';
import { asCaption, extractError } from '../utils';

const FALLBACK_ENQUIRY_STATUSES = ['Open', 'In Progress', 'Won', 'Lost', 'Closed'];

type EnquiryRow = Record<string, unknown>;

export function CrmEnquiriesListPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.enquiryStatuses.length
    ? catalogs.enquiryStatuses
    : FALLBACK_ENQUIRY_STATUSES;
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
  const [leadId, setLeadId] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const listArgs = useMemo(
    () => ({
      status: status || undefined,
      search: search.trim() || undefined,
      page: view === 'board' ? 1 : page,
      page_size: view === 'board' ? 200 : PAGE_SIZE,
    }),
    [status, search, page, view],
  );

  const { data, isLoading, error, refetch } = useListCrmEnquiriesQuery(listArgs);
  const { data: leadsPage } = useListCrmLeadsQuery(
    { page_size: 200 },
    { skip: !can.createEnquiries },
  );
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, { skip: !can.assignEnquiries });
  const [createEnquiry, createState] = useCreateCrmEnquiryMutation();
  const [bulkAssign, bulkAssignState] = useBulkAssignCrmEnquiriesMutation();
  const [bulkSetStatus, bulkStatusState] = useBulkStatusCrmEnquiriesMutation();
  const [updateEnquiry] = useUpdateCrmEnquiryMutation();

  const rows = useMemo(() => crmPagedItems<EnquiryRow>(data), [data]);
  const leads = useMemo(() => crmPagedItems<EnquiryRow>(leadsPage), [leadsPage]);
  const total = Number((data as { total?: number } | undefined)?.total ?? rows.length);
  const pages = view === 'board' ? 1 : Math.max(1, pageCount(total, PAGE_SIZE));
  const pageRows = rows;

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
    setDescription('');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    try {
      const row = await createEnquiry({
        lead_id: leadId,
        description,
        product_interest: description,
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
            {can.createEnquiries ? (
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
      />

      {isLoading ? <EntityListLoading>Loading enquiries…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load enquiries.</ErrorText> : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EntityListEmpty>
          <strong>{search.trim() || status ? 'No matching enquiries' : 'No enquiries yet'}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && view === 'table' && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          onActivateRow={(row) => navigate(`/crm/enquiries/${row.id}`)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/crm/enquiries/${row.id}`)} />
          )}
        />
      ) : null}

      {!isLoading && !error && view === 'board' && rows.length > 0 ? (
        <KanbanBoard
          columns={kanbanColumns}
          cards={kanbanCards}
          onOpen={(id) => navigate(`/crm/enquiries/${id}`)}
          onMove={
            can.editEnquiries
              ? async (id, nextStatus) => {
                  await updateEnquiry({ id, body: { status: nextStatus } }).unwrap();
                  refetch();
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

      <Modal
        open={open}
        title="New enquiry"
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
          <FormRow label="Interest / notes">
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function CrmEnquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const statuses = catalogs.enquiryStatuses.length
    ? catalogs.enquiryStatuses
    : FALLBACK_ENQUIRY_STATUSES;

  const { data, isLoading, error, refetch } = useGetCrmEnquiryQuery(id, { skip: !id });
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, {
    skip: !can.assignEnquiries && !can.editEnquiries,
  });
  const [updateEnquiry, updateState] = useUpdateCrmEnquiryMutation();
  const [createQuotation, quoteState] = useCreateCrmQuotationFromEnquiryMutation();
  const [deleteEnquiry, deleteState] = useDeleteCrmEnquiryMutation();
  const [restoreEntity, restoreState] = useRestoreCrmEntityMutation();

  const [form, setForm] = useState({
    party_name: '',
    product_interest: '',
    description: '',
    notes: '',
    status: '',
    estimated_value: '',
    priority: 'Medium',
    assigned_user_id: '',
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm({
      party_name: String(data.party_name || ''),
      product_interest: String(data.product_interest || ''),
      description: String(data.description || ''),
      notes: String(data.notes || ''),
      status: String(data.status || ''),
      estimated_value: data.estimated_value == null ? '' : String(data.estimated_value),
      priority: String(data.priority || 'Medium'),
      assigned_user_id: String(data.assigned_user_id || ''),
    });
    setCustomFieldValues(
      data.custom_field_values && typeof data.custom_field_values === 'object'
        ? { ...(data.custom_field_values as Record<string, unknown>) }
        : {},
    );
  }, [data]);

  async function onSave() {
    setMsg('');
    try {
      await updateEnquiry({
        id,
        body: {
          party_name: form.party_name,
          product_interest: form.product_interest,
          description: form.description,
          notes: form.notes,
          status: form.status,
          estimated_value: form.estimated_value === '' ? undefined : Number(form.estimated_value),
          priority: form.priority,
          assigned_user_id: form.assigned_user_id,
          assigned_user_name: owners.find((o) => o.id === form.assigned_user_id)?.name || '',
          custom_field_values: customFieldValues,
        },
      }).unwrap();
      setMsg('Saved');
      refetch();
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
      refetch();
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
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onRestore() {
    setMsg('');
    try {
      await restoreEntity({ entity_type: 'enquiry', entity_id: id }).unwrap();
      setMsg('Restored');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Enquiry not found.</ErrorText>;

  const isDeleted = Boolean(data.is_deleted);
  const attachmentIds = Array.isArray(data.attachment_ids)
    ? data.attachment_ids.map(String)
    : [];
  const phone = String(data.phone || data.party_phone || '');

  return (
    <div>
      <p>
        <Link to="/crm/enquiries">← Enquiries</Link>
      </p>
      {msg ? <p>{msg}</p> : null}
      {isDeleted ? (
        <p style={{ color: 'var(--vb-color-danger, #b42318)' }}>
          This enquiry is soft-deleted.
          {can.deleteEnquiries ? (
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
        title={asCaption(data.enquiry_number)}
        subtitle={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {asCaption(data.party_name)} · <StatusPill status={data.status} />
          </span>
        }
        headerActions={
          <>
            {phone ? <WhatsAppButton phone={phone} /> : null}
            {can.editEnquiries && !isDeleted ? (
              <Button
                type="button"
                onClick={() => void onCreateQuotation()}
                disabled={quoteState.isLoading}
              >
                {quoteState.isLoading ? 'Creating…' : 'Create quotation'}
              </Button>
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
        }
        details={
          <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
            <SectionForm title="Details">
              <FormRow label="Party">
                <input
                  value={form.party_name}
                  onChange={(e) => setForm((f) => ({ ...f, party_name: e.target.value }))}
                  disabled={!can.editEnquiries || isDeleted}
                />
              </FormRow>
              <FormRow label="Interest">
                <input
                  value={form.product_interest}
                  onChange={(e) => setForm((f) => ({ ...f, product_interest: e.target.value }))}
                  disabled={!can.editEnquiries || isDeleted}
                />
              </FormRow>
              <FormRow label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ width: '100%' }}
                  disabled={!can.editEnquiries || isDeleted}
                />
              </FormRow>
              <FormRow label="Estimated value">
                <input
                  value={form.estimated_value}
                  onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value }))}
                  disabled={!can.editEnquiries || isDeleted}
                />
              </FormRow>
              <FormRow label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  disabled={!can.editEnquiries || isDeleted}
                >
                  {['Low', 'Medium', 'High'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  disabled={!can.editEnquiries || isDeleted}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Owner">
                <select
                  value={form.assigned_user_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_user_id: e.target.value }))}
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
              <FormRow label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  style={{ width: '100%' }}
                  disabled={!can.editEnquiries || isDeleted}
                />
              </FormRow>
              <CustomFieldsForm
                values={customFieldValues}
                onChange={setCustomFieldValues}
                disabled={!can.editEnquiries || isDeleted}
              />
              {can.editEnquiries && !isDeleted ? (
                <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
                  {updateState.isLoading ? 'Saving…' : 'Save'}
                </Button>
              ) : null}
            </SectionForm>
            {can.viewAudit ? <AuditPanel entityType="enquiry" entityId={id} /> : null}
          </div>
        }
        related={
          <div style={{ display: 'grid', gap: 12 }}>
            {data.lead_id ? (
              <p style={{ margin: 0 }}>
                Lead:{' '}
                <Link to={`/crm/leads/${String(data.lead_id)}`}>
                  {asCaption(data.lead_id)}
                </Link>
              </p>
            ) : (
              <p className="el-muted">No linked lead.</p>
            )}
            {data.quotation_id ? (
              <p style={{ margin: 0 }}>
                Quotation:{' '}
                <Link to={`/sales/quotations/${String(data.quotation_id)}`}>
                  {asCaption(data.quotation_id)}
                </Link>
              </p>
            ) : null}
            {data.customer_id ? (
              <p style={{ margin: 0 }}>
                Customer:{' '}
                <Link to={`/parties/customers/${String(data.customer_id)}`}>
                  {asCaption(data.customer_name || data.customer_id)}
                </Link>
              </p>
            ) : null}
          </div>
        }
        files={
          <AttachmentList
            entityType="enquiry"
            entityId={id}
            attachmentIds={attachmentIds}
            onChanged={() => void refetch()}
            readOnly={isDeleted || !can.editEnquiries}
          />
        }
      />
    </div>
  );
}
