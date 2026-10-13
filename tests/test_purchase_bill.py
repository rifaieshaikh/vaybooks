"""Tests for purchase bill accounting and parsing."""

from datetime import date, datetime

import pytest

from vaybooks.bms.application.finance.accounting.service import AccountingAppService
from vaybooks.bms.domain.finance.accounting.entities import Account
from vaybooks.bms.domain.finance.accounting.purchase_parsing import (
    build_purchase_description,
    parse_purchase_lines_from_description,
    purchase_row_from_voucher,
)
from vaybooks.bms.domain.shared.enums import AccountType, VoucherType
from tests.conftest import FakeAccountRepository, FakeCounterRepository, FakeVoucherRepository


def _accounting() -> AccountingAppService:
    accounts = FakeAccountRepository()
    vendor = Account(
        account_name="Vendor A",
        account_type=AccountType.LIABILITY,
        linked_vendor_id="v1",
    )
    expense = Account(
        account_name="Material Purchase Expense",
        account_type=AccountType.EXPENSE,
    )
    cash = Account(
        account_name="Cash",
        account_type=AccountType.ASSET,
        is_store_account=True,
    )
    accounts.save(vendor)
    accounts.save(expense)
    accounts.save(cash)
    return AccountingAppService(accounts, FakeVoucherRepository(), FakeCounterRepository())


def test_create_purchase_bill_with_gst():
    accounting = _accounting()
    vendor = accounting.get_vendor_account("v1")
    expense = accounting.list_accounts()[1]
    cash = accounting.get_store_accounts()[0]
    for name in ("CGST Input", "SGST Input", "IGST Input", "UTGST Input"):
        accounting.create_account(name, "Asset")

    voucher = accounting.create_purchase_bill(
        vendor_account_id=vendor.id,
        expense_lines=[
            {
                "expense_account_id": expense.id,
                "taxable_amount": 1000.0,
                "cgst_amount": 90.0,
                "sgst_amount": 90.0,
                "igst_amount": 0.0,
                "utgst_amount": 0.0,
                "amount": 1180.0,
                "line_total": 1180.0,
                "item_type": "Product",
                "item_id": "p1",
                "qty": 10,
                "rate": 100,
            }
        ],
        vendor_bill_number="BILL-GST",
        amount_paid=0.0,
        voucher_date=date.today(),
    )
    row = purchase_row_from_voucher(voucher)
    assert row["total"] == 1180.0
    expense_debits = sum(
        l.debit_amount for l in voucher.lines if l.description == "Purchase expense"
    )
    assert expense_debits == 1000.0
    cgst_debits = sum(
        l.debit_amount for l in voucher.lines if l.description == "CGST input"
    )
    assert cgst_debits == 90.0


def test_create_purchase_bill_multi_expense_and_payment():
    accounting = _accounting()
    vendor = accounting.get_vendor_account("v1")
    expense = accounting.list_accounts()[1]
    cash = accounting.get_store_accounts()[0]

    voucher = accounting.create_purchase_bill(
        vendor_account_id=vendor.id,
        expense_lines=[
            {
                "expense_account_id": expense.id,
                "amount": 100.0,
                "product_id": "p1",
                "qty": 2,
                "rate": 50,
            }
        ],
        vendor_bill_number="BILL-001",
        amount_paid=100.0,
        paying_account_id=cash.id,
        voucher_date=date.today(),
    )

    assert voucher.voucher_type == VoucherType.PURCHASE_BILL
    assert voucher.is_balanced
    row = purchase_row_from_voucher(voucher)
    assert row["total"] == 100.0
    assert row["paid"] == 100.0
    assert row["outstanding"] == 0.0
    lines = parse_purchase_lines_from_description(voucher.description)
    assert len(lines) == 1
    assert lines[0]["product_id"] == "p1"


def test_purchase_bill_credit_only():
    accounting = _accounting()
    vendor = accounting.get_vendor_account("v1")
    expense = accounting.list_accounts()[1]

    voucher = accounting.create_purchase_bill(
        vendor_account_id=vendor.id,
        expense_lines=[{"expense_account_id": expense.id, "amount": 250.0}],
        vendor_bill_number="BILL-CR",
        amount_paid=0.0,
    )
    row = purchase_row_from_voucher(voucher)
    assert row["total"] == 250.0
    assert row["paid"] == 0.0
    assert row["outstanding"] == 250.0


def test_build_purchase_description_roundtrip():
    lines = [{"product_id": "p1", "qty": 1, "rate": 10, "amount": 10}]
    desc = build_purchase_description("INV-9", lines)
    parsed = parse_purchase_lines_from_description(desc)
    assert parsed[0]["product_id"] == "p1"


def _expense_line_full(**overrides):
    base = {
        "expense_account_id": "",
        "taxable_amount": 1000.0,
        "cgst_amount": 90.0,
        "sgst_amount": 90.0,
        "igst_amount": 0.0,
        "utgst_amount": 0.0,
        "amount": 1180.0,
        "line_total": 1180.0,
        "item_type": "Product",
        "item_id": "p1",
        "item_name": "Cotton",
        "hsn_sac": "5208",
        "product_id": "p1",
        "qty": 10,
        "rate": 100,
        "landed_cost_alloc": 5.0,
    }
    base.update(overrides)
    return base


def test_update_purchase_bill_preserves_gst_fields_and_input_accounts():
    accounting = _accounting()
    vendor = accounting.get_vendor_account("v1")
    expense = accounting.list_accounts()[1]
    for name in ("CGST Input", "SGST Input", "IGST Input", "UTGST Input"):
        accounting.create_account(name, "Asset")

    created = accounting.create_purchase_bill(
        vendor_account_id=vendor.id,
        expense_lines=[_expense_line_full(expense_account_id=expense.id)],
        vendor_bill_number="BILL-UPD",
        amount_paid=0.0,
        voucher_date=date.today(),
    )
    updated = accounting.update_purchase_bill(
        created.id,
        vendor_account_id=vendor.id,
        expense_lines=[
            _expense_line_full(
                expense_account_id=expense.id,
                taxable_amount=2000.0,
                cgst_amount=180.0,
                sgst_amount=180.0,
                amount=2360.0,
                line_total=2360.0,
                qty=20,
                rate=100,
                landed_cost_alloc=5.0,
                item_name="Cotton Updated",
                hsn_sac="5208",
            )
        ],
        vendor_bill_number="BILL-UPD-2",
        amount_paid=0.0,
        voucher_date=date.today(),
    )

    lines = parse_purchase_lines_from_description(updated.description)
    assert len(lines) == 1
    assert lines[0]["item_type"] == "Product"
    assert lines[0]["item_id"] == "p1"
    assert lines[0]["item_name"] == "Cotton Updated"
    assert lines[0]["hsn_sac"] == "5208"
    assert lines[0]["taxable_amount"] == 2000.0
    assert lines[0]["cgst_amount"] == 180.0
    assert lines[0]["sgst_amount"] == 180.0
    assert lines[0]["line_total"] == 2360.0
    assert float(lines[0].get("landed_cost_alloc") or 0) == 5.0

    row = purchase_row_from_voucher(updated)
    assert row["total"] == 2360.0
    expense_debits = sum(
        l.debit_amount for l in updated.lines if l.description == "Purchase expense"
    )
    assert expense_debits == 2000.0
    cgst_debits = sum(
        l.debit_amount for l in updated.lines if l.description == "CGST input"
    )
    assert cgst_debits == 180.0
    sgst_debits = sum(
        l.debit_amount for l in updated.lines if l.description == "SGST input"
    )
    assert sgst_debits == 180.0
