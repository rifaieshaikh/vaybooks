import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAddProjectBudgetLineMutation,
  useCertifyProjectMeasurementMutation,
  useCreateProjectBoqItemMutation,
  useCreateProjectDprMutation,
  useCreateProjectExpenseMutation,
  useCreateProjectMeasurementMutation,
  useCreateProjectMutation,
  useCreateProjectPortalTokenMutation,
  useCreateProjectRaBillMutation,
  useGetProjectBudgetQuery,
  useGetProjectQuery,
  useGetProjectSiteMobileQuery,
  useGetProjectWorkspaceQuery,
  useListCustomersQuery,
  useListProjectBoqQuery,
  useListProjectDocumentsQuery,
  useListProjectDprQuery,
  useListProjectMeasurementsQuery,
  useListProjectPortalTokensQuery,
  useListProjectRaBillsQuery,
  useListProjectTimeQuery,
  useListProjectsQuery,
  useSubmitProjectMeasurementMutation,
  useSubmitProjectRaBillMutation,
  useUploadProjectDocumentMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const TABS = [
  'Overview',
  'BOQ',
  'Budget',
  'Measurements',
  'Billing',
  'Time',
  'Expenses',
  'Documents',
  'DPR',
  'Portal',
  'Site',
] as const;
type Tab = (typeof TABS)[number];

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

