import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCrmCalendarQuery, useRescheduleCrmActivityMutation } from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

export function CrmCalendarPage() {
  const { data = [], isLoading, error, refetch } = useCrmCalendarQuery();
  const [reschedule, rescheduleState] = useRescheduleCrmActivityMutation();
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

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

  async function onReschedule() {
    if (!selected?.id || !scheduledAt) return;
    setMessage('');
    try {
      await reschedule({
        id: String(selected.id),
        scheduled_at: new Date(scheduledAt).toISOString(),
        reason,
      }).unwrap();
      setMessage('Activity rescheduled');
      setSelected(null);
      setScheduledAt('');
      setReason('');
      refetch();
    } catch (e) {
      setMessage(extractError(e));
    }
  }

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
      <DataTable
        columns={columns}
        data={sorted as Record<string, unknown>[]}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          setSelected(row);
          setScheduledAt(String(row.start || '').slice(0, 16));
          setMessage('');
        }}
      />
      {!isLoading && sorted.length === 0 ? <p>No scheduled activities. {asCaption('')}</p> : null}
      {selected ? (
        <section style={{ marginTop: 20 }}>
          <h3>Reschedule {asCaption(selected.title)}</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <FormRow label="New schedule">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </FormRow>
            <FormRow label="Reason">
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormRow>
            <Button type="button" onClick={onReschedule} disabled={!scheduledAt || rescheduleState.isLoading}>
              Reschedule
            </Button>
          </div>
        </section>
      ) : null}
      {message ? <p>{message}</p> : null}
    </div>
  );
}
