import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useDeletePurchaseBillMutation,
  useGetPurchaseBillQuery,
  useListPurchaseBillsQuery,
} from '@vaybooks/store';
import {
  Button,
  DocumentDetail,
  EntityListActions,
  EntityListEmpty,
  EntityListFilterSort,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListRefreshing,
  EntityListTable,
  ErrorText,
  PaginationBar,
  type DocumentDetailAction,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';
import { canEditInvoiceMonth } from '../editors/linePreview';
import {
  buildFacts,
  dateCaption,
  mapDocLines,
  moneySummaryFromDoc,
  notesFromDoc,
} from './documentDetailHelpers';
import {
  DATE_RANGE_FIELDS,
  PAGE_SIZE_OPTIONS,
  amountOf,
  balanceOf,
  currentMonthRange,
  dateKey,
  hasActiveListFilters,
  listHasField,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
  usePurchasesListState,
  useSyncedPage,
} from './purchasesListHelpers';

type BillFilters = {
  vendor_bill_number: string;
  vendor_name: string;
  voucher_number: string;
  has_voucher: string;
  month: string;
  unpaid: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: BillFilters = {
  vendor_bill_number: '',
  vendor_name: '',
  voucher_number: '',
  has_voucher: '',
  month: '',
  unpaid: '',
  date_from: '',
  date_to: '',
};

const DEFAULT_SORT: SortCriterion[] = [{ key: 'bill_date', desc: true }];

export function PurchaseBillsListPage() {
  const navigate = useNavigate();

  const list = usePurchasesListState({
    defaultFilters: DEFAULT_FILTERS,
    defaultSort: DEFAULT_SORT,
    monthFilterKey: 'month',
    applyChip: (chip, filters) => {
      if (chip === 'yes' || chip === 'no') {
        return { ...filters, has_voucher: chip, month: '', unpaid: '' };
      }
      if (chip === 'month') return { ...filters, month: 'current', has_voucher: '', unpaid: '' };
      if (chip === 'unpaid') return { ...filters, unpaid: '1', has_voucher: '', month: '' };
      return { ...filters, has_voucher: '', month: '', unpaid: '' };
    },
  });

  const listArgs = useMemo(() => {
    const monthRange = list.filters.month === 'current' ? currentMonthRange() : null;
    return {
      q: list.search || undefined,
      vendor_bill_number: list.filters.vendor_bill_number || undefined,
      vendor_name: list.filters.vendor_name || undefined,
      voucher_number: list.filters.voucher_number || undefined,
      has_voucher: list.filters.has_voucher || undefined,
      unpaid: list.filters.unpaid === '1' ? '1' : undefined,
      date_from: monthRange?.date_from || list.filters.date_from || undefined,
      date_to: monthRange?.date_to || list.filters.date_to || undefined,
      ...sortQueryParams(list.sort),
      page: list.page,
      page_size: list.pageSize,
    };
  }, [list.search, list.filters, list.sort, list.page, list.pageSize]);

  const { data, isLoading, isFetching, error, refetch } = useListPurchaseBillsQuery(listArgs);

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, list.pageSize);
  useSyncedPage(list.page, pages, list.setPage);

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const vid = list.params.get('vendor_id');
      navigate(vid ? `/purchases/bills/new?vendor_id=${vid}` : '/purchases/bills/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const showDue = useMemo(() => listHasField(pageRows, 'due_date'), [pageRows]);
  const showBalance = useMemo(
    () => listHasField(pageRows, 'outstanding', 'balance_due'),
    [pageRows],
  );

  const pageAmount = useMemo(
    () => pageRows.reduce((s, r) => s + amountOf(r), 0),
    [pageRows],
  );

  const pageOpenBalance = useMemo(
    () => pageRows.reduce((s, r) => s + Math.max(0, balanceOf(r) ?? 0), 0),
    [pageRows],
  );

  const chips = useMemo(() => {
    const base = [
      { id: 'all', label: 'All' },
      { id: 'month', label: 'This month' },
      { id: 'yes', label: 'Has voucher' },
      { id: 'no', label: 'No voucher' },
    ];
    if (showBalance) base.splice(2, 0, { id: 'unpaid', label: 'Unpaid' });
    return base;
  }, [showBalance]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'vendor_bill_number', label: 'Vendor bill #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'voucher_number', label: 'Voucher #', type: 'text' },
      ...DATE_RANGE_FIELDS,
    ],
    [],
  );

  const filtersActive = hasActiveListFilters(list.search, list.filters, DEFAULT_FILTERS);

  type BillRow = (typeof pageRows)[number];

  const columns: EntityListColumn<BillRow>[] = useMemo(() => {
    const cols: EntityListColumn<BillRow>[] = [
      {
        id: 'bill',
        header: 'Bill #',
        render: (row) => (
          <div className="el-customer-meta">
            <button
              type="button"
              className="el-doc-link"
              onClick={() => navigate(`/purchases/bills/${row.id}`)}
            >
              {asCaption(row.vendor_bill_number) ||
                asCaption(row.voucher_number) ||
                String(row.id)}
            </button>
            {asCaption(row.voucher_number) && asCaption(row.vendor_bill_number) ? (
              <span className="el-customer-sub">{asCaption(row.voucher_number)}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) =>
          asCaption(row.vendor_name || row.party_name) || <span className="el-muted">—</span>,
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) =>
          dateKey(row.bill_date || row.voucher_date) || <span className="el-muted">—</span>,
      },
    ];
    if (showDue) {
      cols.push({
        id: 'due',
        header: 'Due',
        render: (row) => {
          const due = dateKey(row.due_date);
          if (!due) return <span className="el-muted">—</span>;
          const overdue = due < new Date().toISOString().slice(0, 10) && amountOf(row) > 0;
          return <span className={overdue ? 'el-due' : undefined}>{due}</span>;
        },
      });
    }
    cols.push({
      id: 'amount',
      header: 'Amount',
      className: 'el-num',
      headerClassName: 'el-col-num',
      render: (row) => formatMoney(amountOf(row)),
    });
    if (showBalance) {
      cols.push({
        id: 'balance',
        header: 'Balance',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const bal = balanceOf(row);
          if (bal == null) return <span className="el-muted">—</span>;
          return <span className={bal > 0.01 ? 'el-due' : 'el-settled'}>{formatMoney(bal)}</span>;
        },
      });
    }
    return cols;
  }, [navigate, showDue, showBalance]);

  const goNew = () => {
    const vid = list.params.get('vendor_id');
    navigate(vid ? `/purchases/bills/new?vendor_id=${vid}` : '/purchases/bills/new');
  };

  function setChip(id: string) {
    list.setFilters((prev) => {
      const next = { ...prev, has_voucher: '', month: '', unpaid: '' };
      if (id === 'yes' || id === 'no') next.has_voucher = id;
      else if (id === 'month') next.month = 'current';
      else if (id === 'unpaid') next.unpaid = '1';
      return next;
    });
  }

  const chipValue =
    list.filters.month === 'current'
      ? 'month'
      : list.filters.unpaid === '1'
        ? 'unpaid'
        : list.filters.has_voucher || 'all';

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Purchases"
        title="Purchase Bills"
        count={
          <>
            {total} {total === 1 ? 'bill' : 'bills'}
          </>
        }
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              New bill
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search bill #, vendor, amount…"
            aria-label="Search bills"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Bill filters"
            value={chipValue}
            onChange={setChip}
            options={chips}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={list.filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['has_voucher', 'month', 'unpaid']}
            onFiltersChange={(next) => list.setFilters(next as BillFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'bill_date', label: 'Date' },
              { value: 'net', label: 'Amount' },
              { value: 'vendor_bill_number', label: 'Bill #' },
            ]}
            onSortChange={list.setSort}
          />
        }
        summary={
          <div className="el-pulse">
            <span>
              Showing <strong>{total}</strong>
            </span>
            <span>
              This page <strong>{formatMoney(pageAmount)}</strong>
            </span>
            {showBalance ? (
              <span className="el-pulse-due">
                Open balance <strong>{formatMoney(pageOpenBalance)}</strong>
              </span>
            ) : null}
          </div>
        }
      />

      {isFetching && !isLoading ? <EntityListRefreshing /> : null}
      {isLoading ? <EntityListLoading>Loading bills…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load bills.</ErrorText> : null}

      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          {filtersActive ? (
            <>
              <strong>No matches</strong>
              <p>Try clearing search or filters.</p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  list.setSearch('');
                  list.setFilters({ ...DEFAULT_FILTERS });
                }}
              >
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <strong>No bills yet</strong>
              <p>Create a bill to record a vendor purchase.</p>
              <Button type="button" onClick={goNew}>
                New bill
              </Button>
            </>
          )}
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/purchases/bills/${row.id}`)}
          onEditRow={(row) => navigate(`/purchases/bills/${row.id}/edit`)}
          onNew={goNew}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/purchases/bills/${row.id}`)}
              onEdit={() => navigate(`/purchases/bills/${row.id}/edit`)}
            />
          )}
        />
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-page-size">
            <label>
              Rows{' '}
              <select
                value={list.pageSize}
                onChange={(e) =>
                  list.setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                }
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="el-foot-pager">
            <PaginationBar
              page={Math.min(list.page, pages)}
              pageCount={pages}
              onPage={list.setPage}
            />
          </div>
        </EntityListFoot>
      ) : null}
    </EntityListPage>
  );
}

