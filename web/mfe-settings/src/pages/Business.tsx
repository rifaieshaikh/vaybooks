import { useEffect, useState } from 'react';
import {
  useGetBusinessProfileQuery,
  useGetPrefsQuery,
  usePutPrefsMutation,
  useUpdateBusinessProfileMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export function BusinessSettingsPage() {
  const { data, isLoading, error, refetch } = useGetBusinessProfileQuery();
  const prefsQ = useGetPrefsQuery();
  const [update, updateState] = useUpdateBusinessProfileMutation();
  const [putPrefs] = usePutPrefsMutation();
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (data) {
      setLegalName(String(data.legal_name || ''));
      setTradeName(String(data.trade_name || ''));
    }
  }, [data]);

  useEffect(() => {
    if (prefsQ.data?.timezone) setTimezone(prefsQ.data.timezone);
  }, [prefsQ.data]);

  async function onSave() {
    setMsg('');
    try {
      await update({ legal_name: legalName, trade_name: tradeName }).unwrap();
      await putPrefs({ timezone }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error) return <ErrorText>Failed to load business profile.</ErrorText>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Business settings</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <FormRow label="Legal name">
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </FormRow>
        <FormRow label="Trade name">
          <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        </FormRow>
        <FormRow label="Timezone">
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
          Save
        </Button>
        {msg ? <p>{msg}</p> : null}
      </div>
    </div>
  );
}
