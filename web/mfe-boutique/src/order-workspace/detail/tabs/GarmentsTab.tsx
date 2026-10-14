import { useState } from 'react';
import { useListBoutiqueOrderExpensesQuery } from '@vaybooks/store';
import { EntityDetailTabs } from '@vaybooks/ui-kit';
import { GarmentOpsBoard } from '../../components/GarmentOpsBoard';
import type { OrderLike } from '../../types';

type Props = {
  orderId: string;
  order: OrderLike;
  readOnly?: boolean;
  onDone?: () => void;
};

const GARMENT_FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
] as const;

export function GarmentsTab({ orderId, order, readOnly, onDone }: Props) {
  const { data: expenses = [], refetch } = useListBoutiqueOrderExpensesQuery(orderId);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');

  return (
    <section className="ow-panel od-garments-panel">
      <div className="od-section-head">
        <div>
          <h2>Garments</h2>
          <p className="ow-lead">Expand a garment to complete its activities.</p>
        </div>
      </div>
      <EntityDetailTabs
        value={filter}
        ariaLabel="Activity filter"
        onChange={(id) => setFilter(id as 'all' | 'pending' | 'done')}
        options={[...GARMENT_FILTERS]}
      />
      <GarmentOpsBoard
        orderId={orderId}
        order={order}
        expenses={expenses}
        filter={filter}
        readOnly={readOnly}
        onDone={() => {
          void refetch();
          onDone?.();
        }}
      />
    </section>
  );
}
