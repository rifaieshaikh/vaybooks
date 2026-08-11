import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useListProjectsQuery, useProjectsOverviewQuery } from '@vaybooks/store';
import {
  Button,
  EntityDetailSnapshot,
  EntityListHero,
  EntityListPage,
  ErrorText,
} from '@vaybooks/ui-kit';
import { asCaption, formatDateInput, formatMoney } from '../utils';

export function ProjectsOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useProjectsOverviewQuery();
  const { data: projects = [] } = useListProjectsQuery();

  const actions = useMemo(
    () =>
      data && Array.isArray(data.quick_actions)
        ? (data.quick_actions as { to: string; label: string }[])
        : [],
    [data],
  );

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    let contractTotal = 0;
    let overdue = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const row of projects) {
      const status = String(row.status || 'Draft');
      byStatus[status] = (byStatus[status] || 0) + 1;
      contractTotal += Number(row.contract_value) || 0;
      const end = formatDateInput(row.expected_end_date);
      if (
        end &&
        end < today &&
        status !== 'Financially Closed' &&
        status !== 'Cancelled' &&
        status !== 'Physically Completed'
      ) {
        overdue += 1;
      }
    }
    return { byStatus, contractTotal, overdue };
  }, [projects]);

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Projects"
        title="Overview"
        count={`${data?.project_count ?? projects.length} projects`}
        actions={
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />
      {isLoading ? <p>Loading…</p> : null}
      {error ? <ErrorText>Failed to load projects overview.</ErrorText> : null}
      {!isLoading && !error ? (
        <>
          <EntityDetailSnapshot
            ariaLabel="Portfolio metrics"
            items={[
              { label: 'Projects', value: String(data?.project_count ?? projects.length) },
              { label: 'Contract value', value: formatMoney(stats.contractTotal) },
              { label: 'Active', value: String(stats.byStatus.Active || 0) },
              { label: 'On hold', value: String(stats.byStatus['On Hold'] || 0) },
              { label: 'Overdue end', value: String(stats.overdue) },
              {
                label: 'Closed',
                value: String(stats.byStatus['Financially Closed'] || 0),
              },
            ]}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
            {actions.map((a) => (
              <Button key={a.to} type="button" onClick={() => navigate(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>
          {Array.isArray(data?.portfolio) && data!.portfolio.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {['Project', 'Customer', 'Status', 'Contract', 'Margin'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data!.portfolio as Record<string, unknown>[]).slice(0, 12).map((row, i) => (
                    <tr key={String(row.project_id || row.id || i)}>
                      <td style={{ padding: '8px 10px' }}>
                        {row.project_id || row.id ? (
                          <Link to={`/projects/list/${String(row.project_id || row.id)}`}>
                            {asCaption(row.project_name || row.name)}
                          </Link>
                        ) : (
                          asCaption(row.project_name || row.name)
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{asCaption(row.customer_name)}</td>
                      <td style={{ padding: '8px 10px' }}>{asCaption(row.status)}</td>
                      <td style={{ padding: '8px 10px' }}>
                        {formatMoney(row.contract_value)}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {formatMoney(row.budget_margin ?? row.billed_margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p style={{ color: '#667' }}>
            <Link to="/projects/settings">Settings</Link> ·{' '}
            <Link to="/schedulers/projects">Scheduled reports</Link>
          </p>
        </>
      ) : null}
    </EntityListPage>
  );
}
