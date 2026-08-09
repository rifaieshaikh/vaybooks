import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateAccessRoleMutation,
  useGetAccessRoleQuery,
  useListAccessRolesQuery,
  useUpdateAccessRoleMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityListActions,
  EntityListEmpty,
  EntityListFilterSort,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  ErrorText,
  FormRow,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const DEFAULT_ROLE_FILTERS = { name: '', description: '', kind: '' };
const DEFAULT_ROLE_SORT: SortCriterion[] = [{ key: 'name', desc: false }];
const ROLE_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  {
    key: 'kind',
    label: 'Kind',
    type: 'select',
    options: [
      { value: 'system', label: 'System' },
      { value: 'custom', label: 'Custom' },
    ],
  },
];

export function AccessRolesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListAccessRolesQuery();
  const [createRole, createState] = useCreateAccessRoleMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_ROLE_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_ROLE_FILTERS });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.name, filters.name)) return false;
      if (!matchesRegex(row.description, filters.description)) return false;
      if (filters.kind === 'system' && !row.is_system) return false;
      if (filters.kind === 'custom' && row.is_system) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type RoleRow = (typeof data)[number];

  const columns: EntityListColumn<RoleRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        render: (row) => displayName(row, ['name'], 'Unnamed'),
      },
      {
        id: 'is_system',
        header: 'System',
        render: (row) => (
          <span className={row.is_system ? 'el-muted' : 'el-advance'}>
            {row.is_system ? 'System' : 'Custom'}
          </span>
        ),
      },
      {
        id: 'description',
        header: 'Description',
        render: (row) => {
          const text = String(row.description || '').trim();
          return <span className={text ? undefined : 'el-muted'}>{text || '—'}</span>;
        },
      },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createRole({ name, description, permission_keys: [] }).unwrap();
      setName('');
      setDescription('');
      setDialogOpen(false);
      navigate(`/access/roles/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Access"
        title="Roles"
        count={`${filtered.length} ${filtered.length === 1 ? 'role' : 'roles'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setName('');
              setDescription('');
              setFormError('');
              setDialogOpen(true);
            }}
          >
            Create custom role
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Kind"
            value={filters.kind || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, kind: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'system', label: 'System' },
              { id: 'custom', label: 'Custom' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={ROLE_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_ROLE_FILTERS}
            excludeKeys={['kind']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_ROLE_SORT}
            sortOptions={[
              { value: 'name', label: 'Name' },
              { value: 'description', label: 'Description' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading roles…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load roles.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No roles found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/access/roles/${row.id}`)} />
          )}
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal
        title="Create custom role"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={() => void onCreate()}
              disabled={!name.trim() || createState.isLoading}
            >
              {createState.isLoading ? 'Creating…' : 'Create'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Description">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function AccessRoleDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetAccessRoleQuery(id, { skip: !id });
  const [update, updateState] = useUpdateAccessRoleMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keysText, setKeysText] = useState('');
  const [msg, setMsg] = useState('');
  async function onSave() {
    try {
      await update({ id, body: {
        name: name || String(data?.name || ''),
        description: description || String(data?.description || ''),
        permission_keys: (keysText || (Array.isArray(data?.permission_keys) ? data.permission_keys.join('\n') : '')).split(/\n|,/).map((key) => key.trim()).filter(Boolean),
      } }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) { setMsg(extractError(e)); }
  }
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
      {!data.is_system ? <div style={{ display: 'grid', gap: 12, maxWidth: 640, marginBottom: 20 }}>
        <FormRow label="Role name"><input value={name || String(data.name || '')} onChange={(e) => setName(e.target.value)} /></FormRow>
        <FormRow label="Description"><input value={description || String(data.description || '')} onChange={(e) => setDescription(e.target.value)} /></FormRow>
        <FormRow label="Permission keys (one per line)"><textarea rows={8} value={keysText || (Array.isArray(data.permission_keys) ? data.permission_keys.join('\n') : '')} onChange={(e) => setKeysText(e.target.value)} /></FormRow>
        <Button type="button" onClick={onSave} disabled={updateState.isLoading}>{updateState.isLoading ? 'Saving…' : 'Save role'}</Button>
        {msg ? <p>{msg}</p> : null}
      </div> : <p>System roles cannot be edited.</p>}
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
