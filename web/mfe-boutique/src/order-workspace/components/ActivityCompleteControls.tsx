import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  useCompleteBoutiqueActivityMutation,
  useSkipBoutiqueActivityMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../../utils';
import { activityCompleteSchema } from '../schemas';
import type { z } from 'zod';

type Values = z.output<typeof activityCompleteSchema>;

type Props = {
  orderId: string;
  activity: Record<string, unknown>;
  catalog: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  timeEntries?: Record<string, unknown>[];
  readOnly?: boolean;
  /** When true, show one-line row; expand form only when completing. */
  compact?: boolean;
  defaultOpen?: boolean;
  onDone?: () => void;
};

export function ActivityCompleteControls({
  orderId,
  activity,
  catalog,
  expenses,
  timeEntries = [],
  readOnly,
  compact = false,
  defaultOpen = false,
  onDone,
}: Props) {
  const [error, setError] = useState('');
  const [open, setOpen] = useState(defaultOpen && !compact ? true : false);
  const [complete, completeState] = useCompleteBoutiqueActivityMutation();
  const [skip, skipState] = useSkipBoutiqueActivityMutation();
  const form = useForm<Values>({
    resolver: zodResolver(activityCompleteSchema) as Resolver<Values>,
    defaultValues: {
      purchasePrice: 0,
      sellingPrice: 0,
      vendorOrWorkerName: '',
      notes: '',
    },
  });

  const oaId = String(activity.order_activity_id || activity.id || '');
  const status = asCaption(activity.activity_status || activity.status);
  const done = status === 'Completed' || status === 'Skipped';
  const cfg = catalog.find((c) => String(c.id) === String(activity.activity_id));
  const needsTime = Boolean(cfg?.requires_time_tracking);
  const estimatedHours = Number(activity.estimated_hours ?? 0);
  const hasTaskLogged = useMemo(() => {
    const activityId = String(activity.activity_id || '');
    const billId = String(activity.bill_id || '');
    return timeEntries.some(
      (row) =>
        String(row.order_id || '') === orderId &&
        String(row.activity_id || '') === activityId &&
        (!billId || String(row.bill_id || '') === billId) &&
        String(row.task_type || 'activity') === 'activity' &&
        Number(row.duration_minutes || 0) > 0,
    );
  }, [timeEntries, orderId, activity]);
  const expenseExists = useMemo(
    () =>
      expenses.some(
        (e) =>
          String(e.order_activity_id || e.activity_id || '') === oaId ||
          (String(e.activity_name || '') === asCaption(activity.activity_name) &&
            String(e.bill_id || '') === String(activity.bill_id || '')),
      ),
    [expenses, oaId, activity],
  );

  async function onComplete(values: Values) {
    setError('');
    try {
      const purchase = Number(values.purchasePrice) || 0;
      await complete({
        orderId,
        activityId: oaId,
        body: {
          completed_by: 'web',
          purchase_price: purchase,
          selling_price: Number(values.sellingPrice) || 0,
          vendor_or_worker_name: values.vendorOrWorkerName || undefined,
          notes: values.notes || undefined,
          add_expense: expenseExists ? false : purchase > 0 || needsTime,
        },
      }).unwrap();
      setOpen(false);
      onDone?.();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onSkip() {
    setError('');
    try {
      await skip({
        orderId,
        activityId: oaId,
        body: { completed_by: 'web' },
      }).unwrap();
      setOpen(false);
      onDone?.();
    } catch (e) {
      setError(extractError(e));
    }
  }

  const statusTone =
    status === 'Completed' ? 'is-ok' : status === 'Skipped' ? 'is-muted' : 'is-pending';

  const metaBits = [
    estimatedHours > 0 ? `${estimatedHours}h est` : '',
    needsTime && !done ? (hasTaskLogged ? 'Task logged' : 'Task needed') : '',
  ].filter(Boolean);

  const formBlock =
    !done && !readOnly && open ? (
      <form className="ow-act-form" onSubmit={form.handleSubmit(onComplete)}>
        <div className="ow-grid two">
          <FormRow label="Purchase / expense">
            <TextInput type="number" step="0.01" min="0" {...form.register('purchasePrice')} />
          </FormRow>
          <FormRow label="Selling price">
            <TextInput type="number" step="0.01" min="0" {...form.register('sellingPrice')} />
          </FormRow>
          <FormRow label="Vendor / worker">
            <TextInput {...form.register('vendorOrWorkerName')} />
          </FormRow>
          <FormRow label="Notes">
            <TextInput {...form.register('notes')} />
          </FormRow>
        </div>
        {needsTime ? (
          <div className="ow-banner ow-banner-tight">
            {hasTaskLogged
              ? 'Task time logged — ready to complete.'
              : 'Record a task with time taken before completing. '}
            {!hasTaskLogged ? (
              <Link
                to={`/boutique/time?new=1&orderId=${encodeURIComponent(orderId)}&billId=${encodeURIComponent(String(activity.bill_id || ''))}&activityId=${encodeURIComponent(String(activity.activity_id || ''))}`}
              >
                Record task
              </Link>
            ) : (
              <Link to="/boutique/time-log">Time log</Link>
            )}
          </div>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <div className="ow-actions" style={{ marginTop: 0 }}>
          <Button
            type="submit"
            disabled={completeState.isLoading || (needsTime && !hasTaskLogged)}
            title={needsTime && !hasTaskLogged ? 'Record a task first' : undefined}
          >
            {completeState.isLoading ? 'Saving…' : 'Confirm complete'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    ) : null;

  if (compact) {
    return (
      <div className={`ow-act-row${open ? ' is-open' : ''}${done ? ' is-done' : ''}`}>
        <div className="ow-act-row-main">
          <div className="ow-act-row-copy">
            <strong>{asCaption(activity.activity_name)}</strong>
            {metaBits.length ? (
              <span className="ow-act-row-meta">{metaBits.join(' · ')}</span>
            ) : null}
          </div>
          <span className={`ow-act-status ${statusTone}`}>{status || 'Pending'}</span>
          {!done && !readOnly ? (
            <div className="ow-act-row-actions">
              {open ? null : (
                <>
                  <Button type="button" onClick={() => setOpen(true)}>
                    Complete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={skipState.isLoading}
                    onClick={() => void onSkip()}
                  >
                    Skip
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
        {formBlock}
      </div>
    );
  }

  return (
    <div className="ow-act-card">
      <div>
        <strong>{asCaption(activity.activity_name)}</strong>
        <div style={{ fontSize: 13, color: 'var(--ow-muted)' }}>
          {status}
          {estimatedHours > 0 ? ` · Est. ${estimatedHours} hrs` : ''}
          {needsTime && !done ? (hasTaskLogged ? ' · Task logged' : ' · Task required') : ''}
        </div>
      </div>
      {!done && !readOnly && !open ? (
        <div className="ow-actions" style={{ marginTop: 0 }}>
          <Button type="button" onClick={() => setOpen(true)}>
            Complete
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={skipState.isLoading}
            onClick={() => void onSkip()}
          >
            Skip
          </Button>
        </div>
      ) : null}
      {formBlock}
    </div>
  );
}
