import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateCrmActivityMutation,
  useGetCrmActivityQuery,
  useListCrmActivitiesQuery,
  useListCrmLeadsQuery,
  useUpdateCrmActivityMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const ACTIVITY_TYPES = ['Called', 'Meeting', 'General Follow-up', 'WhatsApp Message', 'Email', 'Note'];

export function CrmActivitiesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListCrmActivitiesQuery();
  const { data: leads = [] } = useListCrmLeadsQuery();
  const [createActivity, createState] = useCreateCrmActivityMutation();
  const [leadId, setLeadId] = useState('');
  const [activityType, setActivityType] = useState('Called');
  const [notes, setNotes] = useState('');
  const [locationId, setLocationId] = useState('loc-main');
  const [formError, setFormError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'activity_type', header: 'Type' },
      { key: 'party_name', header: 'Party' },
      { key: 'status', header: 'Status' },
      { key: 'scheduled_at', header: 'Scheduled' },
      { key: 'notes', header: 'Notes' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createActivity({
        activity_type: activityType,
        lead_id: leadId,
        notes,
        location_id: locationId,
      }).unwrap();
      setNotes('');
      navigate(`/crm/activities/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Activities</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'end' }}>
        <FormRow label="Lead">
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Select lead…</option>
            {leads.map((l) => (
              <option key={String(l.id)} value={String(l.id)}>
                {String(l.name || l.id)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Type">
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormRow>
        <FormRow label="Location">
          <input value={locationId} onChange={(e) => setLocationId(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!leadId || createState.isLoading}>
          Log activity
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load activities.</ErrorText> : null}
      <DataTable
        columns={columns}
        data={data as Record<string, unknown>[]}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => navigate(`/crm/activities/${row.id}`)}
      />
    </div>
  );
}

export function CrmActivityDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCrmActivityQuery(id, { skip: !id });
  const [updateActivity, updateState] = useUpdateCrmActivityMutation();
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  async function onComplete() {
    setMsg('');
    try {
      await updateActivity({ id, body: { status: 'Completed', notes: notes || undefined } }).unwrap();
      setMsg('Completed');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Activity not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/crm/activities">← Activities</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.activity_type)}</h2>
      <p>
        {asCaption(data.status)} · {asCaption(data.scheduled_at)}
      </p>
      <FormRow label="Notes">
        <textarea
          value={notes || String(data.notes || '')}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ width: '100%', maxWidth: 480 }}
        />
      </FormRow>
      <Button type="button" onClick={onComplete} disabled={updateState.isLoading}>
        Mark completed
      </Button>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}
