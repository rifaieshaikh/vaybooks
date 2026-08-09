import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  matchesRegex,
  pageCount,
  paginate,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
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

const PROJECT_STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Active', label: 'Active' },
  { id: 'On Hold', label: 'On Hold' },
  { id: 'Physically Completed', label: 'Completed' },
  { id: 'Financially Closed', label: 'Closed' },
] as const;

export function ProjectsListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListProjectsQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const [createProject, createState] = useCreateProjectMutation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [contractValue, setContractValue] = useState('0');
  const [locationId, setLocationId] = useState('loc-main');
  const [formError, setFormError] = useState('');

  type ProjectRow = (typeof data)[number];

  useEffect(() => {
    const cid = params.get('customer_id') || '';
    if (cid) setCustomerId(cid);
    if (params.get('new') === '1') {
      setFormError('');
      setName('');
      setContractValue('0');
      setLocationId('loc-main');
      setOpen(true);
    }
  }, [params]);

  const filterCustomerId = params.get('customer_id') || '';

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (filterCustomerId && String(row.customer_id || '') !== filterCustomerId) return false;
      if (filters.status && String(row.status || '') !== filters.status) return false;
      if (!search.trim()) return true;
      return (
        matchesRegex(row.project_number, search) ||
        matchesRegex(row.name, search) ||
        matchesRegex(row.customer_name, search) ||
        matchesRegex(row.status, search)
      );
    });
  }, [data, filterCustomerId, filters, search]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  const columns: EntityListColumn<ProjectRow>[] = useMemo(
    () => [
      {
        id: 'project',
        header: 'Project',
        render: (row) => {
          const number = displayName(row, ['project_number'], String(row.id));
          const projectName = asCaption(row.name);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{projectName}</span>
                <span className="el-customer-sub">{number}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => {
          const customer = String(row.customer_name || '').trim();
          return <span className={customer ? undefined : 'el-muted'}>{customer || '—'}</span>;
        },
      },
      {
        id: 'contract',
        header: 'Contract',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const value = row.contract_value;
          if (value == null || value === '') return <span className="el-muted">—</span>;
          return asCaption(value);
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status),
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setName('');
    setCustomerId(params.get('customer_id') || customerId || '');
    setContractValue('0');
    setLocationId('loc-main');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    try {
      const row = await createProject({
        name,
        customer_id: customerId,
        contract_value: Number(contractValue) || 0,
        location_id: locationId,
      }).unwrap();
      setOpen(false);
      navigate(`/projects/list/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Projects"
        title="Projects"
        count={`${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={openCreate}>
              New project
            </Button>
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
            placeholder="Search name, customer, status…"
            aria-label="Search projects"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.status || 'all'}
            onChange={(id) => {
              setFilters({ status: id === 'all' ? '' : id });
              setPage(1);
            }}
            options={[...PROJECT_STATUS_CHIPS]}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading projects…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load projects.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>
            {search.trim() || filterCustomerId || filters.status ? 'No matching projects' : 'No projects yet'}
          </strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/projects/list/${row.id}`)} />
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
        title="New project"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onCreate()}
              disabled={!name || !customerId || createState.isLoading}
            >
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Customer">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={{ width: '100%', minWidth: 200 }}
            >
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
        </div>
      </Modal>
    </EntityListPage>
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
