import { useMemo, useState, type ReactNode } from 'react';
import { StatusPill } from './StatusPill';

export type KanbanColumn = { id: string; label: string };

export type KanbanCard = {
  id: string;
  status: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
};

type Props = {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onOpen: (id: string) => void;
  onMove?: (id: string, status: string) => void | Promise<void>;
  emptyLabel?: string;
};

/** Status-column kanban with HTML5 drag-and-drop. */
export function KanbanBoard({ columns, cards, onOpen, onMove, emptyLabel = 'No items' }: Props) {
  const [draggingId, setDraggingId] = useState('');
  const [overStatus, setOverStatus] = useState('');

  const byStatus = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const col of columns) map.set(col.id, []);
    for (const card of cards) {
      const key = columns.some((c) => c.id === card.status) ? card.status : columns[0]?.id || '';
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(card);
      map.set(key, list);
    }
    return map;
  }, [cards, columns]);

  async function dropOn(status: string) {
    const id = draggingId;
    setDraggingId('');
    setOverStatus('');
    if (!id || !onMove) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    await onMove(id, status);
  }

  if (columns.length === 0) {
    return <p className="el-muted">{emptyLabel}</p>;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: 'minmax(220px, 1fr)',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
        alignItems: 'start',
      }}
    >
      {columns.map((col) => {
        const items = byStatus.get(col.id) || [];
        const isOver = overStatus === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              if (!onMove) return;
              e.preventDefault();
              setOverStatus(col.id);
            }}
            onDragLeave={() => {
              if (overStatus === col.id) setOverStatus('');
            }}
            onDrop={(e) => {
              e.preventDefault();
              void dropOn(col.id);
            }}
            style={{
              background: isOver ? 'rgba(24, 92, 76, 0.06)' : '#f6f8f7',
              border: `1px solid ${isOver ? 'var(--vb-color-primary, #185c4c)' : '#d9e3de'}`,
              borderRadius: 10,
              minHeight: 180,
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderBottom: '1px solid #e5ebe8',
              }}
            >
              <strong style={{ fontSize: 13, color: 'var(--vb-color-primary, #185c4c)' }}>
                {col.label}
              </strong>
              <span className="el-muted" style={{ fontSize: 12 }}>
                {items.length}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 8, padding: 10, alignContent: 'start' }}>
              {items.length === 0 ? (
                <p className="el-muted" style={{ margin: 0, fontSize: 12 }}>
                  —
                </p>
              ) : (
                items.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    draggable={Boolean(onMove)}
                    onDragStart={() => setDraggingId(card.id)}
                    onDragEnd={() => {
                      setDraggingId('');
                      setOverStatus('');
                    }}
                    onClick={() => onOpen(card.id)}
                    style={{
                      appearance: 'none',
                      textAlign: 'left',
                      border: '1px solid #d9e3de',
                      borderRadius: 8,
                      background: '#fff',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'grid',
                      gap: 6,
                      opacity: draggingId === card.id ? 0.55 : 1,
                      font: 'inherit',
                    }}
                  >
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{card.title}</div>
                    {card.subtitle ? (
                      <div className="el-muted" style={{ fontSize: 12 }}>
                        {card.subtitle}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <StatusPill status={card.status} />
                      {card.meta}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
