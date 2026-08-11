"""Finance API — accounts/vouchers + posting reserve/lock consumer."""

from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from packages.messaging.bus import get_bus
from packages.messaging.locking import ReserveLockService
from packages.services_kit.finance_container import get_finance_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.enums import VoucherType
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/finance", tags=["finance"])
_locks = ReserveLockService()
_CONSUMER_HEALTHY = True

PAYMENT_TYPES = {
    VoucherType.PAYMENT,
    VoucherType.VENDOR_PAYMENT,
    VoucherType.SALARY_PAYMENT,
    VoucherType.COMMISSION_PAYMENT,
}
INVOICE_TYPES = {
    VoucherType.SALES_INVOICE,
    VoucherType.CUSTOMIZATION_INVOICE,
    VoucherType.PURCHASE_BILL,
    VoucherType.PURCHASE_EXPENSE,
}
REPORT_TYPES = [
    "Trial Balance",
    "Account Balances",
    "Cash Movement",
    "Customer Outstanding",
    "Vendor Payables",
    "Voucher Listing",
]


class PostingRequest(BaseModel):
    key: str = Field(min_length=1)
    amount: float = 0.0


class AccountWrite(BaseModel):
    account_name: str = Field(min_length=1)
    account_type: str = Field(min_length=1)
    opening_balance: float = 0.0
    is_store_account: bool = False
    is_salary_account: bool = False
    is_active: bool = True


class AccountUpdate(BaseModel):
    account_name: str = Field(min_length=1)
    account_type: str = Field(min_length=1)
    is_store_account: bool = False
    is_salary_account: Optional[bool] = None
    is_active: Optional[bool] = None
    opening_balance: Optional[float] = None


class ReceiptWrite(BaseModel):
    receiving_account_id: str
    customer_account_id: str
    amount: float = Field(gt=0)
    description: str = ""
    voucher_date: Optional[str] = None
    location_id: str = "default"
    location_name: str = ""


class PaymentWrite(BaseModel):
    payment_kind: str = "vendor"  # vendor | salary | commission | expense
    paying_account_id: str
    amount: float = Field(gt=0)
    description: str = ""
    voucher_date: Optional[str] = None
    vendor_account_id: str = ""
    expense_account_id: str = ""
    worker_account_id: str = ""
    agent_account_id: str = ""
    location_id: str = "default"
    location_name: str = ""


class NoteWrite(BaseModel):
    party_kind: str = "customer"  # customer | vendor
    party_account_id: str
    amount: float = Field(gt=0)
    description: str = ""
    contra_account_id: Optional[str] = None
    voucher_date: Optional[str] = None
    amount_settled: float = 0.0
    settle_account_id: Optional[str] = None


class JournalLineWrite(BaseModel):
    account_id: str
    account_name: str = ""
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    description: str = ""


class JournalWrite(BaseModel):
    description: str = ""
    lines: List[JournalLineWrite] = Field(min_length=2)
    voucher_date: Optional[str] = None
    location_id: str = ""
    location_name: str = ""


class ReportRunBody(BaseModel):
    report_type: str
    filters: dict[str, Any] = Field(default_factory=dict)


def _svc():
    return get_finance_container().accounting


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _voucher_type(v: Any) -> str:
    vt = getattr(v, "voucher_type", None)
    return vt.value if hasattr(vt, "value") else str(vt or "")


def _voucher_amount(v: Any) -> float:
    total = 0.0
    for line in getattr(v, "lines", []) or []:
        total += float(getattr(line, "debit_amount", 0) or 0)
    return round(total, 2)


