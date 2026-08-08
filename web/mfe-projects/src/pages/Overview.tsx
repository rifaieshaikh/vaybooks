import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectsOverviewQuery } from '@vaybooks/store';
import { Button, ErrorText } from '@vaybooks/ui-kit';

export function ProjectsOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useProjectsOverviewQuery();
  const actions = useMemo(
    () =>
      data && Array.isArray(data.quick_actions)
        ? (data.quick_actions as { to: string; label: string }[])
        : [],
    [data],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Projects Overview</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load projects overview.</ErrorText> : null}
      {!isLoading && !error && (
        <>
          <p>Projects in portfolio: {String(data?.project_count ?? 0)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {actions.map((a) => (
              <Button key={a.to} type="button" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>
          <p style={{ color: '#667' }}>
            <Link to="/projects/settings">Settings</Link> ·{' '}
            <Link to="/schedulers/projects">Scheduled reports</Link>
          </p>
        </>
      )}
    </div>
  );
}
