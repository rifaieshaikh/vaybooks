import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  useListInventoryLocationsQuery,
  useListRecipesQuery,
  useProductionCostTrendQuery,
  useProductionDayBookQuery,
  useProductionMaterialVarianceQuery,
  useProductionMarginsQuery,
  useProductionProductProfitabilityQuery,
  useProductionProfitabilitySummaryQuery,
  useProductionRecipeScorecardsQuery,
  useProductionRmConsumptionQuery,
  useProductionWipAgingQuery,
  useProductionYieldQuery,
} from '@vaybooks/store';
import {
  Button,
  DataTable,
  EntityListEmpty,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  ErrorText,
  FormRow,
  SearchableSelect,
  TextInput,
} from '@vaybooks/ui-kit';
import { periodRange } from '../status';
import { formatMoney } from '../utils';

type TabId =
  | 'recipes'
  | 'margins'
  | 'yield'
  | 'material'
  | 'products'
  | 'trend'
  | 'rm'
  | 'wip'
  | 'daybook';

function money(value: unknown) {
  return formatMoney(Number(value ?? 0));
}

function mapRows(
  rows: Record<string, unknown>[] | undefined,
  map: (row: Record<string, unknown>) => Record<string, unknown>,
) {
  return (rows || []).map(map);
}

export function ProductionProfitabilityPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [tab, setTab] = useState<TabId>('recipes');

  const { data: recipes = [] } = useListRecipesQuery({ active_only: false });
  const { data: locations = [] } = useListInventoryLocationsQuery();

  const filters = useMemo(() => {
    const range = periodRange(preset, customStart, customEnd);
    return {
      ...range,
      recipe_id: recipeId || undefined,
      location_id: locationId || undefined,
    };
  }, [preset, customStart, customEnd, recipeId, locationId]);

  const dayBookArgs = useMemo(
    () => ({
      start_date: filters.start_date,
      end_date: filters.end_date,
    }),
    [filters.start_date, filters.end_date],
  );

  const summaryQ = useProductionProfitabilitySummaryQuery(filters);
  const recipesQ = useProductionRecipeScorecardsQuery(filters);
  const marginsQ = useProductionMarginsQuery(filters);
  const yieldQ = useProductionYieldQuery(filters);
  const materialQ = useProductionMaterialVarianceQuery(filters);
  const productsQ = useProductionProductProfitabilityQuery(filters);
  const trendQ = useProductionCostTrendQuery(filters);
  const rmQ = useProductionRmConsumptionQuery(filters);
  const wipQ = useProductionWipAgingQuery(filters);
  const dayBookQ = useProductionDayBookQuery(dayBookArgs);

  const summary = summaryQ.data || {};
  const loading = summaryQ.isLoading;

  const recipeOptions = useMemo(
    () => [
      { value: '', label: 'All recipes' },
      ...recipes.map((r) => ({ value: String(r.id), label: String(r.name || r.id) })),
    ],
    [recipes],
  );
  const locationOptions = useMemo(
    () => [
      { value: '', label: 'All locations' },
      ...locations.map((l) => ({ value: String(l.id), label: String(l.name || l.id) })),
    ],
    [locations],
  );

  const recipeRows = mapRows(recipesQ.data, (row) => ({
    recipe_id: row.recipe_id,
    recipe: row.recipe,
    batches: row.batch_count,
    margin: money(row.margin),
    margin_pct: row.margin_pct,
    avg_yield_var_pct: row.avg_yield_variance_pct,
    avg_cpu: money(row.avg_cost_per_unit),
  }));
  const marginRows = mapRows(marginsQ.data, (row) => ({
    date: String(row.date || '').slice(0, 10),
    batch: row.batch_number,
    recipe: row.recipe,
    cost: money(row.total_cost),
    expected_sales: money(row.expected_sales_value),
    margin: money(row.margin),
    margin_pct: row.margin_pct,
  }));
  const yieldRows = mapRows(yieldQ.data, (row) => ({
    date: String(row.date || '').slice(0, 10),
    batch: row.batch_number,
    output: row.output,
    expected: row.expected_qty,
    actual: row.actual_qty,
    variance: row.variance,
    variance_pct: row.variance_pct,
  }));
  const materialRows = mapRows(materialQ.data, (row) => ({
    date: String(row.date || '').slice(0, 10),
    batch: row.batch_number,
    recipe: row.recipe,
    product: row.product,
    expected: row.expected_qty,
    actual: row.actual_qty,
    variance: row.variance,
    variance_pct: row.variance_pct,
  }));
  const productRows = mapRows(productsQ.data, (row) => ({
    product: row.product,
    qty_produced: row.qty_produced,
    qty_sold: row.qty_sold,
    production_cost: money(row.production_cost),
    expected_sales: money(row.expected_sales_value),
    sales_value: money(row.sales_value),
    margin: money(row.margin),
    margin_pct: row.margin_pct,
    cost_per_unit: money(row.cost_per_unit),
  }));
  const trendRows = mapRows(trendQ.data, (row) => ({
    date: String(row.date || '').slice(0, 10),
    batch: row.batch_number,
    product: row.product,
    quantity: row.quantity,
    cost_per_unit: money(row.cost_per_unit),
  }));
  const rmRows = mapRows(rmQ.data, (row) => ({
    product: row.product,
    quantity: row.quantity,
    total_cost: money(row.total_cost),
  }));
  const wipRows = mapRows(wipQ.data, (row) => ({
    date: String(row.date || '').slice(0, 10),
    batch: row.batch_number,
    recipe: row.recipe,
    status: row.status,
    wip_value: money(row.wip_value),
    age_days: row.age_days,
  }));
  const dayBookRows = mapRows(dayBookQ.data, (row) => ({
    date: String(row.date || '').slice(0, 10),
    type: row.type,
    number: row.number,
    description: row.description,
    status: row.status,
    debit: money(row.debit),
    credit: money(row.credit),
  }));

  function empty(label: string) {
    return (
      <EntityListEmpty>
        <strong>{label}</strong>
        <p>
          Adjust period/filters or <Link to="/production/batches">open batches</Link>.
        </p>
      </EntityListEmpty>
    );
  }

  return (
    <EntityListPage className="el-page--production">
      <EntityListHero
        kicker="Production"
        title="Profitability"
        count="Margin, yield, material variance, recipe scorecards, and sales vs cost"
        actions={
          <Button type="button" variant="ghost" onClick={() => summaryQ.refetch()}>
            Refresh
          </Button>
        }
        chips={
          <div className="el-seg" role="group" aria-label="Period">
            {(
              [
                ['today', 'Today'],
                ['week', 'Week'],
                ['month', 'Month'],
                ['custom', 'Custom'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={preset === id}
                onClick={() => setPreset(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
        summary={
          <div className="el-pulse" aria-label="Profitability KPIs">
            <div>
              <span>Posted batches</span>
              <strong>{Number(summary.posted_count ?? 0)}</strong>
            </div>
            <div>
              <span>Expected sales</span>
              <strong>{money(summary.expected_sales_value)}</strong>
            </div>
            <div>
              <span>Total cost</span>
              <strong>{money(summary.total_cost)}</strong>
            </div>
            <div>
              <span>Margin</span>
              <strong>
                {money(summary.margin)} ({Number(summary.margin_pct ?? 0)}%)
              </strong>
            </div>
            <div>
              <span>WIP</span>
              <strong>{money(summary.wip_value)}</strong>
            </div>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {preset === 'custom' ? (
          <>
            <FormRow label="From">
              <TextInput type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </FormRow>
            <FormRow label="To">
              <TextInput type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </FormRow>
          </>
        ) : null}
        <FormRow label="Recipe">
          <SearchableSelect options={recipeOptions} value={recipeId} onChange={setRecipeId} />
        </FormRow>
        <FormRow label="Location">
          <SearchableSelect options={locationOptions} value={locationId} onChange={setLocationId} />
        </FormRow>
      </div>

      <div className="el-seg" role="tablist" aria-label="Profitability views" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(
          [
            ['recipes', 'Recipe scorecards'],
            ['margins', 'Margins'],
            ['yield', 'Yield'],
            ['material', 'Material variance'],
            ['products', 'Products'],
            ['trend', 'Cost/unit trend'],
            ['rm', 'RM consumption'],
            ['wip', 'WIP aging'],
            ['daybook', 'Day book'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <EntityListLoading>Loading profitability…</EntityListLoading> : null}
      {summaryQ.error ? <ErrorText>Failed to load profitability summary.</ErrorText> : null}

      {!loading && tab === 'recipes'
        ? recipeRows.length
          ? (
            <DataTable
              columns={[
                { key: 'recipe', header: 'Recipe' },
                { key: 'batches', header: 'Batches' },
                { key: 'margin', header: 'Margin' },
                { key: 'margin_pct', header: 'Margin %' },
                { key: 'avg_yield_var_pct', header: 'Avg yield var %' },
                { key: 'avg_cpu', header: 'Avg cost/unit' },
              ]}
              data={recipeRows}
              rowKey={(row) => String(row.recipe_id || row.recipe)}
              onRowClick={(row) => {
                const id = String(row.recipe_id || '');
                if (id) setRecipeId(id);
                setTab('margins');
              }}
            />
          )
          : empty('No posted batches in this period.')
        : null}

      {!loading && tab === 'margins'
        ? marginRows.length
          ? (
            <DataTable
              columns={[
                { key: 'date', header: 'Date' },
                { key: 'batch', header: 'Batch' },
                { key: 'recipe', header: 'Recipe' },
                { key: 'cost', header: 'Cost' },
                { key: 'expected_sales', header: 'Expected sales' },
                { key: 'margin', header: 'Margin' },
                { key: 'margin_pct', header: 'Margin %' },
              ]}
              data={marginRows}
              rowKey={(row) => `${row.batch}-${row.date}`}
              onRowClick={() => navigate('/production/batches')}
            />
          )
          : empty('No margin rows.')
        : null}

      {!loading && tab === 'yield'
        ? yieldRows.length
          ? (
            <DataTable
              columns={[
                { key: 'date', header: 'Date' },
                { key: 'batch', header: 'Batch' },
                { key: 'output', header: 'Output' },
                { key: 'expected', header: 'Expected' },
                { key: 'actual', header: 'Actual' },
                { key: 'variance', header: 'Variance' },
                { key: 'variance_pct', header: 'Variance %' },
              ]}
              data={yieldRows}
              rowKey={(row) => `${row.batch}-${row.output}-${row.expected}-${row.actual}`}
            />
          )
          : empty('No yield rows.')
        : null}

      {!loading && tab === 'material'
        ? materialRows.length
          ? (
            <DataTable
              columns={[
                { key: 'date', header: 'Date' },
                { key: 'batch', header: 'Batch' },
                { key: 'recipe', header: 'Recipe' },
                { key: 'product', header: 'Material' },
                { key: 'expected', header: 'Expected' },
                { key: 'actual', header: 'Actual' },
                { key: 'variance', header: 'Variance' },
                { key: 'variance_pct', header: 'Variance %' },
              ]}
              data={materialRows}
              rowKey={(row) => `${row.batch}-${row.product}-${row.expected}-${row.actual}`}
            />
          )
          : empty('No material variance rows.')
        : null}

      {!loading && tab === 'products'
        ? productRows.length
          ? (
            <DataTable
              columns={[
                { key: 'product', header: 'Product' },
                { key: 'qty_produced', header: 'Qty produced' },
                { key: 'qty_sold', header: 'Qty sold' },
                { key: 'production_cost', header: 'Production cost' },
                { key: 'expected_sales', header: 'Expected sales' },
                { key: 'sales_value', header: 'Sales value' },
                { key: 'margin', header: 'Margin' },
                { key: 'margin_pct', header: 'Margin %' },
                { key: 'cost_per_unit', header: 'Cost/unit' },
              ]}
              data={productRows}
              rowKey={(row) => String(row.product)}
            />
          )
          : empty('No product profitability rows.')
        : null}

      {!loading && tab === 'trend'
        ? trendRows.length
          ? (
            <DataTable
              columns={[
                { key: 'date', header: 'Date' },
                { key: 'batch', header: 'Batch' },
                { key: 'product', header: 'Product' },
                { key: 'quantity', header: 'Qty' },
                { key: 'cost_per_unit', header: 'Cost/unit' },
              ]}
              data={trendRows}
              rowKey={(row) => `${row.batch}-${row.product}-${row.date}`}
            />
          )
          : empty('No cost/unit trend rows.')
        : null}

      {!loading && tab === 'rm'
        ? rmRows.length
          ? (
            <DataTable
              columns={[
                { key: 'product', header: 'Material' },
                { key: 'quantity', header: 'Qty' },
                { key: 'total_cost', header: 'Cost' },
              ]}
              data={rmRows}
              rowKey={(row) => String(row.product)}
            />
          )
          : empty('No RM consumption rows.')
        : null}

      {!loading && tab === 'wip'
        ? wipRows.length
          ? (
            <DataTable
              columns={[
                { key: 'date', header: 'Date' },
                { key: 'batch', header: 'Batch' },
                { key: 'recipe', header: 'Recipe' },
                { key: 'status', header: 'Status' },
                { key: 'wip_value', header: 'WIP value' },
                { key: 'age_days', header: 'Age (days)' },
              ]}
              data={wipRows}
              rowKey={(row) => `${row.batch}-${row.date}`}
              onRowClick={() => navigate('/production/batches')}
            />
          )
          : empty('No open WIP batches.')
        : null}

      {!loading && tab === 'daybook'
        ? dayBookRows.length
          ? (
            <DataTable
              columns={[
                { key: 'date', header: 'Date' },
                { key: 'type', header: 'Type' },
                { key: 'number', header: 'Number' },
                { key: 'description', header: 'Description' },
                { key: 'status', header: 'Status' },
                { key: 'debit', header: 'Debit' },
                { key: 'credit', header: 'Credit' },
              ]}
              data={dayBookRows}
              rowKey={(row) => `${row.number}-${row.date}-${row.type}`}
            />
          )
          : empty('No day book rows.')
        : null}
    </EntityListPage>
  );
}

export function ProductionDayBookPage() {
  return <Navigate to="/production/profitability" replace />;
}

export function ProductionMarginsPage() {
  return <Navigate to="/production/profitability" replace />;
}

export function ProductionYieldPage() {
  return <Navigate to="/production/profitability" replace />;
}
