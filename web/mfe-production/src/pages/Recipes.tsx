import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateRecipeMutation,
  useListInventoryProductsQuery,
  useListRecipesQuery,
} from '@vaybooks/store';
import {
  Button,
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

const DEFAULT_FILTERS = { name: '', code: '', active: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'name', desc: false }];
const FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'code', label: 'Code', type: 'text' },
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

export function ProductionRecipesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListRecipesQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const [createRecipe, createState] = useCreateRecipeMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [inputId, setInputId] = useState('');
  const [outputId, setOutputId] = useState('');

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.name, filters.name)) return false;
      if (!matchesRegex(row.code, filters.code)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type RecipeRow = (typeof data)[number];

  const columns: EntityListColumn<RecipeRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Recipe',
        render: (row) => displayName(row, ['name'], 'Unnamed'),
      },
      {
        id: 'code',
        header: 'Code',
        render: (row) => {
          const codeLabel = String(row.code || '').trim();
          return <span className={codeLabel ? undefined : 'el-muted'}>{codeLabel || '—'}</span>;
        },
      },
      {
        id: 'base_quantity',
        header: 'Base qty',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => Number(row.base_quantity ?? 1),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => (
          <span className={row.is_active === false ? 'el-muted' : 'el-advance'}>
            {row.is_active === false ? 'Inactive' : 'Active'}
          </span>
        ),
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setOpen(true);
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function onCreate() {
    setFormError('');
    if (!name.trim() || !inputId || !outputId) {
      setFormError('Name, input product, and output product are required');
      return;
    }
    try {
      await createRecipe({
        name: name.trim(),
        code: code.trim(),
        base_quantity: 1,
        inputs: [{ product_id: inputId, qty: 1 }],
        outputs: [{ product_id: outputId, expected_qty: 1, role: 'Main' }],
      }).unwrap();
      setOpen(false);
      setName('');
      setCode('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Production"
        title="Recipes"
        count={`${filtered.length} ${filtered.length === 1 ? 'recipe' : 'recipes'}`}
        actions={
          <Button type="button" onClick={openCreate}>
            New recipe
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
              { value: 'name', label: 'Name' },
              { value: 'code', label: 'Code' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading recipes…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load recipes.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No recipes found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onNew={openCreate}
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
        title="New recipe"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onCreate()} disabled={createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Code">
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
          </FormRow>
          <FormRow label="Input product *">
            <select
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {asCaption(p.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Output product *">
            <select
              value={outputId}
              onChange={(e) => setOutputId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {asCaption(p.name)}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}
