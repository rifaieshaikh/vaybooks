import type { ReactNode } from 'react';
import { Button } from './controls';

export type EntityCardBadge = { label: string; tone?: 'blue' | 'red' | 'green' | 'gray' };

const toneBg: Record<string, string> = {
  blue: '#e8f1fb',
  red: '#fdecea',
  green: '#e8f6ee',
  gray: '#eef0ef',
};

const toneFg: Record<string, string> = {
  blue: '#1d4f91',
  red: '#a12828',
  green: '#1b6b45',
  gray: '#555',
};

export function EntityCard({
  title,
  captions,
  badges,
  onEdit,
  onView,
}: {
  title: string;
  captions?: string[];
  badges?: EntityCardBadge[];
  onEdit?: () => void;
  onView?: () => void;
}) {
  return (
    <div
      style={{
        border: '1px solid #d9e3de',
        borderRadius: 10,
        background: '#fff',
        padding: '0.9rem 1rem',
        display: 'grid',
        gap: 8,
        minHeight: 120,
      }}
    >
      <div style={{ fontWeight: 650, fontSize: 15, color: '#1a1a1a' }}>{title}</div>
      {captions?.map((c) => (
        <div key={c} style={{ fontSize: 13, color: '#567' }}>
          {c}
        </div>
      ))}
      {badges && badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {badges.map((b) => (
            <span
              key={b.label}
              style={{
                fontSize: 12,
                padding: '0.15rem 0.45rem',
                borderRadius: 999,
                background: toneBg[b.tone || 'gray'],
                color: toneFg[b.tone || 'gray'],
              }}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {onEdit && (
          <Button type="button" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
        )}
        {onView && (
          <Button type="button" onClick={onView}>
            View
          </Button>
        )}
      </div>
    </div>
  );
}

export function EntityCardGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export function formatBalance(balance: number): { label: string; tone: EntityCardBadge['tone'] } {
  if (Math.abs(balance) < 0.01) return { label: 'Settled', tone: 'gray' };
  if (balance > 0) return { label: `Due ₹${balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, tone: 'red' };
  return {
    label: `Advance ₹${Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
    tone: 'green',
  };
}

/** @deprecated Prefer EntityCard — kept for parties MFE compatibility */
export const PartyCard = EntityCard;
export const PartyCardGrid = EntityCardGrid;
export type PartyCardBadge = EntityCardBadge;

