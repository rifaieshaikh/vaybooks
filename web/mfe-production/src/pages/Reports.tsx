import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProductionReportsCatalogQuery, useRunProductionReportMutation } from '@vaybooks/store';
import {
  Button,
  DataTable,
  EntityListEmpty,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  ErrorText,
  FormRow,
  type DataTableColumn,
} from '@vaybooks/ui-kit';
import { isoToday, periodRange } from '../status';
import { downloadCsv, extractError } from '../utils';

const REPORT_HINTS: Record<string, string> = {
  'Batch Register': 'Use when reviewing all batches and costs in a period.',
  'Batch Cost Sheet': 'Use when checking cost allocation per output.',
  'Batch Margin': 'Use when ranking posted batches by expected margin.',
  'Yield vs Recipe (variance)': 'Use when actual output differs from the recipe.',
  'Production Expenses (by type / activity)': 'Use when analysing labour, power, and other batch expenses.',
  'Output Summary (by product / period)': 'Use when summarising finished goods produced.',
  'RM Consumption': 'Use when reviewing raw material usage and cost.',
  'WIP / Unposted Batches': 'Use when clearing open work-in-progress.',
  'Cost per Unit Trend': 'Use when tracking finished-goods unit cost over time.',
  'Recipe Master List': 'Use when auditing recipe / BOM definitions.',
};

function humanHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProductionReportsPage() {
  const { data: catalog, isLoading: catalogLoading, error: catalogError } =
    useProductionReportsCatalogQuery();
  const [runReport, runState] = useRunProductionReportMutation();
  const [reportType, setReportType] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [runError, setRunError] = useState('');
  const range = periodRange('month');

  const types = catalog?.report_types || [];
  const reports = catalog?.reports || [];
  const selected = reportType || types[0] || '';

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({ key, header: humanHeader(key) }));
  }, [rows]);

  async function onRun() {
    setRunError('');
    const match = reports.find((r) => r.title === selected);
    try {
      const result = await runReport({
        report_id: match?.id || selected,
        report_type: selected,
        filters: {
          date_range: [range.start_date || isoToday(), range.end_date || isoToday()],
        },
      }).unwrap();
      setRows(Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : []);
    } catch (e) {
      setRunError(extractError(e));
      setRows([]);
    }
  }

  return (
    <EntityListPage className="el-page--production">
      <EntityListHero
        kicker="Production"
        title="Reports"
        count="Operational production reports with CSV export"
      />

      {catalogLoading ? <EntityListLoading>Loading catalog…</EntityListLoading> : null}
      {catalogError ? <ErrorText>Failed to load report catalog.</ErrorText> : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
        <FormRow label="Report">
          <select
            className="vb-control"
            value={selected}
            onChange={(e) => setReportType(e.target.value)}
            style={{ minWidth: 260 }}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        <Button type="button" onClick={() => void onRun()} disabled={runState.isLoading || types.length === 0}>
          {runState.isLoading ? 'Running…' : 'Run'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => downloadCsv('production-report.csv', rows)}
          disabled={rows.length === 0}
        >
          Export CSV
        </Button>
      </div>

      {selected ? (
        <p style={{ color: 'var(--vb-color-muted, #667)', marginTop: 0 }}>
          {REPORT_HINTS[selected] || 'Run this report for the last 30 days.'}
        </p>
      ) : null}

      {runError ? <ErrorText>{runError}</ErrorText> : null}
      {!runState.isLoading && rows.length === 0 && !runError ? (
        <EntityListEmpty>
          <strong>Pick a report and run it.</strong>
        </EntityListEmpty>
      ) : null}
      {rows.length > 0 ? (
        <>
          <div style={{ marginBottom: 8, color: 'var(--vb-color-muted, #667)' }}>
            {rows.length} row{rows.length === 1 ? '' : 's'}
          </div>
          <DataTable columns={columns} data={rows} rowKey={(row) => JSON.stringify(row)} />
        </>
      ) : null}
    </EntityListPage>
  );
}

export function ProductionScheduledReportsPage() {
  return (
    <EntityListPage className="el-page--production">
      <EntityListHero
        kicker="Production"
        title="Scheduled reports"
        count="Recurring production reports live in Schedulers"
      />
      <p style={{ color: 'var(--vb-color-muted, #667)', maxWidth: 620 }}>
        Create or manage scheduled production report jobs in the shared scheduler module.
      </p>
      <Link to="/schedulers/production?panel=reports">
        <Button type="button">Open production schedulers</Button>
      </Link>
    </EntityListPage>
  );
}
