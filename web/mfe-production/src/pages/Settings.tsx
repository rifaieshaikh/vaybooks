import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetProductionSettingsQuery,
  useListFinanceAccountsQuery,
  useUpdateProductionSettingsMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailForm,
  EntityListHero,
  EntityListPage,
  ErrorText,
  FormRow,
  SearchableSelect,
  StatusBanner,
} from '@vaybooks/ui-kit';
import { ALLOCATION_METHODS, settingsIncomplete } from '../status';
import { extractError } from '../utils';

export function ProductionSettingsPage() {
  const { data, isLoading, error, refetch } = useGetProductionSettingsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const [updateSettings, updateState] = useUpdateProductionSettingsMutation();
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [wip, setWip] = useState('');
  const [raw, setRaw] = useState('');
  const [fg, setFg] = useState('');
  const [overhead, setOverhead] = useState('');
  const [clearing, setClearing] = useState('');
  const [scrap, setScrap] = useState('');
  const [allocation, setAllocation] = useState('NRV');

  useEffect(() => {
    if (!data) return;
    setWip(String(data.wip_account_id || ''));
    setRaw(String(data.raw_material_account_id || ''));
    setFg(String(data.finished_goods_account_id || ''));
    setOverhead(String(data.manufacturing_overhead_account_id || ''));
    setClearing(String(data.expense_clearing_account_id || ''));
    setScrap(String(data.scrap_account_id || ''));
    setAllocation(String(data.default_allocation_method || 'NRV'));
  }, [data]);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: String(a.id),
        label: String(a.account_name || a.name || a.id),
      })),
    [accounts],
  );

  const missing = settingsIncomplete({
    wip_account_id: wip,
    raw_material_account_id: raw,
    finished_goods_account_id: fg,
  });

  async function onSave() {
    setFormError('');
    setSaved(false);
    try {
      await updateSettings({
        wip_account_id: wip,
        raw_material_account_id: raw,
        finished_goods_account_id: fg,
        manufacturing_overhead_account_id: overhead,
        expense_clearing_account_id: clearing,
        scrap_account_id: scrap,
        default_allocation_method: allocation,
      }).unwrap();
      setSaved(true);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage className="el-page--production">
      <EntityListHero
        kicker="Production"
        title="Production settings"
        count="Map accounts before posting batches"
        actions={
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      {isLoading ? <p>Loading…</p> : null}
      {error ? <ErrorText>Failed to load settings.</ErrorText> : null}
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {saved ? <StatusBanner>Settings saved.</StatusBanner> : null}

      {!isLoading && !error ? (
        <>
          {missing.length ? (
            <StatusBanner>
              Required before posting: {missing.join(', ')}. Expense clearing is needed when batches
              have expenses.
            </StatusBanner>
          ) : (
            <StatusBanner>Required posting accounts are mapped.</StatusBanner>
          )}

          <EntityDetailForm>
            <FormRow label="WIP account *">
              <SearchableSelect
                options={accountOptions}
                value={wip}
                onChange={setWip}
                placeholder="Select WIP account…"
              />
            </FormRow>
            <FormRow label="Raw material account *">
              <SearchableSelect
                options={accountOptions}
                value={raw}
                onChange={setRaw}
                placeholder="Select raw material account…"
              />
            </FormRow>
            <FormRow label="Finished goods account *">
              <SearchableSelect
                options={accountOptions}
                value={fg}
                onChange={setFg}
                placeholder="Select finished goods account…"
              />
            </FormRow>
            <FormRow label="Expense clearing account">
              <SearchableSelect
                options={accountOptions}
                value={clearing}
                onChange={setClearing}
                placeholder="Select clearing account…"
              />
            </FormRow>
            <FormRow label="Manufacturing overhead account">
              <SearchableSelect
                options={accountOptions}
                value={overhead}
                onChange={setOverhead}
                placeholder="Optional…"
              />
            </FormRow>
            <FormRow label="Scrap account">
              <SearchableSelect
                options={accountOptions}
                value={scrap}
                onChange={setScrap}
                placeholder="Optional…"
              />
            </FormRow>
            <FormRow label="Default allocation method">
              <select
                className="vb-control"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
              >
                {ALLOCATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormRow>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
                {updateState.isLoading ? 'Saving…' : 'Save settings'}
              </Button>
              <Link to="/settings/production-activities">Manage production activities</Link>
            </div>
          </EntityDetailForm>
        </>
      ) : null}
    </EntityListPage>
  );
}
