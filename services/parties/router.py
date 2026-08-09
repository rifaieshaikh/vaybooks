"""Parties API — typed adapters over Customer/Vendor/... AppServices."""

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from packages.events.registry import get_event
from packages.messaging.bus import get_bus
from packages.services_kit.parties_container import get_parties_container
from services.common.authz import require_permission
from services.parties.schemas import (
    BlacklistBody,
    CommissionAgentWrite,
    CustomerWrite,
    DeliveryPartnerWrite,
    SegmentWrite,
    SettleBody,
    VendorWrite,
    WorkerWrite,
)
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.parties.commission_agents.entities import CommissionAgentInput
from vaybooks.bms.domain.parties.customers.entities import CustomerInput
from vaybooks.bms.domain.parties.delivery_partners.entities import DeliveryPartnerInput
from vaybooks.bms.domain.parties.vendors.entities import VendorInput
from vaybooks.bms.domain.shared.enums import PartyRegistrationType
from vaybooks.bms.domain.shared.exceptions import ValidationError, DuplicateCustomerError

router = APIRouter(prefix="/api/parties", tags=["parties"])

DEFAULT_LOCATION = "default"


def _svc():
    return get_parties_container()


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, (ValidationError, DuplicateCustomerError)):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    # Domain duplicate / validation-style errors often subclass Exception with message
    name = type(exc).__name__
    if "Duplicate" in name or "Validation" in name:
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


def _reg_type(value: str) -> PartyRegistrationType:
    raw = (value or "Unregistered").strip()
    try:
        return PartyRegistrationType(raw)
    except ValueError:
        return PartyRegistrationType.UNREGISTERED


def _locs(location_ids: List[str] | None) -> List[str]:
    ids = [str(x).strip() for x in (location_ids or []) if str(x).strip()]
    return ids or [DEFAULT_LOCATION]


def _publish(event_name: str, payload: dict[str, Any]) -> None:
    ev = get_event(event_name)
    get_bus().publish(ev.name, payload, version=ev.version)


def _customer_input(body: CustomerWrite) -> CustomerInput:
    return CustomerInput(
        customer_name=body.customer_name,
        phone_number=body.phone_number or "",
        alternate_phone_number=body.alternate_phone_number,
        email=body.email,
        contact_person=body.contact_person,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        state_code=body.state_code,
        pincode=body.pincode,
        country=body.country,
        gstin=body.gstin,
        pan=body.pan,
        registration_type=_reg_type(body.registration_type),
        msme_number=body.msme_number,
        notes=body.notes,
        segment_ids=list(body.segment_ids or []),
        location_ids=_locs(body.location_ids),
        is_commission_agent=body.is_commission_agent,
    )


def _vendor_input(body: VendorWrite) -> VendorInput:
    return VendorInput(
        vendor_name=body.vendor_name,
        phone_number=body.phone_number,
        alternate_phone_number=body.alternate_phone_number,
        email=body.email,
        contact_person=body.contact_person,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        state_code=body.state_code,
        pincode=body.pincode,
        country=body.country,
        gstin=body.gstin,
        pan=body.pan,
        registration_type=_reg_type(body.registration_type),
        msme_number=body.msme_number,
        bank_account_holder=body.bank_account_holder,
        bank_account_number=body.bank_account_number,
        bank_ifsc=body.bank_ifsc,
        bank_name=body.bank_name,
        notes=body.notes,
        segment_ids=list(body.segment_ids or []),
        location_ids=_locs(body.location_ids),
    )


@router.get("/health")
def health() -> dict[str, str]:
    backend = _svc().backend
    return {"module": "parties", "status": "ok", "backend": backend}


# --- Customers -----------------------------------------------------------------


@router.get("/customers")
def list_customers(
    q: str = Query(default=""),
    _: str = Depends(require_permission("parties.customers.view")),
) -> list[dict[str, Any]]:
    rows = _svc().customers.search_customers(q)
    balances: dict[str, float] = {}
    try:
        balances = dict(_svc().account_repo.customer_balances_by_customer() or {})
    except Exception:
        balances = {}
    out = []
    for r in rows:
        data = entity_dict(r)
        cid = str(data.get("id") or "")
        data["order_count"] = int(getattr(r, "order_count", 0) or 0)
        data["current_balance"] = float(balances.get(cid, getattr(r, "current_balance", 0.0) or 0.0))
        out.append(data)
    return out


