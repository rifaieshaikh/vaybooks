import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateCrmLeadMutation,
  useGetCrmLeadQuery,
  useListCrmLeadsQuery,
  useUpdateCrmLeadMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

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
        rows={data as Record<string, unknown>[]}
        onRowClick={(row) => navigate(`/crm/leads/${row.id}`)}
      />
    </div>
  );
}

export function CrmLeadDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCrmLeadQuery(id, { skip: !id });
  const [updateLead, updateState] = useUpdateCrmLeadMutation();
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  async function onSave() {
    setMsg('');
    try {
      await updateLead({ id, body: { notes } }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Lead not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/crm/leads">← Leads</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.name)}</h2>
      <p>
        {asCaption(data.lead_number)} · {asCaption(data.status)} · {asCaption(data.phone)}
      </p>
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
    </div>
  );
}