def _display_description(raw: Any) -> str:
    """Human-readable voucher description — strip meta JSON used by Streamlit SOR."""
    text = str(raw or "")
    try:
        from vaybooks.bms.domain.finance.accounting.settlement import (
            ALLOC_INVOICE_TAG,
            CREDIT_APPLIED_TAG,
            CUSTOMER_SETTLEMENT_TAG,
            strip_meta,
        )

        for tag in (ALLOC_INVOICE_TAG, CREDIT_APPLIED_TAG, CUSTOMER_SETTLEMENT_TAG):
            text = strip_meta(text, tag)
    except Exception:
        pass
    try:
        from vaybooks.bms.domain.finance.fy_close import FY_CARRY_FORWARD_TAG, FY_OPENING_TAG
        from vaybooks.bms.domain.finance.accounting.settlement import strip_meta

        for tag in (FY_CARRY_FORWARD_TAG, FY_OPENING_TAG):
            text = strip_meta(text, tag)
    except Exception:
        pass

    # <!--TAG:{...}--> blobs (any tag)
    text = re.sub(r"<!--\s*[A-Z0-9_]+\s*:.*?-->", "", text, flags=re.DOTALL)
    # Purchase bill embedded lines: LINES_JSON:[...]
    text = re.sub(r"(?im)^\s*LINES_JSON:.*$", "", text)
    # Drop whole lines that are JSON objects/arrays (sales line-item notes, commission)
    kept: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if (stripped.startswith("{") and stripped.endswith("}")) or (
            stripped.startswith("[") and stripped.endswith("]")
        ):
            continue
        # Truncate mid-line JSON suffix: "Invoice foo\n{...}" already handled; also "text {json}"
        if "{" in stripped:
            before, _, after = stripped.partition("{")
            if after.rstrip().endswith("}") or after.lstrip().startswith('"'):
                stripped = before.strip()
                if not stripped:
                    continue
        kept.append(stripped)
    return " ".join(kept).strip()


def _party_name(v: Any) -> str:
    """Best-effort party caption from voucher lines (Streamlit voucher_card parity)."""
    lines = list(getattr(v, "lines", None) or [])
    if not lines:
        return ""
    vt = getattr(v, "voucher_type", None)
    vt_val = vt.value if hasattr(vt, "value") else str(vt or "")

    def _name(line: Any) -> str:
        return str(getattr(line, "account_name", "") or "").strip()

    if vt in (
        VoucherType.VENDOR_PAYMENT,
        VoucherType.SALARY_PAYMENT,
        VoucherType.COMMISSION_PAYMENT,
    ) or vt_val in {
        VoucherType.VENDOR_PAYMENT.value,
        VoucherType.SALARY_PAYMENT.value,
        VoucherType.COMMISSION_PAYMENT.value,
    }:
        return _name(lines[1]) if len(lines) > 1 else _name(lines[0])

    if vt in (VoucherType.RECEIPT, VoucherType.ADVANCE) or vt_val in {
        VoucherType.RECEIPT.value,
        VoucherType.ADVANCE.value,
    }:
        for line in lines:
            if float(getattr(line, "credit_amount", 0) or 0) > 0 and getattr(
                line, "description", ""
            ) in ("Payment received", "Advance received"):
                return _name(line)
        return _name(lines[1]) if len(lines) > 1 else ""

    if vt in (VoucherType.SALES_INVOICE, VoucherType.CUSTOMIZATION_INVOICE) or vt_val in {
        VoucherType.SALES_INVOICE.value,
        VoucherType.CUSTOMIZATION_INVOICE.value,
    }:
        for line in lines:
            desc = getattr(line, "description", "") or ""
            if (
                float(getattr(line, "debit_amount", 0) or 0) > 0
                and desc not in ("Advance applied", "Discount allowed", "Cash/Bank received")
                and "discount" not in _name(line).lower()
            ):
                return _name(line)
        return ""

    if vt in (VoucherType.PURCHASE_BILL, VoucherType.PURCHASE_EXPENSE) or vt_val in {
        VoucherType.PURCHASE_BILL.value,
        VoucherType.PURCHASE_EXPENSE.value,
    }:
        for line in lines:
            if float(getattr(line, "credit_amount", 0) or 0) > 0:
                return _name(line)
        return ""

    return ""


