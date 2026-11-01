import { useState } from 'react';
import { useCreateCrmActivityMutation } from '@vaybooks/store';
import { Button, ErrorText, FormRow } from '@vaybooks/ui-kit';
import { fromDatetimeLocalValue } from '../calendarHelpers';
import { useCrmSettingsCatalogs } from '../hooks';
import { extractError } from '../utils';

const FALLBACK_TYPES = ['General Follow-up', 'Called', 'Meeting', 'WhatsApp Message', 'Note'];

type Props = {
  leadId?: string;
  enquiryId?: string;
  disabled?: boolean;
  onLogged?: () => void;
};

/** Inline “Log follow-up” composer for Lead / Enquiry timeline tabs. */
export function TimelineComposer({ leadId, enquiryId, disabled, onLogged }: Props) {
  const { catalogs } = useCrmSettingsCatalogs();
  const types = catalogs.activityTypeLabels.length ? catalogs.activityTypeLabels : FALLBACK_TYPES;
  const [createActivity, createState] = useCreateCrmActivityMutation();
  const [activityType, setActivityType] = useState(types[0] || 'General Follow-up');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');

  async function onSubmit() {
    if (!leadId && !enquiryId) {
      setError('Missing parent record');
      return;
    }
    setError('');
    try {
      await createActivity({
        activity_type: activityType,
        ...(leadId ? { lead_id: leadId } : {}),
        ...(enquiryId ? { enquiry_id: enquiryId } : {}),
        notes,
        scheduled_at: scheduledAt ? fromDatetimeLocalValue(scheduledAt) : undefined,
      }).unwrap();
      setNotes('');
      setScheduledAt('');
      onLogged?.();
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <div className="crm-ew-composer">
      <h3>Log follow-up</h3>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <div className="crm-ew-composer-fields">
        <FormRow label="Type">
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            disabled={disabled}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Scheduled">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={disabled}
          />
        </FormRow>
        <FormRow label="Notes">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
            placeholder="What happened / next step…"
          />
        </FormRow>
      </div>
      <div className="crm-ew-composer-actions">
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={disabled || createState.isLoading}
        >
          {createState.isLoading ? 'Logging…' : 'Log activity'}
        </Button>
      </div>
    </div>
  );
}
