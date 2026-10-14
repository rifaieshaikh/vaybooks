import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHomeDashboardQuery, useHomeMtdQuery, useReportsCatalogQuery } from '@vaybooks/store';
import { Button, DataTable, ErrorText, type DataTableColumn } from '@vaybooks/ui-kit';

function Kpi({ label, value, to }: { label: string; value: string; to?: string }) {
  const content = (
    <>
      <div style={{ fontSize: 13, color: '#667' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--vb-color-primary, #185c4c)' }}>{value}</div>
    </>
  );
  return (
    <div
      style={{
        border: '1px solid #d9e3de',
        borderRadius: 10,
        background: '#fff',
        padding: '1rem 1.1rem',
        display: 'grid',
        gap: 6,
      }}
    >
      {to ? (
        <Link to={to} style={{ color: 'inherit', textDecoration: 'none' }}>
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

const PERIODS = [
  { id: 'today', label: 'Today', kb: 'dashboard.period.today' },
  { id: 'last_7d', label: 'Last 7d', kb: 'dashboard.period.last_7d' },
  { id: 'mtd', label: 'MTD', kb: 'dashboard.period.mtd' },
  { id: 'last_30d', label: 'Last 30d', kb: 'dashboard.period.last_30d' },
  { id: 'quarter', label: 'Quarter', kb: 'dashboard.period.quarter' },
] as const;

function metricValue(metrics: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = metrics[key];
    if (v != null && v !== '') return String(v);
  }
  return '0';
}

function periodKpiLabel(base: string, period: string): string {
  const p = PERIODS.find((x) => x.id === period);
  if (period === 'mtd') return `${base} (MTD)`;
  if (p) return `${base} (${p.label})`;
  return base;
}

export function HomeDashboardPage() {
  const { data, isLoading, error, refetch } = useHomeDashboardQuery();
  const metrics = (data?.metrics as Record<string, unknown>) || {};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Dashboard</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/mtd-dashboard">MTD</Link>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load dashboard.</ErrorText> : null}
      {!isLoading && !error && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <Kpi label="Active orders" value={String(metrics.active_orders ?? 0)} to="/boutique/orders" />
          <Kpi label="MTD invoices" value={String(metrics.total_invoice_this_month ?? 0)} to="/sales/invoices" />
          <Kpi label="MTD advances" value={String(metrics.total_advance_this_month ?? 0)} to="/boutique/orders" />
          <Kpi label="Pending activities" value={String(metrics.total_pending_activities ?? 0)} to="/boutique/time" />
          <Kpi label="Low stock" value={String(metrics.inventory_low_stock_count ?? 0)} to="/inventory/stock" />
          <Kpi label="CRM leads" value={String(metrics.crm_active_leads ?? 0)} to="/crm/leads" />
          <Kpi label="Sales orders" value={String(metrics.sales_orders ?? 0)} to="/sales/orders" />
          <Kpi label="Purchase orders" value={String(metrics.purchase_orders ?? 0)} to="/purchases/orders" />
        </div>
      )}
    </div>
  );
}

export function MtdDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'mtd';
  const { data, isLoading, error, refetch } = useHomeMtdQuery({ period });
  const metrics = (data?.metrics as Record<string, unknown>) || {};

  useEffect(() => {
    if (!searchParams.get('period')) {
      setSearchParams({ period: 'mtd' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>MTD Dashboard</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/">Dashboard</Link>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="el-btn-ghost"
            data-kb-action={p.kb}
            aria-pressed={period === p.id}
            style={{
              fontWeight: period === p.id ? 700 : 500,
              borderColor: period === p.id ? 'var(--vb-color-primary, #185c4c)' : undefined,
            }}
            onClick={() => setSearchParams({ period: p.id })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p style={{ color: '#667', marginTop: 0 }}>
        Period: <strong>{PERIODS.find((p) => p.id === period)?.label || period}</strong>
      </p>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load MTD dashboard.</ErrorText> : null}
      {!isLoading && !error && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <Kpi
            label={periodKpiLabel('Orders created', period)}
            value={metricValue(metrics, ['orders_created', 'orders_created_this_month'])}
            to="/boutique/orders"
          />
          <Kpi
            label={periodKpiLabel('Delivered', period)}
            value={metricValue(metrics, ['delivered', 'delivered_this_month'])}
            to="/sales/delivery-notes"
          />
          <Kpi
            label={periodKpiLabel('Invoiced', period)}
            value={metricValue(metrics, ['invoiced', 'total_invoice_this_month'])}
            to="/sales/invoices"
          />
          <Kpi
            label={periodKpiLabel('Advances', period)}
            value={metricValue(metrics, ['advances', 'total_advance_this_month'])}
            to="/boutique/orders"
          />
          <Kpi
            label={periodKpiLabel('Stock movements', period)}
            value={metricValue(metrics, ['inventory_movements', 'inventory_movements_this_month'])}
            to="/inventory/movements"
          />
          <Kpi
            label={periodKpiLabel('Revenue', period)}
            value={metricValue(metrics, ['revenue', 'revenue_this_month'])}
            to="/finance/reports"
          />
        </div>
      )}
    </div>
  );
}

export function ReportsCatalogPage() {
  const { data, isLoading, error, refetch } = useReportsCatalogQuery();
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'title', header: 'Report' },
      { key: 'module', header: 'Module' },
      { key: 'href', header: 'Open' },
    ],
    [],
  );
  const rows = useMemo(
    () =>
      (data?.reports || []).map((r) => {
        const row = r as { id: string; title: string; module?: string; href?: string };
        return {
          id: row.id,
          title: row.title,
          module: row.module || '',
          href: row.href || '',
        };
      }),
    [data],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Reports</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <p style={{ marginBottom: 16 }}>Cross-module catalog — open a module report page.</p>
      {isLoading && <p>Loading catalog…</p>}
      {error ? <ErrorText>Failed to load catalog.</ErrorText> : null}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
        {rows.map((r) => (
          <li key={r.id}>
            {r.href ? (
              <Link to={r.href} style={{ color: 'var(--vb-color-primary, #185c4c)' }}>
                {r.title} {r.module ? `(${r.module})` : ''}
              </Link>
            ) : (
              <span>{r.title}</span>
            )}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 24 }}>
        <DataTable columns={columns} data={rows} rowKey={(row) => String(row.id)} />
      </div>
    </div>
  );
}
