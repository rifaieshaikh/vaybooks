import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import {
  useCreateBoutiqueOrderInvoiceMutation,
  useLazyGetBoutiqueOrderInvoicePdfQuery,
  useListBoutiqueOrderInvoicesQuery,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { itemIsReadyForInvoice } from '../../activityDefaults';
import { asCaption, extractError, formatMoney } from '../../utils';
import { invoiceSchema } from '../schemas';
import { itemId, itemsOf, activitiesOf, type OrderLike } from '../types';

type Values = z.output<typeof invoiceSchema>;

type Props = {
  orderId: string;
  order: OrderLike;
  onDone?: () => void;
};

export function InvoicePanel({ orderId, order, onDone }: Props) {
  const items = itemsOf(order);
  const activities = activitiesOf(order);
  const { data: invoices = [], refetch } = useListBoutiqueOrderInvoicesQuery(orderId);
  const [createInvoice, createState] = useCreateBoutiqueOrderInvoiceMutation();
  const [fetchPdf] = useLazyGetBoutiqueOrderInvoicePdfQuery();
  const [error, setError] = useState('');

  const readyIds = useMemo(
    () =>
      items
        .filter((item) => itemIsReadyForInvoice(item, activities))
        .map((i) => itemId(i))
        .filter(Boolean),
    [items, activities],
  );

  const form = useForm<Values>({
    resolver: zodResolver(invoiceSchema) as Resolver<Values>,
    defaultValues: {
      billIds: readyIds.slice(0, 1),
      invoiceAmount: 0,
      discountAmount: 0,
      gstRate: 5,
      invoiceDate: new Date().toISOString().slice(0, 10),
      allowAlreadyInvoiced: false,
    },
  });

  const selected = form.watch('billIds') || [];
  const allowAlready = form.watch('allowAlreadyInvoiced');

  useEffect(() => {
    const sum = items
      .filter((i) => selected.includes(itemId(i)))
      .reduce((n, i) => n + (Number(i.sell_amount) || 0), 0);
    form.setValue('invoiceAmount', sum);
  }, [selected, items, form]);

  const selectable = allowAlready
    ? items.map((i) => itemId(i)).filter(Boolean)
    : readyIds;

  async function onSubmit(values: Values) {
    setError('');
    try {
      const created = await createInvoice({
        orderId,
        body: {
          bill_ids: values.billIds,
          invoice_amount: values.invoiceAmount,
          discount_amount: values.discountAmount,
          gst_rate: values.gstRate,
          invoice_date: values.invoiceDate || undefined,
          allow_already_invoiced: values.allowAlreadyInvoiced,
        },
      }).unwrap();
      refetch();
      onDone?.();
      try {
        const blob = await fetchPdf({
          orderId,
          invoiceId: String(created.id),
        }).unwrap();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${asCaption(created.invoice_number) || created.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        /* PDF optional */
      }
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <div className="ow-panel" style={{ boxShadow: 'none' }}>
      <h2>Invoice</h2>
      <p className="ow-lead">Invoice complete bills. Prefill uses estimate amounts.</p>
      {readyIds.length === 0 && !allowAlready ? (
        <div className="ow-banner">No bills ready yet (complete required activities first).</div>
      ) : null}
      <form className="ow-grid" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="ow-check-grid">
          {items.map((item) => {
            const id = itemId(item);
            const ready = readyIds.includes(id);
            if (!selectable.includes(id)) return null;
            return (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={selected.includes(id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, id]
                      : selected.filter((x) => x !== id);
                    form.setValue('billIds', next, { shouldValidate: true });
                  }}
                />
                <span>
                  {asCaption(item.bill_number)} · {asCaption(item.description)}
                  {!ready ? ' (override)' : ''} · {formatMoney(Number(item.sell_amount ?? 0))}
                </span>
              </label>
            );
          })}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" {...form.register('allowAlreadyInvoiced')} />
          Allow already invoiced
        </label>
        <div className="ow-grid two">
          <FormRow label="Invoice amount *">
            <TextInput type="number" step="0.01" {...form.register('invoiceAmount')} />
          </FormRow>
          <FormRow label="Discount">
            <TextInput type="number" step="0.01" {...form.register('discountAmount')} />
          </FormRow>
          <FormRow label="GST %">
            <TextInput type="number" step="0.01" {...form.register('gstRate')} />
          </FormRow>
          <FormRow label="Invoice date">
            <TextInput type="date" {...form.register('invoiceDate')} />
          </FormRow>
        </div>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {form.formState.errors.billIds ? (
          <ErrorText>{form.formState.errors.billIds.message}</ErrorText>
        ) : null}
        <div className="ow-actions">
          <Button
            type="submit"
            data-kb-action="orders.record_invoice"
            disabled={createState.isLoading || selected.length === 0}
          >
            {createState.isLoading ? 'Creating…' : 'Generate invoice'}
          </Button>
        </div>
      </form>
      {invoices.length ? (
        <ul style={{ marginTop: 12 }}>
          {invoices.map((inv) => (
            <li key={String(inv.id)}>
              {asCaption(inv.invoice_number)} ·{' '}
              {formatMoney(Number(inv.invoice_amount ?? inv.grand_total ?? 0))}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
