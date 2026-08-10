import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useGetPurchaseBillQuery,
  useListPurchaseBillsQuery,
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
import { asCaption, formatMoney } from '../utils';
import { canEditInvoiceMonth } from '../editors/linePreview';
import {
  buildFacts,
  dateCaption,
  mapDocLines,
  moneySummaryFromDoc,
  notesFromDoc,
} from './documentDetailHelpers';

const DEFAULT_FILTERS = {
  vendor_bill_number: '',
  vendor_name: '',
  voucher_number: '',
  has_voucher: '',
};
const DEFAULT_SORT: SortCriterion[] = [{ key: 'bill_date', desc: true }];
const VOUCHER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'yes', label: 'Has voucher' },
  { id: 'no', label: 'No voucher' },
];

export function PurchaseBillsListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data = [], isLoading, error } = useListPurchaseBillsQuery();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (params.get('new') === '1') {
      const vid = params.get('vendor_id');
      navigate(vid ? `/purchases/bills/new?vendor_id=${vid}` : '/purchases/bills/new', {
        replace: true,
      });
    }
  }, [params, navigate]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'vendor_bill_number', label: 'Vendor bill #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'voucher_number', label: 'Voucher #', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.vendor_bill_number, filters.vendor_bill_number)) return false;
      if (!matchesRegex(row.vendor_name || row.party_name, filters.vendor_name)) return false;
      if (!matchesRegex(row.voucher_number, filters.voucher_number)) return false;
      const hasVoucher = Boolean(String(row.voucher_number || '').trim());
      if (filters.has_voucher === 'yes' && !hasVoucher) return false;
      if (filters.has_voucher === 'no' && hasVoucher) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type BillRow = (typeof data)[number];

  const columns: EntityListColumn<BillRow>[] = useMemo(
    () => [
      {
        id: 'bill',
        header: 'Bill #',
        render: (row) => {
          const title =
            asCaption(row.vendor_bill_number) || asCaption(row.voucher_number) || String(row.id);
          const desc = asCaption(row.description || row.caption);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{title}</span>
                <span className="el-customer-sub">
                  {asCaption(row.bill_date).slice(0, 10) || '—'}
                  {desc && desc.length <= 80 ? ` · ${desc}` : ''}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'vendor',
        header: 'Vendor',
        render: (row) => asCaption(row.vendor_name || row.party_name) || '—',
      },
      {
        id: 'voucher',
        header: 'Voucher #',
        render: (row) => asCaption(row.voucher_number) || '—',
      },
      {
        id: 'amount',
        header: 'Amount',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.total ?? row.amount ?? 0)),
      },
    ],
    [],
  );

  const goNew = () => {
    const vid = params.get('vendor_id');
    navigate(vid ? `/purchases/bills/new?vendor_id=${vid}` : '/purchases/bills/new');
  };

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Purchases"
        title="Purchase Bills"
        count={`${filtered.length} ${filtered.length === 1 ? 'bill' : 'bills'}`}
        actions={
          <Button type="button" onClick={goNew}>
            New bill
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Voucher"
            value={filters.has_voucher || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, has_voucher: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={VOUCHER_CHIPS}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['has_voucher']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'bill_date', label: 'Date' },
              { value: 'total', label: 'Amount' },
              { value: 'voucher_number', label: 'Voucher #' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading bills…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load bills.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No bills found.</strong>
          <p>Create a bill to record a vendor purchase.</p>
          <Button type="button" onClick={goNew}>
            New bill
          </Button>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/bills/${row.id}`)} />
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

export function PurchaseBillDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetPurchaseBillQuery(id, { skip: !id });

  const lines = useMemo(
    () => mapDocLines(data?.lines || data?.items),
    [data],
  );
  const summary = useMemo(
    () => (data ? moneySummaryFromDoc(data as Record<string, unknown>) : []),
    [data],
  );

  if (isLoading) return <EntityListLoading>Loading bill…</EntityListLoading>;
  if (error || !data) return <ErrorText>Purchase bill not found.</ErrorText>;

  const dateStr = dateCaption(data.bill_date || data.voucher_date);
  const editable = canEditInvoiceMonth(dateStr);
  const party = asCaption(data.vendor_name || data.party_name) || '—';
  const poId = asCaption(data.purchase_order_id);
  const poLabel = asCaption(data.po_number) || poId;
  const grnId = asCaption(data.reference_grn_id || data.grn_id);
  const grnLabel = asCaption(data.grn_number) || grnId;

  const actions: DocumentDetailAction[] = [
    {
      id: 'edit',
      label: 'Edit',
      variant: 'ghost',
      disabled: !editable,
      title: editable ? 'Edit bill' : 'Bills can only be edited in the same calendar month',
      onClick: () => navigate(`/purchases/bills/${id}/edit`),
    },
  ];

  const related = [
    poId ? { id: 'po', label: `PO ${poLabel}`, to: `/purchases/orders/${poId}` } : null,
    grnId
      ? { id: 'grn', label: `GRN ${grnLabel}`, to: `/purchases/goods-receipt/${grnId}` }
      : null,
  ].filter(Boolean) as { id: string; label: string; to: string }[];

  return (
    <DocumentDetail
      backTo="/purchases/bills"
      backLabel="Bills"
      kicker="Purchase bill"
      title={asCaption(data.vendor_bill_number) || asCaption(data.voucher_number) || id}
      status={asCaption(data.status || data.payment_status) || undefined}
      party={party}
      facts={buildFacts([
        ['Bill date', dateStr],
        ['Due date', dateCaption(data.due_date)],
        ['Payment', asCaption(data.payment_mode || data.payment_status)],
        ['Vendor GSTIN', asCaption(data.vendor_gstin || data.gstin)],
        ['Voucher', asCaption(data.voucher_number)],
      ])}
      related={related.length ? related : undefined}
      actions={actions}
      error={!editable ? 'Edit is locked — bill date is outside the current month.' : null}
      notes={notesFromDoc(data as Record<string, unknown>)}
      lines={lines}
      summary={
        summary.length
          ? summary
          : [{ label: 'Grand total', value: Number(data.total ?? data.amount ?? 0) }]
      }
    />
  );
}
