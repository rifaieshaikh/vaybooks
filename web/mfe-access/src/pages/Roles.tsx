import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCreateAccessRoleMutation,
  useGetAccessRoleQuery,
  useListAccessRolesQuery,
  useUpdateAccessRoleMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailBanner,
  EntityDetailForm,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityDetailTabs,
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

type RoleDetailTab = 'details' | 'permissions';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error } = useListAccessRolesQuery();
  const [createRole, createState] = useCreateAccessRoleMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_ROLE_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_ROLE_FILTERS });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  function openCreate() {
    setName('');
    setDescription('');
    setFormError('');
    setDialogOpen(true);
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
          <Button type="button" onClick={openCreate}>
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
          keyboardNav
          onActivateRow={(row) => navigate(`/access/roles/${row.id}`)}
          onNew={openCreate}
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
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetAccessRoleQuery(id, { skip: !id });
  const [update, updateState] = useUpdateAccessRoleMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keysText, setKeysText] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<RoleDetailTab>('details');

  useEffect(() => {
    if (!data || hydrated) return;
    setName(String(data.name || ''));
    setDescription(String(data.description || ''));
    setKeysText(Array.isArray(data.permission_keys) ? data.permission_keys.map(String).join('\n') : '');
    setHydrated(true);
  }, [data, hydrated]);

  async function onSave() {
    setMsg('');
    try {
      await update({
        id,
        body: {
          name: name || String(data?.name || ''),
          description: description || String(data?.description || ''),
          permission_keys: (keysText ||
            (Array.isArray(data?.permission_keys) ? data.permission_keys.join('\n') : ''))
            .split(/\n|,/)
            .map((key) => key.trim())
            .filter(Boolean),
        },
      }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading role…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/access/roles" label="Roles" />
        <ErrorText>Role not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const keys = Array.isArray(data.permission_keys) ? data.permission_keys : [];
  const isSystem = Boolean(data.is_system);
  const heroActions = !isSystem ? (
    <Button type="button" onClick={() => void onSave()} disabled={updateState.isLoading}>
      {updateState.isLoading ? 'Saving…' : 'Save role'}
    </Button>
  ) : null;

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/access/roles" label="Roles" />

      <EntityDetailHero
        kicker="Access · Role"
        title={asCaption(data.name) || 'Role'}
        lead={
          <>
            <span>{isSystem ? 'System role' : 'Custom role'}</span>
            {data.description ? (
              <span className="ed-lead-sep"> · {asCaption(data.description)}</span>
            ) : null}
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Role facts"
        items={[
          { label: 'Kind', value: isSystem ? 'System' : 'Custom' },
          { label: 'Permissions', value: String(keys.length) },
          { label: 'Name', value: name || asCaption(data.name) || '—' },
        ]}
      />

      {isSystem ? (
        <EntityDetailBanner>System roles cannot be edited.</EntityDetailBanner>
      ) : null}

      {msg === 'Saved' ? <p className="ed-panel-note is-ok">Saved.</p> : null}
      {msg && msg !== 'Saved' ? <ErrorText>{msg}</ErrorText> : null}

      <EntityDetailTabs
        value={tab}
        ariaLabel="Role sections"
        onChange={(next) => setTab(next as RoleDetailTab)}
        options={[
          { id: 'details', label: 'Details' },
          { id: 'permissions', label: `Permissions (${keys.length})` },
        ]}
      />

      {tab === 'details' ? (
        <EntityDetailPanel
          key="details"
          title="Details"
          note={isSystem ? 'Read-only system role profile.' : 'Update role name and description.'}
        >
          <EntityDetailForm>
            <div className="ed-grid">
              <FormRow label="Role name">
                <input
                  value={isSystem ? asCaption(data.name) : name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={isSystem}
                  disabled={isSystem}
                />
              </FormRow>
              <FormRow label="Description">
                <input
                  value={isSystem ? asCaption(data.description) : description}
                  onChange={(e) => setDescription(e.target.value)}
                  readOnly={isSystem}
                  disabled={isSystem}
                />
              </FormRow>
              <FormRow label="Kind">
                <select value={isSystem ? 'system' : 'custom'} disabled>
                  <option value="system">System</option>
                  <option value="custom">Custom</option>
                </select>
              </FormRow>
            </div>
          </EntityDetailForm>
        </EntityDetailPanel>
      ) : null}

      {tab === 'permissions' ? (
        <EntityDetailPanel
          key="permissions"
          title="Permissions"
          note={
            isSystem
              ? `${keys.length} permission key${keys.length === 1 ? '' : 's'} on this role.`
              : 'Enter one permission key per line (or comma-separated). Save to apply.'
          }
        >
          {!isSystem ? (
            <EntityDetailForm>
              <FormRow label="Permission keys">
                <textarea rows={8} value={keysText} onChange={(e) => setKeysText(e.target.value)} />
              </FormRow>
            </EntityDetailForm>
          ) : null}
          {keys.length === 0 ? (
            <p className="el-muted">No permission keys assigned.</p>
          ) : (
            <>
              <ul>
                {keys.slice(0, 50).map((key) => (
                  <li key={String(key)}>{String(key)}</li>
                ))}
              </ul>
              {keys.length > 50 ? <p className="el-muted">…and {keys.length - 50} more</p> : null}
            </>
          )}
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/access/roles')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}
