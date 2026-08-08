import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCrmCalendarQuery } from '@vaybooks/store';
import { Button, DataTable, ErrorText, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption } from '../utils';

export function CrmCalendarPage() {
  const { data = [], isLoading, error, refetch } = useCrmCalendarQuery();

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'start', header: 'When' },
      { key: 'title', header: 'Activity' },
      { key: 'party_name', header: 'Party' },
      { key: 'status', header: 'Status' },
      { key: 'assigned_user_name', header: 'Assignee' },
    ],
    [],
  );

  const sorted = useMemo(
    () =>
      [...data].sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))),
    [data],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>CRM Calendar</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <p style={{ color: '#667' }}>
        Scheduled activities across leads and enquiries. Manage from{' '}
        <Link to="/crm/activities">Activities</Link>.
      </p>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load calendar.</ErrorText> : null}
      <DataTable columns={columns} rows={sorted as Record<string, unknown>[]} />
      {!isLoading && sorted.length === 0 ? <p>No scheduled activities. {asCaption('')}</p> : null}
    </div>
  );
}
