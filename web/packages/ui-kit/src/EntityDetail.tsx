import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDetailKeyboardBack } from './useDetailKeyboardBack';
import './EntityDetail.css';

export type EntityDetailFact = {
  label: string;
  value: ReactNode;
};

export type EntityDetailTab = {
  id: string;
  label: ReactNode;
};

type EntityDetailPageProps = {
  children: ReactNode;
  className?: string;
};

export function EntityDetailPage({ children, className }: EntityDetailPageProps) {
  return <div className={['ed-page', className].filter(Boolean).join(' ')}>{children}</div>;
}

type EntityDetailBackProps = {
  to: string;
  label: string;
  /** Enable Escape / nav.back keyboard (default true). */
  keyboardBack?: boolean;
};

export function EntityDetailBack({ to, label, keyboardBack = true }: EntityDetailBackProps) {
  useDetailKeyboardBack(to, keyboardBack);
  return (
    <nav className="ed-nav">
      <Link to={to} className="ed-back">
        <span aria-hidden>←</span> {label}
      </Link>
    </nav>
  );
}

type EntityDetailHeroProps = {
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
};

export function EntityDetailHero({ kicker, title, lead, actions }: EntityDetailHeroProps) {
  return (
    <header className="ed-hero">
      <div className="ed-hero-top">
        <div>
          {kicker ? <p className="ed-kicker">{kicker}</p> : null}
          <h1 className="ed-title">{title}</h1>
          {lead != null ? <div className="ed-lead">{lead}</div> : null}
        </div>
        {actions ? <div className="ed-hero-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

type EntityDetailSnapshotProps = {
  items: EntityDetailFact[];
  ariaLabel?: string;
};

export function EntityDetailSnapshot({
  items,
  ariaLabel = 'Details',
}: EntityDetailSnapshotProps) {
  if (!items.length) return null;
  return (
    <section className="ed-snapshot" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.label} className="ed-stat">
          <span>{item.label}</span>
          <strong>{item.value ?? '—'}</strong>
        </div>
      ))}
    </section>
  );
}

type EntityDetailTabsProps = {
  value: string;
  options: EntityDetailTab[];
  onChange: (id: string) => void;
  ariaLabel?: string;
};

export function EntityDetailTabs({
  value,
  options,
  onChange,
  ariaLabel = 'Sections',
}: EntityDetailTabsProps) {
  return (
    <div className="ed-tabs" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={`ed-tab${value === opt.id ? ' is-live' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type EntityDetailPanelProps = {
  title?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  headerEnd?: ReactNode;
};

export function EntityDetailPanel({
  title,
  note,
  children,
  className,
  headerEnd,
}: EntityDetailPanelProps) {
  return (
    <section className={['ed-panel', className].filter(Boolean).join(' ')}>
      {title || headerEnd ? (
        <div className="ed-panel-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {note ? <p className="ed-panel-note">{note}</p> : null}
          </div>
          {headerEnd}
        </div>
      ) : note ? (
        <p className="ed-panel-note">{note}</p>
      ) : null}
      {children}
    </section>
  );
}

type EntityDetailStickyActionsProps = {
  start?: ReactNode;
  end?: ReactNode;
  children?: ReactNode;
};

export function EntityDetailStickyActions({
  start,
  end,
  children,
}: EntityDetailStickyActionsProps) {
  return (
    <div className="ed-sticky-actions">
      {start}
      {children}
      {end ? <div className="ed-sticky-actions-end">{end}</div> : null}
    </div>
  );
}

export function EntityDetailBanner({ children }: { children: ReactNode }) {
  return <div className="ed-banner">{children}</div>;
}

export function EntityDetailEmptyCta({ children }: { children: ReactNode }) {
  return <div className="ed-empty-cta">{children}</div>;
}

/** Form stack used on detail pages and in TaskEntryModal (loads EntityDetail.css). */
export function EntityDetailForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={['ed-form', className].filter(Boolean).join(' ')}>{children}</div>;
}
