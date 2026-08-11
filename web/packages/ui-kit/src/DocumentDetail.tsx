import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './controls';
import { formatInr } from './DocumentEditor';
import { useDetailKeyboardBack } from './useDetailKeyboardBack';
import './DocumentEditor.css';

export type DocumentDetailAction = {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  title?: string;
  /** Settings action id for shell keyboard dispatcher (`data-kb-action`). */
  kbAction?: string;
};

export type DocumentDetailLine = {
  id: string;
  name: string;
  qty?: number;
  rate?: number;
  discount?: number;
  amount?: number;
  hsn?: string;
  gstRate?: number;
  tax?: number;
  meta?: string;
};

export type DocumentDetailFact = {
  label: string;
  value: ReactNode;
};

export type DocumentDetailRelated = {
  id: string;
  label: string;
  to: string;
};

export type DocumentDetailProps = {
  backTo: string;
  backLabel: string;
  /** Small uppercase label above title, e.g. Sales invoice */
  kicker?: string;
  title: string;
  status?: string;
  /** Party / primary relationship line */
  party?: ReactNode;
  subtitle?: string;
  facts?: DocumentDetailFact[];
  related?: DocumentDetailRelated[];
  actions?: DocumentDetailAction[];
  error?: string | null;
  children?: ReactNode;
  notes?: string;
  lines?: DocumentDetailLine[];
  linesEmptyLabel?: string;
  summary?: { label: string; value: number }[];
};

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('cancel') || s.includes('reject') || s.includes('void')) return 'danger';
  if (s.includes('close') || s.includes('deliver') || s.includes('received') || s.includes('paid') || s.includes('accept') || s.includes('convert'))
    return 'success';
  if (s.includes('pending') || s.includes('draft') || s.includes('sent') || s.includes('confirm') || s.includes('dispatch'))
    return 'warn';
  return 'neutral';
}

export function DocumentDetail({
  backTo,
  backLabel,
  kicker,
  title,
  status,
  party,
  subtitle,
  facts,
  related,
  actions,
  error,
  children,
  notes,
  lines,
  linesEmptyLabel = 'No line items on this document',
  summary,
}: DocumentDetailProps) {
  useDetailKeyboardBack(backTo);
  const primaryActions = (actions || []).filter((a) => a.variant === 'primary');
  const secondaryActions = (actions || []).filter((a) => a.variant !== 'primary');
  const showTaxCols = (lines || []).some(
    (l) => (l.gstRate != null && l.gstRate > 0) || (l.tax != null && l.tax > 0) || l.hsn,
  );

  return (
    <div className="dd-page">
      <nav className="dd-nav">
        <Link to={backTo} className="dd-back-link">
          <span aria-hidden>←</span> {backLabel}
        </Link>
      </nav>

      <header className="dd-hero">
        <div className="dd-hero-main">
          {kicker ? <div className="dd-kicker">{kicker}</div> : null}
          <div className="dd-title-row">
            <h1 className="dd-title">{title}</h1>
            {status ? (
              <span className={`dd-badge dd-badge-${statusTone(status)}`}>{status}</span>
            ) : null}
          </div>
          {party ? <div className="dd-party">{party}</div> : null}
          {subtitle ? <div className="dd-subtitle">{subtitle}</div> : null}
        </div>
        {(primaryActions.length || secondaryActions.length) ? (
          <div className="dd-actions">
            {secondaryActions.map((a) => (
              <Button
                key={a.id}
                type="button"
                variant="ghost"
                disabled={a.disabled}
                title={a.title}
                data-kb-action={a.kbAction}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
            {primaryActions.map((a) => (
              <Button
                key={a.id}
                type="button"
                variant="primary"
                disabled={a.disabled}
                title={a.title}
                data-kb-action={a.kbAction}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
      </header>

      {error ? <p className="dd-banner-error">{error}</p> : null}

      {facts && facts.length ? (
        <section className="dd-facts" aria-label="Document details">
          {facts.map((f) => (
            <div key={f.label} className="dd-fact">
              <div className="dd-fact-label">{f.label}</div>
              <div className="dd-fact-value">{f.value || '—'}</div>
            </div>
          ))}
        </section>
      ) : null}

      {related && related.length ? (
        <section className="dd-related" aria-label="Related documents">
          <span className="dd-related-label">Related</span>
          <div className="dd-related-links">
            {related.map((r) => (
              <Link key={r.id} to={r.to} className="dd-related-chip">
                {r.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {children ? <div className="dd-body">{children}</div> : null}

      {notes ? (
        <section className="dd-notes">
          <h2 className="dd-section-title">Notes</h2>
          <p className="dd-notes-text">{notes}</p>
        </section>
      ) : null}

      {lines ? (
        <section className="dd-lines-section">
          <div className="dd-section-head">
            <h2 className="dd-section-title">Line items</h2>
            <span className="dd-section-count">
              {lines.length} {lines.length === 1 ? 'line' : 'lines'}
            </span>
          </div>
          {lines.length === 0 ? (
            <div className="dd-empty-card">{linesEmptyLabel}</div>
          ) : (
            <div className="dd-lines-wrap">
              <table className="dd-lines">
                <thead>
                  <tr>
                    <th className="dd-col-item">Item</th>
                    {showTaxCols ? <th>HSN</th> : null}
                    <th className="dd-num">Qty</th>
                    <th className="dd-num">Rate</th>
                    <th className="dd-num">Disc</th>
                    {showTaxCols ? <th className="dd-num">GST%</th> : null}
                    {showTaxCols ? <th className="dd-num">Tax</th> : null}
                    <th className="dd-num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.id}>
                      <td className="dd-col-item">
                        <div className="dd-line-name">
                          <span className="dd-line-idx">{idx + 1}</span>
                          <span>{line.name}</span>
                        </div>
                        {line.meta ? <div className="dd-line-meta">{line.meta}</div> : null}
                      </td>
                      {showTaxCols ? (
                        <td className="dd-muted">{line.hsn || '—'}</td>
                      ) : null}
                      <td className="dd-num">{line.qty != null ? line.qty : '—'}</td>
                      <td className="dd-num">{line.rate != null ? formatInr(line.rate) : '—'}</td>
                      <td className="dd-num">
                        {line.discount != null && line.discount > 0
                          ? formatInr(line.discount)
                          : '—'}
                      </td>
                      {showTaxCols ? (
                        <td className="dd-num">
                          {line.gstRate != null && line.gstRate > 0 ? `${line.gstRate}%` : '—'}
                        </td>
                      ) : null}
                      {showTaxCols ? (
                        <td className="dd-num">
                          {line.tax != null && line.tax > 0 ? formatInr(line.tax) : '—'}
                        </td>
                      ) : null}
                      <td className="dd-num dd-amount">
                        {line.amount != null ? formatInr(line.amount) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {summary && summary.length ? (
        <aside className="dd-summary-card" aria-label="Totals">
          {summary.map((row, i) => {
            const isLast = i === summary.length - 1;
            return (
              <div
                key={`${row.label}-${i}`}
                className={['dd-summary-row', isLast ? 'dd-summary-total' : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <span>{row.label}</span>
                <span>{formatInr(row.value)}</span>
              </div>
            );
          })}
        </aside>
      ) : null}
    </div>
  );
}
