import { Button, Modal } from '@vaybooks/ui-kit';
import type { ReactNode } from 'react';

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  danger,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      compact
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy} style={danger ? { background: 'var(--vb-color-danger, #b42318)' } : undefined}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </Modal>
  );
}
