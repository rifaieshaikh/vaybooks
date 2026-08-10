import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  CustomFieldsForm,
  EntityWorkspace,
  LocationSelect,
  SectionForm,
  StatusPill,
} from '../components';
import { crmPagedItems, useCrmCan, useCrmSettingsCatalogs } from '../hooks';
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

type ActivityRow = Record<string, unknown>;

export function CrmActivitiesListPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const activityTypes = catalogs.activityTypeLabels.length
    ? catalogs.activityTypeLabels
    : FALLBACK_ACTIVITY_TYPES;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [correctionsOnly, setCorrectionsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [activityType, setActivityType] = useState(activityTypes[0] || 'Called');
  const [notes, setNotes] = useState('');
  const [locationId, setLocationId] = useState('');
  const [formError, setFormError] = useState('');

  const listArgs = useMemo(
    () => ({
      status: correctionsOnly ? undefined : statusFilter || undefined,
      page,
      page_size: correctionsOnly ? 200 : PAGE_SIZE,
    }),
    [statusFilter, page, correctionsOnly],
  );

  const { data, isLoading, error, refetch } = useListCrmActivitiesQuery(listArgs);
  const { data: leadsPage } = useListCrmLeadsQuery(
    { page_size: 200 },
    { skip: !can.createActivities },
  );
  const [createActivity, createState] = useCreateCrmActivityMutation();

  const allRows = useMemo(() => crmPagedItems<ActivityRow>(data), [data]);
  const leads = useMemo(() => crmPagedItems<ActivityRow>(leadsPage), [leadsPage]);

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      if (correctionsOnly) {
        if (String(row.origin || '') !== 'Automatic') return false;
        if (!row.needs_correction) return false;
      }
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return [row.activity_type, row.party_name, row.status, row.notes, row.origin]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [allRows, correctionsOnly, search]);

  const total = correctionsOnly
    ? filtered.length
    : Number((data as { total?: number } | undefined)?.total ?? filtered.length);
  const pages = Math.max(1, pageCount(total, PAGE_SIZE));
  const pageRows = correctionsOnly
    ? filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE)
    : filtered;

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

  function openCreate() {
    setFormError('');
    setLeadId('');
    setActivityType(activityTypes[0] || 'Called');
    setNotes('');
    setLocationId('');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    try {
      const row = await createActivity({
        activity_type: activityType,
        lead_id: leadId,
        notes,
        location_id: locationId,
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
            {can.createActivities ? (
              <Button type="button" onClick={openCreate}>
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
          <EntityListQuickFilters
            ariaLabel="Status"
            value={correctionsOnly ? 'corrections' : statusFilter || 'all'}
            onChange={(id) => {
              if (id === 'corrections') {
                setCorrectionsOnly(true);
                setStatusFilter('');
              } else {
                setCorrectionsOnly(false);
                setStatusFilter(id === 'all' ? '' : id);
              }
              setPage(1);
            }}
            options={[...ACTIVITY_STATUS_CHIPS]}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading activities…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load activities.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>
            {search.trim() || statusFilter || correctionsOnly
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
          onActivateRow={(row) => navigate(`/crm/activities/${row.id}`)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/crm/activities/${row.id}`)} />
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

      <Modal
        open={open}
        title="Log activity"
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
          <FormRow label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          <LocationSelect value={locationId} onChange={setLocationId} />
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function CrmActivityDetailPage() {
  const { id = '' } = useParams();
  const can = useCrmCan();
  const { catalogs } = useCrmSettingsCatalogs();
  const { data, isLoading, error, refetch } = useGetCrmActivityQuery(id, { skip: !id });
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, { skip: !can.editActivities });
  const [updateActivity, updateState] = useUpdateCrmActivityMutation();
  const [completeActivity, completeState] = useCompleteCrmActivityMutation();
  const [cancelActivity, cancelState] = useCancelCrmActivityMutation();
  const [deleteActivity, deleteState] = useDeleteCrmActivityMutation();
  const [restoreEntity, restoreState] = useRestoreCrmEntityMutation();

  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!data) return;
    setNotes(String(data.notes || ''));
    setOutcome(String(data.outcome || ''));
    setAssigneeId(String(data.assigned_user_id || ''));
    setCustomFieldValues(
      data.custom_field_values && typeof data.custom_field_values === 'object'
        ? { ...(data.custom_field_values as Record<string, unknown>) }
        : {},
    );
  }, [data]);

  async function onSave() {
    setMsg('');
    try {
      await updateActivity({
        id,
        body: {
          notes,
          outcome,
          assigned_user_id: assigneeId,
          assigned_user_name: owners.find((o) => o.id === assigneeId)?.name || '',
          needs_correction: false,
          custom_field_values: customFieldValues,
        },
      }).unwrap();
      setMsg('Saved');
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

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Activity not found.</ErrorText>;

  const isDeleted = Boolean(data.is_deleted);
  const isClosed = ['Completed', 'Cancelled'].includes(String(data.status || ''));
  const attachmentIds = Array.isArray(data.attachment_ids)
    ? data.attachment_ids.map(String)
    : [];

  return (
    <div>
      <p>
        <Link to="/crm/activities">← Activities</Link>
      </p>
      {msg ? <p>{msg}</p> : null}
      {isDeleted ? (
        <p style={{ color: 'var(--vb-color-danger, #b42318)' }}>
          This activity is soft-deleted.
          {can.deleteActivities ? (
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
        title={asCaption(data.activity_type)}
        subtitle={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusPill status={data.status} /> · {asCaption(data.scheduled_at)} ·{' '}
            {asCaption(data.origin || 'Manual')}
            {data.needs_correction ? (
              <span className="el-status-pill el-status-pill--warn">Needs correction</span>
            ) : null}
          </span>
        }
        headerActions={
          <>
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
        }
        details={
          <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
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
              <FormRow label="Owner">
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
              {can.editActivities && !isDeleted ? (
                <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
                  {updateState.isLoading
                    ? 'Saving…'
                    : data.needs_correction
                      ? 'Save & clear correction'
                      : 'Save'}
                </Button>
              ) : null}
            </SectionForm>
            {can.viewAudit ? <AuditPanel entityType="activity" entityId={id} /> : null}
          </div>
        }
        related={
          <div style={{ display: 'grid', gap: 8 }}>
            {data.customer_id ? (
              <p style={{ margin: 0 }}>
                Customer:{' '}
                <Link to={`/parties/customers/${String(data.customer_id)}`}>
                  {asCaption(data.customer_name || data.customer_id)}
                </Link>
              </p>
            ) : (
              <p className="el-muted">No linked customer.</p>
            )}
          </div>
        }
        files={
          <AttachmentList
            entityType="activity"
            entityId={id}
            attachmentIds={attachmentIds}
            onChanged={() => void refetch()}
            readOnly={isDeleted || !can.editActivities}
          />
        }
      />
    </div>
  );
}
