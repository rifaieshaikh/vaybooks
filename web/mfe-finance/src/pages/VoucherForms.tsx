import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateFinanceCreditNoteMutation,
  useCreateFinanceDebitNoteMutation,
  useCreateFinanceJournalMutation,
  useCreateFinancePaymentMutation,
  useCreateFinanceReceiptMutation,
  useGetVendorSummaryQuery,
  useListAccountingInvoicesQuery,
  useListFinanceAccountsQuery,
  useListFinanceCreditNotesQuery,
  useListFinanceDebitNotesQuery,
  useListFinanceJournalQuery,
  useListFinancePaymentsQuery,
  useListFinanceReceiptsQuery,
} from '@vaybooks/store';
import {
  Button,
  EntityListEmpty,
  EntityListFilterSort,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  type EntityListQuickFilter,
  ErrorText,
  FormRow,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../utils';

const DEFAULT_FILTERS = { voucher_number: '', voucher_type: '', description: '', amount: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'voucher_date', desc: true }];

const AMOUNT_CHIPS: EntityListQuickFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'with', label: 'With amount' },
  { id: 'zero', label: 'Zero' },
];

const PAYMENT_TYPE_CHIPS: EntityListQuickFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'Payment', label: 'Payment' },
  { id: 'Vendor Payment', label: 'Vendor' },
  { id: 'Salary Payment', label: 'Salary' },
  { id: 'Commission Payment', label: 'Commission' },
];

const INVOICE_TYPE_CHIPS: EntityListQuickFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'Sales Invoice', label: 'Sales' },
  { id: 'Customization Invoice', label: 'Customization' },
  { id: 'Purchase Bill', label: 'Purchase Bill' },
  { id: 'Purchase Expense', label: 'Expense' },
];

type VoucherRow = Record<string, unknown>;

function useVoucherList(data: VoucherRow[] | undefined) {
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'voucher_number', label: 'Number', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
    ],
    [],
  );
  const filtered = useMemo(() => {
    const next = rows.filter((row) => {
      if (!matchesRegex(row.voucher_number, filters.voucher_number)) return false;
      if (filters.voucher_type && String(row.voucher_type || '') !== filters.voucher_type) return false;
      if (!matchesRegex(row.description, filters.description)) return false;
      const amount = Number(row.amount ?? 0);
      if (filters.amount === 'with' && !(Math.abs(amount) > 0.01)) return false;
      if (filters.amount === 'zero' && Math.abs(amount) >= 0.01) return false;
      return true;
    });
    return sortRows(next, sort);
  }, [rows, filters, sort]);
  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);
  return { filters, setFilters, sort, setSort, page, setPage, filterFields, filtered, pages, pageRows };
}

const VOUCHER_COLUMNS: EntityListColumn<VoucherRow>[] = [
  {
    id: 'voucher',
    header: 'Voucher',
    render: (row) => {
      const number = asCaption(row.voucher_number) || asCaption(row.caption) || String(row.id);
      const type = asCaption(row.voucher_type);
      return (
        <div className="el-customer">
          <div className="el-customer-meta">
            <span className="el-customer-name">{number}</span>
            <span className="el-customer-sub">{type || 'No type'}</span>
          </div>
        </div>
      );
    },
  },
  {
    id: 'date',
    header: 'Date',
    render: (row) => asCaption(row.voucher_date).slice(0, 10) || '—',
  },
  {
    id: 'amount',
    header: 'Amount',
    className: 'el-num',
    headerClassName: 'el-col-num',
    render: (row) => formatMoney(Number(row.amount ?? 0)),
  },
  {
    id: 'party',
    header: 'Party',
    render: (row) => {
      const party = asCaption(row.party_name);
      return <span className={party ? undefined : 'el-muted'}>{party || '—'}</span>;
    },
  },
  {
    id: 'description',
    header: 'Description',
    render: (row) => {
      const desc = asCaption(row.description);
      const party = asCaption(row.party_name);
      // Only show short human description; never dump SOR JSON payloads
      if (!desc || desc.length > 80 || desc === party) {
        return <span className="el-muted">—</span>;
      }
      return <span title={desc}>{desc}</span>;
    },
  },
];

