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
import { Button, ErrorText, FormRow, Modal, TextInput } from '@vaybooks/ui-kit';
import { itemIsReadyForInvoice } from '../../activityDefaults';
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
      <div className="ow">
        <p className="ow-lead">Loading order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="ow">
        <ErrorText>Order not found.</ErrorText>
        <p>
          <Link to="/boutique/orders" className="ow-chip">
            ← Orders
          </Link>
        </p>
      </div>
    );
  }

  if (isDraft(order)) {
    return (
      <div className="ow">
        <p className="ow-lead">Opening draft in workspace…</p>
      </div>
    );
  }

  return (
    <div className="ow od">
      <header className="ow-header">
        <div className="ow-brand">
          <p className="od-kicker">
            <Link to="/boutique/orders">Orders</Link>
            <span aria-hidden> / </span>
            Customization
          </p>
          <h1>{asCaption(order.order_number) || id}</h1>
          <p>
            {asCaption(order.customer_name) || 'Customer'}
            {asCaption(order.phone_number) ? ` · ${asCaption(order.phone_number)}` : ''}
            {' · '}
            ETD {asCaption(order.expected_delivery_date).slice(0, 10) || '—'}
          </p>
        </div>
        <div className="ow-header-actions">
          <span className={`ow-chip${terminal ? '' : ' is-live'}`}>{status || '—'}</span>
          <Button
            type="button"
            disabled={!canComplete || completeState.isLoading || terminal}
            onClick={() => void run(() => completeOrder(id).unwrap())}
          >
            Complete
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={terminal || cancelState.isLoading}
            onClick={() => setCancelOpen(true)}
          >
            Cancel
          </Button>
        </div>
      </header>

      {errorMsg ? <ErrorText>{errorMsg}</ErrorText> : null}

      <section className="od-hero-stats" aria-label="Order progress">
        <div className="od-stat">
          <span>Progress</span>
          <strong>
            {progress.done}/{progress.total || 0} activities
          </strong>
          <div className="ow-garment-ops-bar od-bar">
            <div style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
        <div className="od-stat">
          <span>Ready to invoice</span>
          <strong>
            {progress.ready}/{items.length} garments
          </strong>
        </div>
        <div className="od-stat">
          <span>Estimate</span>
          <strong>
            {formatMoney(Number(financials?.estimate_total ?? estimateTotal))}
          </strong>
        </div>
        <div className="od-stat">
          <span>Advance</span>
          <strong>
            {formatMoney(Number(financials?.advance_amount ?? order.advance_amount ?? 0))}
          </strong>
        </div>
      </section>

      <nav className="ow-stepper od-tabs" aria-label="Order detail tabs">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ow-step${tab === t.id ? ' is-current' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="ow-step-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="ow-layout od-layout" style={{ marginTop: '1.1rem' }}>
        <div className="ow-main">
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

        <aside className="ow-summary od-side">
          <h3>Schedule</h3>
          <FormRow label="Expected delivery">
            <div className="od-inline">
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

          <h3 style={{ marginTop: '1.1rem' }}>Money pulse</h3>
          <div className="ow-summary-row">
            <span>Unapplied advance</span>
            <strong>{formatMoney(Number(financials?.unapplied_advance ?? 0))}</strong>
          </div>
          <div className="ow-summary-row">
            <span>Expenses</span>
            <strong>{formatMoney(Number(financials?.expense_selling_total ?? 0))}</strong>
          </div>
          <div className="ow-summary-row">
            <span>Refundable receipts</span>
            <strong>{formatMoney(Number(financials?.refundable_payments ?? 0))}</strong>
          </div>

          <div className="ow-actions" style={{ marginTop: '0.85rem', flexWrap: 'wrap' }}>
            <button type="button" className="ow-chip" onClick={() => setTab('money', 'advance')}>
              Advance
            </button>
            <button type="button" className="ow-chip" onClick={() => setTab('money', 'expenses')}>
              Expenses
            </button>
            <button type="button" className="ow-chip" onClick={() => setTab('money', 'refunds')}>
              Refunds
            </button>
          </div>

          {asCaption(order.customer_id) ? (
            <div style={{ marginTop: '1.1rem' }}>
              <Link to={`/parties/customers/${String(order.customer_id)}`} className="ow-chip">
                Customer profile
              </Link>
            </div>
          ) : null}
        </aside>
      </div>

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
    </div>
  );
}
