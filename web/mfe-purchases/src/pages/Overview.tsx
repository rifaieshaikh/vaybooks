import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchasesOverviewQuery } from '@vaybooks/store';
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

export function PurchasesOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = usePurchasesOverviewQuery();

  const kpis = useMemo(
    () => (data && typeof data.kpis === 'object' && data.kpis ? (data.kpis as Record<string, unknown>) : {}),
    [data],
  );
  const openOrders = useMemo(
    () => (data && Array.isArray(data.open_orders) ? (data.open_orders as Record<string, unknown>[]) : []),
    [data],
  );
  const pendingGrn = useMemo(
    () => (data && Array.isArray(data.pending_grn) ? (data.pending_grn as Record<string, unknown>[]) : []),
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
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Purchases Overview</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load purchases overview. Is the API running?</ErrorText> : null}

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
            <Kpi label="Open POs" value={String(Number(kpis.open_po_count ?? 0))} />
            <Kpi label="Pending GRN qty" value={String(Number(kpis.pending_grn_qty ?? 0))} />
            <Kpi label="Purchases (month)" value={formatMoney(Number(kpis.purchases_this_month ?? 0))} />
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
            <p style={{ color: '#667' }}>No open purchase orders.</p>
          ) : (
            <EntityCardGrid>
              {openOrders.map((row) => (
                <EntityCard
                  key={String(row.id)}
                  title={asCaption(row.po_number) || String(row.id)}
                  captions={[
                    asCaption(row.vendor_name),
                    asCaption(row.status),
                    formatMoney(Number(row.total_amount ?? 0)),
                  ]}
                  onView={() => navigate(`/purchases/orders/${row.id}`)}
                />
              ))}
            </EntityCardGrid>
          )}

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', margin: '28px 0 8px' }}>Pending GRN</h3>
          {pendingGrn.length === 0 ? (
            <p style={{ color: '#667' }}>Nothing pending receipt.</p>
          ) : (
            <EntityCardGrid>
              {pendingGrn.map((row, i) => (
                <EntityCard
                  key={`${row.po_id || row.id || i}-${row.product_id || i}`}
                  title={asCaption(row.product_name) || asCaption(row.po_number) || 'Line'}
                  captions={[
                    asCaption(row.vendor_name),
                    `Qty ${Number(row.qty_pending ?? row.pending_qty ?? 0)}`,
                    asCaption(row.po_number),
                  ]}
                  onView={() => navigate(`/purchases/orders/${row.po_id || row.id}`)}
                />
              ))}
            </EntityCardGrid>
          )}

          <p style={{ marginTop: 24 }}>
            <Link to="/purchases/reports">View purchase reports →</Link>
          </p>
        </>
      )}
    </div>
  );
}
