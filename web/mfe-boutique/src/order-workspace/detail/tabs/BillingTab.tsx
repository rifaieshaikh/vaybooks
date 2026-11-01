import { DeliveryPanel } from '../../components/DeliveryPanel';
import { InvoicePanel } from '../../components/InvoicePanel';
import type { OrderLike } from '../../types';

type Props = {
  orderId: string;
  order: OrderLike;
  onDone?: () => void;
};

export function BillingTab({ orderId, order, onDone }: Props) {
  return (
    <div className="ow-grid">
      <section className="ow-panel">
        <InvoicePanel orderId={orderId} order={order} onDone={onDone} />
      </section>
      <section className="ow-panel">
        <DeliveryPanel orderId={orderId} order={order} onDone={onDone} />
      </section>
    </div>
  );
}
