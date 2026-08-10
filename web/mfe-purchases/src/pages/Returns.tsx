import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  EntityListTable,
  ErrorText,
  PAGE_SIZE,
  PaginationBar,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
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

const DEFAULT_FILTERS = { return_number: '', vendor_name: '', amount: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'return_date', desc: true }];

export function PurchaseReturnsListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data = [], isLoading, error } = useListPurchaseReturnsQuery();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (params.get('new') === '1') {
      const vid = params.get('vendor_id');
      navigate(vid ? `/purchases/returns/new?vendor_id=${vid}` : '/purchases/returns/new', {
        replace: true,
      });
    }
  }, [params, navigate]);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'return_number', label: 'Return #', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.return_number, filters.return_number)) return false;
      if (!matchesRegex(row.vendor_name, filters.vendor_name)) return false;
      const amount = Number(row.total_amount ?? 0);
      if (filters.amount === 'with' && !(Math.abs(amount) > 0.01)) return false;
      if (filters.amount === 'zero' && Math.abs(amount) >= 0.01) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type ReturnRow = (typeof data)[number];

  const columns: EntityListColumn<ReturnRow>[] = useMemo(
    () => [
      {
        id: 'return',
        header: 'Return #',
        render: (row) => (
          <div className="el-customer">
            <div className="el-customer-meta">
              <span className="el-customer-name">{asCaption(row.return_number) || String(row.id)}</span>
              <span className="el-customer-sub">{asCaption(row.return_date).slice(0, 10) || '—'}</span>
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
    navigate(vid ? `/purchases/returns/new?vendor_id=${vid}` : '/purchases/returns/new');
  };

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Purchases"
        title="Purchase Returns"
        count={`${filtered.length} ${filtered.length === 1 ? 'return' : 'returns'}`}
        actions={
          <Button type="button" onClick={goNew}>
            New return
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Amount"
            value={filters.amount || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, amount: id === 'all' ? '' : id }));
              setPage(1);
            }}
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
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['amount']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_SORT}
            sortOptions={[
              { value: 'return_date', label: 'Date' },
              { value: 'return_number', label: 'Return #' },
              { value: 'total_amount', label: 'Amount' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading returns…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load returns.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No returns found.</strong>
          <p>Record a purchase return to send goods back to a vendor.</p>
          <Button type="button" onClick={goNew}>
            New return
          </Button>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/purchases/returns/${row.id}`)} />
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
