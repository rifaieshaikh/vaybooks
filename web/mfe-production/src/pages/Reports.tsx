import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProductionReportsCatalogQuery, useRunProductionReportMutation } from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { downloadCsv, extractError } from '../utils';

export function ProductionReportsPage() {
  const { data: catalog, isLoading: catalogLoading, error: catalogError } =
    useProductionReportsCatalogQuery();
  const [runReport, runState] = useRunProductionReportMutation();
  const [reportType, setReportType] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [runError, setRunError] = useState('');

  const types = catalog?.report_types || [];
  const reports = catalog?.reports || [];

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({ key, header: key }));
  }, [rows]);

  async function onRun() {
    setRunError('');
    const selected = reportType || types[0] || '';
    const match = reports.find((r) => r.title === selected);
    try {
      const result = await runReport({
        report_id: match?.id || selected,
        report_type: selected,
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
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>
        Production Reports
      </h2>
      {catalogLoading && <p>Loading catalog…</p>}
      {catalogError ? <ErrorText>Failed to load report catalog.</ErrorText> : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <FormRow label="Report">
          <select
            value={reportType || types[0] || ''}
            onChange={(e) => setReportType(e.target.value)}
            style={{ minWidth: 240, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
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

      {runError ? <ErrorText>{runError}</ErrorText> : null}
      {!runState.isLoading && rows.length === 0 && !runError ? (
        <p style={{ color: '#667' }}>Pick a report and run it.</p>
      ) : null}
      {rows.length > 0 ? (
        <>
          <div style={{ marginBottom: 8, color: '#667' }}>
            {rows.length} row{rows.length === 1 ? '' : 's'}
          </div>
          <DataTable columns={columns} data={rows} rowKey={(row) => JSON.stringify(row)} />
        </>
      ) : null}
    </div>
  );
}

export function ProductionScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ margin: '0 0 12px', color: 'var(--vb-color-primary, #185c4c)' }}>
        Scheduled Production Reports
      </h2>
      <p style={{ color: '#567', maxWidth: 620 }}>
        Recurring production reports are configured from the shared scheduler module. Create or manage
        a scheduled job there and pick a production report type.
      </p>
      <Link
        to="/schedulers/production"
        style={{
          display: 'inline-block',
          marginTop: 12,
          color: 'var(--vb-color-primary, #185c4c)',
          fontWeight: 600,
        }}
      >
        Open production schedulers →
      </Link>
    </div>
  );
}
