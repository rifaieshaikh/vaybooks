import { describe, expect, it } from 'vitest';
import { getTransferConfirm, TRANSFER_CONFIRM } from '../transferConfirm';

describe('transferConfirm', () => {
  it('marks cancel as danger', () => {
    expect(getTransferConfirm('cancel').danger).toBe(true);
    expect(getTransferConfirm('dispatch').danger).toBe(false);
  });

  it('covers all lifecycle actions', () => {
    expect(Object.keys(TRANSFER_CONFIRM).sort()).toEqual(
      ['cancel', 'create-dispatch', 'dispatch', 'receive'].sort(),
    );
  });

  it('create-dispatch shares dispatch messaging intent', () => {
    const cfg = getTransferConfirm('create-dispatch');
    expect(cfg.message).toContain('source location');
    expect(cfg.confirmLabel).toBe('Create & dispatch');
  });
});
