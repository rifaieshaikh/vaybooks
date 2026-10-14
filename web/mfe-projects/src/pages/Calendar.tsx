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
import { asCaption, formatDateInput } from '../utils';

function statusTone(status: string): CalendarEventTone {
  if (status === 'Active') return 'ok';
  if (status === 'On Hold') return 'warn';
  if (status === 'Physically Completed' || status === 'Financially Closed') return 'muted';
  return 'primary';
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'On Hold', label: 'On Hold' },
  { id: 'Planned', label: 'Planned' },
  { id: 'Draft', label: 'Draft' },
] as const;

export function ProjectsCalendarPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListProjectsQuery();
  const [view, setView] = useState<CalendarViewMode>('month');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return data;
    return data.filter((row) => asCaption(row.status) === statusFilter);
  }, [data, statusFilter]);

  const events: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];
    for (const row of filtered) {
      const id = String(row.id);
      const name = asCaption(row.project_name) || asCaption(row.name) || 'Project';
      const status = asCaption(row.status) || 'Draft';
      const customer = asCaption(row.customer_name);
      const start = formatDateInput(row.start_date);
      const end = formatDateInput(row.expected_end_date);
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
  }, [filtered]);

  return (
    <CalendarView
      kicker="Projects"
      title="Calendar"
      count={`${filtered.length} projects · ${events.length} markers`}
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
      emptyLabel="No project start or end dates yet. Set them when creating a project or on the Overview tab."
      actions={
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginRight: 8 }}>
            {STATUS_FILTERS.map((chip) => (
              <Button
                key={chip.id}
                type="button"
                variant={statusFilter === chip.id ? undefined : 'ghost'}
                onClick={() => setStatusFilter(chip.id)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
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
      onSlotClick={(day) => {
        const y = day.getFullYear();
        const m = String(day.getMonth() + 1).padStart(2, '0');
        const d = String(day.getDate()).padStart(2, '0');
        navigate(`/projects/list?new=1&start_date=${y}-${m}-${d}`);
      }}
    />
  );
}
