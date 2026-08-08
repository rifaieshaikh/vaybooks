import { Button, ErrorText, FormRow, TextInput, StatusBanner } from '@vaybooks/ui-kit';
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
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  DisabledModuleNote,
  LocationIdsField,
  PartyAddressTaxFields,
  parseLocationIds,
  type PartyFormValues,
} from '../components/PartyFields';
import { Modal } from '../components/Modal';
import { PartyCard, PartyCardGrid, formatBalance } from '../components/PartyCard';
import {
  ListToolbar,
  PAGE_SIZE,
  PaginationBar,
  type FilterFieldDef,
  type SortCriterion,
} from '../components/ListToolbar';
import { displayName, matchesRegex, pageCount, paginate, sortRows } from '../components/listUtils';

function partnerBody(v: PartyFormValues) {
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
    location_ids: parseLocationIds(v.location_ids || 'default'),
    is_active: true,
  };
}

function agentBody(v: PartyFormValues) {
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
    location_ids: parseLocationIds(v.location_ids || 'default'),
  };
}

function PartnerForm({ values, onChange }: { values: PartyFormValues; onChange: (n: string, v: string) => void }) {
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
      <LocationIdsField value={values.location_ids || 'default'} onChange={(v) => onChange('location_ids', v)} />
    </div>
  );
}

function AgentForm({ values, onChange }: { values: PartyFormValues; onChange: (n: string, v: string) => void }) {
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
      <LocationIdsField value={values.location_ids || 'default'} onChange={(v) => onChange('location_ids', v)} />
    </div>
  );
}

const DEFAULT_PARTNER_FILTERS = { partner_name: '', phone_number: '' };
const DEFAULT_PARTNER_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];
const PARTNER_FILTER_FIELDS: FilterFieldDef[] = [
  { key: 'partner_name', label: 'Partner name', type: 'text' },
  { key: 'phone_number', label: 'Phone', type: 'text' },
];

export function DeliveryPartnersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListDeliveryPartnersQuery();
  const [create] = useCreateDeliveryPartnerMutation();
  const [update] = useUpdateDeliveryPartnerMutation();
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_PARTNER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_PARTNER_FILTERS });
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<PartyFormValues>({ location_ids: 'default', country: 'India' });
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    let rows = data.filter(
      (row) =>
        matchesRegex(row.partner_name, filters.partner_name) &&
        matchesRegex(row.phone_number, filters.phone_number),
    );
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function submit() {
    setFormError('');
    try {
      if (dialog === 'add') await create(partnerBody(values)).unwrap();
      else if (dialog === 'edit' && editId) await update({ id: editId, body: partnerBody(values) }).unwrap();
      setDialog(null);
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  return (
    <div>
      <ListToolbar
        title="Delivery partners"
        countLabel="partners"
        count={filtered.length}
        primaryLabel="Add Partner"
        onPrimary={() => {
          setValues({ location_ids: 'default', country: 'India' });
          setEditId(null);
          setDialog('add');
        }}
        filterFields={PARTNER_FILTER_FIELDS}
        filters={filters}
        defaultFilters={DEFAULT_PARTNER_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load partners.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 && <p>No partners found.</p>}
      <PartyCardGrid>
        {pageRows.map((row) => {
          const bal = formatBalance(Number(row.current_balance ?? 0));
          const phone = String(row.phone_number || '').trim();
          return (
            <PartyCard
              key={String(row.id)}
              title={displayName(row, ['partner_name'], 'Unnamed partner')}
              captions={[phone ? `📞 ${phone}` : 'No phone on file']}
              badges={[{ label: bal.label, tone: bal.tone }]}
              onEdit={() => {
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
                  location_ids: Array.isArray(row.location_ids)
                    ? (row.location_ids as string[]).join(', ')
                    : 'default',
                });
                setDialog('edit');
              }}
              onView={() => navigate(`/parties/delivery-partners/${row.id}`)}
            />
          );
        })}
      </PartyCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
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
        <PartnerForm values={values} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} />
      </Modal>
    </div>
  );
}