@router.post("/customers", status_code=201)
def create_customer(
    body: CustomerWrite,
    _: str = Depends(require_permission("parties.customers.create")),
) -> dict[str, Any]:
    try:
        customer = _svc().customers.create_customer(_customer_input(body))
    except Exception as exc:
        raise _http_err(exc) from exc
    _publish(
        "PartyCreated",
        {"entity": "customer", "id": customer.id, "kind": "customer", "name": customer.customer_name},
    )
    return entity_dict(customer)


@router.get("/customers/{customer_id}")
def get_customer(
    customer_id: str,
    _: str = Depends(require_permission("parties.customers.view")),
) -> dict[str, Any]:
    customer = _svc().customers.get_customer_detail(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="customer not found")
    return entity_dict(customer)


@router.put("/customers/{customer_id}")
def update_customer(
    customer_id: str,
    body: CustomerWrite,
    _: str = Depends(require_permission("parties.customers.edit")),
) -> dict[str, Any]:
    try:
        customer = _svc().customers.update_customer(customer_id, _customer_input(body))
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(customer)


@router.post("/customers/{customer_id}/blacklist")
def blacklist_customer(
    customer_id: str,
    body: BlacklistBody,
    _: str = Depends(require_permission("parties.customers.blacklist")),
) -> dict[str, Any]:
    try:
        customer = _svc().customers.set_blacklisted(
            customer_id, body.blacklisted, reason=body.reason
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    if body.blacklisted:
        _publish(
            "PartyInvalidated",
            {"entity": "customer", "id": customer_id, "kind": "customer", "reason": "blacklist"},
        )
    return entity_dict(customer)


@router.get("/customers/{customer_id}/summary")
def customer_summary(
    customer_id: str,
    username: str = Depends(require_permission("parties.customers.view")),
) -> dict[str, Any]:
    customer = _svc().customers.get_customer_detail(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="customer not found")
    acct = _svc().account_repo.find_customer_account(customer_id)
    account_id = acct.id if acct else ""
    balance = float(acct.current_balance) if acct else 0.0
    accounting = _svc().accounting
    credit = 0.0
    receivable = 0.0
    advance = 0.0
    parked_settlement = 0.0
    open_invoice_outstanding = 0.0
    if account_id and accounting:
        try:
            credit = float(accounting.customer_credit_balance(account_id))
            receivable = float(accounting.customer_receivable_balance(account_id))
        except Exception:
            credit = max(-balance, 0.0)
            receivable = max(balance, 0.0)
        try:
            advance = float(accounting.get_customer_unapplied_advance(account_id) or 0.0)
        except Exception:
            advance = 0.0
        try:
            parked_settlement = float(accounting.get_customer_parked_settlement(account_id) or 0.0)
        except Exception:
            parked_settlement = 0.0
        try:
            open_invoices = accounting.list_open_sales_invoices_for_customer(account_id) or []
            total = 0.0
            for inv in open_invoices:
                if isinstance(inv, dict):
                    total += float(inv.get("outstanding", 0.0) or 0.0)
                else:
                    total += float(getattr(inv, "outstanding", 0.0) or 0.0)
            open_invoice_outstanding = total
        except Exception:
            open_invoice_outstanding = receivable

    payload: dict[str, Any] = {
        "account_id": account_id,
        "extras": {"is_blacklisted": bool(customer.is_blacklisted)},
    }

    from services.auth.router import _access, _load_user_by_username, _perm_key, permission_cache
    from packages.tenancy.context import DEFAULT_ORG_ID, get_org_id

    user = _load_user_by_username(username)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    cached = permission_cache.get(_perm_key(user.username, oid)) or {}
    cached_perms = list(cached.get("permissions") or [])
    can_finance = "*" in cached_perms or _access().authorization.can(
        user, "parties.customers.finance.view"
    )
    if can_finance:
        payload.update(
            {
                "balance": balance,
                "credit_balance": credit,
                "receivable_balance": receivable,
                "advance": advance,
                "parked_settlement": parked_settlement,
                "open_invoice_outstanding": open_invoice_outstanding,
            }
        )
    else:
        payload.update(
            {
                "balance": None,
                "credit_balance": None,
                "receivable_balance": None,
                "advance": None,
                "parked_settlement": None,
                "open_invoice_outstanding": None,
            }
        )
    return payload


@router.post("/customers/{customer_id}/settle")
def settle_customer(
    customer_id: str,
    body: SettleBody,
    _: str = Depends(require_permission("parties.customers.finance.settle")),
) -> dict[str, Any]:
    acct = _svc().account_repo.find_customer_account(customer_id)
    if not acct:
        raise HTTPException(status_code=404, detail="customer account not found")
    try:
        vouchers = _svc().accounting.settle_customer_balance(
            acct.id,
            body.amount,
            mode=body.mode,
            reason=body.reason,
            voucher_date=body.voucher_date,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return {"ok": True, "voucher_ids": [v.id for v in vouchers]}


# --- Vendors -------------------------------------------------------------------


@router.get("/vendors")
def list_vendors(q: str = Query(default="")) -> list[dict[str, Any]]:
    out = []
    for r in _svc().vendors.search_vendors(q):
        data = entity_dict(r)
        acct = _svc().account_repo.find_vendor_account(str(data.get("id") or ""))
        data["current_balance"] = float(acct.current_balance) if acct else 0.0
        out.append(data)
    return out


@router.post("/vendors", status_code=201)
def create_vendor(body: VendorWrite) -> dict[str, Any]:
    try:
        vendor = _svc().vendors.create_vendor(_vendor_input(body))
    except Exception as exc:
        raise _http_err(exc) from exc
    _publish(
        "PartyCreated",
        {"entity": "vendor", "id": vendor.id, "kind": "vendor", "name": vendor.vendor_name},
    )
    return entity_dict(vendor)


@router.get("/vendors/{vendor_id}")
def get_vendor(vendor_id: str) -> dict[str, Any]:
    vendor = _svc().vendors.get_vendor_detail(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="vendor not found")
    return entity_dict(vendor)


@router.put("/vendors/{vendor_id}")
def update_vendor(vendor_id: str, body: VendorWrite) -> dict[str, Any]:
    try:
        vendor = _svc().vendors.update_vendor(vendor_id, _vendor_input(body))
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(vendor)


@router.get("/vendors/{vendor_id}/summary")
def vendor_summary(vendor_id: str) -> dict[str, Any]:
    vendor = _svc().vendors.get_vendor_detail(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="vendor not found")
    acct = _svc().account_repo.find_vendor_account(vendor_id)
    balance = float(acct.current_balance) if acct else 0.0
    return {
        "account_id": acct.id if acct else "",
        "balance": balance,
        "credit_balance": max(-balance, 0.0),
        "receivable_balance": max(balance, 0.0),
        "extras": {},
    }


# --- Delivery partners ---------------------------------------------------------


@router.get("/delivery-partners")
def list_partners(q: str = Query(default="")) -> list[dict[str, Any]]:
    out = []
    for r in _svc().delivery_partners.search_partners(q):
        data = entity_dict(r)
        acct = _svc().account_repo.find_delivery_partner_account(str(data.get("id") or ""))
        data["current_balance"] = float(acct.current_balance) if acct else 0.0
        out.append(data)
    return out


@router.post("/delivery-partners", status_code=201)
def create_partner(body: DeliveryPartnerWrite) -> dict[str, Any]:
    data = DeliveryPartnerInput(
        partner_name=body.partner_name,
        phone_number=body.phone_number,
        legal_display_name=body.legal_display_name,
        alternate_phone_number=body.alternate_phone_number,
        email=body.email,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        state_code=body.state_code,
        pincode=body.pincode,
        country=body.country,
        gstin=body.gstin,
        pan=body.pan,
        default_expense_ledger_id=body.default_expense_ledger_id,
        payment_terms=body.payment_terms,
        is_active=body.is_active,
        notes=body.notes,
        location_ids=_locs(body.location_ids),
    )
    try:
        partner = _svc().delivery_partners.create_partner(data)
    except Exception as exc:
        raise _http_err(exc) from exc
    _publish(
        "PartyCreated",
        {
            "entity": "delivery_partner",
            "id": partner.id,
            "kind": "delivery_partner",
            "name": partner.partner_name,
        },
    )
    return entity_dict(partner)


@router.get("/delivery-partners/{partner_id}")
def get_partner(partner_id: str) -> dict[str, Any]:
    partner = _svc().delivery_partners.get_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="delivery partner not found")
    return entity_dict(partner)


@router.put("/delivery-partners/{partner_id}")
def update_partner(partner_id: str, body: DeliveryPartnerWrite) -> dict[str, Any]:
    data = DeliveryPartnerInput(
        partner_name=body.partner_name,
        phone_number=body.phone_number,
        legal_display_name=body.legal_display_name,
        alternate_phone_number=body.alternate_phone_number,
        email=body.email,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        state_code=body.state_code,
        pincode=body.pincode,
        country=body.country,
        gstin=body.gstin,
        pan=body.pan,
        default_expense_ledger_id=body.default_expense_ledger_id,
        payment_terms=body.payment_terms,
        is_active=body.is_active,
        notes=body.notes,
        location_ids=_locs(body.location_ids),
    )
    try:
        partner = _svc().delivery_partners.update_partner(partner_id, data)
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(partner)


@router.get("/delivery-partners/{partner_id}/summary")
def partner_summary(partner_id: str) -> dict[str, Any]:
    partner = _svc().delivery_partners.get_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="delivery partner not found")
    acct_id = _svc().delivery_partners.get_partner_account_id(partner_id) or ""
    acct = _svc().account_repo.find_by_id(acct_id) if acct_id else None
    balance = float(acct.current_balance) if acct else 0.0
    return {
        "account_id": acct_id,
        "balance": balance,
        "credit_balance": 0.0,
        "receivable_balance": balance,
        "extras": {"is_active": partner.is_active},
    }


