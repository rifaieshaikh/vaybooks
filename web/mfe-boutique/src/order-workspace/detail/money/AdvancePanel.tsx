import { useMemo, useState } from 'react';
import {
  useApplyBoutiqueOrderCreditAdvanceMutation,
  useGetBoutiqueOrderCreditBalanceQuery,
  useGetBoutiqueOrderFinancialsQuery,
  useLazyGetBoutiqueAdvanceReceiptPdfQuery,
  useListFinanceAccountsQuery,
  useRecordBoutiqueAdvanceMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../../../utils';
import { isStoreCashAccount } from '../detailTypes';
import type { OrderLike } from '../../types';

type Props = {
  orderId: string;
  order: OrderLike;
  readOnly?: boolean;
  onDone?: () => void;
};

export function AdvancePanel({ orderId, order, readOnly, onDone }: Props) {
  const { data: financials, refetch: refetchFin } = useGetBoutiqueOrderFinancialsQuery(orderId);
  const { data: credit } = useGetBoutiqueOrderCreditBalanceQuery(orderId);
  const { data: accountsRaw = [] } = useListFinanceAccountsQuery({
    store_only: true,
    active_only: true,
  });
  const accounts = useMemo(() => accountsRaw.filter(isStoreCashAccount), [accountsRaw]);
  const [recordAdvance, cashState] = useRecordBoutiqueAdvanceMutation();
  const [applyCredit, creditState] = useApplyBoutiqueOrderCreditAdvanceMutation();
  const [fetchReceipt] = useLazyGetBoutiqueAdvanceReceiptPdfQuery();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const balance = Number(credit?.credit_balance ?? credit?.balance ?? financials?.credit_balance ?? 0);
  const advance = Number(order.advance_amount ?? financials?.advance_amount ?? 0);
  const unapplied = Number(financials?.unapplied_advance ?? 0);
  const voucher = order.advance_voucher as Record<string, unknown> | undefined;

  async function refresh() {
    await refetchFin();
    onDone?.();
  }

  async function onCash() {
    setError('');
    setOk('');
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError('Enter a cash amount greater than zero.');
      return;
    }
    if (!accountId) {
      setError('Select a cash / bank account.');
      return;
    }
    try {
      await recordAdvance({
        orderId,
        body: { amount: amt, receiving_account_id: accountId },
      }).unwrap();
      setAmount('');
      setOk(`Recorded ${formatMoney(amt)} cash advance.`);
      await refresh();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onCredit() {
    setError('');
    setOk('');
    try {
      await applyCredit({ orderId, body: {} }).unwrap();
      setOk('Customer credit moved to order advance.');
      await refresh();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onPdf() {
    setError('');
    try {
      const blob = await fetchReceipt(orderId).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `advance-receipt-${asCaption(order.order_number) || orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <div className="od-money-panel">
      <h3>Advance</h3>
      <p className="ow-lead">Cash and credit advances against this order.</p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {ok ? <div className="ow-schedule-ok">{ok}</div> : null}

      <div className="ow-schedule-snapshot" style={{ marginBottom: '1rem' }}>
        <div className="ow-schedule-stat">
          <span>Order advance</span>
          <strong>{formatMoney(advance)}</strong>
        </div>
        <div className="ow-schedule-stat">
          <span>Unapplied</span>
          <strong>{formatMoney(unapplied)}</strong>
        </div>
        <div className="ow-schedule-stat">
          <span>Customer credit</span>
          <strong>{formatMoney(balance)}</strong>
        </div>
      </div>

      <div className={`ow-schedule-credit${balance > 0 ? ' is-ready' : ''}`}>
        <div>
          <strong>{formatMoney(balance)}</strong>
          <span>available to apply</span>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            disabled={!(balance > 0) || creditState.isLoading}
            onClick={() => void onCredit()}
          >
            {creditState.isLoading ? 'Moving…' : 'Apply all credit'}
          </Button>
        ) : null}
      </div>

      <div className="ow-schedule-cash" style={{ marginTop: '1rem' }}>
        <h4>Add cash advance</h4>
        <div className="ow-grid two">
          <FormRow label="Amount">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={amount}
              disabled={readOnly}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormRow>
          <FormRow label="Receiving account">
            <select
              className="vb-control"
              value={accountId}
              disabled={readOnly}
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
        {!readOnly ? (
          <div className="ow-actions" style={{ marginTop: '0.65rem' }}>
            <Button
              type="button"
              disabled={cashState.isLoading || !(Number(amount) > 0)}
              onClick={() => void onCash()}
            >
              {cashState.isLoading ? 'Recording…' : 'Record cash advance'}
            </Button>
          </div>
        ) : null}
        {accounts.length === 0 ? (
          <p className="ow-schedule-pending">No store cash/bank accounts configured.</p>
        ) : null}
      </div>

      {voucher || advance > 0 ? (
        <div className="ow-schedule-receipt" style={{ marginTop: '1rem' }}>
          <div>
            <span>Advance on order</span>
            <strong>{formatMoney(advance)}</strong>
            {voucher ? (
              <em>Voucher {asCaption(voucher.voucher_number || voucher.id)}</em>
            ) : null}
          </div>
          {voucher ? (
            <Button type="button" variant="ghost" onClick={() => void onPdf()}>
              Receipt PDF
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
