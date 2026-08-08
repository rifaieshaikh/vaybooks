import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBoutiqueOverviewQuery } from '@vaybooks/store';
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

export function BoutiqueOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useBoutiqueOverviewQuery();

  const kpis = useMemo(
    () => (data && typeof data.kpis === 'object' && data.kpis ? (data.kpis as Record<string, unknown>) : {}),
    [data],
  );
  const overdue = useMemo(
    () => (data && Array.isArray(data.overdue_orders) ? (data.overdue_orders as Record<string, unknown>[]) : []),
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
        : [],
    [data],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Boutique Overview</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load boutique overview. Is the API running?</ErrorText> : null}

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
            <Kpi label="Open orders" value={String(Number(kpis.open_orders ?? 0))} />
            <Kpi label="Overdue" value={String(Number(kpis.overdue_orders ?? 0))} />
            <Kpi label="Pending invoice" value={String(Number(kpis.bills_pending_invoice ?? 0))} />
            <Kpi label="Invoiced revenue" value={formatMoney(Number(kpis.invoiced_revenue ?? 0))} />
            <Kpi label="Hours logged" value={String(Number(kpis.hours_logged ?? 0))} />
          </div>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>Quick actions</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {actions.map((a) => (
              <Button key={a.to} type="button" variant="ghost" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>Overdue orders</h3>
          {overdue.length === 0 ? <p style={{ color: '#667' }}>None overdue.</p> : null}
          <EntityCardGrid>
            {overdue.map((row) => (
              <EntityCard
                key={String(row.id)}
                title={asCaption(row.order_number) || String(row.id)}
                captions={[
                  asCaption(row.customer_name),
                  `ETD ${asCaption(row.expected_delivery_date).slice(0, 10)}`,
                  `${Number(row.days_overdue ?? 0)} days overdue`,
                ]}
                onView={() => navigate(`/boutique/orders/${row.id}`)}
              />
            ))}
          </EntityCardGrid>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', margin: '24px 0 8px' }}>
            Bills pending invoice
          </h3>
          {pending.length === 0 ? <p style={{ color: '#667' }}>None pending.</p> : null}
          <EntityCardGrid>
            {pending.map((row) => (
              <EntityCard
                key={String(row.id || row.order_id)}
                title={asCaption(row.order_number) || String(row.id)}
                captions={[
                  asCaption(row.customer_name),
                  asCaption(row.bill_summary || row.pending_bills || row.bills),
                ]}
                onView={() => navigate(`/boutique/orders/${row.id || row.order_id}`)}
              />
            ))}
          </EntityCardGrid>

          <p style={{ marginTop: 24 }}>
            <Link to="/boutique/reports">View reports →</Link>
          </p>
        </>
      )}
    </div>
  );
}