# --- Commission agents ---------------------------------------------------------


@router.get("/commission-agents")
def list_agents(q: str = Query(default="")) -> list[dict[str, Any]]:
    out = []
    for r in _svc().commission_agents.search_agents(q):
        data = entity_dict(r)
        acct = _svc().account_repo.find_agent_account(str(data.get("id") or ""))
        data["current_balance"] = float(acct.current_balance) if acct else 0.0
        out.append(data)
    return out


@router.post("/commission-agents", status_code=201)
def create_agent(body: CommissionAgentWrite) -> dict[str, Any]:
    data = CommissionAgentInput(
        agent_name=body.agent_name,
        phone_number=body.phone_number,
        alternate_phone_number=body.alternate_phone_number,
        email=body.email,
        contact_person=body.contact_person,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        state_code=body.state_code,
        pincode=body.pincode,
        country=body.country,
        gstin=body.gstin,
        pan=body.pan,
        registration_type=_reg_type(body.registration_type),
        msme_number=body.msme_number,
        bank_account_holder=body.bank_account_holder,
        bank_account_number=body.bank_account_number,
        bank_ifsc=body.bank_ifsc,
        bank_name=body.bank_name,
        notes=body.notes,
        segment_ids=list(body.segment_ids or []),
        location_ids=_locs(body.location_ids),
        source_customer_id=body.source_customer_id,
    )
    try:
        agent = _svc().commission_agents.create_agent(data)
    except Exception as exc:
        raise _http_err(exc) from exc
    _publish(
        "PartyCreated",
        {
            "entity": "commission_agent",
            "id": agent.id,
            "kind": "commission_agent",
            "name": agent.agent_name,
        },
    )
    return entity_dict(agent)


