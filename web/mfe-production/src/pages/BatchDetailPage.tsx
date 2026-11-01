import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useAddBatchCostMutation,
  useCancelBatchMutation,
  useCompleteBatchMutation,
  useCompleteBatchStageMutation,
  useGetBatchQuery,
  useGetProductionSettingsQuery,
  useListFinanceAccountsQuery,
  useListInventoryLocationsQuery,
  useListInventoryStockQuery,
  useListProductionActivitiesQuery,
  usePostBatchMutation,
  useRemoveBatchCostMutation,
  useUnpostBatchMutation,
  useUpdateBatchMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailBanner,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityDetailTabs,
  ErrorText,
  FormRow,
  Modal,
  SearchableSelect,
  StatusPill,
  TextInput,
} from '@vaybooks/ui-kit';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  COST_TYPE_PRESETS,
  batchStatusTone,
  completeVsPostCopy,
  settingsIncomplete,
} from '../status';
import { asCaption, extractError, formatMoney } from '../utils';

type LineDraft = {
  id: string;
  product_name: string;
  qty: string;
  location_id: string;
  nrv_rate?: string;
  allocation_pct?: string;
  unit_cost?: number;
  allocated_cost?: number;
  role?: string;
};

export function ProductionBatchDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetBatchQuery(id, { skip: !id });
  const { data: settings } = useGetProductionSettingsQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const { data: activities = [] } = useListProductionActivitiesQuery({ active_only: true });
  const { data: stockRows = [] } = useListInventoryStockQuery();
  const [updateBatch, updateState] = useUpdateBatchMutation();
  const [completeBatch, completeState] = useCompleteBatchMutation();
  const [completeStage, completeStageState] = useCompleteBatchStageMutation();
  const [postBatch, postState] = usePostBatchMutation();
  const [unpostBatch, unpostState] = useUnpostBatchMutation();
  const [cancelBatch, cancelState] = useCancelBatchMutation();
  const [addCost, addCostState] = useAddBatchCostMutation();
  const [removeCost, removeCostState] = useRemoveBatchCostMutation();

  const [tab, setTab] = useState('activities');
  const [actionError, setActionError] = useState('');
  const [issues, setIssues] = useState<LineDraft[]>([]);
  const [outputs, setOutputs] = useState<LineDraft[]>([]);
  const [confirm, setConfirm] = useState<'post' | 'cancel' | 'unpost' | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [costType, setCostType] = useState('Labour');
  const [costAmount, setCostAmount] = useState('');
  const [costDescription, setCostDescription] = useState('');
  const [costActivity, setCostActivity] = useState('');
  const [costAccount, setCostAccount] = useState('');
  const [removeCostId, setRemoveCostId] = useState('');
  const [stageNotes, setStageNotes] = useState<Record<string, string>>({});
  const [completingStageId, setCompletingStageId] = useState('');

  useEffect(() => {
    if (!data) return;
    const issueRows = Array.isArray(data.issues) ? (data.issues as Record<string, unknown>[]) : [];
    const outputRows = Array.isArray(data.outputs) ? (data.outputs as Record<string, unknown>[]) : [];
    setIssues(
      issueRows.map((line) => ({
        id: String(line.id),
        product_name: String(line.product_name || line.product_id || ''),
        qty: String(line.qty ?? 0),
        location_id: String(line.location_id || data.location_id || ''),
        unit_cost: Number(line.unit_cost ?? 0),
      })),
    );
    setOutputs(
      outputRows.map((line) => ({
        id: String(line.id),
        product_name: String(line.product_name || line.product_id || ''),
        qty: String(line.qty ?? 0),
        location_id: String(line.location_id || data.location_id || ''),
        nrv_rate: String(line.nrv_rate ?? 0),
        allocation_pct: String(line.allocation_pct ?? 0),
        allocated_cost: Number(line.allocated_cost ?? 0),
        unit_cost: Number(line.unit_cost ?? 0),
        role: String(line.role || 'Main'),
      })),
    );
  }, [data]);

  const locationOptions = useMemo(
    () => locations.map((l) => ({ value: String(l.id), label: String(l.name || l.id) })),
    [locations],
  );
  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: String(a.id),
        label: String(a.account_name || a.name || a.id),
      })),
    [accounts],
  );
  const activityOptions = useMemo(
    () =>
      activities.map((a) => ({
        value: String(a.id),
        label: String(a.activity_name || a.name || a.id),
      })),
    [activities],
  );

  const status = String(data?.status || '');
  const editable = status === 'Draft' || status === 'In Progress';
  const missingSettings = settingsIncomplete(settings as Record<string, unknown> | undefined);

  const stockWarnings = useMemo(() => {
    if (!data) return [];
    const warnings: string[] = [];
    const stockMap = new Map<string, number>();
    for (const row of stockRows as Record<string, unknown>[]) {
      const key = `${row.product_id || ''}::${row.location_id || ''}`;
      stockMap.set(key, Number(row.qty ?? row.quantity ?? row.balance ?? 0));
    }
    const issueSource = Array.isArray(data.issues) ? (data.issues as Record<string, unknown>[]) : [];
    for (const draft of issues) {
      const source = issueSource.find((i) => String(i.id) === draft.id);
      const productId = String(source?.product_id || '');
      const key = `${productId}::${draft.location_id}`;
      const available = stockMap.has(key)
        ? Number(stockMap.get(key))
        : Array.from(stockMap.entries())
            .filter(([k]) => k.startsWith(`${productId}::`))
            .reduce((sum, [, qty]) => sum + qty, 0);
      const need = Number(draft.qty) || 0;
      if (productId && available + 0.001 < need) {
        warnings.push(
          `${draft.product_name || productId}: need ${need}, available ${available}`,
        );
      }
    }
    return warnings;
  }, [data, issues, stockRows]);

  const busy =
    updateState.isLoading ||
    completeState.isLoading ||
    completeStageState.isLoading ||
    postState.isLoading ||
    unpostState.isLoading ||
    cancelState.isLoading ||
    addCostState.isLoading ||
    removeCostState.isLoading;

  async function saveLines() {
    setActionError('');
    try {
      await updateBatch({
        id,
        body: {
          issues: issues.map((line) => ({
            id: line.id,
            qty: Number(line.qty) || 0,
            location_id: line.location_id,
          })),
          outputs: outputs.map((line) => ({
            id: line.id,
            qty: Number(line.qty) || 0,
            location_id: line.location_id,
            nrv_rate: Number(line.nrv_rate) || 0,
            allocation_pct: Number(line.allocation_pct) || 0,
          })),
        },
      }).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setActionError('');
    try {
      if (confirm === 'post') await postBatch({ id }).unwrap();
      if (confirm === 'cancel') await cancelBatch(id).unwrap();
      if (confirm === 'unpost') await unpostBatch(id).unwrap();
      setConfirm(null);
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/production/batches" label="Batches" />
        <ErrorText>Batch not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const stages = Array.isArray(data.stages) ? (data.stages as Record<string, unknown>[]) : [];
  const costs = Array.isArray(data.costs) ? (data.costs as Record<string, unknown>[]) : [];
  const posting = (data.posting as Record<string, unknown> | undefined) || {};

  return (
    <EntityDetailPage className="ed-page--production">
      <EntityDetailBack to="/production/batches" label="Batches" />
      <EntityDetailHero
        kicker="Production batch"
        title={asCaption(data.batch_number)}
        lead={
          <>
            <StatusPill status={status} tone={batchStatusTone(status)} />{' '}
            {asCaption(data.recipe_name)} · {String(data.batch_date || '').slice(0, 10)}
          </>
        }
      />
      <EntityDetailSnapshot
        items={[
          { label: 'Planned qty', value: String(data.planned_quantity ?? '—') },
          { label: 'Material', value: formatMoney(Number(data.material_cost ?? 0)) },
          { label: 'Expenses', value: formatMoney(Number(data.expense_cost ?? 0)) },
          { label: 'Total cost', value: formatMoney(Number(data.total_cost ?? 0)) },
          { label: 'Expected sales', value: formatMoney(Number(data.expected_sales_value ?? 0)) },
          { label: 'Margin', value: formatMoney(Number(data.batch_margin ?? 0)) },
        ]}
      />

      {missingSettings.length ? (
        <EntityDetailBanner>
          Map accounts in <a href="/production/settings">Production settings</a> before posting:{' '}
          {missingSettings.join(', ')}.
        </EntityDetailBanner>
      ) : null}
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <p style={{ color: 'var(--vb-color-muted, #667)', marginTop: 0 }}>{completeVsPostCopy()}</p>

      <EntityDetailTabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'activities', label: 'Activities' },
          { id: 'materials', label: 'Materials & outputs' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'costsheet', label: 'Cost sheet' },
        ]}
      />

      {tab === 'activities' ? (
        <EntityDetailPanel
          title="Activities"
          note="Complete finishes remaining stages. You can still edit materials until you post."
        >
          {!stages.length ? <p className="el-muted">This recipe has no stages.</p> : null}
          <div style={{ display: 'grid', gap: 10 }}>
            {stages
              .slice()
              .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
              .map((stage) => (
                <div
                  key={String(stage.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '0.65rem 0',
                    borderBottom: '1px solid var(--vb-color-line, #d5e3dc)',
                  }}
                >
                  <div>
                    <strong>{asCaption(stage.name)}</strong>
                    {stage.notes ? (
                      <div className="el-muted" style={{ fontSize: 13 }}>
                        {asCaption(stage.notes)}
                      </div>
                    ) : null}
                  </div>
                  {stage.completed ? (
                    <StatusPill status="Done" tone="success" />
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <TextInput
                        value={stageNotes[String(stage.id)] || ''}
                        onChange={(e) =>
                          setStageNotes((prev) => ({ ...prev, [String(stage.id)]: e.target.value }))
                        }
                        placeholder="Notes (optional)"
                        disabled={!editable || busy}
                      />
                      <Button
                        type="button"
                        disabled={!editable || busy}
                        onClick={() => {
                          const stageId = String(stage.id);
                          setCompletingStageId(stageId);
                          void completeStage({
                            batchId: id,
                            stage_id: stageId,
                            notes: stageNotes[stageId]?.trim() || undefined,
                          })
                            .unwrap()
                            .then(() => refetch())
                            .catch((e) => setActionError(extractError(e)))
                            .finally(() => setCompletingStageId(''));
                        }}
                      >
                        {completingStageId === String(stage.id) ? 'Saving…' : 'Mark complete'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'materials' ? (
        <EntityDetailPanel
          title="Materials & outputs"
          note={editable ? 'Save actual quantities before posting.' : 'Posted or cancelled batches are read-only.'}
          headerEnd={
            editable ? (
              <Button type="button" onClick={() => void saveLines()} disabled={busy}>
                {updateState.isLoading ? 'Saving…' : 'Save quantities'}
              </Button>
            ) : null
          }
        >
          <h3 style={{ marginBottom: 8 }}>Issues (raw materials)</h3>
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {issues.map((line, index) => (
              <div
                key={line.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 8 }}
              >
                <div>{line.product_name}</div>
                <TextInput
                  value={line.qty}
                  disabled={!editable}
                  onChange={(e) =>
                    setIssues((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, qty: e.target.value } : r)),
                    )
                  }
                />
                <SearchableSelect
                  options={locationOptions}
                  value={line.location_id}
                  disabled={!editable}
                  onChange={(value) =>
                    setIssues((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, location_id: value } : r)),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <h3 style={{ marginBottom: 8 }}>Outputs</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {outputs.map((line, index) => (
              <div key={line.id} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 8 }}>
                  <div>
                    {line.product_name}{' '}
                    <span className="el-muted">({line.role || 'Main'})</span>
                  </div>
                  <TextInput
                    value={line.qty}
                    disabled={!editable}
                    onChange={(e) =>
                      setOutputs((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, qty: e.target.value } : r)),
                      )
                    }
                  />
                  <SearchableSelect
                    options={locationOptions}
                    value={line.location_id}
                    disabled={!editable}
                    onChange={(value) =>
                      setOutputs((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, location_id: value } : r)),
                      )
                    }
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <TextInput
                    value={line.nrv_rate || '0'}
                    disabled={!editable}
                    onChange={(e) =>
                      setOutputs((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, nrv_rate: e.target.value } : r)),
                      )
                    }
                    placeholder="NRV rate"
                  />
                  <TextInput
                    value={line.allocation_pct || '0'}
                    disabled={!editable}
                    onChange={(e) =>
                      setOutputs((rows) =>
                        rows.map((r, i) =>
                          i === index ? { ...r, allocation_pct: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="Allocation %"
                  />
                </div>
              </div>
            ))}
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'expenses' ? (
        <EntityDetailPanel
          title="Expenses"
          headerEnd={
            editable ? (
              <Button type="button" onClick={() => setCostOpen(true)}>
                Add expense
              </Button>
            ) : null
          }
        >
          {!costs.length ? <p className="el-muted">No expenses yet.</p> : null}
          <div style={{ display: 'grid', gap: 8 }}>
            {costs.map((cost) => (
              <div
                key={String(cost.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  borderBottom: '1px solid var(--vb-color-line, #d5e3dc)',
                  padding: '0.5rem 0',
                }}
              >
                <div>
                  <strong>{asCaption(cost.cost_type)}</strong> · {formatMoney(Number(cost.amount ?? 0))}
                  {cost.description ? (
                    <div className="el-muted">{asCaption(cost.description)}</div>
                  ) : null}
                </div>
                {editable ? (
                  <Button type="button" variant="ghost" onClick={() => setRemoveCostId(String(cost.id))}>
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'costsheet' ? (
        <EntityDetailPanel title="Cost sheet">
          <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
            <div>Material cost: {formatMoney(Number(data.material_cost ?? 0))}</div>
            <div>Expense cost: {formatMoney(Number(data.expense_cost ?? 0))}</div>
            <div>Total cost: {formatMoney(Number(data.total_cost ?? 0))}</div>
            <div>Expected sales: {formatMoney(Number(data.expected_sales_value ?? 0))}</div>
            <div>
              <strong>Margin: {formatMoney(Number(data.batch_margin ?? 0))}</strong>
            </div>
          </div>
          <h3>Outputs</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {outputs.map((line) => (
              <div key={line.id}>
                {line.product_name}: qty {line.qty}, allocated{' '}
                {formatMoney(Number(line.allocated_cost ?? 0))}, cost/unit{' '}
                {formatMoney(Number(line.unit_cost ?? 0))}, NRV {line.nrv_rate}
              </div>
            ))}
          </div>
          {status === 'Posted' ? (
            <div style={{ marginTop: 16 }}>
              <h3>Posting</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                <div>
                  <strong>Movements</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13 }}>
                    {Array.isArray(posting.movement_ids) && posting.movement_ids.length
                      ? posting.movement_ids.map((mid) => {
                          const id = String(mid);
                          return (
                            <Link key={id} to={`/inventory/movements?id=${encodeURIComponent(id)}`}>
                              {id}
                            </Link>
                          );
                        })
                      : (
                        <span className="el-muted">—</span>
                      )}
                  </div>
                </div>
                <div>
                  <strong>Vouchers</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13 }}>
                    {Array.isArray(posting.voucher_ids) && posting.voucher_ids.length
                      ? posting.voucher_ids.map((vid) => {
                          const id = String(vid);
                          return (
                            <Link key={id} to={`/finance/vouchers/${encodeURIComponent(id)}`}>
                              {id}
                            </Link>
                          );
                        })
                      : (
                        <span className="el-muted">—</span>
                      )}
                  </div>
                </div>
                {posting.posted_at ? (
                  <div className="el-muted">
                    Posted {String(posting.posted_at).slice(0, 19)}
                    {posting.posted_by ? ` by ${String(posting.posted_by)}` : ''}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        end={
          <>
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void completeBatch({ id })
                    .unwrap()
                    .then(() => refetch())
                    .catch((e) => setActionError(extractError(e)))
                }
              >
                Complete
              </Button>
            ) : null}
            {editable ? (
              <Button
                type="button"
                disabled={busy || missingSettings.length > 0}
                onClick={() => setConfirm('post')}
              >
                Post
              </Button>
            ) : null}
            {status === 'Posted' ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirm('unpost')}>
                Unpost
              </Button>
            ) : null}
            {editable ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirm('cancel')}>
                Cancel batch
              </Button>
            ) : null}
          </>
        }
      />

      <ConfirmModal
        open={confirm === 'post'}
        title="Post batch?"
        confirmLabel="Post to stock & books"
        busy={postState.isLoading}
        onClose={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      >
        <p style={{ margin: 0 }}>
          Posting issues raw materials, receives outputs, updates WAC, and creates accounting
          vouchers.
        </p>
        {stockWarnings.length ? (
          <ErrorText>Stock warnings: {stockWarnings.join('; ')}</ErrorText>
        ) : (
          <p className="el-muted" style={{ margin: 0 }}>
            No soft stock warnings detected.
          </p>
        )}
        {missingSettings.length ? (
          <ErrorText>Settings incomplete: {missingSettings.join(', ')}</ErrorText>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={confirm === 'cancel'}
        title="Cancel batch?"
        danger
        confirmLabel="Cancel batch"
        busy={cancelState.isLoading}
        onClose={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      >
        <p style={{ margin: 0 }}>Cancelled batches cannot be posted.</p>
      </ConfirmModal>

      <ConfirmModal
        open={confirm === 'unpost'}
        title="Unpost batch?"
        danger
        confirmLabel="Unpost"
        busy={unpostState.isLoading}
        onClose={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      >
        <p style={{ margin: 0 }}>
          This reverses stock movements and voids posting journals, returning the batch to In
          Progress.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(removeCostId)}
        title="Remove expense?"
        danger
        confirmLabel="Remove"
        busy={removeCostState.isLoading}
        onClose={() => setRemoveCostId('')}
        onConfirm={() =>
          void removeCost({ batchId: id, costId: removeCostId })
            .unwrap()
            .then(() => {
              setRemoveCostId('');
              refetch();
            })
            .catch((e) => setActionError(extractError(e)))
        }
      >
        <p style={{ margin: 0 }}>Remove this expense from the batch?</p>
      </ConfirmModal>

      <Modal
        open={costOpen}
        title="Add expense"
        onClose={() => setCostOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCostOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={addCostState.isLoading}
              onClick={() => {
                setActionError('');
                void addCost({
                  batchId: id,
                  body: {
                    cost_type: costType,
                    amount: Number(costAmount) || 0,
                    description: costDescription.trim() || undefined,
                    activity_id: costActivity || undefined,
                    account_id: costAccount || undefined,
                  },
                })
                  .unwrap()
                  .then(() => {
                    setCostOpen(false);
                    setCostAmount('');
                    setCostDescription('');
                    refetch();
                  })
                  .catch((e) => setActionError(extractError(e)));
              }}
            >
              {addCostState.isLoading ? 'Saving…' : 'Add'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Type">
            <select className="vb-control" value={costType} onChange={(e) => setCostType(e.target.value)}>
              {COST_TYPE_PRESETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Amount">
            <TextInput value={costAmount} onChange={(e) => setCostAmount(e.target.value)} />
          </FormRow>
          <FormRow label="Activity">
            <SearchableSelect
              options={[{ value: '', label: 'None' }, ...activityOptions]}
              value={costActivity}
              onChange={setCostActivity}
            />
          </FormRow>
          <FormRow label="Clearing / expense account">
            <SearchableSelect
              options={[{ value: '', label: 'Use settings default' }, ...accountOptions]}
              value={costAccount}
              onChange={setCostAccount}
            />
          </FormRow>
          <FormRow label="Description">
            <TextInput value={costDescription} onChange={(e) => setCostDescription(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityDetailPage>
  );
}
