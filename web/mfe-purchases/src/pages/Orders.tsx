import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  EntityListTable,
  ErrorText,
  PAGE_SIZE,
  PaginationBar,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
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

const DEFAULT_FILTERS = { po_number: '', vendor_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'order_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Partially Received', label: 'Partially Received' },
  { id: 'Received', label: 'Received' },
  { id: 'Closed', label: 'Closed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function PurchaseOrdersListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data = [], isLoading, error } = useListPurchaseOrdersQuery();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (params.get('new') === '1') {
      const vid = params.get('vendor_id');
      navigate(vid ? `/purchases/orders/new?vendor_id=${vid}` : '/purchases/orders/new', {
        replace: true,
      });
    }
  }, [params, navigate]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'po_number', label: 'PO #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.po_number, filters.po_number)) return false;
      if (!matchesRegex(row.vendor_name, filters.vendor_name)) return false;
      if (filters.status && String(row.status) !== filters.status) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type OrderRow = (typeof data)[number];

  const columns: EntityListColumn<OrderRow>[] = useMemo(
    () => [
      {
        id: 'po',
        header: 'PO #',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{asCaption(row.po_number) || String(row.id)}</span>
              <span className="el-customer-sub">{asCaption(row.order_date).slice(0, 10) || '—'}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) => asCaption(row.vendor_name) || '—',
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status) || '—',
      },
      {
        id: 'amount',
        header: 'Amount',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.total_amount ?? 0)),
      },
    ],
    [],
  );

  const goNew = () => {
    const vid = params.get('vendor_id');
    navigate(vid ? `/purchases/orders/new?vendor_id=${vid}` : '/purchases/orders/new');
  };

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Purchases"
        title="Purchase Orders"
        count={`${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`}
        actions={
          <Button type="button" onClick={goNew}>
            New PO
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.status || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, status: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={STATUS_CHIPS}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'order_date', label: 'Date' },
              { value: 'po_number', label: 'PO #' },
              { value: 'total_amount', label: 'Amount' },
              { value: 'status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading purchase orders…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load purchase orders.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No purchase orders found.</strong>
          <p>Create a purchase order to buy from a vendor.</p>
          <Button type="button" onClick={goNew}>
            New PO
          </Button>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/orders/${row.id}`)} />
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
