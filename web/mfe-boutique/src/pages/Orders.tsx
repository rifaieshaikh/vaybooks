import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListBoutiqueOrdersQuery } from '@vaybooks/store';
import {
  Button,
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
  PaginationBar,
  displayName,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { boutiqueOrderPath } from '../order-workspace/types';
import {
  LIST_PAGE_SIZE,
  pagedItems,
  pagedPageCount,
  pagedTotal,
  sortQueryParams,
} from '../pagedList';
import { asCaption } from '../utils';

const ORDER_STATUSES = [
  'Draft',
  'In Progress',
  'Ready For Delivery',
  'Invoice Generated',
  'Delivered',
  'Completed',
  'Cancelled',
] as const;

const DEFAULT_FILTERS = { order_number: '', customer_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'order_date', desc: true }];

export function BoutiqueOrdersListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const seededCustomerName = useRef(false);

  useEffect(() => {
    if (seededCustomerName.current) return;
    seededCustomerName.current = true;
    const name = (params.get('customer_name') || '').trim();
    if (name) setFilters((prev) => ({ ...prev, customer_name: name }));
  }, [params]);

  const { data, isLoading, error } = useListBoutiqueOrdersQuery({
    order_number: filters.order_number || undefined,
    customer_name: filters.customer_name || undefined,
    status: filters.status || undefined,
    ...sortQueryParams(sort),
    page,
    page_size: LIST_PAGE_SIZE,
  });

  const pageRows = pagedItems(data);
  const total = pagedTotal(data);
  const pages = pagedPageCount(data, LIST_PAGE_SIZE);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'order_number', label: 'Order #', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        allLabel: 'All statuses',
        options: ORDER_STATUSES.map((s) => ({ value: s, label: s })),
      },
    ],
    [],
  );

  type OrderRow = (typeof pageRows)[number];

  const columns: EntityListColumn<OrderRow>[] = useMemo(
    () => [
      {
        id: 'order',
        header: 'Order',
        render: (row) => {
          const number = displayName(row, ['order_number'], String(row.id));
          const customer = asCaption(row.customer_name) || 'No customer';
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">{customer}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = asCaption(row.order_status || row.status);
          return <span className={status ? undefined : 'el-muted'}>{status || '—'}</span>;
        },
      },
      {
        id: 'etd',
        header: 'ETD',
        render: (row) => {
          const etdLabel = asCaption(row.expected_delivery_date).slice(0, 10);
          return <span className={etdLabel ? undefined : 'el-muted'}>{etdLabel || '—'}</span>;
        },
      },
    ],
    [],
  );

  function openOrder(row: OrderRow) {
    const status = String(row.order_status || row.status || '');
    navigate(boutiqueOrderPath(String(row.id), status));
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Customization Orders"
        count={`${total} ${total === 1 ? 'order' : 'orders'}`}
        actions={
          <Button type="button" onClick={() => navigate('/boutique/orders/workspace')}>
            New order
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
            options={[
              { id: 'all', label: 'All' },
              ...ORDER_STATUSES.map((s) => ({ id: s, label: s })),
            ]}
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
              { value: 'order_number', label: 'Order #' },
              { value: 'order_status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading orders…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load boutique orders.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No orders found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => openOrder(row)}
          onNew={() => navigate('/boutique/orders/workspace')}
          actions={(row) => <EntityListActions onOpen={() => openOrder(row)} />}
        />
      ) : null}

      {!isLoading && !error && total > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar
              page={Math.min(page, pages)}
              pageCount={pages}
              onPage={setPage}
              totalCount={total}
              pageSize={LIST_PAGE_SIZE}
            />
          </div>
        </EntityListFoot>
      ) : null}
    </EntityListPage>
  );
}

export { BoutiqueOrderDetailPage } from '../order-workspace/OrderDetailPage';
