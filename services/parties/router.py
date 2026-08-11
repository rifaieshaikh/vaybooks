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
    CustomerRefundBody,
    CustomerWrite,
    DeliveryPartnerWrite,
    SalaryCalculateBody,
    SalaryPayBody,
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
    """Normalize location ids; never invent a ``default`` id.

    Empty lists stay empty so domain ``require_location_ids`` rejects them
    (pytest soft-default applies only inside the domain helper).
    """
    seen: set[str] = set()
    out: List[str] = []
    for raw in location_ids or []:
        lid = str(raw or "").strip()
        if not lid or lid == "default" or lid in seen:
            continue
        seen.add(lid)
        out.append(lid)
    return out


def _party_location_filter(
    location_id: Optional[str] = None,
    location_ids: Optional[str] = None,
) -> dict[str, Any] | None:
    """Build Mongo filter for party ``location_ids`` visibility."""
    ids: List[str] = []
    for part in str(location_ids or "").split(","):
        lid = part.strip()
        if lid and lid not in ids:
            ids.append(lid)
    single = str(location_id or "").strip()
    if single and single not in ids:
        ids.insert(0, single)
    if not ids:
        return None
    if len(ids) == 1:
        return {"location_ids": ids[0]}
    return {"location_ids": {"$in": ids}}


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
    location_id: Optional[str] = Query(default=None),
    location_ids: Optional[str] = Query(default=None),
    _: str = Depends(require_permission("parties.customers.view")),
) -> list[dict[str, Any]]:
    location_filter = _party_location_filter(location_id, location_ids)
    rows = _svc().customers.search_customers(q, location_filter=location_filter)
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


@router.get("/customers/lookup")
def lookup_customer_by_phone(
    phone: str = Query(default=""),
    _: str = Depends(require_permission("parties.customers.view")),
) -> dict[str, Any]:
    customer = _svc().customers.lookup_customer_by_phone(phone)
    if not customer:
        raise HTTPException(status_code=404, detail="customer not found")
    return entity_dict(customer)


@router.get("/customers/identity-policy")
def customer_identity_policy(
    _: str = Depends(require_permission("parties.customers.view")),
) -> dict[str, bool]:
    require_name, require_phone = _svc().customers.identity_policy()
    return {"require_name": bool(require_name), "require_phone": bool(require_phone)}


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


