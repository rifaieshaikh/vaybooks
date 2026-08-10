import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { matchesRegex, type FilterValues, type SortCriterion } from '@vaybooks/ui-kit';
import { asCaption } from '../utils';

export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
export type SalesPageSize = (typeof PAGE_SIZE_OPTIONS)[number];

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
      row.sale_date ?? row.order_date ?? row.delivery_date ?? row.return_date ?? row.estimate_date ?? row.quotation_date ?? row.voucher_date;
    if (isThisMonth(dateVal)) monthTotal += amount;
  }
  return { count: rows.length, total, monthTotal };
}

export function isOpenOrderStatus(status: unknown): boolean {
  const s = String(status || '').toLowerCase();
  return Boolean(s) && !s.includes('closed') && !s.includes('cancelled') && !s.includes('canceled');
}

export function isPendingDnStatus(status: unknown): boolean {
  const s = String(status || '').toLowerCase();
  if (!s) return false;
  if (s.includes('cancel')) return false;
  if (s.includes('delivered') && !s.includes('partial')) return false;
  return (
    s.includes('draft') ||
    s.includes('confirm') ||
    s.includes('dispatch') ||
    s.includes('partial')
  );
}

type UseSalesListStateOpts<F extends FilterValues> = {
  defaultFilters: F;
  defaultSort: SortCriterion[];
  /** Map URL chip → filter patch. Return null to ignore. */
  applyChip?: (chip: string, filters: F) => F | null;
  /** When month=current, which filter key to set to 'current' (or custom handler). */
  monthFilterKey?: keyof F & string;
};

export function useSalesListState<F extends FilterValues>(opts: UseSalesListStateOpts<F>) {
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
  const [pageSize, setPageSize] = useState<SalesPageSize>(12);

  useEffect(() => {
    if (params.get('q') != null) setSearch(params.get('q') || '');
  }, [params]);

  const chipFromUrl = params.get('chip') || params.get('status') || '';
  const monthFromUrl = params.get('month') || '';

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
    setPageSize: (n: SalesPageSize) => {
      setPageSize(n);
      setPage(1);
    },
    chipFromUrl,
    monthFromUrl,
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
  for (const k of ['balance_due', 'balance', 'amount_due']) {
    if (row[k] != null && row[k] !== '') {
      const n = Number(row[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Stable filter field defs for date range (text YYYY-MM-DD). */
export const DATE_RANGE_FIELDS = [
  { key: 'date_from', label: 'From date', type: 'text' as const, placeholder: 'YYYY-MM-DD' },
  { key: 'date_to', label: 'To date', type: 'text' as const, placeholder: 'YYYY-MM-DD' },
];

export function withDateRangeFilters<T extends FilterValues>(base: T): T & {
  date_from: string;
  date_to: string;
} {
  return { ...base, date_from: '', date_to: '' };
}