export function PurchaseBillDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetPurchaseBillQuery(id, { skip: !id });
  const [deleteBill, deleteState] = useDeletePurchaseBillMutation();

  const lines = useMemo(
    () => mapDocLines(data?.lines || data?.items),
    [data],
  );
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  if (isLoading) return <EntityListLoading>Loading bill…</EntityListLoading>;
  if (error || !data) return <ErrorText>Purchase bill not found.</ErrorText>;

  const dateStr = dateCaption(data.bill_date || data.voucher_date);
  const editable = canEditInvoiceMonth(dateStr);
  const party = asCaption(data.vendor_name || data.party_name) || '—';
  const poId = asCaption(data.purchase_order_id);
  const poLabel = asCaption(data.po_number) || poId;
  const grnId = asCaption(data.reference_grn_id || data.grn_id);
  const grnLabel = asCaption(data.grn_number) || grnId;

  const actions: DocumentDetailAction[] = [
    {
      id: 'edit',
      label: 'Edit',
      variant: 'ghost',
      disabled: !editable,
      title: editable ? 'Edit bill' : 'Bills can only be edited in the same calendar month',
      onClick: () => navigate(`/purchases/bills/${id}/edit`),
    },
    {
      id: 'delete',
      label: deleteState.isLoading ? 'Deleting…' : 'Delete',
      variant: 'ghost',
      kbAction: 'purchases.bills.delete',
      disabled: deleteState.isLoading,
      onClick: async () => {
        if (!window.confirm('Delete this purchase bill? This cannot be undone.')) return;
        try {
          await deleteBill(id).unwrap();
          navigate('/purchases/bills');
        } catch {
          window.alert('Failed to delete bill.');
        }
      },
    },
  ];

  const related = [
    poId ? { id: 'po', label: `PO ${poLabel}`, to: `/purchases/orders/${poId}` } : null,
    grnId
      ? { id: 'grn', label: `GRN ${grnLabel}`, to: `/purchases/goods-receipt/${grnId}` }
      : null,
  ].filter(Boolean) as { id: string; label: string; to: string }[];

  return (
    <DocumentDetail
      backTo="/purchases/bills"
      backLabel="Bills"
      kicker="Purchase bill"
      title={asCaption(data.vendor_bill_number) || asCaption(data.voucher_number) || id}
      status={asCaption(data.status || data.payment_status) || undefined}
      party={party}
      facts={buildFacts([
        ['Bill date', dateStr],
        ['Due date', dateCaption(data.due_date)],
        ['Payment', asCaption(data.payment_mode || data.payment_status)],
        ['Vendor GSTIN', asCaption(data.vendor_gstin || data.gstin)],
        ['Voucher', asCaption(data.voucher_number)],
      ])}
      related={related.length ? related : undefined}
      actions={actions}
      error={!editable ? 'Edit is locked — bill date is outside the current month.' : null}
      notes={notesFromDoc(data as Record<string, unknown>)}
      lines={lines}
      summary={
        summary.length
          ? summary
          : [{ label: 'Grand total', value: Number(data.total ?? data.amount ?? 0) }]
      }
    />
  );
}
