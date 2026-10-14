import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCreateAccessUserMutation,
  useGetAccessUserQuery,
  useListAccessRolesQuery,
  useListInventoryLocationsQuery,
  useSetAccessUserPasswordMutation,
  useListAccessUsersQuery,
  useUpdateAccessUserMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
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

type UserDetailTab = 'profile' | 'access' | 'security';

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

const DEFAULT_USER_FILTERS = { username: '', display_name: '', active: '' };
const DEFAULT_USER_SORT: SortCriterion[] = [{ key: 'username', desc: false }];
const USER_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'username', label: 'Username', type: 'text' },
  { key: 'display_name', label: 'Display name', type: 'text' },
  {
    key: 'active',
    label: 'Active',
    type: 'select',
    options: [
      { value: 'yes', label: 'Active' },
      { value: 'no', label: 'Inactive' },
    ],
  },
];

export function AccessUsersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error } = useListAccessUsersQuery();
  const rolesQ = useListAccessRolesQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [createUser, createState] = useCreateAccessUserMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_USER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_USER_FILTERS });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  function openCreate() {
    setUsername('');
    setUserDisplayName('');
    setPassword('');
    setRoleId('');
    setLocationIds([]);
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
      if (!matchesRegex(row.username, filters.username)) return false;
      if (!matchesRegex(row.display_name, filters.display_name)) return false;
      if (filters.active === 'yes' && !row.active) return false;
      if (filters.active === 'no' && row.active) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type UserRow = (typeof data)[number];

  const columns: EntityListColumn<UserRow>[] = useMemo(
    () => [
      {
        id: 'username',
        header: 'Username',
        render: (row) => displayName(row, ['username'], 'Unnamed'),
      },
      {
        id: 'display_name',
        header: 'Display name',
        render: (row) => {
          const name = String(row.display_name || '').trim();
          return <span className={name ? undefined : 'el-muted'}>{name || '—'}</span>;
        },
      },
      {
        id: 'active',
        header: 'Active',
        render: (row) => (
          <span className={row.active ? 'el-advance' : 'el-muted'}>
            {row.active ? 'Active' : 'Inactive'}
          </span>
        ),
      },
    ],
    [],
  );

  async function onCreate() {
    setFormError('');
    try {
      const row = await createUser({
        username,
        display_name: userDisplayName || username,
        password,
        role_ids: roleId ? [roleId] : [],
        location_ids: locationIds,
      }).unwrap();
      setUsername('');
      setUserDisplayName('');
      setPassword('');
      setLocationIds([]);
      setDialogOpen(false);
      navigate(`/access/users/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Access"
        title="Users"
        count={`${filtered.length} ${filtered.length === 1 ? 'user' : 'users'}`}
        actions={
          <Button type="button" onClick={openCreate}>
            Create user
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.active || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, active: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'yes', label: 'Active' },
              { id: 'no', label: 'Inactive' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={USER_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_USER_FILTERS}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_USER_SORT}
            sortOptions={[
              { value: 'username', label: 'Username' },
              { value: 'display_name', label: 'Display name' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading users…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load users.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No users found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/access/users/${row.id}`)}
          onNew={openCreate}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/access/users/${row.id}`)} />
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
        title="Create user"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={() => void onCreate()}
              disabled={!username.trim() || password.length < 4 || createState.isLoading}
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
          <FormRow label="Username">
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} />
          </FormRow>
          <FormRow label="Display name">
            <TextInput value={userDisplayName} onChange={(e) => setUserDisplayName(e.target.value)} />
          </FormRow>
          <FormRow label="Password">
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
          <FormRow label="Locations">
            <LocationChecklist locations={locations} selected={locationIds} onChange={setLocationIds} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function AccessUserDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetAccessUserQuery(id, { skip: !id });
  const [updateUser, updateState] = useUpdateAccessUserMutation();
  const [setPassword, passwordState] = useSetAccessUserPasswordMutation();
  const rolesQ = useListAccessRolesQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [userDisplayName, setUserDisplayName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState(true);
  const [password, setPasswordValue] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<UserDetailTab>('profile');

  useEffect(() => {
    if (!data || hydrated) return;
    setUserDisplayName(String(data.display_name || ''));
    setRoleIds(Array.isArray(data.role_ids) ? data.role_ids.map(String) : []);
    setLocationIds(Array.isArray(data.location_ids) ? data.location_ids.map(String) : []);
    setActive(Boolean(data.active));
    setHydrated(true);
  }, [data, hydrated]);

  const saving = updateState.isLoading || passwordState.isLoading;
  const saveDisabled = saving || (password.length > 0 && password.length < 4);

  async function onSave() {
    setMsg('');
    try {
      await updateUser({
        id,
        body: {
          display_name: userDisplayName || String(data?.display_name || ''),
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

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading user…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/access/users" label="Users" />
        <ErrorText>User not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const roleNames = (rolesQ.data || [])
    .filter((role) => roleIds.includes(String(role.id)))
    .map((role) => asCaption(role.name))
    .filter(Boolean);
  const heroActions = (
    <Button type="button" onClick={() => void onSave()} disabled={saveDisabled}>
      {saving ? 'Saving…' : 'Save'}
    </Button>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/access/users" label="Users" />

      <EntityDetailHero
        kicker="Access · User"
        title={asCaption(data.username) || 'User'}
        lead={
          <>
            <span>{asCaption(data.display_name) || 'No display name'}</span>
            <span className="ed-lead-sep"> · {active ? 'Active' : 'Inactive'}</span>
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="User facts"
        items={[
          { label: 'Username', value: asCaption(data.username) || '—' },
          { label: 'Display name', value: userDisplayName || asCaption(data.display_name) || '—' },
          { label: 'Status', value: active ? 'Active' : 'Inactive' },
          {
            label: 'Roles',
            value: roleNames.length ? roleNames.join(', ') : `${roleIds.length || 0} assigned`,
          },
          { label: 'Locations', value: String(locationIds.length) },
        ]}
      />

      {msg === 'Saved' ? <p className="ed-panel-note is-ok">Saved.</p> : null}
      {msg && msg !== 'Saved' ? <ErrorText>{msg}</ErrorText> : null}

      <EntityDetailTabs
        value={tab}
        ariaLabel="User sections"
        onChange={(next) => setTab(next as UserDetailTab)}
        options={[
          { id: 'profile', label: 'Profile' },
          { id: 'access', label: 'Access' },
          { id: 'security', label: 'Security' },
        ]}
      />

      {tab === 'profile' ? (
        <EntityDetailPanel key="profile" title="Profile" note="Identity and account status.">
          <EntityDetailForm>
            <div className="ed-grid">
              <FormRow label="Username">
                <input value={asCaption(data.username)} readOnly disabled />
              </FormRow>
              <FormRow label="Display name">
                <input value={userDisplayName} onChange={(e) => setUserDisplayName(e.target.value)} />
              </FormRow>
              <FormRow label="Status">
                <select
                  value={active ? 'yes' : 'no'}
                  onChange={(e) => setActive(e.target.value === 'yes')}
                >
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </select>
              </FormRow>
            </div>
          </EntityDetailForm>
        </EntityDetailPanel>
      ) : null}

      {tab === 'access' ? (
        <EntityDetailPanel key="access" title="Access" note="Roles and inventory locations this user can use.">
          <EntityDetailForm>
            <FormRow label="Roles">
              <select
                multiple
                value={roleIds}
                onChange={(e) =>
                  setRoleIds(Array.from(e.target.selectedOptions, (option) => option.value))
                }
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
              <LocationChecklist
                locations={locations}
                selected={locationIds}
                onChange={setLocationIds}
              />
            </FormRow>
          </EntityDetailForm>
        </EntityDetailPanel>
      ) : null}

      {tab === 'security' ? (
        <EntityDetailPanel
          key="security"
          title="Security"
          note="Leave blank to keep the current password. New passwords must be at least 4 characters."
        >
          <EntityDetailForm>
            <FormRow label="New password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
              />
            </FormRow>
          </EntityDetailForm>
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/access/users')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}
