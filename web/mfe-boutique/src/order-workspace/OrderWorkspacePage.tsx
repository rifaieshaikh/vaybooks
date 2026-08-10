import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGetBoutiqueOrderQuery } from '@vaybooks/store';
import { Button, ErrorText, useDetailKeyboardBack } from '@vaybooks/ui-kit';
import { asCaption } from '../utils';
import { OrderSummaryRail } from './components/OrderSummaryRail';
import { WorkspaceStepper } from './components/WorkspaceStepper';
import { CustomerStep } from './steps/CustomerStep';
import { GarmentsStep } from './steps/GarmentsStep';
import { OpsStep } from './steps/OpsStep';
import { ReviewConfirmStep } from './steps/ReviewConfirmStep';
import { SchedulePaymentStep } from './steps/SchedulePaymentStep';
import {
  WORKSPACE_STEPS,
  boutiqueOrderPath,
  isDraft,
  isInProgress,
  itemsOf,
  orderStatus,
  type WorkspaceStep,
} from './types';
import { confirmBlockers, softHints } from './validation';
import './OrderWorkspace.css';

function parseStep(raw: string | null): WorkspaceStep {
  const hit = WORKSPACE_STEPS.find((s) => s.id === raw);
  return hit?.id || 'customer';
}

export function BoutiqueOrderWorkspacePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const orderId = params.get('order') || '';
  const preselectCustomerId = params.get('customer_id') || '';
  const step = parseStep(params.get('step'));

  const { data: order, refetch, isLoading, error } = useGetBoutiqueOrderQuery(orderId, {
    skip: !orderId,
  });

  const [savedFlash, setSavedFlash] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mediaMap, setMediaMap] = useState<Record<string, number>>({});
  const [cashPending, setCashPending] = useState(false);
  useDetailKeyboardBack('/boutique/orders', !modalOpen);

  const setStep = useCallback(
    (next: WorkspaceStep) => {
      const p = new URLSearchParams(params);
      p.set('step', next);
      if (orderId) p.set('order', orderId);
      setParams(p, { replace: true });
    },
    [params, orderId, setParams],
  );

  const markSaved = useCallback(() => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
    void refetch();
  }, [refetch]);

  // Confirmed (and later) always open in detail — wizard is draft-only
  useEffect(() => {
    if (!orderId || !order) return;
    if (!isDraft(order)) {
      navigate(boutiqueOrderPath(orderId, order), { replace: true });
    }
  }, [order, orderId, navigate]);

  // Default resume step for drafts with order id but no step
  useEffect(() => {
    if (!orderId || params.get('step')) return;
    if (order && isDraft(order)) {
      setStep('garments');
    }
  }, [orderId, order, params, setStep]);

  const mediaCount = useMemo(
    () => Object.values(mediaMap).reduce((a, b) => a + b, 0),
    [mediaMap],
  );
  const blockers = useMemo(() => confirmBlockers(order), [order]);
  const hints = useMemo(() => softHints(order, mediaCount), [order, mediaCount]);
  const items = itemsOf(order);
  const draft = isDraft(order);
  const inProgress = isInProgress(order);
  const opsUnlocked = inProgress || Boolean(order && !draft);
  const draftReadOnly = !draft;
  const status = orderStatus(order);

  const draftDone = useMemo(
    () => ({
      customer: Boolean(orderId),
      garments: items.length > 0,
      schedule: Boolean(asCaption(order?.expected_delivery_date)),
      review: Boolean(order && !draft),
      ops: inProgress,
    }),
    [orderId, items.length, order, draft, inProgress],
  );

  function onCreated(id: string) {
    setParams({ order: id, step: 'garments' }, { replace: true });
  }

  function onConfirmed() {
    navigate(`/boutique/orders/${orderId}`, { replace: true });
  }

  // Confirmed orders briefly show while redirecting
  if (orderId && order && !isDraft(order)) {
    return (
      <div className="ow">
        <p className="ow-lead">Opening order detail…</p>
      </div>
    );
  }

  return (
    <div className="ow">
      <header className="ow-header">
        <div className="ow-brand">
          <h1>Order workspace</h1>
          <p>
            {orderId
              ? `${asCaption(order?.order_number) || orderId} · ${asCaption(order?.customer_name) || 'Draft'}`
              : 'Compose a customization order'}
          </p>
        </div>
        <div className="ow-header-actions">
          {status ? (
            <span className={`ow-chip${draft ? ' is-draft' : ' is-live'}`}>{status}</span>
          ) : (
            <span className="ow-chip">New</span>
          )}
          <span className={`ow-saved${savedFlash ? ' is-on' : ''}`}>Saved</span>
          <Button type="button" variant="ghost" onClick={() => navigate('/boutique/orders')}>
            Save & exit
          </Button>
          <Link to="/boutique/orders" className="ow-chip">
            Orders
          </Link>
        </div>
      </header>

      <WorkspaceStepper
        step={step}
        orderId={orderId}
        draftDone={draftDone}
        onChange={setStep}
        opsUnlocked={opsUnlocked || step === 'ops'}
      />

      {isLoading && orderId ? <p className="ow-lead">Loading order…</p> : null}
      {error && orderId ? <ErrorText>Failed to load order.</ErrorText> : null}

      <div className="ow-layout" style={{ marginTop: '1.1rem' }}>
        <div className="ow-main">
          {step === 'customer' ? (
            <CustomerStep
              orderId={orderId}
              order={order}
              preselectCustomerId={preselectCustomerId}
              readOnly={draftReadOnly && Boolean(orderId)}
              onCreated={onCreated}
              onSaved={markSaved}
              onContinue={() => setStep('garments')}
            />
          ) : null}

          {step === 'garments' && orderId && order ? (
            <GarmentsStep
              orderId={orderId}
              order={order}
              readOnly={draftReadOnly}
              onSaved={markSaved}
              onContinue={() => setStep('schedule')}
              onMediaTotals={setMediaMap}
              onModalOpenChange={setModalOpen}
            />
          ) : null}

          {step === 'schedule' && orderId && order ? (
            <SchedulePaymentStep
              orderId={orderId}
              order={order}
              readOnly={draftReadOnly}
              onSaved={markSaved}
              onContinue={() => setStep('review')}
              onCashPendingChange={setCashPending}
            />
          ) : null}

          {step === 'review' && orderId && order ? (
            <ReviewConfirmStep
              orderId={orderId}
              order={order}
              blockers={blockers}
              hints={hints}
              cashPending={cashPending}
              readOnly={draftReadOnly}
              onJump={setStep}
              onConfirmed={onConfirmed}
            />
          ) : null}

          {step === 'ops' && orderId && order ? (
            <OpsStep
              orderId={orderId}
              order={order}
              onSaved={markSaved}
              onModalOpenChange={setModalOpen}
            />
          ) : null}

          {!orderId && step !== 'customer' ? (
            <section className="ow-panel">
              <div className="ow-empty">
                <strong>Create a draft first</strong>
                Start on the Customer step.
              </div>
              <div className="ow-actions">
                <Button type="button" onClick={() => setStep('customer')}>
                  Go to Customer
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        <OrderSummaryRail
          order={order}
          blockers={blockers}
          hints={hints}
          mediaCount={mediaCount}
          onJumpStep={setStep}
        />
      </div>
    </div>
  );
}
