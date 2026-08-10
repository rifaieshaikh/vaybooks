/** Helpers for backend-paginated boutique EntityList pages. */

import type { SortCriterion } from '@vaybooks/ui-kit';
import { PAGE_SIZE, pageCount } from '@vaybooks/ui-kit';

export const LIST_PAGE_SIZE = PAGE_SIZE;
/** Pickers / nested panels that need a larger slice of a paged list. */
export const LIST_FETCH_ALL_SIZE = 500;

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

export function pagedPageCount(data: PagedListData | undefined, pageSize = LIST_PAGE_SIZE): number {
  return pageCount(pagedTotal(data), pageSize);
}

export function sortQueryParams(sort: SortCriterion[]): {
  sort_by?: string;
  sort_desc?: boolean;
} {
  const primary = sort[0];
  if (!primary?.key) return {};
  return { sort_by: primary.key, sort_desc: Boolean(primary.desc) };
}
