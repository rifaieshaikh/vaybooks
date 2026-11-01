import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  useListSchedulerJobRunsQuery,
  useListSchedulerJobsQuery,
  useRunSchedulerJobMutation,
  useUpdateSchedulerJobMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';
import { ModuleScheduledReportsPanel } from './ScheduledReportsPanel';

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

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'every_n_days', label: 'Every N days' },
];

function value(row: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  return String(row?.[key] ?? fallback);
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const module = (moduleParam || 'crm').toLowerCase();
  const { data = [], isLoading, error, refetch } = useListSchedulerJobsQuery({ module });
  const [runJob, runState] = useRunSchedulerJobMutation();
  const [updateJob, updateJobState] = useUpdateSchedulerJobMutation();
  const [jobId, setJobId] = useState('');
  const [actionError, setActionError] = useState('');
  const [jobForm, setJobForm] = useState<Record<string, string | boolean>>({});
  const panel = searchParams.get('panel') === 'reports' ? 'reports' : 'jobs';
  const selectedJob = data.find((job) => value(job, 'id', value(job, 'job_id')) === jobId) || data[0];
  const selectedJobId = value(selectedJob, 'id', value(selectedJob, 'job_id'));
  const { data: jobRuns = [], isLoading: jobRunsLoading } = useListSchedulerJobRunsQuery(
    { id: selectedJobId },
    { skip: !selectedJobId },
  );

  useEffect(() => {
    if (selectedJobId && selectedJobId !== jobId) setJobId(selectedJobId);
  }, [jobId, selectedJobId]);

  useEffect(() => {
    if (!selectedJob) return;
    setJobForm({
      enabled: Boolean(selectedJob.enabled),
      frequency: value(selectedJob, 'frequency', 'daily'),
      time_of_day: value(selectedJob, 'time_of_day', '06:00'),
      weekday: value(selectedJob, 'weekday', '0'),
      interval_days: value(selectedJob, 'interval_days', '1'),
    });
  }, [selectedJobId]);

  const jobColumns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'id', header: 'Id' },
      { key: 'name', header: 'Job' },
      { key: 'status', header: 'Status' },
      { key: 'cron', header: 'Cron' },
      { key: 'frequency', header: 'Frequency' },
    ],
    [],
  );

  const jobRows = useMemo(
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
    setActionError('');
    const id = selectedJobId;
    if (!id) return;
    try {
      await runJob(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  async function onSaveJob() {
    if (!selectedJobId) return;
    setActionError('');
    try {
      await updateJob({
        id: selectedJobId,
        body: {
          enabled: Boolean(jobForm.enabled),
          frequency: String(jobForm.frequency),
          time_of_day: String(jobForm.time_of_day),
          weekday: Number(jobForm.weekday),
          interval_days: Number(jobForm.interval_days),
        },
      }).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  const runColumns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'status', header: 'Status' },
      { key: 'trigger', header: 'Trigger' },
      { key: 'started_at', header: 'Started' },
      { key: 'finished_at', header: 'Finished' },
      { key: 'error_summary', header: 'Details' },
    ],
    [],
  );

  function selectPanel(nextPanel: 'jobs' | 'reports') {
    setSearchParams(nextPanel === 'reports' ? { panel: 'reports' } : {});
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
          {panel === 'jobs' ? (
            <Button type="button" variant="ghost" onClick={() => refetch()}>
              Refresh
            </Button>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button type="button" variant={panel === 'jobs' ? 'primary' : 'ghost'} onClick={() => selectPanel('jobs')}>
          Jobs
        </Button>
        <Button type="button" variant={panel === 'reports' ? 'primary' : 'ghost'} onClick={() => selectPanel('reports')}>
          Scheduled reports
        </Button>
      </div>
      {panel === 'jobs' ? (
        <>
          {isLoading && <p>Loading jobs…</p>}
          {error ? <ErrorText>{extractError(error)}</ErrorText> : null}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
            <FormRow label="Job">
              <select value={selectedJobId} onChange={(e) => setJobId(e.target.value)} style={{ minWidth: 280, padding: 8 }}>
                {jobRows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </FormRow>
            <FormRow label="Frequency">
              <select value={String(jobForm.frequency || 'daily')} onChange={(e) => setJobForm({ ...jobForm, frequency: e.target.value })}>
                {FREQUENCIES.map((frequency) => <option key={frequency.value} value={frequency.value}>{frequency.label}</option>)}
              </select>
            </FormRow>
            <FormRow label="Time">
              <input type="time" value={String(jobForm.time_of_day || '06:00')} onChange={(e) => setJobForm({ ...jobForm, time_of_day: e.target.value })} />
            </FormRow>
            {jobForm.frequency === 'weekly' ? (
              <FormRow label="Weekday">
                <input type="number" min="0" max="6" value={String(jobForm.weekday || '0')} onChange={(e) => setJobForm({ ...jobForm, weekday: e.target.value })} />
              </FormRow>
            ) : null}
            {jobForm.frequency === 'every_n_days' ? (
              <FormRow label="Every (days)">
                <input type="number" min="1" value={String(jobForm.interval_days || '1')} onChange={(e) => setJobForm({ ...jobForm, interval_days: e.target.value })} />
              </FormRow>
            ) : null}
            <FormRow label="Cron (derived)">
              <input value={value(selectedJob, 'cron')} readOnly />
            </FormRow>
            <label><input type="checkbox" checked={Boolean(jobForm.enabled)} onChange={(e) => setJobForm({ ...jobForm, enabled: e.target.checked })} /> Enabled</label>
            <Button type="button" onClick={() => void onSaveJob()} disabled={updateJobState.isLoading || !selectedJobId}>
              {updateJobState.isLoading ? 'Saving…' : 'Save job'}
            </Button>
            <Button type="button" onClick={() => void onRun()} disabled={runState.isLoading || !selectedJobId}>
              {runState.isLoading ? 'Running…' : 'Run now'}
            </Button>
          </div>
          {actionError ? <ErrorText>{actionError}</ErrorText> : null}
          <DataTable columns={jobColumns} data={jobRows} rowKey={(row) => row.id} />
          <h3>Run history</h3>
          {jobRunsLoading ? <p>Loading run history…</p> : <DataTable columns={runColumns} data={jobRuns} rowKey={(row) => value(row, 'id')} />}
        </>
      ) : (
        <ModuleScheduledReportsPanel module={module} />
      )}
    </div>
  );
}
