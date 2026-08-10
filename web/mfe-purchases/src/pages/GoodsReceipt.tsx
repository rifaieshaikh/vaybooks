import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useConfirmGoodsReceiptMutation,
  useGetGoodsReceiptQuery,
  useListGoodsReceiptsQuery,
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
  usePurchasesListState,
  useSyncedPage,
} from './purchasesListHelpers';

type GrnFilters = {
  grn_number: string;
  vendor_name: string;
  status: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: GrnFilters = {
  grn_number: '',
  vendor_name: '',
  status: '',
  date_from: '',
  date_to: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'receipt_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Received', label: 'Received' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function GoodsReceiptListPage() {
  const navigate = useNavigate();

  const list = usePurchasesListState({
    defaultFilters: DEFAULT_FILTERS,
    defaultSort: DEFAULT_SORT,
    applyChip: (chip, filters) => {
      if (!chip || chip === 'all') return { ...filters, status: '' };
      return { ...filters, status: chip };
    },
  });

  const listArgs = useMemo(
    () => ({
      q: list.search || undefined,
      grn_number: list.filters.grn_number || undefined,
      vendor_name: list.filters.vendor_name || undefined,
      status: list.filters.status || undefined,
      date_from: list.filters.date_from || undefined,
      date_to: list.filters.date_to || undefined,
      ...sortQueryParams(list.sort),
      page: list.page,
      page_size: list.pageSize,
    }),
    [list.search, list.filters, list.sort, list.page, list.pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useListGoodsReceiptsQuery(listArgs);

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, list.pageSize);
  useSyncedPage(list.page, pages, list.setPage);

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const vid = list.params.get('vendor_id');
      const po = list.params.get('purchase_order_id');
      const qs = new URLSearchParams();
      if (vid) qs.set('vendor_id', vid);
      if (po) qs.set('purchase_order_id', po);
      const q = qs.toString();
      navigate(q ? `/purchases/goods-receipt/new?${q}` : '/purchases/goods-receipt/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'grn_number', label: 'GRN #', type: 'text' },
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

  type GrnRow = (typeof pageRows)[number];

  const columns: EntityListColumn<GrnRow>[] = useMemo(
    () => [
      {
        id: 'grn_number',
        header: 'GRN #',
        render: (row) => (
          <button
            type="button"
            className="el-doc-link"
            onClick={() => navigate(`/purchases/goods-receipt/${row.id}`)}
          >
            {asCaption(row.grn_number) || String(row.id)}
          </button>
        ),
      },
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) => asCaption(row.vendor_name) || <span className="el-muted">—</span>,
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => <StatusPill status={row.status} />,
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) => dateKey(row.receipt_date) || <span className="el-muted">—</span>,
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
    navigate(vid ? `/purchases/goods-receipt/new?vendor_id=${vid}` : '/purchases/goods-receipt/new');
  };

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Purchases"
        title="Goods Receipt"
        count={
          <>
            {total} {total === 1 ? 'receipt' : 'receipts'}
          </>
        }
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              New GRN
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search GRN #, vendor, status…"
            aria-label="Search goods receipts"
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
            onFiltersChange={(next) => list.setFilters(next as GrnFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'receipt_date', label: 'Date' },
              { value: 'grn_number', label: 'GRN #' },
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
      {isLoading ? <EntityListLoading>Loading goods receipts…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load goods receipts.</ErrorText> : null}

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
              <strong>No goods receipts yet</strong>
              <p>Receive goods against a purchase order.</p>
              <Button type="button" onClick={goNew}>
                New GRN
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
          onActivateRow={(row) => navigate(`/purchases/goods-receipt/${row.id}`)}
          onNew={goNew}
          actions={(row) => {
            const received = statusIncludes(row.status, 'received');
            return (
              <EntityListActions
                onOpen={() => navigate(`/purchases/goods-receipt/${row.id}`)}
                primary={
                  received
                    ? {
                        label: 'Create bill',
                        onClick: () =>
                          navigate(
                            `/purchases/bills/new?vendor_id=${row.vendor_id || ''}&reference_grn_id=${row.id}`,
                          ),
                      }
                    : undefined
                }
              />
            );
          }}
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

export function GoodsReceiptDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetGoodsReceiptQuery(id, { skip: !id });
  const [confirmGrn, confirmState] = useConfirmGoodsReceiptMutation();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  async function onConfirm() {
    setActionError('');
    try {
      await confirmGrn(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <EntityListLoading>Loading goods receipt…</EntityListLoading>;
  if (error || !data) return <ErrorText>Goods receipt not found.</ErrorText>;

  const received = statusIncludes(data.status, 'received');
  const party = asCaption(data.vendor_name) || '—';
  const dateStr = dateCaption(data.receipt_date);
  const poId = asCaption(data.purchase_order_id);
  const poLabel = asCaption(data.po_number) || poId;

  const actions: DocumentDetailAction[] = [];
  if (!received) {
    actions.push({
      id: 'confirm',
      label: confirmState.isLoading ? 'Confirming…' : 'Confirm receipt',
      variant: 'primary',
      disabled: confirmState.isLoading,
      onClick: () => void onConfirm(),
    });
  } else {
    actions.push({
      id: 'bill',
      label: 'Create bill',
      variant: 'primary',
      onClick: () =>
        navigate(
          `/purchases/bills/new?vendor_id=${data.vendor_id || ''}&reference_grn_id=${id}`,
        ),
    });
  }

  return (
    <DocumentDetail
      backTo="/purchases/goods-receipt"
      backLabel="Goods receipt"
      kicker="Goods receipt"
      title={asCaption(data.grn_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Receipt date', dateStr],
        ['Challan', asCaption(data.challan_number || data.vendor_challan)],
        ['Vehicle', asCaption(data.vehicle_number)],
      ])}
      related={
        poId
          ? [{ id: 'po', label: `PO ${poLabel}`, to: `/purchases/orders/${poId}` }]
          : undefined
      }
      actions={actions}
      error={actionError || null}
      notes={notesFromDoc(data as Record<string, unknown>)}
      lines={lines}
      summary={
        summary.length
          ? summary
          : Number(data.total_amount ?? 0)
            ? [{ label: 'Grand total', value: Number(data.total_amount ?? 0) }]
            : []
      }
    />
  );
}
