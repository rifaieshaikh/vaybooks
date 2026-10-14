import { useEffect, useMemo, useState } from 'react';
import {
  useAssignBoutiqueTimeEntryMutation,
  useCreateBoutiqueTimeEntryMutation,
  useGetBoutiqueOrderQuery,
  useListBoutiqueOrdersQuery,
  useListWorkersQuery,
  useUpdateBoutiqueTimeEntryMutation,
} from '@vaybooks/store';
import { Button, EntityDetailForm, ErrorText, FormRow, Modal, TextInput } from '@vaybooks/ui-kit';
import { LIST_FETCH_ALL_SIZE, pagedItems } from '../pagedList';
import { asCaption, extractError } from '../utils';
import {
  durationHoursFromRange,
  endTimeFromDuration,
  formatDurationLabel,
} from './taskTimeUtils';

export type TaskEntryPrefill = {
  orderId?: string;
  billId?: string;
  activityId?: string;
  workDate?: string;
  startTime?: string;
  hoursTaken?: number;
  workerName?: string;
  assigneeWorkerId?: string;
  notes?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Existing entry for edit mode. */
  entry?: Record<string, unknown> | null;
  /** Defaults when creating. */
  prefill?: TaskEntryPrefill;
  /** Lock order/item when opened from item detail. */
  lockOrderItem?: boolean;
  title?: string;
};

function workerMatchesActivity(worker: Record<string, unknown>, activityId: string): boolean {
  if (!activityId) return true;
  const refs = Array.isArray(worker.activity_refs) ? worker.activity_refs : [];
  if (refs.length === 0) {
    const ids = Array.isArray(worker.activity_ids) ? worker.activity_ids : [];
    return ids.map(String).includes(activityId);
  }
  return refs.some((ref) => {
    const row = ref as Record<string, unknown>;
    const source = String(row.source || 'customization');
    return source === 'customization' && String(row.activity_id || '') === activityId;
  });
}

