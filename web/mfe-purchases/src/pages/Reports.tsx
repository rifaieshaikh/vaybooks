import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePurchasesReportsCatalogQuery, useRunPurchasesReportMutation } from '@vaybooks/store';
import {
  Button,
  DataTable,
  ErrorText,
  FormRow,
  type DataTableColumn,
} from '@vaybooks/ui-kit';
import { downloadCsv, extractError } from '../utils';

export function PurchasesReportsPage() {
  const { data: catalog, isLoading: catalogLoading, error: catalogError } =
    usePurchasesReportsCatalogQuery();
  const [runReport, runState] = useRunPurchasesReportMutation();
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
      setRows(Array.isArray(result.rows) ? result.rows : []);
    } catch (e) {
      setRunError(extractError(e));
      setRows([]);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>Purchase Reports</h2>
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
        <Button type="button" onClick={onRun} disabled={runState.isLoading || types.length === 0}>
          {runState.isLoading ? 'Running…' : 'Run'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => downloadCsv('purchases-report.csv', rows)}
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

export function PurchasesScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ margin: '0 0 12px', color: 'var(--vb-color-primary, #185c4c)' }}>
        Scheduled Purchase Reports
      </h2>
      <p style={{ color: '#567', maxWidth: 620 }}>
        Recurring purchase reports are configured from the shared scheduler module. Create or manage a scheduled job
        there and pick a purchases report type.
      </p>
      <Link
        to="/schedulers/purchases"
        style={{
          display: 'inline-block',
          marginTop: 8,
          padding: '0.5rem 0.9rem',
          borderRadius: 8,
          border: '1px solid #c5d4ce',
          background: '#eef6f2',
          color: '#185c4c',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Open Schedulers → Purchases
      </Link>
    </div>
  );
}
