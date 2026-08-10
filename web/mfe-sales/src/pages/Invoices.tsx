import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useGetSalesInvoiceQuery,
  useLazyGetSalesInvoicePdfQuery,
  useListSalesInvoicesQuery,
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
import { asCaption, extractError, formatMoney } from '../utils';
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
  useSalesListState,
  useSyncedPage,
} from './salesListHelpers';

type InvoiceFilters = {
  store_invoice_number: string;
  customer_name: string;
  voucher_number: string;
  has_voucher: string;
  month: string;
  unpaid: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: InvoiceFilters = {
  store_invoice_number: '',
  customer_name: '',
  voucher_number: '',
  has_voucher: '',
  month: '',
  unpaid: '',
  date_from: '',
  date_to: '',
};

const DEFAULT_SORT: SortCriterion[] = [{ key: 'sale_date', desc: true }];

export function SalesInvoicesListPage() {
  const navigate = useNavigate();
  const [fetchPdf] = useLazyGetSalesInvoicePdfQuery();

  const list = useSalesListState({
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

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const cid = list.params.get('customer_id');
      navigate(cid ? `/sales/invoices/new?customer_id=${cid}` : '/sales/invoices/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const listArgs = useMemo(() => {
    const monthRange = list.filters.month === 'current' ? currentMonthRange() : null;
    return {
      q: list.search,
      store_invoice_number: list.filters.store_invoice_number || undefined,
      customer_name: list.filters.customer_name || undefined,
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

  const { data, isLoading, isFetching, error, refetch } = useListSalesInvoicesQuery(listArgs);

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, list.pageSize);
  useSyncedPage(list.page, pages, list.setPage);

  const pageAmount = useMemo(
    () => pageRows.reduce((sum, row) => sum + amountOf(row), 0),
    [pageRows],
  );
  const pageOpenBalance = useMemo(
    () => pageRows.reduce((sum, row) => sum + Math.max(0, balanceOf(row) ?? 0), 0),
    [pageRows],
  );

  const showDue = useMemo(() => listHasField(pageRows, 'due_date'), [pageRows]);
  const showBalance = useMemo(
    () => listHasField(pageRows, 'balance_due', 'outstanding', 'balance', 'amount_due'),
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
      { key: 'store_invoice_number', label: 'Invoice #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      { key: 'voucher_number', label: 'Voucher #', type: 'text' },
      ...DATE_RANGE_FIELDS,
    ],
    [],
  );

  const filtersActive = hasActiveListFilters(list.search, list.filters, DEFAULT_FILTERS);

  type InvoiceRow = (typeof pageRows)[number];

  const columns: EntityListColumn<InvoiceRow>[] = useMemo(() => {
    const cols: EntityListColumn<InvoiceRow>[] = [
      {
        id: 'invoice',
        header: 'Invoice #',
        render: (row) => (
          <div className="el-customer-meta">
            <button
              type="button"
              className="el-doc-link"
              onClick={() => navigate(`/sales/invoices/${row.id}`)}
            >
              {asCaption(row.store_invoice_number) ||
                asCaption(row.voucher_number) ||
                String(row.id)}
            </button>
            {asCaption(row.voucher_number) && asCaption(row.store_invoice_number) ? (
              <span className="el-customer-sub">{asCaption(row.voucher_number)}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) =>
          asCaption(row.customer_name || row.party_name) || <span className="el-muted">—</span>,
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) =>
          dateKey(row.sale_date || row.voucher_date) || <span className="el-muted">—</span>,
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
    const cid = list.params.get('customer_id');
    navigate(cid ? `/sales/invoices/new?customer_id=${cid}` : '/sales/invoices/new');
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

  async function downloadPdf(id: string, name: string) {
    try {
      const blob = await fetchPdf(id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* list stays quiet */
    }
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
        kicker="Sales"
        title="Sales Invoices"
        count={`${total} ${total === 1 ? 'invoice' : 'invoices'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              New invoice
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search invoice #, customer, amount…"
            aria-label="Search invoices"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Invoice filters"
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
            onFiltersChange={(next) => list.setFilters(next as InvoiceFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'sale_date', label: 'Date' },
              { value: 'net', label: 'Amount' },
              { value: 'store_invoice_number', label: 'Invoice #' },
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
      {isLoading ? <EntityListLoading>Loading invoices…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load invoices.</ErrorText> : null}

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
              <strong>No invoices yet</strong>
              <p>Create an invoice to bill a customer.</p>
              <Button type="button" onClick={goNew}>
                New invoice
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
          onActivateRow={(row) => navigate(`/sales/invoices/${row.id}`)}
          onEditRow={(row) => navigate(`/sales/invoices/${row.id}/edit`)}
          onNew={goNew}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/sales/invoices/${row.id}`)}
              onEdit={() => navigate(`/sales/invoices/${row.id}/edit`)}
              primary={{
                label: 'PDF',
                onClick: () =>
                  void downloadPdf(
                    String(row.id),
                    asCaption(row.store_invoice_number) || String(row.id),
                  ),
              }}
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

export function SalesInvoiceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetSalesInvoiceQuery(id, { skip: !id });
  const [fetchPdf] = useLazyGetSalesInvoicePdfQuery();
  const [pdfError, setPdfError] = useState('');

  const lines = useMemo(() => mapDocLines(data?.lines || data?.items), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  if (isLoading) return <EntityListLoading>Loading invoice…</EntityListLoading>;
  if (error || !data) return <ErrorText>Sales invoice not found.</ErrorText>;

  const dateStr = dateCaption(data.sale_date || data.voucher_date);
  const editable = canEditInvoiceMonth(dateStr);
  const party = asCaption(data.customer_name || data.party_name) || '—';
  const soId = asCaption(data.sales_order_id);
  const soLabel = asCaption(data.so_number) || soId;
  const dnId = asCaption(data.delivery_note_id);
  const dnLabel = asCaption(data.dn_number) || dnId;

  const actions: DocumentDetailAction[] = [
    {
      id: 'edit',
      label: 'Edit',
      variant: 'ghost',
      disabled: !editable,
      title: editable ? 'Edit invoice' : 'Invoices can only be edited in the same calendar month',
      onClick: () => navigate(`/sales/invoices/${id}/edit`),
    },
    {
      id: 'pdf',
      label: 'Download PDF',
      variant: 'primary',
      onClick: async () => {
        setPdfError('');
        try {
          const blob = await fetchPdf(id).unwrap();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${asCaption(data.store_invoice_number) || id}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          setPdfError(extractError(e));
        }
      },
    },
  ];

  const related = [
    soId ? { id: 'so', label: `Order ${soLabel}`, to: `/sales/orders/${soId}` } : null,
    dnId ? { id: 'dn', label: `DN ${dnLabel}`, to: `/sales/delivery-notes/${dnId}` } : null,
  ].filter(Boolean) as { id: string; label: string; to: string }[];

  return (
    <DocumentDetail
      backTo="/sales/invoices"
      backLabel="Invoices"
      kicker="Sales invoice"
      title={asCaption(data.store_invoice_number) || asCaption(data.voucher_number) || id}
      status={asCaption(data.status || data.payment_status) || undefined}
      party={party}
      facts={buildFacts([
        ['Date', dateStr],
        ['Due date', dateCaption(data.due_date)],
        ['Payment', asCaption(data.payment_mode || data.payment_status)],
        ['Place of supply', asCaption(data.place_of_supply)],
        ['GSTIN', asCaption(data.customer_gstin || data.gstin)],
        ['Voucher', asCaption(data.voucher_number)],
      ])}
      related={related.length ? related : undefined}
      actions={actions}
      error={
        pdfError ||
        (!editable ? 'Edit is locked — invoice date is outside the current month.' : null)
      }
      notes={notesFromDoc(data as Record<string, unknown>)}
      lines={lines}
      summary={
        summary.length
          ? summary
          : [{ label: 'Grand total', value: Number(data.net ?? data.gross ?? data.total ?? 0) }]
      }
    />
  );
}
