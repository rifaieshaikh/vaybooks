import { useState } from 'react';
import { useListBoutiqueOrderExpensesQuery } from '@vaybooks/store';
import { GarmentOpsBoard } from '../../components/GarmentOpsBoard';
import type { OrderLike } from '../../types';

type Props = {
  orderId: string;
  order: OrderLike;
  readOnly?: boolean;
  onDone?: () => void;
};

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
        <div className="od-filters" role="tablist" aria-label="Activity filter">
          {(
            [
              ['pending', 'Pending'],
              ['done', 'Done'],
              ['all', 'All'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`ow-chip${filter === id ? ' is-live' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
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
