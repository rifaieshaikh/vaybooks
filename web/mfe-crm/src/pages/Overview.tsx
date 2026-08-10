import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCrmOverviewQuery } from '@vaybooks/store';
import {
  Button,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  ErrorText,
} from '@vaybooks/ui-kit';
import { useCrmCan } from '../hooks';
import {
  asEntityList,
  entityCaption,
  entityId,
  formatOutstanding,
  formatOverviewWhen,
} from '../overviewHelpers';

function kpiNumber(data: Record<string, unknown> | undefined, key: string): number {
  if (!data) return 0;
  return Number(data[key] ?? 0);
}

type QueueProps = {
  title: string;
  empty: string;
  items: Record<string, unknown>[];
  titleOf: (row: Record<string, unknown>) => string;
  captionsOf: (row: Record<string, unknown>) => string[];
  hrefOf: (row: Record<string, unknown>) => string | null;
  actionLabel?: string;
  actionHref?: (row: Record<string, unknown>) => string | null;
};

function WorkQueue({
  title,
  empty,
  items,
  titleOf,
  captionsOf,
  hrefOf,
  actionLabel,
  actionHref,
}: QueueProps) {
  const navigate = useNavigate();
  return (
    <div className="el-queue">
      <h2 className="el-section-title">{title}</h2>
      {items.length === 0 ? (
        <p className="el-muted" style={{ margin: 0 }}>
          {empty}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {items.slice(0, 8).map((row, i) => {
            const href = hrefOf(row);
            const actionTo = actionHref?.(row) || null;
            const captions = captionsOf(row).filter(Boolean);
            return (
              <div
                key={entityId(row) || `${title}-${i}`}
                style={{
                  border: '1px solid #d9e3de',
                  borderRadius: 10,
                  background: '#fff',
                  padding: '0.9rem 1rem',
                  display: 'grid',
                  gap: 8,
                  minHeight: 120,
                }}
              >
                <div style={{ fontWeight: 650, fontSize: 15, color: '#1a1a1a' }}>
                  {href ? (
                    <Link
                      to={href}
                      style={{ color: 'var(--vb-color-primary, #185c4c)', textDecoration: 'none' }}
                    >
                      {titleOf(row)}
                    </Link>
                  ) : (
                    titleOf(row)
                  )}
                </div>
                {captions.map((c) => (
                  <div key={c} style={{ fontSize: 13, color: '#567' }}>
                    {c}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {href ? (
                    <Button type="button" variant="ghost" onClick={() => navigate(href)}>
                      Open
                    </Button>
                  ) : null}
                  {actionLabel && actionTo ? (
                    <Button type="button" onClick={() => navigate(actionTo)}>
                      {actionLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CrmOverviewPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const { data, isLoading, error, refetch, isFetching } = useCrmOverviewQuery();

  const snap = data as Record<string, unknown> | undefined;

  const myTasks = useMemo(() => asEntityList(snap?.my_tasks_today), [snap]);
  const overdue = useMemo(() => asEntityList(snap?.overdue_activities), [snap]);
  const visits = useMemo(() => asEntityList(snap?.upcoming_visits), [snap]);
  const attention = useMemo(() => asEntityList(snap?.leads_requiring_attention), [snap]);
  const recentLeads = useMemo(() => asEntityList(snap?.recently_added_leads), [snap]);
  const outstanding = useMemo(
    () => asEntityList(snap?.customers_with_outstanding_balances),
    [snap],
  );

  const actions = useMemo(() => {
    const fromApi =
      snap && Array.isArray(snap.quick_actions)
        ? (snap.quick_actions as { to: string; label: string }[])
        : [];
    const extras: { to: string; label: string }[] = [];
    if (can.createLeads) extras.push({ to: '/crm/leads', label: 'New lead' });
    if (can.viewCalendar) extras.push({ to: '/crm/calendar', label: 'Open calendar' });
    if (can.createActivities) extras.push({ to: '/crm/activities', label: 'Log activity' });
    const seen = new Set(fromApi.map((a) => a.to));
    return [...fromApi, ...extras.filter((e) => !seen.has(e.to))];
  }, [snap, can.createLeads, can.viewCalendar, can.createActivities]);

  const ordersGenerated = snap?.orders_generated_from_crm_leads;
  const salesSoftNote =
    ordersGenerated === null || ordersGenerated === undefined
      ? 'Sales module metrics are unavailable for this period.'
      : null;

  const activityHref = (row: Record<string, unknown>) => {
    const id = entityId(row, 'id', 'activity_id');
    return id ? `/crm/activities/${id}` : null;
  };
  const leadHref = (row: Record<string, unknown>) => {
    const id = entityId(row, 'id', 'lead_id');
    return id ? `/crm/leads/${id}` : null;
  };
  const customerHref = (row: Record<string, unknown>) => {
    const id = entityId(row, 'customer_id', 'id');
    return id ? `/parties/customers/${id}` : null;
  };

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Today"
        count={isFetching && !isLoading ? 'Refreshing…' : undefined}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            {can.viewCalendar ? (
              <Button type="button" variant="ghost" onClick={() => navigate('/crm/calendar')}>
                Open calendar
              </Button>
            ) : null}
            {can.createLeads ? (
              <Button type="button" onClick={() => navigate('/crm/leads')}>
                New lead
              </Button>
            ) : null}
          </>
        }
        summary={
          !isLoading && !error && snap ? (
            <div className="el-pulse" aria-label="CRM KPIs">
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => can.viewLeads && navigate('/crm/leads')}
              >
                Active leads <strong>{kpiNumber(snap, 'total_active_leads')}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => can.viewLeads && navigate('/crm/leads')}
              >
                New (period) <strong>{kpiNumber(snap, 'new_leads_in_period')}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => can.viewEnquiries && navigate('/crm/enquiries')}
              >
                Open enquiries <strong>{kpiNumber(snap, 'open_enquiries')}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => can.viewActivities && navigate('/crm/activities')}
              >
                Follow-ups due <strong>{kpiNumber(snap, 'follow_ups_due_today')}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => can.viewActivities && navigate('/crm/activities')}
              >
                Overdue <strong>{kpiNumber(snap, 'overdue_follow_ups')}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => can.viewLeads && navigate('/crm/leads')}
              >
                Converted <strong>{kpiNumber(snap, 'leads_converted_in_period')}</strong>
              </button>
            </div>
          ) : null
        }
      />

      {isLoading ? <EntityListLoading>Loading CRM overview…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load CRM overview. Is the API running?</ErrorText> : null}

      {!isLoading && !error && snap ? (
        <>
          {salesSoftNote ? (
            <p className="el-muted" style={{ margin: '0 0 12px' }}>
              {salesSoftNote}
            </p>
          ) : null}

          <div className="el-queue">
            <h2 className="el-section-title">Quick actions</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {actions.map((a) => (
                <Button
                  key={a.to}
                  type="button"
                  variant={a.label === 'New lead' ? 'primary' : 'ghost'}
                  onClick={() => navigate(a.to)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>

          <WorkQueue
            title="My tasks today"
            empty="Nothing scheduled for today."
            items={myTasks}
            titleOf={(row) => entityCaption(row, 'activity_type', 'title') || 'Activity'}
            captionsOf={(row) => [
              entityCaption(row, 'party_name'),
              formatOverviewWhen(row.scheduled_at),
              entityCaption(row, 'status'),
            ]}
            hrefOf={activityHref}
            actionLabel={can.completeActivities ? 'Complete' : undefined}
            actionHref={can.completeActivities ? activityHref : undefined}
          />

          <WorkQueue
            title="Overdue activities"
            empty="All clear — no overdue activities."
            items={overdue}
            titleOf={(row) => entityCaption(row, 'activity_type', 'title') || 'Activity'}
            captionsOf={(row) => [
              entityCaption(row, 'party_name'),
              formatOverviewWhen(row.scheduled_at),
              entityCaption(row, 'assigned_user_name'),
            ]}
            hrefOf={activityHref}
            actionLabel={can.completeActivities ? 'Complete' : undefined}
            actionHref={can.completeActivities ? activityHref : undefined}
          />

          <WorkQueue
            title="Upcoming visits"
            empty="No visits planned."
            items={visits}
            titleOf={(row) => entityCaption(row, 'party_name', 'activity_type') || 'Visit'}
            captionsOf={(row) => [
              entityCaption(row, 'activity_type'),
              formatOverviewWhen(row.scheduled_at),
              entityCaption(row, 'location_name', 'location'),
            ]}
            hrefOf={activityHref}
          />

          <WorkQueue
            title="Leads requiring attention"
            empty="No leads need attention right now."
            items={attention}
            titleOf={(row) => entityCaption(row, 'name', 'party_name') || 'Lead'}
            captionsOf={(row) => [
              entityCaption(row, 'status'),
              entityCaption(row, 'assigned_user_name') || 'Unassigned',
              formatOverviewWhen(row.next_follow_up_at),
            ]}
            hrefOf={leadHref}
          />

          <WorkQueue
            title="Recently added leads"
            empty="No leads captured yet."
            items={recentLeads}
            titleOf={(row) => entityCaption(row, 'name', 'party_name') || 'Lead'}
            captionsOf={(row) => [
              entityCaption(row, 'status'),
              entityCaption(row, 'source'),
              formatOverviewWhen(row.created_at),
            ]}
            hrefOf={leadHref}
          />

          <WorkQueue
            title="Customers with outstanding balances"
            empty="No outstanding customer balances."
            items={outstanding}
            titleOf={(row) =>
              entityCaption(row, 'customer_name', 'name') || entityId(row, 'customer_id') || 'Customer'
            }
            captionsOf={(row) => [formatOutstanding(row.outstanding_balance)]}
            hrefOf={customerHref}
          />

          <p style={{ marginTop: '0.5rem', color: '#667' }}>
            Settings: <Link to="/settings/crm">CRM Settings</Link>
            {' · '}
            Scheduled: <Link to="/schedulers/crm">Schedulers</Link>
            {can.viewReports ? (
              <>
                {' · '}
                <Link to="/crm/reports">Reports →</Link>
              </>
            ) : null}
          </p>
        </>
      ) : null}
    </EntityListPage>
  );
}
