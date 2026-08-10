import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EntityListLoading, ErrorText } from '@vaybooks/ui-kit';
import { extractError } from '../utils';
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
  loading?: boolean;
};

/** Status-column kanban with HTML5 drag-and-drop and optimistic moves. */
export function KanbanBoard({
  columns,
  cards,
  onOpen,
  onMove,
  emptyLabel = 'No items',
  loading = false,
}: Props) {
  const [draggingId, setDraggingId] = useState('');
  const [overStatus, setOverStatus] = useState('');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [justDroppedId, setJustDroppedId] = useState('');
  const [moveError, setMoveError] = useState('');

  useEffect(() => {
    setStatusOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, status] of Object.entries(prev)) {
        const card = cards.find((c) => c.id === id);
        if (!card || card.status === status) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cards]);

  useEffect(() => {
    if (!justDroppedId) return;
    const timer = window.setTimeout(() => setJustDroppedId(''), 420);
    return () => window.clearTimeout(timer);
  }, [justDroppedId]);

  const effectiveCards = useMemo(
    () =>
      cards.map((card) =>
        statusOverrides[card.id] ? { ...card, status: statusOverrides[card.id] } : card,
      ),
    [cards, statusOverrides],
  );

  const byStatus = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const col of columns) map.set(col.id, []);
    for (const card of effectiveCards) {
      const key = columns.some((c) => c.id === card.status) ? card.status : columns[0]?.id || '';
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(card);
      map.set(key, list);
    }
    return map;
  }, [effectiveCards, columns]);

  async function dropOn(status: string) {
    const id = draggingId;
    setDraggingId('');
    setOverStatus('');
    if (!id || !onMove) return;
    const card = effectiveCards.find((c) => c.id === id);
    if (!card || card.status === status) return;

    const previous = card.status;
    setMoveError('');
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
    setJustDroppedId(id);

    try {
      await onMove(id, status);
    } catch (e) {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        if (next[id] === status) {
          if (previous) next[id] = previous;
          else delete next[id];
        }
        return next;
      });
      setJustDroppedId('');
      setMoveError(extractError(e) || 'Could not update status — moved back.');
    }
  }

  if (columns.length === 0) {
    return <p className="el-muted">{emptyLabel}</p>;
  }

  if (loading && cards.length === 0) {
    return (
      <div>
        <EntityListLoading>Loading board…</EntityListLoading>
        <div
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'minmax(220px, 1fr)',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 8,
            alignItems: 'start',
            marginTop: 8,
          }}
        >
          {columns.map((col) => (
            <div
              key={col.id}
              style={{
                background: '#f6f8f7',
                border: '1px solid #d9e3de',
                borderRadius: 10,
                minHeight: 180,
                padding: 12,
                display: 'grid',
                gap: 8,
                alignContent: 'start',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13, color: 'var(--vb-color-primary, #185c4c)' }}>
                  {col.label}
                </strong>
                <span className="el-muted" style={{ fontSize: 12 }}>
                  …
                </span>
              </div>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  style={{
                    height: 64,
                    borderRadius: 8,
                    background: 'linear-gradient(90deg, #e8eeeb 25%, #f4f7f5 50%, #e8eeeb 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'kb-shimmer 1.2s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <style>{`@keyframes kb-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {moveError ? (
        <div style={{ marginBottom: 8 }}>
          <ErrorText>{moveError}</ErrorText>
        </div>
      ) : null}
      {!loading && cards.length === 0 ? (
        <p className="el-muted" style={{ margin: '0 0 8px' }}>
          {emptyLabel}
        </p>
      ) : null}
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
                transition: 'background 160ms ease, border-color 160ms ease',
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
                  items.map((card) => {
                    const dropped = justDroppedId === card.id;
                    return (
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
                          transform: dropped ? 'translateY(-2px) scale(1.01)' : 'none',
                          boxShadow: dropped ? '0 4px 12px rgba(24, 92, 76, 0.12)' : 'none',
                          transition:
                            'opacity 140ms ease, transform 280ms ease, box-shadow 280ms ease',
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
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
