import { useMemo, useState } from 'react';
import {
  useCreateInventoryCategoryMutation,
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

function categoryBody(v: CategoryFormValues) {
  return {
    name: v.name.trim(),
    description: v.description || '',
    parent_id: v.parent_id || null,
    is_active: v.is_active,
  };
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
}: {
  values: CategoryFormValues;
  onChange: (n: keyof CategoryFormValues, v: string | boolean) => void;
  parentOptions: { id: string; name: string }[];
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <FormRow label="Name *">
        <TextInput value={values.name} onChange={(e) => onChange('name', e.target.value)} required />
      </FormRow>
      <FormRow label="Description">
        <TextInput value={values.description} onChange={(e) => onChange('description', e.target.value)} />
      </FormRow>
      <FormRow label="Parent category">
        <select
          value={values.parent_id}
          onChange={(e) => onChange('parent_id', e.target.value)}
          style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
        >
          <option value="">— None (top level) —</option>
          {parentOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </FormRow>
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
    </div>
  );
}

/** Streamlit parity: category catalog with hierarchy, filters and add/edit modal. */
export function CategoriesListPage() {
  const { data = [], isLoading, error, refetch } = useListInventoryCategoriesQuery({ active_only: false });
  const [createCategory, createState] = useCreateInventoryCategoryMutation();
  const [updateCategory, updateState] = useUpdateInventoryCategoryMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_CATEGORY_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_CATEGORY_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<CategoryFormValues>(emptyCategoryForm());
  const [formError, setFormError] = useState('');

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
      if (!matchesRegex(row.name, filters.name)) return false;
      if (filters.active_only === 'yes' && row.is_active === false) return false;
      if (filters.active_only === 'no' && row.is_active !== false) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  const parentOptions = useMemo(
    () =>
      data
        .filter((row) => String(row.id) !== editId)
        .map((row) => ({ id: String(row.id), name: String(row.name || row.id) })),
    [data, editId],
  );

  type CategoryRow = (typeof data)[number];

  function setField(name: keyof CategoryFormValues, value: string | boolean) {
    setValues((p) => ({ ...p, [name]: value }));
  }

  function openAdd() {
    setFormError('');
    setValues(emptyCategoryForm());
    setEditId(null);
    setDialog('add');
  }

  function openEdit(row: CategoryRow) {
    setFormError('');
    setEditId(String(row.id));
    setValues(categoryToForm(row));
    setDialog('edit');
  }

  async function submitForm() {
    setFormError('');
    if (!values.name.trim()) {
      setFormError('Name is required');
      return;
    }
    try {
      if (dialog === 'add') {
        await createCategory(categoryBody(values)).unwrap();
      } else if (dialog === 'edit' && editId) {
        await updateCategory({ id: editId, body: categoryBody(values) }).unwrap();
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
          const path = Array.isArray(row.path) ? (row.path as string[]) : [];
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{name}</span>
                <span className="el-customer-sub">
                  {path.length > 1 ? path.join(' › ') : 'Top level'}
                </span>
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

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Categories"
        count={`${filtered.length} ${filtered.length === 1 ? 'category' : 'categories'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add Category
          </Button>
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
          actions={(row) => <EntityListActions onEdit={() => openEdit(row)} />}
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
        footer={
          <>
            <Button
              type="button"
              onClick={() => void submitForm()}
              disabled={createState.isLoading || updateState.isLoading}
            >
              {dialog === 'edit' ? 'Save Changes' : 'Create Category'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <CategoryFormFields values={values} onChange={setField} parentOptions={parentOptions} />
      </Modal>
    </EntityListPage>
  );
}
