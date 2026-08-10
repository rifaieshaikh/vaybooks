import {
  addDays,
  startOfMonth,
  startOfWeek,
  toDateKey,
  type CalendarEvent,
  type CalendarEventTone,
  type CalendarViewMode,
  type CalendarWeekStartsOn,
  type CalendarWorkingHours,
} from '@vaybooks/ui-kit';
import { asCaption } from './utils';

export const BOUTIQUE_CATEGORY = 'Boutique';
export const DEFAULT_ACTIVITY_MINUTES = 60;

/** Query window for CRM calendar fetch based on cursor + view. */
export function crmCalendarRange(
  cursor: Date,
  view: CalendarViewMode,
  weekStartsOn: CalendarWeekStartsOn = 1,
): { scheduled_from: string; scheduled_to: string } {
  let start: Date;
  let days: number;
  if (view === 'day') {
    start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    days = 1;
  } else if (view === 'week') {
    start = startOfWeek(cursor, weekStartsOn);
    days = 7;
  } else if (view === 'agenda') {
    start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    days = 14;
  } else {
    // month ≈ 42-day grid from week start of month
    start = startOfWeek(startOfMonth(cursor), weekStartsOn);
    days = 42;
  }
  const end = addDays(start, days);
  return {
    scheduled_from: start.toISOString(),
    scheduled_to: end.toISOString(),
  };
}

export function isOpenActivityStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'scheduled' || s === 'in progress' || s === '';
}

export function activityEventTone(
  status: unknown,
  scheduledAt: unknown,
  now = Date.now(),
): CalendarEventTone {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'completed') return 'ok';
  if (s === 'cancelled' || s === 'reversed') return 'muted';
  if (s === 'missed') return 'danger';
  const when = String(scheduledAt || '').trim();
  if (isOpenActivityStatus(String(status || '')) && when) {
    const t = new Date(when).getTime();
    if (!Number.isNaN(t) && t < now) return 'danger';
  }
  return 'primary';
}

export function activityEventTitle(row: Record<string, unknown>): string {
  const type = asCaption(row.activity_type);
  const notes = String(row.notes || '').trim();
  if (type && type !== '—') return type;
  if (notes) return notes.length > 48 ? `${notes.slice(0, 45)}…` : notes;
  return asCaption(row.title) !== '—' ? asCaption(row.title) : 'Activity';
}

export function resolveActivityArea(
  row: Record<string, unknown>,
  leadById?: Map<string, Record<string, unknown>>,
): string {
  const direct = [
    row.area,
    row.lead_area,
    row.location,
    row.location_name,
    row.city,
  ]
    .map((v) => String(v || '').trim())
    .find(Boolean);
  if (direct) return direct;
  const leadId = String(row.lead_id || '').trim();
  if (leadId && leadById) {
    const lead = leadById.get(leadId);
    if (lead) {
      const fromLead = [lead.area, lead.city, lead.location_name]
        .map((v) => String(v || '').trim())
        .find(Boolean);
      if (fromLead) return fromLead;
    }
  }
  return '';
}

export function isVisitActivity(row: Record<string, unknown>): boolean {
  const type = String(row.activity_type || row.activity_type_key || '')
    .trim()
    .toLowerCase();
  return type === 'visit' || type.includes('visit');
}

export function activityToCalendarEvent(
  row: Record<string, unknown>,
  leadById?: Map<string, Record<string, unknown>>,
): CalendarEvent | null {
  const start = String(row.scheduled_at || row.start || row.activity_at || '').trim();
  if (!start) return null;
  const id = String(row.id || '').trim();
  if (!id) return null;
  const party = String(row.party_name || '').trim();
  const assignee = String(row.assigned_user_name || '').trim();
  const area = resolveActivityArea(row, leadById);
  const meta = [party, assignee, area].filter(Boolean).join(' · ');
  const activityType = String(row.activity_type || 'Activity').trim() || 'Activity';
  const hasTime = start.includes('T') || (start.length >= 16 && start.includes(' '));
  const endRaw = String(row.end_at || row.scheduled_end || row.end || '').trim();
  return {
    id,
    title: activityEventTitle(row),
    start: hasTime ? start.replace(' ', 'T') : toDateKey(start) || start,
    end: endRaw ? (endRaw.includes(' ') ? endRaw.replace(' ', 'T') : endRaw) : undefined,
    allDay: !hasTime,
    category: activityType,
    tone: activityEventTone(row.status, start),
    meta: meta || undefined,
    payload: { ...row, area },
  };
}

