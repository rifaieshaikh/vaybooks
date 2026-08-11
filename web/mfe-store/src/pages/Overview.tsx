import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStoreOverviewQuery } from '@vaybooks/store';
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
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--vb-color-primary, #185c4c)' }}>
        {value}
      </div>
    </div>
  );
}

export function StoreOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useStoreOverviewQuery();
  const actions = useMemo(
    () =>
      data && Array.isArray(data.quick_actions)
        ? (data.quick_actions as { to: string; label: string }[])
        : [],
    [data],
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Store</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load store overview.</ErrorText> : null}
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
            <Kpi label="Active activities" value={String(Number(data.active_activities ?? 0))} />
            <Kpi label="Time entries" value={String(Number(data.total_time_entries ?? 0))} />
            <Kpi label="Open tasks" value={String(Number(data.open_tasks ?? 0))} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {actions.map((a) => (
              <Button key={a.to} type="button" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>
          <p style={{ color: '#667' }}>
            Activities: <Link to="/settings/store-activities">Store Activities</Link>
          </p>
        </>
      )}
    </div>
  );
}