export function DeliveryPartnerDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetDeliveryPartnerQuery(id, { skip: !id });
  const summary = useGetDeliveryPartnerSummaryQuery(id, { skip: !id });
  const [update] = useUpdateDeliveryPartnerMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [values, setValues] = useState<PartyFormValues>({});

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p style={{ color: '#b00020' }}>Partner not found.</p>;

  return (
    <div>
      <p>
        <Link to="/parties/delivery-partners">← Delivery partners</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{String(data.partner_name)}</h2>
      <StatusBanner>Outstanding: {String(summary.data?.balance ?? 0)}</StatusBanner>
      <DisabledModuleNote />
      <Button
        onClick={() => {
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
            location_ids: Array.isArray(data.location_ids) ? (data.location_ids as string[]).join(', ') : 'default',
          });
          setEditOpen(true);
        }}
      >
        Edit
      </Button>
      <Modal
        title="Edit Partner"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                await update({ id, body: partnerBody(values) });
                setEditOpen(false);
                refetch();
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
        <PartnerForm values={values} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} />
      </Modal>
    </div>
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
  const { data = [], isLoading, error, refetch } = useListCommissionAgentsQuery();
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
    location_ids: 'default',
  });
  const [formError, setFormError] = useState('');

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
    try {
      if (dialog === 'add') await create(agentBody(values)).unwrap();
      else if (dialog === 'edit' && editId) await update({ id: editId, body: agentBody(values) }).unwrap();
      setDialog(null);
      refetch();
    } catch {
      setFormError('Save failed');
    }
  }

  return (
    <div>
      <ListToolbar
        title="Commission agents"
        countLabel="agents"
        count={filtered.length}
        primaryLabel="Add Agent"
        onPrimary={() => {
          setValues({ country: 'India', registration_type: 'Unregistered', location_ids: 'default' });
          setEditId(null);
          setDialog('add');
        }}
        filterFields={AGENT_FILTER_FIELDS}
        filters={filters}
        defaultFilters={DEFAULT_AGENT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load agents.</ErrorText> : null}
      {!isLoading && pageRows.length === 0 && <p>No agents found.</p>}
      <PartyCardGrid>
        {pageRows.map((row) => {
          const bal = formatBalance(Number(row.current_balance ?? 0));
          const phone = String(row.phone_number || '').trim();
          return (
            <PartyCard
              key={String(row.id)}
              title={displayName(row, ['agent_name'], 'Unnamed agent')}
              captions={[phone ? `📞 ${phone}` : 'No phone on file']}
              badges={[{ label: bal.label, tone: bal.tone }]}
              onEdit={() => {
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
                  location_ids: Array.isArray(row.location_ids)
                    ? (row.location_ids as string[]).join(', ')
                    : 'default',
                });
                setDialog('edit');
              }}
              onView={() => navigate(`/parties/commission-agents/${row.id}`)}
            />
          );
        })}
      </PartyCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
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
        <AgentForm values={values} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} />
      </Modal>
    </div>
  );
}

export function CommissionAgentDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCommissionAgentQuery(id, { skip: !id });
  const summary = useGetCommissionAgentSummaryQuery(id, { skip: !id });
  const [update] = useUpdateCommissionAgentMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [values, setValues] = useState<PartyFormValues>({});

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p style={{ color: '#b00020' }}>Agent not found.</p>;

  return (
    <div>
      <p>
        <Link to="/parties/commission-agents">← Commission agents</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{String(data.agent_name)}</h2>
      <StatusBanner>Payable: {String(summary.data?.balance ?? 0)}</StatusBanner>
      <DisabledModuleNote />
      <Button
        onClick={() => {
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
            location_ids: Array.isArray(data.location_ids) ? (data.location_ids as string[]).join(', ') : 'default',
          });
          setEditOpen(true);
        }}
      >
        Edit
      </Button>
      <Modal
        title="Edit Agent"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                await update({ id, body: agentBody(values) });
                setEditOpen(false);
                refetch();
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
        <AgentForm values={values} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} />
      </Modal>
    </div>
  );
}