function VoucherListShell({
  kicker = 'Finance',
  title,
  countText,
  actions,
  onNew,
  list,
  isLoading,
  error,
  loadingLabel,
  emptyLabel,
  errorLabel,
  typeChips = AMOUNT_CHIPS,
  children,
}: {
  kicker?: string;
  title: string;
  countText: string;
  actions?: ReactNode;
  onNew?: () => void;
  list: ReturnType<typeof useVoucherList>;
  isLoading: boolean;
  error: unknown;
  loadingLabel: string;
  emptyLabel: string;
  errorLabel: string;
  typeChips?: EntityListQuickFilter[];
  children?: ReactNode;
}) {
  const multiType = typeChips.some((c) => c.id !== 'all') && typeChips.length > 1;
  const chipKey = multiType ? 'voucher_type' : 'amount';
  return (
    <EntityListPage>
      <EntityListHero
        kicker={kicker}
        title={title}
        count={countText}
        actions={actions}
        chips={
          <EntityListQuickFilters
            ariaLabel={multiType ? 'Voucher type' : 'Amount'}
            value={list.filters[chipKey] || 'all'}
            onChange={(id) => {
              list.setFilters((prev) => ({ ...prev, [chipKey]: id === 'all' ? '' : id }));
              list.setPage(1);
            }}
            options={typeChips}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={list.filterFields}
            filters={list.filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={[chipKey]}
            onFiltersChange={(next) => {
              list.setFilters(next as typeof list.filters);
              list.setPage(1);
            }}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'voucher_date', label: 'Date' },
              { value: 'amount', label: 'Amount' },
            ]}
            onSortChange={(next) => {
              list.setSort(next);
              list.setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>{loadingLabel}</EntityListLoading> : null}
      {error ? <ErrorText>{errorLabel}</ErrorText> : null}
      {!isLoading && !error && list.pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{emptyLabel}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && list.pageRows.length > 0 ? (
        <EntityListTable
          columns={VOUCHER_COLUMNS}
          rows={list.pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onNew={onNew}
        />
      ) : null}

      {!isLoading && !error && list.pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar
              page={Math.min(list.page, list.pages)}
              pageCount={list.pages}
              onPage={list.setPage}
            />
          </div>
        </EntityListFoot>
      ) : null}

      {children}
    </EntityListPage>
  );
}

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
  filter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accounts: Record<string, unknown>[];
  filter?: (a: Record<string, unknown>) => boolean;
}) {
  const opts = filter ? accounts.filter(filter) : accounts;
  return (
    <FormRow label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
      >
        <option value="">— Select —</option>
        {opts.map((a) => (
          <option key={String(a.id)} value={String(a.id)}>
            {String(a.account_name || a.name)} ({String(a.account_type)})
          </option>
        ))}
      </select>
    </FormRow>
  );
}

export function ReceiptsListPage() {
  const [params] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListFinanceReceiptsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const [createReceipt, createState] = useCreateFinanceReceiptMutation();
  const list = useVoucherList(data);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    receiving_account_id: '',
    customer_account_id: params.get('customer_account_id') || '',
    amount: '',
    description: '',
    location_id: 'default',
  });

  useEffect(() => {
    const acct = params.get('customer_account_id') || '';
    if (acct) {
      setForm((f) => ({ ...f, customer_account_id: acct }));
    }
    if (params.get('new') === '1') {
      setFormError('');
      setOpen(true);
    }
  }, [params]);

  async function submit() {
    setFormError('');
    try {
      await createReceipt({
        ...form,
        amount: Number(form.amount) || 0,
        description: form.description || 'Receipt',
      }).unwrap();
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  function openCreate() {
    setFormError('');
    setOpen(true);
  }

  return (
    <VoucherListShell
      title="Receipts"
      countText={`${list.filtered.length} ${list.filtered.length === 1 ? 'receipt' : 'receipts'}`}
      list={list}
      isLoading={isLoading}
      error={error}
      loadingLabel="Loading receipts…"
      emptyLabel="No receipts found."
      errorLabel="Failed to load receipts."
      onNew={openCreate}
      actions={
        <Button type="button" onClick={openCreate}>
          Record Receipt
        </Button>
      }
    >
      <Modal
        title="Record Receipt"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()} disabled={createState.isLoading}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <AccountSelect
            label="Receiving account"
            value={form.receiving_account_id}
            onChange={(v) => setForm({ ...form, receiving_account_id: v })}
            accounts={accounts}
            filter={(a) => String(a.account_type) === 'Asset' || Boolean(a.is_store_account)}
          />
          <AccountSelect
            label="Customer account"
            value={form.customer_account_id}
            onChange={(v) => setForm({ ...form, customer_account_id: v })}
            accounts={accounts}
          />
          <FormRow label="Amount">
            <TextInput value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </FormRow>
          <FormRow label="Description">
            <TextInput
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormRow>
        </div>
      </Modal>
    </VoucherListShell>
  );
}

