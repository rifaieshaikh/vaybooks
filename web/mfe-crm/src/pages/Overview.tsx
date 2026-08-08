import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCrmOverviewQuery } from '@vaybooks/store';
import { Button, ErrorText } from '@vaybooks/ui-kit';

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

export function CrmOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useCrmOverviewQuery();

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
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>CRM Overview</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load CRM overview. Is the API running?</ErrorText> : null}

      {!isLoading && !error && data && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Kpi label="Active leads" value={String(Number(data.total_active_leads ?? 0))} />
            <Kpi label="New (period)" value={String(Number(data.new_leads_in_period ?? 0))} />
            <Kpi label="Open enquiries" value={String(Number(data.open_enquiries ?? 0))} />
            <Kpi label="Follow-ups due" value={String(Number(data.follow_ups_due_today ?? 0))} />
            <Kpi label="Overdue" value={String(Number(data.overdue_follow_ups ?? 0))} />
            <Kpi label="Converted" value={String(Number(data.leads_converted_in_period ?? 0))} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {actions.map((a) => (
              <Button key={a.to} type="button" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>

          <p style={{ color: '#667' }}>
            Settings: <Link to="/settings/crm">CRM Settings</Link> · Scheduled:{' '}
            <Link to="/schedulers/crm">Schedulers</Link>
          </p>
        </>
      )}
    </div>
  );
}
