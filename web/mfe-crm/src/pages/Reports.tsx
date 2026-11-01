import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCreateCrmReportPresetMutation,
  useCrmReportsCatalogQuery,
  useDeleteCrmReportPresetMutation,
  useListCrmOwnersQuery,
  useListCrmReportPresetsQuery,
  useRunCrmReportMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { useCrmCan } from '../hooks/useCrmSettings';
import { downloadCsv, extractError, humanizeKey } from '../utils';
import { ModuleScheduledReportsPanel } from './ScheduledReportsPanel';

type CatalogReport = { id: string; title: string; category: string };

function reportFilters(dateFrom: string, dateTo: string, assigneeId: string) {
  const filters: Record<string, unknown> = {};
  if (dateFrom) filters.date_from = dateFrom;
  if (dateTo) filters.date_to = dateTo;
  if (assigneeId) filters.assigned_user_id = assigneeId;
  return filters;
}

function drillPath(row: Record<string, unknown>): string | null {
  if (row.lead_id) return `/crm/leads/${String(row.lead_id)}`;
  if (row.enquiry_id) return `/crm/enquiries/${String(row.enquiry_id)}`;
  if (row.activity_id) return `/crm/activities/${String(row.activity_id)}`;
  if (row.customer_id) return `/parties/customers/${String(row.customer_id)}`;
  return null;
}

export function CrmReportsPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const { data: catalog, isLoading, error } = useCrmReportsCatalogQuery();
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, { skip: !can.viewReports });
  const { data: presetsPage, refetch: refetchPresets } = useListCrmReportPresetsQuery(undefined, {
    skip: !can.viewReports,
  });
  const [runReport, runState] = useRunCrmReportMutation();
  const [createPreset, createPresetState] = useCreateCrmReportPresetMutation();
  const [deletePreset] = useDeleteCrmReportPresetMutation();
  const [reportId, setReportId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
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
  const currentFilters = useMemo(
    () => reportFilters(dateFrom, dateTo, assigneeId),
    [dateFrom, dateTo, assigneeId],
  );

  async function onRun(idOverride?: string, filtersOverride?: Record<string, unknown>) {
    setRunError('');
    try {
      const id = idOverride || selectedReportId;
      if (!id) return;
      setReportId(id);
      const result = await runReport({
        report_id: id,
        filters: filtersOverride ?? currentFilters,
      }).unwrap();
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
        filters: currentFilters,
      }).unwrap();
      setPresetName('');
      setPresetMsg('Preset saved');
      refetchPresets();
    } catch (e) {
      setPresetMsg(extractError(e));
    }
  }

  function applyPreset(preset: Record<string, unknown>) {
    const filters =
      preset.filters && typeof preset.filters === 'object'
        ? (preset.filters as Record<string, unknown>)
        : {};
    const from = String(filters.date_from || '').slice(0, 10);
    const to = String(filters.date_to || '').slice(0, 10);
    const assignee = String(filters.assigned_user_id || '');
    setDateFrom(from);
    setDateTo(to);
    setAssigneeId(assignee);
    const rid = String(preset.report_id || '');
    void onRun(rid, reportFilters(from, to, assignee));
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
        <FormRow label="From">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </FormRow>
        <FormRow label="To">
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </FormRow>
        <FormRow label="Assignee">
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">All</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
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
                return (
                  <li key={id} style={{ marginBottom: 6 }}>
                    <Button type="button" variant="ghost" onClick={() => applyPreset(preset)}>
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
        rowKey={(row) =>
          String(
            row.id ||
              row.lead_id ||
              row.enquiry_id ||
              row.activity_id ||
              row.customer_id ||
              row.title ||
              JSON.stringify(row),
          )
        }
        onRowClick={(row) => {
          const path = drillPath(row);
          if (path) navigate(path);
        }}
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
