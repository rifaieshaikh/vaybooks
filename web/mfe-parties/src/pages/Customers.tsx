import { Button, ErrorText, FormRow, TextInput, StatusBanner } from '@vaybooks/ui-kit';
import {
  useBlacklistCustomerMutation,
  useCreateCustomerMutation,
  useGetCustomerQuery,
  useGetCustomerSummaryQuery,
  useListCustomersQuery,
  useListPartySegmentsQuery,
  useSettleCustomerMutation,
  useUpdateCustomerMutation,
} from '@vaybooks/store';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { CustomerFormFields, customerBody, customerToForm, emptyCustomerForm } from '../components/CustomerFormFields';
import { Modal } from '../components/Modal';
import { PartyCard, PartyCardGrid, formatBalance } from '../components/PartyCard';
import {
  ListToolbar,
  PAGE_SIZE,
  PaginationBar,
  type FilterFieldDef,
  type SortCriterion,
} from '../components/ListToolbar';
import { DisabledModuleNote, REGISTRATION_TYPES, type PartyFormValues } from '../components/PartyFields';
import { displayName, matchesRegex, pageCount, paginate, sortRows } from '../components/listUtils';

const DEFAULT_CUSTOMER_FILTERS = {
  customer_name: '',
  phone_number: '',
  alternate_phone_number: '',
  gstin: '',
  registration_type: '',
  segment_id: '',
  has_orders: '',
};

const DEFAULT_CUSTOMER_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

