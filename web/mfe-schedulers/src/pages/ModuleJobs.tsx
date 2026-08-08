import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useListSchedulerJobsQuery,
  useRunSchedulerJobMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const MODULES = [
  'crm',
  'sales',
  'purchases',
  'inventory',
  'production',
  'boutique',
  'projects',
] as const;

const LABELS: Record<string, string> = {
  crm: 'CRM',
  sales: 'Sales',
  purchases: 'Purchases',
  inventory: 'Inventory',
  production: 'Production',
  boutique: 'Boutique',
  projects: 'Projects',
};

export function SchedulersHubPage() {
  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>Schedulers</h2>
      <p style={{ marginBottom: 16 }}>Choose a module pack to configure and run jobs.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {MODULES.map((m) => (
          <Link key={m} to={`/schedulers/${m}`} style={{ color: 'var(--vb-color-primary, #185c4c)' }}>
            {LABELS[m]}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SchedulersModulePage() {
  const { module: moduleParam } = useParams();
  const module = (moduleParam || 'crm').toLowerCase();
  const { data = [], isLoading, error, refetch } = useListSchedulerJobsQuery({ module });
  const [runJob, runState] = useRunSchedulerJobMutation();
  const [jobId, setJobId] = useState('');
  const [runError, setRunError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'id', header: 'Id' },
      { key: 'name', header: 'Job' },
      { key: 'status', header: 'Status' },
      { key: 'cron', header: 'Cron' },
      { key: 'frequency', header: 'Frequency' },
    ],
    [],
  );

  const rows = useMemo(
    () =>
      data.map((row) => ({
        id: String(row.id || row.job_id || ''),
        name: asCaption(row.name || row.title),
        status: asCaption(row.status),
        cron: asCaption(row.cron),
        frequency: asCaption(row.frequency),
      })),
    [data],
  );

  async function onRun() {
    setRunError('');
    const id = jobId || rows[0]?.id;
    if (!id) return;
    try {
      await runJob(id).unwrap();
      refetch();
    } catch (e) {
      setRunError(extractError(e));
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>
          Schedulers — {LABELS[module] || module}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/schedulers">All modules</Link>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
      {isLoading && <p>Loading jobs…</p>}
      {error ? <ErrorText>{extractError(error)}</ErrorText> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
        <FormRow label="Run job">
          <select
            value={jobId || rows[0]?.id || ''}
            onChange={(e) => setJobId(e.target.value)}
            style={{ minWidth: 280, padding: 8 }}
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </FormRow>
        <Button type="button" onClick={onRun} disabled={runState.isLoading || rows.length === 0}>
          {runState.isLoading ? 'Running…' : 'Run now'}
        </Button>
      </div>
      {runError ? <ErrorText>{runError}</ErrorText> : null}
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
