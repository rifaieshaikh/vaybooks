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
  useCreateDeliveryPartnerMutation,
  useGetDeliveryPartnerQuery,
  useGetDeliveryPartnerSummaryQuery,
  useListDeliveryPartnersQuery,
  useUpdateDeliveryPartnerMutation,
  useCreateCommissionAgentMutation,
  useGetCommissionAgentQuery,
  useGetCommissionAgentSummaryQuery,
  useListCommissionAgentsQuery,
  useUpdateCommissionAgentMutation,
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

function partnerBody(v: PartyFormValues, locationIds: string[]) {
  return {
    partner_name: v.partner_name || '',
    phone_number: v.phone_number || '',
    legal_display_name: v.legal_display_name || '',
    alternate_phone_number: v.alternate_phone_number || undefined,
    email: v.email || '',
    address_line1: v.address_line1 || '',
    address_line2: v.address_line2 || '',
    city: v.city || '',
    state_code: v.state_code || '',
    pincode: v.pincode || '',
    country: v.country || 'India',
    gstin: v.gstin || '',
    pan: v.pan || '',
    payment_terms: v.payment_terms || '',
    notes: v.notes || '',
    location_ids: locationIds,
    is_active: true,
  };
}

function agentBody(v: PartyFormValues, locationIds: string[]) {
  return {
    agent_name: v.agent_name || '',
    phone_number: v.phone_number || '',
    alternate_phone_number: v.alternate_phone_number || undefined,
    email: v.email || '',
    address_line1: v.address_line1 || '',
    address_line2: v.address_line2 || '',
    city: v.city || '',
    state_code: v.state_code || '',
    pincode: v.pincode || '',
    country: v.country || 'India',
    gstin: v.gstin || '',
    pan: v.pan || '',
    registration_type: v.registration_type || 'Unregistered',
    bank_account_holder: v.bank_account_holder || '',
    bank_account_number: v.bank_account_number || '',
    bank_ifsc: v.bank_ifsc || '',
    bank_name: v.bank_name || '',
    notes: v.notes || '',
    location_ids: locationIds,
  };
}

function partyLocationIds(row: Record<string, unknown>): string[] {
  return Array.isArray(row.location_ids) ? (row.location_ids as string[]).map(String) : [];
}