@router.post("/customers/{customer_id}/refund")
def refund_customer(
    customer_id: str,
    body: CustomerRefundBody,
    _: str = Depends(require_permission("finance.payments.create")),
) -> dict[str, Any]:
    acct = _svc().account_repo.find_customer_account(customer_id)
    if not acct:
        raise HTTPException(status_code=404, detail="customer account not found")
    try:
        voucher = _svc().accounting.create_refund(
            customer_account_id=acct.id,
            store_account_id=body.store_account_id,
            amount=body.amount,
            description=body.description or "Customer refund",
            voucher_date=body.voucher_date,
            refund_type="payment",
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return {"ok": True, "voucher_id": voucher.id}


# --- Vendors -------------------------------------------------------------------


@router.get("/vendors")
def list_vendors(
    q: str = Query(default=""),
    location_id: Optional[str] = Query(default=None),
    location_ids: Optional[str] = Query(default=None),
) -> list[dict[str, Any]]:
    location_filter = _party_location_filter(location_id, location_ids)
    out = []
    for r in _svc().vendors.search_vendors(q, location_filter=location_filter):
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
def list_partners(
    q: str = Query(default=""),
    location_id: Optional[str] = Query(default=None),
    location_ids: Optional[str] = Query(default=None),
) -> list[dict[str, Any]]:
    location_filter = _party_location_filter(location_id, location_ids)
    out = []
    for r in _svc().delivery_partners.search_partners(q, location_filter=location_filter):
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
def list_agents(
    q: str = Query(default=""),
    location_id: Optional[str] = Query(default=None),
    location_ids: Optional[str] = Query(default=None),
) -> list[dict[str, Any]]:
    location_filter = _party_location_filter(location_id, location_ids)
    out = []
    for r in _svc().commission_agents.search_agents(q, location_filter=location_filter):
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


def _activity_options_service():
    """Compose module-aware catalogs for the employee activity picker."""
    from packages.services_kit.access_container import get_access_container
    from packages.services_kit.boutique_container import get_boutique_container
    from packages.services_kit.business_container import get_business_container
    from packages.services_kit.production_container import get_production_container
    from packages.services_kit.projects_container import get_projects_container
    from packages.services_kit.store_container import get_store_container
    from vaybooks.bms.application.parties.workers.activity_options import (
        EmployeeActivityOptionsService,
    )

    plans = get_access_container().plans
    store = get_store_container().activities
    boutique = None
    projects = None
    business = None
    production = None
    try:
        boutique = get_boutique_container().activities
    except Exception:
        boutique = None
    try:
        projects = get_projects_container().activity_configs
    except Exception:
        projects = None
    try:
        business = get_business_container().activities
    except Exception:
        business = None
    try:
        production = get_production_container().activities
    except Exception:
        production = None
    return EmployeeActivityOptionsService(
        plans,
        store,
        boutique,
        projects,
        business_activity_service=business,
        production_activity_service=production,
    )


def _worker_refs_payload(body: WorkerWrite, existing=None) -> list[dict[str, str]]:
    if body.activity_refs is None:
        if existing is None:
            return []
        return [
            {"activity_id": ref.activity_id, "source": ref.source}
            for ref in (getattr(existing, "activity_refs", None) or [])
        ]
    return [
        {"activity_id": r.activity_id, "source": r.source} for r in body.activity_refs
    ]


@router.get("/worker-activity-options")
def list_worker_activity_options(active_only: bool = True) -> list[dict[str, Any]]:
    try:
        options = _activity_options_service().list_options(active_only=active_only)
    except Exception as exc:
        raise _http_err(exc) from exc
    return [
        {
            "activity_id": o.activity_id,
            "activity_name": o.activity_name,
            "source": o.source,
            "label": o.label,
            "key": o.key,
            "is_active": o.is_active,
        }
        for o in options
    ]


@router.get("/workers")
def list_workers(
    active_only: bool = True,
    location_id: Optional[str] = Query(default=None),
    location_ids: Optional[str] = Query(default=None),
) -> list[dict[str, Any]]:
    location_filter = _party_location_filter(location_id, location_ids)
    return [
        entity_dict(r)
        for r in _svc().workers.list_workers(
            active_only=active_only, location_filter=location_filter
        )
    ]


@router.post("/workers", status_code=201)
def create_worker(body: WorkerWrite) -> dict[str, Any]:
    refs = _worker_refs_payload(body, existing=None)
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
            base_salary=body.base_salary,
            allowances=list(body.allowances or []),
            ot_threshold_hours=body.ot_threshold_hours,
            ot_multiplier=body.ot_multiplier,
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
    existing = _svc().workers.get_worker(worker_id)
    if not existing:
        raise HTTPException(status_code=404, detail="worker not found")
    refs = _worker_refs_payload(body, existing=existing)
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
            base_salary=body.base_salary,
            allowances=list(body.allowances or []),
            ot_threshold_hours=body.ot_threshold_hours,
            ot_multiplier=body.ot_multiplier,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(worker)


def _parse_iso_date(value: str):
    from datetime import date

    text = str(value or "").strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _attributed_hours(worker_id: str, period_from, period_to) -> float:
    """Sum completed labour minutes attributed to worker across modules."""
    import logging

    logger = logging.getLogger(__name__)
    minutes = 0

    def _in_range(work_date) -> bool:
        if work_date is None:
            return False
        d = work_date.date() if hasattr(work_date, "date") else work_date
        return period_from <= d <= period_to

    def _add_timed_entry(entry, id_attrs: tuple[str, ...]) -> None:
        nonlocal minutes
        if not _in_range(getattr(entry, "work_date", None)):
            return
        start = (getattr(entry, "start_time", "") or "").strip()
        end = (getattr(entry, "end_time", "") or "").strip()
        if not start or not end:
            return
        matched = False
        for attr in id_attrs:
            if str(getattr(entry, attr, "") or "") == worker_id:
                matched = True
                break
        if not matched:
            return
        minutes += int(getattr(entry, "duration_minutes", 0) or 0)

    try:
        from packages.services_kit.boutique_container import get_boutique_container

        for entry in get_boutique_container().time_tracking.list_all():
            _add_timed_entry(entry, ("assignee_worker_id", "worker_id"))
    except Exception as exc:
        logger.warning("salary hours: boutique time unavailable: %s", exc)

    try:
        from packages.services_kit.store_container import get_store_container

        for entry in get_store_container().time_tracking.list_all():
            _add_timed_entry(entry, ("worker_id",))
    except Exception as exc:
        logger.warning("salary hours: store time unavailable: %s", exc)

    try:
        from packages.services_kit.business_container import get_business_container

        for entry in get_business_container().time_tracking.list_all():
            _add_timed_entry(entry, ("worker_id",))
    except Exception as exc:
        logger.warning("salary hours: business time unavailable: %s", exc)

    try:
        from packages.services_kit.projects_container import get_projects_container

        for entry in get_projects_container().time.list_by_worker(worker_id):
            if not _in_range(getattr(entry, "work_date", None)):
                continue
            minutes += int(getattr(entry, "duration_minutes", 0) or 0)
    except Exception as exc:
        logger.warning("salary hours: project time unavailable: %s", exc)

    return round(minutes / 60.0, 2)


@router.post("/workers/{worker_id}/salary/calculate")
def calculate_worker_salary(worker_id: str, body: SalaryCalculateBody) -> dict[str, Any]:
    from vaybooks.bms.application.parties.workers.payroll import (
        calculate_salary,
        preview_to_dict,
    )

    worker = _svc().workers.get_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="worker not found")
    period_from = _parse_iso_date(body.period_from)
    period_to = _parse_iso_date(body.period_to)
    hours = _attributed_hours(worker_id, period_from, period_to)
    try:
        preview = calculate_salary(worker, period_from, period_to, hours)
    except Exception as exc:
        raise _http_err(exc) from exc
    return preview_to_dict(preview)


