"""Finance typed API smoke tests (memory backend)."""

from __future__ import annotations

import os

os.environ["FINANCE_BACKEND"] = "memory"
os.environ["PARTIES_BACKEND"] = "memory"
os.environ["INVENTORY_BACKEND"] = "memory"

from fastapi.testclient import TestClient

from packages.services_kit.finance_container import reset_finance_container
from services.combined.main import app


def setup_function() -> None:
    os.environ["FINANCE_BACKEND"] = "memory"
    reset_finance_container()


c = TestClient(app)


def test_finance_health() -> None:
    r = c.get("/api/finance/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["backend"] in {"memory", "mongo"}


def test_account_crud_and_trial_balance() -> None:
    cash = c.post(
        "/api/finance/accounts",
        json={
            "account_name": "Cash Box",
            "account_type": "Asset",
            "opening_balance": 1000,
            "is_store_account": True,
        },
    )
    assert cash.status_code == 201, cash.text
    cash_id = cash.json()["id"]
    assert cash.json()["balance"] == 1000

    expense = c.post(
        "/api/finance/accounts",
        json={"account_name": "Office Expense", "account_type": "Expense"},
    )
    assert expense.status_code == 201, expense.text
    expense_id = expense.json()["id"]

    listed = c.get("/api/finance/accounts")
    assert listed.status_code == 200
    assert any(row["id"] == cash_id for row in listed.json())

    detail = c.get(f"/api/finance/accounts/{cash_id}")
    assert detail.status_code == 200
    assert detail.json()["account_name"] == "Cash Box"

    upd = c.put(
        f"/api/finance/accounts/{expense_id}",
        json={
            "account_name": "Office Expense",
            "account_type": "Expense",
            "is_store_account": False,
            "is_active": True,
        },
    )
    assert upd.status_code == 200, upd.text

    journal = c.post(
        "/api/finance/journal",
        json={
            "description": "Seed journal",
            "lines": [
                {
                    "account_id": expense_id,
                    "debit_amount": 50,
                    "credit_amount": 0,
                },
                {
                    "account_id": cash_id,
                    "debit_amount": 0,
                    "credit_amount": 50,
                },
            ],
        },
    )
    assert journal.status_code == 201, journal.text
    assert journal.json()["voucher_type"] == "Journal"

    tb = c.get("/api/finance/trial-balance")
    assert tb.status_code == 200
    assert "rows" in tb.json()
    assert "totals" in tb.json()

    ov = c.get("/api/finance/overview")
    assert ov.status_code == 200
    assert ov.json()["kpis"]["account_count"] >= 2


def test_receipt_payment_and_reports() -> None:
    cash = c.post(
        "/api/finance/accounts",
        json={
            "account_name": "Petty Cash",
            "account_type": "Asset",
            "opening_balance": 500,
            "is_store_account": True,
        },
    ).json()
    customer = c.post(
        "/api/finance/accounts",
        json={"account_name": "Customer A/R", "account_type": "Asset", "opening_balance": 200},
    ).json()
    vendor = c.post(
        "/api/finance/accounts",
        json={"account_name": "Vendor A/P", "account_type": "Liability", "opening_balance": -100},
    ).json()
    expense = c.post(
        "/api/finance/accounts",
        json={"account_name": "Purchases Exp", "account_type": "Expense"},
    ).json()

    # Link ids for note APIs / realism
    from packages.services_kit.finance_container import get_finance_container

    repo = get_finance_container().account_repo
    cust = repo.find_by_id(customer["id"])
    cust.linked_customer_id = "cust-1"
    repo.save(cust)
    vend = repo.find_by_id(vendor["id"])
    vend.linked_vendor_id = "vend-1"
    repo.save(vend)

    receipt = c.post(
        "/api/finance/receipts",
        json={
            "receiving_account_id": cash["id"],
            "customer_account_id": customer["id"],
            "amount": 75,
            "description": "Test receipt",
            "location_id": "loc-test",
        },
    )
    assert receipt.status_code == 201, receipt.text
    assert receipt.json()["voucher_type"] == "Receipt"

    payment = c.post(
        "/api/finance/payments",
        json={
            "payment_kind": "vendor",
            "paying_account_id": cash["id"],
            "vendor_account_id": vendor["id"],
            "expense_account_id": expense["id"],
            "amount": 40,
            "description": "Test vendor payment",
            "location_id": "loc-test",
        },
    )
    assert payment.status_code == 201, payment.text

    sales = c.post(
        "/api/finance/accounts",
        json={"account_name": "Sales", "account_type": "Revenue"},
    )
    assert sales.status_code == 201, sales.text

    cn = c.post(
        "/api/finance/credit-notes",
        json={
            "party_kind": "customer",
            "party_account_id": customer["id"],
            "amount": 10,
            "description": "CN test",
            "contra_account_id": sales.json()["id"],
        },
    )
    assert cn.status_code == 201, cn.text

    vouchers = c.get("/api/finance/vouchers")
    assert vouchers.status_code == 200
    assert len(vouchers.json()) >= 2

    catalog = c.get("/api/finance/reports")
    assert catalog.status_code == 200
    assert "Trial Balance" in catalog.json()["report_types"]

    run = c.post("/api/finance/reports/run", json={"report_type": "Account Balances"})
    assert run.status_code == 200
    assert run.json()["row_count"] >= 1

    export = c.get("/api/finance/export", params={"entity": "accounts"})
    assert export.status_code == 200
    assert "account_name" in export.text
