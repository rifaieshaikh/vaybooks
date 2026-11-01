import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useListBoutiqueActivitiesQuery,
  useListBoutiqueMeasurementSpecsQuery,
  useListBoutiqueMeasurementsQuery,
} from '@vaybooks/store';
import { Button } from '@vaybooks/ui-kit';
import { LIST_FETCH_ALL_SIZE, pagedItems } from '../../pagedList';
import { asCaption } from '../../utils';
import { GarmentCard } from '../components/GarmentCard';
import type { GarmentValues } from '../schemas';
import { activitiesOf, itemsOf, type OrderLike } from '../types';

type DraftCard = { key: string; seed?: Partial<GarmentValues> };

type Props = {
  orderId: string;
  order: OrderLike;
  readOnly: boolean;
  onSaved: () => void;
  onContinue: () => void;
  onMediaTotals: (counts: Record<string, number>) => void;
  onModalOpenChange?: (open: boolean) => void;
};

export function GarmentsStep({
  orderId,
  order,
  readOnly,
  onSaved,
  onContinue,
  onMediaTotals,
  onModalOpenChange,
}: Props) {
  const customerId = String(order.customer_id || '');
  const { data: catalog = [] } = useListBoutiqueActivitiesQuery();
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const { data: measurementsPage, refetch: refetchMeas } = useListBoutiqueMeasurementsQuery(
    customerId
      ? { customer_id: customerId, page: 1, page_size: LIST_FETCH_ALL_SIZE }
      : undefined,
    { skip: !customerId },
  );
  const measurements = pagedItems(measurementsPage);
  const items = itemsOf(order);
  const orderActivities = activitiesOf(order);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [, setMediaMap] = useState<Record<string, number>>({});
  const orderEtd = asCaption(order.expected_delivery_date).slice(0, 10);
  const specsEmpty = specs.filter((s) => s.is_active !== false).length === 0;

  function bumpMedia(itemKey: string, count: number) {
    setMediaMap((prev) => {
      const next = { ...prev, [itemKey]: count };
      onMediaTotals(next);
      return next;
    });
  }

  function addBlank(seed?: Partial<GarmentValues>) {
    setDrafts((prev) => [...prev, { key: `draft-${Date.now()}-${prev.length}`, seed }]);
  }

  return (
    <section className="ow-panel">
      <h2>Garments</h2>
      <p className="ow-lead">Compose each piece with measurement, activities, pricing, and media.</p>

      {specsEmpty ? (
        <div className="ow-banner">
          Measurement specs are empty — linking measurements is limited.{' '}
          <Link to="/settings/measurement-specs">Configure measurement specs</Link>
        </div>
      ) : null}

      {measurements.length > 0 ? (
        <div className="ow-banner">
          {measurements.length} measurement{measurements.length === 1 ? '' : 's'} on file for this
          customer — link from a garment card.
        </div>
      ) : null}

      <div className="ow-grid">
        {items.map((item) => {
          const id = String(item.item_id || item.id);
          return (
            <GarmentCard
              key={id}
              orderId={orderId}
              customerId={customerId}
              item={item}
              catalog={catalog}
              measurements={measurements}
              orderActivities={orderActivities}
              orderEtd={orderEtd}
              readOnly={readOnly}
              onSaved={onSaved}
              onDuplicate={(seed) => addBlank(seed)}
              onMediaCount={bumpMedia}
              onModalOpenChange={onModalOpenChange}
              onMeasurementsChanged={() => void refetchMeas()}
            />
          );
        })}
        {drafts.map((d) => (
          <GarmentCard
            key={d.key}
            orderId={orderId}
            customerId={customerId}
            draftSeed={d.seed}
            catalog={catalog}
            measurements={measurements}
            orderEtd={orderEtd}
            readOnly={readOnly}
            defaultOpen
            onSaved={onSaved}
            onDuplicate={(seed) => addBlank(seed)}
            onDiscardNew={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}
            onModalOpenChange={onModalOpenChange}
            onMeasurementsChanged={() => void refetchMeas()}
          />
        ))}
        {!items.length && !drafts.length ? (
          <div className="ow-empty">
            <strong>No garments yet</strong>
            Add the first piece for this order.
          </div>
        ) : null}
      </div>

      <div className="ow-actions">
        {!readOnly ? (
          <Button type="button" onClick={() => addBlank()}>
            Add garment
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onContinue}>
          Continue to schedule
        </Button>
      </div>
    </section>
  );
}
