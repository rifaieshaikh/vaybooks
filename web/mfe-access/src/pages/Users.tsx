import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateAccessUserMutation,
  useGetAccessUserQuery,
  useListAccessRolesQuery,
  useListAccessUsersQuery,
  useUpdateAccessUserMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

export function AccessUsersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListAccessUsersQuery();
  const rolesQ = useListAccessRolesQuery();
  const [createUser, createState] = useCreateAccessUserMutation();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [formError, setFormError] = useState('');

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'username', header: 'Username' },
      { key: 'display_name', header: 'Display name' },
      { key: 'active', header: 'Active' },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createUser({
        username,
        display_name: displayName || username,
        password,
        role_ids: roleId ? [roleId] : [],
      }).unwrap();
      setUsername('');
      setDisplayName('');
      setPassword('');
      navigate(`/access/users/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Users</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'end' }}>
        <FormRow label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </FormRow>
        <FormRow label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormRow>
        <FormRow label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormRow>
        <FormRow label="Role">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">None</option>
            {(rolesQ.data || []).map((role) => (
              <option key={String(role.id)} value={String(role.id)}>
                {asCaption(role.name)}
              </option>
            ))}
          </select>
        </FormRow>
        <Button
          type="button"
          onClick={onCreate}
          disabled={!username.trim() || password.length < 4 || createState.isLoading}
        >
          Create
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load users.</ErrorText> : null}
      <DataTable
        columns={columns}
        rows={data as Record<string, unknown>[]}
        onRowClick={(row) => navigate(`/access/users/${row.id}`)}
      />
    </div>
  );
}

export function AccessUserDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetAccessUserQuery(id, { skip: !id });
  const [updateUser, updateState] = useUpdateAccessUserMutation();
  const [displayName, setDisplayName] = useState('');
  const [msg, setMsg] = useState('');

  async function onSave() {
    setMsg('');
    try {
      await updateUser({ id, body: { display_name: displayName || undefined } }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>User not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/access/users">← Users</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.username)}</h2>
      <p>Active: {String(data.active)}</p>
      <FormRow label="Display name">
        <input
          value={displayName || String(data.display_name || '')}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </FormRow>
      <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
        Save
      </Button>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}
