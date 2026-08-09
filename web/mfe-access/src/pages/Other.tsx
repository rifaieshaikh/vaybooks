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
import {
  Button,
  DataTable,
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
  type DataTableColumn,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
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

const DEFAULT_PLAN_FILTERS = { name: '', description: '', kind: '' };
const DEFAULT_PLAN_SORT: SortCriterion[] = [{ key: 'name', desc: false }];
const PLAN_FILTER_FIELDS: FilterFieldDef[] = [
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

export function AccessPlansPage() {
  const { data = [], isLoading, error, refetch } = useListAccessPlansQuery();
  const [createPlan, createState] = useCreateAccessPlanMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_PLAN_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_PLAN_FILTERS });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
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

  type PlanRow = (typeof data)[number];

  const columns: EntityListColumn<PlanRow>[] = useMemo(
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
      await createPlan({ name, feature_keys: ['core.dashboard.view'] }).unwrap();
      setName('');
      setDialogOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Access"
        title="Plans"
        count={`${filtered.length} ${filtered.length === 1 ? 'plan' : 'plans'}`}
        actions={
          <Button
            type="button"
            onClick={() => {
              setName('');
              setFormError('');
              setDialogOpen(true);
            }}
          >
            Create plan
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
            filterFields={PLAN_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_PLAN_FILTERS}
            excludeKeys={['kind']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_PLAN_SORT}
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

      {isLoading ? <EntityListLoading>Loading plans…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load plans.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No plans found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable columns={columns} rows={pageRows} rowKey={(row) => String(row.id)} />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal
        title="Create plan"
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
        <FormRow label="Custom plan name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
      </Modal>
    </EntityListPage>
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
      <p style={{ opacity: 0.7 }}>
        Click a row to toggle enabled. Feature flags are not the same as product modules — enable or
        disable modules under Business Settings → Enabled modules.
      </p>
    </div>
  );
}
