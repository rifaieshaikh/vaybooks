import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAssignCrmLeadMutation,
  useConvertCrmLeadMutation,
  useCreateCrmLeadMutation,
  useGetCrmLeadQuery,
  useGetCrmLeadTimelineQuery,
  useListCrmLeadsQuery,
  useMarkCrmLeadLostMutation,
  useReopenCrmLeadMutation,
  useSetCrmLeadStatusMutation,
  useUpdateCrmLeadMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Follow-up Required',
  'Interested',
  'Not Interested',
  'On Hold',
];

export function CrmLeadsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListCrmLeadsQuery();
  const [createLead, createState] = useCreateCrmLeadMutation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationId, setLocationId] = useState('loc-main');
  const [formError, setFormError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'lead_number', header: 'No.' },
      { key: 'name', header: 'Name' },
      { key: 'phone', header: 'Phone' },
      { key: 'status', header: 'Status' },
      { key: 'source', header: 'Source' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createLead({
        name,
        phone,
        location_id: locationId,
        allow_duplicate: true,
      }).unwrap();
      setName('');
      setPhone('');
      navigate(`/crm/leads/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Leads</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormRow>
        <FormRow label="Location">
          <input value={locationId} onChange={(e) => setLocationId(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load leads.</ErrorText> : null}
      <DataTable
        columns={columns}
        data={data as Record<string, unknown>[]}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => navigate(`/crm/leads/${row.id}`)}
      />
    </div>
  );
}

export function CrmLeadDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCrmLeadQuery(id, { skip: !id });
  const { data: timeline = [], refetch: refetchTimeline } = useGetCrmLeadTimelineQuery(id, {
    skip: !id,
  });
  const [updateLead, updateState] = useUpdateCrmLeadMutation();
  const [assignLead, assignState] = useAssignCrmLeadMutation();
  const [setStatus, statusState] = useSetCrmLeadStatusMutation();
  const [markLost, lostState] = useMarkCrmLeadLostMutation();
  const [reopenLead, reopenState] = useReopenCrmLeadMutation();
  const [convertLead, convertState] = useConvertCrmLeadMutation();
  const [notes, setNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [status, setStatusValue] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [msg, setMsg] = useState('');

  async function refresh() {
    refetch();
    refetchTimeline();
  }

  async function onSave() {
    setMsg('');
    try {
      await updateLead({ id, body: { notes } }).unwrap();
      setMsg('Saved');
      refresh();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function onAssign() {
    setMsg('');
    try {
      await assignLead({ id, assigned_user_id: assigneeId, assigned_user_name: assigneeName }).unwrap();
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

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Lead not found.</ErrorText>;

  const isLost = data.status === 'Lost';
  const isConverted = data.status === 'Converted';

  return (
    <div>
      <p>
        <Link to="/crm/leads">← Leads</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.name)}</h2>
      <p>
        {asCaption(data.lead_number)} · {asCaption(data.status)} · {asCaption(data.phone)}
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <FormRow label="Assign user ID">
          <input
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            placeholder={String(data.assigned_user_id || '')}
          />
        </FormRow>
        <FormRow label="User name">
          <input
            value={assigneeName}
            onChange={(e) => setAssigneeName(e.target.value)}
            placeholder={String(data.assigned_user_name || '')}
          />
        </FormRow>
        <Button type="button" onClick={onAssign} disabled={!assigneeId || assignState.isLoading}>
          Assign
        </Button>
        <FormRow label="Status">
          <select value={status} onChange={(e) => setStatusValue(e.target.value)}>
            <option value="">Select status…</option>
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FormRow>
        <Button type="button" onClick={onStatus} disabled={!status || statusState.isLoading || isConverted}>
          Update status
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <FormRow label="Lost reason">
          <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onMarkLost} disabled={lostState.isLoading || isConverted}>
          Mark lost
        </Button>
        {isLost ? (
          <Button type="button" onClick={onReopen} disabled={reopenState.isLoading}>
            Reopen
          </Button>
        ) : null}
        {!isConverted ? (
          <Button type="button" onClick={onConvert} disabled={convertState.isLoading}>
            Convert to customer
          </Button>
        ) : null}
      </div>
      <FormRow label="Notes">
        <textarea
          value={notes || String(data.notes || '')}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ width: '100%', maxWidth: 480 }}
        />
      </FormRow>
      <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
        Save notes
      </Button>
      {msg ? <p>{msg}</p> : null}
      <section style={{ marginTop: 28 }}>
        <h3>Timeline</h3>
        {timeline.length === 0 ? <p>No activity yet.</p> : null}
        <ol>
          {timeline.map((item) => (
            <li key={String(item.id)}>
              <strong>{asCaption(item.activity_type)}</strong> · {asCaption(item.status)} ·{' '}
              {asCaption(item.scheduled_at || item.activity_at)}
              {item.notes ? ` — ${asCaption(item.notes)}` : ''}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
