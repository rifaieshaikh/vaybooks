import type { CSSProperties, ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
};

/** Simple labeled section wrapper for CRM workspace / settings forms. */
export function SectionForm({ title, description, children, actions, style }: Props) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        padding: '16px 0',
        borderBottom: '1px solid var(--vb-color-border, #e5e7eb)',
        ...style,
      }}
    >
      <div>
        <h3 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)', fontSize: '1.05rem' }}>
          {title}
        </h3>
        {description ? (
          <p style={{ margin: '6px 0 0', color: 'var(--vb-color-muted, #667)', fontSize: '0.9rem' }}>
            {description}
          </p>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
      {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div> : null}
    </section>
  );
}