def _voucher_dict(v: Any, *, include_lines: bool = False) -> dict[str, Any]:
    data = entity_dict(v)
    data["voucher_type"] = _voucher_type(v)
    data["amount"] = _voucher_amount(v)
    data["description"] = _display_description(data.get("description"))
    data["party_name"] = _party_name(v)
    data["caption"] = (
        f"{data.get('voucher_number') or ''} · {data['voucher_type']} · "
        f"₹{data['amount']:,.2f}"
    ).strip(" ·")
    # Nested line objects stringify poorly in cards; keep them on detail only
    if not include_lines:
        data.pop("lines", None)
    return data


def _clean_ledger_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["description"] = _display_description(item.get("description"))
        vd = item.get("voucher_date")
        if isinstance(vd, (datetime, date)):
            item["voucher_date"] = vd.isoformat()
        out.append(item)
    return out


def _account_dict(a: Any) -> dict[str, Any]:
    data = entity_dict(a)
    data["name"] = data.get("account_name") or data.get("name") or ""
    data["account_type"] = (
        a.account_type.value if hasattr(a.account_type, "value") else str(a.account_type)
    )
    data["balance"] = float(getattr(a, "current_balance", 0) or 0)
    data["is_store_account"] = bool(getattr(a, "is_store_account", False))
    data["is_salary_account"] = bool(getattr(a, "is_salary_account", False))
    data["is_active"] = bool(getattr(a, "is_active", True))
    return data


def _filter_vouchers(
    vouchers: list[Any],
    *,
    voucher_type: Optional[str] = None,
    types: Optional[set[VoucherType]] = None,
) -> list[Any]:
    out = list(vouchers)
    if voucher_type:
        needle = voucher_type.strip().lower()
        out = [v for v in out if _voucher_type(v).lower() == needle]
    if types is not None:
        out = [
            v
            for v in out
            if getattr(v, "voucher_type", None) in types
            or _voucher_type(v) in {t.value for t in types}
        ]
    out.sort(
        key=lambda v: getattr(v, "voucher_date", None) or datetime.min,
        reverse=True,
    )
    return out


@router.get("/health")
def health() -> dict[str, object]:
    c = get_finance_container()
    return {
        "module": "finance",
        "status": "ok",
        "consumer_healthy": _CONSUMER_HEALTHY,
        "backend": c.backend,
    }


@router.post("/postings")
def request_posting(body: PostingRequest) -> dict[str, object]:
    record = _locks.request_reserve(f"finance:{body.key}")
    get_bus().publish(
        "FinancePostingRequested",
        {"key": body.key, "amount": body.amount, "state": record.state.value},
    )
    return {"key": body.key, "state": record.state.value, "status": "posting_pending"}


@router.post("/postings/{key}/confirm")
def confirm_posting(key: str) -> dict[str, object]:
    record = _locks.confirm(f"finance:{key}")
    get_bus().publish("FinancePostingConfirmed", {"key": key, "state": record.state.value})
    return {"key": key, "state": record.state.value}


@router.post("/postings/{key}/fail")
def fail_posting(key: str, reason: str = "failed") -> dict[str, object]:
    record = _locks.fail(f"finance:{key}", reason=reason)
    get_bus().publish(
        "FinancePostingFailed",
        {"key": key, "state": record.state.value, "reason": reason},
    )
    return {"key": key, "state": record.state.value, "reason": reason}


@router.get("/postings/{key}")
def get_posting(key: str) -> dict[str, object]:
    record = _locks.get(f"finance:{key}")
    if not record:
        raise HTTPException(status_code=404, detail="posting not found")
    return {"key": key, "state": record.state.value, "reason": record.reason}


