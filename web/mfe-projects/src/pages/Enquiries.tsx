import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateProjectEnquiryMutation,
  useGetProjectEnquiryQuery,
  useListCustomersQuery,
  useListProjectEnquiriesQuery,
  useMarkProjectEnquiryWonMutation,
  useStartProjectEnquiryEstimationMutation,
  useUpdateProjectEnquiryStatusMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

export function ProjectEnquiriesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListProjectEnquiriesQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const [createEnquiry, createState] = useCreateProjectEnquiryMutation();
  const [customerId, setCustomerId] = useState('');
  const [requirement, setRequirement] = useState('');
  const [formError, setFormError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'enquiry_number', header: 'No.' },
      { key: 'customer_name', header: 'Customer' },
      { key: 'status', header: 'Status' },
      { key: 'requirement', header: 'Requirement' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createEnquiry({
        customer_id: customerId,
        requirement,
      }).unwrap();
      navigate(`/projects/enquiries/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Project Enquiries</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Customer">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Select…</option>
            {customers.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.customer_name || c.name || c.id)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Requirement">
          <input value={requirement} onChange={(e) => setRequirement(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!customerId || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load enquiries.</ErrorText> : null}
      <DataTable
        columns={columns}
        rows={data as Record<string, unknown>[]}
        onRowClick={(row) => navigate(`/projects/enquiries/${row.id}`)}
      />
    </div>
  );
}

export function ProjectEnquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetProjectEnquiryQuery(id, { skip: !id });
  const [updateStatus] = useUpdateProjectEnquiryStatusMutation();
  const [startEstimation] = useStartProjectEnquiryEstimationMutation();
  const [markWon] = useMarkProjectEnquiryWonMutation();
  const [actionError, setActionError] = useState('');
  const [status, setStatus] = useState('');

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Enquiry not found.</ErrorText>;

  async function run(fn: () => Promise<unknown>) {
    setActionError('');
    try {
      const result = await fn();
      await refetch();
      return result;
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  return (
    <div>
      <p>
        <Link to="/projects/enquiries">← Enquiries</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.enquiry_number)}</h2>
      <p>
        {asCaption(data.customer_name)} · {asCaption(data.status)}
      </p>
      <p>{asCaption(data.requirement)}</p>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, alignItems: 'end' }}>
        <FormRow label="Status">
          <input
            value={status || String(data.status || '')}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="e.g. Estimating"
          />
        </FormRow>
        <Button
          type="button"
          onClick={() =>
            run(() =>
              updateStatus({ id, status: status || String(data.status || 'Open') }).unwrap(),
            )
          }
        >
          Update status
        </Button>
        <Button
          type="button"
          onClick={async () => {
            const project = await run(() => startEstimation(id).unwrap());
            if (project && typeof project === 'object' && 'id' in project) {
              navigate(`/projects/list/${String((project as { id: string }).id)}`);
            }
          }}
        >
          Start estimation
        </Button>
        <Button type="button" variant="ghost" onClick={() => run(() => markWon(id).unwrap())}>
          Mark won
        </Button>
      </div>
    </div>
  );
}