export function boutiqueTaskToCalendarEvent(row: Record<string, unknown>): CalendarEvent | null {
  const day = asCaption(row.work_date).slice(0, 10);
  if (!day || day === '—') return null;
  const id = String(row.id || '').trim();
  if (!id) return null;
  const startTime = asCaption(row.start_time).slice(0, 5);
  const endTime = asCaption(row.end_time).slice(0, 5);
  const start = startTime && startTime !== '—' ? `${day}T${startTime}` : day;
  const end = endTime && endTime !== '—' ? `${day}T${endTime}` : undefined;
  const title =
    asCaption(row.activity_name) !== '—'
      ? asCaption(row.activity_name)
      : asCaption(row.task_type) !== '—'
        ? asCaption(row.task_type)
        : 'Boutique task';
  const meta = [
    asCaption(row.assignee_name) !== '—' ? asCaption(row.assignee_name) : '',
    asCaption(row.worker_name) !== '—' ? asCaption(row.worker_name) : '',
    asCaption(row.order_number) !== '—' ? asCaption(row.order_number) : '',
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' · ');
  return {
    id: `boutique-${id}`,
    title,
    start,
    end,
    allDay: !startTime || startTime === '—',
    category: BOUTIQUE_CATEGORY,
    tone: 'accent',
    meta: meta || 'Boutique',
    payload: { ...row, _source: 'boutique' },
  };
}

function eventIntervalMs(
  ev: CalendarEvent,
  defaultMinutes = DEFAULT_ACTIVITY_MINUTES,
): { start: number; end: number } | null {
  const startStr = String(ev.start || '');
  if (!startStr || ev.allDay || !startStr.includes('T')) return null;
  const start = new Date(startStr).getTime();
  if (Number.isNaN(start)) return null;
  let end = start + defaultMinutes * 60_000;
  if (ev.end) {
    const endMs = new Date(ev.end).getTime();
    if (!Number.isNaN(endMs) && endMs > start) end = endMs;
  }
  return { start, end };
}

function intervalsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Mark open CRM activities that overlap for the same assignee. */
export function markAssigneeConflicts(events: CalendarEvent[]): CalendarEvent[] {
  const openIndexed: { ev: CalendarEvent; interval: { start: number; end: number }; idx: number }[] =
    [];
  events.forEach((ev, idx) => {
    const row = (ev.payload || {}) as Record<string, unknown>;
    if (row._source === 'boutique') return;
    if (!isOpenActivityStatus(String(row.status || ''))) return;
    const assignee = String(row.assigned_user_id || '').trim();
    if (!assignee) return;
    const interval = eventIntervalMs(ev);
    if (!interval) return;
    openIndexed.push({ ev, interval, idx });
  });

  const conflictIds = new Set<string>();
  for (let i = 0; i < openIndexed.length; i += 1) {
    const a = openIndexed[i];
    const aAssignee = String((a.ev.payload as Record<string, unknown>).assigned_user_id || '');
    for (let j = i + 1; j < openIndexed.length; j += 1) {
      const b = openIndexed[j];
      const bAssignee = String((b.ev.payload as Record<string, unknown>).assigned_user_id || '');
      if (aAssignee !== bAssignee) continue;
      if (intervalsOverlap(a.interval, b.interval)) {
        conflictIds.add(a.ev.id);
        conflictIds.add(b.ev.id);
      }
    }
  }

  if (!conflictIds.size) return events;

  return events.map((ev) => {
    if (!conflictIds.has(ev.id)) return ev;
    const metaParts = String(ev.meta || '')
      .split(' · ')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!metaParts.some((p) => p.toLowerCase() === 'conflict')) metaParts.push('Conflict');
    return {
      ...ev,
      tone: 'danger' as const,
      meta: metaParts.join(' · '),
    };
  });
}

