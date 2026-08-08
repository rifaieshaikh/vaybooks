import { FormEvent, useState } from 'react';
import {
  setLicenseStatus,
  setSession,
  useAppDispatch,
  useLoginMutation,
  useVerifyLicenseMutation,
  type LicenseStatus,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, PageHeader, TextInput, SimpleForm } from '@vaybooks/ui-kit';

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

export function LoginPage() {
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [login, loginState] = useLoginMutation();
  const [verifyLicense] = useVerifyLicenseMutation();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(_e: FormEvent) {
    setError(null);
    try {
      const res = await login({ username, password }).unwrap();
      dispatch(
        setSession({
          userId: res.user.username,
          displayName: res.user.display_name || res.user.username,
          accessToken: res.access_token,
        }),
      );
      const lic = await verifyLicense().unwrap();
      dispatch(setLicenseStatus(asLicenseStatus(lic.status)));
    } catch (err) {
      setError('Login failed. Check credentials / API.');
      console.error(err);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(160deg, #e8f2ee, #f7f7f5)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ width: 360, background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        <PageHeader title="VayBooks Login" />
        <SimpleForm onSubmit={onSubmit}>
          <FormRow label="Username">
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </FormRow>
          <FormRow label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </FormRow>
          <Button type="submit" disabled={loginState.isLoading}>
            {loginState.isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
          {error && <ErrorText>{error}</ErrorText>}
        </SimpleForm>
        <p style={{ fontSize: 12, color: '#666' }}>Any non-empty username/password works against the stub Auth API.</p>
      </div>
    </div>
  );
}
