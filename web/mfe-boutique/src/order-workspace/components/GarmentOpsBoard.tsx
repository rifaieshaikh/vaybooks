import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useListBoutiqueActivitiesQuery,
  useListBoutiqueTimeEntriesQuery,
} from '@vaybooks/store';
import { LIST_FETCH_ALL_SIZE, pagedItems } from '../../pagedList';
import { asCaption, formatMoney } from '../../utils';
import { itemIsReadyForInvoice } from '../../activityDefaults';
import {
  activitiesOf,
  itemId,
  itemsOf,
  type ItemLike,
  type OrderLike,
} from '../types';
import { ActivityCompleteControls } from './ActivityCompleteControls';

type Props = {
  orderId: string;
  order: OrderLike;
  expenses?: Record<string, unknown>[];
  readOnly?: boolean;
  filter?: 'all' | 'pending' | 'done';
  onDone?: () => void;
};

function activityDone(act: ItemLike): boolean {
  const s = asCaption(act.activity_status || act.status);
  return s === 'Completed' || s === 'Skipped';
}

export function GarmentOpsBoard({
  orderId,
  order,
  expenses = [],
  readOnly,
  filter = 'pending',
  onDone,
}: Props) {
  const { data: catalog = [] } = useListBoutiqueActivitiesQuery();
  const orderNumber = asCaption(order.order_number);
  const { data: timeEntriesPage } = useListBoutiqueTimeEntriesQuery(
    orderNumber
      ? {
          order_number: orderNumber,
          task_type: 'activity',
          page: 1,
          page_size: LIST_FETCH_ALL_SIZE,
        }
      : undefined,
    { skip: !orderNumber },
  );
  const timeEntries = pagedItems(timeEntriesPage);
  const items = itemsOf(order);
  const activities = activitiesOf(order);

  const garmentRows = useMemo(() => {
    return items.map((item) => {
      const iid = itemId(item);
      const itemActs = activities.filter((a) => String(a.bill_id || '') === iid);
      const visible = itemActs.filter((a) => {
        if (filter === 'pending') return !activityDone(a);
        if (filter === 'done') return activityDone(a);
        return true;
      });
      const doneCount = itemActs.filter(activityDone).length;
      const total = itemActs.length;
      const pendingCount = total - doneCount;
      return {
        item,
        iid,
        itemActs,
        visible,
        doneCount,
        total,
        pendingCount,
        pct: total ? Math.round((doneCount / total) * 100) : 0,
        ready: itemIsReadyForInvoice(item, activities),
        est: Number(item.sell_amount ?? 0),
        hours: itemActs.reduce((n, a) => n + (Number(a.estimated_hours) || 0), 0),
      };
    });
  }, [items, activities, filter]);

  const defaultOpenId = useMemo(() => {
    const withPending = garmentRows.find((row) => row.pendingCount > 0);
    return withPending?.iid || garmentRows[0]?.iid || '';
  }, [garmentRows]);

  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!defaultOpenId) return;
    setOpenIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set([defaultOpenId]);
    });
  }, [defaultOpenId]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!items.length) {
    return (
      <div className="ow-empty">
        <strong>No garments</strong>
        This order has no customization items yet.
      </div>
    );
  }

  const hiddenByFilter =
    filter !== 'all' && garmentRows.every((row) => row.visible.length === 0);

  return (
    <div className="ow-garment-ops">
      {hiddenByFilter ? (
        <div className="ow-garment-ops-empty-board">
          {filter === 'pending'
            ? 'All garment activities are finished.'
            : 'No finished activities yet.'}
        </div>
      ) : null}

      {garmentRows.map((row) => {
        const isOpen = openIds.has(row.iid);
        if (filter !== 'all' && row.visible.length === 0) return null;

        return (
          <article
            key={row.iid}
            className={`ow-garment-ops-card${row.ready ? ' is-ready' : ''}${isOpen ? ' is-open' : ''}`}
          >
            <div className="ow-garment-ops-head">
              <button
                type="button"
                className="ow-garment-ops-toggle"
                onClick={() => toggle(row.iid)}
                aria-expanded={isOpen}
              >
                <div className="ow-garment-ops-title">
                  <div className="ow-garment-ops-title-row">
                    <span className="ow-garment-ops-chevron" aria-hidden>
                      {isOpen ? '▾' : '▸'}
                    </span>
                    <h3>{asCaption(row.item.description) || 'Garment'}</h3>
                  </div>
                  <div className="ow-garment-ops-meta">
                    <span>{asCaption(row.item.bill_number) || 'No bill'}</span>
                    {row.est > 0 ? <span>{formatMoney(row.est)}</span> : null}
                    {row.pendingCount > 0 ? (
                      <span>{row.pendingCount} pending</span>
                    ) : (
                      <span>All done</span>
                    )}
                  </div>
                </div>
              </button>
              <div className="ow-garment-ops-status">
                <span className={`ow-chip${row.ready ? ' is-live' : ''}`}>
                  {row.ready ? 'Ready' : `${row.doneCount}/${row.total || 0}`}
                </span>
                <Link
                  to={`/boutique/items/${row.iid}?orderId=${encodeURIComponent(orderId)}&tab=tasks`}
                  className="ow-chip"
                >
                  Item
                </Link>
              </div>
            </div>

            <div className="ow-garment-ops-bar" aria-hidden>
              <div style={{ width: `${row.pct}%` }} />
            </div>

            {isOpen ? (
              <div className="ow-garment-ops-body">
                <div className="ow-garment-ops-links">
                  {row.item.measurement_id ? (
                    <Link to={`/boutique/measurements/${String(row.item.measurement_id)}`}>
                      Measurement{' '}
                      {asCaption(row.item.measurement_number || row.item.measurement_id)}
                    </Link>
                  ) : (
                    <span className="ow-muted">No measurement</span>
                  )}
                  {row.hours > 0 ? <span>{row.hours} hrs est.</span> : null}
                </div>

                {row.visible.length === 0 ? (
                  <div className="ow-garment-ops-empty">
                    {row.itemActs.length === 0
                      ? 'No activities on this garment.'
                      : filter === 'pending'
                        ? 'All activities finished.'
                        : 'Nothing to show.'}
                  </div>
                ) : (
                  <div className="ow-garment-ops-acts">
                    {row.visible.map((act) => (
                      <ActivityCompleteControls
                        key={String(act.order_activity_id || act.id)}
                        orderId={orderId}
                        activity={act}
                        catalog={catalog}
                        expenses={expenses}
                        timeEntries={timeEntries}
                        readOnly={readOnly}
                        compact
                        onDone={onDone}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
