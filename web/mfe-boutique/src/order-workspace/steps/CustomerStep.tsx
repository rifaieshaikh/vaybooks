import { useEffect, useMemo, useState } from 'react';
import {
  useCreateBoutiqueOrderMutation,
  useCreateCustomerMutation,
  useGetCustomerIdentityPolicyQuery,
  useGetWorkingLocationQuery,
  useListInventoryLocationsQuery,
  usePatchBoutiqueOrderMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../../utils';
import { useDebouncedAutosave } from '../hooks/useDebouncedAutosave';
import { CustomerSearchSelect } from '../components/CustomerSearchSelect';
import { isDraft, todayPlusDays, type OrderLike } from '../types';

type Props = {
  orderId: string;
  order: OrderLike | null | undefined;
  preselectCustomerId: string;
  readOnly: boolean;
  onCreated: (orderId: string) => void;
  onSaved: () => void;
  onContinue: () => void;
};

export function CustomerStep({
  orderId,
  order,
  preselectCustomerId,
  readOnly,
  onCreated,
  onSaved,
  onContinue,
}: Props) {
  const { data: locations = [] } = useListInventoryLocationsQuery();
  const { data: workingLoc } = useGetWorkingLocationQuery();
  const { data: policy } = useGetCustomerIdentityPolicyQuery();
  const [createCustomer, createCustState] = useCreateCustomerMutation();
  const [createOrder, createOrderState] = useCreateBoutiqueOrderMutation();
  const [patchOrder] = usePatchBoutiqueOrderMutation();

  const [customerId, setCustomerId] = useState(preselectCustomerId || '');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const workingId = String(workingLoc?.working_location_id || '');
  const locationLocked = Boolean(workingId && workingId !== 'ALL');

  const workingLabel = useMemo(() => {
    if (!locationLocked) return '';
    const fromAccessible = workingLoc?.accessible?.find((l) => String(l.id) === workingId);
    if (fromAccessible) return asCaption(fromAccessible.name || fromAccessible.code || workingId);
    const fromList = locations.find((l) => String(l.id) === workingId);
    return asCaption(fromList?.name || workingId);
  }, [locationLocked, workingLoc, workingId, locations]);

  useEffect(() => {
    if (orderId) return;
    if (locationLocked) {
      setLocationId(workingId);
      return;
    }
    if (!locationId && locations[0]) setLocationId(String(locations[0].id));
  }, [orderId, locationLocked, workingId, locations, locationId]);

  useEffect(() => {
    if (order?.notes != null) setNotes(String(order.notes));
  }, [order?.notes]);

  useEffect(() => {
    if (order?.customer_id) setCustomerId(String(order.customer_id));
    if (order?.location_id) setLocationId(String(order.location_id));
  }, [order?.customer_id, order?.location_id]);

  const frozen = Boolean(orderId);
  const draft = isDraft(order);

  useDebouncedAutosave(
    Boolean(orderId && draft && !readOnly),
    [notes],
    500,
    async () => {
      try {
        await patchOrder({ id: orderId, body: { notes } }).unwrap();
        onSaved();
      } catch {
        /* surface via next action */
      }
    },
  );

  async function onCreateDraft() {
    setError('');
    let cid = customerId;
    try {
      if (creating) {
        if (policy?.require_name !== false && !newName.trim()) {
          setError('Customer name is required');
          return;
        }
        if (policy?.require_phone && !newPhone.trim()) {
          setError('Customer phone is required');
          return;
        }
        const created = await createCustomer({
          customer_name: newName.trim(),
          phone_number: newPhone.trim() || '',
          location_ids: locationId ? [locationId] : undefined,
        }).unwrap();
        cid = String(created.id);
        setCustomerId(cid);
      }
      if (!cid) {
        setError('Customer is required');
        return;
      }
      if (!locationId) {
        setError('Location is required');
        return;
      }
      const location =
        locations.find((l) => String(l.id) === locationId) ||
        workingLoc?.accessible?.find((l) => String(l.id) === locationId);
      const createdOrder = await createOrder({
        customer_id: cid,
        location_id: locationId,
        location_name: asCaption(location?.name || location?.code || workingLabel),
        notes,
        expected_delivery_date: todayPlusDays(7),
      }).unwrap();
      onCreated(String(createdOrder.id));
    } catch (e) {
      setError(extractError(e));
    }
  }

  if (frozen && order) {
    return (
      <section className="ow-panel">
        <h2>Customer</h2>
        <p className="ow-lead">Identity and location are locked after the draft is created.</p>
        <div className="ow-frozen">
          <strong>
            {asCaption(order.order_number)} · {asCaption(order.customer_name)}
          </strong>
          <span style={{ color: 'var(--ow-muted)' }}>
            {asCaption(order.customer_phone || order.phone)} · Location{' '}
            {asCaption(order.location_name || order.location_id)}
          </span>
        </div>
        <FormRow label="Notes">
          <textarea
            className="vb-control"
            rows={3}
            value={notes}
            disabled={readOnly || !draft}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormRow>
        <div className="ow-actions">
          <Button type="button" onClick={onContinue} disabled={!draft && readOnly}>
            Continue to garments
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="ow-panel">
      <h2>Customer</h2>
      <p className="ow-lead">Who is this order for? Create a draft to unlock garments.</p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <div className="ow-grid">
        <CustomerSearchSelect
          locationId={locationLocked ? workingId : locationId}
          customerId={customerId}
          newName={newName}
          newPhone={newPhone}
          creating={creating}
          onSelectExisting={setCustomerId}
          onCreatingChange={setCreating}
          onNewNameChange={setNewName}
          onNewPhoneChange={setNewPhone}
        />
        {locationLocked ? null : (
          <FormRow label="Location *">
            <select
              className="vb-control"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Select…</option>
              {locations.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {asCaption(l.name)}
                </option>
              ))}
            </select>
          </FormRow>
        )}
        <FormRow label="Notes">
          <textarea
            className="vb-control"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormRow>
        <div className="ow-banner">
          Expected delivery defaults to <strong>{todayPlusDays(7)}</strong> (editable in Schedule).
        </div>
      </div>
      <div className="ow-actions">
        <Button
          type="button"
          onClick={() => void onCreateDraft()}
          disabled={createCustState.isLoading || createOrderState.isLoading}
        >
          {createOrderState.isLoading || createCustState.isLoading
            ? 'Creating…'
            : 'Create draft → Garments'}
        </Button>
      </div>
    </section>
  );
}
