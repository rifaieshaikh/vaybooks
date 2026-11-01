import { useMemo, useState } from 'react';
import {
  useCreateBoutiqueOrderVendorPaymentMutation,
  useListBoutiqueOrderVouchersQuery,
  useListFinanceAccountsQuery,
  useListVendorServicesQuery,
  useListVendorsQuery,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../../../utils';
import { isStoreCashAccount } from '../detailTypes';

type Props = {
  orderId: string;
  readOnly?: boolean;
  onDone?: () => void;
};

export function PaymentsPanel({ orderId, readOnly, onDone }: Props) {
  const { data: vouchers = [], refetch } = useListBoutiqueOrderVouchersQuery({
    orderId,
    kind: 'vendor_payments',
  });
  const { data: accountsRaw = [] } = useListFinanceAccountsQuery({ active_only: true });
  const { data: vendors = [] } = useListVendorsQuery();
  const { data: services = [] } = useListVendorServicesQuery();
  const storeAccounts = useMemo(() => accountsRaw.filter(isStoreCashAccount), [accountsRaw]);
  const vendorAccounts = useMemo(
    () =>
      accountsRaw.filter(
        (a) => a.linked_vendor_id && String(a.account_type || '') === 'Liability',
      ),
    [accountsRaw],
  );
  const expenseAccounts = useMemo(
    () => accountsRaw.filter((a) => String(a.account_type || '') === 'Expense'),
    [accountsRaw],
  );

  const [createPayment, createState] = useCreateBoutiqueOrderVendorPaymentMutation();
  const [amount, setAmount] = useState('');
  const [vendorAccountId, setVendorAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [payingAccountId, setPayingAccountId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Prefer expense account from selected vendor service
  const selectedService = services.find((s) => String(s.id) === serviceId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const amt = Number(amount);
    const expenseId =
      (selectedService?.expense_account_id
        ? String(selectedService.expense_account_id)
        : '') || expenseAccountId;
    if (!(amt > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!vendorAccountId || !expenseId || !payingAccountId) {
      setError('Vendor, expense account, and paying account are required.');
      return;
    }
    try {
      await createPayment({
        orderId,
        body: {
          amount: amt,
          vendor_account_id: vendorAccountId,
          expense_account_id: expenseId,
          paying_account_id: payingAccountId,
          service_id: serviceId || undefined,
          description: description || undefined,
        },
      }).unwrap();
      setAmount('');
      setDescription('');
      setOk('Vendor payment recorded.');
      await refetch();
      onDone?.();
    } catch (err) {
      setError(extractError(err));
    }
  }

  // Map vendors to their accounts when possible
  const vendorOptions = useMemo(() => {
    if (vendorAccounts.length) return vendorAccounts;
    return vendors
      .map((v) => ({
        id: String(v.account_id || v.vendor_account_id || ''),
        account_name: asCaption(v.vendor_name || v.name),
        linked_vendor_id: String(v.id || ''),
      }))
      .filter((v) => v.id);
  }, [vendorAccounts, vendors]);

  return (
    <div className="od-money-panel">
      <h3>Vendor payments</h3>
      <p className="ow-lead">Pay vendors for work on this order.</p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {ok ? <div className="ow-schedule-ok">{ok}</div> : null}

      {!readOnly ? (
        <form className="ow-grid" onSubmit={(e) => void onSubmit(e)}>
          <div className="ow-grid two">
            <FormRow label="Vendor account *">
              <select
                className="vb-control"
                value={vendorAccountId}
                onChange={(e) => setVendorAccountId(e.target.value)}
              >
                <option value="">Select vendor…</option>
                {vendorOptions.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {asCaption(
                      'account_name' in a
                        ? a.account_name
                        : (a as Record<string, unknown>).name,
                    )}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Service (optional)">
              <select
                className="vb-control"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  const svc = services.find((s) => String(s.id) === e.target.value);
                  if (svc?.expense_account_id) {
                    setExpenseAccountId(String(svc.expense_account_id));
                  }
                }}
              >
                <option value="">None</option>
                {services
                  .filter((s) => s.is_active !== false)
                  .map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {asCaption(s.service_name || s.name)}
                    </option>
                  ))}
              </select>
            </FormRow>
            <FormRow label="Expense account *">
              <select
                className="vb-control"
                value={expenseAccountId}
                onChange={(e) => setExpenseAccountId(e.target.value)}
              >
                <option value="">Select expense…</option>
                {expenseAccounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {asCaption(a.account_name || a.name)}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Paying account *">
              <select
                className="vb-control"
                value={payingAccountId}
                onChange={(e) => setPayingAccountId(e.target.value)}
              >
                <option value="">Select cash / bank…</option>
                {storeAccounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {asCaption(a.account_name || a.name)}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Amount *">
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormRow>
            <FormRow label="Description">
              <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormRow>
          </div>
          <div className="ow-actions">
            <Button type="submit" data-kb-action="orders.record_payment" disabled={createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Record payment'}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="od-expense-list" style={{ marginTop: '1rem' }}>
        {vouchers.length === 0 ? (
          <li>
            <span>No vendor payments yet.</span>
            <strong>—</strong>
          </li>
        ) : (
          vouchers.map((v) => (
            <li key={String(v.id)}>
              <span>
                {asCaption(v.voucher_number)} · {asCaption(v.description) || 'Payment'}
              </span>
              <strong>{formatMoney(Number(v.cash_amount ?? 0))}</strong>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
