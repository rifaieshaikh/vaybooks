"""Helpers for hierarchical product categories."""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

from vaybooks.bms.domain.inventory.entities import ProductCategory
from vaybooks.bms.domain.shared.exceptions import ValidationError


def normalize_parent_id(parent_id: Optional[str]) -> Optional[str]:
    if not parent_id or not str(parent_id).strip():
        return None
    return str(parent_id).strip()


def build_category_path(
    category_id: str,
    categories_by_id: Dict[str, ProductCategory],
    *,
    separator: str = " > ",
) -> str:
    parts: List[str] = []
    current_id: Optional[str] = category_id
    seen: set[str] = set()
    while current_id and current_id not in seen:
        seen.add(current_id)
        category = categories_by_id.get(current_id)
        if not category:
            break
        parts.append(category.name)
        current_id = category.parent_id
    parts.reverse()
    return separator.join(parts)


def build_category_paths(
    category_ids: List[str],
    categories_by_id: Dict[str, ProductCategory],
) -> List[str]:
    return [
        build_category_path(cid, categories_by_id)
        for cid in category_ids
        if cid in categories_by_id
    ]


def validate_category_parent(
    category_id: Optional[str],
    parent_id: Optional[str],
    categories_by_id: Dict[str, ProductCategory],
) -> None:
    parent_id = normalize_parent_id(parent_id)
    if not parent_id:
        return
    if category_id and parent_id == category_id:
        raise ValidationError("A category cannot be its own parent")
    if parent_id not in categories_by_id:
        raise ValidationError("Parent category not found")
    if not category_id:
        return
    current: Optional[str] = parent_id
    seen: set[str] = set()
    while current:
        if current == category_id:
            raise ValidationError("Category parent would create a cycle")
        if current in seen:
            break
        seen.add(current)
        parent = categories_by_id.get(current)
        current = parent.parent_id if parent else None


def assigned_category_ids(
    category_ids: Optional[Sequence[str]] = None,
    category_id: Optional[str] = None,
) -> set[str]:
    ids = {str(cid).strip() for cid in (category_ids or []) if str(cid).strip()}
    legacy = str(category_id or "").strip()
    if legacy:
        ids.add(legacy)
    return ids


def _ancestor_chain(
    category_id: str,
    parent_of: Dict[str, Optional[str]],
    valid: set[str],
) -> List[str]:
    chain: List[str] = []
    current: Optional[str] = category_id
    seen: set[str] = set()
    while current and current not in seen and current in valid:
        seen.add(current)
        chain.append(current)
        current = parent_of.get(current)
    return chain


def rollup_category_counts(
    categories: Sequence[ProductCategory],
    catalog_category_ids: Sequence[set[str]],
    sku_rows: Sequence[Tuple[set[str], float]],
) -> Dict[str, Dict[str, float]]:
    """Count products, SKUs, and stock for each category, including descendants.

    A row assigned to a child counts once on that child and on every ancestor.
    """
    valid = {category.id for category in categories}
    parent_of = {category.id: category.parent_id for category in categories}
    product_ids: Dict[str, set[int]] = {category_id: set() for category_id in valid}
    sku_ids: Dict[str, set[int]] = {category_id: set() for category_id in valid}
    stock: Dict[str, float] = {category_id: 0.0 for category_id in valid}

    for index, assigned in enumerate(catalog_category_ids):
        touched: set[str] = set()
        for category_id in assigned:
            touched.update(_ancestor_chain(category_id, parent_of, valid))
        for category_id in touched:
            product_ids[category_id].add(index)

    for index, (assigned, qty) in enumerate(sku_rows):
        touched = set()
        for category_id in assigned:
            touched.update(_ancestor_chain(category_id, parent_of, valid))
        for category_id in touched:
            sku_ids[category_id].add(index)
            stock[category_id] += float(qty or 0)

    return {
        category_id: {
            "product_count": float(len(product_ids[category_id])),
            "sku_count": float(len(sku_ids[category_id])),
            "stock_qty": round(stock[category_id], 2),
        }
        for category_id in valid
    }


def list_descendant_ids(
    category_id: str,
    categories_by_id: Dict[str, ProductCategory],
) -> set[str]:
    children = {
        cid
        for cid, cat in categories_by_id.items()
        if cat.parent_id == category_id
    }
    descendants = set(children)
    for child_id in list(children):
        descendants |= list_descendant_ids(child_id, categories_by_id)
    return descendants
