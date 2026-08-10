import { useEffect, type ReactNode } from 'react';
import { Button } from './controls';
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
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      if (!saving) onSave();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSave, saving]);

  return (
    <div className="de-page">
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
          <Button type="button" onClick={onSave} disabled={saving}>
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
