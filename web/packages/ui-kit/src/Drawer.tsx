import type { FormEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Drawer.css';

export type DrawerSize = 'sm' | 'md' | 'lg';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );
}

export function Drawer({
  title,
  open,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: DrawerSize;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      if (!mounted) {
        previouslyFocused.current =
          typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
        setMounted(true);
      }
      setExiting(false);
      return;
    }
    if (!mounted) return;
    setExiting(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
      previouslyFocused.current?.focus?.();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted || exiting) return;
    const panel = panelRef.current;
    if (!panel) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = getFocusable(panel);
    (focusables[0] || panel).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = getFocusable(panelRef.current);
      if (!items.length) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [mounted, exiting, onClose]);

  if (!mounted) return null;

  const node = (
    <div
      className={['vb-drawer-root', exiting ? 'is-exiting' : ''].filter(Boolean).join(' ')}
      role="presentation"
    >
      <button
        type="button"
        className="vb-drawer-backdrop"
        aria-label="Close drawer"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`vb-drawer-panel vb-drawer-panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="vb-drawer-header">
          <h2 id={titleId} className="vb-drawer-title">
            {title}
          </h2>
          <button type="button" className="vb-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="vb-drawer-body">{children}</div>
        {footer ? <div className="vb-drawer-footer">{footer}</div> : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

/** Form stack for drawer bodies — mirrors ModalForm. */
export function DrawerForm({
  onSubmit,
  children,
  className,
}: {
  onSubmit: (e: FormEvent) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={['vb-drawer-form', className].filter(Boolean).join(' ')}
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(e);
      }}
    >
      {children}
    </form>
  );
}
