import { useMemo } from 'react';
import {
  useProductionDayBookQuery,
  useProductionMarginsQuery,
  useProductionYieldQuery,
} from '@vaybooks/store';
import { DataTable, ErrorText, type DataTableColumn } from '@vaybooks/ui-kit';
import { formatMoney } from '../utils';

function SimpleTable({
  title,
  rows,
  loading,
  error,
}: {
  title: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  error: unknown;
}) {
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({ key, header: key }));
  }, [rows]);

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>{title}</h2>
      {loading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load {title.toLowerCase()}.</ErrorText> : null}
      {!loading && !error && rows.length === 0 ? (
        <p style={{ color: '#667' }}>No rows yet.</p>
      ) : null}
      {rows.length > 0 ? (
        <DataTable columns={columns} data={rows} rowKey={(row) => JSON.stringify(row)} />
      ) : null}
    </div>
  );
}

export function ProductionDayBookPage() {
  const { data = [], isLoading, error } = useProductionDayBookQuery();
  const rows = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        date: String(row.date || '').slice(0, 10),
        debit: formatMoney(Number(row.debit ?? 0)),
        credit: formatMoney(Number(row.credit ?? 0)),
      })),
    [data],
  );
  return <SimpleTable title="Production Day Book" rows={rows} loading={isLoading} error={error} />;
}

export function ProductionMarginsPage() {
  const { data = [], isLoading, error } = useProductionMarginsQuery();
  const rows = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        date: String(row.date || '').slice(0, 10),
        total_cost: formatMoney(Number(row.total_cost ?? 0)),
        expected_sales_value: formatMoney(Number(row.expected_sales_value ?? 0)),
        margin: formatMoney(Number(row.margin ?? 0)),
      })),
    [data],
  );
  return (
    <SimpleTable title="Production Cost & Margin" rows={rows} loading={isLoading} error={error} />
  );
}

export function ProductionYieldPage() {
  const { data = [], isLoading, error } = useProductionYieldQuery();
  const rows = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        date: String(row.date || '').slice(0, 10),
      })),
    [data],
  );
  return (
    <SimpleTable title="Production Yield & Variance" rows={rows} loading={isLoading} error={error} />
  );
}