function PartnerForm({
  values,
  onChange,
  locationPicker,
}: {
  values: PartyFormValues;
  onChange: (n: string, v: string) => void;
  locationPicker?: {
    showPicker: boolean;
    locationIds: string[];
    setLocationIds: (next: string[]) => void;
    accessible: AccessibleLocation[];
  };
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <FormRow label="Partner Name *">
        <TextInput value={values.partner_name || ''} onChange={(e) => onChange('partner_name', e.target.value)} required />
      </FormRow>
      <FormRow label="Phone *">
        <TextInput value={values.phone_number || ''} onChange={(e) => onChange('phone_number', e.target.value)} required />
      </FormRow>
      <FormRow label="Legal display name">
        <TextInput value={values.legal_display_name || ''} onChange={(e) => onChange('legal_display_name', e.target.value)} />
      </FormRow>
      <FormRow label="Email">
        <TextInput value={values.email || ''} onChange={(e) => onChange('email', e.target.value)} />
      </FormRow>
      <PartyAddressTaxFields values={values} onChange={onChange} />
      <FormRow label="Payment terms">
        <TextInput value={values.payment_terms || ''} onChange={(e) => onChange('payment_terms', e.target.value)} />
      </FormRow>
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

function AgentForm({
  values,
  onChange,
  locationPicker,
}: {
  values: PartyFormValues;
  onChange: (n: string, v: string) => void;
  locationPicker?: {
    showPicker: boolean;
    locationIds: string[];
    setLocationIds: (next: string[]) => void;
    accessible: AccessibleLocation[];
  };
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <FormRow label="Agent Name *">
        <TextInput value={values.agent_name || ''} onChange={(e) => onChange('agent_name', e.target.value)} required />
      </FormRow>
      <FormRow label="Phone *">
        <TextInput value={values.phone_number || ''} onChange={(e) => onChange('phone_number', e.target.value)} required />
      </FormRow>
      <FormRow label="Email">
        <TextInput value={values.email || ''} onChange={(e) => onChange('email', e.target.value)} />
      </FormRow>
      <PartyAddressTaxFields values={values} onChange={onChange} />
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

const DEFAULT_PARTNER_FILTERS = { partner_name: '', phone_number: '', balance_state: '' };
const DEFAULT_PARTNER_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];
const PARTNER_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'partner_name', label: 'Partner name', type: 'text' },
  { key: 'phone_number', label: 'Phone', type: 'text' },
];

export function DeliveryPartnersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ready: locReady, params: locParams } = usePartyListLocationFilter();
  const { data = [], isLoading, error, refetch } = useListDeliveryPartnersQuery(locParams || undefined, {
    skip: !locReady,
  });
  const [create] = useCreateDeliveryPartnerMutation();
  const [update] = useUpdateDeliveryPartnerMutation();
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_PARTNER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_PARTNER_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<PartyFormValues>({ country: 'India' });
  const [formError, setFormError] = useState('');
  const existingLocIds = useMemo(() => {
    if (dialog !== 'edit' || !editId) return [] as string[];
    const row = data.find((r) => String(r.id) === editId);
    return row ? partyLocationIds(row) : [];
  }, [dialog, editId, data]);
  const locationState = usePartyLocationIds({
    mode: dialog === 'edit' ? 'edit' : 'create',
    existingIds: existingLocIds,
    resetKey: `${dialog || ''}:${editId || 'new'}`,
  });

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.partner_name, filters.partner_name)) return false;
      if (!matchesRegex(row.phone_number, filters.phone_number)) return false;
      const bal = Number(row.current_balance ?? 0);
      if (filters.balance_state === 'due' && !(bal > 0.01)) return false;
      if (filters.balance_state === 'settled' && Math.abs(bal) >= 0.01) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submit() {
    setFormError('');
    const loc = locationState.resolveForSave();
    if (loc.error) {
      setFormError(loc.error);
      return;
    }
    try {
      if (dialog === 'add') await create(partnerBody(values, loc.locationIds)).unwrap();
      else if (dialog === 'edit' && editId)
        await update({ id: editId, body: partnerBody(values, loc.locationIds) }).unwrap();
      setDialog(null);
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  type PartnerRow = (typeof data)[number];

  function openEdit(row: PartnerRow) {
    setEditId(String(row.id));
    setValues({
      partner_name: String(row.partner_name || ''),
      phone_number: String(row.phone_number || ''),
      legal_display_name: String(row.legal_display_name || ''),
      email: String(row.email || ''),
      address_line1: String(row.address_line1 || ''),
      city: String(row.city || ''),
      state_code: String(row.state_code || ''),
      pincode: String(row.pincode || ''),
      country: String(row.country || 'India'),
      gstin: String(row.gstin || ''),
      pan: String(row.pan || ''),
      payment_terms: String(row.payment_terms || ''),
      notes: String(row.notes || ''),
    });
    setFormError('');
    setDialog('edit');
  }

  function openAdd() {
    setValues({ country: 'India' });
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

  const columns: EntityListColumn<PartnerRow>[] = useMemo(
    () => [
      {
        id: 'partner',
        header: 'Partner',
        render: (row) => {
          const name = displayName(row, ['partner_name'], 'Unnamed partner');
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
        header: 'Balance',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const bal = formatBalance(Number(row.current_balance ?? 0));
          const tone =
            bal.tone === 'red' ? 'el-due' : bal.tone === 'green' ? 'el-advance' : 'el-settled';
          return <span className={tone}>{bal.label}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Parties"
        title="Delivery partners"
        count={`${filtered.length} ${filtered.length === 1 ? 'partner' : 'partners'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add Partner
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Balance"
            value={filters.balance_state || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, balance_state: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'due', label: 'Due' },
              { id: 'settled', label: 'Settled' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={PARTNER_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_PARTNER_FILTERS}
            excludeKeys={['balance_state']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_PARTNER_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'partner_name', label: 'Name' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />
      {isLoading ? <EntityListLoading>Loading partners…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load partners.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No partners found.</strong>
        </EntityListEmpty>
      ) : null}
      {!isLoading && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/parties/delivery-partners/${row.id}`)}
          onEditRow={(row) => openEdit(row)}
          onNew={openAdd}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/parties/delivery-partners/${row.id}`)}
              onEdit={() => openEdit(row)}
            />
          )}
        />
      ) : null}
      {!isLoading && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}
      <Modal
        title={dialog === 'edit' ? 'Edit Partner' : 'Add Partner'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Partner'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <PartnerForm
          values={values}
          onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
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

export function DeliveryPartnerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetDeliveryPartnerQuery(id, { skip: !id });
  const summary = useGetDeliveryPartnerSummaryQuery(id, { skip: !id });
  const [update] = useUpdateDeliveryPartnerMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [values, setValues] = useState<PartyFormValues>({});
  const [formError, setFormError] = useState('');
  const existingLocationIds = useMemo(
    () => (data ? partyLocationIds(data as Record<string, unknown>) : []),
    [data],
  );
  const locationState = usePartyLocationIds({
    mode: 'edit',
    existingIds: existingLocationIds,
    resetKey: editOpen ? id : '',
  });

  function openEdit() {
    if (!data) return;
    setValues({
      partner_name: String(data.partner_name || ''),
      phone_number: String(data.phone_number || ''),
      legal_display_name: String(data.legal_display_name || ''),
      email: String(data.email || ''),
      address_line1: String(data.address_line1 || ''),
      city: String(data.city || ''),
      state_code: String(data.state_code || ''),
      pincode: String(data.pincode || ''),
      country: String(data.country || 'India'),
      gstin: String(data.gstin || ''),
      pan: String(data.pan || ''),
      payment_terms: String(data.payment_terms || ''),
      notes: String(data.notes || ''),
    });
    setFormError('');
    setEditOpen(true);
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading partner…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/parties/delivery-partners" label="Delivery partners" />
        <ErrorText>Partner not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const phone = String(data.phone_number || '');
  const email = String(data.email || '');
  const gstin = String(data.gstin || '');
  const outstanding = String(summary.data?.balance ?? 0);
  const city = String(data.city || '');
  const paymentTerms = String(data.payment_terms || '');

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/parties/delivery-partners" label="Delivery partners" />

      <EntityDetailHero
        kicker="Parties · Delivery partner"
        title={String(data.partner_name)}
        lead={
          <>
            <span>{phone || 'No phone on file'}</span>
            {email ? <span className="ed-lead-sep"> · {email}</span> : null}
            {gstin ? <span className="ed-lead-sep"> · GSTIN {gstin}</span> : null}
          </>
        }
        actions={
          <>
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
        ariaLabel="Partner facts"
        items={[
          { label: 'Phone', value: phone || '—' },
          ...(email ? [{ label: 'Email', value: email }] : []),
          { label: 'Outstanding', value: outstanding },
          ...(gstin ? [{ label: 'GSTIN', value: gstin }] : []),
        ]}
      />

      <DisabledModuleNote />

      <EntityDetailPanel title="Overview">
        <p className="ed-panel-note">
          {[city, paymentTerms ? `Terms: ${paymentTerms}` : ''].filter(Boolean).join(' · ') ||
            'No additional overview details.'}
        </p>
        {data.notes ? <p>{String(data.notes)}</p> : null}
      </EntityDetailPanel>

      <EntityDetailStickyActions
        start={
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/parties/delivery-partners')}
          >
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
        title="Edit Partner"
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
                  await update({ id, body: partnerBody(values, loc.locationIds) }).unwrap();
                  setEditOpen(false);
                  refetch();
                } catch {
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
        <PartnerForm
          values={values}
          onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
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

const DEFAULT_AGENT_FILTERS = { agent_name: '', phone_number: '', balance_state: '' };
const DEFAULT_AGENT_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];
const AGENT_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'agent_name', label: 'Agent name', type: 'text' },
  { key: 'phone_number', label: 'Phone', type: 'text' },
  {
    key: 'balance_state',
    label: 'Payable balance',
    type: 'select',
    allLabel: 'All Balances',
    options: [
      { value: 'settled', label: 'Settled' },
      { value: 'payable', label: 'Amount Payable' },
      { value: 'advance', label: 'Agent Advance' },
    ],
  },
];

export function CommissionAgentsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ready: locReady, params: locParams } = usePartyListLocationFilter();
  const { data = [], isLoading, error, refetch } = useListCommissionAgentsQuery(locParams || undefined, {
    skip: !locReady,
  });
  const [create] = useCreateCommissionAgentMutation();
  const [update] = useUpdateCommissionAgentMutation();
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_AGENT_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_AGENT_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<PartyFormValues>({
    country: 'India',
    registration_type: 'Unregistered',
  });
  const [formError, setFormError] = useState('');
  const existingLocIds = useMemo(() => {
    if (dialog !== 'edit' || !editId) return [] as string[];
    const row = data.find((r) => String(r.id) === editId);
    return row ? partyLocationIds(row) : [];
  }, [dialog, editId, data]);
  const locationState = usePartyLocationIds({
    mode: dialog === 'edit' ? 'edit' : 'create',
    existingIds: existingLocIds,
    resetKey: `${dialog || ''}:${editId || 'new'}`,
  });

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.agent_name, filters.agent_name)) return false;
      if (!matchesRegex(row.phone_number, filters.phone_number)) return false;
      const bal = Number(row.current_balance ?? 0);
      if (filters.balance_state === 'settled' && Math.abs(bal) >= 0.01) return false;
      if (filters.balance_state === 'payable' && bal <= 0.01) return false;
      if (filters.balance_state === 'advance' && bal >= -0.01) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submit() {
    setFormError('');
    const loc = locationState.resolveForSave();
    if (loc.error) {
      setFormError(loc.error);
      return;
    }
    try {
      if (dialog === 'add') await create(agentBody(values, loc.locationIds)).unwrap();
      else if (dialog === 'edit' && editId)
        await update({ id: editId, body: agentBody(values, loc.locationIds) }).unwrap();
      setDialog(null);
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  type AgentRow = (typeof data)[number];

  function openEdit(row: AgentRow) {
    setEditId(String(row.id));
    setValues({
      agent_name: String(row.agent_name || ''),
      phone_number: String(row.phone_number || ''),
      email: String(row.email || ''),
      address_line1: String(row.address_line1 || ''),
      city: String(row.city || ''),
      state_code: String(row.state_code || ''),
      pincode: String(row.pincode || ''),
      country: String(row.country || 'India'),
      gstin: String(row.gstin || ''),
      pan: String(row.pan || ''),
      registration_type: String(row.registration_type || 'Unregistered'),
      notes: String(row.notes || ''),
    });
    setFormError('');
    setDialog('edit');
  }

  function openAdd() {
    setValues({ country: 'India', registration_type: 'Unregistered' });
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

  const columns: EntityListColumn<AgentRow>[] = useMemo(
    () => [
      {
        id: 'agent',
        header: 'Agent',
        render: (row) => {
          const name = displayName(row, ['agent_name'], 'Unnamed agent');
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
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Parties"
        title="Commission agents"
        count={`${filtered.length} ${filtered.length === 1 ? 'agent' : 'agents'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add Agent
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Balance"
            value={filters.balance_state || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, balance_state: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'payable', label: 'Payable' },
              { id: 'advance', label: 'Advance' },
              { id: 'settled', label: 'Settled' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={AGENT_FILTER_FIELDS}
            filters={filters}
            defaultFilters={DEFAULT_AGENT_FILTERS}
            excludeKeys={['balance_state']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_AGENT_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'agent_name', label: 'Agent name' },
              { value: 'current_balance', label: 'Payable balance' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />
      {isLoading ? <EntityListLoading>Loading agents…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load agents.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No agents found.</strong>
        </EntityListEmpty>
      ) : null}
      {!isLoading && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/parties/commission-agents/${row.id}`)}
          onEditRow={(row) => openEdit(row)}
          onNew={openAdd}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/parties/commission-agents/${row.id}`)}
              onEdit={() => openEdit(row)}
            />
          )}
        />
      ) : null}
      {!isLoading && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}
      <Modal
        title={dialog === 'edit' ? 'Edit Agent' : 'Add Agent'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Agent'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <AgentForm
          values={values}
          onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
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

export function CommissionAgentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetCommissionAgentQuery(id, { skip: !id });
  const summary = useGetCommissionAgentSummaryQuery(id, { skip: !id });
  const [update] = useUpdateCommissionAgentMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [values, setValues] = useState<PartyFormValues>({});
  const [formError, setFormError] = useState('');
  const existingLocationIds = useMemo(
    () => (data ? partyLocationIds(data as Record<string, unknown>) : []),
    [data],
  );
  const locationState = usePartyLocationIds({
    mode: 'edit',
    existingIds: existingLocationIds,
    resetKey: editOpen ? id : '',
  });

  function openEdit() {
    if (!data) return;
    setValues({
      agent_name: String(data.agent_name || ''),
      phone_number: String(data.phone_number || ''),
      email: String(data.email || ''),
      address_line1: String(data.address_line1 || ''),
      city: String(data.city || ''),
      state_code: String(data.state_code || ''),
      pincode: String(data.pincode || ''),
      country: String(data.country || 'India'),
      gstin: String(data.gstin || ''),
      pan: String(data.pan || ''),
      registration_type: String(data.registration_type || 'Unregistered'),
      notes: String(data.notes || ''),
    });
    setFormError('');
    setEditOpen(true);
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading agent…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/parties/commission-agents" label="Commission agents" />
        <ErrorText>Agent not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const phone = String(data.phone_number || '');
  const email = String(data.email || '');
  const gstin = String(data.gstin || '');
  const payable = String(summary.data?.balance ?? 0);
  const city = String(data.city || '');
  const registrationType = String(data.registration_type || 'Unregistered');

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/parties/commission-agents" label="Commission agents" />

      <EntityDetailHero
        kicker="Parties · Commission agent"
        title={String(data.agent_name)}
        lead={
          <>
            <span>{phone || 'No phone on file'}</span>
            {email ? <span className="ed-lead-sep"> · {email}</span> : null}
            {gstin ? <span className="ed-lead-sep"> · GSTIN {gstin}</span> : null}
          </>
        }
        actions={
          <>
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
        ariaLabel="Agent facts"
        items={[
          { label: 'Phone', value: phone || '—' },
          ...(email ? [{ label: 'Email', value: email }] : []),
          { label: 'Payable', value: payable },
          ...(gstin ? [{ label: 'GSTIN', value: gstin }] : []),
        ]}
      />

      <DisabledModuleNote />

      <EntityDetailPanel title="Overview">
        <p className="ed-panel-note">
          {[city, registrationType].filter(Boolean).join(' · ') || 'No additional overview details.'}
        </p>
        {data.notes ? <p>{String(data.notes)}</p> : null}
      </EntityDetailPanel>

      <EntityDetailStickyActions
        start={
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/parties/commission-agents')}
          >
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
        title="Edit Agent"
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
                  await update({ id, body: agentBody(values, loc.locationIds) }).unwrap();
                  setEditOpen(false);
                  refetch();
                } catch {
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
        <AgentForm
          values={values}
          onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
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
