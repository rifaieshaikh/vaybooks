"""Idempotent demo finance vouchers for Finance UI surfaces."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING, Optional

from vaybooks.bms.application.finance.accounting.service import AccountingAppService
from vaybooks.bms.application.parties.commission_agents.service import (
    CommissionAgentAppService,
)
from vaybooks.bms.domain.parties.commission_agents.entities import CommissionAgentInput
from vaybooks.bms.domain.shared.enums import AccountType, VoucherType
from vaybooks.bms.infrastructure.db.location_seed import ensure_default_locations
from vaybooks.bms.infrastructure.repositories.finance.mongo_accounting_repository import (
    MongoAccountRepository,
    MongoVoucherRepository,
)
from vaybooks.bms.infrastructure.repositories.finance.mongo_counter_repository import (
    MongoCounterRepository,
)
from vaybooks.bms.infrastructure.repositories.parties.mongo_commission_agent_repository import (
    MongoCommissionAgentRepository,
)

if TYPE_CHECKING:
    from pymongo.database import Database

    from vaybooks.bms.infrastructure.config.settings import AppSettings

logger = logging.getLogger("vaybooks.bms.finance_seed")

DEMO_PREFIX = "[demo-finance]"
SALARY_PAYABLE_NAME = "[demo-finance] Salary Payable"
DEMO_AGENT_NAME = "[demo-finance] Agent"
DEMO_AGENT_PHONE = "9000000099"

REQUIRED_DEMO_TYPES: frozenset[str] = frozenset(
    {
        VoucherType.SALES_INVOICE.value,
        VoucherType.CUSTOMIZATION_INVOICE.value,
        VoucherType.PURCHASE_BILL.value,
        VoucherType.PURCHASE_EXPENSE.value,
        VoucherType.RECEIPT.value,
        VoucherType.PAYMENT.value,
        VoucherType.VENDOR_PAYMENT.value,
        VoucherType.SALARY_PAYMENT.value,
        VoucherType.COMMISSION_PAYMENT.value,
        VoucherType.JOURNAL.value,
        VoucherType.CREDIT_NOTE.value,
        VoucherType.DEBIT_NOTE.value,
    }
)

# Dependents before sources they may allocate against / settle.
_VOID_TYPE_PRIORITY: dict[str, int] = {
    VoucherType.RECEIPT.value: 0,
    VoucherType.CREDIT_NOTE.value: 1,
    VoucherType.DEBIT_NOTE.value: 2,
    VoucherType.PAYMENT.value: 3,
    VoucherType.VENDOR_PAYMENT.value: 4,
    VoucherType.SALARY_PAYMENT.value: 5,
    VoucherType.COMMISSION_PAYMENT.value: 6,
    VoucherType.JOURNAL.value: 7,
    VoucherType.SALES_INVOICE.value: 10,
    VoucherType.CUSTOMIZATION_INVOICE.value: 11,
    VoucherType.PURCHASE_BILL.value: 12,
    VoucherType.PURCHASE_EXPENSE.value: 13,
}


def _voucher_type_value(voucher) -> str:
    vt = getattr(voucher, "voucher_type", None)
    if hasattr(vt, "value"):
        return str(vt.value)
    return str(vt or "")


def _demo_vouchers(accounting: AccountingAppService) -> list:
    out = []
    for v in accounting.list_vouchers():
        desc = v.description or ""
        if desc.startswith(DEMO_PREFIX) or "DEMO-PB-OPEN" in desc or "DEMO-PB-PART" in desc:
            out.append(v)
    return out


def _present_demo_types(accounting: AccountingAppService) -> set[str]:
    return {_voucher_type_value(v) for v in _demo_vouchers(accounting)}


def _full_recipe_present(accounting: AccountingAppService) -> bool:
    return REQUIRED_DEMO_TYPES.issubset(_present_demo_types(accounting))


def _void_demo_vouchers(accounting: AccountingAppService) -> None:
    """Clear all [demo-finance] vouchers with type-priority order and retry.

    Uses domain reverse_and_delete so month-locked sales invoices can still be
    cleared during demo self-heal (normal UI void still enforces the lock).
    """
    for _ in range(8):
        remaining = _demo_vouchers(accounting)
        if not remaining:
            return
        remaining.sort(
            key=lambda v: (
                _VOID_TYPE_PRIORITY.get(_voucher_type_value(v), 50),
                v.voucher_number or "",
            )
        )
        progressed = False
        for voucher in remaining:
            try:
                accounting._domain.reverse_and_delete_voucher(voucher.id)  # noqa: SLF001
                progressed = True
            except Exception:
                logger.exception(
                    "Failed to void demo finance voucher %s (%s)",
                    getattr(voucher, "id", ""),
                    _voucher_type_value(voucher),
                )
        if not progressed:
            left = [
                f"{_voucher_type_value(v)}:{v.id}" for v in _demo_vouchers(accounting)
            ]
            raise RuntimeError(
                "Could not void partial [demo-finance] vouchers; "
                f"remaining={left}. Use PURGE_BUSINESS_DATA and reseed."
            )
    left = [f"{_voucher_type_value(v)}:{v.id}" for v in _demo_vouchers(accounting)]
    if left:
        raise RuntimeError(
            "Could not clear [demo-finance] vouchers after retries; "
            f"remaining={left}. Use PURGE_BUSINESS_DATA and reseed."
        )


def _desc(text: str) -> str:
    return f"{DEMO_PREFIX} {text}"


def _days_ago(n: int) -> date:
    """Offset within the current calendar month so sales invoices stay voidable."""
    today = date.today()
    max_back = max(today.day - 1, 0)
    return today - timedelta(days=min(n, max_back))


def _require_account(accounting: AccountingAppService, name: str):
    account = accounting.get_account_by_name(name)
    if not account:
        raise ValueError(f'Required account "{name}" not found (run SEED_CONFIG first)')
    return account


def _party_accounts(accounting: AccountingAppService) -> tuple[list, list]:
    customers = [
        a for a in accounting.list_accounts() if getattr(a, "linked_customer_id", None)
    ]
    vendors = [
        a for a in accounting.list_accounts() if getattr(a, "linked_vendor_id", None)
    ]
    return customers, vendors


def _ensure_salary_payable(accounting: AccountingAppService):
    existing = accounting.get_account_by_name(SALARY_PAYABLE_NAME)
    if existing:
        if not existing.is_salary_account:
            accounting.update_account(
                existing.id,
                account_name=existing.account_name,
                account_type=existing.account_type.value
                if hasattr(existing.account_type, "value")
                else str(existing.account_type),
                is_store_account=bool(existing.is_store_account),
                is_salary_account=True,
            )
            existing = accounting.get_account(existing.id) or existing
        return existing
    return accounting.create_account(
        SALARY_PAYABLE_NAME,
        AccountType.LIABILITY.value,
        opening_balance=0,
        is_salary_account=True,
    )


def _ensure_commission_agent(
    agents: CommissionAgentAppService, accounting: AccountingAppService
):
    existing = agents.list_all_agents()
    for agent in existing:
        if (agent.agent_name or "").strip() == DEMO_AGENT_NAME or (
            agent.phone_number or ""
        ).strip() == DEMO_AGENT_PHONE:
            account = accounting._account_repo.find_agent_account(agent.id)  # noqa: SLF001
            if account:
                return agent, account
    by_phone = None
    try:
        by_phone = agents._agent_repo.find_by_phone(DEMO_AGENT_PHONE)  # noqa: SLF001
    except Exception:
        by_phone = None
    if by_phone:
        account = accounting._account_repo.find_agent_account(by_phone.id)  # noqa: SLF001
        if account:
            return by_phone, account
    agent = agents.create_agent(
        CommissionAgentInput(
            agent_name=DEMO_AGENT_NAME,
            phone_number=DEMO_AGENT_PHONE,
        )
    )
    account = accounting._account_repo.find_agent_account(agent.id)  # noqa: SLF001
    if not account:
        raise ValueError("Commission agent account was not created")
    return agent, account


def _services(db: Database):
    account_repo = MongoAccountRepository(db)
    voucher_repo = MongoVoucherRepository(db)
    counter_repo = MongoCounterRepository(db)
    accounting = AccountingAppService(account_repo, voucher_repo, counter_repo)
    agents = CommissionAgentAppService(
        MongoCommissionAgentRepository(db),
        account_repo,
    )
    return accounting, agents


def _tag_purchase_bills(accounting: AccountingAppService, bill_token: str, label: str) -> None:
    for bill in accounting.list_vouchers_by_type(VoucherType.PURCHASE_BILL):
        if bill_token not in (bill.description or ""):
            continue
        if (bill.description or "").startswith(DEMO_PREFIX):
            continue
        bill.description = _desc(bill.description or label)
        accounting._voucher_repo.save(bill)  # noqa: SLF001


def _post_recipe(
    accounting: AccountingAppService,
    agents: CommissionAgentAppService,
    *,
    location_id: str,
    location_name: str,
) -> None:
    cash = _require_account(accounting, "Cash Drawer")
    bank = _require_account(accounting, "Bank")
    sales = _require_account(accounting, "Sales")
    customization = accounting.get_customization_account() or _require_account(
        accounting, "Customization"
    )
    material = accounting.get_account_by_name("Material Purchase Expense")
    if not material:
        expenses = accounting.get_expense_accounts()
        if not expenses:
            raise ValueError("No expense account found for finance demo seed")
        material = expenses[0]
    if not accounting.get_salary_expense_account():
        if not accounting.get_account_by_name("Salary Expense"):
            raise ValueError('Required account "Salary Expense" not found')

    customers, vendors = _party_accounts(accounting)
    if not customers or not vendors:
        logger.info("Finance demo seed skipped (no customer/vendor ledger accounts)")
        return

    c0, c1 = customers[0], customers[min(1, len(customers) - 1)]
    v0, v1 = vendors[0], vendors[min(1, len(vendors) - 1)]
    salary_payable = _ensure_salary_payable(accounting)
    _agent, agent_account = _ensure_commission_agent(agents, accounting)

    # 1) Invoices — leave c0 sales + v0 bill fully unpaid for Overview queues
    accounting.create_sales_invoice(
        customer_account_id=c0.id,
        income_account_id=sales.id,
        amount=5000.0,
        description=_desc("Open sales invoice"),
        voucher_date=_days_ago(28),
        location_id=location_id,
        location_name=location_name,
    )
    part_sales = accounting.create_sales_invoice(
        customer_account_id=c1.id,
        income_account_id=sales.id,
        amount=3200.0,
        description=_desc("Partial sales invoice"),
        voucher_date=_days_ago(21),
        location_id=location_id,
        location_name=location_name,
    )
    accounting.create_sales_invoice(
        customer_account_id=c0.id,
        income_account_id=customization.id,
        amount=1800.0,
        description=_desc("Customization invoice"),
        voucher_date=_days_ago(18),
        voucher_type=VoucherType.CUSTOMIZATION_INVOICE,
        location_id=location_id,
        location_name=location_name,
    )
    accounting.create_purchase_bill(
        vendor_account_id=v0.id,
        expense_lines=[{"expense_account_id": material.id, "amount": 4500.0}],
        vendor_bill_number="DEMO-PB-OPEN",
        amount_paid=0.0,
        voucher_date=_days_ago(25),
        location_id=location_id,
        location_name=location_name,
    )
    _tag_purchase_bills(accounting, "DEMO-PB-OPEN", "Open purchase bill")

    accounting.create_purchase_bill(
        vendor_account_id=v1.id,
        expense_lines=[{"expense_account_id": material.id, "amount": 2400.0}],
        vendor_bill_number="DEMO-PB-PART",
        amount_paid=900.0,
        paying_account_id=cash.id,
        voucher_date=_days_ago(14),
        location_id=location_id,
        location_name=location_name,
    )
    _tag_purchase_bills(accounting, "DEMO-PB-PART", "Partial purchase bill")

    accounting.create_purchase_expense(
        vendor_account_id=v1.id,
        expense_account_id=material.id,
        amount=750.0,
        description=_desc("Purchase expense"),
        voucher_date=_days_ago(12),
        location_id=location_id,
        location_name=location_name,
    )

    # 2) Partial receipts
    accounting.create_receipt(
        receiving_account_id=cash.id,
        customer_account_id=c1.id,
        amount=1200.0,
        description=_desc("Partial receipt"),
        voucher_date=_days_ago(10),
        allocation_invoice_id=part_sales.id,
        auto_allocate=True,
        location_id=location_id,
        location_name=location_name,
    )
    accounting.create_receipt(
        receiving_account_id=bank.id,
        customer_account_id=c1.id,
        amount=800.0,
        description=_desc("Bank receipt"),
        voucher_date=_days_ago(7),
        auto_allocate=True,
        location_id=location_id,
        location_name=location_name,
    )

    # 4) Payments chips
    accounting.create_vendor_payment(
        vendor_account_id=v1.id,
        expense_account_id=material.id,
        paying_account_id=cash.id,
        amount=600.0,
        description=_desc("Vendor payment"),
        voucher_date=_days_ago(9),
        location_id=location_id,
        location_name=location_name,
    )
    accounting.create_salary_payment(
        salary_account_id=salary_payable.id,
        paying_account_id=bank.id,
        amount=15000.0,
        description=_desc("Salary payment"),
        voucher_date=_days_ago(6),
    )
    accounting.create_commission_payment(
        agent_account_id=agent_account.id,
        paying_account_id=cash.id,
        amount=500.0,
        description=_desc("Commission payment"),
        voucher_date=_days_ago(5),
    )
    accounting.create_payment(
        expense_account_id=material.id,
        paying_account_id=cash.id,
        amount=350.0,
        description=_desc("Expense payment"),
        voucher_date=_days_ago(4),
        location_id=location_id,
        location_name=location_name,
    )

    # 5) Journal Cash ↔ Bank
    accounting.create_journal_entry(
        description=_desc("Cash to bank transfer"),
        lines=[
            {
                "account_id": bank.id,
                "account_name": bank.account_name,
                "debit_amount": 2000.0,
                "credit_amount": 0,
                "description": "Bank in",
            },
            {
                "account_id": cash.id,
                "account_name": cash.account_name,
                "debit_amount": 0,
                "credit_amount": 2000.0,
                "description": "Cash out",
            },
        ],
        voucher_date=_days_ago(3),
        location_id=location_id,
        location_name=location_name,
    )

    # 6) Notes
    accounting.create_credit_note(
        party_kind="customer",
        party_account_id=c0.id,
        amount=200.0,
        description=_desc("Customer credit note"),
        voucher_date=_days_ago(2),
    )
    accounting.create_debit_note(
        party_kind="vendor",
        party_account_id=v0.id,
        amount=150.0,
        description=_desc("Vendor debit note"),
        voucher_date=_days_ago(1),
    )

    logger.info(
        "Finance demo seed posted (%s voucher types)",
        len(_present_demo_types(accounting)),
    )


def seed_finance_demo(db: Database, settings: Optional[AppSettings] = None) -> None:
    """Post demo vouchers for every finance UI chip. Idempotent / self-healing."""
    if settings is not None and not getattr(settings, "seed_finance", True):
        logger.info("Finance demo seed skipped (SEED_FINANCE=false)")
        return

    accounting, agents = _services(db)
    customers, vendors = _party_accounts(accounting)
    if not customers or not vendors:
        logger.info("Finance demo seed skipped (no customer/vendor ledger accounts)")
        return

    if _full_recipe_present(accounting):
        logger.info("Finance demo seed skipped (full [demo-finance] recipe present)")
        return

    present = _present_demo_types(accounting)
    if present:
        logger.warning(
            "Partial [demo-finance] recipe found (%s); self-healing via void_voucher",
            sorted(present),
        )
        _void_demo_vouchers(accounting)

    main_id, _store_id = ensure_default_locations(db)
    _post_recipe(
        accounting,
        agents,
        location_id=main_id,
        location_name="Main Warehouse",
    )

    if not _full_recipe_present(accounting):
        missing = sorted(REQUIRED_DEMO_TYPES - _present_demo_types(accounting))
        raise RuntimeError(
            f"Finance demo seed incomplete; missing voucher types: {missing}"
        )
