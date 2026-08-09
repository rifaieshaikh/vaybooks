import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetBoutiqueItemQuery, useListBoutiqueItemsQuery } from '@vaybooks/store';
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
  PAGE_SIZE,
  PaginationBar,
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';

const ITEM_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;

const DEFAULT_FILTERS = { bill_number: '', description: '', customer_name: '', status: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'bill_number', desc: false }];

export function BoutiqueItemsListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useListBoutiqueItemsQuery();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'bill_number', label: 'Bill #', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'customer_name', label: 'Customer', type: 'text' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        allLabel: 'All statuses',
        options: ITEM_STATUSES.map((s) => ({ value: s, label: s })),
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.bill_number, filters.bill_number)) return false;
      if (!matchesRegex(row.description, filters.description)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      if (filters.status && String(row.item_status || '') !== filters.status) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type ItemRow = (typeof data)[number];

  const columns: EntityListColumn<ItemRow>[] = useMemo(
    () => [
      {
        id: 'item',
        header: 'Item',
        render: (row) => {
          const title = displayName(row, ['bill_number', 'description'], 'Unnamed item');
          const desc = asCaption(row.description);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{title}</span>
                <span className="el-customer-sub">{desc || 'No description'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        render: (row) => {
          const customer = asCaption(row.customer_name);
          return <span className={customer ? undefined : 'el-muted'}>{customer || '—'}</span>;
        },
      },
      {
        id: 'order',
        header: 'Order',
        render: (row) => {
          const order = asCaption(row.order_number);
          return <span className={order ? undefined : 'el-muted'}>{order || '—'}</span>;
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => {
          const status = asCaption(row.item_status);
          return <span className={status ? undefined : 'el-muted'}>{status || '—'}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Boutique"
        title="Customization Items"
        count={`${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`}
        actions={
          <Button type="button" onClick={() => navigate('/boutique/orders')}>
            Orders
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
              ...ITEM_STATUSES.map((s) => ({ id: s, label: s })),
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
              { value: 'bill_number', label: 'Bill #' },
              { value: 'order_number', label: 'Order #' },
              { value: 'customer_name', label: 'Customer' },
              { value: 'item_status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading items…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load items.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No items found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.item_id || row.id)}
          actions={(row) => (
            <EntityListActions
              onOpen={() =>
                navigate(
                  `/boutique/items/${row.item_id || row.id}?orderId=${encodeURIComponent(String(row.order_id || ''))}`,
                )
              }
            />
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

export function BoutiqueItemDetailPage() {
  const { id = '' } = useParams();
  const orderId = new URLSearchParams(window.location.search).get('orderId') || undefined;
  const { data, isLoading, error } = useGetBoutiqueItemQuery(
    { itemId: id, orderId },
    { skip: !id },
  );

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Item not found.</ErrorText>;

  const item = (data.item as Record<string, unknown> | undefined) || data;
  const order = data.order as Record<string, unknown> | undefined;

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', color: 'var(--vb-color-primary, #185c4c)' }}>
        {asCaption(item.bill_number) || id}
      </h2>
      <p style={{ color: '#667' }}>
        {asCaption(item.description)} · {asCaption(item.item_status)}
      </p>
      {order ? (
        <p style={{ marginTop: 12 }}>
          Order {asCaption(order.order_number)} · {asCaption(order.customer_name)} ·{' '}
          {asCaption(order.order_status)}
        </p>
      ) : (
        <p style={{ marginTop: 12 }}>
          Order {asCaption(data.order_number)} · {asCaption(data.customer_name)}
        </p>
      )}
      <p style={{ marginTop: 8 }}>
        Sell {formatMoney(Number(item.sell_amount ?? data.sell_amount ?? 0))} · Margin{' '}
        {formatMoney(Number(item.margin_amount ?? data.margin_amount ?? 0))}
      </p>
    </div>
  );
}
