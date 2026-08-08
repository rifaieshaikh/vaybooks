import { useMemo, useState } from 'react';
import {
  useCreateFinanceCreditNoteMutation,
  useCreateFinanceDebitNoteMutation,
  useCreateFinanceJournalMutation,
  useCreateFinancePaymentMutation,
  useCreateFinanceReceiptMutation,
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
  EntityCard,
  EntityCardGrid,
  ErrorText,
  FormRow,
  ListToolbar,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../utils';


const DEFAULT_FILTERS = { voucher_number: '', description: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'voucher_date', desc: true }];

function useVoucherList(data: Record<string, unknown>[] | undefined) {
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
      if (!matchesRegex(row.description, filters.description)) return false;
      return true;
    });
    return sortRows(next, sort);
  }, [rows, filters, sort]);
  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);
  return { filters, setFilters, sort, setSort, page, setPage, filterFields, filtered, pages, pageRows };
}

function VoucherCards({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <EntityCardGrid>
      {rows.map((row) => {
        const desc = asCaption(row.description);
        const party = asCaption(row.party_name);
        return (
          <EntityCard
            key={String(row.id)}
            title={asCaption(row.voucher_number) || asCaption(row.caption) || String(row.id)}
            captions={[
              asCaption(row.voucher_type),
              asCaption(row.voucher_date).slice(0, 10),
              formatMoney(Number(row.amount ?? 0)),
              party,
              // Only show short human description; never dump SOR JSON payloads
              desc && desc.length <= 80 && desc !== party ? desc : '',
            ].filter(Boolean)}
          />
        );
      })}
    </EntityCardGrid>
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
  const { data = [], isLoading, error, refetch } = useListFinanceReceiptsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const [createReceipt, createState] = useCreateFinanceReceiptMutation();
  const list = useVoucherList(data);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    receiving_account_id: '',
    customer_account_id: '',
    amount: '',
    description: '',
    location_id: 'default',
  });

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

  return (
    <div>
      <ListToolbar
        title="Receipts"
        countLabel="receipts"
        count={list.filtered.length}
        primaryLabel="Record Receipt"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={list.filterFields}
        filters={list.filters}
        defaultFilters={DEFAULT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load receipts.</ErrorText> : null}
      {!isLoading && !error && list.pageRows.length === 0 && <p>No receipts found.</p>}
      <VoucherCards rows={list.pageRows} />
      <PaginationBar page={Math.min(list.page, list.pages)} pageCount={list.pages} onPage={list.setPage} />
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
    </div>
  );
}

export function PaymentsListPage() {
  const { data = [], isLoading, error, refetch } = useListFinancePaymentsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
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

  return (
    <div>
      <ListToolbar
        title="Payments"
        countLabel="payments"
        count={list.filtered.length}
        primaryLabel="Record Payment"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={list.filterFields}
        filters={list.filters}
        defaultFilters={DEFAULT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load payments.</ErrorText> : null}
      {!isLoading && !error && list.pageRows.length === 0 && <p>No payments found.</p>}
      <VoucherCards rows={list.pageRows} />
      <PaginationBar page={Math.min(list.page, list.pages)} pageCount={list.pages} onPage={list.setPage} />
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
    </div>
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

  return (
    <div>
      <ListToolbar
        title={title}
        countLabel="notes"
        count={list.filtered.length}
        primaryLabel={`Create ${kind === 'credit' ? 'Credit' : 'Debit'} Note`}
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={list.filterFields}
        filters={list.filters}
        defaultFilters={DEFAULT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load notes.</ErrorText> : null}
      {!isLoading && !error && list.pageRows.length === 0 && <p>No notes found.</p>}
      <VoucherCards rows={list.pageRows} />
      <PaginationBar page={Math.min(list.page, list.pages)} pageCount={list.pages} onPage={list.setPage} />
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
    </div>
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
    <div>
      <ListToolbar
        title="Accounting Invoices"
        countLabel="invoices"
        count={list.filtered.length}
        primaryLabel="Refresh"
        onPrimary={() => undefined}
        filterFields={list.filterFields}
        filters={list.filters}
        defaultFilters={DEFAULT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load invoices.</ErrorText> : null}
      {!isLoading && !error && list.pageRows.length === 0 && <p>No accounting invoices found.</p>}
      <VoucherCards rows={list.pageRows} />
      <PaginationBar page={Math.min(list.page, list.pages)} pageCount={list.pages} onPage={list.setPage} />
    </div>
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

  return (
    <div>
      <ListToolbar
        title="Journal"
        countLabel="entries"
        count={list.filtered.length}
        primaryLabel="Journal Entry"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={list.filterFields}
        filters={list.filters}
        defaultFilters={DEFAULT_FILTERS}
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
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load journal.</ErrorText> : null}
      {!isLoading && !error && list.pageRows.length === 0 && <p>No journal entries found.</p>}
      <VoucherCards rows={list.pageRows} />
      <PaginationBar page={Math.min(list.page, list.pages)} pageCount={list.pages} onPage={list.setPage} />
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
    </div>
  );
}
