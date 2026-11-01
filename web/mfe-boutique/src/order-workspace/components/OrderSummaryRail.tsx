import { asCaption, formatMoney } from '../../utils';
import type { Blocker } from '../validation';
import { itemsOf, orderStatus, type OrderLike } from '../types';
import { sellTotal } from '../validation';

type Props = {
  order: OrderLike | null | undefined;
  blockers: Blocker[];
  hints: string[];
  mediaCount: number;
  onJumpStep?: (step: Blocker['step']) => void;
};

export function OrderSummaryRail({ order, blockers, hints, mediaCount, onJumpStep }: Props) {
  const items = itemsOf(order);
  const etds = items
    .map((i) => asCaption(i.expected_delivery_date).slice(0, 10))
    .filter(Boolean)
    .sort();
  const earliest = asCaption(order?.expected_delivery_date).slice(0, 10) || etds[0] || '—';
  const total = sellTotal(items);

  return (
    <aside className="ow-summary">
      <h3>Order snapshot</h3>
      <div className="ow-summary-row">
        <span>Status</span>
        <strong>{orderStatus(order) || 'New'}</strong>
      </div>
      <div className="ow-summary-row">
        <span>Customer</span>
        <strong>{asCaption(order?.customer_name) || '—'}</strong>
      </div>
      <div className="ow-summary-row">
        <span>Garments</span>
        <strong>{items.length}</strong>
      </div>
      <div className="ow-summary-row">
        <span>Earliest ETD</span>
        <strong>{earliest}</strong>
      </div>
      <div className="ow-summary-row">
        <span>Advance</span>
        <strong>{formatMoney(Number(order?.advance_amount ?? 0))}</strong>
      </div>
      <div className="ow-summary-row">
        <span>Estimate total</span>
        <strong>{formatMoney(total)}</strong>
      </div>
      <div className="ow-summary-row">
        <span>Media</span>
        <strong>{mediaCount}</strong>
      </div>

      {blockers.length > 0 ? (
        <div className="ow-blockers">
          <h4>Before confirm</h4>
          <ul>
            {blockers.map((b) => (
              <li key={`${b.step}:${b.message}`}>
                {onJumpStep ? (
                  <button
                    type="button"
                    style={{
                      border: 0,
                      background: 'none',
                      padding: 0,
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                    }}
                    onClick={() => onJumpStep(b.step)}
                  >
                    {b.message}
                  </button>
                ) : (
                  b.message
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hints.length > 0 ? (
        <div className="ow-hints">
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
