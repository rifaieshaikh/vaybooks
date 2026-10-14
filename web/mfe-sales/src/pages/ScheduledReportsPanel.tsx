import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useListScheduledReportRunsQuery,
  useListScheduledReportsQuery,
  useRunScheduledReportMutation,
  useUpdateScheduledReportMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'every_n_days', label: 'Every N days' },
];

function value(row: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  return String(row?.[key] ?? fallback);
}

export type ModuleScheduledReportsPanelProps = {
  module: string;
  title?: string;
  /** When true, show a secondary link into the Schedulers MFE reports panel. */
  showSchedulersLink?: boolean;
};

export function ModuleScheduledReportsPanel({
  module,
  title,
  showSchedulersLink = false,
}: ModuleScheduledReportsPanelProps) {
  const {
    data: reports = [],
    isLoading: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = useListScheduledReportsQuery({ module });
  const [runReport, runReportState] = useRunScheduledReportMutation();
  const [updateReport, updateReportState] = useUpdateScheduledReportMutation();
  const [reportId, setReportId] = useState('');
  const [actionError, setActionError] = useState('');
  const [reportForm, setReportForm] = useState<Record<string, string | boolean>>({});

  const selectedReport =
    reports.find((report) => value(report, 'id', value(report, 'report_id')) === reportId) ||
    reports[0];
  const selectedReportId = value(selectedReport, 'id', value(selectedReport, 'report_id'));
  const { data: reportRuns = [], isLoading: reportRunsLoading } = useListScheduledReportRunsQuery(
    { module, id: selectedReportId },
    { skip: !selectedReportId },
  );

  useEffect(() => {
    if (selectedReportId && selectedReportId !== reportId) setReportId(selectedReportId);
  }, [reportId, selectedReportId]);

  useEffect(() => {
    if (!selectedReport) return;
    setReportForm({
      enabled: Boolean(selectedReport.enabled),
      frequency: value(selectedReport, 'frequency', 'daily'),
      time_of_day: value(selectedReport, 'time_of_day', '06:00'),
      weekday: value(selectedReport, 'weekday', '0'),
      interval_days: value(selectedReport, 'interval_days', '1'),
    });
  }, [selectedReportId]);

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
  const reportColumns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'title', header: 'Report' },
      { key: 'status', header: 'Status' },
      { key: 'frequency', header: 'Frequency' },
      { key: 'cron', header: 'Cron' },
      { key: 'last_run_at', header: 'Last run' },
    ],
    [],
  );

  async function onSaveReport() {
    if (!selectedReportId) return;
    setActionError('');
    try {
      await updateReport({
        module,
        id: selectedReportId,
        body: {
          enabled: Boolean(reportForm.enabled),
          frequency: String(reportForm.frequency),
          time_of_day: String(reportForm.time_of_day),
          weekday: Number(reportForm.weekday),
          interval_days: Number(reportForm.interval_days),
        },
      }).unwrap();
      refetchReports();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  async function onRunReport() {
    if (!selectedReportId) return;
    setActionError('');
    try {
      await runReport({ module, id: selectedReportId }).unwrap();
      refetchReports();
    } catch (e) {
      setActionError(extractError(e));
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
        {title ? (
          <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>{title}</h3>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {showSchedulersLink ? (
            <Link to={`/schedulers/${module}?panel=reports`}>Open in Schedulers</Link>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void refetchReports()}>
            Refresh
          </Button>
        </div>
      </div>
      {reportsLoading && <p>Loading scheduled reports…</p>}
      {reportsError ? <ErrorText>{extractError(reportsError)}</ErrorText> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
        <FormRow label="Report">
          <select
            value={selectedReportId}
            onChange={(e) => setReportId(e.target.value)}
            style={{ minWidth: 280, padding: 8 }}
          >
            {reports.map((report) => (
              <option key={value(report, 'id')} value={value(report, 'id')}>
                {value(report, 'title') || asCaption(report.name)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Frequency">
          <select
            value={String(reportForm.frequency || 'daily')}
            onChange={(e) => setReportForm({ ...reportForm, frequency: e.target.value })}
          >
            {FREQUENCIES.map((frequency) => (
              <option key={frequency.value} value={frequency.value}>
                {frequency.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Time">
          <input
            type="time"
            value={String(reportForm.time_of_day || '06:00')}
            onChange={(e) => setReportForm({ ...reportForm, time_of_day: e.target.value })}
          />
        </FormRow>
        {reportForm.frequency === 'weekly' ? (
          <FormRow label="Weekday">
            <input
              type="number"
              min="0"
              max="6"
              value={String(reportForm.weekday || '0')}
              onChange={(e) => setReportForm({ ...reportForm, weekday: e.target.value })}
            />
          </FormRow>
        ) : null}
        {reportForm.frequency === 'every_n_days' ? (
          <FormRow label="Every (days)">
            <input
              type="number"
              min="1"
              value={String(reportForm.interval_days || '1')}
              onChange={(e) => setReportForm({ ...reportForm, interval_days: e.target.value })}
            />
          </FormRow>
        ) : null}
        <FormRow label="Cron (derived)">
          <input value={value(selectedReport, 'cron')} readOnly />
        </FormRow>
        <label>
          <input
            type="checkbox"
            checked={Boolean(reportForm.enabled)}
            onChange={(e) => setReportForm({ ...reportForm, enabled: e.target.checked })}
          />{' '}
          Enabled
        </label>
        <Button
          type="button"
          onClick={() => void onSaveReport()}
          disabled={updateReportState.isLoading || !selectedReportId}
        >
          {updateReportState.isLoading ? 'Saving…' : 'Save report'}
        </Button>
        <Button
          type="button"
          onClick={() => void onRunReport()}
          disabled={runReportState.isLoading || !selectedReportId}
        >
          {runReportState.isLoading ? 'Running…' : 'Run now'}
        </Button>
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <DataTable columns={reportColumns} data={reports} rowKey={(row) => value(row, 'id')} />
      <h3>Run history</h3>
      {reportRunsLoading ? (
        <p>Loading run history…</p>
      ) : (
        <DataTable columns={runColumns} data={reportRuns} rowKey={(row) => value(row, 'id')} />
      )}
    </div>
  );
}
