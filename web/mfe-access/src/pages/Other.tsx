import { useMemo, useState } from 'react';
import {
  useCreateAccessPlanMutation,
  useGetAccessPermissionsQuery,
  useListAccessAuditLogsQuery,
  useListAccessFeatureFlagsQuery,
  useListAccessPlansQuery,
  useListAccessRolesQuery,
  useSetAccessFeatureFlagMutation,
  useUpdateAccessRoleMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export function AccessPermissionsPage() {
  const { data, isLoading, error, refetch } = useGetAccessPermissionsQuery();
  const rolesQ = useListAccessRolesQuery();
  const [updateRole, updateState] = useUpdateAccessRoleMutation();
  const [msg, setMsg] = useState('');
  const keys = (data?.assignable_permission_keys as string[]) || [];
  async function toggle(role: Record<string, unknown>, key: string) {
    const current = Array.isArray(role.permission_keys) ? role.permission_keys.map(String) : [];
    const permission_keys = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    setMsg('');
    try {
      await updateRole({ id: String(role.id), body: { permission_keys } }).unwrap();
      rolesQ.refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Permissions</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load permissions.</ErrorText> : null}
      <p>Assignable keys under current plan/modules/flags: {keys.length}. Toggle a cell to save that role immediately.</p>
      {msg ? <ErrorText>{msg}</ErrorText> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={{ textAlign: 'left', padding: 8 }}>Permission</th>{(rolesQ.data || []).map((role) => <th key={String(role.id)} style={{ padding: 8 }}>{String(role.name)}</th>)}</tr></thead>
          <tbody>{keys.map((key) => <tr key={key}>
            <td style={{ padding: 8, borderTop: '1px solid #d9e3de' }}>{key}</td>
            {(rolesQ.data || []).map((role) => {
              const granted = Array.isArray(role.permission_keys) && role.permission_keys.map(String).includes(key);
              return <td key={String(role.id)} style={{ textAlign: 'center', borderTop: '1px solid #d9e3de' }}>
                <input aria-label={`${String(role.name)} ${key}`} type="checkbox" checked={granted} disabled={Boolean(role.is_system) || updateState.isLoading} onChange={() => toggle(role, key)} />
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <p style={{ opacity: 0.7 }}>System roles are read-only.</p>
    </div>
  );
}

export function AccessAuditLogsPage() {
  const { data = [], isLoading, error, refetch } = useListAccessAuditLogsQuery();
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'action', header: 'Action' },
      { key: 'actor_name', header: 'Actor' },
      { key: 'target_label', header: 'Target' },
      { key: 'created_at', header: 'When' },
    ],
    [],
  );
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Audit logs</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load audit logs.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} />
    </div>
  );
}

export function AccessPlansPage() {
  const { data = [], isLoading, error, refetch } = useListAccessPlansQuery();
  const [createPlan, createState] = useCreateAccessPlanMutation();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'is_system', header: 'System' },
      { key: 'description', header: 'Description' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      await createPlan({ name, feature_keys: ['core.dashboard.view'] }).unwrap();
      setName('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Plans</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <FormRow label="Custom plan name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load plans.</ErrorText> : null}
      <DataTable columns={columns} data={data as Record<string, unknown>[]} rowKey={(row) => String(row.id)} />
    </div>
  );
}

export function AccessFeatureFlagsPage() {
  const { data = [], isLoading, error, refetch } = useListAccessFeatureFlagsQuery();
  const [setFlag] = useSetAccessFeatureFlagMutation();
  const [msg, setMsg] = useState('');
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'key', header: 'Key' },
      { key: 'enabled', header: 'Enabled' },
      { key: 'description', header: 'Description' },
    ],
    [],
  );

  async function toggle(row: Record<string, unknown>) {
    setMsg('');
    try {
      await setFlag({ key: String(row.key), enabled: !row.enabled }).unwrap();
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Feature flags</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {msg ? <ErrorText>{msg}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load flags.</ErrorText> : null}
      <DataTable
        columns={columns}
        data={data as Record<string, unknown>[]}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => toggle(row)}
      />
      <p style={{ opacity: 0.7 }}>Click a row to toggle enabled.</p>
    </div>
  );
}
