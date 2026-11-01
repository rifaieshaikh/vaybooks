"""Unit tests for CRM collections aging helpers (Phase 7)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from types import SimpleNamespace

from vaybooks.bms.application.crm.collections_aging import (
    build_customer_timeline,
    build_open_invoice_rows,
    days_past_due,
    enrich_balance_row,
)


def test_days_past_due_buckets() -> None:
    today = date(2026, 8, 10)
    assert days_past_due(date(2026, 8, 10), today=today) == 0
    assert days_past_due(date(2026, 8, 20), today=today) == -10
    assert days_past_due(date(2026, 7, 11), today=today) == 30
    assert days_past_due(date(2026, 5, 10), today=today) == 92
    assert days_past_due(None, today=today) is None


def test_build_open_invoice_rows_shape() -> None:
    today = date(2026, 8, 10)
    rows = build_open_invoice_rows(
        customer_id="c1",
        customer_name="Acme",
        phone="9999999999",
        invoices=[
            {
                "id": "inv-old",
                "store_invoice_number": "SI-1",
                "sale_date": date(2026, 5, 1),
                "due_date": date(2026, 5, 1),
                "outstanding": 100,
            },
            {
                "id": "inv-current",
                "voucher_number": "V-2",
                "sale_date": date(2026, 8, 1),
                "due_date": date(2026, 8, 20),
                "outstanding": 50,
            },
            {
                "id": "inv-zero",
                "due_date": date(2026, 1, 1),
                "outstanding": 0,
            },
        ],
        today=today,
    )
    assert len(rows) == 2
    assert rows[0]["invoice_id"] == "inv-old"
    assert rows[0]["days_past_due"] == 101
    assert rows[0]["reference"] == "SI-1"
    assert rows[0]["phone"] == "9999999999"
    assert rows[1]["invoice_id"] == "inv-current"
    assert rows[1]["days_past_due"] == -10

    balance = enrich_balance_row(
        {"customer_id": "c1", "customer_name": "Acme", "outstanding_balance": 150},
        rows,
        phone="9999999999",
    )
    assert balance["open_invoice_count"] == 2
    assert balance["days_past_due"] == 101
    assert balance["oldest_due_date"] == date(2026, 5, 1)
    assert balance["phone"] == "9999999999"


def test_build_customer_timeline_fields() -> None:
    now = datetime(2026, 8, 10, 12, 0, 0)
    older = SimpleNamespace(
        id="a1",
        status="Completed",
        activity_type="Call",
        activity_at=now - timedelta(days=5),
        completed_at=now - timedelta(days=5),
        scheduled_at=None,
        due_at=None,
        next_follow_up_at=None,
        created_at=now - timedelta(days=6),
    )
    upcoming = SimpleNamespace(
        id="a2",
        status="Scheduled",
        activity_type="Payment Reminder",
        activity_at=now - timedelta(days=1),
        completed_at=None,
        scheduled_at=now + timedelta(days=2),
        due_at=now + timedelta(days=2),
        next_follow_up_at=now + timedelta(days=2),
        created_at=now - timedelta(days=1),
    )
    payload = build_customer_timeline([older, upcoming], limit=10, now=now)
    assert [a.id for a in payload["recent_activities"]] == ["a2", "a1"]
    assert payload["timeline"] is payload["recent_activities"] or len(
        payload["timeline"]
    ) == 2
    assert payload["last_contact_at"] == older.completed_at
    assert payload["next_follow_up_at"] == upcoming.next_follow_up_at
