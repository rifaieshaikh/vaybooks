import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

const DEFAULT_FILTERS = { grn_number: '', vendor_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'receipt_date', desc: true }];
const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Received', label: 'Received' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function GoodsReceiptListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data = [], isLoading, error } = useListGoodsReceiptsQuery();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (params.get('new') === '1') {
      const vid = params.get('vendor_id');
      const po = params.get('purchase_order_id');
      const qs = new URLSearchParams();
      if (vid) qs.set('vendor_id', vid);
      if (po) qs.set('purchase_order_id', po);
      const q = qs.toString();
      navigate(q ? `/purchases/goods-receipt/new?${q}` : '/purchases/goods-receipt/new', {
        replace: true,
      });
    }
  }, [params, navigate]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'grn_number', label: 'GRN #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.grn_number, filters.grn_number)) return false;
      if (!matchesRegex(row.vendor_name, filters.vendor_name)) return false;
      if (filters.status && String(row.status) !== filters.status) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type GrnRow = (typeof data)[number];

  const columns: EntityListColumn<GrnRow>[] = useMemo(
    () => [
      {
        id: 'grn',
        header: 'GRN #',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{asCaption(row.grn_number) || String(row.id)}</span>
              <span className="el-customer-sub">{asCaption(row.receipt_date).slice(0, 10) || '—'}</span>
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
    navigate(vid ? `/purchases/goods-receipt/new?vendor_id=${vid}` : '/purchases/goods-receipt/new');
  };

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Purchases"
        title="Goods Receipt"
        count={`${filtered.length} ${filtered.length === 1 ? 'receipt' : 'receipts'}`}
        actions={
          <Button type="button" onClick={goNew}>
            New GRN
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
              { value: 'receipt_date', label: 'Date' },
              { value: 'grn_number', label: 'GRN #' },
              { value: 'total_amount', label: 'Amount' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading goods receipts…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load goods receipts.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No goods receipts found.</strong>
          <p>Receive goods against a purchase order.</p>
          <Button type="button" onClick={goNew}>
            New GRN
          </Button>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/goods-receipt/${row.id}`)} />
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
