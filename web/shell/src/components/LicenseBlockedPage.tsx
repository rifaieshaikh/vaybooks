import { FormEvent, useState } from 'react';
import {
  setLicenseStatus,
  useAppDispatch,
  useAppSelector,
  useRenewLicenseMutation,
  type LicenseStatus,
} from '@vaybooks/store';
import { Button, FormRow, PageHeader, TextInput, SimpleForm, StatusBanner } from '@vaybooks/ui-kit';

function asLicenseStatus(value: string): LicenseStatus {
  if (
    value === 'success' ||
    value === 'skipped' ||
    value === 'in_cooling_period' ||
    value === 'expired'
  ) {
    return value;
  }
  return 'unknown';
}

export function LicenseBlockedPage() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.license.status);
  const [key, setKey] = useState('');
  const [renew, state] = useRenewLicenseMutation();

  async function onSubmit(_e: FormEvent) {
    const res = await renew({ license_key: key }).unwrap();
    dispatch(setLicenseStatus(asLicenseStatus(res.status)));
  }

  return (
    <div style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <PageHeader title="License required" />
      <StatusBanner>
        Current status: <strong>{status}</strong>. Business APIs are blocked until a valid license is applied.
      </StatusBanner>
      <SimpleForm onSubmit={onSubmit}>
        <FormRow label="License key">
          <TextInput value={key} onChange={(e) => setKey(e.target.value)} />
        </FormRow>
        <Button type="submit" disabled={state.isLoading || !key.trim()}>
          Renew license
        </Button>
      </SimpleForm>
    </div>
  );
}
