import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateProjectBoqItemMutation,
  useCreateProjectDprMutation,
  useCreateProjectMeasurementMutation,
  useCreateProjectMutation,
  useCreateProjectPortalTokenMutation,
  useCreateProjectRaBillMutation,
  useGetProjectQuery,
  useGetProjectSiteMobileQuery,
  useGetProjectWorkspaceQuery,
  useListCustomersQuery,
  useListProjectBoqQuery,
  useListProjectDocumentsQuery,
  useListProjectDprQuery,
  useListProjectPortalTokensQuery,
  useListProjectRaBillsQuery,
  useListProjectTimeQuery,
  useListProjectsQuery,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

export function ProjectsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListProjectsQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const [createProject, createState] = useCreateProjectMutation();
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [contractValue, setContractValue] = useState('0');
  const [locationId, setLocationId] = useState('loc-main');
  const [formError, setFormError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'project_number', header: 'No.' },
      { key: 'name', header: 'Name' },
      { key: 'customer_name', header: 'Customer' },
      { key: 'contract_value', header: 'Contract' },
      { key: 'status', header: 'Status' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createProject({
        name,
        customer_id: customerId,
        contract_value: Number(contractValue) || 0,
        location_id: locationId,
      }).unwrap();
      navigate(`/projects/list/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Projects</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
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
        <FormRow label="Contract value">
          <input value={contractValue} onChange={(e) => setContractValue(e.target.value)} />
        </FormRow>
        <FormRow label="Location">
          <input value={locationId} onChange={(e) => setLocationId(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name || !customerId || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load projects.</ErrorText> : null}
      <DataTable
        columns={columns}
        rows={data as Record<string, unknown>[]}
        onRowClick={(row) => navigate(`/projects/list/${row.id}`)}
      />
    </div>
  );
}

function WorkspaceSection({ projectId }: { projectId: string }) {
  const { data: workspace } = useGetProjectWorkspaceQuery(projectId);
  const { data: boq = [] } = useListProjectBoqQuery(projectId);
  const { data: ra = [] } = useListProjectRaBillsQuery(projectId);
  const { data: time = [] } = useListProjectTimeQuery(projectId);
  const { data: docs = [] } = useListProjectDocumentsQuery(projectId);
  const { data: dprs = [] } = useListProjectDprQuery(projectId);
  const { data: tokens = [] } = useListProjectPortalTokensQuery(projectId);
  const { data: site } = useGetProjectSiteMobileQuery(projectId);
  const [createBoq] = useCreateProjectBoqItemMutation();
  const [createMeas] = useCreateProjectMeasurementMutation();
  const [createRa] = useCreateProjectRaBillMutation();
  const [createDpr] = useCreateProjectDprMutation();
  const [createPortal] = useCreateProjectPortalTokenMutation();
  const [msg, setMsg] = useState('');

  async function addBoq() {
    try {
      const item = await createBoq({
        projectId,
        body: { code: `B${boq.length + 1}`, description: 'Work item', qty: 1, rate: 100 },
      }).unwrap();
      if (item.id) {
        await createMeas({
          projectId,
          body: { boq_item_id: item.id, quantity: 1 },
        }).unwrap();
      }
      setMsg('BOQ + measurement added');
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function addRa() {
    try {
      await createRa({ projectId, body: { claim_amount: 1000, description: 'RA claim' } }).unwrap();
      setMsg('RA bill created');
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function addDpr() {
    try {
      await createDpr({ projectId, body: { notes: 'Site progress' } }).unwrap();
      setMsg('DPR created');
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  async function addPortal() {
    try {
      await createPortal({ projectId, body: { label: 'Client portal' } }).unwrap();
      setMsg('Portal token created');
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
      <h3>Workspace</h3>
      <p>Progress: {asCaption(workspace?.progress)} · BOQ items: {boq.length}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button type="button" onClick={addBoq}>
          Add BOQ + measurement
        </Button>
        <Button type="button" onClick={addRa}>
          Create RA bill
        </Button>
        <Button type="button" onClick={addDpr}>
          Create DPR
        </Button>
        <Button type="button" onClick={addPortal}>
          Portal token
        </Button>
      </div>
      {msg ? <p>{msg}</p> : null}
      <p>
        RA bills: {ra.length} · Time: {time.length} · Docs: {docs.length} · DPRs: {dprs.length} ·
        Portal tokens: {tokens.length}
      </p>
      <h3>Site mobile</h3>
      <p>
        Measurements on site: {Array.isArray(site?.measurements) ? site!.measurements.length : 0}
      </p>
    </div>
  );
}

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useGetProjectQuery(id, { skip: !id });

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Project not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/projects/list">← Projects</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.name)}</h2>
      <p>
        {asCaption(data.project_number)} · {asCaption(data.customer_name)} ·{' '}
        {asCaption(data.status)}
      </p>
      <WorkspaceSection projectId={id} />
    </div>
  );
}
