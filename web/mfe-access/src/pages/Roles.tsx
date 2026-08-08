import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateAccessRoleMutation,
  useGetAccessRoleQuery,
  useListAccessRolesQuery,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

export function AccessRolesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListAccessRolesQuery();
  const [createRole, createState] = useCreateAccessRoleMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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
      const row = await createRole({ name, description, permission_keys: [] }).unwrap();
      setName('');
      setDescription('');
      navigate(`/access/roles/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Roles</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'end' }}>
        <FormRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormRow>
        <Button type="button" onClick={onCreate} disabled={!name.trim() || createState.isLoading}>
          Create custom role
        </Button>
      </div>
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load roles.</ErrorText> : null}
      <DataTable
        columns={columns}
        rows={data as Record<string, unknown>[]}
        onRowClick={(row) => navigate(`/access/roles/${row.id}`)}
      />
    </div>
  );
}

export function AccessRoleDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useGetAccessRoleQuery(id, { skip: !id });
  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Role not found.</ErrorText>;
  const keys = Array.isArray(data.permission_keys) ? data.permission_keys : [];
  return (
    <div>
      <p>
        <Link to="/access/roles">← Roles</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.name)}</h2>
      <p>{asCaption(data.description)}</p>
      <p>System role: {String(data.is_system)}</p>
      <h3>Permissions ({keys.length})</h3>
      <ul>
        {keys.slice(0, 50).map((key) => (
          <li key={String(key)}>{String(key)}</li>
        ))}
      </ul>
      {keys.length > 50 ? <p>…and {keys.length - 50} more</p> : null}
    </div>
  );
}