@router.get("/overview")
def overview() -> dict[str, Any]:
    svc = _svc()
    accounts = svc.list_accounts(active_only=False)
    vouchers = svc.list_vouchers()
    ar = [
        a
        for a in accounts
        if getattr(a, "linked_customer_id", None) and float(a.current_balance or 0) > 0.01
    ]
    ap = [
        a
        for a in accounts
        if getattr(a, "linked_vendor_id", None) and float(a.current_balance or 0) < -0.01
    ]
    ar.sort(key=lambda a: float(a.current_balance or 0), reverse=True)
    ap.sort(key=lambda a: float(a.current_balance or 0))
    receipt_total = sum(
        _voucher_amount(v) for v in vouchers if _voucher_type(v) == VoucherType.RECEIPT.value
    )
    payment_total = sum(
        _voucher_amount(v)
        for v in vouchers
        if getattr(v, "voucher_type", None) in PAYMENT_TYPES
        or _voucher_type(v) in {t.value for t in PAYMENT_TYPES}
    )
    return {
        "kpis": {
            "account_count": len(accounts),
            "voucher_count": len(vouchers),
            "ar_balance": round(sum(float(a.current_balance or 0) for a in ar), 2),
            "ap_balance": round(abs(sum(float(a.current_balance or 0) for a in ap)), 2),
            "receipts_total": round(receipt_total, 2),
            "payments_total": round(payment_total, 2),
        },
        "ar_queue": [_account_dict(a) for a in ar[:8]],
        "ap_queue": [_account_dict(a) for a in ap[:8]],
        "quick_actions": [
            {"to": "/finance/receipts", "label": "Record Receipt"},
            {"to": "/finance/payments", "label": "Record Payment"},
            {"to": "/finance/journal", "label": "Journal Entry"},
            {"to": "/finance/accounts", "label": "Accounts"},
            {"to": "/finance/trial-balance", "label": "Trial Balance"},
        ],
    }


@router.get("/accounts")
def list_accounts(
    active_only: bool = Query(False),
    q: Optional[str] = None,
    store_only: bool = Query(False),
) -> list[dict[str, Any]]:
    rows = [_account_dict(a) for a in _svc().list_accounts(active_only=active_only)]
    if store_only:
        rows = [
            r
            for r in rows
            if bool(r.get("is_store_account"))
            and not r.get("linked_customer_id")
            and not r.get("linked_vendor_id")
            and not r.get("linked_worker_id")
            and not r.get("linked_agent_id")
            and not r.get("linked_delivery_partner_id")
            and r.get("is_active", True) is not False
        ]
    if q:
        needle = q.strip().lower()
        rows = [
            r
            for r in rows
            if needle in str(r.get("account_name", "")).lower()
            or needle in str(r.get("account_type", "")).lower()
        ]
    rows.sort(key=lambda r: str(r.get("account_name", "")).lower())
    return rows


@router.post("/accounts", status_code=201)
def create_account(body: AccountWrite) -> dict[str, Any]:
    try:
        acc = _svc().create_account(
            account_name=body.account_name.strip(),
            account_type=body.account_type,
            opening_balance=body.opening_balance,
            is_store_account=body.is_store_account,
            is_salary_account=body.is_salary_account,
        )
        if body.is_active is False:
            acc = _svc().update_account(
                acc.id,
                acc.account_name,
                acc.account_type.value,
                acc.is_store_account,
                acc.is_salary_account,
                is_active=False,
            )
        return _account_dict(acc)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/accounts/{account_id}")
