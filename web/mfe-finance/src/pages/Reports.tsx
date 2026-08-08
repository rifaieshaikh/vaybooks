import { useMemo, useState } from 'react';
import {
  useFinanceReportsCatalogQuery,
  useFinanceTrialBalanceQuery,
  useRunFinanceReportMutation,
} from '@vaybooks/store';
import {
  Button,
  DataTable,
  ErrorText,
  FormRow,
  ListToolbar,
  type DataTableColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, downloadCsv, extractError, formatMoney } from '../utils';


const DEFAULT_TB_FILTERS = { account_name: '', account_type: '' };
const DEFAULT_TB_SORT: SortCriterion[] = [{ key: 'account_name', desc: false }];

export function TrialBalancePage() {
  const { data, isLoading, error, refetch } = useFinanceTrialBalanceQuery();
  const [filters, setFilters] = useState({ ...DEFAULT_TB_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_TB_SORT);

  const rows = useMemo(() => {
    const raw = data && Array.isArray(data.rows) ? (data.rows as Record<string, unknown>[]) : [];
    return raw.filter((row) => {
      if (
        filters.account_name &&
        !String(row.account_name || '').toLowerCase().includes(filters.account_name.toLowerCase())
      ) {
        return false;
      }
      if (filters.account_type && String(row.account_type) !== filters.account_type) return false;
      return true;
    });
  }, [data, filters]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    const key = sort[0]?.key || 'account_name';
    const desc = sort[0]?.desc ?? false;
    copy.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number') return desc ? bv - av : av - bv;
      const as = String(av ?? '').toLowerCase();
      const bs = String(bv ?? '').toLowerCase();
      if (as < bs) return desc ? 1 : -1;
      if (as > bs) return desc ? -1 : 1;
      return 0;
    });
    return copy;
  }, [rows, sort]);

  const totals = (data?.totals as { debit?: number; credit?: number } | undefined) || {};
  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'account_name', label: 'Account', type: 'text' },
      { key: 'account_type', label: 'Type', type: 'text' },
    ],
    [],
  );

  const columns: DataTableColumn<Record<string, unknown>>[] = [
    { key: 'account_name', header: 'Account' },
    { key: 'account_type', header: 'Type' },
    { key: 'debit', header: 'Debit' },
    { key: 'credit', header: 'Credit' },
  ];

  const displayRows = useMemo(
    () =>
      sorted.map((row, i) => ({
        ...row,
        id: String(row.account_name || i),
        debit: formatMoney(Number(row.debit ?? 0)),
        credit: formatMoney(Number(row.credit ?? 0)),
      })),
    [sorted],
  );

  return (
    <div>
      <ListToolbar
        title="Trial Balance"
        countLabel="accounts"
        count={sorted.length}
        primaryLabel="Refresh"
        onPrimary={() => refetch()}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_TB_FILTERS}
        onFiltersChange={(next) => setFilters(next as typeof filters)}
        sort={sort}
        defaultSort={DEFAULT_TB_SORT}
        sortOptions={[
          { value: 'account_name', label: 'Account' },
          { value: 'account_type', label: 'Type' },
          { value: 'debit', label: 'Debit' },
          { value: 'credit', label: 'Credit' },
        ]}
        onSortChange={setSort}
      />
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load trial balance.</ErrorText> : null}
      {!isLoading && !error && (
        <>
          <p style={{ color: '#667' }}>
            Totals — Debit {formatMoney(Number(totals.debit ?? 0))} · Credit{' '}
            {formatMoney(Number(totals.credit ?? 0))}
          </p>
          <DataTable columns={columns} data={displayRows} rowKey={(row) => String(row.id)} />
        </>
      )}
    </div>
  );
}

export function FinanceReportsPage() {
  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useFinanceReportsCatalogQuery();
  const [runReport, { isLoading: running }] = useRunFinanceReportMutation();
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
    return Object.keys(rows[0])
      .filter((k) => k !== '_rowKey')
      .map((key) => ({
        key,
        header: key
          .split('_')
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
          .join(' '),
      }));
  }, [rows]);

  const tableRows = useMemo(
    () =>
      rows.map((row, i) => {
        const cleaned: Record<string, unknown> = { _rowKey: String(i) };
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'string' && (key === 'description' || key.includes('desc'))) {
            cleaned[key] = asCaption(value);
          } else if (value != null && typeof value === 'object') {
            cleaned[key] = '';
          } else {
            cleaned[key] = value;
          }
        }
        return cleaned;
      }),
    [rows],
  );

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
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>Finance Reports</h2>
      {catalogLoading && <p>Loading report catalog…</p>}
      {catalogError ? <ErrorText>Failed to load the report catalog.</ErrorText> : null}

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
        <Button type="button" onClick={() => void runSelectedReport()} disabled={running}>
          {running ? 'Running…' : 'Run'}
        </Button>
        {hasRun && rows.length > 0 ? (
          <Button type="button" variant="ghost" onClick={() => downloadCsv(`finance-${reportType}.csv`, rows)}>
            Download CSV
          </Button>
        ) : null}
      </div>

      {runError ? <ErrorText>{runError}</ErrorText> : null}
      {hasRun && !runError ? (
        <p style={{ color: '#667' }}>
          {rowCount ?? 0} row{(rowCount ?? 0) === 1 ? '' : 's'}
        </p>
      ) : null}
      {tableRows.length > 0 ? (
        <DataTable columns={columns} data={tableRows} rowKey={(row) => String(row._rowKey)} />
      ) : null}
    </div>
  );
}

export function ExportBackupPage() {
  const exports = [
    { entity: 'accounts', label: 'Accounts CSV', hint: 'Chart of accounts with balances' },
    { entity: 'vouchers', label: 'Vouchers CSV', hint: 'All posted vouchers' },
    { entity: 'trial-balance', label: 'Trial Balance CSV', hint: 'Debit/credit balances' },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>Export / Backup</h2>
      <p style={{ color: '#667', marginTop: 0 }}>
        Download key finance entities as CSV. Full Drive backup remains out of scope for this wave.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginTop: 20,
        }}
      >
        {exports.map((item) => (
          <div
            key={item.entity}
            style={{
              border: '1px solid #d9e3de',
              borderRadius: 10,
              background: '#fff',
              padding: '1rem 1.1rem',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 650 }}>{item.label}</div>
            <div style={{ fontSize: 13, color: '#667' }}>{item.hint}</div>
            <Button
              type="button"
              onClick={() => {
                window.open(`/api/finance/export?entity=${encodeURIComponent(item.entity)}`, '_blank');
              }}
            >
              Download
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
