import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useBoutiqueCalendarQuery,
  useCancelCrmActivityMutation,
  useCompleteCrmActivityMutation,
  useCreateCrmActivityMutation,
  useCrmCalendarQuery,
  useGetBusinessProfileQuery,
  useListCrmLeadsQuery,
  useListCrmOwnersQuery,
  useModuleEnabled,
  useRescheduleCrmActivityMutation,
} from '@vaybooks/store';
import {
  Button,
  CalendarView,
  ErrorText,
  FormRow,
  Modal,
  type CalendarCategory,
  type CalendarEvent,
  type CalendarViewMode,
} from '@vaybooks/ui-kit';
import {
  BOUTIQUE_CATEGORY,
  activityEventTitle,
  activityToCalendarEvent,
  boutiqueTaskToCalendarEvent,
  businessCalendarPrefs,
  crmCalendarRange,
  fromDatetimeLocalValue,
  isBoutiqueCalendarEvent,
  isVisitActivity,
  markAssigneeConflicts,
  slotScheduledAt,
  sortRouteTodayEvents,
  toDatetimeLocalValue,
} from '../calendarHelpers';
import { useCrmCan, useCrmSettingsCatalogs } from '../hooks';
import { asCaption, extractError } from '../utils';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Missed', label: 'Missed' },
] as const;

type ModalMode = 'create' | 'event' | null;

