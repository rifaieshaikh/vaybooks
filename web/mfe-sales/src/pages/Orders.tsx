import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCancelSalesOrderMutation,
  useCloseSalesOrderMutation,
  useGetSalesOrderQuery,
  useListSalesOrdersQuery,
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
  StatusPill,
  type DocumentDetailAction,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError, formatMoney } from '../utils';
import {
  buildFacts,
  dateCaption,
  mapDocLines,
  moneySummaryFromDoc,
  notesFromDoc,
  statusIncludes,
} from './documentDetailHelpers';
import {
  DATE_RANGE_FIELDS,
  PAGE_SIZE_OPTIONS,
  amountOf,
  dateKey,
  hasActiveListFilters,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
  useSalesListState,
  useSyncedPage,
} from './salesListHelpers';

type OrderFilters = {
  so_number: string;
  customer_name: string;
  status: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: OrderFilters = {
  so_number: '',
  customer_name: '',
  status: '',
  date_from: '',
  date_to: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'order_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'Partially Delivered', label: 'Partially Delivered' },
  { id: 'Delivered', label: 'Delivered' },
  { id: 'Closed', label: 'Closed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function SalesOrdersListPage() {
  const navigate = useNavigate();

  const list = useSalesListState({
    defaultFilters: DEFAULT_FILTERS,
    defaultSort: DEFAULT_SORT,
    applyChip: (chip, filters) => {
      if (!chip || chip === 'all') return { ...filters, status: '' };
      return { ...filters, status: chip };
    },
  });

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const cid = list.params.get('customer_id');
      navigate(cid ? `/sales/orders/new?customer_id=${cid}` : '/sales/orders/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const listArgs = useMemo(
    () => ({
      q: list.search,
      so_number: list.filters.so_number || undefined,
      customer_name: list.filters.customer_name || undefined,
      status: list.filters.status || undefined,
      date_from: list.filters.date_from || undefined,
      date_to: list.filters.date_to || undefined,
      ...sortQueryParams(list.sort),
      page: list.page,
      page_size: list.pageSize,
    }),
    [list.search, list.filters, list.sort, list.page, list.pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useListSalesOrdersQuery(listArgs);

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, list.pageSize);
  useSyncedPage(list.page, pages, list.setPage);

  const pageAmount = useMemo(
    () => pageRows.reduce((sum, row) => sum + amountOf(row), 0),
    [pageRows],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'so_number', label: 'SO #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      ...DATE_RANGE_FIELDS,
    ],
    [],
  );

  const filtersActive = hasActiveListFilters(list.search, list.filters, DEFAULT_FILTERS);

  type OrderRow = (typeof pageRows)[number];

  const columns: EntityListColumn<OrderRow>[] = useMemo(
    () => [
      {
        id: 'so_number',
        header: 'SO #',
        render: (row) => (
          <button
            type="button"
            className="el-doc-link"
            onClick={() => navigate(`/sales/orders/${row.id}`)}
          >
            {asCaption(row.so_number) || String(row.id)}
          </button>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => asCaption(row.customer_name) || <span className="el-muted">—</span>,
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => <StatusPill status={row.status} />,
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) => dateKey(row.order_date) || <span className="el-muted">—</span>,
      },
      {
        id: 'amount',
        header: 'Amount',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(amountOf(row)),
      },
    ],
    [navigate],
  );

  const goNew = () => {
    const cid = list.params.get('customer_id');
    navigate(cid ? `/sales/orders/new?customer_id=${cid}` : '/sales/orders/new');
  };

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Sales"
        title="Sales Orders"
        count={`${total} ${total === 1 ? 'order' : 'orders'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              New SO
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search SO #, customer, status…"
            aria-label="Search sales orders"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={list.filters.status || 'all'}
            onChange={(id) =>
              list.setFilters((prev) => ({ ...prev, status: id === 'all' ? '' : id }))
            }
            options={STATUS_CHIPS}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={list.filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => list.setFilters(next as OrderFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'order_date', label: 'Date' },
              { value: 'so_number', label: 'SO #' },
              { value: 'total_amount', label: 'Amount' },
              { value: 'status', label: 'Status' },
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
          </div>
        }
      />

      {isFetching && !isLoading ? <EntityListRefreshing /> : null}
      {isLoading ? <EntityListLoading>Loading sales orders…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load sales orders.</ErrorText> : null}

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
              <strong>No sales orders yet</strong>
              <p>Create a sales order to start fulfilment.</p>
              <Button type="button" onClick={goNew}>
                New SO
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
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/sales/orders/${row.id}`)}
              onEdit={() => navigate(`/sales/orders/${row.id}/edit`)}
              primary={{
                label: 'DN',
                onClick: () =>
                  navigate(`/sales/delivery-notes/new?sales_order_id=${row.id}`),
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

export function SalesOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetSalesOrderQuery(id, { skip: !id });
  const [cancelOrder] = useCancelSalesOrderMutation();
  const [closeOrder] = useCloseSalesOrderMutation();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  async function run(action: 'cancel' | 'close') {
    setActionError('');
    try {
      if (action === 'cancel') await cancelOrder(id).unwrap();
      if (action === 'close') await closeOrder(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <EntityListLoading>Loading sales order…</EntityListLoading>;
  if (error || !data) return <ErrorText>Sales order not found.</ErrorText>;

  const terminal = statusIncludes(data.status, 'closed', 'cancelled');
  const party = asCaption(data.customer_name) || '—';
  const dateStr = dateCaption(data.order_date);

  const actions: DocumentDetailAction[] = [
    {
      id: 'edit',
      label: 'Edit',
      variant: 'ghost',
      onClick: () => navigate(`/sales/orders/${id}/edit`),
    },
  ];
  if (!terminal) {
    actions.push(
      { id: 'close', label: 'Close', variant: 'ghost', onClick: () => void run('close') },
      { id: 'cancel', label: 'Cancel', variant: 'ghost', onClick: () => void run('cancel') },
    );
  }
  actions.push(
    {
      id: 'dn',
      label: 'Delivery note',
      variant: 'primary',
      onClick: () => navigate(`/sales/delivery-notes/new?sales_order_id=${id}`),
    },
    {
      id: 'invoice',
      label: 'Invoice',
      variant: 'primary',
      onClick: () =>
        navigate(
          data.customer_id
            ? `/sales/invoices/new?customer_id=${data.customer_id}`
            : '/sales/invoices/new',
        ),
    },
  );

  return (
    <DocumentDetail
      backTo="/sales/orders"
      backLabel="Sales orders"
      kicker="Sales order"
      title={asCaption(data.so_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Order date', dateStr],
        ['Expected', dateCaption(data.expected_date || data.delivery_date)],
        ['Reference', asCaption(data.reference || data.customer_po)],
        ['GSTIN', asCaption(data.customer_gstin || data.gstin)],
      ])}
      actions={actions}
      error={actionError || null}
      notes={notesFromDoc(data as Record<string, unknown>)}
      lines={lines}
      summary={
        summary.length
          ? summary
          : [{ label: 'Grand total', value: Number(data.total_amount ?? 0) }]
      }
    />
  );
}
