import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useEffect } from 'react';

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20, 40, 35, 0.45)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
  padding: 16,
};

const panel: CSSProperties = {
  width: 'min(760px, 100%)',
  maxHeight: '90vh',
  overflow: 'auto',
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
  padding: '1.1rem 1.25rem 1.25rem',
};

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panel} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)', fontSize: '1.25rem' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
        {footer ? <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>{footer}</div> : null}
      </div>
    </div>
  );
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
