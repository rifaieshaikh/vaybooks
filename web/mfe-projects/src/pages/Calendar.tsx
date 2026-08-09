import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListProjectsQuery } from '@vaybooks/store';
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

function statusTone(status: string): CalendarEventTone {
  if (status === 'Active') return 'ok';
  if (status === 'On Hold') return 'warn';
  if (status === 'Physically Completed' || status === 'Financially Closed') return 'muted';
  return 'primary';
}

export function ProjectsCalendarPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListProjectsQuery();
  const [view, setView] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedCategories, setSelectedCategories] = useState([
    'timeline',
    'start',
    'end',
  ]);

  const categories: CalendarCategory[] = [
    { id: 'timeline', label: 'Project span', tone: 'primary' },
    { id: 'start', label: 'Start', tone: 'ok' },
    { id: 'end', label: 'Expected end', tone: 'warn' },
  ];

  const events: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];
    for (const row of data) {
      const id = String(row.id);
      const name = asCaption(row.project_name) || asCaption(row.name) || 'Project';
      const status = asCaption(row.status) || 'Draft';
      const customer = asCaption(row.customer_name);
      const start = asCaption(row.start_date).slice(0, 10);
      const end = asCaption(row.expected_end_date).slice(0, 10);
      const tone = statusTone(status);
      const meta = [customer, status].filter(Boolean).join(' · ');

      if (start && end) {
        out.push({
          id: `span-${id}`,
          title: name,
          start,
          end,
          allDay: true,
          category: 'timeline',
          tone,
          meta,
          payload: row,
        });
      }
      if (start) {
        out.push({
          id: `start-${id}`,
          title: `Start · ${name}`,
          start,
          allDay: true,
          category: 'start',
          tone: 'ok',
          meta,
          payload: row,
        });
      }
      if (end) {
        out.push({
          id: `end-${id}`,
          title: `Due · ${name}`,
          start: end,
          allDay: true,
          category: 'end',
          tone: 'warn',
          meta,
          payload: row,
        });
      }
    }
    return out;
  }, [data]);

  return (
    <CalendarView
      kicker="Projects"
      title="Calendar"
      count={`${data.length} projects · ${events.length} markers`}
      events={events}
      view={view}
      onViewChange={setView}
      cursor={cursor}
      onCursorChange={setCursor}
      categories={categories}
      selectedCategories={selectedCategories}
      onCategoriesChange={setSelectedCategories}
      loading={isLoading}
      error={error ? <ErrorText>Failed to load projects calendar.</ErrorText> : null}
      emptyLabel="No project start or end dates yet. Set them on each project workspace."
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button type="button" onClick={() => navigate('/projects/list?new=1')}>
            New project
          </Button>
        </>
      }
      onEventClick={(ev) => {
        const row = ev.payload as Record<string, unknown> | undefined;
        if (row?.id != null) navigate(`/projects/list/${String(row.id)}`);
      }}
      onSlotClick={() => navigate('/projects/list?new=1')}
    />
  );
}
