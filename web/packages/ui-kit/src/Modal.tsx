import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20, 40, 35, 0.45)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
  padding: 16,
};

const panelBase: CSSProperties = {
  maxHeight: 'min(90vh, 720px)',
  overflow: 'auto',
  background: 'var(--vb-color-surface, #fff)',
  borderRadius: 14,
  boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
  padding: '1.15rem 1.25rem 1.2rem',
  border: '1px solid var(--vb-color-line, #d5e3dc)',
  width: 'min(760px, 100%)',
  fontFamily: 'var(--vb-font-sans, system-ui, sans-serif)',
  color: 'var(--vb-color-text, #1a1a1a)',
};

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  wide,
  compact,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Narrower panel for filters/sort sheets */
  compact?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelStyle: CSSProperties = {
    ...panelBase,
    width: compact ? 'min(440px, 100%)' : wide ? 'min(920px, 100%)' : panelBase.width,
  };

  const node = (
    <div
      style={overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panelStyle} role="dialog" aria-modal="true" aria-label={title}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            gap: 12,
            position: 'sticky',
            top: 0,
            background: '#fff',
            zIndex: 1,
            paddingBottom: 4,
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)', fontSize: '1.2rem', fontWeight: 700 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid #d5e3dc',
              background: '#f7faf8',
              borderRadius: 8,
              width: 34,
              height: 34,
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              color: '#5c736a',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
        {footer ? (
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              position: 'sticky',
              bottom: 0,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.85), #fff 35%)',
              paddingTop: 12,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

export function ModalForm({
  onSubmit,
  children,
}: {
  onSubmit: (e: FormEvent) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(e);
      }}
      style={{ display: 'grid', gap: 10 }}
    >
      {children}
    </form>
  );
}
