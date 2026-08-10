import { useMemo, useRef, useState } from 'react';
import {
  baseApi,
  useAppDispatch,
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
      return null;
    }
    try {
      const result = await runReport({ report_type: reportType, filters: {} }).unwrap();
      const nextRows = Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : [];
      setRows(nextRows);
      setRowCount(typeof result.row_count === 'number' ? result.row_count : nextRows.length);
      setHasRun(true);
      return nextRows;
    } catch (e: unknown) {
      setRunError(extractError(e));
      setRows([]);
      setRowCount(null);
      setHasRun(true);
      return null;
    }
  }

  async function exportReportCsv() {
    let exportRows = rows;
    if (exportRows.length === 0 && reportType) {
      const next = await runSelectedReport();
      if (next) exportRows = next;
    }
    if (exportRows.length > 0) {
      downloadCsv(`finance-${reportType}.csv`, exportRows);
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
              data-kb-action="reports.select"
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
        {reportType ? (
          <Button
            type="button"
            variant="ghost"
            data-kb-action="reports.export"
            onClick={() => void exportReportCsv()}
            disabled={running}
          >
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
  const dispatch = useAppDispatch();
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [exportBusy, setExportBusy] = useState<string | null>(null);

  const financeExports = [
    { entity: 'accounts', label: 'Accounts CSV', hint: 'Chart of accounts with balances', kb: 'export.backup.save_disk' },
    { entity: 'vouchers', label: 'Vouchers CSV', hint: 'All posted vouchers', kb: 'export.backup.json' },
    { entity: 'trial-balance', label: 'Trial Balance CSV', hint: 'Debit/credit balances', kb: 'export.backup.zip' },
  ];

  const clientExports = [
    { id: 'customers', label: 'Customers CSV', hint: 'Party master export', kb: 'export.csv.customers' },
    { id: 'orders', label: 'Orders CSV', hint: 'Boutique orders export', kb: 'export.csv.orders' },
    { id: 'products', label: 'Products CSV', hint: 'Inventory products export', kb: 'export.csv.products' },
    { id: 'vendors', label: 'Vendors CSV', hint: 'Vendor master export', kb: 'export.csv.vendors' },
  ] as const;

  function pagedRows(data: unknown): Record<string, unknown>[] {
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (data && typeof data === 'object') {
      const items = (data as { items?: unknown }).items;
      if (Array.isArray(items)) return items as Record<string, unknown>[];
    }
    return [];
  }

  async function exportClientCsv(id: (typeof clientExports)[number]['id']) {
    setExportBusy(id);
    try {
      let rows: Record<string, unknown>[] = [];
      if (id === 'customers') {
        rows = (await dispatch(baseApi.endpoints.listCustomers.initiate(undefined)).unwrap()) as Record<
          string,
          unknown
        >[];
      } else if (id === 'vendors') {
        rows = (await dispatch(baseApi.endpoints.listVendors.initiate(undefined)).unwrap()) as Record<
          string,
          unknown
        >[];
      } else if (id === 'products') {
        rows = (await dispatch(baseApi.endpoints.listInventoryProducts.initiate(undefined)).unwrap()) as Record<
          string,
          unknown
        >[];
      } else if (id === 'orders') {
        const page = await dispatch(
          baseApi.endpoints.listBoutiqueOrders.initiate({ page: 1, page_size: 500 }),
        ).unwrap();
        rows = pagedRows(page);
      }
      if (rows.length === 0) {
        window.alert(`No ${id} to export.`);
        return;
      }
      downloadCsv(`${id}.csv`, rows);
    } catch {
      window.alert(`Failed to export ${id}.`);
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>Export / Backup</h2>
      <p style={{ color: '#667', marginTop: 0 }}>
        Download finance entities from the server, or export party/inventory lists as CSV from the API.
      </p>

      <h3 style={{ margin: '24px 0 12px', fontSize: '1rem' }}>Finance exports</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {financeExports.map((item) => (
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
              data-kb-action={item.kb}
              onClick={() => {
                window.open(`/api/finance/export?entity=${encodeURIComponent(item.entity)}`, '_blank');
              }}
            >
              Download
            </Button>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '24px 0 12px', fontSize: '1rem' }}>Master data CSV</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {clientExports.map((item) => (
          <div
            key={item.id}
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
              data-kb-action={item.kb}
              disabled={exportBusy === item.id}
              onClick={() => void exportClientCsv(item.id)}
            >
              {exportBusy === item.id ? 'Exporting…' : 'Download CSV'}
            </Button>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '24px 0 12px', fontSize: '1rem' }}>Restore</h3>
      <p style={{ color: '#667', marginTop: 0 }}>
        Full ZIP backup restore is available in the desktop app only — not on web.
      </p>
      <input
        ref={restoreInputRef}
        type="file"
        accept=".zip,.json"
        hidden
        onChange={() => {
          setRestoreMsg('ZIP backup restore is desktop-only and is not available in the web app.');
          if (restoreInputRef.current) restoreInputRef.current.value = '';
        }}
      />
      <Button
        type="button"
        variant="ghost"
        data-kb-action="export.backup.restore"
        onClick={() => restoreInputRef.current?.click()}
      >
        Choose backup file…
      </Button>
      {restoreMsg ? <p style={{ marginTop: 12, color: '#667' }}>{restoreMsg}</p> : null}
    </div>
  );
}
