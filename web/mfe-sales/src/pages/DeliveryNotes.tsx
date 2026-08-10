import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useConfirmDeliveryNoteMutation,
  useDeliverDeliveryNoteMutation,
  useDispatchDeliveryNoteMutation,
  useGetDeliveryNoteQuery,
  useListDeliveryNotesQuery,
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

type DnFilters = {
  dn_number: string;
  customer_name: string;
  status: string;
  pending: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: DnFilters = {
  dn_number: '',
  customer_name: '',
  status: '',
  pending: '',
  date_from: '',
  date_to: '',
};

const DEFAULT_SORT: SortCriterion[] = [{ key: 'delivery_date', desc: true }];

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'Dispatched', label: 'Dispatched' },
  { id: 'Delivered', label: 'Delivered' },
  { id: 'Partially Delivered', label: 'Partially Delivered' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function DeliveryNotesListPage() {
  const navigate = useNavigate();

  const list = useSalesListState({
    defaultFilters: DEFAULT_FILTERS,
    defaultSort: DEFAULT_SORT,
    applyChip: (chip, filters) => {
      if (chip === 'pending') return { ...filters, pending: '1', status: '' };
      if (chip === 'all') return { ...filters, pending: '', status: '' };
      if (chip) return { ...filters, status: chip, pending: '' };
      return null;
    },
  });

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const cid = list.params.get('customer_id');
      navigate(cid ? `/sales/delivery-notes/new?customer_id=${cid}` : '/sales/delivery-notes/new', {
        replace: true,
      });
    }
  }, [list.params, navigate]);

  const listArgs = useMemo(
    () => ({
      q: list.search,
      dn_number: list.filters.dn_number || undefined,
      customer_name: list.filters.customer_name || undefined,
      status:
        list.filters.pending === '1' ? 'pending' : list.filters.status || undefined,
      date_from: list.filters.date_from || undefined,
      date_to: list.filters.date_to || undefined,
      ...sortQueryParams(list.sort),
      page: list.page,
      page_size: list.pageSize,
    }),
    [list.search, list.filters, list.sort, list.page, list.pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useListDeliveryNotesQuery(listArgs);

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
      { key: 'dn_number', label: 'DN #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      ...DATE_RANGE_FIELDS,
    ],
    [],
  );

  const filtersActive = hasActiveListFilters(list.search, list.filters, DEFAULT_FILTERS);

  type DnRow = (typeof pageRows)[number];

  const columns: EntityListColumn<DnRow>[] = useMemo(
    () => [
      {
        id: 'dn_number',
        header: 'DN #',
        render: (row) => (
          <button
            type="button"
            className="el-doc-link"
            onClick={() => navigate(`/sales/delivery-notes/${row.id}`)}
          >
            {asCaption(row.dn_number) || String(row.id)}
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
        render: (row) => dateKey(row.delivery_date) || <span className="el-muted">—</span>,
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
    navigate(cid ? `/sales/delivery-notes/new?customer_id=${cid}` : '/sales/delivery-notes/new');
  };

  function setChip(id: string) {
    list.setFilters((prev) => {
      if (id === 'pending') return { ...prev, pending: '1', status: '' };
      if (id === 'all') return { ...prev, pending: '', status: '' };
      return { ...prev, status: id, pending: '' };
    });
  }

  const chipValue =
    list.filters.pending === '1' ? 'pending' : list.filters.status || 'all';

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Sales"
        title="Delivery Notes"
        count={`${total} ${total === 1 ? 'note' : 'notes'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              New DN
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search DN #, customer, amount…"
            aria-label="Search delivery notes"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Delivery note filters"
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
            excludeKeys={['status', 'pending']}
            onFiltersChange={(next) => list.setFilters(next as DnFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'delivery_date', label: 'Date' },
              { value: 'dn_number', label: 'DN #' },
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
      {isLoading ? <EntityListLoading>Loading delivery notes…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load delivery notes.</ErrorText> : null}

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
              <strong>No delivery notes yet</strong>
              <p>Create a delivery note to ship against an order.</p>
              <Button type="button" onClick={goNew}>
                New DN
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
          onActivateRow={(row) => navigate(`/sales/delivery-notes/${row.id}`)}
          onEditRow={(row) => navigate(`/sales/delivery-notes/${row.id}/edit`)}
          onNew={goNew}
          actions={(row) => (
            <EntityListActions
              onOpen={() => navigate(`/sales/delivery-notes/${row.id}`)}
              onEdit={() => navigate(`/sales/delivery-notes/${row.id}/edit`)}
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

export function DeliveryNoteDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetDeliveryNoteQuery(id, { skip: !id });
  const [confirmDn] = useConfirmDeliveryNoteMutation();
  const [dispatchDn] = useDispatchDeliveryNoteMutation();
  const [deliverDn] = useDeliverDeliveryNoteMutation();
  const [actionError, setActionError] = useState('');

  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  async function run(action: 'confirm' | 'dispatch' | 'deliver') {
    setActionError('');
    try {
      if (action === 'confirm') await confirmDn(id).unwrap();
      if (action === 'dispatch') await dispatchDn(id).unwrap();
      if (action === 'deliver') await deliverDn(id).unwrap();
      refetch();
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) return <EntityListLoading>Loading delivery note…</EntityListLoading>;
  if (error || !data) return <ErrorText>Delivery note not found.</ErrorText>;

  const party = asCaption(data.customer_name) || '—';
  const dateStr = dateCaption(data.delivery_date);
  const soId = asCaption(data.sales_order_id);
  const soLabel = asCaption(data.so_number) || soId;
  const invId = asCaption(data.sales_invoice_id || data.reference_invoice_id);
  const invLabel =
    asCaption(data.store_invoice_number || data.invoice_number || data.voucher_number) || invId;

  const actions: DocumentDetailAction[] = [
    {
      id: 'edit',
      label: 'Edit',
      variant: 'ghost',
      onClick: () => navigate(`/sales/delivery-notes/${id}/edit`),
    },
  ];
  if (statusIncludes(data.status, 'draft', 'pending')) {
    actions.push({
      id: 'confirm',
      label: 'Confirm',
      variant: 'ghost',
      onClick: () => void run('confirm'),
    });
  }
  if (statusIncludes(data.status, 'confirm')) {
    actions.push({
      id: 'dispatch',
      label: 'Dispatch',
      variant: 'ghost',
      onClick: () => void run('dispatch'),
    });
  }
  if (statusIncludes(data.status, 'dispatch')) {
    actions.push({
      id: 'deliver',
      label: 'Deliver',
      variant: 'primary',
      onClick: () => void run('deliver'),
    });
  }

  actions.push({
    id: 'invoice-from-dn',
    label: 'Create invoice',
    variant: 'primary',
    kbAction: 'sales.deliveries.create_invoice',
    onClick: () =>
      navigate(
        soId
          ? `/sales/invoices/new?delivery_note_id=${id}&sales_order_id=${soId}`
          : `/sales/invoices/new?delivery_note_id=${id}`,
      ),
  });

  const related = [
    soId ? { id: 'so', label: `Order ${soLabel}`, to: `/sales/orders/${soId}` } : null,
    invId ? { id: 'inv', label: `Invoice ${invLabel}`, to: `/sales/invoices/${invId}` } : null,
  ].filter(Boolean) as { id: string; label: string; to: string }[];

  return (
    <DocumentDetail
      backTo="/sales/delivery-notes"
      backLabel="Delivery notes"
      kicker="Delivery note"
      title={asCaption(data.dn_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Delivery date', dateStr],
        ['Transport', asCaption(data.transport_mode || data.transporter)],
        ['Vehicle', asCaption(data.vehicle_number)],
        ['LR / AWB', asCaption(data.lr_number || data.awb_number)],
      ])}
      related={related.length ? related : undefined}
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