export function PaymentsListPage() {
  const [params, setParams] = useSearchParams();
  const vendorIdParam = params.get('vendor_id') || '';
  const { data = [], isLoading, error, refetch } = useListFinancePaymentsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const vendorSummary = useGetVendorSummaryQuery(vendorIdParam, { skip: !vendorIdParam });
  const [createPayment, createState] = useCreateFinancePaymentMutation();
  const list = useVoucherList(data);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    payment_kind: 'vendor',
    paying_account_id: '',
    vendor_account_id: '',
    expense_account_id: '',
    amount: '',
    description: '',
    location_id: 'default',
  });

  useEffect(() => {
    const vendorAccountId = String(vendorSummary.data?.account_id || '');
    if (vendorIdParam) {
      setForm((f) => ({
        ...f,
        payment_kind: 'vendor',
        vendor_account_id: vendorAccountId,
      }));
    }
    if (params.get('new') === '1') {
      setFormError('');
      setOpen(true);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, vendorIdParam, vendorSummary.data?.account_id, setParams]);

  async function submit() {
    setFormError('');
    try {
      await createPayment({
        ...form,
        amount: Number(form.amount) || 0,
        description: form.description || 'Payment',
      }).unwrap();
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  function openCreate() {
    setFormError('');
    setOpen(true);
  }

  return (
    <VoucherListShell
      title="Payments"
      countText={`${list.filtered.length} ${list.filtered.length === 1 ? 'payment' : 'payments'}`}
      list={list}
      isLoading={isLoading}
      error={error}
      loadingLabel="Loading payments…"
      emptyLabel="No payments found."
      errorLabel="Failed to load payments."
      typeChips={PAYMENT_TYPE_CHIPS}
      onNew={openCreate}
      actions={
        <Button type="button" data-kb-action="vendors.record_payment" onClick={openCreate}>
          Record Payment
        </Button>
      }
    >
      <Modal
        title="Record Payment"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()} disabled={createState.isLoading}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Kind">
            <select
              value={form.payment_kind}
              onChange={(e) => setForm({ ...form, payment_kind: e.target.value })}
              style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
            >
              <option value="vendor">Vendor</option>
              <option value="expense">Expense (journal)</option>
            </select>
          </FormRow>
          <AccountSelect
            label="Paying account"
            value={form.paying_account_id}
            onChange={(v) => setForm({ ...form, paying_account_id: v })}
            accounts={accounts}
            filter={(a) => String(a.account_type) === 'Asset' || Boolean(a.is_store_account)}
          />
          {form.payment_kind === 'vendor' ? (
            <AccountSelect
              label="Vendor account"
              value={form.vendor_account_id}
              onChange={(v) => setForm({ ...form, vendor_account_id: v })}
              accounts={accounts}
            />
          ) : null}
          <AccountSelect
            label="Expense account"
            value={form.expense_account_id}
            onChange={(v) => setForm({ ...form, expense_account_id: v })}
            accounts={accounts}
            filter={(a) => String(a.account_type) === 'Expense'}
          />
          <FormRow label="Amount">
            <TextInput value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </FormRow>
          <FormRow label="Description">
            <TextInput
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormRow>
        </div>
      </Modal>
    </VoucherListShell>
  );
}

function NotesPage({
  title,
  kind,
  data,
  isLoading,
  error,
  refetch,
  createNote,
  createLoading,
}: {
  title: string;
  kind: 'credit' | 'debit';
  data: Record<string, unknown>[] | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  createNote: (body: Record<string, unknown>) => { unwrap: () => Promise<unknown> };
  createLoading: boolean;
}) {
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const createState = { isLoading: createLoading };
  const list = useVoucherList(data);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    party_kind: 'customer',
    party_account_id: '',
    contra_account_id: '',
    amount: '',
    description: '',
  });

  async function submit() {
    setFormError('');
    try {
      await createNote({
        party_kind: form.party_kind,
        party_account_id: form.party_account_id,
        contra_account_id: form.contra_account_id || null,
        amount: Number(form.amount) || 0,
        description: form.description || `${title}`,
      }).unwrap();
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  function openCreate() {
    setFormError('');
    setOpen(true);
  }

  return (
    <VoucherListShell
      title={title}
      countText={`${list.filtered.length} ${list.filtered.length === 1 ? 'note' : 'notes'}`}
      list={list}
      isLoading={isLoading}
      error={error}
      loadingLabel="Loading notes…"
      emptyLabel="No notes found."
      errorLabel="Failed to load notes."
      onNew={openCreate}
      actions={
        <Button type="button" onClick={openCreate}>
          {`Create ${kind === 'credit' ? 'Credit' : 'Debit'} Note`}
        </Button>
      }
    >
      <Modal
        title={`Create ${title.slice(0, -1)}`}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()} disabled={createState.isLoading}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Party kind">
            <select
              value={form.party_kind}
              onChange={(e) => setForm({ ...form, party_kind: e.target.value })}
              style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
            >
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
            </select>
          </FormRow>
          <AccountSelect
            label="Party account"
            value={form.party_account_id}
            onChange={(v) => setForm({ ...form, party_account_id: v })}
            accounts={accounts}
          />
          <AccountSelect
            label="Contra account"
            value={form.contra_account_id}
            onChange={(v) => setForm({ ...form, contra_account_id: v })}
            accounts={accounts}
          />
          <FormRow label="Amount">
            <TextInput value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </FormRow>
          <FormRow label="Description">
            <TextInput
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormRow>
        </div>
      </Modal>
    </VoucherListShell>
  );
}

