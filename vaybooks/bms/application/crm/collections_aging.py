"""Collections aging helpers for CRM ledger collections (Phase 7)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Iterable, Optional


def as_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    if "T" in text:
        text = text.split("T", 1)[0]
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def days_past_due(due: Any, *, today: Optional[date] = None) -> Optional[int]:
    due_date = as_date(due)
    if due_date is None:
        return None
    ref = today or date.today()
    return (ref - due_date).days


def invoice_reference(row: dict[str, Any]) -> str:
    return str(
        row.get("store_invoice_number")
        or row.get("voucher_number")
        or row.get("id")
        or ""
    ).strip()


def build_open_invoice_rows(
    *,
    customer_id: str,
    customer_name: str,
    invoices: Iterable[dict[str, Any]],
    phone: str = "",
    assigned_user_id: str = "",
    assigned_user_name: str = "",
    today: Optional[date] = None,
) -> list[dict[str, Any]]:
    """Normalize open sales invoice rows for collections aging."""
    out: list[dict[str, Any]] = []
    for inv in invoices or []:
        if not isinstance(inv, dict):
            continue
        outstanding = float(inv.get("outstanding") or 0)
        if outstanding <= 0:
            continue
        due = inv.get("due_date") or inv.get("sale_date")
        dpd = days_past_due(due, today=today)
        out.append(
            {
                "customer_id": customer_id,
                "customer_name": customer_name,
                "invoice_id": str(inv.get("id") or ""),
                "reference": invoice_reference(inv),
                "sale_date": as_date(inv.get("sale_date")),
                "due_date": as_date(inv.get("due_date")) or as_date(inv.get("sale_date")),
                "outstanding": outstanding,
                "days_past_due": dpd,
                "phone": phone or "",
                "assigned_user_id": assigned_user_id or "",
                "assigned_user_name": assigned_user_name or "",
            }
        )
    out.sort(
        key=lambda row: (
            -(row["days_past_due"] if row["days_past_due"] is not None else -10**9),
            -(float(row.get("outstanding") or 0)),
        )
    )
    return out


def enrich_balance_row(
    balance: dict[str, Any],
    invoice_rows: list[dict[str, Any]],
    *,
    phone: str = "",
    assigned_user_id: str = "",
    assigned_user_name: str = "",
) -> dict[str, Any]:
    enriched = dict(balance)
    if phone and not enriched.get("phone"):
        enriched["phone"] = phone
    if assigned_user_id and not enriched.get("assigned_user_id"):
        enriched["assigned_user_id"] = assigned_user_id
        enriched["assigned_user_name"] = assigned_user_name
    if not invoice_rows:
        return enriched
    enriched["open_invoice_count"] = len(invoice_rows)
    # Oldest due = most past due (highest days_past_due).
    top = invoice_rows[0]
    enriched["oldest_due_date"] = top.get("due_date")
    enriched["days_past_due"] = top.get("days_past_due")
    return enriched


def activity_sort_key(activity: Any) -> datetime:
    for attr in ("activity_at", "scheduled_at", "due_at", "completed_at", "created_at"):
        value = getattr(activity, attr, None)
        if value is not None:
            return value
    return datetime.min


def build_customer_timeline(
    activities: Iterable[Any],
    *,
    limit: int = 15,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Build compact Customer 360 timeline fields from activity entities."""
    rows = list(activities or [])
    sorted_rows = sorted(rows, key=activity_sort_key, reverse=True)
    recent = sorted_rows[: max(0, int(limit))]
    ref = now or datetime.utcnow()
    open_statuses = {"scheduled", "in progress"}

    contact_stamps: list[datetime] = []
    for act in rows:
        status = (getattr(act, "status", None) or "").strip().lower()
        if status in {"cancelled", "canceled"}:
            continue
        completed = getattr(act, "completed_at", None)
        if completed is not None:
            contact_stamps.append(completed)
            continue
        if status in open_statuses:
            # Open follow-ups are not "last contact"; use completed/non-open only.
            continue
        stamp = getattr(act, "activity_at", None) or getattr(act, "created_at", None)
        if stamp is not None:
            contact_stamps.append(stamp)
    last_contact_at = max(contact_stamps) if contact_stamps else None

    next_follow_up_at = None
    for act in sorted_rows:
        status = (getattr(act, "status", None) or "").strip().lower()
        if status and status not in open_statuses:
            continue
        candidates = [
            getattr(act, "next_follow_up_at", None),
            getattr(act, "due_at", None),
            getattr(act, "scheduled_at", None),
        ]
        for stamp in candidates:
            if stamp is None:
                continue
            if stamp >= ref and (next_follow_up_at is None or stamp < next_follow_up_at):
                next_follow_up_at = stamp
    if next_follow_up_at is None:
        # Fall back to soonest open scheduled/due even if in the past (overdue).
        for act in sorted_rows:
            status = (getattr(act, "status", None) or "").strip().lower()
            if status and status not in open_statuses:
                continue
            for attr in ("next_follow_up_at", "due_at", "scheduled_at"):
                stamp = getattr(act, attr, None)
                if stamp is not None and (
                    next_follow_up_at is None or stamp < next_follow_up_at
                ):
                    next_follow_up_at = stamp

    return {
        "recent_activities": recent,
        "timeline": recent,
        "last_contact_at": last_contact_at,
        "next_follow_up_at": next_follow_up_at,
    }
