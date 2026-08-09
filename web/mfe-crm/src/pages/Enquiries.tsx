import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateCrmEnquiryMutation,
  useGetCrmEnquiryQuery,
  useListCrmEnquiriesQuery,
  useListCrmLeadsQuery,
  useUpdateCrmEnquiryMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

export function CrmEnquiriesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListCrmEnquiriesQuery();
  const { data: leads = [] } = useListCrmLeadsQuery();
  const [createEnquiry, createState] = useCreateCrmEnquiryMutation();
  const [leadId, setLeadId] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'enquiry_number', header: 'No.' },
      { key: 'party_name', header: 'Party' },
      { key: 'status', header: 'Status' },
      { key: 'product_interest', header: 'Interest' },
      { key: 'estimated_value', header: 'Value' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createEnquiry({
        lead_id: leadId,
        description,
        product_interest: description,
      }).unwrap();
      setDescription('');
      navigate(`/crm/enquiries/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Enquiries</h2>
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
                {String(l.name || l.lead_number || l.id)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Interest / notes">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!leadId || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load enquiries.</ErrorText> : null}
      <DataTable
        columns={columns}
        data={data as Record<string, unknown>[]}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => navigate(`/crm/enquiries/${row.id}`)}
      />
    </div>
  );
}

export function CrmEnquiryDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCrmEnquiryQuery(id, { skip: !id });
  const [updateEnquiry, updateState] = useUpdateCrmEnquiryMutation();
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  async function onSave() {
    setMsg('');
    try {
      await updateEnquiry({ id, body: { notes } }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Enquiry not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/crm/enquiries">← Enquiries</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.enquiry_number)}</h2>
      <p>
        {asCaption(data.party_name)} · {asCaption(data.status)}
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
        Save
      </Button>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}
