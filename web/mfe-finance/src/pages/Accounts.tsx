import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateFinanceAccountMutation,
  useGetFinanceAccountQuery,
  useListFinanceAccountsQuery,
  useUpdateFinanceAccountMutation,
} from '@vaybooks/store';
import {
  Button,
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
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { ACCOUNT_TYPES, asCaption, extractError, formatMoney } from '../utils';

type AccountForm = {
  account_name: string;
  account_type: string;
  opening_balance: string;
  is_store_account: boolean;
  is_salary_account: boolean;
  is_active: boolean;
};

function emptyForm(): AccountForm {
  return {
    account_name: '',
    account_type: 'Asset',
    opening_balance: '0',
    is_store_account: false,
    is_salary_account: false,
    is_active: true,
  };
}

const DEFAULT_FILTERS = { account_name: '', account_type: '', active_only: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'account_name', desc: false }];

export function AccountsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListFinanceAccountsQuery();
  const [createAccount, createState] = useCreateFinanceAccountMutation();
  const [updateAccount, updateState] = useUpdateFinanceAccountMutation();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm());
  const [formError, setFormError] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'account_name', label: 'Name', type: 'text' },
      {
        key: 'account_type',
        label: 'Type',
        type: 'select',
        allLabel: 'All types',
        options: ACCOUNT_TYPES.map((t) => ({ value: t, label: t })),
      },
      {
        key: 'active_only',
        label: 'Active',
        type: 'select',
        allLabel: 'All',
        options: [
          { value: 'yes', label: 'Active only' },
          { value: 'no', label: 'Inactive only' },
        ],
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.account_name, filters.account_name)) return false;
      if (filters.account_type && String(row.account_type) !== filters.account_type) return false;
      if (filters.active_only === 'yes' && row.is_active === false) return false;
      if (filters.active_only === 'no' && row.is_active !== false) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type AccountRow = (typeof data)[number];

  function openAdd() {
    setFormError('');
    setEditId(null);
    setForm(emptyForm());
    setDialog('add');
  }

  function openEdit(row: AccountRow) {
    setFormError('');
    setEditId(String(row.id));
    setForm({
      account_name: String(row.account_name || ''),
      account_type: String(row.account_type || 'Asset'),
      opening_balance: String(row.opening_balance ?? 0),
      is_store_account: Boolean(row.is_store_account),
      is_salary_account: Boolean(row.is_salary_account),
      is_active: row.is_active !== false,
    });
    setDialog('edit');
  }

  async function submitForm() {
    setFormError('');
    if (!form.account_name.trim()) {
      setFormError('Account name is required');
      return;
    }
    const body = {
      account_name: form.account_name.trim(),
      account_type: form.account_type,
      opening_balance: Number(form.opening_balance) || 0,
      is_store_account: form.is_store_account,
      is_salary_account: form.is_salary_account,
      is_active: form.is_active,
    };
    try {
      if (dialog === 'add') {
        await createAccount(body).unwrap();
      } else if (dialog === 'edit' && editId) {
        await updateAccount({
          id: editId,
          body: {
            account_name: body.account_name,
            account_type: body.account_type,
            is_store_account: body.is_store_account,
            is_salary_account: body.is_salary_account,
            is_active: body.is_active,
            opening_balance: body.opening_balance,
          },
        }).unwrap();
      }
      setDialog(null);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  const columns: EntityListColumn<AccountRow>[] = useMemo(
    () => [
      {
        id: 'account',
        header: 'Account',
        render: (row) => {
          const name = displayName(row, ['account_name', 'name'], 'Account');
          const type = String(row.account_type || '').trim();
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{name}</span>
                <span className="el-customer-sub">{type || 'No type'}</span>
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
        render: (row) => formatMoney(Number(row.balance ?? row.current_balance ?? 0)),
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const inactive = row.is_active === false;
          return (
            <span className={inactive ? 'el-muted' : undefined}>
              {[
                row.is_store_account ? 'Store' : null,
                inactive ? 'Inactive' : 'Active',
              ]
                .filter(Boolean)
                .join(' · ')}
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
        kicker="Finance"
        title="Accounts"
        count={`${filtered.length} ${filtered.length === 1 ? 'account' : 'accounts'}`}
        actions={
          <Button type="button" onClick={openAdd}>
            Add Account
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.active_only || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, active_only: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'yes', label: 'Active' },
              { id: 'no', label: 'Inactive' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['active_only']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'account_name', label: 'Name' },
              { value: 'account_type', label: 'Type' },
              { value: 'balance', label: 'Balance' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading accounts…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load accounts.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No accounts found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/finance/accounts/${row.id}`)}
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
        title={dialog === 'edit' ? 'Edit Account' : 'Add Account'}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button
              type="button"
              onClick={() => void submitForm()}
              disabled={createState.isLoading || updateState.isLoading}
            >
              {dialog === 'edit' ? 'Save Changes' : 'Create Account'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <FormRow label="Name *">
            <TextInput
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            />
          </FormRow>
          <FormRow label="Type">
            <select
              value={form.account_type}
              onChange={(e) => setForm({ ...form, account_type: e.target.value })}
              style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Opening balance">
            <TextInput
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
            />
          </FormRow>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.is_store_account}
              onChange={(e) => setForm({ ...form, is_store_account: e.target.checked })}
            />
            Store account
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.is_salary_account}
              onChange={(e) => setForm({ ...form, is_salary_account: e.target.checked })}
            />
            Salary account
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active
          </label>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function AccountDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useGetFinanceAccountQuery(id, { skip: !id });
  const ledger = useMemo(
    () => (data && Array.isArray(data.ledger) ? (data.ledger as Record<string, unknown>[]) : []),
    [data],
  );

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Account not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/finance/accounts">← Accounts</Link>
      </p>
      <h2 style={{ margin: '8px 0 4px', color: 'var(--vb-color-primary, #185c4c)' }}>
        {String(data.account_name || '')}
      </h2>
      <p style={{ color: '#667', marginTop: 0 }}>
        {String(data.account_type || '')} · Balance {formatMoney(Number(data.balance ?? data.current_balance ?? 0))}
        {data.is_protected ? ' · Protected' : ''}
      </p>

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Ledger</h3>
      {ledger.length === 0 ? (
        <p style={{ color: '#667' }}>No ledger lines yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #d9e3de' }}>
              <th style={{ padding: 8 }}>Date</th>
              <th style={{ padding: 8 }}>Voucher</th>
              <th style={{ padding: 8 }}>Description</th>
              <th style={{ padding: 8 }}>Debit</th>
              <th style={{ padding: 8 }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((line, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eef2f0' }}>
                <td style={{ padding: 8 }}>{String(line.voucher_date || '').slice(0, 10)}</td>
                <td style={{ padding: 8 }}>{String(line.voucher_number || '')}</td>
                <td style={{ padding: 8 }}>{asCaption(line.description)}</td>
                <td style={{ padding: 8 }}>{formatMoney(Number(line.debit ?? 0))}</td>
                <td style={{ padding: 8 }}>{formatMoney(Number(line.credit ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
