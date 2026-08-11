import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBoutiqueOverviewQuery } from '@vaybooks/store';
import { Button, ErrorText } from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';
import { boutiqueOrderPath } from '../order-workspace/types';
import './Overview.css';

function mtdRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function lastNDays(n: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (n - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

type Tone = 'neutral' | 'danger' | 'warning' | 'ok';

function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="bo-kpi-label">{label}</span>
      <strong className="bo-kpi-value">{value}</strong>
      {hint ? <em className="bo-kpi-hint">{hint}</em> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`bo-kpi bo-kpi-${tone} is-clickable`} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={`bo-kpi bo-kpi-${tone}`}>{body}</div>;
}

function ChartPanel({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bo-chart">
      <h4>{title}</h4>
      {empty ? <p className="bo-empty">No data in this period.</p> : children}
    </div>
  );
}

function QueueList({
  title,
  emptyLabel,
  rows,
  renderMeta,
  onOpen,
}: {
  title: string;
  emptyLabel: string;
  rows: Record<string, unknown>[];
  renderMeta: (row: Record<string, unknown>) => string;
  onOpen: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="bo-queue">
      <div className="bo-queue-head">
        <h3>{title}</h3>
        <span>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="bo-empty">{emptyLabel}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={String(row.id || row.order_id)}>
              <button type="button" onClick={() => onOpen(row)}>
                <strong>{asCaption(row.order_number) || String(row.id)}</strong>
                <span>{asCaption(row.customer_name) || '—'}</span>
                <em>{renderMeta(row)}</em>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid #d9e3de',
  fontSize: 12,
};

export function BoutiqueOverviewPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<'mtd' | '30' | '90' | 'custom'>('mtd');
  const [customStart, setCustomStart] = useState(() => mtdRange().start);
  const [customEnd, setCustomEnd] = useState(() => mtdRange().end);

  const range = useMemo(() => {
    if (preset === 'mtd') return mtdRange();
    if (preset === '30') return lastNDays(30);
    if (preset === '90') return lastNDays(90);
    return { start: customStart, end: customEnd };
  }, [preset, customStart, customEnd]);

  const { data, isLoading, error, refetch, isFetching } = useBoutiqueOverviewQuery({
    start_date: range.start,
    end_date: range.end,
  });

  const kpis = useMemo(
    () =>
      data && typeof data.kpis === 'object' && data.kpis
        ? (data.kpis as Record<string, unknown>)
        : {},
    [data],
  );
  const charts = useMemo(
    () =>
      data && typeof data.charts === 'object' && data.charts
        ? (data.charts as Record<string, unknown[]>)
        : {},
    [data],
  );
  const overdue = useMemo(
    () =>
      data && Array.isArray(data.overdue_orders)
        ? (data.overdue_orders as Record<string, unknown>[])
        : [],
    [data],
  );
  const pending = useMemo(
    () =>
      data && Array.isArray(data.bills_pending_invoice)
        ? (data.bills_pending_invoice as Record<string, unknown>[])
        : [],
    [data],
  );
  const actions = useMemo(
    () =>
      data && Array.isArray(data.quick_actions)
        ? (data.quick_actions as { to: string; label: string }[])
        : [
            { to: '/boutique/orders', label: 'Orders' },
            { to: '/boutique/measurements', label: 'Measurements' },
            { to: '/boutique/time', label: 'Tasks' },
            { to: '/boutique/time-log', label: 'Time log' },
            { to: '/boutique/calendar', label: 'Calendar' },
            { to: '/boutique/reports', label: 'Reports' },
          ],
    [data],
  );

  const revenueSeries = (charts.invoiced_revenue || []) as { period: string; amount: number }[];
  const hoursSeries = (charts.hours_logged || []) as { period: string; hours: number }[];
  const statusSeries = (charts.status_breakdown || []) as { status: string; count: number }[];
  const deliverySeries = (charts.delivery_on_time || []) as { outcome: string; count: number }[];
  const customerSeries = (charts.top_customers || []) as {
    customer_name: string;
    total_revenue: number;
  }[];
  const workerSeries = (charts.hours_by_worker || []) as {
    worker_name: string;
    total_hours: number;
  }[];

  const openOrders = Number(kpis.open_orders ?? 0);
  const overdueCount = Number(kpis.overdue_orders ?? 0);
  const pendingInvoice = Number(kpis.bills_pending_invoice ?? 0);
  const pendingDelivery = Number(kpis.bills_pending_delivery ?? 0);
  const invoiced = Number(kpis.invoiced_revenue ?? 0);
  const hoursLogged = Number(kpis.hours_logged ?? 0);
  const onTimePct = kpis.on_time_delivery_pct;
  const avgHours =
    openOrders > 0 ? Math.round((hoursLogged / openOrders) * 100) / 100 : null;

  function openOrder(row: Record<string, unknown>) {
    navigate(
      boutiqueOrderPath(
        String(row.id || row.order_id),
        String(row.order_status || row.status || ''),
      ),
    );
  }

  return (
    <div className="bo">
      <header className="bo-hero">
        <div>
          <p className="bo-kicker">Boutique</p>
          <h1>Overview</h1>
          <p className="bo-lead">
            Period {range.start} → {range.end}
            {isFetching && !isLoading ? ' · Updating…' : ''}
          </p>
        </div>
        <div className="bo-hero-actions">
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button type="button" onClick={() => navigate('/boutique/orders')}>
            Orders
          </Button>
        </div>
      </header>

      <div className="bo-range" role="group" aria-label="Date range">
        {(
          [
            ['mtd', 'MTD'],
            ['30', '30 days'],
            ['90', '90 days'],
            ['custom', 'Custom'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`bo-chip${preset === id ? ' is-live' : ''}`}
            onClick={() => setPreset(id)}
          >
            {label}
          </button>
        ))}
        {preset === 'custom' ? (
          <div className="bo-custom-dates">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span>to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        ) : null}
      </div>

      {isLoading ? <p className="bo-lead">Loading overview…</p> : null}
      {error ? <ErrorText>Failed to load boutique overview. Is the API running?</ErrorText> : null}

      {!isLoading && !error ? (
        <>
          <div className="bo-actions">
            {actions.map((a) => (
              <Button key={a.to} type="button" variant="ghost" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>

          <section className="bo-section">
            <h2>Attention</h2>
            <p className="bo-caption">As of now — excludes cancelled orders.</p>
            <div className="bo-kpi-grid">
              <KpiCard
                label="Open orders"
                value={String(openOrders)}
                hint="View orders"
                onClick={() => navigate('/boutique/orders')}
              />
              <KpiCard
                label="Overdue"
                value={String(overdueCount)}
                tone={overdueCount > 0 ? 'danger' : 'ok'}
                hint="Needs delivery attention"
                onClick={() => navigate('/boutique/orders')}
              />
              <KpiCard
                label="Pending invoice"
                value={String(pendingInvoice)}
                tone={pendingInvoice > 0 ? 'warning' : 'neutral'}
                hint="Ready garments"
                onClick={() => navigate('/boutique/orders')}
              />
              <KpiCard
                label="Pending delivery"
                value={String(pendingDelivery)}
                tone={pendingDelivery > 0 ? 'warning' : 'neutral'}
                hint="Invoiced, not delivered"
                onClick={() => navigate('/boutique/orders')}
              />
            </div>
          </section>

          <section className="bo-section">
            <h2>Period</h2>
            <p className="bo-caption">Invoiced revenue and hours use the selected date range.</p>
            <div className="bo-kpi-grid bo-kpi-grid-period">
              <KpiCard label="Invoiced revenue" value={formatMoney(invoiced)} />
              <KpiCard label="Hours logged" value={String(hoursLogged)} />
              <KpiCard
                label="On-time delivery"
                value={onTimePct == null ? '—' : `${onTimePct}%`}
                hint={
                  Number(kpis.deliveries_in_period ?? 0) > 0
                    ? `${Number(kpis.deliveries_in_period)} deliveries`
                    : 'No deliveries in range'
                }
                tone={
                  onTimePct == null ? 'neutral' : Number(onTimePct) >= 80 ? 'ok' : 'warning'
                }
              />
              <KpiCard
                label="Hours / open order"
                value={avgHours == null ? '—' : String(avgHours)}
                hint="Period hours ÷ open orders"
              />
            </div>
          </section>

          <section className="bo-section">
            <h2>Charts</h2>
            <div className="bo-chart-grid">
              <ChartPanel title="Invoiced revenue over time" empty={revenueSeries.length === 0}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={revenueSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebe8" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name="Revenue"
                      stroke="#185c4c"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Hours logged over time" empty={hoursSeries.length === 0}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={hoursSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebe8" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      name="Hours"
                      stroke="#2a7a66"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Order pipeline by status" empty={statusSeries.length === 0}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={statusSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebe8" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Orders" fill="#185c4c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Delivery on-time vs late" empty={deliverySeries.length === 0}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={deliverySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebe8" />
                    <XAxis dataKey="outcome" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Deliveries" fill="#c47a1a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel
                title="Top customers by invoiced revenue"
                empty={customerSeries.length === 0}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={customerSeries} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebe8" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="customer_name"
                      width={90}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar
                      dataKey="total_revenue"
                      name="Revenue"
                      fill="#185c4c"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Hours by worker" empty={workerSeries.length === 0}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={workerSeries} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebe8" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="worker_name"
                      width={90}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar
                      dataKey="total_hours"
                      name="Hours"
                      fill="#2a7a66"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
          </section>

          <section className="bo-section bo-queues">
            <QueueList
              title="Overdue orders"
              emptyLabel="All clear — no overdue orders."
              rows={overdue}
              renderMeta={(row) => `${Number(row.days_overdue ?? 0)} days overdue`}
              onOpen={openOrder}
            />
            <QueueList
              title="Bills pending invoice"
              emptyLabel="All clear — no bills pending invoice."
              rows={pending}
              renderMeta={(row) =>
                asCaption(row.bill_summary || row.pending_bills || row.bills) ||
                `${Number(row.pending_bills ?? 0)} bills pending`
              }
              onOpen={openOrder}
            />
          </section>

          <p className="bo-footer">
            <Link to="/boutique/reports">View full reports →</Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