@router.get("/commission-agents/{agent_id}")
def get_agent(agent_id: str) -> dict[str, Any]:
    agent = _svc().commission_agents.get_agent_detail(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="commission agent not found")
    return entity_dict(agent)


@router.put("/commission-agents/{agent_id}")
def update_agent(agent_id: str, body: CommissionAgentWrite) -> dict[str, Any]:
    data = CommissionAgentInput(
        agent_name=body.agent_name,
        phone_number=body.phone_number,
        alternate_phone_number=body.alternate_phone_number,
        email=body.email,
        contact_person=body.contact_person,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        state_code=body.state_code,
        pincode=body.pincode,
        country=body.country,
        gstin=body.gstin,
        pan=body.pan,
        registration_type=_reg_type(body.registration_type),
        msme_number=body.msme_number,
        bank_account_holder=body.bank_account_holder,
        bank_account_number=body.bank_account_number,
        bank_ifsc=body.bank_ifsc,
        bank_name=body.bank_name,
        notes=body.notes,
        segment_ids=list(body.segment_ids or []),
        location_ids=_locs(body.location_ids),
        source_customer_id=body.source_customer_id,
    )
    try:
        agent = _svc().commission_agents.update_agent(agent_id, data)
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(agent)


@router.get("/commission-agents/{agent_id}/summary")
def agent_summary(agent_id: str) -> dict[str, Any]:
    agent = _svc().commission_agents.get_agent_detail(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="commission agent not found")
    acct = _svc().account_repo.find_agent_account(agent_id)
    balance = float(acct.current_balance) if acct else 0.0
    return {
        "account_id": acct.id if acct else "",
        "balance": balance,
        "credit_balance": 0.0,
        "receivable_balance": balance,
        "extras": {},
    }


# --- Workers -------------------------------------------------------------------


@router.get("/workers")
def list_workers(active_only: bool = True) -> list[dict[str, Any]]:
    return [entity_dict(r) for r in _svc().workers.list_workers(active_only=active_only)]


