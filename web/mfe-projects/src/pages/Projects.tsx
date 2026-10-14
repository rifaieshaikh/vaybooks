import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCreateProjectMutation,
  useCreateProjectPortalTokenMutation,
  useGetProjectQuery,
  useGetProjectSiteMobileQuery,
  useListCustomersQuery,
  useListProjectPortalTokensQuery,
  useListProjectsQuery,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
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
  useDetailKeyboardBack,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import { ProjectWorkspace } from '../workspace/ProjectWorkspace';
import { asCaption, extractError, formatDateInput, formatMoney } from '../utils';

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
  const [params, setSearchParams] = useSearchParams();
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
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [formError, setFormError] = useState('');

  type ProjectRow = (typeof data)[number];

  useEffect(() => {
    const cid = params.get('customer_id') || '';
    if (cid) setCustomerId(cid);
    if (params.get('new') !== '1') return;
    setFormError('');
    setName('');
    setContractValue('0');
    setLocationId('loc-main');
    setStartDate(formatDateInput(params.get('start_date')));
    setExpectedEndDate(formatDateInput(params.get('expected_end_date')));
    setOpen(true);
    const next = new URLSearchParams(params);
    next.delete('new');
    next.delete('start_date');
    next.delete('expected_end_date');
    setSearchParams(next, { replace: true });
  }, [params, setSearchParams]);

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
        id: 'dates',
        header: 'Dates',
        render: (row) => {
          const start = formatDateInput(row.start_date);
          const end = formatDateInput(row.expected_end_date);
          if (!start && !end) return <span className="el-muted">—</span>;
          return [start || '…', end || '…'].join(' → ');
        },
      },
      {
        id: 'contract',
        header: 'Contract',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          if (row.contract_value == null || row.contract_value === '') {
            return <span className="el-muted">—</span>;
          }
          return formatMoney(row.contract_value);
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
    setStartDate('');
    setExpectedEndDate('');
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
        ...(startDate ? { start_date: startDate } : {}),
        ...(expectedEndDate ? { expected_end_date: expectedEndDate } : {}),
      }).unwrap();
      setOpen(false);
      navigate(`/projects/list/${String(row.id)}`);
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
            <Button type="button" variant="ghost" onClick={() => void refetch()}>
              Refresh
            </Button>
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
            placeholder="Search projects…"
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
          <strong>{search.trim() || filters.status ? 'No matching projects' : 'No projects yet'}</strong>
          <Button type="button" onClick={openCreate}>
            New project
          </Button>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          onActivateRow={(row) => navigate(`/projects/list/${String(row.id)}`)}
          keyboardNav
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
              disabled={!name.trim() || !customerId || createState.isLoading}
              onClick={() => void onCreate()}
            >
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
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
          <FormRow label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormRow>
          <FormRow label="Expected end">
            <input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
            />
          </FormRow>
          <FormRow label="Location">
            <input value={locationId} onChange={(e) => setLocationId(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetProjectQuery(id, { skip: !id });

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading project…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/projects/list" label="Projects" />
        <ErrorText>Project not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const heroActions = (
    <>
      <Button type="button" variant="ghost" onClick={() => navigate('/projects/calendar')}>
        Calendar
      </Button>
      <Button type="button" variant="ghost" onClick={() => navigate(`/projects/portal/${id}`)}>
        Portal
      </Button>
      <Button type="button" variant="ghost" onClick={() => navigate(`/projects/site-mobile/${id}`)}>
        Site mobile
      </Button>
    </>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/projects/list" label="Projects" />

      <EntityDetailHero
        kicker="Projects"
        title={asCaption(data.name)}
        lead={
          <>
            {asCaption(data.project_number)}
            {data.customer_name ? (
              <span className="ed-lead-sep"> · {asCaption(data.customer_name)}</span>
            ) : null}
            {data.status ? <span className="ed-lead-sep"> · {asCaption(data.status)}</span> : null}
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Project facts"
        items={[
          { label: 'Number', value: asCaption(data.project_number) || '—' },
          { label: 'Customer', value: asCaption(data.customer_name) || '—' },
          { label: 'Status', value: asCaption(data.status) || '—' },
          {
            label: 'Contract',
            value:
              data.contract_value == null || data.contract_value === ''
                ? '—'
                : formatMoney(data.contract_value),
          },
          {
            label: 'Start',
            value: formatDateInput(data.start_date) || '—',
          },
          {
            label: 'Expected end',
            value: formatDateInput(data.expected_end_date) || '—',
          },
        ]}
      />

      <ProjectWorkspace projectId={id} />

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/projects/list')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}

export function ProjectPortalPage() {
  const { id = '' } = useParams();
  useDetailKeyboardBack(`/projects/list/${id}`);
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
  useDetailKeyboardBack(`/projects/list/${id}`);
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
