import type { ReactNode } from 'react';
import { Button, FormRow } from '@vaybooks/ui-kit';

type Owner = { id: string; name: string };

type Props = {
  selectedCount: number;
  owners: Owner[];
  statuses: string[];
  assigneeId: string;
  onAssigneeChange: (id: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  onAssign: () => void;
  onStatus: () => void;
  onClear: () => void;
  assignDisabled?: boolean;
  statusDisabled?: boolean;
  busy?: boolean;
  extra?: ReactNode;
};

/** Sticky bulk assign / status bar for CRM list selection. */
export function BulkActionBar({
  selectedCount,
  owners,
  statuses,
  assigneeId,
  onAssigneeChange,
  status,
  onStatusChange,
  onAssign,
  onStatus,
  onClear,
  assignDisabled,
  statusDisabled,
  busy,
  extra,
}: Props) {
  if (selectedCount <= 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'end',
        padding: '10px 12px',
        marginBottom: 12,
        border: '1px solid #d9e3de',
        borderRadius: 8,
        background: 'rgba(24, 92, 76, 0.04)',
      }}
    >
      <strong style={{ alignSelf: 'center', color: 'var(--vb-color-primary, #185c4c)' }}>
        {selectedCount} selected
      </strong>
      {!assignDisabled ? (
        <>
          <FormRow label="Assign to">
            <select value={assigneeId} onChange={(e) => onAssigneeChange(e.target.value)}>
              <option value="">Owner…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </FormRow>
          <Button type="button" onClick={onAssign} disabled={!assigneeId || busy}>
            Assign
          </Button>
        </>
      ) : null}
      {!statusDisabled ? (
        <>
          <FormRow label="Status">
            <select value={status} onChange={(e) => onStatusChange(e.target.value)}>
              <option value="">Status…</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormRow>
          <Button type="button" onClick={onStatus} disabled={!status || busy}>
            Set status
          </Button>
        </>
      ) : null}
      {extra}
      <Button type="button" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
