import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetBoutiqueItemQuery, useListBoutiqueItemsQuery } from '@vaybooks/store';
import {
  EntityCard,
  EntityCardGrid,
  ErrorText,
  ListToolbar,
  PAGE_SIZE,
  PaginationBar,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';

const DEFAULT_FILTERS = { bill_number: '', description: '', customer_name: '' };
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
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.bill_number, filters.bill_number)) return false;
      if (!matchesRegex(row.description, filters.description)) return false;
      if (!matchesRegex(row.customer_name, filters.customer_name)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  return (
    <div>
      <ListToolbar
        title="Customization Items"
        countLabel="items"
        count={filtered.length}
        primaryLabel="Orders"
        onPrimary={() => navigate('/boutique/orders')}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_FILTERS}
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
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load items.</ErrorText> : null}
      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.item_id || row.id)}
            title={asCaption(row.bill_number) || asCaption(row.description)}
            captions={[
              asCaption(row.description),
              asCaption(row.customer_name),
              asCaption(row.order_number),
              asCaption(row.item_status),
            ]}
            onView={() =>
              navigate(
                `/boutique/items/${row.item_id || row.id}?orderId=${encodeURIComponent(String(row.order_id || ''))}`,
              )
            }
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
    </div>
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
