import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useAssignBoutiqueTimeEntryMutation,
  useDeleteBoutiqueTimeEntryMutation,
  useGetBoutiqueOrderQuery,
  useGetBoutiqueTimeEntryQuery,
  useListWorkersQuery,
  useUpdateBoutiqueTimeEntryMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailBanner,
  EntityDetailForm,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityListLoading,
  ErrorText,
  FormRow,
  StatusPill,
  TextInput,
} from '@vaybooks/ui-kit';
import { boutiqueItemStatusTone, boutiqueTaskStatus } from '../boutiqueListHelpers';
import { boutiqueOrderPath } from '../order-workspace/types';
import {
  durationHoursFromRange,
  endTimeFromDuration,
  formatDurationLabel,
} from '../task-log/taskTimeUtils';
import { asCaption, extractError } from '../utils';

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

export function BoutiqueTaskDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromLog = searchParams.get('from') === 'log';
  const listPath = fromLog ? '/boutique/time-log' : '/boutique/time';
  const listLabel = fromLog ? 'Time log' : 'Tasks';

  const { data, isLoading, error, refetch } = useGetBoutiqueTimeEntryQuery(id, { skip: !id });
  const orderId = data ? asCaption(data.order_id) : '';
  const { data: orderDetail } = useGetBoutiqueOrderQuery(orderId, { skip: !orderId });
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const [updateEntry, updateState] = useUpdateBoutiqueTimeEntryMutation();
  const [assignEntry, assignState] = useAssignBoutiqueTimeEntryMutation();
  const [deleteEntry, deleteState] = useDeleteBoutiqueTimeEntryMutation();

  const [formError, setFormError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [activityId, setActivityId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [hoursTaken, setHoursTaken] = useState('2');
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');

  const isPlaceholder = Boolean(
    data && !(asCaption(data.start_time) && asCaption(data.end_time)),
  );

  useEffect(() => {
    if (!data) return;
    setFormError('');
    setSaveOk(false);
    setActivityId(asCaption(data.activity_id));
    setWorkDate(asCaption(data.work_date).slice(0, 10));
    setStartTime(asCaption(data.start_time).slice(0, 5) || '09:00');
    const hours = durationHoursFromRange(asCaption(data.start_time), asCaption(data.end_time));
    setHoursTaken(hours != null ? String(hours) : '2');
    setWorkerId(asCaption(data.assignee_worker_id));
    setWorkerName(asCaption(data.assignee_name || data.worker_name));
    setNotes(asCaption(data.notes));
  }, [data]);

  const billId = data ? asCaption(data.bill_id) : '';
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

  const computed = useMemo(() => {
    const hours = Number(hoursTaken);
    return endTimeFromDuration(startTime, hours);
  }, [startTime, hoursTaken]);

  const saving = updateState.isLoading || assignState.isLoading;

  async function onSave() {
    setFormError('');
    setSaveOk(false);
    try {
      if (isPlaceholder && !computed) {
        await assignEntry({
          id,
          body: {
            assignee_worker_id: workerId,
            assignee_name: workerName,
          },
        }).unwrap();
        setSaveOk(true);
        refetch();
        return;
      }
      if (!workDate) {
        setFormError('Work date is required');
        return;
      }
      if (!computed) {
        setFormError('Enter a valid start time and time taken (hours)');
        return;
      }
      await updateEntry({
        id,
        body: {
          work_date: workDate,
          start_time: startTime,
          end_time: computed.endTime,
          notes,
          activity_id: activityId || undefined,
          ends_next_day: computed.endsNextDay,
          worker_name: workerName,
          assignee_worker_id: workerId,
          assignee_name: workerName,
        },
      }).unwrap();
      setSaveOk(true);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onDelete() {
    if (!window.confirm('Delete this task?')) return;
    setFormError('');
    try {
      await deleteEntry(id).unwrap();
      navigate(listPath);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  if (isLoading) return <EntityListLoading>Loading task…</EntityListLoading>;
  if (error || !data) return <ErrorText>Task not found.</ErrorText>;

  const status = boutiqueTaskStatus(data);
  const activityName = asCaption(data.activity_name) || 'Task';
  const orderNumber = asCaption(data.order_number);
  const billNumber = asCaption(data.bill_number);
  const orderStatus = asCaption(orderDetail?.order_status || orderDetail?.status);
  const taskType = asCaption(data.task_type) || 'activity';
  const durationLabel = formatDurationLabel(Number(data.duration_minutes || 0));
  const workDateLabel = asCaption(data.work_date).slice(0, 10) || '—';
  const assignee =
    asCaption(data.assignee_name) || asCaption(data.worker_name) || 'Unassigned';
  const itemPath =
    orderId && billId
      ? `/boutique/items/${billId}?orderId=${encodeURIComponent(orderId)}&tab=tasks`
      : '';

  return (
    <EntityDetailPage>
      <EntityDetailBack to={listPath} label={listLabel} />

      <EntityDetailHero
        kicker={`Boutique · ${fromLog ? 'Time log' : 'Task'}${orderNumber ? ` · ${orderNumber}` : ''}`}
        title={activityName}
        lead={
          <>
            <StatusPill status={status} tone={boutiqueItemStatusTone(status)} />
            <span className="ed-lead-sep"> · {workDateLabel}</span>
            <span className="ed-lead-sep"> · {assignee}</span>
          </>
        }
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => void refetch()}>
              Refresh
            </Button>
            {itemPath ? (
              <Button type="button" variant="ghost" onClick={() => navigate(itemPath)}>
                Open item
              </Button>
            ) : null}
            {orderId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(boutiqueOrderPath(orderId, orderStatus))}
              >
                Open order
              </Button>
            ) : null}
            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Saving…' : isPlaceholder && !computed ? 'Assign' : 'Save'}
            </Button>
          </>
        }
      />

      <EntityDetailSnapshot
        items={[
          {
            label: 'Order',
            value: orderId ? (
              <button
                type="button"
                className="ed-inline-link"
                onClick={() => navigate(boutiqueOrderPath(orderId, orderStatus))}
              >
                {orderNumber || 'Open'}
              </button>
            ) : (
              '—'
            ),
          },
          {
            label: 'Item',
            value: (
              <span title={billNumber || undefined}>
                {itemPath ? (
                  <button
                    type="button"
                    className="ed-inline-link"
                    onClick={() => navigate(itemPath)}
                  >
                    {billNumber || 'Open'}
                  </button>
                ) : (
                  billNumber || '—'
                )}
              </span>
            ),
          },
          { label: 'Type', value: taskType },
          { label: 'Time taken', value: durationLabel },
          {
            label: 'Hours',
            value: `${asCaption(data.start_time).slice(0, 5) || '—'}–${asCaption(data.end_time).slice(0, 5) || '—'}`,
          },
        ]}
      />

      {isPlaceholder ? (
        <EntityDetailBanner>
          This task is still open. Assign a worker now, or enter start time and hours taken to
          complete it.
        </EntityDetailBanner>
      ) : null}

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {saveOk && !formError ? <p className="ed-panel-note is-ok">Saved.</p> : null}

      <EntityDetailPanel
        title="Task details"
        note="Update assignee, schedule, and time taken. Cross-links stay with the order and garment."
      >
        <EntityDetailForm>
          <div className="ed-grid">
            <FormRow label="Activity">
              <select
                value={activityId}
                disabled={!isPlaceholder}
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
            <FormRow label="Assignee">
              <select
                value={workerId}
                onChange={(e) => {
                  const next = e.target.value;
                  setWorkerId(next);
                  const match = eligibleWorkers.find((w) => String(w.id) === next);
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
            <FormRow label="Start">
              <TextInput
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="09:00"
              />
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
            <FormRow label="Ends">
              <input
                value={
                  computed
                    ? `${computed.endTime}${computed.endsNextDay ? ' (next day)' : ''}`
                    : '—'
                }
                disabled
                readOnly
              />
            </FormRow>
          </div>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          {computed ? (
            <p className="ed-hint">
              Logged duration {formatDurationLabel(Math.round(Number(hoursTaken) * 60))}
            </p>
          ) : isPlaceholder ? (
            <p className="ed-hint">Assign an employee, or enter time taken to complete the task.</p>
          ) : (
            <ErrorText>Enter a valid start time and positive hours.</ErrorText>
          )}
        </EntityDetailForm>
      </EntityDetailPanel>

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate(listPath)}>
            Back to list
          </Button>
        }
        end={
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={deleteState.isLoading}
              onClick={() => void onDelete()}
            >
              Delete
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Saving…' : isPlaceholder && !computed ? 'Assign' : 'Save'}
            </Button>
          </>
        }
      />
    </EntityDetailPage>
  );
}
