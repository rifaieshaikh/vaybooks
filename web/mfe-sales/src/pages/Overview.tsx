import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSalesOverviewQuery } from '@vaybooks/store';
import {
  Button,
  EntityCard,
  EntityCardGrid,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  ErrorText,
} from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';
import { isOpenOrderStatus } from './salesListHelpers';

export function SalesOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch, isFetching } = useSalesOverviewQuery();

  const kpis = useMemo(
    () =>
      data && typeof data.kpis === 'object' && data.kpis
        ? (data.kpis as Record<string, unknown>)
        : {},
    [data],
  );
  const openOrders = useMemo(
    () =>
      data && Array.isArray(data.open_orders)
        ? (data.open_orders as Record<string, unknown>[])
        : [],
    [data],
  );
  const pending = useMemo(
    () =>
      data && Array.isArray(data.pending_delivery)
        ? (data.pending_delivery as Record<string, unknown>[])
        : [],
    [data],
  );
  const actions = useMemo(() => {
    const fromApi =
      data && Array.isArray(data.quick_actions)
        ? (data.quick_actions as { to: string; label: string }[])
        : [];
    const extras = [
      { to: '/sales/orders/new', label: 'New sales order' },
      { to: '/sales/estimates/new', label: 'New estimate' },
      { to: '/sales/invoices/new', label: 'New invoice' },
    ];
    const seen = new Set(fromApi.map((a) => a.to));
    return [...fromApi, ...extras.filter((e) => !seen.has(e.to))];
  }, [data]);

  const attentionOrders = useMemo(
    () => openOrders.filter((row) => isOpenOrderStatus(row.status)).slice(0, 8),
    [openOrders],
  );

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Sales"
        title="Command center"
        count={isFetching && !isLoading ? 'Refreshing…' : undefined}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={() => navigate('/sales/invoices/new')}>
              New invoice
            </Button>
          </>
        }
        summary={
          !isLoading && !error ? (
            <div className="el-pulse" aria-label="Sales KPIs">
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/sales/orders?chip=open')}
              >
                Open SOs <strong>{Number(kpis.open_so_count ?? 0)}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/sales/delivery-notes?chip=pending')}
              >
                Pending DN qty <strong>{Number(kpis.pending_dn_qty ?? 0)}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/sales/invoices?month=current')}
              >
                Sales (MTD) <strong>{formatMoney(Number(kpis.sales_this_month ?? 0))}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/sales/returns?month=current')}
              >
                Returns (MTD) <strong>{formatMoney(Number(kpis.returns_this_month ?? 0))}</strong>
              </button>
            </div>
          ) : null
        }
      />

      {isLoading ? <EntityListLoading>Loading sales overview…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load sales overview. Is the API running?</ErrorText> : null}

      {!isLoading && !error ? (
        <>
          <div className="el-queue">
            <h2 className="el-section-title">Quick actions</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {actions.map((a) => (
                <Button
                  key={a.to}
                  type="button"
                  variant={a.to.includes('invoices/new') ? 'primary' : 'ghost'}
                  onClick={() => navigate(a.to)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="el-queue">
            <h2 className="el-section-title">Needs attention</h2>
            {attentionOrders.length === 0 ? (
              <p className="el-muted" style={{ margin: 0 }}>
                No open sales orders.
              </p>
            ) : (
              <EntityCardGrid>
                {attentionOrders.map((row) => (
                  <EntityCard
                    key={String(row.id)}
                    title={asCaption(row.so_number) || String(row.id)}
                    captions={[
                      asCaption(row.customer_name),
                      formatMoney(Number(row.total_amount ?? 0)),
                    ]}
                    badges={
                      asCaption(row.status)
                        ? [{ label: asCaption(row.status), tone: 'gray' as const }]
                        : undefined
                    }
                    onView={() => navigate(`/sales/orders/${row.id}`)}
                  />
                ))}
              </EntityCardGrid>
            )}
          </div>

          <div className="el-queue">
            <h2 className="el-section-title">Pending delivery</h2>
            {pending.length === 0 ? (
              <p className="el-muted" style={{ margin: 0 }}>
                Nothing pending delivery.
              </p>
            ) : (
              <EntityCardGrid>
                {pending.slice(0, 12).map((row, i) => {
                  const soId = asCaption(row.id || row.sales_order_id);
                  return (
                    <EntityCard
                      key={`${row.id || i}-${row.product_id || i}`}
                      title={asCaption(row.product_name) || asCaption(row.so_number) || 'Line'}
                      captions={[
                        asCaption(row.customer_name),
                        `Qty ${Number(row.qty_pending ?? 0)}`,
                        asCaption(row.so_number),
                      ]}
                      onView={() =>
                        soId
                          ? navigate(`/sales/delivery-notes/new?sales_order_id=${soId}`)
                          : navigate('/sales/delivery-notes/new')
                      }
                    />
                  );
                })}
              </EntityCardGrid>
            )}
          </div>

          <p style={{ marginTop: '0.5rem' }}>
            <Link to="/sales/reports">View sales reports →</Link>
          </p>
        </>
      ) : null}
    </EntityListPage>
  );
}
