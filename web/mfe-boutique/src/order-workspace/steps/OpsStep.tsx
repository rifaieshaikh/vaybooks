import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCancelBoutiqueOrderMutation,
  useCompleteBoutiqueOrderMutation,
  useListBoutiqueOrderExpensesQuery,
} from '@vaybooks/store';
import { Button, ErrorText, Modal } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../../utils';
import { DeliveryPanel } from '../components/DeliveryPanel';
import { GarmentOpsBoard } from '../components/GarmentOpsBoard';
import { InvoicePanel } from '../components/InvoicePanel';
import { orderStatus, type OrderLike } from '../types';

type Props = {
  orderId: string;
  order: OrderLike;
  onSaved: () => void;
  onModalOpenChange?: (open: boolean) => void;
};

/** Kept for edge resumes; confirmed orders normally live on detail. */
export function OpsStep({ orderId, order, onSaved, onModalOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: expenses = [], refetch: refetchExpenses } = useListBoutiqueOrderExpensesQuery(
    orderId,
  );
  const [cancelOrder, cancelState] = useCancelBoutiqueOrderMutation();
  const [completeOrder, completeState] = useCompleteBoutiqueOrderMutation();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState('');
  const status = orderStatus(order);
  const canComplete = status === 'Delivered';

  async function onCancel() {
    setError('');
    try {
      await cancelOrder(orderId).unwrap();
      setCancelOpen(false);
      onModalOpenChange?.(false);
      navigate(`/boutique/orders/${orderId}`);
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onComplete() {
    setError('');
    try {
      await completeOrder(orderId).unwrap();
      onSaved();
      navigate(`/boutique/orders/${orderId}`);
    } catch (e) {
      setError(extractError(e));
    }
  }

  function refresh() {
    onSaved();
    void refetchExpenses();
  }

  return (
    <section className="ow-panel">
      <h2>Ops</h2>
      <p className="ow-lead">
        Floor work and billing. Full cockpit:{' '}
        <Link to={`/boutique/orders/${orderId}`}>order detail</Link>.
      </p>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <GarmentOpsBoard
        orderId={orderId}
        order={order}
        expenses={expenses}
        onDone={refresh}
      />

      <div style={{ marginTop: '1.25rem' }}>
        <InvoicePanel orderId={orderId} order={order} onDone={onSaved} />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <DeliveryPanel orderId={orderId} order={order} onDone={onSaved} />
      </div>

      <div className="ow-actions">
        <Button
          type="button"
          disabled={!canComplete || completeState.isLoading}
          title={canComplete ? undefined : 'Complete when status is Delivered'}
          onClick={() => void onComplete()}
        >
          Complete order
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={status === 'Cancelled' || status === 'Completed'}
          onClick={() => {
            setCancelOpen(true);
            onModalOpenChange?.(true);
          }}
        >
          Cancel order
        </Button>
        <Link to={`/boutique/orders/${orderId}`} className="ow-chip">
          Open detail · {asCaption(order.order_number)}
        </Link>
      </div>

      <Modal
        open={cancelOpen}
        title="Cancel this order?"
        onClose={() => {
          setCancelOpen(false);
          onModalOpenChange?.(false);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCancelOpen(false);
                onModalOpenChange?.(false);
              }}
            >
              Keep order
            </Button>
            <Button type="button" onClick={() => void onCancel()} disabled={cancelState.isLoading}>
              Cancel order
            </Button>
          </>
        }
      >
        <p>Cancellation charge and invoicing edge cases are handled on order detail if needed.</p>
      </Modal>
    </section>
  );
}
