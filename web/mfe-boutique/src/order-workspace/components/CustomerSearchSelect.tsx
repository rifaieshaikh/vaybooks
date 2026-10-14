import { useEffect, useMemo, useState } from 'react';
import {
  useGetCustomerIdentityPolicyQuery,
  useLazyLookupCustomerByPhoneQuery,
  useListCustomersQuery,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import { asCaption } from '../../utils';

type Props = {
  locationId: string;
  customerId: string;
  newName: string;
  newPhone: string;
  creating: boolean;
  onSelectExisting: (id: string) => void;
  onCreatingChange: (creating: boolean) => void;
  onNewNameChange: (v: string) => void;
  onNewPhoneChange: (v: string) => void;
  disabled?: boolean;
};

export function CustomerSearchSelect({
  locationId,
  customerId,
  newName,
  newPhone,
  creating,
  onSelectExisting,
  onCreatingChange,
  onNewNameChange,
  onNewPhoneChange,
  disabled,
}: Props) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const { data: policy } = useGetCustomerIdentityPolicyQuery();
  const { data: customers = [], isFetching } = useListCustomersQuery(
    { q: debounced || undefined, location_id: locationId || undefined },
    { skip: creating || disabled },
  );
  const [lookupPhone, lookupState] = useLazyLookupCustomerByPhoneQuery();

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const selected = useMemo(
    () => customers.find((c) => String(c.id) === customerId),
    [customers, customerId],
  );

  async function onPhoneBlur() {
    const phone = (creating ? newPhone : q).replace(/\D/g, '');
    if (phone.length < 8) return;
    try {
      const hit = await lookupPhone(phone).unwrap();
      if (hit?.id) {
        onCreatingChange(false);
        onSelectExisting(String(hit.id));
        setQ(asCaption(hit.customer_name || hit.name || hit.phone));
      }
    } catch {
      /* ignore lookup miss */
    }
  }

  if (disabled && customerId) {
    return (
      <div className="ow-frozen">
        <strong>{asCaption(selected?.customer_name || selected?.name) || 'Customer selected'}</strong>
        <span style={{ color: 'var(--ow-muted)' }}>
          {asCaption(selected?.phone || selected?.mobile)}
        </span>
      </div>
    );
  }

  return (
    <div className="ow-grid">
      {!creating ? (
        <FormRow label="Search customer">
          <div className="ow-search">
            <TextInput
              value={q}
              disabled={disabled}
              placeholder="Name or phone…"
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => {
                if (/\d{8,}/.test(q.replace(/\D/g, ''))) void onPhoneBlur();
              }}
            />
            {debounced && !customerId ? (
              <div className="ow-search-list">
                {isFetching ? (
                  <button type="button" disabled>
                    Searching…
                  </button>
                ) : null}
                {customers.slice(0, 12).map((c) => (
                  <button
                    key={String(c.id)}
                    type="button"
                    onClick={() => {
                      onSelectExisting(String(c.id));
                      setQ(asCaption(c.customer_name || c.name));
                    }}
                  >
                    <strong>{asCaption(c.customer_name || c.name)}</strong>
                    <div style={{ fontSize: 12, color: 'var(--ow-muted)' }}>
                      {asCaption(c.phone || c.mobile)}
                    </div>
                  </button>
                ))}
                {!isFetching && customers.length === 0 ? (
                  <button type="button" disabled>
                    No matches
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </FormRow>
      ) : null}

      {customerId && !creating ? (
        <div className="ow-banner">
          Selected:{' '}
          <strong>
            {asCaption(selected?.customer_name || selected?.name) || customerId}
          </strong>
          {asCaption(selected?.phone || selected?.mobile)
            ? ` · ${asCaption(selected?.phone || selected?.mobile)}`
            : ''}
        </div>
      ) : null}

      <div className="ow-actions" style={{ marginTop: 0 }}>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          data-kb-action={creating ? 'dialog.open_existing' : undefined}
          onClick={() => {
            onCreatingChange(!creating);
            if (!creating) onSelectExisting('');
          }}
        >
          {creating ? 'Pick existing' : 'Create new customer'}
        </Button>
      </div>

      {creating ? (
        <div className="ow-grid two">
          <FormRow label={policy?.require_name !== false ? 'Name *' : 'Name'}>
            <TextInput
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              disabled={disabled}
            />
          </FormRow>
          <FormRow label={policy?.require_phone ? 'Phone *' : 'Phone'}>
            <TextInput
              value={newPhone}
              onChange={(e) => onNewPhoneChange(e.target.value)}
              onBlur={() => void onPhoneBlur()}
              disabled={disabled}
            />
          </FormRow>
        </div>
      ) : null}

      {lookupState.isError ? <ErrorText>Phone lookup failed</ErrorText> : null}
    </div>
  );
}
