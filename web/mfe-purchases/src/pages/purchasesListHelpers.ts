import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { matchesRegex, type FilterValues, type SortCriterion } from '@vaybooks/ui-kit';
import { asCaption } from '../utils';

export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
export type PurchasesPageSize = (typeof PAGE_SIZE_OPTIONS)[number];
/** Pickers / editors that need a larger slice of a paged list. */
export const LIST_FETCH_ALL_SIZE = 500;

export function dateKey(value: unknown): string {
  return asCaption(value).slice(0, 10);
}

export function isThisMonth(value: unknown, now = new Date()): boolean {
  const key = dateKey(value);
  if (!key || key.length < 7) return false;
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return key.startsWith(`${y}-${m}`);
}

export function inDateRange(value: unknown, from: string, to: string): boolean {
  const key = dateKey(value);
  if (!key) return !(from || to);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

export function matchesDocSearch(
  row: Record<string, unknown>,
  search: string,
  fields: string[],
): boolean {
  const q = search.trim();
  if (!q) return true;
  for (const field of fields) {
    if (matchesRegex(row[field], q)) return true;
  }
  const amount = Number(row.net ?? row.gross ?? row.total ?? row.total_amount ?? row.amount ?? NaN);
  if (Number.isFinite(amount) && matchesRegex(String(amount), q)) return true;
  return false;
}

export function listHasField(rows: Record<string, unknown>[], ...keys: string[]): boolean {
  return rows.some((row) => keys.some((k) => row[k] != null && String(row[k]).trim() !== ''));
}

export function listPulseMoney(
  rows: Record<string, unknown>[],
  amountKeys: string[] = ['net', 'gross', 'total', 'total_amount', 'amount'],
): { count: number; total: number; monthTotal: number } {
  let total = 0;
  let monthTotal = 0;
  for (const row of rows) {
    let amount = 0;
    for (const k of amountKeys) {
      if (row[k] != null && row[k] !== '') {
        const n = Number(row[k]);
        if (Number.isFinite(n)) {
          amount = n;
          break;
        }
      }
    }
    total += amount;
    const dateVal =
      row.bill_date ??
      row.order_date ??
      row.receipt_date ??
      row.return_date ??
      row.voucher_date;
    if (isThisMonth(dateVal)) monthTotal += amount;
  }
  return { count: rows.length, total, monthTotal };
}

export function isOpenPoStatus(status: unknown): boolean {
  const s = String(status || '').toLowerCase();
  return Boolean(s) && !s.includes('closed') && !s.includes('cancelled') && !s.includes('canceled');
}

export function isPendingGrnStatus(status: unknown): boolean {
  const s = String(status || '').toLowerCase();
  if (!s) return true;
  if (s.includes('cancel')) return false;
  if (s.includes('received') && !s.includes('partial')) return false;
  return s.includes('draft') || s.includes('partial') || s.includes('pending');
}

type UsePurchasesListStateOpts<F extends FilterValues> = {
  defaultFilters: F;
  defaultSort: SortCriterion[];
  applyChip?: (chip: string, filters: F) => F | null;
  monthFilterKey?: keyof F & string;
};

export function usePurchasesListState<F extends FilterValues>(opts: UsePurchasesListStateOpts<F>) {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => params.get('q') || '');
  const [filters, setFilters] = useState<F>(() => {
    let next = { ...opts.defaultFilters };
    const chip = params.get('chip') || params.get('status') || '';
    if (chip && opts.applyChip) {
      const patched = opts.applyChip(chip, next);
      if (patched) next = patched;
    }
    const month = params.get('month');
    if (month === 'current' && opts.monthFilterKey) {
      next = { ...next, [opts.monthFilterKey]: 'current' } as F;
    }
    return next;
  });
  const [sort, setSort] = useState<SortCriterion[]>(opts.defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PurchasesPageSize>(12);

  useEffect(() => {
    if (params.get('q') != null) setSearch(params.get('q') || '');
  }, [params]);

  return {
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    filters,
    setFilters: (next: F | ((prev: F) => F)) => {
      setFilters(next);
      setPage(1);
    },
    sort,
    setSort: (next: SortCriterion[]) => {
      setSort(next);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize: (n: PurchasesPageSize) => {
      setPageSize(n);
      setPage(1);
    },
    params,
  };
}

export function amountOf(row: Record<string, unknown>): number {
  for (const k of ['net', 'gross', 'total', 'total_amount', 'amount']) {
    if (row[k] != null && row[k] !== '') {
      const n = Number(row[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

export function hasActiveListFilters(
  search: string,
  filters: FilterValues,
  defaultFilters: FilterValues,
): boolean {
  if (search.trim()) return true;
  return Object.keys(defaultFilters).some((k) => Boolean(filters[k]));
}

export function useSyncedPage(page: number, pages: number, setPage: (p: number) => void) {
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages, setPage]);
}

export function balanceOf(row: Record<string, unknown>): number | null {
  for (const k of ['balance_due', 'outstanding', 'balance', 'amount_due']) {
    if (row[k] != null && row[k] !== '') {
      const n = Number(row[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export const DATE_RANGE_FIELDS = [
  { key: 'date_from', label: 'From date', type: 'text' as const, placeholder: 'YYYY-MM-DD' },
  { key: 'date_to', label: 'To date', type: 'text' as const, placeholder: 'YYYY-MM-DD' },
];

/** Server-paged list helpers. */
export type PagedListData = {
  items?: Record<string, unknown>[];
  total?: number;
  page?: number;
  page_size?: number;
};

export function pagedItems(data: PagedListData | undefined): Record<string, unknown>[] {
  return Array.isArray(data?.items) ? data.items : [];
}

export function pagedTotal(data: PagedListData | undefined): number {
  return Number(data?.total ?? 0);
}

export function pagedPageCount(data: PagedListData | undefined, pageSize: number): number {
  const total = pagedTotal(data);
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)) || 1);
}

export function sortQueryParams(sort: { key: string; desc: boolean }[]): {
  sort_by?: string;
  sort_desc?: boolean;
} {
  const primary = sort[0];
  if (!primary?.key) return {};
  return { sort_by: primary.key, sort_desc: Boolean(primary.desc) };
}

export function currentMonthRange(now = new Date()): { date_from: string; date_to: string } {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    date_from: `${y}-${m}-01`,
    date_to: `${y}-${m}-${String(last).padStart(2, '0')}`,
  };
}
