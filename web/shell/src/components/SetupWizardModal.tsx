import { FormEvent, useMemo, useState } from 'react';
import { useCompleteSetupMutation } from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';

type Bundle = {
  id: string;
  name: string;
  description: string;
  modules: string[];
  warn_without?: string[];
};

const BUNDLES: Bundle[] = [
  {
    id: 'core',
    name: 'Core',
    description: 'Shell, auth, access, settings, and home — minimum installable stack.',
    modules: ['core', 'parties', 'settings'],
  },
  {
    id: 'boutique',
    name: 'Boutique',
    description: 'Core plus boutique tailoring and store operations.',
    modules: ['core', 'parties', 'boutique', 'store', 'finance', 'settings'],
  },
  {
    id: 'trade',
    name: 'Trade',
    description: 'Core trading: inventory, sales, purchases, and finance.',
    modules: ['core', 'parties', 'inventory', 'sales', 'purchases', 'finance', 'settings'],
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Core plus CRM — leads, enquiries, activities, and reports.',
    modules: ['core', 'parties', 'crm', 'settings'],
    warn_without: ['sales'],
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Core plus project accounting and site operations.',
    modules: ['core', 'parties', 'projects', 'finance', 'settings'],
  },
  {
    id: 'production',
    name: 'Production',
    description: 'Core plus inventory, production batches/recipes, and finance.',
    modules: ['core', 'parties', 'inventory', 'production', 'finance', 'settings'],
  },
  {
    id: 'full',
    name: 'Full',
    description: 'All modules including production, schedulers, migration, and system admin.',
    modules: [
      'core',
      'parties',
      'crm',
      'boutique',
      'store',
      'projects',
      'sales',
      'purchases',
      'inventory',
      'production',
      'finance',
      'schedulers',
      'migration',
      'settings',
      'system',
    ],
  },
];

const ALL_SELECTABLE = [
  'core',
  'parties',
  'crm',
  'boutique',
  'store',
  'projects',
  'sales',
  'purchases',
  'inventory',
  'production',
  'finance',
  'schedulers',
  'migration',
  'settings',
  'system',
] as const;

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { detail?: unknown } }).data;
    if (typeof data?.detail === 'string') return data.detail;
  }
  return 'Setup failed. Check the form and try again.';
}

type Props = {
  orgId: string;
  onCompleted: () => void;
};

export function SetupWizardModal({ orgId, onCompleted }: Props) {
  const [step, setStep] = useState(0);
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [bundleId, setBundleId] = useState('trade');
  const [modules, setModules] = useState<string[]>(() => [...BUNDLES.find((b) => b.id === 'trade')!.modules]);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [complete, completeState] = useCompleteSetupMutation();

  const selectedBundle = useMemo(() => BUNDLES.find((b) => b.id === bundleId), [bundleId]);
  const crmWarning = useMemo(() => {
    if (!modules.includes('crm')) return null;
    const missing = (selectedBundle?.warn_without || ['sales']).filter((m) => !modules.includes(m));
    if (!missing.length && modules.includes('sales')) return null;
    if (!modules.includes('sales')) {
      return 'CRM works best with Sales enabled for enquiry-to-order flows.';
    }
    return null;
  }, [modules, selectedBundle]);

  function applyBundle(id: string) {
    setBundleId(id);
    const bundle = BUNDLES.find((b) => b.id === id);
    if (bundle) setModules([...bundle.modules]);
  }

  function toggleModule(mod: string) {
    if (mod === 'core' || mod === 'settings' || mod === 'parties') return;
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  }

  async function onFinish(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!legalName.trim()) {
      setError('Legal name is required.');
      setStep(0);
      return;
    }
    try {
      await complete({
        business: {
          legal_name: legalName.trim(),
          trade_name: tradeName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          gstin: gstin.trim(),
          state_code: stateCode.trim(),
          fy_start_month: 4,
        },
        enabled_modules: modules,
        license_key: licenseKey.trim() || undefined,
      }).unwrap();
      onCompleted();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(20, 40, 34, 0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vb-setup-title"
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          padding: 24,
          maxHeight: '90vh',
          overflow: 'auto',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 id="vb-setup-title" style={{ margin: '0 0 4px', color: 'var(--vb-color-primary, #185c4c)', fontSize: 22 }}>
          Set up your organization
        </h1>
        <p style={{ margin: '0 0 16px', color: '#556', fontSize: 14 }}>
          Org <code>{orgId}</code> · step {step + 1} of 3
        </p>

        {step === 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <FormRow label="Legal name">
              <TextInput value={legalName} onChange={(e) => setLegalName(e.target.value)} autoFocus />
            </FormRow>
            <FormRow label="Trade name">
              <TextInput value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </FormRow>
            <FormRow label="Phone">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormRow>
            <FormRow label="Email">
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormRow>
            <FormRow label="GSTIN">
              <TextInput value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </FormRow>
            <FormRow label="State code">
              <TextInput value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="e.g. 27" />
            </FormRow>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" onClick={() => setStep(1)} disabled={!legalName.trim()}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <FormRow label="Business type preset">
              <select
                value={bundleId}
                onChange={(e) => applyBundle(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ccd' }}
              >
                {BUNDLES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <p style={{ margin: 0, fontSize: 13, color: '#667' }}>{selectedBundle?.description}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {ALL_SELECTABLE.map((mod) => (
                <label key={mod} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={modules.includes(mod)}
                    disabled={mod === 'core' || mod === 'settings' || mod === 'parties'}
                    onChange={() => toggleModule(mod)}
                  />
                  {mod}
                </label>
              ))}
            </div>
            {crmWarning && <p style={{ margin: 0, fontSize: 13, color: '#a65c00' }}>{crmWarning}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="button" onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={onFinish} style={{ display: 'grid', gap: 12 }}>
            <FormRow label="License key (optional)">
              <TextInput value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} />
            </FormRow>
            <p style={{ margin: 0, fontSize: 13, color: '#667' }}>
              Finishing seeds finance defaults for this organization and unlocks the app.
            </p>
            {error && <ErrorText>{error}</ErrorText>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={completeState.isLoading}>
                {completeState.isLoading ? 'Saving…' : 'Finish setup'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
