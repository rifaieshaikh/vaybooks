import { useState, type ReactNode } from 'react';
import { EntityDetailTabs } from '@vaybooks/ui-kit';
import './EntityWorkspace.css';

export type EntityWorkspaceTab = 'details' | 'timeline' | 'related' | 'files' | 'audit';

const TAB_LABELS: Record<EntityWorkspaceTab, string> = {
  details: 'Details',
  timeline: 'Timeline',
  related: 'Related',
  files: 'Files',
  audit: 'Audit',
};

const TAB_KEYS = Object.keys(TAB_LABELS) as EntityWorkspaceTab[];

export function parseEntityWorkspaceTab(
  value: string | null | undefined,
  fallback: EntityWorkspaceTab = 'details',
): EntityWorkspaceTab {
  if (value && (TAB_KEYS as string[]).includes(value)) {
    return value as EntityWorkspaceTab;
  }
  return fallback;
}

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  /** Soft-deleted banner (Restore CTA, etc.). */
  deletedBanner?: ReactNode;
  /** Optional status line above the workspace (e.g. save message). */
  message?: ReactNode;
  details?: ReactNode;
  timeline?: ReactNode;
  related?: ReactNode;
  files?: ReactNode;
  /** Optional audit tab content — hidden when omitted. */
  audit?: ReactNode;
  defaultTab?: EntityWorkspaceTab;
  /** Controlled tab (e.g. from `?tab=` via useSearchParams). */
  tab?: EntityWorkspaceTab;
  onTabChange?: (tab: EntityWorkspaceTab) => void;
  /** Hide tabs that have no slot content. Default true. */
  hideEmptyTabs?: boolean;
};

/** Tabbed CRM record workspace: Details | Timeline | Related | Files | Audit. */
export function EntityWorkspace({
  title,
  subtitle,
  headerActions,
  deletedBanner,
  message,
  details,
  timeline,
  related,
  files,
  audit,
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
    audit,
  };

  const tabs = TAB_KEYS.filter((key) => !hideEmptyTabs || slots[key] != null);

  function selectTab(next: EntityWorkspaceTab) {
    if (controlledTab == null) setInternalTab(next);
    onTabChange?.(next);
  }

  return (
    <div className="crm-entity-workspace">
      {deletedBanner ? <div className="crm-ew-banner">{deletedBanner}</div> : null}
      {message ? <div className="crm-ew-msg">{message}</div> : null}

      {(title || subtitle || headerActions) && (
        <header className="crm-ew-header">
          <div className="crm-ew-header-main">
            {title ? <h1 className="crm-ew-title">{title}</h1> : null}
            {subtitle ? <div className="crm-ew-subtitle">{subtitle}</div> : null}
          </div>
          {headerActions ? <div className="crm-ew-header-actions">{headerActions}</div> : null}
        </header>
      )}

      <EntityDetailTabs
        value={active}
        ariaLabel="Workspace sections"
        onChange={(id) => selectTab(id as EntityWorkspaceTab)}
        options={tabs.map((key) => ({ id: key, label: TAB_LABELS[key] }))}
      />

      <div role="tabpanel" className="crm-ew-panel" key={active}>
        {slots[active] ?? null}
      </div>
    </div>
  );
}
