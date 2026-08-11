export type TransferConfirmAction = 'dispatch' | 'receive' | 'cancel' | 'create-dispatch';

export type TransferConfirmConfig = {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
};

export const TRANSFER_CONFIRM: Record<TransferConfirmAction, TransferConfirmConfig> = {
  dispatch: {
    title: 'Dispatch transfer?',
    message: 'Dispatch this transfer? Stock will leave the source location.',
    confirmLabel: 'Dispatch',
    danger: false,
  },
  receive: {
    title: 'Receive transfer?',
    message: 'Receive this transfer? Stock will be added to the destination.',
    confirmLabel: 'Receive',
    danger: false,
  },
  cancel: {
    title: 'Cancel transfer?',
    message: 'Cancel this transfer? This cannot be undone.',
    confirmLabel: 'Cancel transfer',
    danger: true,
  },
  'create-dispatch': {
    title: 'Dispatch transfer?',
    message: 'Dispatch this transfer? Stock will leave the source location.',
    confirmLabel: 'Create & dispatch',
    danger: false,
  },
};

export function getTransferConfirm(action: TransferConfirmAction): TransferConfirmConfig {
  return TRANSFER_CONFIRM[action];
}
