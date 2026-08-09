import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './CalendarView.css';

export type CalendarViewMode = 'month' | 'week' | 'day';

export type CalendarEventTone = 'primary' | 'ok' | 'warn' | 'danger' | 'muted' | 'accent';

export type CalendarEvent = {
  id: string;
  title: string;
  /** ISO date (`YYYY-MM-DD`) or datetime. */
  start: string;
  end?: string;
  allDay?: boolean;
  category?: string;
  tone?: CalendarEventTone;
  meta?: string;
  payload?: unknown;
};

export type CalendarCategory = {
  id: string;
  label: string;
  tone?: CalendarEventTone;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateKey(input: Date | string | null | undefined): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday-start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventStartDate(ev: CalendarEvent): Date {
  const key = toDateKey(ev.start);
  return key ? parseDateKey(key) : new Date(NaN);
}

function eventEndDate(ev: CalendarEvent): Date {
  const key = toDateKey(ev.end || ev.start);
  return key ? parseDateKey(key) : eventStartDate(ev);
}

function eventOccursOn(ev: CalendarEvent, day: Date): boolean {
  const start = eventStartDate(ev);
  const end = eventEndDate(ev);
  if (Number.isNaN(start.getTime())) return false;
  const t = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return t >= s && t <= e;
}

function eventTimeLabel(ev: CalendarEvent): string {
  if (ev.allDay) return 'All day';
  const start = String(ev.start || '');
  const end = String(ev.end || '');
  const st = start.includes('T') ? start.slice(11, 16) : start.length >= 5 && start.includes(':') ? start.slice(0, 5) : '';
  const et = end.includes('T') ? end.slice(11, 16) : end.length >= 5 && end.includes(':') ? end.slice(0, 5) : '';
  if (st && et) return `${st}–${et}`;
  if (st) return st;
  return '';
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function weekLabel(date: Date): string {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, {
    ...opts,
    year: 'numeric',
  })}`;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function toneClass(tone?: CalendarEventTone): string {
  return `cal-tone-${tone || 'primary'}`;
}

type CalendarViewProps = {
  events: CalendarEvent[];
  view?: CalendarViewMode;
  onViewChange?: (view: CalendarViewMode) => void;
  cursor?: Date;
  onCursorChange?: (date: Date) => void;
  categories?: CalendarCategory[];
  selectedCategories?: string[];
  onCategoriesChange?: (ids: string[]) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date) => void;
  loading?: boolean;
  error?: ReactNode;
  kicker?: ReactNode;
  title?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  emptyLabel?: string;
  className?: string;
  style?: CSSProperties;
};

export function CalendarView({
  events,
  view: controlledView,
  onViewChange,
  cursor: controlledCursor,
  onCursorChange,
  categories = [],
  selectedCategories,
  onCategoriesChange,
  onEventClick,
  onSlotClick,
  loading,
  error,
  kicker = 'Schedule',
  title = 'Calendar',
  count,
  actions,
  emptyLabel = 'No events in this range.',
  className,
  style,
}: CalendarViewProps) {
  const [innerView, setInnerView] = useState<CalendarViewMode>('month');
  const [innerCursor, setInnerCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const view = controlledView ?? innerView;
  const cursor = controlledCursor ?? innerCursor;

  function setView(next: CalendarViewMode) {
    onViewChange?.(next);
    if (controlledView == null) setInnerView(next);
  }

  function setCursor(next: Date) {
    const d = new Date(next);
    d.setHours(0, 0, 0, 0);
    onCursorChange?.(d);
    if (controlledCursor == null) setInnerCursor(d);
  }

  const activeCategories = selectedCategories ?? categories.map((c) => c.id);

  const filteredEvents = useMemo(() => {
    if (!categories.length) return events;
    return events.filter((ev) => {
      if (!ev.category) return true;
      return activeCategories.includes(ev.category);
    });
  }, [events, categories, activeCategories]);

  const rangeDays = useMemo(() => {
    if (view === 'day') return [new Date(cursor)];
    if (view === 'week') {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = startOfMonth(cursor);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [view, cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of rangeDays) {
      const key = toDateKey(day);
      map.set(
        key,
        filteredEvents
          .filter((ev) => eventOccursOn(ev, day))
          .sort((a, b) => String(a.start).localeCompare(String(b.start))),
      );
    }
    return map;
  }, [rangeDays, filteredEvents]);

  const agendaDay = selectedDay || (view === 'day' ? cursor : null);
  const agendaEvents = agendaDay ? eventsByDay.get(toDateKey(agendaDay)) || [] : [];

  useEffect(() => {
    if (view === 'day') setSelectedDay(new Date(cursor));
  }, [view, cursor]);

  const heading =
    view === 'month' ? monthLabel(cursor) : view === 'week' ? weekLabel(cursor) : dayLabel(cursor);

  function shift(delta: number) {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (view === 'week') setCursor(addDays(cursor, delta * 7));
    else setCursor(addDays(cursor, delta));
  }

  function goToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCursor(today);
    setSelectedDay(today);
  }

  function toggleCategory(id: string) {
    if (!onCategoriesChange) return;
    if (activeCategories.includes(id)) {
      const next = activeCategories.filter((c) => c !== id);
      onCategoriesChange(next.length ? next : activeCategories);
    } else {
      onCategoriesChange([...activeCategories, id]);
    }
  }

  const today = new Date();
  const inMonth = (d: Date) => d.getMonth() === cursor.getMonth();

  return (
    <div className={['cal-page', className].filter(Boolean).join(' ')} style={style}>
      <header className="cal-hero">
        <div className="cal-hero-top">
          <div>
            {kicker ? <p className="cal-kicker">{kicker}</p> : null}
            <h1 className="cal-title">{title}</h1>
            {count != null ? <p className="cal-count">{count}</p> : null}
          </div>
          {actions ? <div className="cal-hero-actions">{actions}</div> : null}
        </div>

        <div className="cal-toolbar">
          <div className="cal-nav">
            <button type="button" className="cal-icon-btn" aria-label="Previous" onClick={() => shift(-1)}>
              ‹
            </button>
            <button type="button" className="cal-today-btn" onClick={goToday}>
              Today
            </button>
            <button type="button" className="cal-icon-btn" aria-label="Next" onClick={() => shift(1)}>
              ›
            </button>
            <h2 className="cal-heading">{heading}</h2>
          </div>
          <div className="cal-view-seg" role="group" aria-label="Calendar view">
            {(['month', 'week', 'day'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="cal-legend" role="group" aria-label="Event types">
            {categories.map((cat) => {
              const on = activeCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`cal-legend-chip ${toneClass(cat.tone)} ${on ? 'is-on' : 'is-off'}`}
                  aria-pressed={on}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="cal-legend-dot" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {loading ? (
        <div className="cal-status" aria-busy="true">
          <div className="cal-loading" />
          <strong>Loading calendar…</strong>
        </div>
      ) : null}
      {error ? <div className="cal-error">{error}</div> : null}

      {!loading && !error ? (
        <div className={`cal-body cal-body--${view}`}>
          <div className="cal-grid-wrap">
            {view === 'month' ? (
              <div className="cal-month">
                <div className="cal-weekdays">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <div key={d} className="cal-weekday">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="cal-month-grid">
                  {rangeDays.map((day) => {
                    const key = toDateKey(day);
                    const dayEvents = eventsByDay.get(key) || [];
                    const isToday = sameDay(day, today);
                    const isSelected = selectedDay ? sameDay(day, selectedDay) : false;
                    const outside = !inMonth(day);
                    const visible = dayEvents.slice(0, 3);
                    const more = dayEvents.length - visible.length;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={[
                          'cal-day-cell',
                          outside ? 'is-outside' : '',
                          isToday ? 'is-today' : '',
                          isSelected ? 'is-selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => {
                          setSelectedDay(day);
                          onSlotClick?.(day);
                        }}
                      >
                        <span className="cal-day-num">{day.getDate()}</span>
                        <div className="cal-day-events">
                          {visible.map((ev) => (
                            <span
                              key={ev.id}
                              className={`cal-pill ${toneClass(ev.tone)}`}
                              title={ev.title}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(ev);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  onEventClick?.(ev);
                                }
                              }}
                              role="link"
                              tabIndex={0}
                            >
                              {eventTimeLabel(ev) ? (
                                <em className="cal-pill-time">{eventTimeLabel(ev)}</em>
                              ) : null}
                              {ev.title}
                            </span>
                          ))}
                          {more > 0 ? <span className="cal-more">+{more} more</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={`cal-columns cal-columns--${view}`}>
                {rangeDays.map((day) => {
                  const key = toDateKey(day);
                  const dayEvents = eventsByDay.get(key) || [];
                  const isToday = sameDay(day, today);
                  return (
                    <div
                      key={key}
                      className={['cal-col', isToday ? 'is-today' : ''].filter(Boolean).join(' ')}
                    >
                      <button
                        type="button"
                        className="cal-col-head"
                        onClick={() => {
                          setSelectedDay(day);
                          setCursor(day);
                          if (view === 'week') setView('day');
                          onSlotClick?.(day);
                        }}
                      >
                        <span className="cal-col-weekday">
                          {day.toLocaleDateString(undefined, { weekday: 'short' })}
                        </span>
                        <span className="cal-col-num">{day.getDate()}</span>
                      </button>
                      <div className="cal-col-body">
                        {dayEvents.length === 0 ? (
                          <button
                            type="button"
                            className="cal-slot-empty"
                            onClick={() => onSlotClick?.(day)}
                          >
                            Free
                          </button>
                        ) : (
                          dayEvents.map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              className={`cal-event-card ${toneClass(ev.tone)}`}
                              onClick={() => onEventClick?.(ev)}
                            >
                              <span className="cal-event-time">{eventTimeLabel(ev) || 'All day'}</span>
                              <strong className="cal-event-title">{ev.title}</strong>
                              {ev.meta ? <span className="cal-event-meta">{ev.meta}</span> : null}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {view === 'month' ? (
            <aside className="cal-agenda">
              <div className="cal-agenda-head">
                <h3>
                  {agendaDay
                    ? agendaDay.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Select a day'}
                </h3>
                {agendaDay && onSlotClick ? (
                  <button type="button" className="cal-link-btn" onClick={() => onSlotClick(agendaDay)}>
                    Add
                  </button>
                ) : null}
              </div>
              {!agendaDay ? (
                <p className="cal-agenda-empty">Click a day to see its agenda.</p>
              ) : agendaEvents.length === 0 ? (
                <p className="cal-agenda-empty">{emptyLabel}</p>
              ) : (
                <ul className="cal-agenda-list">
                  {agendaEvents.map((ev) => (
                    <li key={ev.id}>
                      <button
                        type="button"
                        className={`cal-agenda-item ${toneClass(ev.tone)}`}
                        onClick={() => onEventClick?.(ev)}
                      >
                        <span className="cal-agenda-time">{eventTimeLabel(ev) || 'All day'}</span>
                        <span className="cal-agenda-title">{ev.title}</span>
                        {ev.meta ? <span className="cal-agenda-meta">{ev.meta}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && filteredEvents.length === 0 ? (
        <p className="cal-footnote">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
