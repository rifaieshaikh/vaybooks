import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useCan,
  useCreateInventoryCategoryMutation,
  useLazyCheckInventoryCategoryNameQuery,
  useListInventoryCategoriesQuery,
  useUpdateInventoryCategoryMutation,
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
  ModalForm,
  ModalFormActions,
  PAGE_SIZE,
  PaginationBar,
  SearchableSelect,
  TextInput,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SearchableSelectOption,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { excludeOption, toCategoryOptions, withNoneOption } from '../pickerOptions';

type CategoryFormValues = {
  name: string;
  description: string;
  parent_id: string;
  is_active: boolean;
};

function emptyCategoryForm(): CategoryFormValues {
  return { name: '', description: '', parent_id: '', is_active: true };
}

function categoryToForm(row: Record<string, unknown>): CategoryFormValues {
  return {
    name: String(row.name || ''),
    description: String(row.description || ''),
    parent_id: String(row.parent_id || ''),
    is_active: row.is_active !== false,
  };
}

function categoryBody(v: CategoryFormValues, opts?: { includeStatus?: boolean; includeName?: boolean }) {
  const body: Record<string, unknown> = {
    description: v.description || '',
    parent_id: v.parent_id || null,
  };
  if (opts?.includeName !== false) body.name = v.name.trim();
  if (opts?.includeStatus) body.is_active = v.is_active;
  return body;
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Save failed');
  }
  return 'Save failed';
}

const DEFAULT_CATEGORY_FILTERS = { name: '', active_only: '' };
const DEFAULT_CATEGORY_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

function CategoryFormFields({
  values,
  onChange,
  parentOptions,
  nameReadOnly,
  showStatus,
  nameError,
  onNameBlur,
}: {
  values: CategoryFormValues;
  onChange: (n: keyof CategoryFormValues, v: string | boolean) => void;
  parentOptions: SearchableSelectOption[];
  nameReadOnly?: boolean;
  showStatus?: boolean;
  nameError?: string;
  onNameBlur?: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <FormRow label="Name *">
        <TextInput
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          onBlur={onNameBlur}
          required
          readOnly={nameReadOnly}
          disabled={nameReadOnly}
        />
        {nameError ? <ErrorText>{nameError}</ErrorText> : null}
      </FormRow>
      <FormRow label="Description">
        <TextInput value={values.description} onChange={(e) => onChange('description', e.target.value)} />
      </FormRow>
      <FormRow label="Parent category">
        <SearchableSelect
          options={withNoneOption(parentOptions, '— None (top level) —')}
          value={values.parent_id}
          placeholder="Select parent"
          onChange={(next) => onChange('parent_id', next)}
        />
      </FormRow>
      {showStatus ? (
        <FormRow label="Status">
          <select
            value={values.is_active ? 'yes' : 'no'}
            onChange={(e) => onChange('is_active', e.target.value === 'yes')}
            style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
          >
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
          </select>
        </FormRow>
      ) : null}
    </div>
  );
}

