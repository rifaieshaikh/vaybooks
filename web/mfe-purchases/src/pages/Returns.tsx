import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useGetPurchaseReturnQuery,
  useListPurchaseReturnsQuery,
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
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';
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
  currentMonthRange,
  dateKey,
  hasActiveListFilters,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
  usePurchasesListState,
  useSyncedPage,
} from './purchasesListHelpers';

type ReturnFilters = {
  return_number: string;
  vendor_name: string;
  amount: string;
  month: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: ReturnFilters = {
  return_number: '',
  vendor_name: '',
  amount: '',
  month: '',
  date_from: '',
  date_to: '',
};

const DEFAULT_SORT: SortCriterion[] = [{ key: 'return_date', desc: true }];

export function PurchaseReturnsListPage() {
  const navigate = useNavigate();

  const list = usePurchasesListState({
    defaultFilters: DEFAULT_FILTERS,
    defaultSort: DEFAULT_SORT,
    monthFilterKey: 'month',
    applyChip: (chip, filters) => {
      if (chip === 'with' || chip === 'zero') return { ...filters, amount: chip };
      if (!chip || chip === 'all') return { ...filters, amount: '' };
      return null;
    },
  });

  const listArgs = useMemo(() => {
    const monthRange = list.filters.month === 'current' ? currentMonthRange() : null;
    return {
      q: list.search || undefined,
      return_number: list.filters.return_number || undefined,
      vendor_name: list.filters.vendor_name || undefined,
      date_from: monthRange?.date_from || list.filters.date_from || undefined,
      date_to: monthRange?.date_to || list.filters.date_to || undefined,
      ...sortQueryParams(list.sort),
      page: list.page,
      page_size: list.pageSize,
      ...(list.filters.amount ? { amount: list.filters.amount } : {}),
    };
  }, [list.search, list.filters, list.sort, list.page, list.pageSize]);

  const { data, isLoading, isFetching, error, refetch } = useListPurchaseReturnsQuery(listArgs);

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, list.pageSize);
  useSyncedPage(list.page, pages, list.setPage);

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const vid = list.params.get('vendor_id');
      navigate(vid ? `/purchases/returns/new?vendor_id=${vid}` : '/purchases/returns/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'return_number', label: 'Return #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      ...DATE_RANGE_FIELDS,
    ],
    [],
  );

  const pageAmount = useMemo(
    () => pageRows.reduce((s, r) => s + amountOf(r), 0),
    [pageRows],
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
            onClick={() => navigate(`/purchases/returns/${row.id}`)}
          >
            {asCaption(row.return_number) || String(row.id)}
          </button>
        ),
      },
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) => asCaption(row.vendor_name) || <span className="el-muted">—</span>,
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
    const vid = list.params.get('vendor_id');
    navigate(vid ? `/purchases/returns/new?vendor_id=${vid}` : '/purchases/returns/new');
  };

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Purchases"
        title="Purchase Returns"
        count={
          <>
            {total} {total === 1 ? 'return' : 'returns'}
          </>
        }
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
            placeholder="Search return #, vendor, amount…"
            aria-label="Search returns"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Amount"
            value={list.filters.amount || 'all'}
            onChange={(id) =>
              list.setFilters((prev) => ({ ...prev, amount: id === 'all' ? '' : id }))
            }
            options={[
              { id: 'all', label: 'All' },
              { id: 'with', label: 'With amount' },
              { id: 'zero', label: 'Zero' },
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={list.filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['amount', 'month']}
            onFiltersChange={(next) => list.setFilters(next as ReturnFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'return_date', label: 'Date' },
              { value: 'return_number', label: 'Return #' },
              { value: 'total_amount', label: 'Amount' },
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
              <p>Record a purchase return to send goods back to a vendor.</p>
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
          onActivateRow={(row) => navigate(`/purchases/returns/${row.id}`)}
          onNew={goNew}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/returns/${row.id}`)} />
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

export function PurchaseReturnDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useGetPurchaseReturnQuery(id, { skip: !id });
  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  if (isLoading) return <EntityListLoading>Loading return…</EntityListLoading>;
  if (error || !data) return <ErrorText>Purchase return not found.</ErrorText>;

  const party = asCaption(data.vendor_name) || '—';
  const dateStr = dateCaption(data.return_date);
  const billId = asCaption(data.purchase_bill_id || data.bill_id);
  const billLabel = asCaption(data.vendor_bill_number || data.bill_number) || billId;

  return (
    <DocumentDetail
      backTo="/purchases/returns"
      backLabel="Returns"
      kicker="Purchase return"
      title={asCaption(data.return_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Return date', dateStr],
        ['Reason', asCaption(data.reason || data.return_reason)],
      ])}
      related={
        billId
          ? [{ id: 'bill', label: `Bill ${billLabel}`, to: `/purchases/bills/${billId}` }]
          : undefined
      }
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
