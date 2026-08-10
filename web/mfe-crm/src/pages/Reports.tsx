import { useMemo, useState } from 'react';
import {
  useCreateCrmReportPresetMutation,
  useCrmReportsCatalogQuery,
  useDeleteCrmReportPresetMutation,
  useListCrmReportPresetsQuery,
  useRunCrmReportMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { useCrmCan } from '../hooks/useCrmSettings';
import { downloadCsv, extractError, humanizeKey } from '../utils';
import { ModuleScheduledReportsPanel } from './ScheduledReportsPanel';

type CatalogReport = { id: string; title: string; category: string };

export function CrmReportsPage() {
  const can = useCrmCan();
  const { data: catalog, isLoading, error } = useCrmReportsCatalogQuery();
  const { data: presetsPage, refetch: refetchPresets } = useListCrmReportPresetsQuery(undefined, {
    skip: !can.viewReports,
  });
  const [runReport, runState] = useRunCrmReportMutation();
  const [createPreset, createPresetState] = useCreateCrmReportPresetMutation();
  const [deletePreset] = useDeleteCrmReportPresetMutation();
  const [reportId, setReportId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [runError, setRunError] = useState('');
  const [presetMsg, setPresetMsg] = useState('');

  const reports = (catalog?.reports || []) as CatalogReport[];
  const presets = useMemo(() => {
    if (!presetsPage) return [] as Record<string, unknown>[];
    if (Array.isArray(presetsPage)) return presetsPage;
    if (Array.isArray(presetsPage.items)) return presetsPage.items;
    return [];
  }, [presetsPage]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogReport[]>();
    for (const report of reports) {
      const category = String(report.category || 'General').trim() || 'General';
      const list = map.get(category) || [];
      list.push(report);
      map.set(category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [reports]);

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({ key, header: humanizeKey(key) }));
  }, [rows]);

  const selectedReportId = reportId || reports[0]?.id || '';

  async function onRun(idOverride?: string) {
    setRunError('');
    try {
      const id = idOverride || selectedReportId;
      if (!id) return;
      setReportId(id);
      const result = await runReport({ report_id: id, filters: {} }).unwrap();
      setRows(Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : []);
    } catch (e) {
      setRunError(extractError(e));
      setRows([]);
    }
  }

  async function onSavePreset() {
    setPresetMsg('');
    if (!presetName.trim() || !selectedReportId) return;
    try {
      await createPreset({
        name: presetName.trim(),
        report_id: selectedReportId,
        filters: {},
      }).unwrap();
      setPresetName('');
      setPresetMsg('Preset saved');
      refetchPresets();
    } catch (e) {
      setPresetMsg(extractError(e));
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>CRM Reports</h2>
      {isLoading && <p>Loading catalog…</p>}
      {error ? <ErrorText>Failed to load report catalog.</ErrorText> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <FormRow label="Report">
          <select
            value={selectedReportId}
            onChange={(e) => setReportId(e.target.value)}
            style={{ minWidth: 280, padding: 8 }}
          >
            {grouped.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </FormRow>
        <Button type="button" onClick={() => void onRun()} disabled={runState.isLoading || reports.length === 0}>
          {runState.isLoading ? 'Running…' : 'Run'}
        </Button>
        {can.exportReports ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => downloadCsv('crm-report.csv', rows)}
            disabled={rows.length === 0}
          >
            Export CSV
          </Button>
        ) : null}
      </div>

      {can.viewReports ? (
        <section style={{ marginBottom: 20, display: 'grid', gap: 10, maxWidth: 720 }}>
          <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Saved presets</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <FormRow label="Preset name">
              <input value={presetName} onChange={(e) => setPresetName(e.target.value)} />
            </FormRow>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void onSavePreset()}
              disabled={!presetName.trim() || !selectedReportId || createPresetState.isLoading}
            >
              Save current report
            </Button>
          </div>
          {presetMsg ? <p style={{ margin: 0 }}>{presetMsg}</p> : null}
          {presets.length === 0 ? (
            <p className="el-muted" style={{ margin: 0 }}>
              No presets yet.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {presets.map((preset) => {
                const id = String(preset.id || '');
                const name = String(preset.name || 'Preset');
                const rid = String(preset.report_id || '');
                return (
                  <li key={id} style={{ marginBottom: 6 }}>
                    <Button type="button" variant="ghost" onClick={() => void onRun(rid)}>
                      {name}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void deletePreset(id).then(() => refetchPresets())}
                    >
                      Delete
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {runError ? <ErrorText>{runError}</ErrorText> : null}
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => String(row.id || row.title || JSON.stringify(row))}
      />
    </div>
  );
}

export function CrmScheduledReportsPage() {
  return (
    <div>
      <h2 style={{ margin: '0 0 12px', color: 'var(--vb-color-primary, #185c4c)' }}>CRM Scheduled Reports</h2>
      <ModuleScheduledReportsPanel module="crm" showSchedulersLink />
    </div>
  );
}
