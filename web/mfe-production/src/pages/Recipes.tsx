import { useMemo, useState } from 'react';
import {
  useDeleteRecipeMutation,
  useListRecipesQuery,
  useUpdateRecipeMutation,
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
  EntityListRefreshing,
  EntityListTable,
  ErrorText,
  PAGE_SIZE,
  PaginationBar,
  StatusPill,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { ConfirmModal } from '../components/ConfirmModal';
import { RecipeEditorModal } from '../components/RecipeEditorModal';
import { recipeActiveTone } from '../status';
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
  const { data = [], isLoading, error, refetch, isFetching } = useListRecipesQuery();
  const [updateRecipe] = useUpdateRecipeMutation();
  const [deleteRecipe, deleteState] = useDeleteRecipeMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [actionError, setActionError] = useState('');

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (search.trim()) {
        const hay = `${row.name || ''} ${row.code || ''}`.toLowerCase();
        if (!hay.includes(search.trim().toLowerCase())) return false;
      }
      if (!matchesRegex(row.name, filters.name)) return false;
      if (!matchesRegex(row.code, filters.code)) return false;
      if (filters.active === 'yes' && row.is_active === false) return false;
      if (filters.active === 'no' && row.is_active !== false) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort, search]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);
  type RecipeRow = (typeof data)[number];

  const columns: EntityListColumn<RecipeRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Recipe',
        render: (row) => <span className="el-doc-link">{displayName(row, ['name'], 'Unnamed')}</span>,
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
        id: 'lines',
        header: 'BOM',
        render: (row) => {
          const inputs = Array.isArray(row.inputs) ? row.inputs.length : 0;
          const outputs = Array.isArray(row.outputs) ? row.outputs.length : 0;
          return `${inputs} in · ${outputs} out`;
        },
      },
      {
        id: 'active',
        header: 'Status',
        render: (row) => (
          <StatusPill
            status={row.is_active === false ? 'Inactive' : 'Active'}
            tone={recipeActiveTone(row.is_active !== false)}
          />
        ),
      },
    ],
    [],
  );

  async function toggleActive(row: RecipeRow) {
    setActionError('');
    try {
      await updateRecipe({
        id: String(row.id),
        body: { is_active: row.is_active === false },
      }).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  async function onDelete() {
    if (!deleteTarget?.id) return;
    setActionError('');
    try {
      await deleteRecipe(String(deleteTarget.id)).unwrap();
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  function openDuplicate(row: RecipeRow) {
    setEditing({
      ...row,
      id: undefined,
      name: `${asCaption(row.name)} (copy)`,
      code: '',
    });
    setOpen(true);
  }

  return (
    <EntityListPage className="el-page--production">
      <EntityListHero
        kicker="Production"
        title="Recipes"
        count={`${filtered.length} recipe${filtered.length === 1 ? '' : 's'}`}
        search={
          <input
            className="vb-control"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search recipes…"
          />
        }
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              New recipe
            </Button>
          </>
        }
        chips={
          <EntityListQuickFilters
            value={filters.active}
            onChange={(value) => {
              setFilters((f) => ({ ...f, active: value }));
              setPage(1);
            }}
            options={[
              { id: '', label: 'All' },
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
            onFiltersChange={(next) => {
              setFilters(next as typeof DEFAULT_FILTERS);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'name', label: 'Name' },
              { value: 'code', label: 'Code' },
              { value: 'base_quantity', label: 'Base qty' },
            ]}
            onSortChange={setSort}
          />
        }
      />

      {isFetching && !isLoading ? <EntityListRefreshing /> : null}
      {isLoading ? <EntityListLoading>Loading recipes…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load recipes.</ErrorText> : null}
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}

      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No recipes yet.</strong>
          <p>Recipes are your formula (BOM). Start with one finished good.</p>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Create recipe
          </Button>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => {
            setEditing(row);
            setOpen(true);
          }}
          onNew={() => {
            setEditing(null);
            setOpen(true);
          }}
          actions={(row) => (
            <div className="el-actions">
              <EntityListActions
                onOpen={() => {
                  setEditing(row);
                  setOpen(true);
                }}
                onEdit={() => {
                  setEditing(row);
                  setOpen(true);
                }}
                onDelete={() => setDeleteTarget(row)}
                primary={{
                  label: row.is_active === false ? 'Activate' : 'Deactivate',
                  onClick: () => void toggleActive(row),
                }}
              />
              <button type="button" className="el-action-btn" onClick={() => openDuplicate(row)}>
                Duplicate
              </button>
            </div>
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

      <RecipeEditorModal
        open={open}
        recipe={editing}
        onClose={() => setOpen(false)}
        onSaved={() => refetch()}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete recipe?"
        danger
        busy={deleteState.isLoading}
        confirmLabel="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
      >
        <p style={{ margin: 0 }}>
          Delete <strong>{asCaption(deleteTarget?.name)}</strong>? Recipes used by batches cannot be
          deleted.
        </p>
      </ConfirmModal>
    </EntityListPage>
  );
}