def get_account(account_id: str) -> dict[str, Any]:
    acc = _svc().get_account(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    data = _account_dict(acc)
    data["ledger"] = _clean_ledger_rows(list(_svc().get_account_ledger(account_id)))
    data["is_protected"] = _svc().is_protected_account(acc)
    return data


@router.put("/accounts/{account_id}")
def update_account(account_id: str, body: AccountUpdate) -> dict[str, Any]:
    try:
        if body.opening_balance is not None:
            _svc().set_opening_balance(account_id, body.opening_balance)
        acc = _svc().update_account(
            account_id,
            body.account_name.strip(),
            body.account_type,
            body.is_store_account,
            body.is_salary_account,
            body.is_active,
        )
        return _account_dict(acc)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: str) -> None:
    try:
        acc = _svc().get_account(account_id)
        if not acc:
            raise HTTPException(status_code=404, detail="Account not found")
        if _svc().is_protected_account(acc):
            raise HTTPException(status_code=400, detail="Protected accounts cannot be deleted")
        _svc().delete_account(account_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/accounts/{account_id}/ledger")
def account_ledger(account_id: str) -> list[dict[str, Any]]:
    if not _svc().get_account(account_id):
        raise HTTPException(status_code=404, detail="Account not found")
    return _clean_ledger_rows(list(_svc().get_account_ledger(account_id)))


@router.get("/vouchers")
def list_vouchers(
    voucher_type: Optional[str] = None,
    q: Optional[str] = None,
) -> list[dict[str, Any]]:
    rows = [
        _voucher_dict(v)
        for v in _filter_vouchers(_svc().list_vouchers(), voucher_type=voucher_type)
    ]
    if q:
        needle = q.strip().lower()
        rows = [
            r
            for r in rows
            if needle in str(r.get("voucher_number", "")).lower()
            or needle in str(r.get("description", "")).lower()
            or needle in str(r.get("voucher_type", "")).lower()
        ]
    return rows


@router.get("/vouchers/{voucher_id}")
def get_voucher(voucher_id: str) -> dict[str, Any]:
    v = _svc().get_voucher(voucher_id)
    if not v:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return _voucher_dict(v, include_lines=True)


@router.get("/receipts")
def list_receipts() -> list[dict[str, Any]]:
    return [
        _voucher_dict(v)
        for v in _filter_vouchers(
            _svc().list_vouchers(), voucher_type=VoucherType.RECEIPT.value
        )
    ]


@router.post("/receipts", status_code=201)
def create_receipt(body: ReceiptWrite) -> dict[str, Any]:
    try:
        v = _svc().create_receipt(
            receiving_account_id=body.receiving_account_id,
            customer_account_id=body.customer_account_id,
            amount=body.amount,
            description=body.description or "Receipt",
            voucher_date=_parse_date(body.voucher_date),
            location_id=body.location_id or "default",
            location_name=body.location_name,
        )
        return _voucher_dict(v)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/payments")
def list_payments() -> list[dict[str, Any]]:
    return [
        _voucher_dict(v)
        for v in _filter_vouchers(_svc().list_vouchers(), types=PAYMENT_TYPES)
    ]


@router.post("/payments", status_code=201)
def create_payment(body: PaymentWrite) -> dict[str, Any]:
    svc = _svc()
    kind = (body.payment_kind or "vendor").strip().lower()
    v_date = _parse_date(body.voucher_date)
    try:
        if kind == "vendor":
            if not body.vendor_account_id or not body.expense_account_id:
                raise ValueError("vendor_account_id and expense_account_id are required")
            v = svc.create_vendor_payment(
                vendor_account_id=body.vendor_account_id,
                expense_account_id=body.expense_account_id,
                paying_account_id=body.paying_account_id,
                amount=body.amount,
                description=body.description or "Vendor payment",
                voucher_date=v_date,
                location_id=body.location_id or "default",
                location_name=body.location_name,
            )
        elif kind == "salary":
            salary_id = body.worker_account_id or body.expense_account_id
            if not salary_id:
                raise ValueError("worker_account_id (salary account) is required")
            v = svc.create_salary_payment(
                salary_account_id=salary_id,
                paying_account_id=body.paying_account_id,
                amount=body.amount,
                description=body.description or "Salary payment",
                voucher_date=v_date,
            )
        elif kind == "commission":
            if not body.agent_account_id:
                raise ValueError("agent_account_id is required for commission payment")
            v = svc.create_commission_payment(
                agent_account_id=body.agent_account_id,
                paying_account_id=body.paying_account_id,
                amount=body.amount,
                description=body.description or "Commission payment",
                voucher_date=v_date,
            )
        else:
            if not body.expense_account_id:
                raise ValueError("expense_account_id is required")
            v = svc.create_payment(
                expense_account_id=body.expense_account_id,
                paying_account_id=body.paying_account_id,
                amount=body.amount,
                description=body.description or "Payment",
                voucher_date=v_date,
                location_id=body.location_id or "default",
                location_name=body.location_name,
            )
        return _voucher_dict(v)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/credit-notes")
def list_credit_notes() -> list[dict[str, Any]]:
    return [
        _voucher_dict(v)
        for v in _filter_vouchers(
            _svc().list_vouchers(), voucher_type=VoucherType.CREDIT_NOTE.value
        )
    ]


@router.post("/credit-notes", status_code=201)
def create_credit_note(body: NoteWrite) -> dict[str, Any]:
    try:
        v = _svc().create_credit_note(
            party_kind=body.party_kind,
            party_account_id=body.party_account_id,
            amount=body.amount,
            description=body.description or "Credit note",
            contra_account_id=body.contra_account_id,
            voucher_date=_parse_date(body.voucher_date),
            amount_settled=body.amount_settled,
            settle_account_id=body.settle_account_id,
        )
        return _voucher_dict(v)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/debit-notes")
def list_debit_notes() -> list[dict[str, Any]]:
    return [
        _voucher_dict(v)
        for v in _filter_vouchers(
            _svc().list_vouchers(), voucher_type=VoucherType.DEBIT_NOTE.value
        )
    ]


@router.post("/debit-notes", status_code=201)
def create_debit_note(body: NoteWrite) -> dict[str, Any]:
    try:
        v = _svc().create_debit_note(
            party_kind=body.party_kind,
            party_account_id=body.party_account_id,
            amount=body.amount,
            description=body.description or "Debit note",
            contra_account_id=body.contra_account_id,
            voucher_date=_parse_date(body.voucher_date),
            amount_settled=body.amount_settled,
            settle_account_id=body.settle_account_id,
        )
        return _voucher_dict(v)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/accounting-invoices")
def list_accounting_invoices() -> list[dict[str, Any]]:
    return [
        _voucher_dict(v)
        for v in _filter_vouchers(_svc().list_vouchers(), types=INVOICE_TYPES)
    ]


@router.get("/journal")
def list_journal() -> list[dict[str, Any]]:
    return [
        _voucher_dict(v)
        for v in _filter_vouchers(
            _svc().list_vouchers(), voucher_type=VoucherType.JOURNAL.value
        )
    ]


@router.post("/journal", status_code=201)
def create_journal(body: JournalWrite) -> dict[str, Any]:
    svc = _svc()
    lines: list[dict[str, Any]] = []
    for line in body.lines:
        acc = svc.get_account(line.account_id)
        if not acc:
            raise HTTPException(status_code=400, detail=f"Account not found: {line.account_id}")
        lines.append(
            {
                "account_id": acc.id,
                "account_name": line.account_name or acc.account_name,
                "debit_amount": float(line.debit_amount or 0),
                "credit_amount": float(line.credit_amount or 0),
                "description": line.description,
            }
        )
    debit = sum(float(l["debit_amount"]) for l in lines)
    credit = sum(float(l["credit_amount"]) for l in lines)
    if abs(debit - credit) > 0.01:
        raise HTTPException(status_code=400, detail="Journal lines must balance")
    try:
        if (body.location_id or "").strip():
            v = svc.create_journal_entry(
                description=body.description or "Journal",
                lines=lines,
                voucher_date=_parse_date(body.voucher_date),
                location_id=body.location_id,
                location_name=body.location_name,
            )
        else:
            v = svc.create_fy_system_journal(
                description=body.description or "Journal",
                lines=lines,
                voucher_date=_parse_date(body.voucher_date),
            )
        return _voucher_dict(v)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/trial-balance")
def trial_balance() -> dict[str, Any]:
    rows = list(_svc().get_trial_balance())
    debit = round(sum(float(r.get("debit", 0) or 0) for r in rows), 2)
    credit = round(sum(float(r.get("credit", 0) or 0) for r in rows), 2)
    return {"rows": rows, "totals": {"debit": debit, "credit": credit}}


@router.get("/reports")
def reports_catalog() -> dict[str, Any]:
    return {"report_types": REPORT_TYPES}


@router.post("/reports/run")
def run_report(body: ReportRunBody) -> dict[str, Any]:
    svc = _svc()
    rtype = (body.report_type or "").strip()
    if rtype not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {rtype}")

    if rtype == "Trial Balance":
        rows = list(svc.get_trial_balance())
    elif rtype == "Account Balances":
        rows = [
            {
                "account_name": a.account_name,
                "account_type": a.account_type.value,
                "balance": float(a.current_balance or 0),
            }
            for a in svc.list_accounts(active_only=False)
        ]
    elif rtype == "Cash Movement":
        rows = []
        for v in svc.list_vouchers():
            vt = _voucher_type(v)
            if vt not in {
                VoucherType.RECEIPT.value,
                VoucherType.PAYMENT.value,
                VoucherType.VENDOR_PAYMENT.value,
                VoucherType.SALARY_PAYMENT.value,
                VoucherType.COMMISSION_PAYMENT.value,
            }:
                continue
            rows.append(
                {
                    "date": getattr(v, "voucher_date", None),
                    "voucher_number": v.voucher_number,
                    "type": vt,
                    "description": _display_description(v.description),
                    "amount": _voucher_amount(v),
                }
            )
    elif rtype == "Customer Outstanding":
        rows = [
            {
                "account_name": a.account_name,
                "customer_id": a.linked_customer_id,
                "balance": float(a.current_balance or 0),
            }
            for a in svc.list_accounts(active_only=False)
            if getattr(a, "linked_customer_id", None)
            and abs(float(a.current_balance or 0)) > 0.01
        ]
    elif rtype == "Vendor Payables":
        rows = [
            {
                "account_name": a.account_name,
                "vendor_id": a.linked_vendor_id,
                "balance": float(a.current_balance or 0),
            }
            for a in svc.list_accounts(active_only=False)
            if getattr(a, "linked_vendor_id", None)
            and abs(float(a.current_balance or 0)) > 0.01
        ]
    else:
        rows = [
            {
                "voucher_number": v.voucher_number,
                "type": _voucher_type(v),
                "date": getattr(v, "voucher_date", None),
                "description": _display_description(v.description),
                "amount": _voucher_amount(v),
            }
            for v in svc.list_vouchers()
        ]

    # JSON-serialize dates
    clean: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        for k, val in list(item.items()):
            if isinstance(val, (datetime, date)):
                item[k] = val.isoformat()
        clean.append(item)
    return {"report_type": rtype, "row_count": len(clean), "rows": clean}


@router.get("/export")
def export_csv(
    entity: str = Query("accounts", pattern="^(accounts|vouchers|trial-balance)$"),
) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    if entity == "accounts":
        writer.writerow(
            ["id", "account_name", "account_type", "opening_balance", "current_balance", "is_active"]
        )
        for a in _svc().list_accounts(active_only=False):
            writer.writerow(
                [
                    a.id,
                    a.account_name,
                    a.account_type.value,
                    a.opening_balance,
                    a.current_balance,
                    a.is_active,
                ]
            )
    elif entity == "vouchers":
        writer.writerow(
            ["id", "voucher_number", "voucher_type", "voucher_date", "description", "amount"]
        )
        for v in _svc().list_vouchers():
            writer.writerow(
                [
                    v.id,
                    v.voucher_number,
                    _voucher_type(v),
                    getattr(v, "voucher_date", ""),
                    _display_description(v.description),
                    _voucher_amount(v),
                ]
            )
    else:
        writer.writerow(["account_name", "account_type", "debit", "credit"])
        for row in _svc().get_trial_balance():
            writer.writerow(
                [
                    row.get("account_name"),
                    row.get("account_type"),
                    row.get("debit"),
                    row.get("credit"),
                ]
            )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="finance-{entity}.csv"'},
    )


def is_consumer_healthy() -> bool:
    return _CONSUMER_HEALTHY
