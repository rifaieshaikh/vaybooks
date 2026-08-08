import { useEffect, useState } from 'react';
import {
  useGetProductionSettingsQuery,
  useUpdateProductionSettingsMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export function ProductionSettingsPage() {
  const { data, isLoading, error, refetch } = useGetProductionSettingsQuery();
  const [updateSettings, updateState] = useUpdateProductionSettingsMutation();
  const [formError, setFormError] = useState('');
  const [wip, setWip] = useState('');
  const [raw, setRaw] = useState('');
  const [fg, setFg] = useState('');
  const [overhead, setOverhead] = useState('');
  const [clearing, setClearing] = useState('');
  const [scrap, setScrap] = useState('');

  useEffect(() => {
    if (!data) return;
    setWip(String(data.wip_account_id || ''));
    setRaw(String(data.raw_material_account_id || ''));
    setFg(String(data.finished_goods_account_id || ''));
    setOverhead(String(data.manufacturing_overhead_account_id || ''));
    setClearing(String(data.expense_clearing_account_id || ''));
    setScrap(String(data.scrap_account_id || ''));
  }, [data]);

  async function onSave() {
    setFormError('');
    try {
      await updateSettings({
        wip_account_id: wip,
        raw_material_account_id: raw,
        finished_goods_account_id: fg,
        manufacturing_overhead_account_id: overhead,
        expense_clearing_account_id: clearing,
        scrap_account_id: scrap,
      }).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>
        Production Settings
      </h2>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load settings.</ErrorText> : null}
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {!isLoading && !error ? (
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          <FormRow label="WIP account id">
            <TextInput value={wip} onChange={(e) => setWip(e.target.value)} />
          </FormRow>
          <FormRow label="Raw material account id">
            <TextInput value={raw} onChange={(e) => setRaw(e.target.value)} />
          </FormRow>
          <FormRow label="Finished goods account id">
            <TextInput value={fg} onChange={(e) => setFg(e.target.value)} />
          </FormRow>
          <FormRow label="Manufacturing overhead account id">
            <TextInput value={overhead} onChange={(e) => setOverhead(e.target.value)} />
          </FormRow>
          <FormRow label="Expense clearing account id">
            <TextInput value={clearing} onChange={(e) => setClearing(e.target.value)} />
          </FormRow>
          <FormRow label="Scrap account id">
            <TextInput value={scrap} onChange={(e) => setScrap(e.target.value)} />
          </FormRow>
          <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
            {updateState.isLoading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
