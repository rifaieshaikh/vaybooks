import { Button } from './controls';

export type ModalFormActionsProps = {
  busy?: boolean;
  submitLabel: string;
  busyLabel?: string;
  onCancel: () => void;
  submitDisabled?: boolean;
  cancelLabel?: string;
};

export function ModalFormActions({
  busy = false,
  submitLabel,
  busyLabel = 'Saving…',
  onCancel,
  submitDisabled = false,
  cancelLabel = 'Cancel',
}: ModalFormActionsProps) {
  return (
    <div
      style={{
        marginTop: 18,
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}
    >
      <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={busy || submitDisabled}>
        {busy ? busyLabel : submitLabel}
      </Button>
    </div>
  );
}
