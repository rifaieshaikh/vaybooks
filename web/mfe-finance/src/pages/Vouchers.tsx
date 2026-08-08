import { useMemo, useState } from 'react';
import {
  useListFinanceVouchersQuery,
} from '@vaybooks/store';
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


const DEFAULT_FILTERS = { voucher_number: '', voucher_type: '', description: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'voucher_date', desc: true }];

export function VouchersListPage() {
  const { data = [], isLoading, error } = useListFinanceVouchersQuery();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'voucher_number', label: 'Number', type: 'text' },
      { key: 'voucher_type', label: 'Type', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.voucher_number, filters.voucher_number)) return false;
      if (!matchesRegex(row.voucher_type, filters.voucher_type)) return false;
      if (!matchesRegex(row.description, filters.description)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  return (
    <div>
      <ListToolbar
        title="Vouchers"
        countLabel="vouchers"
        count={filtered.length}
        primaryLabel="Refresh"
        onPrimary={() => undefined}
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
          { value: 'voucher_date', label: 'Date' },
          { value: 'voucher_number', label: 'Number' },
          { value: 'amount', label: 'Amount' },
          { value: 'voucher_type', label: 'Type' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load vouchers.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 && <p>No vouchers found.</p>}

      <EntityCardGrid>
        {pageRows.map((row) => {
          const desc = asCaption(row.description);
          const party = asCaption(row.party_name);
          return (
            <EntityCard
              key={String(row.id)}
              title={asCaption(row.voucher_number) || String(row.id)}
              captions={[
                asCaption(row.voucher_type),
                asCaption(row.voucher_date).slice(0, 10),
                formatMoney(Number(row.amount ?? 0)),
                party,
                desc && desc.length <= 80 && desc !== party ? desc : '',
              ].filter(Boolean)}
            />
          );
        })}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
    </div>
  );
}