function ProjectWorkspaceTabs({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const [msg, setMsg] = useState('');
  const { data: workspace } = useGetProjectWorkspaceQuery(projectId);
  const { data: boq = [] } = useListProjectBoqQuery(projectId);
  const { data: measurements = [] } = useListProjectMeasurementsQuery(projectId);
  const { data: budget } = useGetProjectBudgetQuery(projectId);
  const { data: ra = [] } = useListProjectRaBillsQuery(projectId);
  const { data: time = [] } = useListProjectTimeQuery(projectId);
  const { data: docs = [] } = useListProjectDocumentsQuery(projectId);
  const { data: dprs = [] } = useListProjectDprQuery(projectId);
  const { data: tokens = [] } = useListProjectPortalTokensQuery(projectId);
  const { data: site } = useGetProjectSiteMobileQuery(projectId);
  const [createBoq] = useCreateProjectBoqItemMutation();
  const [createMeas] = useCreateProjectMeasurementMutation();
  const [submitMeas] = useSubmitProjectMeasurementMutation();
  const [certifyMeas] = useCertifyProjectMeasurementMutation();
  const [createRa] = useCreateProjectRaBillMutation();
  const [submitRa] = useSubmitProjectRaBillMutation();
  const [addBudget] = useAddProjectBudgetLineMutation();
  const [createExpense] = useCreateProjectExpenseMutation();
  const [createDpr] = useCreateProjectDprMutation();
  const [createPortal] = useCreateProjectPortalTokenMutation();
  const [uploadDoc] = useUploadProjectDocumentMutation();
  const [budgetAmt, setBudgetAmt] = useState('1000');
  const [expenseAmt, setExpenseAmt] = useState('100');

  async function run(label: string, fn: () => Promise<unknown>) {
    setMsg('');
    try {
      await fn();
      setMsg(label);
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  const budgetLines = Array.isArray(budget?.lines) ? (budget!.lines as Record<string, unknown>[]) : [];

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Workspace</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/projects/portal/${projectId}`}>Portal page</Link>
          <Link to={`/projects/site-mobile/${projectId}`}>Site mobile</Link>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Button key={t} type="button" variant={t === tab ? undefined : 'ghost'} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      {msg ? <p>{msg}</p> : null}

      {tab === 'Overview' && (
        <p>
          Progress: {asCaption(workspace?.progress)} · BOQ {boq.length} · Measurements {measurements.length} ·
          RA {ra.length} · Docs {docs.length}
        </p>
      )}

      {tab === 'BOQ' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Button
            type="button"
            onClick={() =>
              run('BOQ item added', () =>
                createBoq({
                  projectId,
                  body: { code: `B${boq.length + 1}`, description: 'Work item', qty: 1, rate: 100 },
                }).unwrap(),
              )
            }
          >
            Add BOQ item
          </Button>
          <ul>
            {boq.map((row) => (
              <li key={String(row.id)}>
                {asCaption(row.code)} · {asCaption(row.description)} · qty {asCaption(row.estimated_qty || row.qty)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'Budget' && (
        <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(budget?.summary || {}, null, 2)}
          </pre>
          <FormRow label="Amount">
            <input value={budgetAmt} onChange={(e) => setBudgetAmt(e.target.value)} />
          </FormRow>
          <Button
            type="button"
            onClick={() =>
              run('Budget line added', () =>
                addBudget({
                  projectId,
                  body: { cost_category: 'General', amount: Number(budgetAmt) || 0 },
                }).unwrap(),
              )
            }
          >
            Add budget line
          </Button>
          <ul>
            {budgetLines.map((line) => (
              <li key={String(line.id)}>
                {asCaption(line.cost_category)} · {asCaption(line.amount)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'Measurements' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Button
            type="button"
            disabled={!boq[0]}
            onClick={() =>
              run('Measurement created', () =>
                createMeas({
                  projectId,
                  body: { boq_item_id: String(boq[0].id), quantity: 1 },
                }).unwrap(),
              )
            }
          >
            Add measurement from first BOQ
          </Button>
          <ul>
            {measurements.map((m) => (
              <li key={String(m.id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  {asCaption(m.id).slice(0, 8)} · qty {asCaption(m.quantity)} · {asCaption(m.status)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    run('Submitted', () =>
                      submitMeas({ projectId, measurementId: String(m.id) }).unwrap(),
                    )
                  }
                >
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    run('Certified', () =>
                      certifyMeas({
                        projectId,
                        measurementId: String(m.id),
                        body: { actor: 'web' },
                      }).unwrap(),
                    )
                  }
                >
                  Certify
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'Billing' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Button
            type="button"
            onClick={() =>
              run('RA created', () =>
                createRa({
                  projectId,
                  body: {
                    claim_amount: 1000,
                    description: 'RA claim',
                    measurement_ids: measurements
                      .filter((m) => /certif/i.test(String(m.status || '')))
                      .map((m) => String(m.id)),
                  },
                }).unwrap(),
              )
            }
          >
            Create RA (from certified if any)
          </Button>
          <ul>
            {ra.map((bill) => (
              <li key={String(bill.id)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>
                  {asCaption(bill.ra_number || bill.id)} · {asCaption(bill.status)} ·{' '}
                  {asCaption(bill.claim_amount || bill.amount)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    run('RA submitted', () =>
                      submitRa({ projectId, raId: String(bill.id) }).unwrap(),
                    )
                  }
                >
                  Submit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'Time' && (
        <ul>
          {time.map((row) => (
            <li key={String(row.id)}>
              {asCaption(row.work_date)} · {asCaption(row.hours)}h · {asCaption(row.worker_id)}
            </li>
          ))}
          {!time.length ? <p style={{ color: '#667' }}>No time entries.</p> : null}
        </ul>
      )}

      {tab === 'Expenses' && (
        <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
          <FormRow label="Amount">
            <input value={expenseAmt} onChange={(e) => setExpenseAmt(e.target.value)} />
          </FormRow>
          <Button
            type="button"
            onClick={() =>
              run('Expense added', () =>
                createExpense({
                  projectId,
                  body: { amount: Number(expenseAmt) || 0, category: 'Material', description: 'Site cost' },
                }).unwrap(),
              )
            }
          >
            Add expense
          </Button>
        </div>
      )}

      {tab === 'Documents' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Button
            type="button"
            onClick={() =>
              run('Document uploaded', () =>
                uploadDoc({
                  projectId,
                  body: {
                    name: `note-${Date.now()}.txt`,
                    category: 'Other',
                    content_type: 'text/plain',
                    data_base64: btoa('workspace upload'),
                  },
                }).unwrap(),
              )
            }
          >
            Upload sample note
          </Button>
          <ul>
            {docs.map((d) => (
              <li key={String(d.id)}>
                {asCaption(d.name)} · {asCaption(d.category)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'DPR' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Button
            type="button"
            onClick={() => run('DPR created', () => createDpr({ projectId, body: { notes: 'Site progress' } }).unwrap())}
          >
            Create DPR
          </Button>
          <ul>
            {dprs.map((d) => (
              <li key={String(d.id)}>
                {asCaption(d.report_date)} · {asCaption(d.notes)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'Portal' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Button
            type="button"
            onClick={() =>
              run('Token created', () => createPortal({ projectId, body: { label: 'Client portal' } }).unwrap())
            }
          >
            Create portal token
          </Button>
          <ul>
            {tokens.map((t) => (
              <li key={String(t.id)}>
                {asCaption(t.label || t.token)} · {asCaption(t.scope)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'Site' && (
        <div>
          <p>
            Site measurements: {Array.isArray(site?.measurements) ? site!.measurements.length : 0} · DPRs:{' '}
            {Array.isArray(site?.dprs) ? site!.dprs.length : 0} · Time:{' '}
            {Array.isArray(site?.time_entries) ? site!.time_entries.length : 0}
          </p>
          <Link to={`/projects/site-mobile/${projectId}`}>Open dedicated site-mobile page</Link>
        </div>
      )}
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
        {asCaption(data.project_number)} · {asCaption(data.customer_name)} · {asCaption(data.status)}
      </p>
      <ProjectWorkspaceTabs projectId={id} />
    </div>
  );
}

export function ProjectPortalPage() {
  const { id = '' } = useParams();
  const { data: project } = useGetProjectQuery(id, { skip: !id });
  const { data: tokens = [], refetch } = useListProjectPortalTokensQuery(id, { skip: !id });
  const [createPortal] = useCreateProjectPortalTokenMutation();
  const [msg, setMsg] = useState('');

  return (
    <div>
      <p>
        <Link to={`/projects/list/${id}`}>← Project</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>
        Portal · {asCaption(project?.name)}
      </h2>
      <Button
        type="button"
        onClick={async () => {
          try {
            await createPortal({ projectId: id, body: { label: 'Client', scope: 'quote' } }).unwrap();
            setMsg('Token created');
            refetch();
          } catch (e) {
            setMsg(extractError(e));
          }
        }}
      >
        Issue token
      </Button>
      {msg ? <p>{msg}</p> : null}
      <ul>
        {tokens.map((t) => (
          <li key={String(t.id)}>
            {asCaption(t.label)} · expires {asCaption(t.expires_at)} · {asCaption(t.token || t.id)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectSiteMobilePage() {
  const { id = '' } = useParams();
  const { data: site, isLoading, error } = useGetProjectSiteMobileQuery(id, { skip: !id });

  if (isLoading) return <p>Loading…</p>;
  if (error || !site) return <ErrorText>Site payload unavailable.</ErrorText>;

  const measurements = Array.isArray(site.measurements) ? site.measurements : [];
  const dprs = Array.isArray(site.dprs) ? site.dprs : [];
  const time = Array.isArray(site.time_entries) ? site.time_entries : [];

  return (
    <div>
      <p>
        <Link to={`/projects/list/${id}`}>← Project</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>
        Site mobile · {asCaption((site.project as Record<string, unknown> | undefined)?.name)}
      </h2>
      <h3>Measurements ({measurements.length})</h3>
      <ul>
        {measurements.map((m) => (
          <li key={String((m as Record<string, unknown>).id)}>
            qty {asCaption((m as Record<string, unknown>).quantity)} ·{' '}
            {asCaption((m as Record<string, unknown>).status)}
          </li>
        ))}
      </ul>
      <h3>DPRs ({dprs.length})</h3>
      <ul>
        {dprs.map((d) => (
          <li key={String((d as Record<string, unknown>).id)}>
            {asCaption((d as Record<string, unknown>).report_date)} ·{' '}
            {asCaption((d as Record<string, unknown>).notes)}
          </li>
        ))}
      </ul>
      <h3>Time ({time.length})</h3>
      <ul>
        {time.map((t) => (
          <li key={String((t as Record<string, unknown>).id)}>
            {asCaption((t as Record<string, unknown>).hours)}h
          </li>
        ))}
      </ul>
    </div>
  );
}
