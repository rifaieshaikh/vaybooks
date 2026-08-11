"""Mongo-gated finance demo seed coverage."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
from tests.mongo_test_env import require_mongo, reset_all_containers
from vaybooks.bms.domain.shared.enums import AccountType, VoucherType
from vaybooks.bms.infrastructure.db.connection import get_database_from_uri
from vaybooks.bms.infrastructure.db.finance_seed import (
    DEMO_AGENT_NAME,
    DEMO_PREFIX,
    REQUIRED_DEMO_TYPES,
    SALARY_PAYABLE_NAME,
    _present_demo_types,
    _services,
    _void_demo_vouchers,
    seed_finance_demo,
)
from vaybooks.bms.infrastructure.db.location_seed import ensure_default_locations
from vaybooks.bms.infrastructure.db.seed import run_seed


@pytest.fixture(autouse=True)
def _mongo():
    require_mongo()
    reset_all_containers()
    yield


from services.combined.main import app  # noqa: E402

c = TestClient(app)


def _db():
    return get_database_from_uri(mongo_uri(), mongo_db_name())


def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _demo_count(accounting) -> int:
    return len(
        [
            v
            for v in accounting.list_vouchers()
            if (v.description or "").startswith(DEMO_PREFIX)
            or "DEMO-PB-" in (v.description or "")
        ]
    )


def _prepare_party_ledgers(db):
    # Clear leftover demo vouchers from prior runs on shared test DB
    accounting, _agents = _services(db)
    if _demo_count(accounting):
        _void_demo_vouchers(accounting)
    run_seed(db)
    ensure_default_locations(db)
    accounting, _agents = _services(db)
    cust = accounting.create_account(
        _uniq("Demo Customer"),
        AccountType.ASSET.value,
        opening_balance=0,
    )
    cust.linked_customer_id = f"cust-{uuid.uuid4().hex[:8]}"
    accounting._account_repo.save(cust)  # noqa: SLF001
    vend = accounting.create_account(
        _uniq("Demo Vendor"),
        AccountType.LIABILITY.value,
        opening_balance=0,
    )
    vend.linked_vendor_id = f"vend-{uuid.uuid4().hex[:8]}"
    accounting._account_repo.save(vend)  # noqa: SLF001
    return accounting


def test_create_payment_and_purchase_expense_builders() -> None:
    db = _db()
    accounting = _prepare_party_ledgers(db)
    cash = accounting.get_account_by_name("Cash Drawer")
    expense = accounting.get_account_by_name("Material Purchase Expense")
    vendors = [
        a for a in accounting.list_accounts() if getattr(a, "linked_vendor_id", None)
    ]
    assert cash and expense and vendors

    main_id, _ = ensure_default_locations(db)
    pe = accounting.create_purchase_expense(
        vendor_account_id=vendors[0].id,
        expense_account_id=expense.id,
        amount=100.0,
        description="PE unit",
        location_id=main_id,
        location_name="Main Warehouse",
    )
    assert pe.voucher_type == VoucherType.PURCHASE_EXPENSE

    pay = accounting.create_payment(
        expense_account_id=expense.id,
        paying_account_id=cash.id,
        amount=40.0,
        description="Payment unit",
        location_id=main_id,
        location_name="Main Warehouse",
    )
    assert pay.voucher_type == VoucherType.PAYMENT


def test_expense_payment_api_returns_payment_type() -> None:
    db = _db()
    accounting = _prepare_party_ledgers(db)
    cash = accounting.get_account_by_name("Cash Drawer")
    expense = accounting.get_account_by_name("Material Purchase Expense")
    assert cash and expense

    r = c.post(
        "/api/finance/payments",
        json={
            "payment_kind": "expense",
            "paying_account_id": cash.id,
            "expense_account_id": expense.id,
            "amount": 25,
            "description": "API expense payment",
            "location_id": "loc-test",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["voucher_type"] == "Payment"


def test_seed_finance_demo_full_recipe_and_idempotent() -> None:
    db = _db()
    _prepare_party_ledgers(db)
    seed_finance_demo(db)

    accounting, agents = _services(db)
    present = _present_demo_types(accounting)
    missing = REQUIRED_DEMO_TYPES - present
    assert not missing, f"missing types: {sorted(missing)}"

    customers = [
        a for a in accounting.list_accounts() if getattr(a, "linked_customer_id", None)
    ]
    vendors = [
        a for a in accounting.list_accounts() if getattr(a, "linked_vendor_id", None)
    ]
    assert any(abs(float(a.current_balance or 0)) > 0.01 for a in customers)
    assert any(abs(float(a.current_balance or 0)) > 0.01 for a in vendors)

    assert accounting.get_account_by_name(SALARY_PAYABLE_NAME) is not None
    assert DEMO_AGENT_NAME in {a.agent_name for a in agents.list_all_agents()}

    count_before = _demo_count(accounting)
    agent_count = len(agents.list_all_agents())
    seed_finance_demo(db)
    accounting2, agents2 = _services(db)
    assert _demo_count(accounting2) == count_before
    assert len(agents2.list_all_agents()) == agent_count


def test_seed_finance_demo_self_heals_partial() -> None:
    db = _db()
    _prepare_party_ledgers(db)
    seed_finance_demo(db)
    accounting, _ = _services(db)

    journals = [
        v
        for v in accounting.list_vouchers()
        if (v.description or "").startswith(DEMO_PREFIX)
        and v.voucher_type == VoucherType.JOURNAL
    ]
    assert journals
    accounting.void_voucher(journals[0].id)
    assert not REQUIRED_DEMO_TYPES.issubset(_present_demo_types(accounting))

    seed_finance_demo(db)
    accounting, _ = _services(db)
    missing = REQUIRED_DEMO_TYPES - _present_demo_types(accounting)
    assert not missing, f"missing after self-heal: {sorted(missing)}"
