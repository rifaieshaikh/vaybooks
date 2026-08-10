import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useApproveSalesReturnMutation,
  useGetSalesReturnQuery,
  useListSalesReturnsQuery,
  useRejectSalesReturnMutation,
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
  currentMonthRange,
  dateKey,
  hasActiveListFilters,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
  useSalesListState,
  useSyncedPage,
} from './salesListHelpers';

type ReturnFilters = {
  return_number: string;
  customer_name: string;
  status: string;
  month: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: ReturnFilters = {
  return_number: '',
  customer_name: '',
  status: '',
  month: '',
  date_from: '',
  date_to: '',
};

const DEFAULT_SORT: SortCriterion[] = [{ key: 'return_date', desc: true }];

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Pending Approval', label: 'Pending Approval' },
  { id: 'Approved', label: 'Approved' },
  { id: 'Rejected', label: 'Rejected' },
  { id: 'Goods Received', label: 'Goods Received' },
  { id: 'Refund Processed', label: 'Refund Processed' },
  { id: 'Closed', label: 'Closed' },
];

export function SalesReturnsListPage() {
  const navigate = useNavigate();

  const list = useSalesListState({
    defaultFilters: DEFAULT_FILTERS,
    defaultSort: DEFAULT_SORT,
    monthFilterKey: 'month',
    applyChip: (chip, filters) => {
      if (chip === 'all') return { ...filters, status: '' };
      if (chip) return { ...filters, status: chip };
      return null;
    },
  });

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const cid = list.params.get('customer_id');
      navigate(cid ? `/sales/returns/new?customer_id=${cid}` : '/sales/returns/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const listArgs = useMemo(() => {
    const monthRange = list.filters.month === 'current' ? currentMonthRange() : null;
    return {
      q: list.search,
      return_number: list.filters.return_number || undefined,
      customer_name: list.filters.customer_name || undefined,
      status: list.filters.status || undefined,
      date_from: monthRange?.date_from || list.filters.date_from || undefined,
      date_to: monthRange?.date_to || list.filters.date_to || undefined,
      ...sortQueryParams(list.sort),
      page: list.page,
      page_size: list.pageSize,
    };
  }, [list.search, list.filters, list.sort, list.page, list.pageSize]);

  const { data, isLoading, isFetching, error, refetch } = useListSalesReturnsQuery(listArgs);

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
      { key: 'return_number', label: 'Return #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      ...DATE_RANGE_FIELDS,
    ],
    [],
  );

  const filtersActive = hasActiveListFilters(list.search, list.filters, DEFAULT_FILTERS);

  type ReturnRow = (typeof pageRows)[number];

  const columns: EntityListColumn<ReturnRow>[] = useMemo(
    () => [
      {
        id: 'return_number',
        header: 'Return #',
        render: (row) => (
          <button
            type="button"
            className="el-doc-link"
            onClick={() => navigate(`/sales/returns/${row.id}`)}
          >
            {asCaption(row.return_number) || String(row.id)}
          </button>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) =>
          asCaption(row.customer_name || row.party_name) || <span className="el-muted">—</span>,
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => <StatusPill status={row.status} />,
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) => dateKey(row.return_date) || <span className="el-muted">—</span>,
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
    navigate(cid ? `/sales/returns/new?customer_id=${cid}` : '/sales/returns/new');
  };

  function setChip(id: string) {
    list.setFilters((prev) => ({
      ...prev,
      status: id === 'all' ? '' : id,
    }));
  }

  const chipValue = list.filters.status || 'all';

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Sales"
        title="Sales Returns"
        count={`${total} ${total === 1 ? 'return' : 'returns'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              New return
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search return #, customer, amount…"
            aria-label="Search returns"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Return filters"
            value={chipValue}
            onChange={setChip}
            options={STATUS_CHIPS}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={list.filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['status', 'month']}
            onFiltersChange={(next) => list.setFilters(next as ReturnFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'return_date', label: 'Date' },
              { value: 'return_number', label: 'Return #' },
              { value: 'net', label: 'Amount' },
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
      {isLoading ? <EntityListLoading>Loading returns…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load returns.</ErrorText> : null}

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
              <strong>No returns yet</strong>
              <p>Record a customer return when goods come back.</p>
              <Button type="button" onClick={goNew}>
                New return
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
          onActivateRow={(row) => navigate(`/sales/returns/${row.id}`)}
          onEditRow={(row) => {
            if (statusIncludes(row.status, 'pending')) {
              navigate(`/sales/returns/${row.id}/edit`);
            }
          }}
          onNew={goNew}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/sales/returns/${row.id}`)}
              onEdit={
                statusIncludes(row.status, 'pending')
                  ? () => navigate(`/sales/returns/${row.id}/edit`)
                  : undefined
              }
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

export function SalesReturnDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetSalesReturnQuery(id, { skip: !id });
  const [approve] = useApproveSalesReturnMutation();
  const [reject] = useRejectSalesReturnMutation();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  async function run(action: 'approve' | 'reject') {
    setActionError('');
    try {
      if (action === 'approve') await approve(id).unwrap();
      if (action === 'reject') await reject(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <EntityListLoading>Loading return…</EntityListLoading>;
  if (error || !data) return <ErrorText>Sales return not found.</ErrorText>;

  const pending = statusIncludes(data.status, 'pending');
  const party = asCaption(data.customer_name) || '—';
  const dateStr = dateCaption(data.return_date);
  const invId = asCaption(data.sales_invoice_id || data.invoice_id);
  const invLabel =
    asCaption(data.store_invoice_number || data.invoice_number) || invId;

  const actions: DocumentDetailAction[] = [];
  if (pending) {
    actions.push(
      {
        id: 'edit',
        label: 'Edit',
        variant: 'ghost',
        onClick: () => navigate(`/sales/returns/${id}/edit`),
      },
      {
        id: 'reject',
        label: 'Reject',
        variant: 'ghost',
        onClick: () => void run('reject'),
      },
      {
        id: 'approve',
        label: 'Approve',
        variant: 'primary',
        onClick: () => void run('approve'),
      },
    );
  }

  return (
    <DocumentDetail
      backTo="/sales/returns"
      backLabel="Returns"
      kicker="Sales return"
      title={asCaption(data.return_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Return date', dateStr],
        ['Reason', asCaption(data.reason || data.return_reason)],
      ])}
      related={
        invId
          ? [{ id: 'inv', label: `Invoice ${invLabel}`, to: `/sales/invoices/${invId}` }]
          : undefined
      }
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
