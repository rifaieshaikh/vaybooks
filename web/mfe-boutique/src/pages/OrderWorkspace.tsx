import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAddBoutiqueOrderItemMutation,
  useCreateBoutiqueMeasurementMutation,
  useCreateBoutiqueOrderMutation,
  useGetBoutiqueOrderQuery,
  useListBoutiqueActivitiesQuery,
  useListBoutiqueMeasurementSpecsQuery,
  useListBoutiqueMeasurementsQuery,
  useListCustomersQuery,
  useListFinanceAccountsQuery,
  useListInventoryLocationsQuery,
  usePatchBoutiqueOrderMutation,
  useRecordBoutiqueAdvanceMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, Modal } from '@vaybooks/ui-kit';
import { MeasurementForm, type MeasurementFormValue, measurementFormMissingRequired } from '../MeasurementForm';
import { defaultRequiredActivities, hasAnyRequired } from '../activityDefaults';
import { asCaption, extractError } from '../utils';

const STEPS = ['Customer', 'Measurements', 'Items', 'Advance & ETD'] as const;
type Step = (typeof STEPS)[number];

export function BoutiqueOrderWorkspacePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const orderId = params.get('order') || '';
  const preselectCustomerId = params.get('customer_id') || '';
  const [step, setStep] = useState<Step>(orderId ? 'Measurements' : 'Customer');
  const [error, setError] = useState('');

  const { data: order, refetch: refetchOrder } = useGetBoutiqueOrderQuery(orderId, { skip: !orderId });
  const { data: customers = [] } = useListCustomersQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: catalog = [] } = useListBoutiqueActivitiesQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const customerId = String(order?.customer_id || '');
  const { data: measurements = [], refetch: refetchMeas } = useListBoutiqueMeasurementsQuery(
    customerId ? { customer_id: customerId } : undefined,
    { skip: !customerId },
  );
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();

  const [createOrder, createState] = useCreateBoutiqueOrderMutation();
  const [patchOrder] = usePatchBoutiqueOrderMutation();
  const [addItem] = useAddBoutiqueOrderItemMutation();
  const [createMeas] = useCreateBoutiqueMeasurementMutation();
  const [recordAdvance] = useRecordBoutiqueAdvanceMutation();

  const [pickCustomerId, setPickCustomerId] = useState(preselectCustomerId);
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');

  const [measOpen, setMeasOpen] = useState(false);
  const [measForm, setMeasForm] = useState<MeasurementFormValue | null>(null);

  const [itemDesc, setItemDesc] = useState('');
  const [measurementId, setMeasurementId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [requiredMap, setRequiredMap] = useState<Record<string, boolean>>({});

  const [etd, setEtd] = useState('');
  const [advanceAmt, setAdvanceAmt] = useState('');
  const [advanceAccount, setAdvanceAccount] = useState('');

  useEffect(() => {
    if (!orderId && preselectCustomerId && !pickCustomerId) {
      setPickCustomerId(preselectCustomerId);
    }
  }, [orderId, preselectCustomerId, pickCustomerId]);

  useEffect(() => {
    if (catalog.length) setRequiredMap(defaultRequiredActivities(catalog));
  }, [catalog]);

  useEffect(() => {
    if (!locationId && locations[0]) setLocationId(String(locations[0].id));
  }, [locations, locationId]);

  useEffect(() => {
    if (order?.expected_delivery_date) {
      setEtd(asCaption(order.expected_delivery_date).slice(0, 10));
    }
    if (order?.notes) setNotes(String(order.notes));
  }, [order?.expected_delivery_date, order?.notes]);

  const items = useMemo(
    () =>
      Array.isArray(order?.customization_items)
        ? (order!.customization_items as Record<string, unknown>[])
        : [],
    [order],
  );

  async function onCreateDraft() {
    setError('');
    if (!pickCustomerId) {
      setError('Customer is required');
      return;
    }
    if (!locationId) {
      setError('Location is required');
      return;
    }
    try {
      const location = locations.find((l) => String(l.id) === locationId);
      const created = await createOrder({
        customer_id: pickCustomerId,
        location_id: locationId,
        location_name: asCaption(location?.name),
        notes,
      }).unwrap();
      setParams({ order: String(created.id) });
      setStep('Measurements');
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onSaveMeasurement() {
    setError('');
    if (!customerId || !measForm) return;
    const missing = measurementFormMissingRequired(specs, measForm.person_type, measForm.values);
    if (missing.length) {
      setError(`Missing required: ${missing.join(', ')}`);
      return;
    }
    try {
      await createMeas({
        customer_id: customerId,
        order_id: orderId,
        ...measForm,
      }).unwrap();
      setMeasOpen(false);
      refetchMeas();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onAddItem() {
    setError('');
    if (!itemDesc.trim()) {
      setError('Item description is required');
      return;
    }
    if (!hasAnyRequired(requiredMap)) {
      setError('Select at least one required activity');
      return;
    }
    if (!measurementId && !billNumber.trim()) {
      setError('Bill number is required when no measurement is linked');
      return;
    }
    try {
      await addItem({
        orderId,
        body: {
          description: itemDesc.trim(),
          bill_number: billNumber.trim() || undefined,
          measurement_id: measurementId || undefined,
          required_activities: requiredMap,
          expected_delivery_date: etd || undefined,
        },
      }).unwrap();
      setItemDesc('');
      setMeasurementId('');
      setBillNumber('');
      refetchOrder();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onFinishAdvance() {
    setError('');
    try {
      if (etd) {
        await patchOrder({ id: orderId, body: { expected_delivery_date: etd, notes } }).unwrap();
      } else if (notes) {
        await patchOrder({ id: orderId, body: { notes } }).unwrap();
      }
      if (advanceAmt && advanceAccount && Number(advanceAmt) > 0) {
        await recordAdvance({
          orderId,
          body: { amount: Number(advanceAmt), receiving_account_id: advanceAccount },
        }).unwrap();
      }
      navigate(`/boutique/orders/${orderId}`);
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Order workspace</h2>
        {orderId ? (
          <Link to={`/boutique/orders/${orderId}`}>Open order detail</Link>
        ) : (
          <Link to="/boutique/orders">Back to orders</Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <Button
            key={s}
            type="button"
            variant={s === step ? undefined : 'ghost'}
            disabled={s !== 'Customer' && !orderId}
            onClick={() => setStep(s)}
          >
            {i + 1}. {s}
          </Button>
        ))}
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {step === 'Customer' && !orderId && (
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          <FormRow label="Customer *">
            <select value={pickCustomerId} onChange={(e) => setPickCustomerId(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.customer_name || c.name || c.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Location *">
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={{ width: '100%', padding: 8 }}>
              {locations.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {String(l.name || l.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%' }} />
          </FormRow>
          <Button type="button" onClick={onCreateDraft} disabled={createState.isLoading || !pickCustomerId}>
            {createState.isLoading ? 'Creating…' : 'Create draft → Measurements'}
          </Button>
        </div>
      )}

      {step === 'Customer' && orderId && order && (
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          <p>
            Draft <strong>{asCaption(order.order_number)}</strong> for {asCaption(order.customer_name)}
          </p>
          <FormRow label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%' }} />
          </FormRow>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              onClick={async () => {
                await patchOrder({ id: orderId, body: { notes } });
                setStep('Measurements');
              }}
            >
              Next: Measurements
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate(`/boutique/orders/${orderId}`)}>
              Save & Exit
            </Button>
          </div>
        </div>
      )}

      {step === 'Measurements' && orderId && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Button type="button" onClick={() => setMeasOpen(true)}>
              Add measurement
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('Items')}>
              Next: Items
            </Button>
          </div>
          {!measurements.length ? (
            <p style={{ color: '#667' }}>No measurements yet for this customer.</p>
          ) : (
            <ul>
              {measurements.map((m) => (
                <li key={String(m.id)}>
                  <Link to={`/boutique/measurements/${m.id}`}>
                    {asCaption(m.measurement_number)} · {asCaption(m.person_type)} · {asCaption(m.wearer_name)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Modal
            open={measOpen}
            title="Add measurement"
            onClose={() => setMeasOpen(false)}
            footer={
              <>
                <Button type="button" variant="ghost" onClick={() => setMeasOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={onSaveMeasurement}>
                  Save
                </Button>
              </>
            }
          >
            <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <MeasurementForm onChange={setMeasForm} />
            </div>
          </Modal>
        </div>
      )}

      {step === 'Items' && orderId && (
        <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <FormRow label="Description *">
            <input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} style={{ width: '100%', padding: 8 }} />
          </FormRow>
          <FormRow label="Link measurement (optional)">
            <select
              value={measurementId}
              onChange={(e) => {
                setMeasurementId(e.target.value);
                if (e.target.value) setBillNumber('');
              }}
              style={{ width: '100%', padding: 8 }}
            >
              <option value="">None — enter bill number</option>
              {measurements.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {asCaption(m.measurement_number)} · {asCaption(m.person_type)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Bill number">
            <input
              value={billNumber}
              disabled={Boolean(measurementId)}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder={measurementId ? 'Assigned from measurement' : 'Required'}
              style={{ width: '100%', padding: 8 }}
            />
          </FormRow>
          <div style={{ display: 'grid', gap: 6 }}>
            <strong>Required activities</strong>
            {catalog.map((a) => {
              const name = String(a.activity_name || a.name || '');
              return (
                <label key={name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(requiredMap[name])}
                    onChange={(e) => setRequiredMap((prev) => ({ ...prev, [name]: e.target.checked }))}
                  />
                  {name}
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" onClick={onAddItem}>
              Add item
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('Advance & ETD')}>
              Next: Advance & ETD
            </Button>
          </div>
          <ul>
            {items.map((item) => (
              <li key={String(item.item_id || item.id)}>
                {asCaption(item.bill_number)} · {asCaption(item.description)}
                {item.measurement_id ? ` · meas ${asCaption(item.measurement_number || item.measurement_id)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'Advance & ETD' && orderId && (
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          <FormRow label="Expected delivery date">
            <input type="date" value={etd} onChange={(e) => setEtd(e.target.value)} style={{ width: '100%', padding: 8 }} />
          </FormRow>
          <FormRow label="Advance amount">
            <input value={advanceAmt} onChange={(e) => setAdvanceAmt(e.target.value)} style={{ width: '100%', padding: 8 }} />
          </FormRow>
          <FormRow label="Receiving account">
            <select value={advanceAccount} onChange={(e) => setAdvanceAccount(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {String(a.account_name || a.name || a.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <Button type="button" onClick={onFinishAdvance}>
            Finish → Order detail
          </Button>
        </div>
      )}
    </div>
  );
}
