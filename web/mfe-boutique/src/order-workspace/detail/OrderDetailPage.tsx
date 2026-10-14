import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCancelBoutiqueOrderMutation,
  useCompleteBoutiqueOrderMutation,
  useGetBoutiqueOrderFinancialsQuery,
  useGetBoutiqueOrderQuery,
  useListBoutiqueOrderExpensesQuery,
  usePatchBoutiqueOrderMutation,
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
  EntityListLoading,
  ErrorText,
  FormRow,
  Modal,
  StatusPill,
  TextInput,
} from '@vaybooks/ui-kit';
import { itemIsReadyForInvoice } from '../../activityDefaults';
import { boutiqueItemStatusTone } from '../../boutiqueListHelpers';
import { asCaption, extractError, formatMoney } from '../../utils';
import {
  activitiesOf,
  boutiqueOrderPath,
  isDraft,
  isTerminal,
  itemsOf,
  orderStatus,
} from '../types';
import { sellTotal } from '../validation';
import {
  DETAIL_TABS,
  parseDetailTab,
  parseMoneySub,
  type DetailTab,
  type MoneySub,
} from './detailTypes';
import { BillingTab } from './tabs/BillingTab';
import { GarmentsTab } from './tabs/GarmentsTab';
import { MoneyTab } from './tabs/MoneyTab';
import { OverviewTab } from './tabs/OverviewTab';
import '../OrderWorkspace.css';
import '../../BoutiqueDetailExtras.css';

