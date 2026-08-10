import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './controls';
import { chordMatches, eventChord, useListKeyboardBindings } from './ListKeyboard';
import './DocumentEditor.css';

export type DocumentEditorProps = {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
  error?: string | null;
  /** Header field slot (party, dates, etc.) */
  children?: ReactNode;
  body?: ReactNode;
  /** Summary + extra footer content (actions are always rendered) */
  footer?: ReactNode;
};

function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null && !el.hasAttribute('disabled');
}

/** Focusable controls inside a document-editor region (header or grid). */
export function deFocusables(root: Element | null | undefined): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        'input.de-search-input:not([disabled])',
        'input.de-cell-input:not([disabled])',
        'select.de-cell-input:not([disabled])',
        '.de-discount input:not([disabled])',
        '.de-discount select:not([disabled])',
        '.de-header-fields input:not([disabled])',
        '.de-header-fields select:not([disabled])',
        '.de-header-fields textarea:not([disabled])',
        '.de-header-fields .de-search-input:not([disabled])',
        'button.de-del:not([disabled])',
      ].join(', '),
    ),
  ).filter(isVisible);
}

export function focusDocumentSave(page: Element | null | undefined): void {
  const btn = page?.querySelector<HTMLElement>('[data-de-save]:not([disabled])');
  btn?.focus();
}

export function DocumentEditor({
  title,
  onCancel,
  onSave,
  saveLabel = 'Save',
  saving,
  error,
  children,
  body,
  footer,
}: DocumentEditorProps) {
  const bindings = useListKeyboardBindings();
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const chord = eventChord(e);
      if (chord && chordMatches(chord, bindings.save)) {
        e.preventDefault();
        if (!saving) onSave();
        return;
      }

      if (chord && chordMatches(chord, bindings.back)) {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key !== 'Enter' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const page = target.closest('.de-page') || pageRef.current;
      if (!page) return;
      if (target.tagName === 'TEXTAREA') return;

      // SearchableSelect open menu owns Enter
      const search = target.closest('.de-search');
      if (search?.querySelector('input[aria-expanded="true"]')) return;

      // Line grid owns its own Enter chain
      if (target.closest('.de-grid')) return;

      const header = page.querySelector('.de-header-fields');
      if (!header || !header.contains(target)) return;

      const fields = deFocusables(header);
      const current =
        fields.find((el) => el === target || el.contains(target)) ??
        (fields.includes(target) ? target : null);
      const idx = current ? fields.indexOf(current) : -1;
      e.preventDefault();
      if (idx >= 0 && idx < fields.length - 1) {
        fields[idx + 1]?.focus();
        return;
      }
      const gridFirst = deFocusables(page.querySelector('.de-grid'))[0];
      if (gridFirst) {
        gridFirst.focus();
        return;
      }
      focusDocumentSave(page);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bindings.back, bindings.save, onCancel, onSave, saving]);

  return (
    <div className="de-page" ref={pageRef}>
      <header className="de-header">
        <h1 className="de-title">{title}</h1>
        {children ? <div className="de-header-fields">{children}</div> : null}
      </header>

      <div className="de-body">{body}</div>

      <footer className="de-footer">
        <div>{footer}</div>
        <div className="de-footer-actions">
          {error ? <p className="de-error">{error}</p> : null}
          <Button variant="ghost" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving} data-de-save>
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      </footer>
    </div>
  );
}

export type MoneySummaryItem = {
  label: string;
  value: number;
};

export type MoneySummaryProps = {
  items: MoneySummaryItem[];
  className?: string;
};

function formatInr(n: number): string {
  const abs = Math.abs(Number(n) || 0);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${formatted}`;
}

export function MoneySummary({ items, className }: MoneySummaryProps) {
  if (!items.length) return null;
  return (
    <div className={['de-money', className].filter(Boolean).join(' ')}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div
            key={`${item.label}-${index}`}
            className={['de-money-row', isLast ? 'de-money-total' : ''].filter(Boolean).join(' ')}
          >
            <span>{item.label}</span>
            <span>{formatInr(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export { formatInr };
