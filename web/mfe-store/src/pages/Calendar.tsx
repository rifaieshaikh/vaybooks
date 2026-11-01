import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListStoreTimeEntriesQuery } from '@vaybooks/store';
import {
  Button,
  CalendarView,
  ErrorText,
  type CalendarCategory,
  type CalendarEvent,
  type CalendarEventTone,
  type CalendarViewMode,
} from '@vaybooks/ui-kit';
import { asCaption } from '../utils';

export function BusinessCalendarPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListStoreTimeEntriesQuery();
  const [view, setView] = useState<CalendarViewMode>('week');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedCategories, setSelectedCategories] = useState(['Created', 'Completed']);

  const categories: CalendarCategory[] = [
    { id: 'Created', label: 'Open', tone: 'primary' },
    { id: 'Completed', label: 'Completed', tone: 'ok' },
  ];

  const events: CalendarEvent[] = useMemo(
    () =>
      data
        .map((row) => {
          const day = asCaption(row.work_date).slice(0, 10);
          if (!day) return null;
          const startTime = asCaption(row.start_time).slice(0, 5);
          const endTime = asCaption(row.end_time).slice(0, 5);
          const status = asCaption(row.status) || 'Created';
          const tone: CalendarEventTone = status === 'Completed' ? 'ok' : 'primary';
          return {
            id: String(row.id),
            title: asCaption(row.activity_name) || 'Business task',
            start: startTime ? `${day}T${startTime}` : day,
            end: endTime ? `${day}T${endTime}` : undefined,
            allDay: !startTime,
            category: status,
            tone,
            meta: [asCaption(row.worker_name), status].filter(Boolean).join(' · '),
            payload: row,
          } satisfies CalendarEvent;
        })
        .filter(Boolean) as CalendarEvent[],
    [data],
  );

  return (
    <CalendarView
      kicker="Business"
      title="Calendar"
      count={`${events.length} tasks scheduled`}
      events={events}
      view={view}
      onViewChange={setView}
      cursor={cursor}
      onCursorChange={setCursor}
      categories={categories}
      selectedCategories={selectedCategories}
      onCategoriesChange={setSelectedCategories}
      loading={isLoading}
      error={error ? <ErrorText>Failed to load business calendar.</ErrorText> : null}
      emptyLabel="No business tasks on the calendar yet."
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button type="button" onClick={() => navigate('/store-time')}>
            Business tasks
          </Button>
        </>
      }
      onEventClick={() => navigate('/store-time')}
      onSlotClick={() => navigate('/store-time')}
    />
  );
}
