import { useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Button,
  EntityDetailPanel,
  EntityListEmpty,
  EntityListLoading,
  StatusPill,
} from '@vaybooks/ui-kit';
import { downloadCsv } from '../utils';
import './BreakdownPanel.css';

export type BreakdownRangePreset = 'mtd' | '30' | '90' | 'all' | 'custom';
export type BreakdownGrain = 'day' | 'week' | 'month';

/** `money` | `qty` | `customization` — controls default columns, chart lines, and filters. */
export type BreakdownMode = 'money' | 'qty' | 'customization';

export type BreakdownRangeState = {
  preset: BreakdownRangePreset;
  setPreset: (p: BreakdownRangePreset) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  start?: string;
  end?: string;
  grain: BreakdownGrain;
  label: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mtdRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function lastNDays(n: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (n - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

function grainForPreset(preset: BreakdownRangePreset): BreakdownGrain {
  if (preset === 'mtd') return 'day';
  if (preset === '30') return 'week';
  return 'month';
}

/** Shared date-range/grain state for a Product 360 / SKU 360 page's breakdown tabs. */
export function useBreakdownRange(defaultPreset: BreakdownRangePreset = '90'): BreakdownRangeState {
  const [preset, setPreset] = useState<BreakdownRangePreset>(defaultPreset);
  const [customStart, setCustomStart] = useState(() => lastNDays(90).start);
  const [customEnd, setCustomEnd] = useState(() => lastNDays(90).end);

  const range = useMemo(() => {
    if (preset === 'all') return { start: undefined as string | undefined, end: undefined as string | undefined };
    if (preset === 'mtd') return mtdRange();
    if (preset === '30') return lastNDays(30);
    if (preset === 'custom') return { start: customStart, end: customEnd };
    return lastNDays(90);
  }, [preset, customStart, customEnd]);

  const grain = grainForPreset(preset);
  const label =
    preset === 'all' ? 'All time' : `${range.start || '…'} → ${range.end || '…'}`;

  return {
    preset,
    setPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    start: range.start,
    end: range.end,
    grain,
    label,
  };
}

function money(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slugPart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entity'
  );
}

type BreakdownRow = Record<string, unknown>;

export type BreakdownPanelProps = {
  /** Panel title, e.g. "Sales breakdown". */
  title: string;
  /** Short label used in the note + CSV filename, e.g. "Sales", "Purchases". */
  metricLabel: string;
  mode: BreakdownMode;
  range: BreakdownRangeState;
  /** Raw `{ rows, trend, totals }` breakdown query response. */
  data: Record<string, unknown> | undefined;
  isLoading: boolean;
  /** Slug base for downloaded CSV filenames, e.g. product or SKU name. */
  entitySlug: string;
  searchPlaceholder?: string;
  hideZerosDefault?: boolean;
  emptyMessage?: string;
  headerExtra?: ReactNode;
};

export function BreakdownPanel({
  title,
  metricLabel,
  mode,
  range,
  data,
  isLoading,
  entitySlug,
  searchPlaceholder,
  hideZerosDefault,
  emptyMessage,
  headerExtra,
}: BreakdownPanelProps) {
  const [search, setSearch] = useState('');
  const [hideZeros, setHideZeros] = useState(hideZerosDefault ?? mode !== 'customization');

  const rows = useMemo(
    () => (Array.isArray((data as { rows?: unknown[] } | undefined)?.rows)
      ? ((data as { rows: BreakdownRow[] }).rows || [])
      : []),
    [data],
  );
  const trend = useMemo(
    () => (Array.isArray((data as { trend?: unknown[] } | undefined)?.trend)
      ? ((data as { trend: BreakdownRow[] }).trend || [])
      : []),
    [data],
  );
  const totals = ((data as { totals?: Record<string, unknown> } | undefined)?.totals || {}) as Record<
    string,
    unknown
  >;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (mode === 'customization') {
        if (hideZeros && Number(row.count ?? 0) === 0) return false;
        if (!q) return true;
        return String(row.status || '').toLowerCase().includes(q);
      }
      if (hideZeros && Number(row.qty ?? 0) === 0 && Number(row.amount ?? 0) === 0) return false;
      if (!q) return true;
      return (
        String(row.product_name || '').toLowerCase().includes(q) ||
        String(row.sku || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, hideZeros, mode]);

  function onDownload() {
    if (filteredRows.length === 0) return;
    const mapped = filteredRows.map((row) =>
      mode === 'customization'
        ? { status: row.status, count: row.count, sell_amount: row.sell_amount }
        : mode === 'qty'
          ? { product: row.product_name, sku: row.sku, qty: row.qty }
          : { product: row.product_name, sku: row.sku, qty: row.qty, amount: row.amount },
    );
    downloadCsv(
      `${slugPart(entitySlug)}-${slugPart(metricLabel)}-${range.start || 'all'}_${range.end || 'all'}.csv`,
      mapped,
    );
  }

  return (
    <EntityDetailPanel
      title={title}
      note={`${metricLabel} · ${range.label}`}
      headerEnd={
        <div className="bp-header-end">
          {headerExtra}
          <Button
            type="button"
            variant="ghost"
            disabled={filteredRows.length === 0}
            onClick={onDownload}
          >
            Download CSV
          </Button>
        </div>
      }
    >
      <div className="bp-toolbar" role="group" aria-label="Breakdown date range">
        <div className="bp-range-chips">
          {(
            [
              ['mtd', 'MTD'],
              ['30', '30 days'],
              ['90', '90 days'],
              ['all', 'All'],
              ['custom', 'Custom'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`bp-chip${range.preset === id ? ' is-active' : ''}`}
              onClick={() => range.setPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {range.preset === 'custom' ? (
          <div className="bp-custom-dates">
            <input
              type="date"
              value={range.customStart}
              onChange={(e) => range.setCustomStart(e.target.value)}
              aria-label="Start date"
            />
            <span>to</span>
            <input
              type="date"
              value={range.customEnd}
              onChange={(e) => range.setCustomEnd(e.target.value)}
              aria-label="End date"
            />
          </div>
        ) : null}
        <span className="bp-range-label">{range.label}</span>
      </div>

      <div className="bp-filters">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            searchPlaceholder || (mode === 'customization' ? 'Search status…' : 'Search product or SKU…')
          }
          aria-label="Search breakdown rows"
        />
        <label className="bp-check">
          <input type="checkbox" checked={hideZeros} onChange={(e) => setHideZeros(e.target.checked)} />
          Hide zeros
        </label>
      </div>

      {isLoading ? <EntityListLoading>Loading {metricLabel.toLowerCase()}…</EntityListLoading> : null}

      {!isLoading && mode === 'customization' ? (
        <p className="bp-summary">
          Total items: {Number(totals.count ?? 0)} · Sell amount: {money(totals.sell_amount)}
        </p>
      ) : null}

      {!isLoading && trend.length > 0 ? (
        <div className="bp-chart">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              {mode === 'qty' ? (
                <YAxis />
              ) : (
                <>
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                </>
              )}
              <Tooltip />
              <Legend />
              {mode === 'qty' ? (
                <Line type="monotone" dataKey="qty" name="Qty" stroke="#185c4c" dot={false} />
              ) : mode === 'customization' ? (
                <>
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    name="Count"
                    stroke="#185c4c"
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sell_amount"
                    name="Sell amount"
                    stroke="#c45c26"
                    dot={false}
                  />
                </>
              ) : (
                <>
                  <Line yAxisId="left" type="monotone" dataKey="qty" name="Qty" stroke="#185c4c" dot={false} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="amount"
                    name="Amount"
                    stroke="#c45c26"
                    dot={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {!isLoading && filteredRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{emptyMessage || 'No data for this range.'}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && filteredRows.length > 0 ? (
        <table className="bp-table">
          <thead>
            {mode === 'customization' ? (
              <tr>
                <th align="left">Status</th>
                <th align="right">Count</th>
                <th align="right">Sell amount</th>
              </tr>
            ) : (
              <tr>
                <th align="left">Product</th>
                <th align="left">SKU</th>
                <th align="right">Qty</th>
                {mode === 'money' ? <th align="right">Amount</th> : null}
              </tr>
            )}
          </thead>
          <tbody>
            {filteredRows.map((row, index) =>
              mode === 'customization' ? (
                <tr key={String(row.status || index)}>
                  <td>
                    <StatusPill status={row.status} />
                  </td>
                  <td align="right">{Number(row.count ?? 0)}</td>
                  <td align="right">{money(row.sell_amount)}</td>
                </tr>
              ) : (
                <tr key={String(row.sku_id || row.product_id || row.sku || index)}>
                  <td>{String(row.product_name || row.product || '—')}</td>
                  <td>{String(row.sku || '—')}</td>
                  <td align="right">{Number(row.qty ?? 0)}</td>
                  {mode === 'money' ? <td align="right">{money(row.amount)}</td> : null}
                </tr>
              ),
            )}
          </tbody>
        </table>
      ) : null}
    </EntityDetailPanel>
  );
}
