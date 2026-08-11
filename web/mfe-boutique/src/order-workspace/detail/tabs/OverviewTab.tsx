import { useGetBoutiqueOrderFinancialsQuery } from '@vaybooks/store';
import { Button } from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../../../utils';
import type { DetailTab, MoneySub } from '../detailTypes';
import { itemsOf, type OrderLike } from '../../types';

type Props = {
  orderId: string;
  order: OrderLike;
  onJump: (tab: DetailTab, money?: MoneySub) => void;
};

export function OverviewTab({ orderId, order, onJump }: Props) {
  const { data: financials } = useGetBoutiqueOrderFinancialsQuery(orderId);
  const items = itemsOf(order);

  return (
    <section className="ow-panel">
      <h2>Overview</h2>
      <p className="ow-lead">Order snapshot and shortcuts into floor work and money.</p>

      <div className="ow-schedule-snapshot">
        <div className="ow-schedule-stat">
          <span>Estimate</span>
          <strong>{formatMoney(Number(financials?.estimate_total ?? 0))}</strong>
          <em>{items.length} garment{items.length === 1 ? '' : 's'}</em>
        </div>
        <div className="ow-schedule-stat">
          <span>Advance</span>
          <strong>{formatMoney(Number(financials?.advance_amount ?? order.advance_amount ?? 0))}</strong>
          <em>Unapplied {formatMoney(Number(financials?.unapplied_advance ?? 0))}</em>
        </div>
        <div className="ow-schedule-stat">
          <span>Expenses</span>
          <strong>{formatMoney(Number(financials?.expense_selling_total ?? 0))}</strong>
          <em>{Number(financials?.expense_count ?? 0)} entries</em>
        </div>
        <div className="ow-schedule-stat">
          <span>Credit on file</span>
          <strong>{formatMoney(Number(financials?.credit_balance ?? 0))}</strong>
          <em>
            Receipts {Number(financials?.receipt_count ?? 0)} · Refunds{' '}
            {Number(financials?.refund_count ?? 0)}
          </em>
        </div>
      </div>

      <div className="ow-frozen" style={{ marginTop: '1rem' }}>
        <strong>{asCaption(order.customer_name) || 'Customer'}</strong>
        <div style={{ color: 'var(--ow-muted)', fontSize: '0.9rem' }}>
          {asCaption(order.phone_number)}
          {asCaption(order.location_name || order.location_id)
            ? ` · ${asCaption(order.location_name || order.location_id)}`
            : ''}
          {' · ETD '}
          {asCaption(order.expected_delivery_date).slice(0, 10) || '—'}
        </div>
      </div>

      <div className="ow-actions" style={{ marginTop: '1.1rem' }}>
        <Button type="button" onClick={() => onJump('garments')}>
          Open garments
        </Button>
        <Button type="button" variant="ghost" onClick={() => onJump('money', 'advance')}>
          Money · Advance
        </Button>
        <Button type="button" variant="ghost" onClick={() => onJump('money', 'expenses')}>
          Expenses
        </Button>
        <Button type="button" variant="ghost" onClick={() => onJump('billing')}>
          Invoice & deliver
        </Button>
      </div>
    </section>
  );
}
