import { AdvancePanel } from '../money/AdvancePanel';
import { ExpensesPanel } from '../money/ExpensesPanel';
import { PaymentsPanel } from '../money/PaymentsPanel';
import { ReceiptsPanel } from '../money/ReceiptsPanel';
import { RefundsPanel } from '../money/RefundsPanel';
import { MONEY_SUBS, type MoneySub } from '../detailTypes';
import type { OrderLike } from '../../types';

type Props = {
  orderId: string;
  order: OrderLike;
  money: MoneySub;
  readOnly?: boolean;
  onMoneyChange: (next: MoneySub) => void;
  onDone?: () => void;
};

export function MoneyTab({
  orderId,
  order,
  money,
  readOnly,
  onMoneyChange,
  onDone,
}: Props) {
  return (
    <section className="ow-panel">
      <div className="od-section-head">
        <div>
          <h2>Money</h2>
          <p className="ow-lead">Advances, expenses, receipts, vendor payments, and refunds.</p>
        </div>
        <div className="od-filters" role="tablist" aria-label="Money sections">
          {MONEY_SUBS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={money === s.id}
              className={`ow-chip${money === s.id ? ' is-live' : ''}`}
              onClick={() => onMoneyChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {money === 'advance' ? (
        <AdvancePanel orderId={orderId} order={order} readOnly={readOnly} onDone={onDone} />
      ) : null}
      {money === 'expenses' ? (
        <ExpensesPanel orderId={orderId} order={order} readOnly={readOnly} onDone={onDone} />
      ) : null}
      {money === 'receipts' ? (
        <ReceiptsPanel orderId={orderId} readOnly={readOnly} onDone={onDone} />
      ) : null}
      {money === 'payments' ? (
        <PaymentsPanel orderId={orderId} readOnly={readOnly} onDone={onDone} />
      ) : null}
      {money === 'refunds' ? (
        <RefundsPanel orderId={orderId} readOnly={readOnly} onDone={onDone} />
      ) : null}
    </section>
  );
}
