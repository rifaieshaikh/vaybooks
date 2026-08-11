import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchasesOverviewQuery } from '@vaybooks/store';
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
import { isOpenPoStatus } from './purchasesListHelpers';

export function PurchasesOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch, isFetching } = usePurchasesOverviewQuery();

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
  const pendingGrn = useMemo(
    () =>
      data && Array.isArray(data.pending_grn)
        ? (data.pending_grn as Record<string, unknown>[])
        : [],
    [data],
  );
  const actions = useMemo(() => {
    const fromApi =
      data && Array.isArray(data.quick_actions)
        ? (data.quick_actions as { to: string; label: string }[])
        : [];
    const extras = [
      { to: '/purchases/orders/new', label: 'New purchase order' },
      { to: '/purchases/bills/new', label: 'New bill' },
      { to: '/purchases/goods-receipt/new', label: 'New GRN' },
    ];
    const seen = new Set(fromApi.map((a) => a.to));
    return [...fromApi, ...extras.filter((e) => !seen.has(e.to))];
  }, [data]);

  const attentionOrders = useMemo(
    () => openOrders.filter((row) => isOpenPoStatus(row.status)).slice(0, 8),
    [openOrders],
  );

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Purchases"
        title="Command center"
        count={isFetching && !isLoading ? 'Refreshing…' : undefined}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={() => navigate('/purchases/bills/new')}>
              New bill
            </Button>
          </>
        }
        summary={
          !isLoading && !error ? (
            <div className="el-pulse" aria-label="Purchase KPIs">
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/purchases/orders?chip=open')}
              >
                Open POs <strong>{Number(kpis.open_po_count ?? 0)}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/purchases/goods-receipt?chip=pending')}
              >
                Pending GRN qty <strong>{Number(kpis.pending_grn_qty ?? 0)}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/purchases/bills?month=current')}
              >
                Purchases (MTD){' '}
                <strong>{formatMoney(Number(kpis.purchases_this_month ?? 0))}</strong>
              </button>
              <button
                type="button"
                className="el-pulse-link"
                onClick={() => navigate('/purchases/returns?month=current')}
              >
                Returns (MTD) <strong>{formatMoney(Number(kpis.returns_this_month ?? 0))}</strong>
              </button>
            </div>
          ) : null
        }
      />

      {isLoading ? <EntityListLoading>Loading purchases overview…</EntityListLoading> : null}
      {error ? (
        <ErrorText>Failed to load purchases overview. Is the API running?</ErrorText>
      ) : null}

      {!isLoading && !error ? (
        <>
          <div className="el-queue">
            <h2 className="el-section-title">Quick actions</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {actions.map((a) => (
                <Button
                  key={a.to}
                  type="button"
                  variant={a.to.includes('bills/new') ? 'primary' : 'ghost'}
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
                No open purchase orders.
              </p>
            ) : (
              <EntityCardGrid>
                {attentionOrders.map((row) => (
                  <EntityCard
                    key={String(row.id)}
                    title={asCaption(row.po_number) || String(row.id)}
                    captions={[
                      asCaption(row.vendor_name),
                      formatMoney(Number(row.total_amount ?? 0)),
                    ]}
                    badges={
                      asCaption(row.status)
                        ? [{ label: asCaption(row.status), tone: 'gray' as const }]
                        : undefined
                    }
                    onView={() => navigate(`/purchases/orders/${row.id}`)}
                  />
                ))}
              </EntityCardGrid>
            )}
          </div>

          <div className="el-queue">
            <h2 className="el-section-title">Pending receipt</h2>
            {pendingGrn.length === 0 ? (
              <p className="el-muted" style={{ margin: 0 }}>
                Nothing pending receipt.
              </p>
            ) : (
              <EntityCardGrid>
                {pendingGrn.slice(0, 12).map((row, i) => {
                  const poId = asCaption(row.po_id || row.id || row.purchase_order_id);
                  return (
                    <EntityCard
                      key={`${row.po_id || row.id || i}-${row.product_id || i}`}
                      title={asCaption(row.product_name) || asCaption(row.po_number) || 'Line'}
                      captions={[
                        asCaption(row.vendor_name),
                        `Qty ${Number(row.qty_pending ?? row.pending_qty ?? 0)}`,
                        asCaption(row.po_number),
                      ]}
                      onView={() =>
                        poId
                          ? navigate(`/purchases/goods-receipt/new?purchase_order_id=${poId}`)
                          : navigate('/purchases/goods-receipt/new')
                      }
                    />
                  );
                })}
              </EntityCardGrid>
            )}
          </div>

          <p style={{ marginTop: '0.5rem' }}>
            <Link to="/purchases/reports">View purchase reports →</Link>
          </p>
        </>
      ) : null}
    </EntityListPage>
  );
}