export function isBoutiqueCalendarEvent(ev: CalendarEvent): boolean {
  const row = (ev.payload || {}) as Record<string, unknown>;
  return row._source === 'boutique' || ev.category === BOUTIQUE_CATEGORY;
}

export function sortRouteTodayEvents(a: CalendarEvent, b: CalendarEvent): number {
  const aRow = (a.payload || {}) as Record<string, unknown>;
  const bRow = (b.payload || {}) as Record<string, unknown>;
  const aArea = String(aRow.area || resolveActivityArea(aRow) || '').toLowerCase();
  const bArea = String(bRow.area || resolveActivityArea(bRow) || '').toLowerCase();
  if (aArea !== bArea) return aArea.localeCompare(bArea);
  return String(a.start).localeCompare(String(b.start));
}

export type BusinessCalendarPrefs = {
  weekStartsOn: CalendarWeekStartsOn;
  workingHours?: CalendarWorkingHours;
};

/** Read optional calendar prefs from business profile / settings payload. */
export function businessCalendarPrefs(
  business: Record<string, unknown> | null | undefined,
): BusinessCalendarPrefs {
  const weekStartsOn = parseWeekStartsOn(
    business?.week_start ??
      business?.calendar_week_start ??
      business?.week_starts_on ??
      business?.weekStartsOn,
  );

  const fromObject = parseWorkingHoursObject(business?.working_hours);
  if (fromObject) return { weekStartsOn, workingHours: fromObject };

  const startHour = parseHour(
    business?.working_hours_start ??
      business?.working_hour_start ??
      business?.business_hours_start ??
      business?.calendar_day_start_hour,
  );
  const endHour = parseHour(
    business?.working_hours_end ??
      business?.working_hour_end ??
      business?.business_hours_end ??
      business?.calendar_day_end_hour,
  );
  if (startHour != null || endHour != null) {
    return {
      weekStartsOn,
      workingHours: {
        startHour: startHour ?? 6,
        endHour: endHour ?? 22,
      },
    };
  }

  return { weekStartsOn };
}

function parseWeekStartsOn(raw: unknown): CalendarWeekStartsOn {
  if (raw === 0 || raw === '0') return 0;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'sunday' || s === 'sun') return 0;
    if (s === 'monday' || s === 'mon') return 1;
  }
  if (raw === 1 || raw === '1') return 1;
  return 1;
}

function parseHour(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(23, Math.max(0, Math.floor(raw)));
  }
  const s = String(raw).trim();
  if (/^\d{1,2}$/.test(s)) {
    return Math.min(23, Math.max(0, Number(s)));
  }
  const m = s.match(/^(\d{1,2}):/);
  if (m) return Math.min(23, Math.max(0, Number(m[1])));
  return null;
}

function parseWorkingHoursObject(raw: unknown): CalendarWorkingHours | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const startHour = parseHour(obj.start ?? obj.start_hour ?? obj.from ?? obj.begin);
  const endHour = parseHour(obj.end ?? obj.end_hour ?? obj.to ?? obj.finish);
  if (startHour == null && endHour == null) return undefined;
  return {
    startHour: startHour ?? 6,
    endHour: endHour ?? 22,
  };
}

export function toDatetimeLocalValue(input: Date | string | null | undefined): string {
  if (input == null || input === '') return '';
  const d = typeof input === 'string' ? new Date(input) : new Date(input);
  if (Number.isNaN(d.getTime())) {
    const s = String(input);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

/** Prefill scheduled_at for a calendar slot (default 09:00 local, or working-hours start). */
export function slotScheduledAt(day: Date, hour = 9, minute = 0): string {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return toDatetimeLocalValue(d);
}