@router.post("/workers/{worker_id}/salary/pay")
def pay_worker_salary(worker_id: str, body: SalaryPayBody) -> dict[str, Any]:
    from vaybooks.bms.application.parties.workers.payroll import calculate_salary

    worker = _svc().workers.get_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="worker not found")
    period_from = _parse_iso_date(body.period_from)
    period_to = _parse_iso_date(body.period_to)
    hours = _attributed_hours(worker_id, period_from, period_to)
    try:
        preview = calculate_salary(worker, period_from, period_to, hours)
    except Exception as exc:
        raise _http_err(exc) from exc

    amount = float(body.amount) if body.amount is not None else float(preview.total)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Salary amount must be positive")

    salary_acct = _svc().account_repo.find_worker_account(worker_id)
    if not salary_acct:
        raise HTTPException(status_code=400, detail="Worker salary account not found")

    voucher_date = _parse_iso_date(body.voucher_date) if body.voucher_date else None
    description = (
        body.description
        or f"Salary {worker.worker_name} {period_from.isoformat()}–{period_to.isoformat()}"
    )
    try:
        voucher = _svc().accounting.create_salary_payment(
            salary_account_id=salary_acct.id,
            paying_account_id=body.paying_account_id,
            amount=amount,
            description=description,
            voucher_date=voucher_date,
            include_commission=body.include_commission,
            commission_amount=body.commission_amount,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return {
        "voucher": entity_dict(voucher),
        "preview": {
            "total": preview.total,
            "attributed_hours": preview.attributed_hours,
            "lines": [
                {"code": l.code, "label": l.label, "amount": l.amount}
                for l in preview.lines
            ],
        },
    }


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
