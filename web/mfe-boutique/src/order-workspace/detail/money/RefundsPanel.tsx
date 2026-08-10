import { useMemo, useState } from 'react';
import {
  useCreateBoutiqueOrderRefundMutation,
  useGetBoutiqueOrderFinancialsQuery,
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

export function RefundsPanel({ orderId, readOnly, onDone }: Props) {
  const { data: financials, refetch: refetchFin } = useGetBoutiqueOrderFinancialsQuery(orderId);
  const { data: vouchers = [], refetch } = useListBoutiqueOrderVouchersQuery({
    orderId,
    kind: 'refunds',
  });
  const { data: accountsRaw = [] } = useListFinanceAccountsQuery({
    store_only: true,
    active_only: true,
  });
  const accounts = useMemo(() => accountsRaw.filter(isStoreCashAccount), [accountsRaw]);
  const [createRefund, createState] = useCreateBoutiqueOrderRefundMutation();
  const [kind, setKind] = useState<'advance' | 'payment'>('advance');
  const [amount, setAmount] = useState('');
  const [storeAccountId, setStoreAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const unapplied = Number(financials?.unapplied_advance ?? 0);
  const refundablePayments = Number(financials?.refundable_payments ?? 0);
  const available = kind === 'advance' ? unapplied : refundablePayments;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError('Enter a refund amount greater than zero.');
      return;
    }
    if (!storeAccountId) {
      setError('Select a store account.');
      return;
    }
    if (amt > available + 0.001) {
      setError(`Amount exceeds available (${formatMoney(available)}).`);
      return;
    }
    try {
      await createRefund({
        orderId,
        body: {
          kind,
          amount: amt,
          store_account_id: storeAccountId,
          description: description || undefined,
        },
      }).unwrap();
      setAmount('');
      setDescription('');
      setOk('Refund recorded.');
      await Promise.all([refetch(), refetchFin()]);
      onDone?.();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <div className="od-money-panel">
      <h3>Refunds</h3>
      <p className="ow-lead">Return unused advance or customer receipts on this order.</p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {ok ? <div className="ow-schedule-ok">{ok}</div> : null}

      <div className="ow-schedule-snapshot" style={{ marginBottom: '1rem' }}>
        <div className="ow-schedule-stat">
          <span>Unapplied advance</span>
          <strong>{formatMoney(unapplied)}</strong>
        </div>
        <div className="ow-schedule-stat">
          <span>Refundable receipts</span>
          <strong>{formatMoney(refundablePayments)}</strong>
        </div>
      </div>

      {!readOnly ? (
        <form className="ow-grid" onSubmit={(e) => void onSubmit(e)}>
          <FormRow label="Refund type">
            <select
              className="vb-control"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'advance' | 'payment')}
            >
              <option value="advance">Advance</option>
              <option value="payment">Receipt / payment</option>
            </select>
          </FormRow>
          <div className="ow-grid two">
            <FormRow label={`Amount * (max ${formatMoney(available)})`}>
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormRow>
            <FormRow label="Store account *">
              <select
                className="vb-control"
                value={storeAccountId}
                onChange={(e) => setStoreAccountId(e.target.value)}
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
            <Button type="submit" data-kb-action="orders.record_refund" disabled={createState.isLoading || !(available > 0)}>
              {createState.isLoading ? 'Saving…' : 'Record refund'}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="od-expense-list" style={{ marginTop: '1rem' }}>
        {vouchers.length === 0 ? (
          <li>
            <span>No refunds yet.</span>
            <strong>—</strong>
          </li>
        ) : (
          vouchers.map((v) => (
            <li key={String(v.id)}>
              <span>
                {asCaption(v.voucher_number)} ·{' '}
                {v.is_advance_refund ? 'Advance' : 'Payment'} ·{' '}
                {asCaption(v.description) || 'Refund'}
              </span>
              <strong>{formatMoney(Number(v.cash_amount ?? 0))}</strong>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
