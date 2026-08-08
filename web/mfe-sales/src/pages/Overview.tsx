import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSalesOverviewQuery } from '@vaybooks/store';
import { Button, EntityCard, EntityCardGrid, ErrorText } from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';

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

export function SalesOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useSalesOverviewQuery();

  const kpis = useMemo(
    () => (data && typeof data.kpis === 'object' && data.kpis ? (data.kpis as Record<string, unknown>) : {}),
    [data],
  );
  const openOrders = useMemo(
    () => (data && Array.isArray(data.open_orders) ? (data.open_orders as Record<string, unknown>[]) : []),
    [data],
  );
  const pending = useMemo(
    () =>
      data && Array.isArray(data.pending_delivery)
        ? (data.pending_delivery as Record<string, unknown>[])
        : [],
    [data],
  );
  const actions = useMemo(
    () =>
      data && Array.isArray(data.quick_actions)
        ? (data.quick_actions as { to: string; label: string }[])
        : [],
    [data],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Sales Overview</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load sales overview. Is the API running?</ErrorText> : null}

      {!isLoading && !error && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Kpi label="Open SOs" value={String(Number(kpis.open_so_count ?? 0))} />
            <Kpi label="Pending DN qty" value={String(Number(kpis.pending_dn_qty ?? 0))} />
            <Kpi label="Sales (month)" value={formatMoney(Number(kpis.sales_this_month ?? 0))} />
            <Kpi label="Returns (month)" value={formatMoney(Number(kpis.returns_this_month ?? 0))} />
          </div>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>Quick actions</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {actions.map((a) => (
              <Button key={a.to} type="button" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>Open orders</h3>
          {openOrders.length === 0 ? (
            <p style={{ color: '#667' }}>No open sales orders.</p>
          ) : (
            <EntityCardGrid>
              {openOrders.map((row) => (
                <EntityCard
                  key={String(row.id)}
                  title={asCaption(row.so_number) || String(row.id)}
                  captions={[
                    asCaption(row.customer_name),
                    asCaption(row.status),
                    formatMoney(Number(row.total_amount ?? 0)),
                  ]}
                  onView={() => navigate(`/sales/orders/${row.id}`)}
                />
              ))}
            </EntityCardGrid>
          )}

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', margin: '28px 0 8px' }}>Pending delivery</h3>
          {pending.length === 0 ? (
            <p style={{ color: '#667' }}>Nothing pending delivery.</p>
          ) : (
            <EntityCardGrid>
              {pending.map((row, i) => (
                <EntityCard
                  key={`${row.id || i}-${row.product_id || i}`}
                  title={asCaption(row.product_name) || asCaption(row.so_number) || 'Line'}
                  captions={[
                    asCaption(row.customer_name),
                    `Qty ${Number(row.qty_pending ?? 0)}`,
                    asCaption(row.so_number),
                  ]}
                  onView={() => navigate(`/sales/orders/${row.id}`)}
                />
              ))}
            </EntityCardGrid>
          )}

          <p style={{ marginTop: 24 }}>
            <Link to="/sales/reports">View sales reports →</Link>
          </p>
        </>
      )}
    </div>
  );
}
