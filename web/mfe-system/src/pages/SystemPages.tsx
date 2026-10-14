import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCheckSystemUpdatesMutation,
  useInstallSystemUpdatesMutation,
  useListSystemLogsQuery,
  useListSystemSettingsQuery,
  useSystemDiagnosticsQuery,
  useSystemUpdatesQuery,
  useUpsertSystemSettingMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export function SystemHubPage() {
  const { data, isLoading, error, refetch } = useSystemDiagnosticsQuery();
  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>System</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to="/system/settings">Settings</Link>
        <Link to="/system/updates">Updates</Link>
        <Link to="/system/logs">Logs</Link>
      </div>
      {isLoading && <p>Loading diagnostics…</p>}
      {error ? <ErrorText>{extractError(error)}</ErrorText> : null}
      {data && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div>Status: {String(data.status)}</div>
          <div>Process: {String(data.process)}</div>
          <div>Server UTC: {String(data.server_time_utc)}</div>
          <div>Settings: {String(data.settings_count)}</div>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      )}
    </div>
  );
}

export function SystemSettingsPage() {
  const { data = [], isLoading, error, refetch } = useListSystemSettingsQuery();
  const [upsert] = useUpsertSystemSettingMutation();
  const [key, setKey] = useState('app.timezone');
  const [value, setValue] = useState('UTC');
  const [formError, setFormError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'key', header: 'Key' },
      { key: 'value', header: 'Value' },
      { key: 'updated_at', header: 'Updated' },
    ],
    [],
  );

  async function onSave() {
    setFormError('');
    try {
      await upsert({ key, value }).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>System Settings</h2>
      <Link to="/system">← System</Link>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>{extractError(error)}</ErrorText> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', margin: '16px 0' }}>
        <FormRow label="Key">
          <input value={key} onChange={(e) => setKey(e.target.value)} style={{ padding: 8 }} />
        </FormRow>
        <FormRow label="Value">
          <input value={value} onChange={(e) => setValue(e.target.value)} style={{ padding: 8 }} />
        </FormRow>
        <Button type="button" onClick={onSave} data-kb-action="settings.system.save">
          Save
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} />
    </div>
  );
}

export function SystemUpdatesPage() {
  const { data, isLoading, error, refetch } = useSystemUpdatesQuery();
  const [check, checkState] = useCheckSystemUpdatesMutation();
  const [install, installState] = useInstallSystemUpdatesMutation();
  const [msg, setMsg] = useState('');
  const rows = data ? Object.entries(data).map(([key, value]) => ({
    id: key,
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—'),
  })) : [];
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [{ key: 'key', header: 'Property' }, { key: 'value', header: 'Value' }],
    [],
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>System Updates</h2>
      <Link to="/system">← System</Link>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>{extractError(error)}</ErrorText> : null}
      <p>Latest check: {String(data?.checked_at || data?.last_checked_at || 'not yet checked')}</p>
      <DataTable columns={columns} data={rows} rowKey={(row) => String(row.id)} />
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button
          type="button"
          data-kb-action="system.updates.check"
          onClick={async () => {
            setMsg('');
            try {
              await check().unwrap();
              setMsg('Update check completed.');
              refetch();
            } catch (e) { setMsg(extractError(e)); }
          }}
          disabled={checkState.isLoading}
        >
          {checkState.isLoading ? 'Checking…' : 'Check for updates'}
        </Button>
        <Button
          type="button"
          data-kb-action="system.updates.install"
          onClick={async () => {
            setMsg('');
            if (!window.confirm('Install available system updates now?')) return;
            try {
              await install().unwrap();
              setMsg('Update install started.');
              refetch();
            } catch (e) {
              setMsg(extractError(e));
            }
          }}
          disabled={installState.isLoading}
        >
          {installState.isLoading ? 'Installing…' : 'Install updates'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => refetch()}>Refresh status</Button>
      </div>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}

export function SystemLogsPage() {
  const { data = [], isLoading, error, refetch } = useListSystemLogsQuery();
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'created_at', header: 'When' },
      { key: 'level', header: 'Level' },
      { key: 'source', header: 'Source' },
      { key: 'message', header: 'Message' },
    ],
    [],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>System Logs</h2>
        <Button type="button" variant="ghost" data-kb-action="system.logs.refresh" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <Link to="/system">← System</Link>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>{extractError(error)}</ErrorText> : null}
      <div style={{ marginTop: 16 }}>
        <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} />
      </div>
    </div>
  );
}
