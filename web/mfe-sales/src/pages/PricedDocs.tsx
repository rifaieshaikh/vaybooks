import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useConvertEstimateToOrderMutation,
  useConvertQuotationToOrderMutation,
  useGetSalesEstimateQuery,
  useGetSalesQuotationQuery,
  useListSalesEstimatesQuery,
  useListSalesQuotationsQuery,
  useSetSalesEstimateStatusMutation,
  useSetSalesQuotationStatusMutation,
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
  listHasField,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
  useSalesListState,
  useSyncedPage,
} from './salesListHelpers';

type PricedFilters = {
  number: string;
  customer_name: string;
  status: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: PricedFilters = {
  number: '',
  customer_name: '',
  status: '',
  date_from: '',
  date_to: '',
};

const DEFAULT_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Accepted', label: 'Accepted' },
  { id: 'Rejected', label: 'Rejected' },
  { id: 'Expired', label: 'Expired' },
  { id: 'Converted', label: 'Converted' },
  { id: 'Cancelled', label: 'Cancelled' },
];

type PricedKind = 'estimate' | 'quotation';

function PricedDocsListPage({ kind }: { kind: PricedKind }) {
  const navigate = useNavigate();

  const [convertEstimate] = useConvertEstimateToOrderMutation();
  const [convertQuotation] = useConvertQuotationToOrderMutation();

  const basePath = kind === 'estimate' ? '/sales/estimates' : '/sales/quotations';
  const numberKey = kind === 'estimate' ? 'estimate_number' : 'quotation_number';
  const primaryDateKey = kind === 'estimate' ? 'estimate_date' : 'quotation_date';
  const singular = kind === 'estimate' ? 'estimate' : 'quotation';
  const plural = kind === 'estimate' ? 'estimates' : 'quotations';
  const title = kind === 'estimate' ? 'Estimates' : 'Quotations';
  const newLabel = kind === 'estimate' ? 'New estimate' : 'New quotation';

  const list = useSalesListState({
    defaultFilters: DEFAULT_FILTERS,
    defaultSort: DEFAULT_SORT,
    applyChip: (chip, filters) => {
      if (chip === 'all') return { ...filters, status: '' };
      if (chip) return { ...filters, status: chip };
      return null;
    },
  });

  useEffect(() => {
    if (list.params.get('new') === '1') {
      const cid = list.params.get('customer_id');
      navigate(cid ? `${basePath}/new?customer_id=${cid}` : `${basePath}/new`, { replace: true });
    }
  }, [list.params, navigate, basePath]);

  const listArgs = useMemo(
    () => ({
      q: list.search,
      [numberKey]: list.filters.number || undefined,
      customer_name: list.filters.customer_name || undefined,
      status: list.filters.status || undefined,
      date_from: list.filters.date_from || undefined,
      date_to: list.filters.date_to || undefined,
      ...sortQueryParams(list.sort),
      page: list.page,
      page_size: list.pageSize,
    }),
    [list.search, list.filters, list.sort, list.page, list.pageSize, numberKey],
  );

  const estimatesQuery = useListSalesEstimatesQuery(listArgs, { skip: kind !== 'estimate' });
  const quotationsQuery = useListSalesQuotationsQuery(listArgs, { skip: kind !== 'quotation' });
  const query = kind === 'estimate' ? estimatesQuery : quotationsQuery;
  const { data, isLoading, isFetching, error, refetch } = query;

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, list.pageSize);
  useSyncedPage(list.page, pages, list.setPage);

  const pageAmount = useMemo(
    () => pageRows.reduce((sum, row) => sum + amountOf(row), 0),
    [pageRows],
  );

  const showValidUntil = useMemo(
    () => listHasField(pageRows, 'valid_until', 'expiry_date'),
    [pageRows],
  );
  const showDocDate = useMemo(
    () => listHasField(pageRows, primaryDateKey, 'voucher_date'),
    [pageRows, primaryDateKey],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'number', label: '#', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      ...DATE_RANGE_FIELDS,
    ],
    [],
  );

  const filtersActive = hasActiveListFilters(list.search, list.filters, DEFAULT_FILTERS);

  type Row = (typeof pageRows)[number];

  const columns: EntityListColumn<Row>[] = useMemo(() => {
    const cols: EntityListColumn<Row>[] = [
      {
        id: 'number',
        header: '#',
        render: (row) => {
          const rec = row as Record<string, unknown>;
          return (
            <button
              type="button"
              className="el-doc-link"
              onClick={() => navigate(`${basePath}/${row.id}`)}
            >
              {asCaption(rec[numberKey]) || String(row.id)}
            </button>
          );
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => {
          const rec = row as Record<string, unknown>;
          return (
            asCaption(row.customer_name || rec.party_name) || <span className="el-muted">—</span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => <StatusPill status={row.status} />,
      },
    ];
    if (showDocDate) {
      cols.push({
        id: 'date',
        header: 'Date',
        render: (row) => {
          const rec = row as Record<string, unknown>;
          return (
            dateKey(rec[primaryDateKey] ?? rec.voucher_date) || <span className="el-muted">—</span>
          );
        },
      });
    }
    if (showValidUntil) {
      cols.push({
        id: 'valid_until',
        header: 'Valid until',
        render: (row) => {
          const rec = row as Record<string, unknown>;
          return (
            dateKey(rec.valid_until ?? rec.expiry_date) || <span className="el-muted">—</span>
          );
        },
      });
    }
    cols.push({
      id: 'amount',
      header: 'Amount',
      className: 'el-num',
      headerClassName: 'el-col-num',
      render: (row) => formatMoney(amountOf(row as Record<string, unknown>)),
    });
    return cols;
  }, [navigate, basePath, numberKey, primaryDateKey, showDocDate, showValidUntil]);

  const goNew = () => {
    const cid = list.params.get('customer_id');
    navigate(cid ? `${basePath}/new?customer_id=${cid}` : `${basePath}/new`);
  };

  function setChip(id: string) {
    list.setFilters((prev) => ({
      ...prev,
      status: id === 'all' ? '' : id,
    }));
  }

  async function convertRow(id: string) {
    try {
      const order =
        kind === 'estimate'
          ? await convertEstimate(id).unwrap()
          : await convertQuotation(id).unwrap();
      navigate(`/sales/orders/${order.id}`);
    } catch {
      /* list stays quiet */
    }
  }

  const chipValue = list.filters.status || 'all';
  const sortNumberKey = numberKey;

  return (
    <EntityListPage className="el-page--sales">
      <EntityListHero
        kicker="Sales"
        title={title}
        count={`${total} ${total === 1 ? singular : plural}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={goNew}>
              {newLabel}
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder={`Search ${singular} #, customer, amount…`}
            aria-label={`Search ${plural}`}
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel={`${title} filters`}
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
            excludeKeys={['status']}
            onFiltersChange={(next) => list.setFilters(next as PricedFilters)}
            sort={list.sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: sortNumberKey, label: '#' },
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
      {isLoading ? <EntityListLoading>Loading {plural}…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load {plural}.</ErrorText> : null}

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
              <strong>No {plural} yet</strong>
              <p>
                {kind === 'estimate'
                  ? 'Create an estimate to price work for a customer.'
                  : 'Create a quotation to send pricing to a customer.'}
              </p>
              <Button type="button" onClick={goNew}>
                {newLabel}
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
          actions={(row) => {
            const canConvert = statusIncludes(row.status, 'accepted', 'sent');
            return (
              <EntityListActions
                onOpen={() => navigate(`${basePath}/${row.id}`)}
                onEdit={() => navigate(`${basePath}/${row.id}/edit`)}
                primary={
                  canConvert
                    ? {
                        label: 'Convert',
                        onClick: () => void convertRow(String(row.id)),
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

export function EstimatesListPage() {
  return <PricedDocsListPage kind="estimate" />;
}

export function QuotationsListPage() {
  return <PricedDocsListPage kind="quotation" />;
}

function pricedDocActions(opts: {
  status: unknown;
  onEdit: () => void;
  onMarkSent: () => void;
  onAccept: () => void;
  onConvert: () => void;
}): DocumentDetailAction[] {
  const actions: DocumentDetailAction[] = [
    { id: 'edit', label: 'Edit', variant: 'ghost', onClick: opts.onEdit },
  ];
  if (statusIncludes(opts.status, 'draft')) {
    actions.push({
      id: 'sent',
      label: 'Mark sent',
      variant: 'ghost',
      onClick: opts.onMarkSent,
    });
  }
  if (statusIncludes(opts.status, 'sent')) {
    actions.push({
      id: 'accept',
      label: 'Accept',
      variant: 'ghost',
      onClick: opts.onAccept,
    });
  }
  if (statusIncludes(opts.status, 'accepted', 'sent')) {
    actions.push({
      id: 'convert',
      label: 'Convert to SO',
      variant: 'primary',
      onClick: opts.onConvert,
    });
  }
  return actions;
}

export function EstimateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetSalesEstimateQuery(id, { skip: !id });
  const [setStatus] = useSetSalesEstimateStatusMutation();
  const [convert] = useConvertEstimateToOrderMutation();
  const [actionError, setActionError] = useState('');
  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  if (isLoading) return <EntityListLoading>Loading estimate…</EntityListLoading>;
  if (error || !data) return <ErrorText>Estimate not found.</ErrorText>;

  const party = asCaption(data.customer_name) || '—';

  const actions = pricedDocActions({
    status: data.status,
    onEdit: () => navigate(`/sales/estimates/${id}/edit`),
    onMarkSent: () =>
      void setStatus({ id, status: 'Sent' })
        .unwrap()
        .then(() => refetch())
        .catch((e) => setActionError(extractError(e))),
    onAccept: () =>
      void setStatus({ id, status: 'Accepted' })
        .unwrap()
        .then(() => refetch())
        .catch((e) => setActionError(extractError(e))),
    onConvert: () =>
      void convert(id)
        .unwrap()
        .then((order) => navigate(`/sales/orders/${order.id}`))
        .catch((e) => setActionError(extractError(e))),
  });

  return (
    <DocumentDetail
      backTo="/sales/estimates"
      backLabel="Estimates"
      kicker="Estimate"
      title={asCaption(data.estimate_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Date', dateCaption(data.estimate_date || data.voucher_date)],
        ['Valid until', dateCaption(data.valid_until || data.expiry_date)],
        ['Reference', asCaption(data.reference)],
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

export function QuotationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetSalesQuotationQuery(id, { skip: !id });
  const [setStatus] = useSetSalesQuotationStatusMutation();
  const [convert] = useConvertQuotationToOrderMutation();
  const [actionError, setActionError] = useState('');
  const lines = useMemo(() => mapDocLines(data?.lines), [data]);
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  if (isLoading) return <EntityListLoading>Loading quotation…</EntityListLoading>;
  if (error || !data) return <ErrorText>Quotation not found.</ErrorText>;

  const party = asCaption(data.customer_name) || '—';

  const actions = pricedDocActions({
    status: data.status,
    onEdit: () => navigate(`/sales/quotations/${id}/edit`),
    onMarkSent: () =>
      void setStatus({ id, status: 'Sent' })
        .unwrap()
        .then(() => refetch())
        .catch((e) => setActionError(extractError(e))),
    onAccept: () =>
      void setStatus({ id, status: 'Accepted' })
        .unwrap()
        .then(() => refetch())
        .catch((e) => setActionError(extractError(e))),
    onConvert: () =>
      void convert(id)
        .unwrap()
        .then((order) => navigate(`/sales/orders/${order.id}`))
        .catch((e) => setActionError(extractError(e))),
  });

  return (
    <DocumentDetail
      backTo="/sales/quotations"
      backLabel="Quotations"
      kicker="Quotation"
      title={asCaption(data.quotation_number) || id}
      status={asCaption(data.status) || undefined}
      party={party}
      facts={buildFacts([
        ['Date', dateCaption(data.quotation_date || data.voucher_date)],
        ['Valid until', dateCaption(data.valid_until || data.expiry_date)],
        ['Reference', asCaption(data.reference)],
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
