import { useState, type ReactNode } from 'react';

export type EntityWorkspaceTab = 'details' | 'timeline' | 'related' | 'files';

const TAB_LABELS: Record<EntityWorkspaceTab, string> = {
  details: 'Details',
  timeline: 'Timeline',
  related: 'Related',
  files: 'Files',
};

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  details?: ReactNode;
  timeline?: ReactNode;
  related?: ReactNode;
  files?: ReactNode;
  defaultTab?: EntityWorkspaceTab;
  tab?: EntityWorkspaceTab;
  onTabChange?: (tab: EntityWorkspaceTab) => void;
  /** Hide tabs that have no slot content. Default true. */
  hideEmptyTabs?: boolean;
};

/** Tabbed workspace shell: Details | Timeline | Related | Files. */
export function EntityWorkspace({
  title,
  subtitle,
  headerActions,
  details,
  timeline,
  related,
  files,
  defaultTab = 'details',
  tab: controlledTab,
  onTabChange,
  hideEmptyTabs = true,
}: Props) {
  const [internalTab, setInternalTab] = useState<EntityWorkspaceTab>(defaultTab);
  const active = controlledTab ?? internalTab;

  const slots: Record<EntityWorkspaceTab, ReactNode | undefined> = {
    details,
    timeline,
    related,
    files,
  };

  const tabs = (Object.keys(TAB_LABELS) as EntityWorkspaceTab[]).filter(
    (key) => !hideEmptyTabs || slots[key] != null,
  );

  function selectTab(next: EntityWorkspaceTab) {
    if (controlledTab == null) setInternalTab(next);
    onTabChange?.(next);
  }

  return (
    <div className="crm-entity-workspace">
      {(title || subtitle || headerActions) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div>
            {title ? (
              <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>{title}</h2>
            ) : null}
            {subtitle ? (
              <div style={{ marginTop: 4, color: 'var(--vb-color-muted, #667)' }}>{subtitle}</div>
            ) : null}
          </div>
          {headerActions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{headerActions}</div> : null}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Workspace sections"
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--vb-color-border, #e5e7eb)',
          marginBottom: 16,
        }}
      >
        {tabs.map((key) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTab(key)}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                padding: '10px 14px',
                cursor: 'pointer',
                font: 'inherit',
                fontWeight: selected ? 650 : 500,
                color: selected
                  ? 'var(--vb-color-primary, #185c4c)'
                  : 'var(--vb-color-muted, #667)',
                borderBottom: selected
                  ? '2px solid var(--vb-color-primary, #185c4c)'
                  : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {TAB_LABELS[key]}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{slots[active] ?? null}</div>
    </div>
  );
}
