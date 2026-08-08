import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useHomeDashboardQuery, useHomeMtdQuery, useReportsCatalogQuery } from '@vaybooks/store';
import { Button, DataTable, ErrorText, type DataTableColumn } from '@vaybooks/ui-kit';

function Kpi({ label, value }: { label: string; value: string }) {
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
      <div style={{ fontSize: 13, color: '#667' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--vb-color-primary, #185c4c)' }}>{value}</div>
    </div>
  );
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
          <Kpi label="Active orders" value={String(metrics.active_orders ?? 0)} />
          <Kpi label="MTD invoices" value={String(metrics.total_invoice_this_month ?? 0)} />
          <Kpi label="MTD advances" value={String(metrics.total_advance_this_month ?? 0)} />
          <Kpi label="Pending activities" value={String(metrics.total_pending_activities ?? 0)} />
          <Kpi label="Low stock" value={String(metrics.inventory_low_stock_count ?? 0)} />
          <Kpi label="CRM leads" value={String(metrics.crm_active_leads ?? 0)} />
          <Kpi label="Sales orders" value={String(metrics.sales_orders ?? 0)} />
          <Kpi label="Purchase orders" value={String(metrics.purchase_orders ?? 0)} />
        </div>
      )}
    </div>
  );
}

export function MtdDashboardPage() {
  const { data, isLoading, error, refetch } = useHomeMtdQuery();
  const metrics = (data?.metrics as Record<string, unknown>) || {};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>MTD Dashboard</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/">Dashboard</Link>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
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
          <Kpi label="Delivered this month" value={String(metrics.delivered_this_month ?? 0)} />
          <Kpi label="Invoice total" value={String(metrics.total_invoice_this_month ?? 0)} />
          <Kpi label="Advance total" value={String(metrics.total_advance_this_month ?? 0)} />
          <Kpi label="Stock movements" value={String(metrics.inventory_movements_this_month ?? 0)} />
          <Kpi label="Revenue" value={String(metrics.revenue ?? 0)} />
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
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
