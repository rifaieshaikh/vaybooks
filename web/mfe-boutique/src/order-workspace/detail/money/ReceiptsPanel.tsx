import { useMemo, useState } from 'react';
import {
  useCreateBoutiqueOrderReceiptMutation,
  useListBoutiqueOrderVouchersQuery,
  useListFinanceAccountsQuery,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../../../utils';
import { isStoreCashAccount } from '../detailTypes';

type Props = {
  orderId: string;
  readOnly?: boolean;
  onDone?: () => void;
};

export function ReceiptsPanel({ orderId, readOnly, onDone }: Props) {
  const { data: vouchers = [], refetch } = useListBoutiqueOrderVouchersQuery({
    orderId,
    kind: 'receipts',
  });
  const { data: accountsRaw = [] } = useListFinanceAccountsQuery({
    store_only: true,
    active_only: true,
  });
  const accounts = useMemo(() => accountsRaw.filter(isStoreCashAccount), [accountsRaw]);
  const [createReceipt, createState] = useCreateBoutiqueOrderReceiptMutation();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!accountId) {
      setError('Select a receiving account.');
      return;
    }
    try {
      await createReceipt({
        orderId,
        body: {
          amount: amt,
          receiving_account_id: accountId,
          description: description || undefined,
        },
      }).unwrap();
      setAmount('');
      setDescription('');
      setOk('Receipt recorded.');
      await refetch();
      onDone?.();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <div className="od-money-panel">
      <h3>Receipts</h3>
      <p className="ow-lead">Customer collections linked to this order (after invoice).</p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {ok ? <div className="ow-schedule-ok">{ok}</div> : null}

      {!readOnly ? (
        <form className="ow-grid" onSubmit={(e) => void onSubmit(e)}>
          <div className="ow-grid two">
            <FormRow label="Amount *">
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormRow>
            <FormRow label="Receiving account *">
              <select
                className="vb-control"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Select cash / bank…</option>
                {accounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {asCaption(a.account_name || a.name)}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>
          <FormRow label="Description">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <div className="ow-actions">
            <Button type="submit" disabled={createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Record receipt'}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="od-expense-list" style={{ marginTop: '1rem' }}>
        {vouchers.length === 0 ? (
          <li>
            <span>No receipts yet.</span>
            <strong>—</strong>
          </li>
        ) : (
          vouchers.map((v) => (
            <li key={String(v.id)}>
              <span>
                {asCaption(v.voucher_number)} · {asCaption(v.description) || 'Receipt'}
              </span>
              <strong>{formatMoney(Number(v.cash_amount ?? 0))}</strong>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
