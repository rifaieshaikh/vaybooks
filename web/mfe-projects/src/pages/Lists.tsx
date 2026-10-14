import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useConvertProjectRaToInvoiceMutation,
  useGetProjectsSettingsQuery,
  useListAllProjectMeasurementsQuery,
  useListAllProjectRaBillsQuery,
  useListFinanceAccountsQuery,
  useProjectsReportsCatalogQuery,
  useRunProjectsReportMutation,
} from '@vaybooks/store';
import {
  Button,
  DataTable,
  EntityListEmpty,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  ErrorText,
  FormRow,
  PAGE_SIZE,
  PaginationBar,
  matchesRegex,
  pageCount,
  paginate,
  type DataTableColumn,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const MEASUREMENT_STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Submitted', label: 'Submitted' },
  { id: 'Customer Certified', label: 'Certified' },
  { id: 'Disputed', label: 'Disputed' },
] as const;

const RA_BILL_STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Submitted', label: 'Submitted' },
  { id: 'Certified', label: 'Certified' },
  { id: 'Invoiced', label: 'Invoiced' },
] as const;

export function ProjectMeasurementsPage() {
  const { data = [], isLoading, error, refetch } = useListAllProjectMeasurementsQuery();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [page, setPage] = useState(1);

  type MeasurementRow = (typeof data)[number];

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (filters.status && String(row.status || '') !== filters.status) return false;
      if (!search.trim()) return true;
      return (
        matchesRegex(row.project_name, search) ||
        matchesRegex(row.boq_item_id, search) ||
        matchesRegex(row.status, search)
      );
    });
  }, [data, filters, search]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  const columns: EntityListColumn<MeasurementRow>[] = useMemo(
    () => [
      {
        id: 'project',
        header: 'Project',
        render: (row) => {
          const project = asCaption(row.project_name);
          const boq = String(row.boq_item_id || '').trim();
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{project}</span>
                <span className="el-customer-sub">{boq || 'No BOQ'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'quantity',
        header: 'Qty',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => asCaption(row.quantity),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status),
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Projects"
        title="Project Measurements"
        count={`${filtered.length} ${filtered.length === 1 ? 'measurement' : 'measurements'}`}
        actions={
          <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
            Refresh
          </button>
        }
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search project, BOQ, status…"
            aria-label="Search measurements"
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
            options={[...MEASUREMENT_STATUS_CHIPS]}
          />
        }
        summary={
          <p style={{ margin: 0, color: '#667' }}>
            Add measurements from a <Link to="/projects/list">project workspace</Link>.
          </p>
        }
      />

      {isLoading ? <EntityListLoading>Loading measurements…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load measurements.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{search.trim() || filters.status ? 'No matching measurements' : 'No measurements yet'}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
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
    </EntityListPage>
  );
}

export function ProjectRaBillsPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListAllProjectRaBillsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const [convertRa] = useConvertProjectRaToInvoiceMutation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [storeAccountId, setStoreAccountId] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  type RaBillRow = (typeof data)[number];

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (filters.status && String(row.status || '') !== filters.status) return false;
      if (!search.trim()) return true;
      return (
        matchesRegex(row.project_name, search) ||
        matchesRegex(row.status, search) ||
        matchesRegex(row.description, search)
      );
    });
  }, [data, filters, search]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  const columns: EntityListColumn<RaBillRow>[] = useMemo(
    () => [
      {
        id: 'project',
        header: 'Project',
        render: (row) => {
          const project = asCaption(row.project_name);
          const description = String(row.description || '').trim();
          const projectId = String(row.project_id || '');
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">
                  {projectId ? (
                    <Link to={`/projects/list/${projectId}`}>{project}</Link>
                  ) : (
                    project
                  )}
                </span>
                <span className="el-customer-sub">{description || 'No description'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'claim',
        header: 'Claim',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const value = row.claim_amount;
          if (value == null || value === '') return <span className="el-muted">—</span>;
          return asCaption(value);
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status),
      },
      {
        id: 'actions',
        header: 'Actions',
        render: (row) => {
          const status = String(row.status || '');
          const canConvert = status === 'Certified' || status === 'Partially Certified';
          if (!canConvert) return <span className="el-muted">—</span>;
          return (
            <Button
              type="button"
              variant="ghost"
              disabled={!storeAccountId}
              onClick={() => {
                void (async () => {
                  setActionMsg('');
                  try {
                    await convertRa({
                      projectId: String(row.project_id),
                      raId: String(row.id),
                      body: { store_account_id: storeAccountId },
                    }).unwrap();
                    setActionMsg('Converted to invoice');
                    refetch();
                  } catch (e) {
                    setActionMsg(extractError(e));
                  }
                })();
              }}
            >
              Convert to invoice
            </Button>
          );
        },
      },
    ],
    [convertRa, refetch, storeAccountId],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Projects"
        title="RA Bills"
        count={`${filtered.length} ${filtered.length === 1 ? 'bill' : 'bills'}`}
        actions={
          <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
            Refresh
          </button>
        }
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search project, status, description…"
            aria-label="Search RA bills"
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
            options={[...RA_BILL_STATUS_CHIPS]}
          />
        }
        summary={
          <div style={{ display: 'grid', gap: 8 }}>
            <FormRow label="Store account for convert">
              <select
                value={storeAccountId}
                onChange={(e) => setStoreAccountId(e.target.value)}
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {asCaption(a.account_name || a.name)}
                  </option>
                ))}
              </select>
            </FormRow>
            {actionMsg ? <p style={{ margin: 0 }}>{actionMsg}</p> : null}
          </div>
        }
      />

      {isLoading ? <EntityListLoading>Loading RA bills…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load RA bills.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{search.trim() || filters.status ? 'No matching RA bills' : 'No RA bills yet'}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          onActivateRow={(row) => {
            if (row.project_id) navigate(`/projects/list/${String(row.project_id)}`);
          }}
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
    </EntityListPage>
  );
}