export function CreditNotesListPage() {
  const { data = [], isLoading, error, refetch } = useListFinanceCreditNotesQuery();
  const [createNote, createState] = useCreateFinanceCreditNoteMutation();
  return (
    <NotesPage
      title="Credit Notes"
      kind="credit"
      data={data}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      createNote={(body) => createNote(body)}
      createLoading={createState.isLoading}
    />
  );
}

export function DebitNotesListPage() {
  const { data = [], isLoading, error, refetch } = useListFinanceDebitNotesQuery();
  const [createNote, createState] = useCreateFinanceDebitNoteMutation();
  return (
    <NotesPage
      title="Debit Notes"
      kind="debit"
      data={data}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      createNote={(body) => createNote(body)}
      createLoading={createState.isLoading}
    />
  );
}

export function AccountingInvoicesListPage() {
  const { data = [], isLoading, error } = useListAccountingInvoicesQuery();
  const list = useVoucherList(data);
  return (
    <VoucherListShell
      title="Accounting Invoices"
      countText={`${list.filtered.length} ${list.filtered.length === 1 ? 'invoice' : 'invoices'}`}
      list={list}
      isLoading={isLoading}
      error={error}
      loadingLabel="Loading invoices…"
      emptyLabel="No accounting invoices found."
      errorLabel="Failed to load invoices."
      typeChips={INVOICE_TYPE_CHIPS}
    />
  );
}

export function JournalListPage() {
  const { data = [], isLoading, error, refetch } = useListFinanceJournalQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const [createJournal, createState] = useCreateFinanceJournalMutation();
  const list = useVoucherList(data);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [description, setDescription] = useState('');
  const [line1Account, setLine1Account] = useState('');
  const [line1Debit, setLine1Debit] = useState('');
  const [line2Account, setLine2Account] = useState('');
  const [line2Credit, setLine2Credit] = useState('');

  async function submit() {
    setFormError('');
    const debit = Number(line1Debit) || 0;
    const credit = Number(line2Credit) || debit;
    try {
      await createJournal({
        description: description || 'Journal',
        lines: [
          { account_id: line1Account, debit_amount: debit, credit_amount: 0 },
          { account_id: line2Account, debit_amount: 0, credit_amount: credit },
        ],
      }).unwrap();
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  function openCreate() {
    setFormError('');
    setOpen(true);
  }

  return (
    <VoucherListShell
      title="Journal"
      countText={`${list.filtered.length} ${list.filtered.length === 1 ? 'entry' : 'entries'}`}
      list={list}
      isLoading={isLoading}
      error={error}
      loadingLabel="Loading journal…"
      emptyLabel="No journal entries found."
      errorLabel="Failed to load journal."
      onNew={openCreate}
      actions={
        <Button type="button" onClick={openCreate}>
          Journal Entry
        </Button>
      }
    >
      <Modal
        title="Journal Entry"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => void submit()} disabled={createState.isLoading}>
              Post
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Description">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <AccountSelect label="Debit account" value={line1Account} onChange={setLine1Account} accounts={accounts} />
          <FormRow label="Debit amount">
            <TextInput value={line1Debit} onChange={(e) => setLine1Debit(e.target.value)} />
          </FormRow>
          <AccountSelect label="Credit account" value={line2Account} onChange={setLine2Account} accounts={accounts} />
          <FormRow label="Credit amount">
            <TextInput
              value={line2Credit}
              onChange={(e) => setLine2Credit(e.target.value)}
              placeholder="Defaults to debit amount"
            />
          </FormRow>
        </div>
      </Modal>
    </VoucherListShell>
  );
}
