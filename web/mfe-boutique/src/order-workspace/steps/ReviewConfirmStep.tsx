import { useState } from 'react';
import {
  useApplyBoutiqueOrderCreditAdvanceMutation,
  useConfirmBoutiqueOrderMutation,
  useGetBoutiqueOrderCreditBalanceQuery,
} from '@vaybooks/store';
import { Button, ErrorText } from '@vaybooks/ui-kit';
import { extractError } from '../../utils';
import { ReviewChecklist } from '../components/ReviewChecklist';
import type { Blocker } from '../validation';
import type { OrderLike, WorkspaceStep } from '../types';

type Props = {
  orderId: string;
  order: OrderLike;
  blockers: Blocker[];
  hints: string[];
  cashPending: boolean;
  readOnly: boolean;
  onJump: (step: WorkspaceStep) => void;
  onConfirmed: () => void;
};

export function ReviewConfirmStep({
  orderId,
  order,
  blockers,
  hints,
  cashPending,
  readOnly,
  onJump,
  onConfirmed,
}: Props) {
  const { data: credit } = useGetBoutiqueOrderCreditBalanceQuery(orderId, { skip: !orderId });
  const [applyCredit, creditState] = useApplyBoutiqueOrderCreditAdvanceMutation();
  const [confirmOrder, confirmState] = useConfirmBoutiqueOrderMutation();
  const [error, setError] = useState('');

  const hard = [...blockers];
  if (cashPending) {
    hard.push({
      step: 'schedule',
      message: 'Record or clear the cash advance amount before confirming',
    });
  }

  async function onConfirm() {
    setError('');
    if (hard.length) {
      onJump(hard[0].step);
      return;
    }
    try {
      if (Number(credit?.credit_balance ?? credit?.balance ?? 0) > 0) {
        await applyCredit({ orderId, body: {} }).unwrap();
      }
      await confirmOrder(orderId).unwrap();
      onConfirmed();
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <section className="ow-panel">
      <h2>Review & Confirm</h2>
      <p className="ow-lead">
        Confirm moves remaining credit then locks the draft. You continue on the order detail.
      </p>
      <ReviewChecklist blockers={hard} hints={hints} onJump={onJump} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <div className="ow-actions">
        <Button
          type="button"
          disabled={
            readOnly ||
            hard.length > 0 ||
            confirmState.isLoading ||
            creditState.isLoading ||
            !order
          }
          onClick={() => void onConfirm()}
        >
          {confirmState.isLoading || creditState.isLoading ? 'Confirming…' : 'Confirm order'}
        </Button>
      </div>
    </section>
  );
}
