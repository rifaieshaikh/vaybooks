import { useMemo, useState } from 'react';
import { useListFinanceVouchersQuery } from '@vaybooks/store';
import {
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

const DEFAULT_FILTERS = { voucher_number: '', voucher_type: '', description: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'voucher_date', desc: true }];

const VOUCHER_TYPE_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Receipt', label: 'Receipt' },
  { id: 'Payment', label: 'Payment' },
  { id: 'Journal', label: 'Journal' },
  { id: 'Credit Note', label: 'Credit Note' },
  { id: 'Debit Note', label: 'Debit Note' },
  { id: 'Sales Invoice', label: 'Sales Invoice' },
] as const;

export function VouchersListPage() {
  const { data = [], isLoading, error } = useListFinanceVouchersQuery();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'voucher_number', label: 'Number', type: 'text' },
      {
        key: 'voucher_type',
        label: 'Type',
        type: 'select',
        allLabel: 'All types',
        options: VOUCHER_TYPE_CHIPS.filter((c) => c.id !== 'all').map((c) => ({
          value: c.id,
          label: c.label,
        })),
      },
      { key: 'description', label: 'Description', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.voucher_number, filters.voucher_number)) return false;
      if (filters.voucher_type && String(row.voucher_type || '') !== filters.voucher_type) return false;
      if (!matchesRegex(row.description, filters.description)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type VoucherRow = (typeof data)[number];

  const columns: EntityListColumn<VoucherRow>[] = useMemo(
    () => [
      {
        id: 'voucher',
        header: 'Voucher',
        render: (row) => {
          const number = asCaption(row.voucher_number) || String(row.id);
          const type = asCaption(row.voucher_type);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">{type || 'No type'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'date',
        header: 'Date',
        render: (row) => asCaption(row.voucher_date).slice(0, 10) || '—',
      },
      {
        id: 'amount',
        header: 'Amount',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => formatMoney(Number(row.amount ?? 0)),
      },
      {
        id: 'party',
        header: 'Party',
        render: (row) => {
          const party = asCaption(row.party_name);
          return <span className={party ? undefined : 'el-muted'}>{party || '—'}</span>;
        },
      },
      {
        id: 'description',
        header: 'Description',
        render: (row) => {
          const desc = asCaption(row.description);
          const party = asCaption(row.party_name);
          if (!desc || desc.length > 80 || desc === party) {
            return <span className="el-muted">—</span>;
          }
          return <span title={desc}>{desc}</span>;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Finance"
        title="Vouchers"
        count={`${filtered.length} ${filtered.length === 1 ? 'voucher' : 'vouchers'}`}
        chips={
          <EntityListQuickFilters
            ariaLabel="Voucher type"
            value={filters.voucher_type || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, voucher_type: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[...VOUCHER_TYPE_CHIPS]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_FILTERS}
            excludeKeys={['voucher_type']}
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
        }
      />

      {isLoading ? <EntityListLoading>Loading vouchers…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load vouchers.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No vouchers found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
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
