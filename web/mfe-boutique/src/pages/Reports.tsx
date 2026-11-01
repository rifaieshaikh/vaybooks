import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBoutiqueReportsCatalogQuery, useRunBoutiqueReportMutation } from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { downloadCsv, extractError } from '../utils';

const DATE_FILTER_REPORTS = new Set(['Completed Orders', 'Time Tracking', 'Worker Productivity']);

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BoutiqueReportsPage() {
  const { data: catalog, isLoading: catalogLoading, error: catalogError } =
    useBoutiqueReportsCatalogQuery();
  const [runReport, runState] = useRunBoutiqueReportMutation();
  const [reportType, setReportType] = useState('');
  const [startDate, setStartDate] = useState(monthStartIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [runError, setRunError] = useState('');

  const types = catalog?.report_types || [];
  const selected = reportType || types[0] || '';
  const needsDates = DATE_FILTER_REPORTS.has(selected);

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({ key, header: key }));
  }, [rows]);

  async function onRun() {
    setRunError('');
    try {
      const filters: Record<string, unknown> = {};
      if (needsDates) {
        filters.start_date = startDate;
        filters.end_date = endDate;
      }
      const result = await runReport({
        report_type: selected,
        filters,
      }).unwrap();
      setRows(Array.isArray(result.rows) ? result.rows : []);
    } catch (e) {
      setRunError(extractError(e));
      setRows([]);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>
        Boutique Reports
      </h2>
      {catalogLoading && <p>Loading catalog…</p>}
      {catalogError ? <ErrorText>Failed to load report catalog.</ErrorText> : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <FormRow label="Report">
          <select
            value={selected}
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
        {needsDates ? (
          <>
            <FormRow label="From">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </FormRow>
            <FormRow label="To">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </FormRow>
          </>
        ) : null}
        <Button type="button" onClick={onRun} disabled={runState.isLoading || types.length === 0}>
          {runState.isLoading ? 'Running…' : 'Run'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => downloadCsv('boutique-report.csv', rows)}
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

export function BoutiqueScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ margin: '0 0 12px', color: 'var(--vb-color-primary, #185c4c)' }}>
        Scheduled Boutique Reports
      </h2>
      <p style={{ color: '#567', maxWidth: 620 }}>
        Recurring boutique reports are configured from the shared scheduler module. Create or manage a
        scheduled job there and pick a boutique report type.
      </p>
      <Link
        to="/schedulers/boutique?panel=reports"
        style={{
          display: 'inline-block',
          marginTop: 8,
          padding: '0.5rem 0.9rem',
          borderRadius: 6,
          background: 'var(--vb-color-primary, #185c4c)',
          color: '#fff',
          textDecoration: 'none',
        }}
      >
        Open boutique schedulers
      </Link>
    </div>
  );
}
