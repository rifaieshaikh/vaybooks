import { useState } from 'react';
import {
  useCreateBoutiqueOrderExpenseMutation,
  useListBoutiqueOrderExpensesQuery,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../../../utils';
import { expenseAmount } from '../detailTypes';
import { itemsOf, type OrderLike } from '../../types';

type Props = {
  orderId: string;
  order: OrderLike;
  readOnly?: boolean;
  onDone?: () => void;
};

const SOURCES = ['In House', 'Outsourced', 'Material', 'Other'];

export function ExpensesPanel({ orderId, order, readOnly, onDone }: Props) {
  const { data: expenses = [], refetch } = useListBoutiqueOrderExpensesQuery(orderId);
  const [createExpense, createState] = useCreateBoutiqueOrderExpenseMutation();
  const items = itemsOf(order);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [name, setName] = useState('');
  const [source, setSource] = useState('Other');
  const [purchase, setPurchase] = useState('');
  const [selling, setSelling] = useState('');
  const [billId, setBillId] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const purchasePrice = Number(purchase);
    const sellingPrice = Number(selling);
    if (!name.trim()) {
      setError('Expense name is required.');
      return;
    }
    if (!(purchasePrice > 0) || !(sellingPrice > 0)) {
      setError('Purchase and selling prices must be greater than zero.');
      return;
    }
    try {
      await createExpense({
        orderId,
        body: {
          expense_name: name.trim(),
          expense_source: source,
          purchase_price: purchasePrice,
          selling_price: sellingPrice,
          bill_id: billId || undefined,
          vendor_or_worker_name: vendor || undefined,
          notes: notes || undefined,
        },
      }).unwrap();
      setName('');
      setPurchase('');
      setSelling('');
      setVendor('');
      setNotes('');
      setOk('Expense added.');
      await refetch();
      onDone?.();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <div className="od-money-panel">
      <h3>Expenses</h3>
      <p className="ow-lead">Order costs — also created when completing activities.</p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {ok ? <div className="ow-schedule-ok">{ok}</div> : null}

      {!readOnly ? (
        <form className="ow-grid" onSubmit={(e) => void onSubmit(e)}>
          <div className="ow-grid two">
            <FormRow label="Name *">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </FormRow>
            <FormRow label="Source">
              <select
                className="vb-control"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Purchase price *">
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={purchase}
                onChange={(e) => setPurchase(e.target.value)}
              />
            </FormRow>
            <FormRow label="Selling price *">
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={selling}
                onChange={(e) => setSelling(e.target.value)}
              />
            </FormRow>
            <FormRow label="Garment / bill">
              <select
                className="vb-control"
                value={billId}
                onChange={(e) => setBillId(e.target.value)}
              >
                <option value="">Order-level</option>
                {items.map((item) => (
                  <option
                    key={String(item.item_id || item.id)}
                    value={String(item.item_id || item.id)}
                  >
                    {asCaption(item.bill_number) || asCaption(item.description)}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Vendor / worker">
              <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </FormRow>
          </div>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          <div className="ow-actions">
            <Button type="submit" data-kb-action="items.expense.add" disabled={createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Add expense'}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="od-expense-list" style={{ marginTop: '1rem' }}>
        {expenses.length === 0 ? (
          <li>
            <span>No expenses yet.</span>
            <strong>—</strong>
          </li>
        ) : (
          expenses.map((e) => (
            <li key={String(e.id)}>
              <span>
                {asCaption(e.expense_name || e.activity_name || e.description) || 'Expense'}
                {e.bill_number ? ` · ${asCaption(e.bill_number)}` : ''}
              </span>
              <strong>{formatMoney(expenseAmount(e))}</strong>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
