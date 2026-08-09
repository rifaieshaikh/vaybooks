import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAddBatchCostMutation,
  useCancelBatchMutation,
  useCompleteBatchMutation,
  useCompleteBatchStageMutation,
  useCreateBatchMutation,
  useGetBatchQuery,
  useListBatchesQuery,
  useListInventoryLocationsQuery,
  useListRecipesQuery,
  usePostBatchMutation,
  useRemoveBatchCostMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityCard,
  EntityCardGrid,
  ErrorText,
  FormRow,
  ListToolbar,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../utils';

const DEFAULT_FILTERS = { batch_number: '', recipe_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'batch_date', desc: true }];

export function ProductionBatchesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListBatchesQuery();
  const { data: recipes = [] } = useListRecipesQuery({ active_only: true });
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const [createBatch, createState] = useCreateBatchMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [planned, setPlanned] = useState('1');
  const [batchDate, setBatchDate] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'batch_number', label: 'Batch #', type: 'text' },
      { key: 'recipe_name', label: 'Recipe', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.batch_number, filters.batch_number)) return false;
      if (!matchesRegex(row.recipe_name, filters.recipe_name)) return false;
      if (!matchesRegex(row.status, filters.status)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

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
        batch_date: batchDate || undefined,
      }).unwrap();
      setOpen(false);
      refetch();
      navigate(`/production/batches/${String(created.id)}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <ListToolbar
        title="Production Batches"
        countLabel="batches"
        count={filtered.length}
        primaryLabel="New batch"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={filterFields}
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
          { value: 'batch_number', label: 'Number' },
          { value: 'status', label: 'Status' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load batches.</ErrorText> : null}
      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={asCaption(row.batch_number) || String(row.id)}
            captions={[
              asCaption(row.recipe_name),
              asCaption(row.status),
              String(row.batch_date || '').slice(0, 10),
              formatMoney(Number(row.total_cost ?? 0)),
            ]}
            onEdit={() => navigate(`/production/batches/${String(row.id)}`)}
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

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
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Recipe *">
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {recipes.map((r) => (
                <option key={String(r.id)} value={String(r.id)}>
                  {asCaption(r.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Location *">
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {locations.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {asCaption(l.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Planned qty">
            <TextInput value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </FormRow>
          <FormRow label="Batch date">
            <TextInput type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </div>
  );
}

export function ProductionBatchDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetBatchQuery(id, { skip: !id });
  const [completeBatch, completeState] = useCompleteBatchMutation();
  const [completeStage, completeStageState] = useCompleteBatchStageMutation();
  const [postBatch, postState] = usePostBatchMutation();
  const [cancelBatch, cancelState] = useCancelBatchMutation();
  const [addCost, addCostState] = useAddBatchCostMutation();
  const [removeCost, removeCostState] = useRemoveBatchCostMutation();
  const [actionError, setActionError] = useState('');
  const [costOpen, setCostOpen] = useState(false);
  const [costType, setCostType] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costDescription, setCostDescription] = useState('');

  async function run(action: 'complete' | 'post' | 'cancel') {
    setActionError('');
    try {
      if (action === 'complete') await completeBatch({ id }).unwrap();
      if (action === 'post') await postBatch({ id }).unwrap();
      if (action === 'cancel') await cancelBatch(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  async function onCompleteStage(stageId: string) {
    setActionError('');
    try {
      await completeStage({ batchId: id, stage_id: stageId }).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  async function onAddCost() {
    setActionError('');
    if (!costType.trim() || Number(costAmount) < 0 || !costAmount.trim()) {
      setActionError('Cost type and a valid amount are required');
      return;
    }
    try {
      await addCost({
        batchId: id,
        body: {
          cost_type: costType.trim(),
          amount: Number(costAmount),
          description: costDescription.trim() || undefined,
        },
      }).unwrap();
      setCostOpen(false);
      setCostType('');
      setCostAmount('');
      setCostDescription('');
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  async function onRemoveCost(costId: string) {
    setActionError('');
    try {
      await removeCost({ batchId: id, costId }).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) {
    return (
      <div>
        <ErrorText>Batch not found.</ErrorText>
        <Button type="button" variant="ghost" onClick={() => navigate('/production/batches')}>
          Back
        </Button>
      </div>
    );
  }

  const stages = Array.isArray(data.stages) ? (data.stages as Record<string, unknown>[]) : [];
  const costs = Array.isArray(data.costs) ? (data.costs as Record<string, unknown>[]) : [];
  const busy =
    completeState.isLoading ||
    completeStageState.isLoading ||
    postState.isLoading ||
    cancelState.isLoading ||
    addCostState.isLoading ||
    removeCostState.isLoading;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Link to="/production/batches" style={{ color: '#567' }}>
            ← Batches
          </Link>
          <h2 style={{ margin: '8px 0 0', color: 'var(--vb-color-primary, #185c4c)' }}>
            {asCaption(data.batch_number)}
          </h2>
          <p style={{ color: '#667', marginTop: 6 }}>
            {asCaption(data.recipe_name)} · {asCaption(data.status)} ·{' '}
            {String(data.batch_date || '').slice(0, 10)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" onClick={() => void run('complete')} disabled={busy}>
            Complete
          </Button>
          <Button type="button" onClick={() => void run('post')} disabled={busy}>
            Post
          </Button>
          <Button type="button" variant="ghost" onClick={() => void run('cancel')} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
        <div>Total cost: {formatMoney(Number(data.total_cost ?? 0))}</div>
        <div>Expected sales: {formatMoney(Number(data.expected_sales_value ?? 0))}</div>
        <div>Margin: {formatMoney(Number(data.batch_margin ?? 0))}</div>
      </div>
      <h3 style={{ marginTop: 28, color: 'var(--vb-color-primary, #185c4c)' }}>Stages</h3>
      {stages.length === 0 ? (
        <p style={{ color: '#667' }}>No stages on this batch.</p>
      ) : (
        <ul>
          {stages.map((s) => (
            <li key={String(s.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span>
                {asCaption(s.name)} — {s.completed ? 'Done' : 'Open'}
              </span>
              {!s.completed ? (
                <Button type="button" variant="ghost" onClick={() => void onCompleteStage(String(s.id))} disabled={busy}>
                  Complete stage
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 28 }}>
        <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Costs</h3>
        <Button type="button" variant="ghost" onClick={() => setCostOpen(true)} disabled={busy}>
          Add cost
        </Button>
      </div>
      {costs.length === 0 ? (
        <p style={{ color: '#667' }}>No additional costs recorded.</p>
      ) : (
        <ul>
          {costs.map((cost) => (
            <li key={String(cost.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span>
                {asCaption(cost.cost_type)} — {formatMoney(Number(cost.amount ?? 0))}
                {cost.description ? ` · ${asCaption(cost.description)}` : ''}
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onRemoveCost(String(cost.id))}
                disabled={busy}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={costOpen}
        title="Add batch cost"
        onClose={() => setCostOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCostOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onAddCost()} disabled={busy}>
              {addCostState.isLoading ? 'Saving…' : 'Add cost'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Cost type *">
            <TextInput value={costType} onChange={(e) => setCostType(e.target.value)} />
          </FormRow>
          <FormRow label="Amount *">
            <TextInput type="number" min="0" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} />
          </FormRow>
          <FormRow label="Description">
            <TextInput value={costDescription} onChange={(e) => setCostDescription(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </div>
  );
}