export function TaskEntryModal({
  open,
  onClose,
  onSaved,
  entry,
  prefill,
  lockOrderItem,
  title,
}: Props) {
  const isEdit = Boolean(entry?.id);
  const isPlaceholder =
    isEdit && !(asCaption(entry?.start_time) && asCaption(entry?.end_time));
  const { data: ordersPage } = useListBoutiqueOrdersQuery({
    page: 1,
    page_size: LIST_FETCH_ALL_SIZE,
  });
  const orders = pagedItems(ordersPage);
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const [createEntry, createState] = useCreateBoutiqueTimeEntryMutation();
  const [updateEntry, updateState] = useUpdateBoutiqueTimeEntryMutation();
  const [assignEntry, assignState] = useAssignBoutiqueTimeEntryMutation();

  const [formError, setFormError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [billId, setBillId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [hoursTaken, setHoursTaken] = useState('2');
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');

  const { data: orderDetail } = useGetBoutiqueOrderQuery(orderId, { skip: !orderId });

  const items = useMemo(
    () =>
      orderDetail && Array.isArray(orderDetail.customization_items)
        ? (orderDetail.customization_items as Record<string, unknown>[])
        : [],
    [orderDetail],
  );

  const activitiesForBill = useMemo(() => {
    if (!orderDetail || !Array.isArray(orderDetail.order_activities) || !billId) return [];
    return (orderDetail.order_activities as Record<string, unknown>[]).filter(
      (act) => String(act.bill_id || '') === billId,
    );
  }, [orderDetail, billId]);

  const eligibleWorkers = useMemo(
    () =>
      (workers as Record<string, unknown>[]).filter((w) =>
        workerMatchesActivity(w, activityId),
      ),
    [workers, activityId],
  );

  const entryId = entry?.id ? String(entry.id) : '';
  const prefillKey = JSON.stringify(prefill || {});

  useEffect(() => {
    if (!open) return;
    setFormError('');
    if (entry) {
      setOrderId(asCaption(entry.order_id));
      setBillId(asCaption(entry.bill_id));
      setActivityId(asCaption(entry.activity_id));
      setWorkDate(asCaption(entry.work_date).slice(0, 10));
      setStartTime(asCaption(entry.start_time).slice(0, 5) || '09:00');
      const hours = durationHoursFromRange(
        asCaption(entry.start_time),
        asCaption(entry.end_time),
      );
      setHoursTaken(hours != null ? String(hours) : '2');
      setWorkerId(asCaption(entry.assignee_worker_id));
      setWorkerName(asCaption(entry.assignee_name || entry.worker_name));
      setNotes(asCaption(entry.notes));
      return;
    }
    setOrderId(prefill?.orderId || '');
    setBillId(prefill?.billId || '');
    setActivityId(prefill?.activityId || '');
    setWorkDate(prefill?.workDate || new Date().toISOString().slice(0, 10));
    setStartTime(prefill?.startTime || '09:00');
    setHoursTaken(prefill?.hoursTaken != null ? String(prefill.hoursTaken) : '2');
    setWorkerId(prefill?.assigneeWorkerId || '');
    setWorkerName(prefill?.workerName || '');
    setNotes(prefill?.notes || '');
  }, [open, entryId, prefillKey]);

  const computed = useMemo(() => {
    const hours = Number(hoursTaken);
    return endTimeFromDuration(startTime, hours);
  }, [startTime, hoursTaken]);

  const saving = createState.isLoading || updateState.isLoading || assignState.isLoading;
  const canAssignOnly = isPlaceholder && Boolean(entry?.id) && Boolean(workerId || workerName);
  const canSaveTime =
    Boolean(orderId && billId && activityId && workDate && computed) && !saving;
  const canSave = (canSaveTime || canAssignOnly) && !saving;

  async function onSave() {
    setFormError('');
    try {
      if (isPlaceholder && entry?.id && !computed) {
        await assignEntry({
          id: String(entry.id),
          body: {
            assignee_worker_id: workerId,
            assignee_name: workerName,
          },
        }).unwrap();
        onSaved?.();
        onClose();
        return;
      }
      if (!orderId || !billId || !activityId || !workDate) {
        setFormError('Order, item, activity, and work date are required');
        return;
      }
      if (!computed) {
        setFormError('Enter a valid start time and time taken (hours)');
        return;
      }
      const assignee = {
        worker_name: workerName,
        assignee_worker_id: workerId,
        assignee_name: workerName,
      };
      if (isEdit && entry?.id) {
        await updateEntry({
          id: String(entry.id),
          body: {
            work_date: workDate,
            start_time: startTime,
            end_time: computed.endTime,
            notes,
            activity_id: activityId,
            ends_next_day: computed.endsNextDay,
            ...assignee,
          },
        }).unwrap();
      } else {
        await createEntry({
          order_id: orderId,
          bill_id: billId,
          activity_id: activityId,
          work_date: workDate,
          start_time: startTime,
          end_time: computed.endTime,
          notes,
          ends_next_day: computed.endsNextDay,
          ...assignee,
        }).unwrap();
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  const locked = Boolean(lockOrderItem);

  return (
    <Modal
      open={open}
      title={title || (isEdit ? (isPlaceholder ? 'Task' : 'Edit task') : 'Record task')}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={!canSave}>
            {saving ? 'Saving…' : isPlaceholder && !computed ? 'Assign' : 'Save'}
          </Button>
        </>
      }
    >
      <EntityDetailForm>
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <FormRow label="Order *">
          <select
            value={orderId}
            disabled={locked || isEdit}
            onChange={(e) => {
              setOrderId(e.target.value);
              setBillId('');
              setActivityId('');
            }}
          >
            <option value="">Select order</option>
            {orders.map((o) => (
              <option key={String(o.id)} value={String(o.id)}>
                {asCaption(o.order_number)} · {asCaption(o.customer_name)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Item / bill *">
          <select
            value={billId}
            disabled={locked || isEdit || !orderId}
            onChange={(e) => {
              setBillId(e.target.value);
              setActivityId('');
            }}
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={String(item.item_id || item.id)} value={String(item.item_id || item.id)}>
                {asCaption(item.bill_number)} · {asCaption(item.description)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Task (activity) *">
          <select
            value={activityId}
            disabled={!billId || isEdit}
            onChange={(e) => setActivityId(e.target.value)}
          >
            <option value="">Select activity</option>
            {activitiesForBill.map((act) => (
              <option key={String(act.order_activity_id)} value={String(act.activity_id)}>
                {asCaption(act.activity_name)}
              </option>
            ))}
          </select>
        </FormRow>
        {orderId && billId && activitiesForBill.length === 0 ? (
          <ErrorText>
            This item has no activities. Add activities on the order first.
          </ErrorText>
        ) : null}
        <FormRow label="Assignee">
          <select
            value={workerId}
            onChange={(e) => {
              const id = e.target.value;
              setWorkerId(id);
              const match = eligibleWorkers.find((w) => String(w.id) === id);
              setWorkerName(match ? asCaption(match.worker_name) : '');
            }}
          >
            <option value="">Unassigned</option>
            {eligibleWorkers.map((w) => (
              <option key={String(w.id)} value={String(w.id)}>
                {asCaption(w.worker_name)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Work date *">
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          />
        </FormRow>
        <div className="ed-grid">
          <FormRow label="Start">
            <TextInput value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="09:00" />
          </FormRow>
          <FormRow label="Time taken (hours)">
            <TextInput
              type="number"
              min="0.05"
              step="0.25"
              value={hoursTaken}
              onChange={(e) => setHoursTaken(e.target.value)}
            />
          </FormRow>
        </div>
        {computed ? (
          <p className="ed-hint">
            Ends {computed.endTime}
            {computed.endsNextDay ? ' (next day)' : ''} ·{' '}
            {formatDurationLabel(Math.round(Number(hoursTaken) * 60))}
          </p>
        ) : isPlaceholder ? (
          <p className="ed-hint">
            Assign an employee now, or enter time taken to complete the task.
          </p>
        ) : (
          <ErrorText>Enter a valid start time and positive hours.</ErrorText>
        )}
        <FormRow label="Notes">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormRow>
      </EntityDetailForm>
    </Modal>
  );
}
