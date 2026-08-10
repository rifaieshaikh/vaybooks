import {
  Button,
  EntityDetailBack,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityListActions,
  EntityListEmpty,
  EntityListFilterSort,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  ErrorText,
  FormRow,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  displayName,
  formatBalance,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import {
  useCreateVendorMutation,
  useGetVendorQuery,
  useGetVendorSummaryQuery,
  useListPartySegmentsQuery,
  useListVendorsQuery,
  useUpdateVendorMutation,
} from '@vaybooks/store';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  DisabledModuleNote,
  PartyAddressTaxFields,
  type PartyFormValues,
} from '../components/PartyFields';
import {
  PartyLocationPicker,
  usePartyListLocationFilter,
  usePartyLocationIds,
  type AccessibleLocation,
} from '../components/PartyLocationFields';
import { Modal } from '../components/Modal';

function vendorBody(v: PartyFormValues, locationIds: string[]) {
  return {
    vendor_name: v.vendor_name || '',
    phone_number: v.phone_number || '',
    alternate_phone_number: v.alternate_phone_number || undefined,
    email: v.email || '',
    contact_person: v.contact_person || '',
    address_line1: v.address_line1 || '',
    address_line2: v.address_line2 || '',
    city: v.city || '',
    state_code: v.state_code || '',
    pincode: v.pincode || '',
    country: v.country || 'India',
    gstin: v.gstin || '',
    pan: v.pan || '',
    registration_type: v.registration_type || 'Unregistered',
    msme_number: v.msme_number || '',
    bank_account_holder: v.bank_account_holder || '',
    bank_account_number: v.bank_account_number || '',
    bank_ifsc: v.bank_ifsc || '',
    bank_name: v.bank_name || '',
    notes: v.notes || '',
    location_ids: locationIds,
    segment_ids: (v.segment_ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function emptyVendor(): PartyFormValues {
  return {
    country: 'India',
    registration_type: 'Unregistered',
    segment_ids: '',
  };
}

function vendorLocationIds(data: Record<string, unknown>): string[] {
  return Array.isArray(data.location_ids) ? (data.location_ids as string[]).map(String) : [];
}

function vendorToForm(data: Record<string, unknown>): PartyFormValues {
  return {
    vendor_name: String(data.vendor_name || ''),
    phone_number: String(data.phone_number || ''),
    alternate_phone_number: String(data.alternate_phone_number || ''),
    email: String(data.email || ''),
    contact_person: String(data.contact_person || ''),
    address_line1: String(data.address_line1 || ''),
    address_line2: String(data.address_line2 || ''),
    city: String(data.city || ''),
    state_code: String(data.state_code || ''),
    pincode: String(data.pincode || ''),
    country: String(data.country || 'India'),
    gstin: String(data.gstin || ''),
    pan: String(data.pan || ''),
    registration_type: String(data.registration_type || 'Unregistered'),
    msme_number: String(data.msme_number || ''),
    bank_account_holder: String(data.bank_account_holder || ''),
    bank_account_number: String(data.bank_account_number || ''),
    bank_ifsc: String(data.bank_ifsc || ''),
    bank_name: String(data.bank_name || ''),
    notes: String(data.notes || ''),
    segment_ids: Array.isArray(data.segment_ids) ? (data.segment_ids as string[]).join(',') : '',
  };
}

function VendorFormFields({
  values,
  onChange,
  segmentOptions,
  locationPicker,
}: {
  values: PartyFormValues;
  onChange: (n: string, v: string) => void;
  segmentOptions: { id: string; name: string }[];
  locationPicker?: {
    showPicker: boolean;
    locationIds: string[];
    setLocationIds: (next: string[]) => void;
    accessible: AccessibleLocation[];
  };
}) {
  const selected = (values.segment_ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Vendor Name *">
          <TextInput value={values.vendor_name || ''} onChange={(e) => onChange('vendor_name', e.target.value)} required />
        </FormRow>
        <FormRow label="Contact Person">
          <TextInput value={values.contact_person || ''} onChange={(e) => onChange('contact_person', e.target.value)} />
        </FormRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <FormRow label="Phone *">
          <TextInput value={values.phone_number || ''} onChange={(e) => onChange('phone_number', e.target.value)} required />
        </FormRow>
        <FormRow label="Alternate Phone">
          <TextInput
            value={values.alternate_phone_number || ''}
            onChange={(e) => onChange('alternate_phone_number', e.target.value)}
          />
        </FormRow>
        <FormRow label="Email">
          <TextInput value={values.email || ''} onChange={(e) => onChange('email', e.target.value)} />
        </FormRow>
      </div>
      <PartyAddressTaxFields values={values} onChange={onChange} />
      <FormRow label="Segments">
        {segmentOptions.length === 0 ? (
          <div style={{ fontSize: 13, color: '#667' }}>No vendor segments yet.</div>
        ) : (
          <select
            multiple
            value={selected}
            onChange={(e) =>
              onChange(
                'segment_ids',
                Array.from(e.target.selectedOptions)
                  .map((o) => o.value)
                  .join(','),
              )
            }
            style={{ minHeight: 72, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
          >
            {segmentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </FormRow>
      <details style={{ border: '1px solid #e2ebe7', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Bank details</summary>
        <FormRow label="Account holder">
          <TextInput value={values.bank_account_holder || ''} onChange={(e) => onChange('bank_account_holder', e.target.value)} />
        </FormRow>
        <FormRow label="Account number">
          <TextInput value={values.bank_account_number || ''} onChange={(e) => onChange('bank_account_number', e.target.value)} />
        </FormRow>
        <FormRow label="IFSC">
          <TextInput value={values.bank_ifsc || ''} onChange={(e) => onChange('bank_ifsc', e.target.value)} />
        </FormRow>
        <FormRow label="Bank name">
          <TextInput value={values.bank_name || ''} onChange={(e) => onChange('bank_name', e.target.value)} />
        </FormRow>
      </details>
      <FormRow label="Notes">
        <TextInput value={values.notes || ''} onChange={(e) => onChange('notes', e.target.value)} />
      </FormRow>
      {locationPicker ? (
        <PartyLocationPicker
          showPicker={locationPicker.showPicker}
          locationIds={locationPicker.locationIds}
          setLocationIds={locationPicker.setLocationIds}
          accessible={locationPicker.accessible}
        />
      ) : null}
    </div>
  );
}

const DEFAULT_VENDOR_FILTERS = {
  vendor_name: '',
  phone_number: '',
  alternate_phone_number: '',
  segment_id: '',
  balance_state: '',
};

const DEFAULT_VENDOR_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

export function VendorsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ready: locReady, params: locParams } = usePartyListLocationFilter();
  const { data = [], isLoading, error, refetch } = useListVendorsQuery(locParams || undefined, {
    skip: !locReady,
  });
  const { data: segments = [] } = useListPartySegmentsQuery({ applies_to: 'vendor', active_only: true });
  const [createVendor] = useCreateVendorMutation();
  const [updateVendor] = useUpdateVendorMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_VENDOR_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_VENDOR_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<PartyFormValues>(emptyVendor());
  const [formError, setFormError] = useState('');
  const existingLocIds = useMemo(() => {
    if (dialog !== 'edit' || !editId) return [] as string[];
    const row = data.find((r) => String(r.id) === editId);
    return row ? vendorLocationIds(row) : [];
  }, [dialog, editId, data]);
  const locationState = usePartyLocationIds({
    mode: dialog === 'edit' ? 'edit' : 'create',
    existingIds: existingLocIds,
    resetKey: `${dialog || ''}:${editId || 'new'}`,
  });

  const segmentOptions = useMemo(
    () => segments.map((s) => ({ id: String(s.id), name: String(s.name || s.id) })),
    [segments],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'vendor_name', label: 'Vendor name', type: 'text' },
      { key: 'phone_number', label: 'Phone', type: 'text' },
      { key: 'alternate_phone_number', label: 'Alternate phone', type: 'text' },
      {
        key: 'segment_id',
        label: 'Segment',
        type: 'select',
        options: segmentOptions.map((s) => ({ value: s.id, label: s.name })),
      },
      {
        key: 'balance_state',
        label: 'Payable balance',
        type: 'select',
        allLabel: 'All Balances',
        options: [
          { value: 'zero', label: 'Settled' },
          { value: 'dr', label: 'Amount Payable' },
          { value: 'cr', label: 'Vendor Advance' },
        ],
      },
    ],
    [segmentOptions],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.vendor_name, filters.vendor_name)) return false;
      if (!matchesRegex(row.phone_number, filters.phone_number)) return false;
      if (!matchesRegex(row.alternate_phone_number, filters.alternate_phone_number)) return false;
      if (filters.segment_id) {
        const ids = Array.isArray(row.segment_ids) ? (row.segment_ids as string[]) : [];
        if (!ids.includes(filters.segment_id)) return false;
      }
      const bal = Number(row.current_balance ?? 0);
      if (filters.balance_state === 'zero' && Math.abs(bal) >= 0.01) return false;
      if (filters.balance_state === 'dr' && bal <= 0.01) return false;
      if (filters.balance_state === 'cr' && bal >= -0.01) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submitForm() {
    setFormError('');
    const loc = locationState.resolveForSave();
    if (loc.error) {
      setFormError(loc.error);
      return;
    }
    try {
      if (dialog === 'add') await createVendor(vendorBody(values, loc.locationIds)).unwrap();
      else if (dialog === 'edit' && editId)
        await updateVendor({ id: editId, body: vendorBody(values, loc.locationIds) }).unwrap();
      setDialog(null);
      refetch();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { detail?: string } }).data?.detail || 'Save failed')
          : 'Save failed';
      setFormError(msg);
    }
  }

  type VendorRow = (typeof data)[number];

  function openEdit(row: VendorRow) {
    setEditId(String(row.id));
    setValues(vendorToForm(row));
    setFormError('');
    setDialog('edit');
  }

  function openAdd() {
    setValues(emptyVendor());
    setEditId(null);
    setFormError('');
    setDialog('add');
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    openAdd();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const columns: EntityListColumn<VendorRow>[] = useMemo(
    () => [
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) => {
          const name = displayName(row, ['vendor_name'], 'Unnamed vendor');
          const phone = String(row.phone_number || '').trim();
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{name}</span>
                <span className="el-customer-sub">{phone || 'No phone on file'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'balance',
        header: 'Payable',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const bal = formatBalance(Number(row.current_balance ?? 0));
          const tone =
            bal.tone === 'red' ? 'el-due' : bal.tone === 'green' ? 'el-advance' : 'el-settled';
          return <span className={tone}>{bal.label}</span>;
        },
      },
      {
        id: 'gstin',
        header: 'GSTIN',
        render: (row) => {
          const gstin = String(row.gstin || '').trim();
          return (
            <span className={gstin ? 'el-gstin' : 'el-muted'} title={gstin || undefined}>
              {gstin || '—'}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Parties"
        title="Vendors"
        count={`${filtered.length} ${filtered.length === 1 ? 'vendor' : 'vendors'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add Vendor
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Balance"
            value={filters.balance_state || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({
                ...prev,
                balance_state: id === 'all' ? '' : id,
              }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'dr', label: 'Payable' },
              { id: 'cr', label: 'Advance' },
              { id: 'zero', label: 'Settled' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_VENDOR_FILTERS}
            excludeKeys={['balance_state']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_VENDOR_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'vendor_name', label: 'Vendor name' },
              { value: 'current_balance', label: 'Payable balance' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading vendors…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load vendors.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No vendors found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/parties/vendors/${row.id}`)}
          onEditRow={(row) => openEdit(row)}
          onNew={openAdd}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/parties/vendors/${row.id}`)}
              onEdit={() => openEdit(row)}
            />
          )}
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}

      <Modal
        title={dialog === 'edit' ? 'Edit Vendor' : 'Add Vendor'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            {dialog === 'add' ? (
              <Button
                type="button"
                variant="ghost"
                data-kb-action="vendors.open_existing"
                onClick={() => {
                  setDialog(null);
                  requestAnimationFrame(() => {
                    const search = document.querySelector<HTMLInputElement>('.el-search input');
                    search?.focus();
                    search?.select?.();
                  });
                }}
              >
                Search existing
              </Button>
            ) : null}
            <Button type="button" onClick={() => void submitForm()}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Vendor'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <VendorFormFields
          values={values}
          onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
          segmentOptions={segmentOptions}
          locationPicker={{
            showPicker: locationState.showPicker,
            locationIds: locationState.locationIds,
            setLocationIds: locationState.setLocationIds,
            accessible: locationState.accessible,
          }}
        />
      </Modal>
    </EntityListPage>
  );
}

export function VendorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetVendorQuery(id, { skip: !id });
  const summary = useGetVendorSummaryQuery(id, { skip: !id });
  const { data: segments = [] } = useListPartySegmentsQuery({ applies_to: 'vendor', active_only: false });
  const [updateVendor] = useUpdateVendorMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [values, setValues] = useState<PartyFormValues>(emptyVendor());
  const [formError, setFormError] = useState('');
  const existingLocationIds = useMemo(
    () => (data ? vendorLocationIds(data as Record<string, unknown>) : []),
    [data],
  );
  const locationState = usePartyLocationIds({
    mode: 'edit',
    existingIds: existingLocationIds,
    resetKey: editOpen ? id : '',
  });
  const segmentOptions = useMemo(
    () => segments.map((s) => ({ id: String(s.id), name: String(s.name || s.id) })),
    [segments],
  );

  function openEdit() {
    if (!data) return;
    setValues(vendorToForm(data));
    setFormError('');
    setEditOpen(true);
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading vendor…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/parties/vendors" label="Vendors" />
        <ErrorText>Vendor not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const phone = String(data.phone_number || '');
  const email = String(data.email || '');
  const gstin = String(data.gstin || '');
  const payable = String(summary.data?.balance ?? 0);

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/parties/vendors" label="Vendors" />

      <EntityDetailHero
        kicker="Parties · Vendor"
        title={String(data.vendor_name)}
        lead={
          <>
            <span>{phone || 'No phone on file'}</span>
            {email ? <span className="ed-lead-sep"> · {email}</span> : null}
            {gstin ? <span className="ed-lead-sep"> · GSTIN {gstin}</span> : null}
          </>
        }
        actions={
          <>
            <Button
              type="button"
              data-kb-action="vendors.record_payment"
              onClick={() => navigate(`/finance/payments?new=1&vendor_id=${encodeURIComponent(id)}`)}
            >
              Record payment
            </Button>
            <Button type="button" onClick={openEdit}>
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                refetch();
                summary.refetch();
              }}
            >
              Refresh
            </Button>
          </>
        }
      />

      <EntityDetailSnapshot
        ariaLabel="Vendor facts"
        items={[
          { label: 'Phone', value: phone || '—' },
          ...(email ? [{ label: 'Email', value: email }] : []),
          { label: 'Payable balance', value: payable },
          ...(gstin ? [{ label: 'GSTIN', value: gstin }] : []),
        ]}
      />

      <DisabledModuleNote />

      <EntityDetailPanel title="Overview">
        <pre style={{ background: '#f5f5f5', padding: 12, overflow: 'auto', fontSize: 12, margin: 0 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </EntityDetailPanel>

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/parties/vendors')}>
            Back to list
          </Button>
        }
        end={
          <Button type="button" onClick={openEdit}>
            Edit
          </Button>
        }
      />

      <Modal
        title="Edit Vendor"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                const loc = locationState.resolveForSave();
                if (loc.error) {
                  setFormError(loc.error);
                  return;
                }
                try {
                  await updateVendor({ id, body: vendorBody(values, loc.locationIds) }).unwrap();
                  setEditOpen(false);
                  refetch();
                } catch (e: unknown) {
                  setFormError('Save failed');
                }
              }}
            >
              Save Changes
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <VendorFormFields
          values={values}
          onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
          segmentOptions={segmentOptions}
          locationPicker={{
            showPicker: locationState.showPicker,
            locationIds: locationState.locationIds,
            setLocationIds: locationState.setLocationIds,
            accessible: locationState.accessible,
          }}
        />
      </Modal>
    </EntityDetailPage>
  );
}