export function CrmCalendarPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const moduleEnabled = useModuleEnabled();
  const boutiqueEnabled = moduleEnabled('boutique');
  const { catalogs } = useCrmSettingsCatalogs();
  const { data: business } = useGetBusinessProfileQuery();
  const calendarPrefs = useMemo(
    () => businessCalendarPrefs(business as Record<string, unknown> | undefined),
    [business],
  );

  const { data: owners = [] } = useListCrmOwnersQuery(undefined, {
    skip: !can.viewLeads && !can.viewActivities,
  });
  const { data: leadsPage } = useListCrmLeadsQuery(
    { page_size: 200 },
    { skip: !can.createActivities && !can.viewActivities },
  );
  const leads = useMemo(
    () =>
      Array.isArray(leadsPage?.items) ? leadsPage.items : Array.isArray(leadsPage) ? leadsPage : [],
    [leadsPage],
  );
  const leadById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const lead of leads) {
      const id = String(lead.id || '').trim();
      if (id) map.set(id, lead as Record<string, unknown>);
    }
    return map;
  }, [leads]);

  const [view, setView] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [status, setStatus] = useState('');
  const [activityType, setActivityType] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[] | undefined>(undefined);
  const [routeToday, setRouteToday] = useState(false);

  const range = useMemo(
    () => crmCalendarRange(cursor, view, calendarPrefs.weekStartsOn),
    [cursor, view, calendarPrefs.weekStartsOn],
  );

  const { data = [], isLoading, error, refetch } = useCrmCalendarQuery({
    scheduled_from: range.scheduled_from,
    scheduled_to: range.scheduled_to,
    status: status || undefined,
    activity_type: activityType || undefined,
    assigned_user_id: assigneeId || undefined,
  });

  const boutiqueQ = useBoutiqueCalendarQuery(
    {
      start_date: range.scheduled_from.slice(0, 10),
      end_date: range.scheduled_to.slice(0, 10),
    },
    { skip: !boutiqueEnabled },
  );

  const [createActivity, createState] = useCreateCrmActivityMutation();
  const [completeActivity, completeState] = useCompleteCrmActivityMutation();
  const [cancelActivity, cancelState] = useCancelCrmActivityMutation();
  const [rescheduleActivity, rescheduleState] = useRescheduleCrmActivityMutation();

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  // Create form
  const [leadId, setLeadId] = useState('');
  const [createType, setCreateType] = useState('Called');
  const [createNotes, setCreateNotes] = useState('');
  const [createScheduledAt, setCreateScheduledAt] = useState('');
  const [createAssignee, setCreateAssignee] = useState('');

  // Event actions form
  const [outcome, setOutcome] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const typeOptions = useMemo(() => {
    const labels = catalogs.activityTypeLabels.length
      ? catalogs.activityTypeLabels
      : ['Called', 'Meeting', 'General Follow-up', 'WhatsApp Message', 'Email', 'Note', 'Visit'];
    return labels;
  }, [catalogs.activityTypeLabels]);

  const defaultSlotHour = calendarPrefs.workingHours?.startHour ?? 9;

  const crmEvents: CalendarEvent[] = useMemo(() => {
    return data
      .map((row) => activityToCalendarEvent(row as Record<string, unknown>, leadById))
      .filter(Boolean) as CalendarEvent[];
  }, [data, leadById]);

  const boutiqueEvents: CalendarEvent[] = useMemo(() => {
    if (!boutiqueEnabled) return [];
    const rows = Array.isArray(boutiqueQ.data) ? boutiqueQ.data : [];
    return rows
      .map((row) => boutiqueTaskToCalendarEvent(row as Record<string, unknown>))
      .filter(Boolean) as CalendarEvent[];
  }, [boutiqueEnabled, boutiqueQ.data]);

  const events: CalendarEvent[] = useMemo(() => {
    let merged = markAssigneeConflicts([...crmEvents, ...boutiqueEvents]);
    if (routeToday) {
      const todayKey = toDateKeyLocal(cursor);
      merged = merged.filter((ev) => {
        if (isBoutiqueCalendarEvent(ev)) return false;
        const row = (ev.payload || {}) as Record<string, unknown>;
        if (!isVisitActivity(row)) return false;
        return String(ev.start || '').slice(0, 10) === todayKey;
      });
    }
    return merged;
  }, [crmEvents, boutiqueEvents, routeToday, cursor]);

  const categories: CalendarCategory[] = useMemo(() => {
    const ids = new Set<string>();
    for (const t of typeOptions) ids.add(t);
    for (const ev of events) {
      if (ev.category) ids.add(ev.category);
    }
    if (boutiqueEnabled) ids.add(BOUTIQUE_CATEGORY);
    return Array.from(ids).map((id) => ({
      id,
      label: id,
      tone: id === BOUTIQUE_CATEGORY ? ('accent' as const) : ('primary' as const),
    }));
  }, [typeOptions, events, boutiqueEnabled]);

  const activeCategories = selectedCategories ?? categories.map((c) => c.id);

  const dayEventSort = useCallback(
    (a: CalendarEvent, b: CalendarEvent) => {
      if (routeToday) return sortRouteTodayEvents(a, b);
      return String(a.start).localeCompare(String(b.start));
    },
    [routeToday],
  );

  function openCreate(day: Date) {
    if (!can.createActivities) return;
    setFormError('');
    setMessage('');
    setLeadId('');
    setCreateType(typeOptions[0] || 'Called');
    setCreateNotes('');
    setCreateScheduledAt(slotScheduledAt(day, defaultSlotHour));
    setCreateAssignee(assigneeId);
    setSelected(null);
    setModalMode('create');
  }

  function openBoutiqueEvent(ev: CalendarEvent) {
    const row = (ev.payload || {}) as Record<string, unknown>;
    const orderId = row.order_id != null ? String(row.order_id) : '';
    const billId = row.bill_id != null ? String(row.bill_id) : '';
    if (orderId && billId) {
      navigate(`/boutique/items/${billId}?orderId=${encodeURIComponent(orderId)}&tab=tasks`);
      return;
    }
    if (orderId) {
      const status = String(row.order_status || row.status || '');
      navigate(
        status === 'Draft' || !status
          ? `/boutique/orders/workspace?order=${encodeURIComponent(orderId)}`
          : `/boutique/orders/${orderId}`,
      );
      return;
    }
    navigate('/boutique/time');
  }

  function openEvent(ev: CalendarEvent) {
    if (isBoutiqueCalendarEvent(ev)) {
      openBoutiqueEvent(ev);
      return;
    }
    const row = (ev.payload || {}) as Record<string, unknown>;
    setFormError('');
    setMessage('');
    setSelected({ ...row, id: row.id || ev.id });
    setOutcome('');
    setCompleteNotes(String(row.notes || ''));
    setCancelReason('');
    setRescheduleAt(toDatetimeLocalValue(String(row.scheduled_at || ev.start || '')));
    setRescheduleReason('');
    setModalMode('event');
  }

  function onMyRouteToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCursor(today);
    setView('day');
    setRouteToday(true);
    setActivityType('Visit');
    setMessage('My route today — visits sorted by area, then time');
  }

  function clearRouteToday() {
    setRouteToday(false);
    setActivityType('');
    setMessage('');
  }

  async function onCreate() {
    setFormError('');
    if (!leadId) {
      setFormError('Select a lead');
      return;
    }
    if (!createScheduledAt) {
      setFormError('Scheduled time is required');
      return;
    }
    try {
      const owner = owners.find((o) => o.id === createAssignee);
      const row = await createActivity({
        activity_type: createType,
        lead_id: leadId,
        notes: createNotes,
        scheduled_at: fromDatetimeLocalValue(createScheduledAt),
        status: 'Scheduled',
        assigned_user_id: createAssignee || undefined,
        assigned_user_name: owner?.name || undefined,
      }).unwrap();
      setModalMode(null);
      setMessage('Activity created');
      refetch();
      if (row?.id) navigate(`/crm/activities/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onComplete() {
    if (!selected?.id || !can.completeActivities) return;
    setFormError('');
    try {
      await completeActivity({
        id: String(selected.id),
        outcome: outcome || undefined,
        notes: completeNotes || undefined,
      }).unwrap();
      setModalMode(null);
      setMessage('Activity completed');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onCancel() {
    if (!selected?.id || !can.editActivities) return;
    setFormError('');
    if (!cancelReason.trim()) {
      setFormError('Cancellation reason is required');
      return;
    }
    try {
      await cancelActivity({ id: String(selected.id), reason: cancelReason.trim() }).unwrap();
      setModalMode(null);
      setMessage('Activity cancelled');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onReschedule() {
    if (!selected?.id || !can.editActivities) return;
    setFormError('');
    if (!rescheduleAt) {
      setFormError('New schedule is required');
      return;
    }
    try {
      await rescheduleActivity({
        id: String(selected.id),
        scheduled_at: fromDatetimeLocalValue(rescheduleAt),
        reason: rescheduleReason,
      }).unwrap();
      setModalMode(null);
      setMessage('Activity rescheduled');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onEventMove(ev: CalendarEvent, nextStart: string) {
    if (!catalogs.calendarDragEnabled || !can.editActivities) return;
    if (isBoutiqueCalendarEvent(ev)) return;
    const id = String(ev.id || '');
    if (!id) return;
    try {
      await rescheduleActivity({
        id,
        scheduled_at: new Date(nextStart).toISOString(),
        reason: 'Dragged on calendar',
      }).unwrap();
      setMessage('Activity rescheduled');
      refetch();
    } catch (e) {
      setMessage(extractError(e));
    }
  }

  const busy =
    createState.isLoading ||
    completeState.isLoading ||
    cancelState.isLoading ||
    rescheduleState.isLoading;

  const loading = isLoading || (boutiqueEnabled && boutiqueQ.isLoading);

  const filterBar = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
        alignItems: 'flex-end',
      }}
    >
      <FormRow label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: 140 }}>
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Activity type">
        <select
          value={activityType}
          onChange={(e) => {
            setActivityType(e.target.value);
            if (routeToday && e.target.value !== 'Visit') setRouteToday(false);
          }}
          style={{ minWidth: 160 }}
        >
          <option value="">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Assignee">
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">All assignees</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name || o.id}
            </option>
          ))}
        </select>
      </FormRow>
    </div>
  );

  return (
    <div>
      {filterBar}
      {message ? (
        <p style={{ color: 'var(--vb-color-primary, #185c4c)', margin: '0 0 8px' }}>{message}</p>
      ) : null}

      <CalendarView
        kicker="CRM"
        title="Calendar"
        count={`${events.length} ${events.length === 1 ? 'item' : 'items'}`}
        events={events}
        view={view}
        onViewChange={(next) => {
          setView(next);
          if (routeToday && next !== 'day' && next !== 'agenda') setRouteToday(false);
        }}
        cursor={cursor}
        onCursorChange={(d) => {
          setCursor(d);
          if (routeToday) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (d.getTime() !== today.getTime()) setRouteToday(false);
          }
        }}
        categories={categories}
        selectedCategories={activeCategories}
        onCategoriesChange={setSelectedCategories}
        dayEventSort={dayEventSort}
        weekStartsOn={calendarPrefs.weekStartsOn}
        workingHours={calendarPrefs.workingHours}
        showNowLine
        loading={loading}
        error={error ? <ErrorText>Failed to load calendar.</ErrorText> : null}
        emptyLabel={
          routeToday
            ? 'No visit activities on today’s route.'
            : 'No scheduled activities in this range.'
        }
        style={{ ['--vb-color-primary' as string]: '#185c4c' }}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => void refetch()}>
              Refresh
            </Button>
            {routeToday ? (
              <Button type="button" variant="ghost" onClick={clearRouteToday}>
                Clear route
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={onMyRouteToday}>
                My route today
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => navigate('/crm/activities')}>
              Activities
            </Button>
            {can.createActivities ? (
              <Button type="button" onClick={() => openCreate(cursor)}>
                New activity
              </Button>
            ) : null}
          </>
        }
        onEventClick={openEvent}
        onSlotClick={can.createActivities ? openCreate : undefined}
        onEventMove={
          catalogs.calendarDragEnabled && can.editActivities ? onEventMove : undefined
        }
      />

      <p style={{ color: '#667', marginTop: 12 }}>
        Manage follow-ups from <Link to="/crm/activities">Activities</Link>
        {catalogs.calendarDragEnabled && can.editActivities
          ? ' · Drag events in week/day view to reschedule'
          : null}
        {boutiqueEnabled ? ' · Boutique tasks overlay when enabled' : null}
        {' · Shortcuts: T today, ←/→ navigate'}
        .
      </p>

      <Modal
        open={modalMode === 'create'}
        title="Schedule activity"
        onClose={() => setModalMode(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModalMode(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onCreate()}
              disabled={!leadId || !createScheduledAt || busy}
            >
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Lead">
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              style={{ width: '100%', minWidth: 200 }}
            >
              <option value="">Select lead…</option>
              {leads.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {String(l.name || l.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Type">
            <select
              value={createType}
              onChange={(e) => setCreateType(e.target.value)}
              style={{ width: '100%' }}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Scheduled at">
            <input
              type="datetime-local"
              value={createScheduledAt}
              onChange={(e) => setCreateScheduledAt(e.target.value)}
            />
          </FormRow>
          <FormRow label="Assignee">
            <select
              value={createAssignee}
              onChange={(e) => setCreateAssignee(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.id}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Notes">
            <input value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
          </FormRow>
        </div>
      </Modal>

      <Modal
        open={modalMode === 'event' && Boolean(selected)}
        title={selected ? activityEventTitle(selected) : 'Activity'}
        onClose={() => setModalMode(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModalMode(null)}>
              Close
            </Button>
            {selected?.id ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`/crm/activities/${selected.id}`)}
              >
                Open detail
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {formError ? <ErrorText>{formError}</ErrorText> : null}
            <p style={{ margin: 0, color: '#667' }}>
              {asCaption(selected.status)} · {asCaption(selected.party_name)}
              {selected.assigned_user_name
                ? ` · ${asCaption(selected.assigned_user_name)}`
                : ''}
              {selected.area ? ` · ${asCaption(selected.area)}` : ''}
            </p>
            {String(selected.notes || '').trim() ? (
              <p style={{ margin: 0 }}>{String(selected.notes)}</p>
            ) : null}

            {can.completeActivities &&
            ['Scheduled', 'In Progress', 'Missed'].includes(String(selected.status || '')) ? (
              <section style={{ display: 'grid', gap: 8 }}>
                <strong style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Complete</strong>
                <FormRow label="Outcome">
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select…</option>
                    {(catalogs.activityOutcomes.length
                      ? catalogs.activityOutcomes
                      : ['Connected', 'No answer', 'Interested', 'Not interested', 'Follow-up']
                    ).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Notes">
                  <input value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} />
                </FormRow>
                <Button type="button" onClick={() => void onComplete()} disabled={busy}>
                  {completeState.isLoading ? 'Saving…' : 'Mark completed'}
                </Button>
              </section>
            ) : null}

            {can.editActivities &&
            ['Scheduled', 'In Progress', 'Missed'].includes(String(selected.status || '')) ? (
              <>
                <section style={{ display: 'grid', gap: 8 }}>
                  <strong style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Reschedule</strong>
                  <FormRow label="New schedule">
                    <input
                      type="datetime-local"
                      value={rescheduleAt}
                      onChange={(e) => setRescheduleAt(e.target.value)}
                    />
                  </FormRow>
                  <FormRow label="Reason">
                    <input
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                    />
                  </FormRow>
                  <Button
                    type="button"
                    onClick={() => void onReschedule()}
                    disabled={!rescheduleAt || busy}
                  >
                    {rescheduleState.isLoading ? 'Saving…' : 'Reschedule'}
                  </Button>
                </section>

                <section style={{ display: 'grid', gap: 8 }}>
                  <strong style={{ color: '#8a3b2e' }}>Cancel</strong>
                  <FormRow label="Reason">
                    <input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </FormRow>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void onCancel()}
                    disabled={busy}
                  >
                    {cancelState.isLoading ? 'Cancelling…' : 'Cancel activity'}
                  </Button>
                </section>
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function toDateKeyLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
