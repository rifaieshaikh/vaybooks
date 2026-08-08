import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetProjectsSettingsQuery,
  useListAllProjectMeasurementsQuery,
  useListAllProjectRaBillsQuery,
  useProjectsReportsCatalogQuery,
  useRunProjectsReportMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { useState } from 'react';
import { extractError } from '../utils';

export function ProjectMeasurementsPage() {
  const { data = [], isLoading, error, refetch } = useListAllProjectMeasurementsQuery();
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'project_name', header: 'Project' },
      { key: 'boq_item_id', header: 'BOQ' },
      { key: 'quantity', header: 'Qty' },
      { key: 'status', header: 'Status' },
    ],
    [],
  );
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Project Measurements</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <p style={{ color: '#667' }}>
        Add measurements from a <Link to="/projects/list">project workspace</Link>.
      </p>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load measurements.</ErrorText> : null}
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
    </div>
  );
}

export function ProjectRaBillsPage() {
  const { data = [], isLoading, error, refetch } = useListAllProjectRaBillsQuery();
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'project_name', header: 'Project' },
      { key: 'claim_amount', header: 'Claim' },
      { key: 'status', header: 'Status' },
      { key: 'description', header: 'Description' },
    ],
    [],
  );
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>RA Bills</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load RA bills.</ErrorText> : null}
      <DataTable columns={columns} rows={data as Record<string, unknown>[]} />
    </div>
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
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

export function ProjectsScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Projects Scheduled Reports</h2>
      <p>
        Configure jobs in <Link to="/schedulers/projects">Schedulers → Projects</Link>.
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
