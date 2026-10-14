import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCreateBatchMutation,
  useGetWorkingLocationQuery,
  useListBatchesQuery,
  useListInventoryLocationsQuery,
  useListInventoryStockQuery,
  useListRecipesQuery,
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
  FormRow,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  SearchableSelect,
  StatusPill,
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
import { BATCH_STATUSES, batchStatusTone, isoToday } from '../status';
import { asCaption, extractError, formatMoney } from '../utils';

export { ProductionBatchDetailPage } from './BatchDetailPage';

const DEFAULT_FILTERS = { batch_number: '', recipe_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'batch_date', desc: true }];
const FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'batch_number', label: 'Batch #', type: 'text' },
  { key: 'recipe_name', label: 'Recipe', type: 'text' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: BATCH_STATUSES.map((value) => ({ value, label: value })),
  },
];

export function ProductionBatchesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch, isFetching } = useListBatchesQuery();
  const { data: recipes = [] } = useListRecipesQuery({ active_only: true });
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: workingLoc } = useGetWorkingLocationQuery();
  const { data: stockRows = [] } = useListInventoryStockQuery();
  const [createBatch, createState] = useCreateBatchMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [quick, setQuick] = useState('');
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [planned, setPlanned] = useState('1');
  const [batchDate, setBatchDate] = useState(isoToday());
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');

  const workingLocationId = String(workingLoc?.working_location_id || '').trim();

  const filtered = useMemo(() => {
    const today = isoToday();
    const rows = data.filter((row) => {
      if (search.trim()) {
        const hay = `${row.batch_number || ''} ${row.recipe_name || ''}`.toLowerCase();
        if (!hay.includes(search.trim().toLowerCase())) return false;
      }
      if (!matchesRegex(row.batch_number, filters.batch_number)) return false;
      if (!matchesRegex(row.recipe_name, filters.recipe_name)) return false;
      if (filters.status && String(row.status || '') !== filters.status) return false;
      if (quick === 'today' && String(row.batch_date || '').slice(0, 10) !== today) return false;
      if (
        quick === 'open' &&
        !['Draft', 'In Progress'].includes(String(row.status || ''))
      ) {
        return false;
      }
      if (quick === 'ready' && String(row.status || '') !== 'In Progress') return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort, search, quick]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);
  type BatchRow = (typeof data)[number];

  const columns: EntityListColumn<BatchRow>[] = useMemo(
    () => [
      {
        id: 'batch_number',
        header: 'Batch',
        render: (row) => (
          <span className="el-doc-link">{displayName(row, ['batch_number'], 'Unnamed')}</span>
        ),
      },
      {
        id: 'recipe_name',
        header: 'Recipe',
        render: (row) => asCaption(row.recipe_name) || '—',
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => (
          <StatusPill status={asCaption(row.status) || '—'} tone={batchStatusTone(String(row.status || ''))} />
        ),
      },
      {
        id: 'batch_date',
        header: 'Date',
        render: (row) => String(row.batch_date || '').slice(0, 10) || '—',
      },
      {
        id: 'total_cost',
        header: 'Cost',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.total_cost ?? 0)),
      },
      {
        id: 'batch_margin',
        header: 'Margin',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.batch_margin ?? 0)),
      },
    ],
    [],
  );

  const recipeOptions = useMemo(
    () => recipes.map((r) => ({ value: String(r.id), label: String(r.name || r.id) })),
    [recipes],
  );
  const locationOptions = useMemo(
    () => locations.map((l) => ({ value: String(l.id), label: String(l.name || l.id) })),
    [locations],
  );

  const selectedRecipe = recipes.find((r) => String(r.id) === recipeId);
  const materialPreview = useMemo(() => {
    if (!selectedRecipe) return [];
    const scale = (Number(planned) || 1) / (Number(selectedRecipe.base_quantity) || 1);
    const inputs = Array.isArray(selectedRecipe.inputs)
      ? (selectedRecipe.inputs as Record<string, unknown>[])
      : [];
    return inputs.map((line) => {
      const qty =
        Number(line.qty || 0) *
        scale *
        (1 + Math.max(0, Number(line.scrap_pct || 0)) / 100);
      const productId = String(line.product_id || '');
      const available = (stockRows as Record<string, unknown>[])
        .filter((s) => String(s.product_id || '') === productId)
        .reduce((sum, s) => sum + Number(s.qty ?? s.quantity ?? s.balance ?? 0), 0);
      return {
        name: String(line.product_name || productId),
        qty: Math.round(qty * 10000) / 10000,
        available,
        short: available + 0.001 < qty,
      };
    });
  }, [selectedRecipe, planned, stockRows]);

  function openCreate() {
    setFormError('');
    setRecipeId('');
    setLocationId(workingLocationId || String(locations[0]?.id || ''));
    setPlanned('1');
    setBatchDate(isoToday());
    setBatchNumber('');
    setNotes('');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    if (!recipeId || !locationId) {
      setFormError('Recipe and location are required');
      return;
    }
    try {
      const created = await createBatch({
        recipe_id: recipeId,
        location_id: locationId,
        planned_quantity: Number(planned) || 1,
        batch_date: batchDate || isoToday(),
        batch_number: batchNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();
      setOpen(false);
      navigate(`/production/batches/${String(created.id)}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage className="el-page--production">
      <EntityListHero
        kicker="Production"
        title="Batches"
        count={`${filtered.length} batch${filtered.length === 1 ? '' : 'es'}`}
        search={
          <input
            className="vb-control"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search batches…"
          />
        }
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button type="button" onClick={openCreate}>
              New batch
            </Button>
          </>
        }
        chips={
          <EntityListQuickFilters
            value={quick}
            onChange={(value) => {
              setQuick(value);
              setPage(1);
            }}
            options={[
              { id: '', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'open', label: 'Open' },
              { id: 'ready', label: 'Ready to post' },
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
              { value: 'batch_date', label: 'Date' },
              { value: 'batch_number', label: 'Batch #' },
              { value: 'total_cost', label: 'Cost' },
              { value: 'status', label: 'Status' },
            ]}
            onSortChange={setSort}
          />
        }
      />

      {isFetching && !isLoading ? <EntityListRefreshing /> : null}
      {isLoading ? <EntityListLoading>Loading batches…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load batches.</ErrorText> : null}

      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No batches found.</strong>
          <p>Start a batch from an active recipe to issue materials and receive finished goods.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="button" onClick={openCreate}>
              New batch
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/production/recipes')}>
              Create recipe
            </Button>
          </div>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/production/batches/${String(row.id)}`)}
          onNew={openCreate}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/production/batches/${String(row.id)}`)}
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
        title="New batch"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onCreate()} disabled={createState.isLoading}>
              {createState.isLoading ? 'Creating…' : 'Create batch'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Recipe *">
            <SearchableSelect
              options={recipeOptions}
              value={recipeId}
              onChange={setRecipeId}
              placeholder="Select recipe…"
            />
          </FormRow>
          <FormRow label="Location *">
            <SearchableSelect
              options={locationOptions}
              value={locationId}
              onChange={setLocationId}
              placeholder="Select location…"
            />
          </FormRow>
          <FormRow label="Planned qty">
            <TextInput value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </FormRow>
          <FormRow label="Batch date">
            <TextInput type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
          </FormRow>
          <FormRow label="Batch number">
            <TextInput
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="Auto if blank"
            />
          </FormRow>
          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          {materialPreview.length ? (
            <div>
              <strong>Material preview</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {materialPreview.map((line) => (
                  <li key={line.name} style={{ color: line.short ? 'var(--vb-color-danger, #b42318)' : undefined }}>
                    {line.name}: {line.qty} (stock {line.available}
                    {line.short ? ' — short' : ''})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>
    </EntityListPage>
  );
}
