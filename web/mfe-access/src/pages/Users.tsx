import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateAccessUserMutation,
  useGetAccessUserQuery,
  useListAccessRolesQuery,
  useListInventoryLocationsQuery,
  useSetAccessUserPasswordMutation,
  useListAccessUsersQuery,
  useUpdateAccessUserMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

function LocationChecklist({
  locations,
  selected,
  onChange,
}: {
  locations: Record<string, unknown>[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (!locations.length) {
    return <p style={{ color: '#667', margin: 0 }}>No inventory locations yet. Create some under Settings → Locations.</p>;
  }
  return (
    <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflow: 'auto', border: '1px solid #dde', padding: 8, borderRadius: 6 }}>
      {locations.map((loc) => {
        const id = String(loc.id);
        const checked = selected.includes(id);
        return (
          <label key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (e.target.checked) onChange([...selected, id]);
                else onChange(selected.filter((x) => x !== id));
              }}
            />
            <span>
              {asCaption(loc.code)} — {asCaption(loc.name)}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function AccessUsersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListAccessUsersQuery();
  const rolesQ = useListAccessRolesQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [createUser, createState] = useCreateAccessUserMutation();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [locationIds, setLocationIds] = useState<string[]>([]);
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
        location_ids: locationIds,
      }).unwrap();
      setUsername('');
      setDisplayName('');
      setPassword('');
      setLocationIds([]);
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
      <div style={{ display: 'grid', gap: 12, marginBottom: 20, maxWidth: 560 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
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
        </div>
        <FormRow label="Locations">
          <LocationChecklist locations={locations} selected={locationIds} onChange={setLocationIds} />
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
        data={data as Record<string, unknown>[]}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => navigate(`/access/users/${row.id}`)}
      />
    </div>
  );
}

export function AccessUserDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetAccessUserQuery(id, { skip: !id });
  const [updateUser, updateState] = useUpdateAccessUserMutation();
  const [setPassword, passwordState] = useSetAccessUserPasswordMutation();
  const rolesQ = useListAccessRolesQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [displayName, setDisplayName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState(true);
  const [password, setPasswordValue] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!data || hydrated) return;
    setDisplayName(String(data.display_name || ''));
    setRoleIds(Array.isArray(data.role_ids) ? data.role_ids.map(String) : []);
    setLocationIds(Array.isArray(data.location_ids) ? data.location_ids.map(String) : []);
    setActive(Boolean(data.active));
    setHydrated(true);
  }, [data, hydrated]);

  async function onSave() {
    setMsg('');
    try {
      await updateUser({
        id,
        body: {
          display_name: displayName || String(data?.display_name || ''),
          role_ids: roleIds,
          location_ids: locationIds,
          active,
        },
      }).unwrap();
      if (password) await setPassword({ id, password }).unwrap();
      setPasswordValue('');
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
      <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <FormRow label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormRow>
        <FormRow label="Roles">
          <select
            multiple
            value={roleIds}
            onChange={(e) => setRoleIds(Array.from(e.target.selectedOptions, (option) => option.value))}
            style={{ minHeight: 100 }}
          >
            {(rolesQ.data || []).map((role) => (
              <option key={String(role.id)} value={String(role.id)}>
                {asCaption(role.name)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Locations">
          <LocationChecklist locations={locations} selected={locationIds} onChange={setLocationIds} />
        </FormRow>
        <label>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <FormRow label="New password (leave blank to keep)">
          <input type="password" value={password} onChange={(e) => setPasswordValue(e.target.value)} />
        </FormRow>
        <Button
          type="button"
          onClick={onSave}
          disabled={updateState.isLoading || passwordState.isLoading || (password.length > 0 && password.length < 4)}
        >
          Save
        </Button>
        {msg ? <p>{msg}</p> : null}
      </div>
    </div>
  );
}
