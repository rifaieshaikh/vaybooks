import { useMemo, useState } from 'react';
import {
  useCreateBusinessActivityMutation,
  useDeactivateBusinessActivityMutation,
  useListBusinessActivitiesQuery,
  useUpdateBusinessActivityMutation,
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
import { asCaption, extractError, unwrapPaged } from '../utils';

const CATEGORIES = [
  'In House Service',
  'In House Material',
  'Outsourced Service',
  'Outsourced Material',
];

const DEFAULT_FILTERS = { activity_name: '', activity_category: '', active: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'activity_name', desc: false }];
const FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'activity_name', label: 'Name', type: 'text' },
  { key: 'activity_category', label: 'Category', type: 'text' },
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

export function BusinessActivitiesPage() {
  const { data: raw, isLoading, error, refetch } = useListBusinessActivitiesQuery({
    active_only: false,
    page: 1,
    page_size: 200,
  });
  const data = useMemo(() => unwrapPaged(raw), [raw]);
  const [createActivity, createState] = useCreateBusinessActivityMutation();
  const [updateActivity, updateState] = useUpdateBusinessActivityMutation();
  const [deactivate] = useDeactivateBusinessActivityMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [rate, setRate] = useState('100');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
      if (!matchesRegex(row.activity_category, filters.activity_category)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type ActivityRow = (typeof data)[number];

  const columns: EntityListColumn<ActivityRow>[] = useMemo(
    () => [
      {
        id: 'activity_name',
        header: 'Activity',
        render: (row) => displayName(row, ['activity_name'], 'Unnamed'),
      },
      {
        id: 'activity_category',
        header: 'Category',
        render: (row) => asCaption(row.activity_category) || '—',
      },
      {
        id: 'default_hourly_expense',
        header: 'Hourly',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => `₹${Number(row.default_hourly_expense ?? 0)}`,
      },
      {
        id: 'is_active',
        header: 'Active',
        render: (row) => (row.is_active === false ? 'No' : 'Yes'),
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setEditingId(null);
    setName('');
    setCategory(CATEGORIES[0]);
    setRate('100');
    setIsActive(true);
    setOpen(true);
  }

  function openEdit(row: ActivityRow) {
    setFormError('');
    setEditingId(String(row.id));
    setName(asCaption(row.activity_name));
    setCategory(asCaption(row.activity_category) || CATEGORIES[0]);
    setRate(String(row.default_hourly_expense ?? 0));
    setIsActive(row.is_active !== false);
    setOpen(true);
  }

  async function onSave() {
    setFormError('');
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }
    try {
      if (editingId) {
        await updateActivity({
          id: editingId,
          body: {
            activity_name: name.trim(),
            activity_category: category,
            default_hourly_expense: Number(rate) || 0,
            is_active: isActive,
          },
        }).unwrap();
      } else {
        await createActivity({
          activity_name: name.trim(),
          activity_category: category,
          default_hourly_expense: Number(rate) || 0,
        }).unwrap();
      }
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  async function onDeactivate(id: string) {
    if (!window.confirm('Deactivate this activity?')) return;
    try {
      await deactivate(id).unwrap();
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Business"
        title="Activities"
        count={`${filtered.length} ${filtered.length === 1 ? 'activity' : 'activities'}`}
        actions={
          <Button type="button" onClick={openCreate}>
            Add activity
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Active"
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
            filterFields={FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['active']}
            onFiltersChange={(next) => {
              setFilters(next as typeof DEFAULT_FILTERS);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'activity_name', label: 'Name' },
              { value: 'activity_category', label: 'Category' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading activities…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load activities.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No business activities yet.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() => void onDeactivate(String(row.id))}
            />
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
        open={open}
        title={editingId ? 'Edit activity' : 'Add activity'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={createState.isLoading || updateState.isLoading}
            >
              {createState.isLoading || updateState.isLoading ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Default hourly expense">
            <TextInput value={rate} onChange={(e) => setRate(e.target.value)} />
          </FormRow>
          {editingId ? (
            <FormRow label="Active">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
            </FormRow>
          ) : null}
        </div>
      </Modal>
    </EntityListPage>
  );
}