/** Streamlit parity: category catalog with hierarchy, filters and add/edit modal. */
export function CategoriesListPage() {
  const navigate = useNavigate();
  const can = useCan();
  const canView = can('inventory.categories.view');
  const canCreate = can('inventory.categories.create');
  const canEdit = can('inventory.categories.edit');
  const canDeactivate = can('inventory.categories.deactivate');
  // open is preferred; view is a fallback while plans/sessions catch up after the catalog split
  const canOpen = can('inventory.categories.open') || canView;

  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListInventoryCategoriesQuery(
    { active_only: false },
    { skip: !canView },
  );
  const [createCategory, createState] = useCreateInventoryCategoryMutation();
  const [updateCategory, updateState] = useUpdateInventoryCategoryMutation();
  const [checkName] = useLazyCheckInventoryCategoryNameQuery();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_CATEGORY_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_CATEGORY_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<CategoryFormValues>(emptyCategoryForm());
  const [formError, setFormError] = useState('');
  const [nameError, setNameError] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'name', label: 'Name', type: 'text' },
      {
        key: 'active_only',
        label: 'Active',
        type: 'select',
        allLabel: 'All',
        options: [
          { value: 'yes', label: 'Active only' },
          { value: 'no', label: 'Inactive only' },
        ],
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      const name = String(row.name || '');
      const pathRaw = row.path;
      const path =
        typeof pathRaw === 'string'
          ? pathRaw
          : Array.isArray(pathRaw)
            ? (pathRaw as string[]).join(' ')
            : '';
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!name.toLowerCase().includes(q) && !path.toLowerCase().includes(q)) return false;
      }
      if (!matchesRegex(row.name, filters.name)) return false;
      if (filters.active_only === 'yes' && row.is_active === false) return false;
      if (filters.active_only === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort, search]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  const parentOptions = useMemo(
    () => excludeOption(toCategoryOptions(data as Record<string, unknown>[]), editId),
    [data, editId],
  );

  type CategoryRow = (typeof data)[number];

  function setField(name: keyof CategoryFormValues, value: string | boolean) {
    setValues((p) => ({ ...p, [name]: value }));
    if (name === 'name') setNameError('');
  }

  function openAdd() {
    if (!canCreate) return;
    setFormError('');
    setNameError('');
    setValues(emptyCategoryForm());
    setEditId(null);
    setDialog('add');
  }

  function openEdit(row: CategoryRow) {
    if (!canEdit) return;
    setFormError('');
    setNameError('');
    setEditId(String(row.id));
    setValues(categoryToForm(row));
    setDialog('edit');
  }

  function openDetail(row: CategoryRow) {
    if (!canOpen) return;
    navigate(`/inventory/categories/${String(row.id)}`);
  }

  async function onNameBlur() {
    if (dialog !== 'add') return;
    const name = values.name.trim();
    if (!name) {
      setNameError('');
      return;
    }
    try {
      const result = await checkName({ name }).unwrap();
      setNameError(result.exists ? 'A category with this name already exists' : '');
    } catch {
      setNameError('');
    }
  }

  const [actionError, setActionError] = useState('');

  async function toggleActive(row: CategoryRow) {
    if (!canDeactivate) return;
    setActionError('');
    try {
      // Status-only payload — omit description/parent so API does not require edit.
      await updateCategory({
        id: String(row.id),
        body: {
          name: String(row.name || ''),
          is_active: row.is_active === false,
        },
      }).unwrap();
      refetch();
    } catch (e: unknown) {
      setActionError(extractError(e) || 'Could not update status');
    }
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    if (canCreate) openAdd();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

  async function submitForm() {
    setFormError('');
    if (dialog === 'add' && !values.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (dialog === 'add' && nameError) return;
    try {
      if (dialog === 'add') {
        await createCategory(
          categoryBody(values, { includeStatus: canDeactivate, includeName: true }),
        ).unwrap();
      } else if (dialog === 'edit' && editId) {
        await updateCategory({
          id: editId,
          body: categoryBody(values, { includeStatus: canDeactivate, includeName: true }),
        }).unwrap();
      }
      setDialog(null);
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
    }
  }

  const columns: EntityListColumn<CategoryRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Category',
        render: (row) => {
          const name = displayName(row, ['name'], 'Unnamed category');
          const pathRaw = row.path;
          const path =
            typeof pathRaw === 'string'
              ? pathRaw
              : Array.isArray(pathRaw)
                ? (pathRaw as string[]).join(' › ')
                : '';
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{name}</span>
                <span className="el-customer-sub">{path && path !== name ? path : 'Top level'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'products',
        header: 'Products',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.product_count ?? 0),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => (
          <span className={row.is_active === false ? 'el-muted' : undefined}>
            {row.is_active === false ? 'Inactive' : 'Active'}
          </span>
        ),
      },
    ],
    [],
  );

  if (!canView) {
    return (
      <EntityListPage>
        <EntityListEmpty>
          <strong>You do not have permission to view categories.</strong>
        </EntityListEmpty>
      </EntityListPage>
    );
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Categories"
        count={`${filtered.length} ${filtered.length === 1 ? 'category' : 'categories'}`}
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or path…"
            aria-label="Search categories"
          />
        }
        actions={
          canCreate ? (
            <Button type="button" onClick={openAdd}>
              Add Category
            </Button>
          ) : null
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.active_only || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, active_only: id === 'all' ? '' : id }));
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
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_CATEGORY_FILTERS}
            excludeKeys={['active_only']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_CATEGORY_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'name', label: 'Name' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading categories…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load categories. Is the API running?</ErrorText> : null}
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No categories found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={canOpen ? (row) => openDetail(row) : undefined}
          onEditRow={canEdit ? (row) => openEdit(row) : undefined}
          onNew={canCreate ? openAdd : undefined}
          actions={(row) => (
            <EntityListActions
              variant="icon"
              onOpen={canOpen ? () => openDetail(row) : undefined}
              onEdit={canEdit ? () => openEdit(row) : undefined}
              onDeactivate={
                canDeactivate && row.is_active !== false ? () => void toggleActive(row) : undefined
              }
              onActivate={
                canDeactivate && row.is_active === false ? () => void toggleActive(row) : undefined
              }
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
        title={dialog === 'edit' ? 'Edit Category' : 'Add Category'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      >
        <ModalForm onSubmit={() => void submitForm()}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <CategoryFormFields
            values={values}
            onChange={setField}
            parentOptions={parentOptions}
            nameReadOnly={dialog === 'edit'}
            showStatus={canDeactivate}
            nameError={dialog === 'add' ? nameError : undefined}
            onNameBlur={() => void onNameBlur()}
          />
          <ModalFormActions
            busy={createState.isLoading || updateState.isLoading}
            submitLabel={dialog === 'edit' ? 'Save Changes' : 'Create Category'}
            busyLabel="Saving…"
            onCancel={() => setDialog(null)}
            submitDisabled={Boolean(dialog === 'add' && nameError)}
          />
        </ModalForm>
      </Modal>
    </EntityListPage>
  );
}