export function ProjectsReportsPage() {
  const { data: catalog, isLoading, error } = useProjectsReportsCatalogQuery();
  const [runReport, runState] = useRunProjectsReportMutation();
  const [reportType, setReportType] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [runError, setRunError] = useState('');
  const types = catalog?.report_types || [];
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({ key, header: key }));
  }, [rows]);

  async function onRun() {
    setRunError('');
    try {
      const result = await runReport({
        report_type: reportType || types[0],
        filters: {},
      }).unwrap();
      setRows(Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : []);
    } catch (e) {
      setRunError(extractError(e));
      setRows([]);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>Projects Reports</h2>
      {isLoading && <p>Loading catalog…</p>}
      {error ? <ErrorText>Failed to load catalog.</ErrorText> : null}
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 16 }}>
        <FormRow label="Report">
          <select
            value={reportType || types[0] || ''}
            onChange={(e) => setReportType(e.target.value)}
            style={{ minWidth: 220 }}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        <Button type="button" onClick={onRun} disabled={runState.isLoading || types.length === 0}>
          Run
        </Button>
      </div>
      {runError ? <ErrorText>{runError}</ErrorText> : null}
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => String(row.id ?? JSON.stringify(row))}
      />
    </div>
  );
}

export function ProjectsScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Projects Scheduled Reports</h2>
      <p>
        Configure reports in <Link to="/schedulers/projects?panel=reports">Schedulers → Projects scheduled reports</Link>.
      </p>
    </div>
  );
}

export function ProjectsSettingsPage() {
  const { data, isLoading, error, refetch } = useGetProjectsSettingsQuery();
  const activities = Array.isArray(data?.activity_configs)
    ? (data!.activity_configs as Record<string, unknown>[])
    : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Projects Settings</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load settings.</ErrorText> : null}
      <p>Activity configs: {activities.length}</p>
      <p style={{ color: '#667' }}>
        Also see <Link to="/settings/project-activities">Settings → Project Activities</Link>.
      </p>
    </div>
  );
}
