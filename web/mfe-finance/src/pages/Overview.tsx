import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFinanceOverviewQuery } from '@vaybooks/store';
import { Button, EntityCard, EntityCardGrid, ErrorText } from '@vaybooks/ui-kit';
import { formatMoney } from '../utils';

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

export function FinanceOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useFinanceOverviewQuery();

  const kpis = useMemo(
    () => (data && typeof data.kpis === 'object' && data.kpis ? (data.kpis as Record<string, unknown>) : {}),
    [data],
  );
  const arQueue = useMemo(
    () => (data && Array.isArray(data.ar_queue) ? (data.ar_queue as Record<string, unknown>[]) : []),
    [data],
  );
  const apQueue = useMemo(
    () => (data && Array.isArray(data.ap_queue) ? (data.ap_queue as Record<string, unknown>[]) : []),
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
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Finance Overview</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load finance overview. Is the API running?</ErrorText> : null}

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
            <Kpi label="Accounts" value={String(Number(kpis.account_count ?? 0))} />
            <Kpi label="Vouchers" value={String(Number(kpis.voucher_count ?? 0))} />
            <Kpi label="AR" value={formatMoney(Number(kpis.ar_balance ?? 0))} />
            <Kpi label="AP" value={formatMoney(Number(kpis.ap_balance ?? 0))} />
            <Kpi label="Receipts" value={formatMoney(Number(kpis.receipts_total ?? 0))} />
            <Kpi label="Payments" value={formatMoney(Number(kpis.payments_total ?? 0))} />
          </div>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>Quick actions</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {actions.map((a) => (
              <Button key={a.to} type="button" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>Receivables</h3>
          {arQueue.length === 0 ? (
            <p style={{ color: '#667' }}>No open customer balances.</p>
          ) : (
            <EntityCardGrid>
              {arQueue.map((row) => (
                <EntityCard
                  key={String(row.id)}
                  title={String(row.account_name || row.name || 'Account')}
                  captions={[formatMoney(Number(row.balance ?? row.current_balance ?? 0))]}
                  onView={() => navigate(`/finance/accounts/${row.id}`)}
                />
              ))}
            </EntityCardGrid>
          )}

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', margin: '28px 0 8px' }}>Payables</h3>
          {apQueue.length === 0 ? (
            <p style={{ color: '#667' }}>No open vendor balances.</p>
          ) : (
            <EntityCardGrid>
              {apQueue.map((row) => (
                <EntityCard
                  key={String(row.id)}
                  title={String(row.account_name || row.name || 'Account')}
                  captions={[formatMoney(Math.abs(Number(row.balance ?? row.current_balance ?? 0)))]}
                  onView={() => navigate(`/finance/accounts/${row.id}`)}
                />
              ))}
            </EntityCardGrid>
          )}

          <p style={{ marginTop: 24 }}>
            <Link to="/finance/accounts">All accounts →</Link>
          </p>
        </>
      )}
    </div>
  );
}