export function BoutiqueOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = parseDetailTab(params.get('tab'));
  const money = parseMoneySub(params.get('money'));

  const { data: order, isLoading, error, refetch } = useGetBoutiqueOrderQuery(id, { skip: !id });
  const { data: financials, refetch: refetchFin } = useGetBoutiqueOrderFinancialsQuery(id, {
    skip: !id,
  });
  const { refetch: refetchExpenses } = useListBoutiqueOrderExpensesQuery(id, { skip: !id });
  const [cancelOrder, cancelState] = useCancelBoutiqueOrderMutation();
  const [completeOrder, completeState] = useCompleteBoutiqueOrderMutation();
  const [patchOrder, patchState] = usePatchBoutiqueOrderMutation();

  const [errorMsg, setErrorMsg] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [etd, setEtd] = useState('');

  useEffect(() => {
    if (!id || !order) return;
    if (isDraft(order)) {
      navigate(boutiqueOrderPath(id, order), { replace: true });
    }
  }, [id, order, navigate]);

  useEffect(() => {
    if (!order) return;
    const next = asCaption(order.expected_delivery_date).slice(0, 10);
    if (next) setEtd(next);
  }, [order]);

  const items = itemsOf(order);
  const activities = activitiesOf(order);
  const status = orderStatus(order);
  const terminal = isTerminal(order);
  const canComplete = status === 'Delivered';
  const estimateTotal = sellTotal(items);

  const progress = useMemo(() => {
    const total = activities.length;
    const done = activities.filter((a) => {
      const s = asCaption(a.activity_status || a.status);
      return s === 'Completed' || s === 'Skipped';
    }).length;
    const ready = items.filter((i) => itemIsReadyForInvoice(i, activities)).length;
    return {
      total,
      done,
      ready,
      pct: total ? Math.round((done / total) * 100) : 0,
    };
  }, [activities, items]);

  function setTab(next: DetailTab, nextMoney?: MoneySub) {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    if (next === 'money') {
      p.set('money', nextMoney || money || 'advance');
    } else {
      p.delete('money');
    }
    setParams(p, { replace: true });
  }

  async function refresh() {
    await Promise.all([refetch(), refetchFin(), refetchExpenses()]);
  }

  async function run(fn: () => Promise<unknown>) {
    setErrorMsg('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErrorMsg(extractError(e));
    }
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading order…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  if (error || !order) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/boutique/orders" label="Orders" />
        <ErrorText>Order not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  if (isDraft(order)) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Opening draft in workspace…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  const orderNumber = asCaption(order.order_number) || id;
  const customerName = asCaption(order.customer_name) || 'Customer';
  const phone = asCaption(order.phone_number);
  const etdLabel = asCaption(order.expected_delivery_date).slice(0, 10) || '—';

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/boutique/orders" label="Orders" />

      <EntityDetailHero
        kicker="Boutique · Order"
        title={orderNumber}
        lead={
          <>
            <StatusPill status={status || '—'} tone={boutiqueItemStatusTone(status)} />
            <span className="ed-lead-sep"> · {customerName}</span>
            {phone ? <span className="ed-lead-sep"> · {phone}</span> : null}
            <span className="ed-lead-sep"> · ETD {etdLabel}</span>
          </>
        }
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button
              type="button"
              disabled={!canComplete || completeState.isLoading || terminal}
              data-kb-action="orders.mark_complete"
              onClick={() => void run(() => completeOrder(id).unwrap())}
            >
              Complete
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={terminal || cancelState.isLoading}
              data-kb-action="orders.cancel"
              onClick={() => setCancelOpen(true)}
            >
              Cancel
            </Button>
          </>
        }
      />

      <EntityDetailSnapshot
        ariaLabel="Order progress"
        items={[
          {
            label: 'Progress',
            value: `${progress.done}/${progress.total || 0} · ${progress.pct}%`,
          },
          {
            label: 'Ready to invoice',
            value: `${progress.ready}/${items.length} garments`,
          },
          {
            label: 'Estimate',
            value: formatMoney(Number(financials?.estimate_total ?? estimateTotal)),
          },
          {
            label: 'Advance',
            value: formatMoney(Number(financials?.advance_amount ?? order.advance_amount ?? 0)),
          },
        ]}
      />

      <EntityDetailTabs
        value={tab}
        ariaLabel="Order sections"
        onChange={(id) => setTab(id as DetailTab)}
        options={DETAIL_TABS.map((t) => ({ id: t.id, label: t.label }))}
      />

      {errorMsg ? <ErrorText>{errorMsg}</ErrorText> : null}
      {terminal ? (
        <EntityDetailBanner>This order is closed. Money and garment edits are locked.</EntityDetailBanner>
      ) : null}

      <div className="bdx-order-layout">
        <div>
          {tab === 'overview' ? (
            <OverviewTab orderId={id} order={order} onJump={setTab} />
          ) : null}
          {tab === 'garments' ? (
            <GarmentsTab
              orderId={id}
              order={order}
              readOnly={terminal}
              onDone={() => void refresh()}
            />
          ) : null}
          {tab === 'money' ? (
            <MoneyTab
              orderId={id}
              order={order}
              money={money}
              readOnly={terminal}
              onMoneyChange={(m) => setTab('money', m)}
              onDone={() => void refresh()}
            />
          ) : null}
          {tab === 'billing' ? (
            <BillingTab orderId={id} order={order} onDone={() => void refresh()} />
          ) : null}
        </div>

        <aside className="bdx-order-side">
          <EntityDetailPanel title="Schedule">
            <FormRow label="Expected delivery">
              <div className="bdx-order-inline">
                <TextInput
                  type="date"
                  value={etd}
                  disabled={terminal}
                  onChange={(e) => setEtd(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={terminal || !etd || patchState.isLoading}
                  onClick={() =>
                    void run(() =>
                      patchOrder({ id, body: { expected_delivery_date: etd } }).unwrap(),
                    )
                  }
                >
                  Save
                </Button>
              </div>
            </FormRow>
          </EntityDetailPanel>

          <EntityDetailPanel title="Money pulse">
            <div className="bdx-order-row">
              <span>Unapplied advance</span>
              <strong>{formatMoney(Number(financials?.unapplied_advance ?? 0))}</strong>
            </div>
            <div className="bdx-order-row">
              <span>Expenses</span>
              <strong>{formatMoney(Number(financials?.expense_selling_total ?? 0))}</strong>
            </div>
            <div className="bdx-order-row">
              <span>Refundable receipts</span>
              <strong>{formatMoney(Number(financials?.refundable_payments ?? 0))}</strong>
            </div>
            {asCaption(order.customer_id) ? (
              <div className="ed-link-row">
                <Link to={`/parties/customers/${String(order.customer_id)}`}>Customer profile</Link>
              </div>
            ) : null}
          </EntityDetailPanel>
        </aside>
      </div>

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/boutique/orders')}>
            Back to list
          </Button>
        }
        end={
          <Button type="button" variant="ghost" onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />

      <Modal
        open={cancelOpen}
        title="Cancel this order?"
        onClose={() => setCancelOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button
              type="button"
              disabled={cancelState.isLoading}
              onClick={() =>
                void run(async () => {
                  await cancelOrder(id).unwrap();
                  setCancelOpen(false);
                })
              }
            >
              Cancel order
            </Button>
          </>
        }
      >
        <p>
          This marks the order cancelled. Use Money → Refunds for unused advance if needed.
        </p>
      </Modal>
    </EntityDetailPage>
  );
}
