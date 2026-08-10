import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useApplyBoutiqueOrderCreditAdvanceMutation,
  useGetBoutiqueOrderCreditBalanceQuery,
  useLazyGetBoutiqueAdvanceReceiptPdfQuery,
  useListFinanceAccountsQuery,
  usePatchBoutiqueOrderMutation,
  useRecordBoutiqueAdvanceMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../../utils';
import { useDebouncedAutosave } from '../hooks/useDebouncedAutosave';
import { scheduleSchema, type ScheduleValues } from '../schemas';
import { itemsOf, todayPlusDays, type OrderLike } from '../types';
import { sellTotal } from '../validation';

type Props = {
  orderId: string;
  order: OrderLike;
  readOnly: boolean;
  onSaved: () => void;
  onContinue: () => void;
  onCashPendingChange?: (pending: boolean) => void;
};

function formatFriendlyDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysFromToday(iso: string): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return diff;
}

export function SchedulePaymentStep({
  orderId,
  order,
  readOnly,
  onSaved,
  onContinue,
  onCashPendingChange,
}: Props) {
  const { data: credit } = useGetBoutiqueOrderCreditBalanceQuery(orderId, { skip: !orderId });
  const { data: accountsRaw = [] } = useListFinanceAccountsQuery({
    store_only: true,
    active_only: true,
  });
  const accounts = useMemo(
    () =>
      accountsRaw.filter(
        (a) =>
          a.is_store_account === true &&
          !a.linked_customer_id &&
          !a.linked_vendor_id &&
          !a.linked_worker_id &&
          !a.linked_agent_id &&
          !a.linked_delivery_partner_id,
      ),
    [accountsRaw],
  );
  const [patchOrder] = usePatchBoutiqueOrderMutation();
  const [applyCredit, creditState] = useApplyBoutiqueOrderCreditAdvanceMutation();
  const [recordAdvance, cashState] = useRecordBoutiqueAdvanceMutation();
  const [fetchReceipt] = useLazyGetBoutiqueAdvanceReceiptPdfQuery();
  const [error, setError] = useState('');
  const [etdSaved, setEtdSaved] = useState(false);
  const [cashOk, setCashOk] = useState('');

  const form = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema) as Resolver<ScheduleValues>,
    defaultValues: {
      etd: asCaption(order.expected_delivery_date).slice(0, 10),
      cashAmount: '',
      receivingAccountId: '',
    },
  });

  useEffect(() => {
    form.reset({
      etd: asCaption(order.expected_delivery_date).slice(0, 10),
      cashAmount: form.getValues('cashAmount'),
      receivingAccountId: form.getValues('receivingAccountId'),
    });
  }, [order.expected_delivery_date, form]);

  const etd = form.watch('etd');
  const cashAmount = form.watch('cashAmount');
  const accountId = form.watch('receivingAccountId');

  useEffect(() => {
    onCashPendingChange?.(Boolean(cashAmount && Number(cashAmount) > 0));
  }, [cashAmount, onCashPendingChange]);

  useDebouncedAutosave(
    Boolean(orderId && !readOnly && etd),
    [etd],
    500,
    async () => {
      try {
        await patchOrder({ id: orderId, body: { expected_delivery_date: etd } }).unwrap();
        setEtdSaved(true);
        window.setTimeout(() => setEtdSaved(false), 1600);
        onSaved();
      } catch {
        /* ignore race */
      }
    },
  );

  const items = itemsOf(order);
  const estimate = sellTotal(items);
  const advance = Number(order.advance_amount ?? 0);
  const balance = Number(credit?.credit_balance ?? credit?.balance ?? 0);
  const voucher = order.advance_voucher as Record<string, unknown> | undefined;
  const remaining = Math.max(0, estimate - advance);
  const dayDelta = daysFromToday(etd);

  const garmentEtds = useMemo(() => {
    const dates = items
      .map((i) => asCaption(i.expected_delivery_date).slice(0, 10))
      .filter(Boolean)
      .sort();
    return {
      earliest: dates[0] || '',
      latest: dates[dates.length - 1] || '',
      count: dates.length,
    };
  }, [items]);

  const presets = useMemo(
    () => [
      { label: '+7 days', value: todayPlusDays(7) },
      { label: '+14 days', value: todayPlusDays(14) },
      { label: '+21 days', value: todayPlusDays(21) },
      ...(garmentEtds.earliest
        ? [{ label: 'Earliest garment', value: garmentEtds.earliest }]
        : []),
    ],
    [garmentEtds.earliest],
  );

  async function onMoveCredit() {
    setError('');
    setCashOk('');
    try {
      await applyCredit({ orderId, body: {} }).unwrap();
      setCashOk('Customer credit moved to order advance.');
      onSaved();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onRecordCash() {
    setError('');
    setCashOk('');
    const amt = Number(cashAmount);
    if (!(amt > 0)) {
      setError('Enter a cash advance amount greater than zero.');
      return;
    }
    if (!accountId) {
      setError('Choose where the cash was received.');
      return;
    }
    try {
      await recordAdvance({
        orderId,
        body: { amount: amt, receiving_account_id: accountId },
      }).unwrap();
      form.setValue('cashAmount', '');
      onCashPendingChange?.(false);
      setCashOk(`Recorded ${formatMoney(amt)} cash advance.`);
      onSaved();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onReceipt() {
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

  function setPreset(value: string) {
    form.setValue('etd', value, { shouldDirty: true, shouldValidate: true });
  }

  const canContinue = Boolean(etd);

  return (
    <section className="ow-panel ow-schedule">
      <h2>Schedule & Payment</h2>
      <p className="ow-lead">
        Lock the delivery date, then apply credit or cash toward the estimate. Unrecorded cash
        amounts block confirm.
      </p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {cashOk ? <div className="ow-schedule-ok">{cashOk}</div> : null}

      <div className="ow-schedule-snapshot" aria-label="Payment snapshot">
        <div className="ow-schedule-stat">
          <span>Estimate</span>
          <strong>{formatMoney(estimate)}</strong>
          <em>{items.length} garment{items.length === 1 ? '' : 's'}</em>
        </div>
        <div className="ow-schedule-stat">
          <span>Customer credit</span>
          <strong>{formatMoney(balance)}</strong>
          <em>{balance > 0 ? 'Ready to apply' : 'None available'}</em>
        </div>
        <div className="ow-schedule-stat">
          <span>Order advance</span>
          <strong>{formatMoney(advance)}</strong>
          <em>{voucher ? 'Receipt available' : 'Not recorded yet'}</em>
        </div>
        <div className={`ow-schedule-stat${remaining > 0 ? ' is-gap' : ' is-ok'}`}>
          <span>Still due</span>
          <strong>{formatMoney(remaining)}</strong>
          <em>{remaining > 0 ? 'After advances' : 'Covered by advance'}</em>
        </div>
      </div>

      <div className="ow-schedule-sections">
        <article className="ow-schedule-card">
          <header className="ow-schedule-card-head">
            <div>
              <h3>Delivery</h3>
              <p>Order-level ETD. Autosaves as you change it.</p>
            </div>
            <span className={`ow-saved${etdSaved ? ' is-on' : ''}`}>ETD saved</span>
          </header>

          <FormRow label="Expected delivery date *">
            <TextInput type="date" disabled={readOnly} {...form.register('etd')} />
          </FormRow>

          {etd ? (
            <p className="ow-schedule-etd-hint">
              <strong>{formatFriendlyDate(etd)}</strong>
              {dayDelta != null ? (
                <span>
                  {dayDelta === 0
                    ? ' · Today'
                    : dayDelta > 0
                      ? ` · in ${dayDelta} day${dayDelta === 1 ? '' : 's'}`
                      : ` · ${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? '' : 's'} ago`}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="ow-schedule-etd-hint is-warn">Choose a delivery date to continue.</p>
          )}

          {!readOnly ? (
            <div className="ow-schedule-presets" role="group" aria-label="Quick ETD">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`ow-chip${etd === p.value ? ' is-live' : ''}`}
                  onClick={() => setPreset(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}

          {garmentEtds.count > 0 ? (
            <div className="ow-schedule-garment-etd">
              Garment dates:{' '}
              {garmentEtds.earliest === garmentEtds.latest
                ? formatFriendlyDate(garmentEtds.earliest)
                : `${formatFriendlyDate(garmentEtds.earliest)} → ${formatFriendlyDate(garmentEtds.latest)}`}
            </div>
          ) : (
            <div className="ow-schedule-garment-etd">No per-garment ETD set yet.</div>
          )}
        </article>

        <article className="ow-schedule-card">
          <header className="ow-schedule-card-head">
            <div>
              <h3>Payment</h3>
              <p>Credit applies in full; cash adds on top. Confirm also pulls leftover credit.</p>
            </div>
          </header>

          <div className={`ow-schedule-credit${balance > 0 ? ' is-ready' : ''}`}>
            <div>
              <strong>{formatMoney(balance)}</strong>
              <span>customer credit on account</span>
            </div>
            {!readOnly ? (
              <Button
                type="button"
                disabled={!(balance > 0) || creditState.isLoading}
                onClick={() => void onMoveCredit()}
              >
                {creditState.isLoading ? 'Moving…' : 'Apply all credit'}
              </Button>
            ) : null}
          </div>

          <div className="ow-schedule-cash">
            <h4>Add cash advance</h4>
            <div className="ow-grid two">
              <FormRow label="Amount">
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  disabled={readOnly}
                  {...form.register('cashAmount')}
                />
              </FormRow>
              <FormRow label="Receiving account">
                <select
                  className="vb-control"
                  disabled={readOnly}
                  value={accountId || ''}
                  onChange={(e) => form.setValue('receivingAccountId', e.target.value)}
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
            {accounts.length === 0 ? (
              <p className="ow-schedule-pending">
                No store cash/bank accounts found. Mark Cash Drawer or Bank as store accounts in
                Finance → Accounts.
              </p>
            ) : null}
            {!readOnly ? (
              <div className="ow-actions" style={{ marginTop: '0.65rem' }}>
                <Button
                  type="button"
                  disabled={cashState.isLoading || !(Number(cashAmount) > 0)}
                  onClick={() => void onRecordCash()}
                >
                  {cashState.isLoading ? 'Recording…' : 'Record cash advance'}
                </Button>
                {Number(cashAmount) > 0 ? (
                  <span className="ow-schedule-pending">Unrecorded amount — record before confirm</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {voucher || advance > 0 ? (
            <div className="ow-schedule-receipt">
              <div>
                <span>Advance on order</span>
                <strong>{formatMoney(advance)}</strong>
                {voucher ? (
                  <em>
                    Voucher {asCaption(voucher.voucher_number || voucher.id)}
                    {voucher.amount != null ? ` · ${formatMoney(Number(voucher.amount))}` : ''}
                  </em>
                ) : null}
              </div>
              {voucher ? (
                <Button type="button" variant="ghost" onClick={() => void onReceipt()}>
                  Receipt PDF
                </Button>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>

      <div className="ow-actions">
        <Button type="button" disabled={!canContinue} onClick={onContinue}>
          Continue to review
        </Button>
        {!canContinue ? (
          <span className="ow-schedule-pending">Set an expected delivery date first</span>
        ) : null}
      </div>
    </section>
  );
}
