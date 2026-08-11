import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCancelPurchaseOrderMutation,
  useClosePurchaseOrderMutation,
  useGetPurchaseOrderQuery,
  useLazyGetPurchaseOrderPdfQuery,
  useListPurchaseOrdersQuery,
  useSendPurchaseOrderMutation,
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

type OrderFilters = {
  po_number: string;
  vendor_name: string;
  status: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: OrderFilters = {
  po_number: '',
  vendor_name: '',
  status: '',
  date_from: '',
  date_to: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'order_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Partially Received', label: 'Partially Received' },
  { id: 'Received', label: 'Received' },
  { id: 'Closed', label: 'Closed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function PurchaseOrdersListPage() {
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
      po_number: list.filters.po_number || undefined,
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

  const { data, isLoading, isFetching, error, refetch } = useListPurchaseOrdersQuery(listArgs);

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, list.pageSize);
  useSyncedPage(list.page, pages, list.setPage);

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const vid = list.params.get('vendor_id');
      navigate(vid ? `/purchases/orders/new?vendor_id=${vid}` : '/purchases/orders/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'po_number', label: 'PO #', type: 'text' },
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

  type OrderRow = (typeof pageRows)[number];

  const columns: EntityListColumn<OrderRow>[] = useMemo(
    () => [
      {
        id: 'po_number',
        header: 'PO #',
        render: (row) => (
          <button
            type="button"
            className="el-doc-link"
            onClick={() => navigate(`/purchases/orders/${row.id}`)}
          >
            {asCaption(row.po_number) || String(row.id)}
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
    const vid = list.params.get('vendor_id');
    navigate(vid ? `/purchases/orders/new?vendor_id=${vid}` : '/purchases/orders/new');
  };

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Purchases"
        title="Purchase Orders"
        count={
          <>
            {total} {total === 1 ? 'order' : 'orders'}
          </>
        }
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              New PO
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search PO #, vendor, status…"
            aria-label="Search purchase orders"
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
              { value: 'po_number', label: 'PO #' },
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
      {isLoading ? <EntityListLoading>Loading purchase orders…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load purchase orders.</ErrorText> : null}

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
              <strong>No purchase orders yet</strong>
              <p>Create a purchase order to buy from a vendor.</p>
              <Button type="button" onClick={goNew}>
                New PO
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
          onActivateRow={(row) => navigate(`/purchases/orders/${row.id}`)}
          onEditRow={(row) => navigate(`/purchases/orders/${row.id}/edit`)}
          onNew={goNew}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/purchases/orders/${row.id}`)}
              onEdit={() => navigate(`/purchases/orders/${row.id}/edit`)}
              primary={{
                label: 'GRN',
                onClick: () =>
                  navigate(`/purchases/goods-receipt/new?purchase_order_id=${row.id}`),
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

export function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetPurchaseOrderQuery(id, { skip: !id });
  const [sendPo] = useSendPurchaseOrderMutation();
  const [cancelPo] = useCancelPurchaseOrderMutation();
  const [closePo] = useClosePurchaseOrderMutation();
  const [fetchPdf] = useLazyGetPurchaseOrderPdfQuery();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  async function run(action: 'send' | 'cancel' | 'close') {
    setActionError('');
    try {
      if (action === 'send') await sendPo(id).unwrap();
      if (action === 'cancel') await cancelPo(id).unwrap();
      if (action === 'close') await closePo(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <EntityListLoading>Loading purchase order…</EntityListLoading>;
  if (error || !data) return <ErrorText>Purchase order not found.</ErrorText>;

  const terminal = statusIncludes(data.status, 'closed', 'cancelled');
  const party = asCaption(data.vendor_name) || '—';
  const dateStr = dateCaption(data.order_date);

  const actions: DocumentDetailAction[] = [];
  if (!terminal) {
    actions.push({
      id: 'edit',
      label: 'Edit',
      variant: 'ghost',
      onClick: () => navigate(`/purchases/orders/${id}/edit`),
    });
  }
  actions.push({
    id: 'pdf',
    label: 'Download PDF',
    variant: 'ghost',
    kbAction: 'purchases.orders.print',
    onClick: async () => {
      setActionError('');
      try {
        const blob = await fetchPdf(id).unwrap();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${asCaption(data.po_number) || id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setActionError(extractError(e));
      }
    },
  });
  if (statusIncludes(data.status, 'draft')) {
    actions.push({
      id: 'send',
      label: 'Send',
      variant: 'ghost',
      onClick: () => void run('send'),
    });
  }
  if (!terminal) {
    actions.push(
      { id: 'close', label: 'Close', variant: 'ghost', onClick: () => void run('close') },
      { id: 'cancel', label: 'Cancel', variant: 'ghost', onClick: () => void run('cancel') },
      {
        id: 'grn',
        label: 'Receive goods',
        variant: 'primary',
        kbAction: 'purchases.orders.receive',
        onClick: () => navigate(`/purchases/goods-receipt/new?purchase_order_id=${id}`),
      },
    );
  }

  return (
    <DocumentDetail
      backTo="/purchases/orders"
      backLabel="Purchase orders"
      kicker="Purchase order"
      title={asCaption(data.po_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Order date', dateStr],
        ['Expected', dateCaption(data.expected_date || data.delivery_date)],
        ['Reference', asCaption(data.reference || data.vendor_ref)],
        ['Vendor GSTIN', asCaption(data.vendor_gstin || data.gstin)],
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
