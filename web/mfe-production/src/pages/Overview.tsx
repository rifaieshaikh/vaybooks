import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useGetProductionSettingsQuery,
  useListBatchesQuery,
  useListInventoryStockQuery,
  useListRecipesQuery,
  useProductionOverviewQuery,
  useProductionYieldQuery,
} from '@vaybooks/store';
import {
  Button,
  EntityCard,
  EntityCardGrid,
  EntityListEmpty,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListRefreshing,
  ErrorText,
  StatusBanner,
  StatusPill,
} from '@vaybooks/ui-kit';
import { batchStatusTone, isoToday, settingsIncomplete } from '../status';
import { asCaption, formatMoney } from '../utils';

export function ProductionOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch, isFetching } = useProductionOverviewQuery();
  const { data: batches = [] } = useListBatchesQuery();
  const { data: settings } = useGetProductionSettingsQuery();
  const { data: recipes = [] } = useListRecipesQuery({ active_only: false });
  const { data: stockRows = [] } = useListInventoryStockQuery();
  const { data: yieldRows = [] } = useProductionYieldQuery();

  const missing = settingsIncomplete(settings as Record<string, unknown> | undefined);
  const today = isoToday();

  const openBatches = useMemo(
    () =>
      batches.filter((b) => ['Draft', 'In Progress'].includes(String(b.status || ''))),
    [batches],
  );
  const readyToPost = useMemo(
    () => batches.filter((b) => String(b.status || '') === 'In Progress'),
    [batches],
  );
  const recent = useMemo(
    () =>
      [...batches]
        .sort((a, b) => String(b.batch_date || '').localeCompare(String(a.batch_date || '')))
        .slice(0, 10),
    [batches],
  );

  const attention = useMemo(() => {
    const cards: { title: string; body: string; to: string }[] = [];
    if (missing.length) {
      cards.push({
        title: 'Settings incomplete',
        body: `Map ${missing.join(', ')} before posting.`,
        to: '/production/settings',
      });
    }
    const stale = openBatches.filter((b) => {
      const date = String(b.batch_date || '').slice(0, 10);
      if (!date) return false;
      const age = (Date.parse(today) - Date.parse(date)) / 86400000;
      return age >= 7;
    });
    if (stale.length) {
      cards.push({
        title: 'Stale open batches',
        body: `${stale.length} open batch(es) older than 7 days.`,
        to: '/production/batches',
      });
    }
    const agingWip = openBatches.filter((b) => {
      const date = String(b.batch_date || '').slice(0, 10);
      if (!date) return false;
      const age = (Date.parse(today) - Date.parse(date)) / 86400000;
      return age >= 3 && Number(b.total_cost ?? 0) > 0;
    });
    if (agingWip.length) {
      cards.push({
        title: 'WIP aging',
        body: `${agingWip.length} open batch(es) with WIP cost older than 3 days.`,
        to: '/production/profitability',
      });
    }
    if (readyToPost.length) {
      cards.push({
        title: 'Ready to post',
        body: `${readyToPost.length} in-progress batch(es) waiting to update stock & books.`,
        to: '/production/batches',
      });
    }
    const negative = batches.filter(
      (b) => String(b.status || '') === 'Posted' && Number(b.batch_margin ?? 0) < 0,
    );
    if (negative.length) {
      cards.push({
        title: 'Negative margin',
        body: `${negative.length} posted batch(es) with negative expected margin.`,
        to: '/production/profitability',
      });
    }
    const badYield = (yieldRows as Record<string, unknown>[]).filter(
      (row) => Number(row.variance_pct ?? 0) <= -10,
    );
    if (badYield.length) {
      cards.push({
        title: 'Yield below target',
        body: `${badYield.length} output line(s) at least 10% under recipe yield.`,
        to: '/production/profitability',
      });
    }

    // RM shortage: open batch issues vs stock
    const stockMap = new Map<string, number>();
    for (const row of stockRows as Record<string, unknown>[]) {
      const pid = String(row.product_id || '');
      stockMap.set(pid, (stockMap.get(pid) || 0) + Number(row.qty ?? row.quantity ?? row.balance ?? 0));
    }
    let shortageCount = 0;
    for (const batch of openBatches) {
      const issues = Array.isArray(batch.issues) ? (batch.issues as Record<string, unknown>[]) : [];
      for (const issue of issues) {
        const pid = String(issue.product_id || '');
        const need = Number(issue.qty ?? 0);
        const available = stockMap.get(pid) || 0;
        if (pid && available + 0.001 < need) shortageCount += 1;
      }
      // If issues not on list payload, estimate from recipe
      if (!issues.length && batch.recipe_id) {
        const recipe = recipes.find((r) => String(r.id) === String(batch.recipe_id));
        if (recipe) {
          const scale =
            (Number(batch.planned_quantity) || 1) / (Number(recipe.base_quantity) || 1);
          const inputs = Array.isArray(recipe.inputs)
            ? (recipe.inputs as Record<string, unknown>[])
            : [];
          for (const line of inputs) {
            const pid = String(line.product_id || '');
            const need =
              Number(line.qty || 0) *
              scale *
              (1 + Math.max(0, Number(line.scrap_pct || 0)) / 100);
            const available = stockMap.get(pid) || 0;
            if (pid && available + 0.001 < need) shortageCount += 1;
          }
        }
      }
    }
    if (shortageCount) {
      cards.push({
        title: 'RM shortage',
        body: `${shortageCount} material line(s) on open batches exceed available stock.`,
        to: '/production/batches',
      });
    }

    return cards;
  }, [missing, openBatches, readyToPost, batches, today, yieldRows, stockRows, recipes]);

  const empty = !isLoading && !error && batches.length === 0;

  return (
    <EntityListPage className="el-page--production">
      <EntityListHero
        kicker="Production"
        title="Overview"
        count="Run batches and watch profitability"
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/production/recipes')}>
              New recipe
            </Button>
            <Button type="button" onClick={() => navigate('/production/batches')}>
              New batch
            </Button>
          </>
        }
        summary={
          <div className="el-pulse" aria-label="Production KPIs">
            <div>
              <span>Open</span>
              <strong>{openBatches.length}</strong>
            </div>
            <div>
              <span>Ready to post</span>
              <strong>{readyToPost.length}</strong>
            </div>
            <div>
              <span>WIP</span>
              <strong>{formatMoney(Number(data?.wip_value ?? 0))}</strong>
            </div>
            <div>
              <span>Posted margin</span>
              <strong>{formatMoney(Number(data?.margin ?? 0))}</strong>
            </div>
          </div>
        }
      />

      {isFetching && !isLoading ? <EntityListRefreshing /> : null}
      {isLoading ? <EntityListLoading>Loading overview…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load production overview.</ErrorText> : null}

      {missing.length ? (
        <StatusBanner>
          Production settings incomplete ({missing.join(', ')}).{' '}
          <Link to="/production/settings">Fix settings</Link>
        </StatusBanner>
      ) : null}

      {empty ? (
        <EntityListEmpty>
          <strong>Start production</strong>
          <p>Create a recipe, then run your first batch to issue materials and receive finished goods.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="button" onClick={() => navigate('/production/recipes')}>
              Create recipe
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/production/batches')}>
              Start batch
            </Button>
          </div>
        </EntityListEmpty>
      ) : null}

      {!empty && attention.length ? (
        <>
          <h3 style={{ margin: '1rem 0 0.5rem' }}>Needs attention</h3>
          <EntityCardGrid>
            {attention.map((card) => (
              <EntityCard
                key={card.title}
                title={card.title}
                captions={[card.body]}
                onView={() => navigate(card.to)}
              />
            ))}
          </EntityCardGrid>
        </>
      ) : null}

      {!empty ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <h3 style={{ margin: 0 }}>Recent batches</h3>
            <Button type="button" variant="ghost" onClick={() => navigate('/production/profitability')}>
              Open profitability
            </Button>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {recent.map((batch) => (
              <button
                key={String(batch.id)}
                type="button"
                className="el-action-btn"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 0.9rem',
                  border: '1px solid var(--vb-color-line, #d5e3dc)',
                  borderRadius: 10,
                  background: 'var(--vb-color-surface, #fff)',
                }}
                onClick={() => navigate(`/production/batches/${String(batch.id)}`)}
              >
                <span>
                  <strong>{asCaption(batch.batch_number)}</strong> · {asCaption(batch.recipe_name)}
                </span>
                <StatusPill
                  status={asCaption(batch.status)}
                  tone={batchStatusTone(String(batch.status || ''))}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </EntityListPage>
  );
}
