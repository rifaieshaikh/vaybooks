import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCrmReportsCatalogQuery, useRunCrmReportMutation } from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export function CrmReportsPage() {
  const { data: catalog, isLoading, error } = useCrmReportsCatalogQuery();
  const [runReport, runState] = useRunCrmReportMutation();
  const [reportId, setReportId] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [runError, setRunError] = useState('');

  const reports = catalog?.reports || [];

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({ key, header: key }));
  }, [rows]);

  async function onRun() {
    setRunError('');
    try {
      const id = reportId || reports[0]?.id;
      if (!id) return;
      const result = await runReport({ report_id: id, filters: {} }).unwrap();
      setRows(Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : []);
    } catch (e) {
      setRunError(extractError(e));
      setRows([]);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>CRM Reports</h2>
      {isLoading && <p>Loading catalog…</p>}
      {error ? <ErrorText>Failed to load report catalog.</ErrorText> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <FormRow label="Report">
          <select
            value={reportId || reports[0]?.id || ''}
            onChange={(e) => setReportId(e.target.value)}
            style={{ minWidth: 280, padding: 8 }}
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </FormRow>
        <Button type="button" onClick={onRun} disabled={runState.isLoading || reports.length === 0}>
          {runState.isLoading ? 'Running…' : 'Run'}
        </Button>
      </div>
      {runError ? <ErrorText>{runError}</ErrorText> : null}
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

export function CrmScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>CRM Scheduled Reports</h2>
      <p>
        Configure recurring CRM report jobs in{' '}
        <Link to="/schedulers/crm">Schedulers → CRM</Link>.
      </p>
    </div>
  );
}
