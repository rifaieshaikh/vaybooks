import { useMemo, useState } from 'react';
import { useRunSalesReportMutation, useSalesReportsCatalogQuery } from '@vaybooks/store';
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
import { downloadCsv, extractError } from '../utils';
import { ModuleScheduledReportsPanel } from './ScheduledReportsPanel';

export function SalesReportsPage() {
  const { data: catalog, isLoading: catalogLoading, error: catalogError } =
    useSalesReportsCatalogQuery();
  const [runReport, runState] = useRunSalesReportMutation();
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
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Sales"
        title="Reports"
        count={rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : undefined}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => downloadCsv('sales-report.csv', rows)}
              disabled={rows.length === 0}
            >
              Export CSV
            </Button>
            <Button type="button" onClick={onRun} disabled={runState.isLoading || types.length === 0}>
              {runState.isLoading ? 'Running…' : 'Run report'}
            </Button>
          </>
        }
        summary={
          <div className="el-pulse" style={{ alignItems: 'flex-end', gap: '1rem' }}>
            <FormRow label="Report type">
              <select
                className="vb-control"
                value={reportType || types[0] || ''}
                onChange={(e) => setReportType(e.target.value)}
                style={{ minWidth: 240 }}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>
        }
      />

      {catalogLoading ? <EntityListLoading>Loading catalog…</EntityListLoading> : null}
      {catalogError ? <ErrorText>Failed to load report catalog.</ErrorText> : null}
      {runError ? <ErrorText>{runError}</ErrorText> : null}
      {runState.isLoading ? <EntityListLoading>Running report…</EntityListLoading> : null}

      {!catalogLoading && !runState.isLoading && rows.length === 0 && !runError ? (
        <EntityListEmpty>
          <strong>No results yet</strong>
          <p>Pick a report type and run it to see rows here.</p>
        </EntityListEmpty>
      ) : null}

      {rows.length > 0 ? (
        <DataTable columns={columns} data={rows} rowKey={(row) => JSON.stringify(row)} />
      ) : null}
    </EntityListPage>
  );
}

export function SalesScheduledReportsPage() {
  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero kicker="Sales" title="Scheduled reports" />
      <ModuleScheduledReportsPanel module="sales" showSchedulersLink />
    </EntityListPage>
  );
}
