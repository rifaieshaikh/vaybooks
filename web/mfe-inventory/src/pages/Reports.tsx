import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInventoryReportsCatalogQuery, useRunInventoryReportMutation } from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Report failed to run');
  }
  return 'Report failed to run';
}

/** Streamlit parity: pick a report type, run it, view rows, export CSV. */
export function InventoryReportsPage() {
  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useInventoryReportsCatalogQuery();
  const [runReport, { isLoading: running }] = useRunInventoryReportMutation();

  const reportTypes = useMemo(
    () => (catalog && Array.isArray(catalog.report_types) ? catalog.report_types : []),
    [catalog],
  );
  const [reportType, setReportType] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [runError, setRunError] = useState('');
  const [hasRun, setHasRun] = useState(false);

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({
      key,
      header: key
        .split('_')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' '),
    }));
  }, [rows]);

  async function runSelectedReport() {
    setRunError('');
    if (!reportType) {
      setRunError('Choose a report type');
      return;
    }
    try {
      const result = await runReport({ report_type: reportType, filters: {} }).unwrap();
      const nextRows = Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : [];
      setRows(nextRows);
      setRowCount(typeof result.row_count === 'number' ? result.row_count : nextRows.length);
      setHasRun(true);
    } catch (e: unknown) {
      setRunError(extractError(e));
      setRows([]);
      setRowCount(null);
      setHasRun(true);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>Inventory Reports</h2>

      {catalogLoading && <p>Loading report catalog…</p>}
      {catalogError ? <ErrorText>Failed to load the report catalog. Is the API running?</ErrorText> : null}

      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ minWidth: 280 }}>
          <FormRow label="Report type">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
            >
              <option value="">— Choose a report —</option>
              {reportTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
        <Button type="button" onClick={() => void runSelectedReport()} disabled={running || !reportType}>
          {running ? 'Running…' : 'Run Report'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(`${reportType || 'inventory-report'}.csv`, rows)}
        >
          Download CSV
        </Button>
      </div>

      {runError ? <ErrorText>{runError}</ErrorText> : null}

      {hasRun && !runError && (
        <>
          <div style={{ fontSize: 13, color: '#667', marginBottom: 8 }}>
            {rowCount ?? rows.length} row{(rowCount ?? rows.length) === 1 ? '' : 's'}
          </div>
          {rows.length === 0 ? (
            <p>No rows returned for this report.</p>
          ) : (
            <DataTable columns={columns} data={rows} rowKey={(row) => JSON.stringify(row)} />
          )}
        </>
      )}
    </div>
  );
}

/** Streamlit parity: pointer to the shared scheduler module for recurring inventory reports. */
export function InventoryScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ margin: '0 0 12px', color: 'var(--vb-color-primary, #185c4c)' }}>Scheduled Inventory Reports</h2>
      <p style={{ color: '#567', maxWidth: 620 }}>
        Recurring inventory reports (daily stock valuation, low-stock alerts, and more) are configured from the shared
        scheduler module rather than here. Create or manage a scheduled job there and pick an inventory report type.
      </p>
      <Link
        to="/schedulers/inventory?panel=reports"
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
        Open Schedulers → Inventory
      </Link>
    </div>
  );
}
