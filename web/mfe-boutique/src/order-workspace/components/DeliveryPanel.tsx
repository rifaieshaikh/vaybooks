import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import {
  useCreateBoutiqueOrderDeliveryMutation,
  useListBoutiqueOrderDeliveriesQuery,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { itemIsReadyForInvoice } from '../../activityDefaults';
import { asCaption, extractError } from '../../utils';
import { deliverySchema } from '../schemas';
import { activitiesOf, itemId, itemsOf, type OrderLike } from '../types';

type Values = z.output<typeof deliverySchema>;

type Props = {
  orderId: string;
  order: OrderLike;
  onDone?: () => void;
};

export function DeliveryPanel({ orderId, order, onDone }: Props) {
  const items = itemsOf(order);
  const activities = activitiesOf(order);
  const { data: deliveries = [], refetch } = useListBoutiqueOrderDeliveriesQuery(orderId);
  const [createDelivery, createState] = useCreateBoutiqueOrderDeliveryMutation();
  const [error, setError] = useState('');

  const deliveredIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of deliveries) {
      const bills = Array.isArray(d.bill_ids) ? (d.bill_ids as string[]) : [];
      for (const b of bills) set.add(String(b));
    }
    return set;
  }, [deliveries]);

  const readyIds = useMemo(
    () =>
      items
        .filter((item) => itemIsReadyForInvoice(item, activities))
        .map((i) => itemId(i))
        .filter(Boolean),
    [items, activities],
  );

  const form = useForm<Values>({
    resolver: zodResolver(deliverySchema) as Resolver<Values>,
    defaultValues: {
      billIds: readyIds.filter((id) => !deliveredIds.has(id)).slice(0, 1),
      deliveryDate: new Date().toISOString().slice(0, 10),
      deliveryNotes: '',
      allowAlreadyDelivered: false,
    },
  });

  const selected = form.watch('billIds') || [];
  const allowAlready = form.watch('allowAlreadyDelivered');

  const visible = items.filter((item) => {
    const id = itemId(item);
    if (!id) return false;
    if (deliveredIds.has(id) && !allowAlready) return false;
    return true;
  });

  async function onSubmit(values: Values) {
    setError('');
    try {
      await createDelivery({
        orderId,
        body: {
          bill_ids: values.billIds,
          delivery_date: values.deliveryDate || undefined,
          delivery_notes: values.deliveryNotes || undefined,
          allow_already_delivered: values.allowAlreadyDelivered,
        },
      }).unwrap();
      refetch();
      onDone?.();
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <div className="ow-panel" style={{ boxShadow: 'none' }}>
      <h2>Delivery</h2>
      <p className="ow-lead">Record delivery for ready bills.</p>
      <form className="ow-grid" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="ow-check-grid">
          {visible.length === 0 ? (
            <div className="ow-banner">No deliverable bills.</div>
          ) : (
            visible.map((item) => {
              const id = itemId(item);
              const ready = readyIds.includes(id);
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
                    {!ready ? ' (activities incomplete)' : ''}
                    {deliveredIds.has(id) ? ' (already delivered)' : ''}
                  </span>
                </label>
              );
            })
          )}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" {...form.register('allowAlreadyDelivered')} />
          Allow already delivered
        </label>
        <div className="ow-grid two">
          <FormRow label="Delivery date">
            <TextInput type="date" {...form.register('deliveryDate')} />
          </FormRow>
          <FormRow label="Notes">
            <TextInput {...form.register('deliveryNotes')} />
          </FormRow>
        </div>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <div className="ow-actions">
          <Button type="submit" disabled={createState.isLoading || selected.length === 0}>
            {createState.isLoading ? 'Saving…' : 'Record delivery'}
          </Button>
        </div>
      </form>
      {deliveries.length ? (
        <ul style={{ marginTop: 12 }}>
          {deliveries.map((d) => (
            <li key={String(d.id)}>
              {asCaption(d.delivery_date).slice(0, 10)} ·{' '}
              {asCaption((d.bill_ids as string[] | undefined)?.join(', '))}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