@router.post("/workers", status_code=201)
def create_worker(body: WorkerWrite) -> dict[str, Any]:
    refs = [{"activity_id": r.activity_id, "source": r.source} for r in body.activity_refs]
    try:
        worker = _svc().workers.create_worker(
            body.worker_name,
            refs,
            default_hourly_rate=body.default_hourly_rate,
            create_login=body.create_login,
            username=body.username,
            password=body.password,
            role_ids=list(body.role_ids or []),
            location_ids=_locs(body.location_ids),
            commission_enabled=body.commission_enabled,
            commission_profile=None,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    _publish(
        "PartyCreated",
        {"entity": "worker", "id": worker.id, "kind": "worker", "name": worker.worker_name},
    )
    return entity_dict(worker)


@router.get("/workers/{worker_id}")
def get_worker(worker_id: str) -> dict[str, Any]:
    worker = _svc().workers.get_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="worker not found")
    return entity_dict(worker)


@router.put("/workers/{worker_id}")
def update_worker(worker_id: str, body: WorkerWrite) -> dict[str, Any]:
    refs = [{"activity_id": r.activity_id, "source": r.source} for r in body.activity_refs]
    try:
        worker = _svc().workers.update_worker(
            worker_id,
            body.worker_name,
            refs,
            is_active=body.is_active,
            default_hourly_rate=body.default_hourly_rate,
            create_login=body.create_login,
            username=body.username,
            password=body.password,
            role_ids=list(body.role_ids or []),
            location_ids=_locs(body.location_ids),
            commission_enabled=body.commission_enabled,
            commission_profile=None,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(worker)


@router.post("/workers/{worker_id}/deactivate")
def deactivate_worker(worker_id: str) -> dict[str, Any]:
    try:
        worker = _svc().workers.deactivate_worker(worker_id)
    except Exception as exc:
        raise _http_err(exc) from exc
    _publish(
        "PartyInvalidated",
        {"entity": "worker", "id": worker_id, "kind": "worker", "reason": "deactivate"},
    )
    return entity_dict(worker)


# --- Segments ------------------------------------------------------------------


@router.get("/segments")
def list_segments(
    active_only: bool = False,
    applies_to: Optional[str] = None,
) -> list[dict[str, Any]]:
    if applies_to:
        rows = _svc().segments.list_for_party(applies_to, active_only=active_only or True)
    else:
        rows = _svc().segments.list_segments(active_only=active_only)
    return [entity_dict(r) for r in rows]


@router.post("/segments", status_code=201)
def create_segment(body: SegmentWrite) -> dict[str, Any]:
    try:
        segment = _svc().segments.create_segment(
            body.name, applies_to=body.applies_to, is_active=body.is_active
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(segment)


@router.get("/segments/{segment_id}")
def get_segment(segment_id: str) -> dict[str, Any]:
    segment = _svc().segments.get_segment(segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="segment not found")
    return entity_dict(segment)


@router.put("/segments/{segment_id}")
def update_segment(segment_id: str, body: SegmentWrite) -> dict[str, Any]:
    try:
        segment = _svc().segments.update_segment(
            segment_id,
            name=body.name,
            applies_to=body.applies_to,
            is_active=body.is_active,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(segment)


@router.delete("/segments/{segment_id}", status_code=204)
def delete_segment(segment_id: str) -> None:
    try:
        _svc().segments.delete_segment(segment_id)
    except Exception as exc:
        raise _http_err(exc) from exc


# --- Legacy shim for other stub modules that still expect generic /parties ------


class LegacyPartyCreate(BaseModel):
    name: str = Field(min_length=1)
    kind: str = "customer"
    tenant_id: str = "default"
    phone_number: str = "9876543210"


@router.post("", status_code=201)
def legacy_create_party(body: LegacyPartyCreate) -> dict[str, Any]:
    """Compat shim: map generic create onto typed customers/vendors."""
    kind = (body.kind or "customer").lower()
    phone = body.phone_number or "9876543210"
    if kind == "vendor":
        created = create_vendor(VendorWrite(vendor_name=body.name, phone_number=phone))
    else:
        created = create_customer(
            CustomerWrite(
                customer_name=body.name,
                phone_number=phone,
            )
        )
    return {
        "id": created["id"],
        "name": created.get("name") or body.name,
        "kind": kind,
        "tenant_id": body.tenant_id,
        "deleted": False,
    }


@router.get("")
def legacy_list_parties(kind: Optional[str] = None) -> list[dict[str, Any]]:
    kind_key = (kind or "").lower()
    if kind_key == "vendor":
        rows = list_vendors("")
        return [
            {"id": r["id"], "name": r.get("name"), "kind": "vendor", "deleted": False}
            for r in rows
        ]
    rows = list_customers("")
    return [
        {"id": r["id"], "name": r.get("name"), "kind": "customer", "deleted": False}
        for r in rows
    ]
