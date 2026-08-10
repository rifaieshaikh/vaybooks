"""Shared list pagination helpers for typed service APIs."""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence, TypeVar

T = TypeVar("T")

DEFAULT_PAGE_SIZE = 12
MAX_PAGE_SIZE = 500


def clamp_page(page: int | None = None, page_size: int | None = None) -> tuple[int, int]:
    """Return 1-based ``(page, page_size)`` clamped to safe bounds."""
    p = max(1, int(page or 1))
    size = int(page_size if page_size is not None else DEFAULT_PAGE_SIZE)
    size = max(1, min(size, MAX_PAGE_SIZE))
    return p, size


def contains_ci(haystack: Any, needle: str) -> bool:
    """Case-insensitive substring match; empty needle matches everything."""
    text = (needle or "").strip()
    if not text:
        return True
    return text.lower() in str(haystack or "").lower()


def date_key(value: Any) -> str:
    """Normalize a date-ish value to ``YYYY-MM-DD`` (or empty)."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return text[:10]


def in_date_range(value: Any, date_from: str = "", date_to: str = "") -> bool:
    """Inclusive date range on ``YYYY-MM-DD`` prefixes; empty bounds pass."""
    start = (date_from or "").strip()[:10]
    end = (date_to or "").strip()[:10]
    if not start and not end:
        return True
    key = date_key(value)
    if not key:
        return False
    if start and key < start:
        return False
    if end and key > end:
        return False
    return True


def filter_by_date_range(
    rows: Iterable[Mapping[str, Any]],
    field: str,
    *,
    date_from: str = "",
    date_to: str = "",
    alt_fields: Sequence[str] = (),
) -> list[Mapping[str, Any]]:
    """Keep rows whose date field (or first non-empty alt) falls in range."""
    start = (date_from or "").strip()
    end = (date_to or "").strip()
    if not start and not end:
        return list(rows)
    fields = (field, *tuple(alt_fields or ()))
    out: list[Mapping[str, Any]] = []
    for row in rows:
        value = None
        for f in fields:
            if not f:
                continue
            raw = row.get(f)
            if raw is not None and str(raw).strip():
                value = raw
                break
        if in_date_range(value, start, end):
            out.append(row)
    return out


def sort_dicts(
    rows: Sequence[Mapping[str, Any]],
    sort_by: str = "",
    *,
    sort_desc: bool = True,
) -> list[Mapping[str, Any]]:
    """Stable-ish sort of dict rows by one key (numbers before strings)."""
    key = (sort_by or "").strip()
    if not key:
        return list(rows)

    def sort_key(row: Mapping[str, Any]) -> tuple[int, Any]:
        value = row.get(key)
        if isinstance(value, bool):
            return (0, int(value))
        if isinstance(value, (int, float)):
            return (0, value)
        return (1, str(value or "").lower())

    return sorted(rows, key=sort_key, reverse=bool(sort_desc))


def page_slice(items: Sequence[T], page: int, page_size: int) -> tuple[list[T], int, int, int]:
    """Return ``(slice, total, page, page_size)`` with page clamped to last page."""
    total = len(items)
    p, size = clamp_page(page, page_size)
    if total == 0:
        return [], 0, 1, size
    last = max(1, (total + size - 1) // size)
    if p > last:
        p = last
    start = (p - 1) * size
    return list(items[start : start + size]), total, p, size


def paged_result(
    items: Sequence[T],
    *,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    """Standard list envelope: ``{items, total, page, page_size}``."""
    sliced, total, p, size = page_slice(items, page, page_size)
    return {
        "items": sliced,
        "total": total,
        "page": p,
        "page_size": size,
    }


def filter_dicts(
    rows: Iterable[Mapping[str, Any]],
    *,
    equals: Mapping[str, str] | None = None,
    contains: Mapping[str, str] | None = None,
) -> list[Mapping[str, Any]]:
    """Filter dict rows by exact field equals and/or contains (case-insensitive)."""
    out: list[Mapping[str, Any]] = []
    eq = {k: (v or "").strip() for k, v in (equals or {}).items() if (v or "").strip()}
    cont = {
        k: (v or "").strip() for k, v in (contains or {}).items() if (v or "").strip()
    }
    for row in rows:
        ok = True
        for key, want in eq.items():
            if str(row.get(key) or "") != want:
                ok = False
                break
        if not ok:
            continue
        for key, want in cont.items():
            if not contains_ci(row.get(key), want):
                ok = False
                break
        if ok:
            out.append(row)
    return out


def apply_list_query(
    rows: Sequence[Mapping[str, Any]],
    *,
    q: str = "",
    q_fields: Sequence[str] = (),
    equals: Mapping[str, str] | None = None,
    contains: Mapping[str, str] | None = None,
    date_field: str = "",
    date_from: str = "",
    date_to: str = "",
    alt_date_fields: Sequence[str] = (),
    sort_by: str = "",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    """Filter → date-range → sort → page into the standard list envelope."""
    filtered: list[Mapping[str, Any]] = list(rows)
    needle = (q or "").strip()
    if needle and q_fields:
        filtered = [
            row
            for row in filtered
            if any(contains_ci(row.get(f), needle) for f in q_fields)
        ]
    if equals or contains:
        filtered = filter_dicts(filtered, equals=equals, contains=contains)
    if date_field or alt_date_fields:
        filtered = filter_by_date_range(
            filtered,
            date_field or (alt_date_fields[0] if alt_date_fields else ""),
            date_from=date_from,
            date_to=date_to,
            alt_fields=alt_date_fields,
        )
    sorted_rows = sort_dicts(filtered, sort_by, sort_desc=sort_desc)
    return paged_result(sorted_rows, page=page, page_size=page_size)