export function CustomersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListCustomersQuery();
  const { data: segments = [] } = useListPartySegmentsQuery({ applies_to: 'customer', active_only: true });
  const [createCustomer, createState] = useCreateCustomerMutation();
  const [updateCustomer, updateState] = useUpdateCustomerMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_CUSTOMER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_CUSTOMER_FILTERS });

  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [values, setValues] = useState<PartyFormValues>(emptyCustomerForm());
  const [formError, setFormError] = useState('');

  const segmentOptions = useMemo(
    () =>
      segments
        .filter((s) => s.is_active !== false)
        .map((s) => ({ id: String(s.id), name: String(s.name || s.id) })),
    [segments],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'customer_name', label: 'Customer name', type: 'text' },
      { key: 'phone_number', label: 'Phone', type: 'text' },
      { key: 'alternate_phone_number', label: 'Alternate phone', type: 'text' },
      { key: 'gstin', label: 'GSTIN', type: 'text' },
      {
        key: 'registration_type',
        label: 'Registration type',
        type: 'select',
        options: REGISTRATION_TYPES.map((t) => ({ value: t, label: t })),
      },
      {
        key: 'segment_id',
        label: 'Segment',
        type: 'select',
        options: segmentOptions.map((s) => ({ value: s.id, label: s.name })),
      },
      {
        key: 'has_orders',
        label: 'Has orders',
        type: 'select',
        options: [
          { value: 'with', label: 'With orders' },
          { value: 'without', label: 'Without orders' },
        ],
      },
    ],
    [segmentOptions],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (!matchesRegex(row.phone_number, filters.phone_number)) return false;
      if (!matchesRegex(row.alternate_phone_number, filters.alternate_phone_number)) return false;
      if (!matchesRegex(row.gstin, filters.gstin)) return false;
      if (filters.registration_type && String(row.registration_type || '') !== filters.registration_type) {
        return false;
      }
      if (filters.segment_id) {
        const ids = Array.isArray(row.segment_ids) ? (row.segment_ids as string[]) : [];
        if (!ids.includes(filters.segment_id)) return false;
      }
      const oc = Number(row.order_count ?? 0);
      if (filters.has_orders === 'with' && oc <= 0) return false;
      if (filters.has_orders === 'without' && oc > 0) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  function setField(name: string, value: string) {
    setValues((p) => ({ ...p, [name]: value }));
  }

  function openAdd() {
    setFormError('');
    setValues(emptyCustomerForm());
    setEditId(null);
    setDialog('add');
  }

  function openEdit(row: Record<string, unknown>) {
    setFormError('');
    setEditId(String(row.id));
    setValues(customerToForm(row));
    setDialog('edit');
  }

  async function submitForm() {
    setFormError('');
    try {
      if (dialog === 'add') {
        await createCustomer(customerBody(values)).unwrap();
      } else if (dialog === 'edit' && editId) {
        await updateCustomer({ id: editId, body: customerBody(values) }).unwrap();
      }
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

  return (
    <div>
      <ListToolbar
        title="Customers"
        countLabel="customers"
        count={filtered.length}
        primaryLabel="Add Customer"
        onPrimary={openAdd}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_CUSTOMER_FILTERS}
        onFiltersChange={(next) => {
          setFilters(next as typeof filters);
          setPage(1);
        }}
        sort={sort}
        defaultSort={DEFAULT_CUSTOMER_SORT}
        sortOptions={[
          { value: 'created_at', label: 'Created' },
          { value: 'customer_name', label: 'Customer name' },
          { value: 'order_count', label: 'Order count' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      <div style={{ marginBottom: 8 }}>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load customers. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 && <p>No customers found.</p>}

      <PartyCardGrid>
        {pageRows.map((row) => {
          const bal = formatBalance(Number(row.current_balance ?? 0));
          const badges = [
            { label: `${Number(row.order_count ?? 0)} orders`, tone: 'blue' as const },
            { label: bal.label, tone: bal.tone },
          ];
          if (row.is_blacklisted) badges.push({ label: 'Blacklisted', tone: 'red' });
          const phone = String(row.phone_number || '').trim();
          const captions = [
            phone ? `📞 ${phone}` : 'No phone on file',
            row.gstin ? `GSTIN: ${String(row.gstin)}` : '',
          ].filter(Boolean);
          return (
            <PartyCard
              key={String(row.id)}
              title={displayName(row, ['customer_name'], 'Unnamed customer')}
              captions={captions}
              badges={badges}
              onEdit={() => openEdit(row)}
              onView={() => navigate(`/parties/customers/${row.id}`)}
            />
          );
        })}
      </PartyCardGrid>

      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />

      <Modal
        title={dialog === 'edit' ? 'Edit Customer' : 'Add Customer'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" onClick={() => void submitForm()} disabled={createState.isLoading || updateState.isLoading}>
              {dialog === 'edit' ? 'Save Changes' : 'Create Customer'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <CustomerFormFields values={values} onChange={setField} segmentOptions={segmentOptions} />
      </Modal>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCustomerQuery(id, { skip: !id });
  const summary = useGetCustomerSummaryQuery(id, { skip: !id });
  const { data: segments = [] } = useListPartySegmentsQuery({ applies_to: 'customer', active_only: false });
  const [updateCustomer] = useUpdateCustomerMutation();
  const [blacklist] = useBlacklistCustomerMutation();
  const [settle] = useSettleCustomerMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [settleAmt, setSettleAmt] = useState('0');
  const [values, setValues] = useState<PartyFormValues>(emptyCustomerForm());
  const [formError, setFormError] = useState('');

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p style={{ color: '#b00020' }}>Customer not found.</p>;

  const segmentOptions = segments.map((s) => ({ id: String(s.id), name: String(s.name || s.id) }));
  const s = summary.data || {};

  return (
    <div>
      <p>
        <Link to="/parties/customers">← Customers</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{String(data.customer_name)}</h2>
      <p>
        Phone: {String(data.phone_number)} · GSTIN: {String(data.gstin || '—')}
        {data.is_blacklisted ? ' · BLACKLISTED' : ''}
      </p>
      <StatusBanner>
        Balance: {String(s.balance ?? 0)} · Receivable: {String(s.receivable_balance ?? 0)} · Credit:{' '}
        {String(s.credit_balance ?? 0)}
      </StatusBanner>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Button variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
        <Button
          onClick={() => {
            setValues(customerToForm(data));
            setFormError('');
            setEditOpen(true);
          }}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await blacklist({
              id,
              blacklisted: !data.is_blacklisted,
              reason: data.is_blacklisted ? '' : 'Blocked from UI',
            });
            refetch();
            summary.refetch();
          }}
        >
          {data.is_blacklisted ? 'Remove blacklist' : 'Blacklist'}
        </Button>
      </div>
      <DisabledModuleNote />
      <div style={{ maxWidth: 360, marginBottom: 16 }}>
        <FormRow label="Settle amount (park)">
          <TextInput value={settleAmt} type="number" onChange={(e) => setSettleAmt(e.target.value)} />
        </FormRow>
        <Button
          onClick={async () => {
            await settle({ id, amount: Number(settleAmt) || 0, mode: 'park' });
            summary.refetch();
          }}
        >
          Park settlement
        </Button>
      </div>
      <pre style={{ background: '#f5f5f5', padding: 12, overflow: 'auto', fontSize: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>

      <Modal
        title="Edit Customer"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                try {
                  await updateCustomer({ id, body: customerBody(values) }).unwrap();
                  setEditOpen(false);
                  refetch();
                } catch (e: unknown) {
                  const msg =
                    e && typeof e === 'object' && 'data' in e
                      ? String((e as { data?: { detail?: string } }).data?.detail || 'Save failed')
                      : 'Save failed';
                  setFormError(msg);
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
        <CustomerFormFields
          values={values}
          onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
          segmentOptions={segmentOptions}
        />
      </Modal>
    </div>
  );
}
