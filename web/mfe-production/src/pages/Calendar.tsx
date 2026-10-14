import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListBatchesQuery } from '@vaybooks/store';
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

function batchTone(status: string): CalendarEventTone {
  if (status === 'Posted') return 'ok';
  if (status === 'In Progress') return 'accent';
  if (status === 'Cancelled') return 'danger';
  return 'primary';
}

export function ProductionCalendarPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListBatchesQuery();
  const [view, setView] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedCategories, setSelectedCategories] = useState([
    'Draft',
    'In Progress',
    'Posted',
    'Cancelled',
  ]);

  const categories: CalendarCategory[] = [
    { id: 'Draft', label: 'Draft', tone: 'muted' },
    { id: 'In Progress', label: 'In progress', tone: 'accent' },
    { id: 'Posted', label: 'Posted', tone: 'ok' },
    { id: 'Cancelled', label: 'Cancelled', tone: 'danger' },
  ];

  const events: CalendarEvent[] = useMemo(
    () =>
      data
        .map((row) => {
          const day = asCaption(row.batch_date).slice(0, 10);
          if (!day) return null;
          const status = asCaption(row.status) || 'Draft';
          return {
            id: String(row.id),
            title: asCaption(row.batch_number) || 'Batch',
            start: day,
            allDay: true,
            category: status,
            tone: batchTone(status),
            meta: [asCaption(row.recipe_name), status, row.planned_quantity != null ? `Qty ${row.planned_quantity}` : '']
              .filter(Boolean)
              .join(' · '),
            payload: row,
          } satisfies CalendarEvent;
        })
        .filter(Boolean) as CalendarEvent[],
    [data],
  );

  return (
    <CalendarView
      kicker="Production"
      title="Calendar"
      count={`${events.length} batches dated`}
      events={events}
      view={view}
      onViewChange={setView}
      cursor={cursor}
      onCursorChange={setCursor}
      categories={categories}
      selectedCategories={selectedCategories}
      onCategoriesChange={setSelectedCategories}
      loading={isLoading}
      error={error ? <ErrorText>Failed to load production calendar.</ErrorText> : null}
      emptyLabel="No batches with a production date yet."
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button type="button" onClick={() => navigate('/production/batches')}>
            Batches
          </Button>
        </>
      }
      onEventClick={(ev) => navigate(`/production/batches/${ev.id}`)}
      onSlotClick={() => navigate('/production/batches')}
    />
  );
}
