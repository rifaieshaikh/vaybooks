"""In-memory party + account repositories for API mode without Mongo."""

from __future__ import annotations

from copy import deepcopy
from typing import Dict, List, Optional

from vaybooks.bms.domain.finance.accounting.entities import Account, Voucher
from vaybooks.bms.domain.parties.commission_agents.entities import CommissionAgent
from vaybooks.bms.domain.parties.customers.entities import Customer
from vaybooks.bms.domain.parties.delivery_partners.entities import DeliveryPartner
from vaybooks.bms.domain.parties.segments.entities import PartySegment
from vaybooks.bms.domain.parties.vendors.entities import Vendor
from vaybooks.bms.domain.parties.workers.entities import Worker


class MemoryCustomerRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Customer] = {}

    def save(self, customer: Customer) -> Customer:
        self._store[customer.id] = deepcopy(customer)
        return deepcopy(customer)

    def find_by_id(self, customer_id: str) -> Optional[Customer]:
        c = self._store.get(customer_id)
        return deepcopy(c) if c else None

    def find_by_phone(self, phone: str) -> Optional[Customer]:
        phone = (phone or "").strip()
        if not phone:
            return None
        for c in self._store.values():
            if c.phone_number == phone:
                return deepcopy(c)
        return None

    def find_by_gstin(self, gstin: str) -> Optional[Customer]:
        gstin = (gstin or "").strip().upper()
        if not gstin:
            return None
        for c in self._store.values():
            if (c.gstin or "").strip().upper() == gstin:
                return deepcopy(c)
        return None

    def search(self, query: str, location_filter: dict | None = None) -> List[Customer]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if q:
            rows = [
                c
                for c in rows
                if q in (c.customer_name or "").lower()
                or q in (c.phone_number or "")
                or q in (c.gstin or "").lower()
            ]
        return [deepcopy(c) for c in rows]

    def list_all(self, location_filter: dict | None = None) -> List[Customer]:
        return [deepcopy(c) for c in self._store.values()]


class MemoryVendorRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Vendor] = {}

    def save(self, vendor: Vendor) -> Vendor:
        self._store[vendor.id] = deepcopy(vendor)
        return deepcopy(vendor)

    def find_by_id(self, vendor_id: str) -> Optional[Vendor]:
        v = self._store.get(vendor_id)
        return deepcopy(v) if v else None

    def find_by_phone(self, phone: str) -> Optional[Vendor]:
        phone = (phone or "").strip()
        if not phone:
            return None
        for v in self._store.values():
            if v.phone_number == phone:
                return deepcopy(v)
        return None

    def find_by_gstin(self, gstin: str) -> Optional[Vendor]:
        gstin = (gstin or "").strip().upper()
        if not gstin:
            return None
        for v in self._store.values():
            if (v.gstin or "").strip().upper() == gstin:
                return deepcopy(v)
        return None

    def search(self, query: str, location_filter: dict | None = None) -> List[Vendor]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if q:
            rows = [
                v
                for v in rows
                if q in (v.vendor_name or "").lower() or q in (v.phone_number or "")
            ]
        return [deepcopy(v) for v in rows]

    def list_all(self, location_filter: dict | None = None) -> List[Vendor]:
        return [deepcopy(v) for v in self._store.values()]


class MemoryDeliveryPartnerRepository:
    def __init__(self) -> None:
        self._store: Dict[str, DeliveryPartner] = {}

    def save(self, partner: DeliveryPartner) -> DeliveryPartner:
        self._store[partner.id] = deepcopy(partner)
        return deepcopy(partner)

    def find_by_id(self, partner_id: str) -> Optional[DeliveryPartner]:
        p = self._store.get(partner_id)
        return deepcopy(p) if p else None

    def find_by_phone(self, phone: str) -> Optional[DeliveryPartner]:
        phone = (phone or "").strip()
        if not phone:
            return None
        for p in self._store.values():
            if p.phone_number == phone:
                return deepcopy(p)
        return None

    def search(self, query: str, location_filter: dict | None = None) -> List[DeliveryPartner]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if q:
            rows = [
                p
                for p in rows
                if q in (p.partner_name or "").lower() or q in (p.phone_number or "")
            ]
        return [deepcopy(p) for p in rows]

    def list_all(self, location_filter: dict | None = None) -> List[DeliveryPartner]:
        return [deepcopy(p) for p in self._store.values()]

    def list_active(self, location_filter: dict | None = None) -> List[DeliveryPartner]:
        return [deepcopy(p) for p in self._store.values() if p.is_active]


class MemoryCommissionAgentRepository:
    def __init__(self) -> None:
        self._store: Dict[str, CommissionAgent] = {}

    def save(self, agent: CommissionAgent) -> CommissionAgent:
        self._store[agent.id] = deepcopy(agent)
        return deepcopy(agent)

    def find_by_id(self, agent_id: str) -> Optional[CommissionAgent]:
        a = self._store.get(agent_id)
        return deepcopy(a) if a else None

    def find_by_phone(self, phone: str) -> Optional[CommissionAgent]:
        phone = (phone or "").strip()
        if not phone:
            return None
        for a in self._store.values():
            if a.phone_number == phone:
                return deepcopy(a)
        return None

    def find_by_gstin(self, gstin: str) -> Optional[CommissionAgent]:
        return None

    def find_by_source_customer_id(self, customer_id: str) -> Optional[CommissionAgent]:
        for a in self._store.values():
            if a.source_customer_id == customer_id:
                return deepcopy(a)
        return None

    def search(self, query: str, location_filter: dict | None = None) -> List[CommissionAgent]:
        q = (query or "").strip().lower()
        rows = list(self._store.values())
        if q:
            rows = [
                a
                for a in rows
                if q in (a.agent_name or "").lower() or q in (a.phone_number or "")
            ]
        return [deepcopy(a) for a in rows]

    def list_all(self, location_filter: dict | None = None) -> List[CommissionAgent]:
        return [deepcopy(a) for a in self._store.values()]


class MemoryWorkerRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Worker] = {}

    def save(self, worker: Worker) -> Worker:
        self._store[worker.id] = deepcopy(worker)
        return deepcopy(worker)

    def find_by_id(self, worker_id: str) -> Optional[Worker]:
        w = self._store.get(worker_id)
        return deepcopy(w) if w else None

    def list_all(
        self, active_only: bool = True, *, location_filter: dict | None = None
    ) -> List[Worker]:
        rows = list(self._store.values())
        if active_only:
            rows = [w for w in rows if w.is_active]
        return [deepcopy(w) for w in rows]

    def list_by_activity(
        self,
        activity_id: str,
        source: str = "customization",
        active_only: bool = True,
    ) -> List[Worker]:
        rows = []
        for w in self._store.values():
            if active_only and not w.is_active:
                continue
            for ref in w.activity_refs:
                if ref.activity_id == activity_id and ref.source == source:
                    rows.append(w)
                    break
        return [deepcopy(w) for w in rows]

    def list_commission_enabled(
        self, active_only: bool = True, *, location_filter: dict | None = None
    ) -> List[Worker]:
        rows = [w for w in self._store.values() if w.commission_enabled]
        if active_only:
            rows = [w for w in rows if w.is_active]
        return [deepcopy(w) for w in rows]


class MemoryPartySegmentRepository:
    def __init__(self) -> None:
        self._store: Dict[str, PartySegment] = {}

    def save(self, segment: PartySegment) -> PartySegment:
        self._store[segment.id] = deepcopy(segment)
        return deepcopy(segment)

    def find_by_id(self, segment_id: str) -> Optional[PartySegment]:
        s = self._store.get(segment_id)
        return deepcopy(s) if s else None

    def find_by_name(self, name: str) -> Optional[PartySegment]:
        needle = (name or "").strip().lower()
        for s in self._store.values():
            if s.name.lower() == needle:
                return deepcopy(s)
        return None

    def list_all(self, active_only: bool = False) -> List[PartySegment]:
        rows = list(self._store.values())
        if active_only:
            rows = [s for s in rows if s.is_active]
        return [deepcopy(s) for s in rows]

    def delete(self, segment_id: str) -> None:
        self._store.pop(segment_id, None)


class MemoryAccountRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Account] = {}

    def save(self, account: Account) -> Account:
        self._store[account.id] = account
        return account

    def find_by_id(self, account_id: str) -> Optional[Account]:
        return self._store.get(account_id)

    def find_by_name(self, name: str) -> Optional[Account]:
        for a in self._store.values():
            if a.account_name == name:
                return a
        return None

    def find_customer_account(self, customer_id: str) -> Optional[Account]:
        for a in self._store.values():
            if a.linked_customer_id == customer_id:
                return a
        return None

    def find_vendor_account(self, vendor_id: str) -> Optional[Account]:
        for a in self._store.values():
            if a.linked_vendor_id == vendor_id:
                return a
        return None

    def find_worker_account(self, worker_id: str) -> Optional[Account]:
        for a in self._store.values():
            if a.linked_worker_id == worker_id:
                return a
        return None

    def find_agent_account(self, agent_id: str) -> Optional[Account]:
        for a in self._store.values():
            if a.linked_agent_id == agent_id:
                return a
        return None

    def find_delivery_partner_account(self, partner_id: str) -> Optional[Account]:
        for a in self._store.values():
            if getattr(a, "linked_delivery_partner_id", None) == partner_id:
                return a
        return None

    def customer_balances_by_customer(self) -> dict:
        return {
            str(a.linked_customer_id): a.current_balance
            for a in self._store.values()
            if a.linked_customer_id
        }

    def list_all(self, active_only: bool = True) -> List[Account]:
        return list(self._store.values())

    def update_balance(self, account_id: str, debit: float, credit: float) -> None:
        acc = self._store[account_id]
        acc.current_balance += debit - credit

    def delete(self, account_id: str) -> None:
        self._store.pop(account_id, None)


class MemoryVoucherRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Voucher] = {}

    def save(self, voucher: Voucher) -> Voucher:
        self._store[voucher.id] = voucher
        return voucher

    def find_by_id(self, voucher_id: str) -> Optional[Voucher]:
        return self._store.get(voucher_id)

    def find_by_number(self, voucher_number: str) -> Optional[Voucher]:
        for v in self._store.values():
            if v.voucher_number == voucher_number:
                return v
        return None

    def list_by_account(
        self, account_id: str, location_filter: dict | None = None
    ) -> List[Voucher]:
        return [
            v
            for v in self._store.values()
            if any(line.account_id == account_id for line in v.lines)
        ]

    def list_all(self, location_filter: dict | None = None) -> List[Voucher]:
        return list(self._store.values())

    def list_by_type(
        self,
        voucher_type,
        *,
        location_filter: dict | None = None,
        extra_filter: dict | None = None,
    ) -> List[Voucher]:
        _ = location_filter, extra_filter
        vt = voucher_type.value if hasattr(voucher_type, "value") else str(voucher_type)
        return [
            v
            for v in self._store.values()
            if (v.voucher_type.value if hasattr(v.voucher_type, "value") else str(v.voucher_type))
            == vt
        ]

    def list_by_types(
        self,
        voucher_types,
        *,
        location_filter: dict | None = None,
        extra_filter: dict | None = None,
    ) -> List[Voucher]:
        _ = location_filter, extra_filter
        allowed = {
            vt.value if hasattr(vt, "value") else str(vt) for vt in voucher_types
        }
        return [
            v
            for v in self._store.values()
            if (v.voucher_type.value if hasattr(v.voucher_type, "value") else str(v.voucher_type))
            in allowed
        ]

    def delete(self, voucher_id: str) -> None:
        self._store.pop(voucher_id, None)


class MemoryCounterRepository:
    def __init__(self) -> None:
        self._counters: Dict[str, int] = {"voucher_number": 0}
        self._prefixes: Dict[str, str] = {"voucher_number": "VCH"}

    def next(self, counter_name: str) -> str:
        self._counters[counter_name] = self._counters.get(counter_name, 0) + 1
        prefix = self._prefixes.get(counter_name, counter_name.upper()[:3])
        return f"{prefix}-{self._counters[counter_name]:04d}"

    def peek(self, counter_name: str) -> str:
        prefix = self._prefixes.get(counter_name, counter_name.upper()[:3])
        return f"{prefix}-{self._counters.get(counter_name, 0) + 1:04d}"

    def ensure_and_next(self, counter_name: str) -> int:
        self._counters[counter_name] = self._counters.get(counter_name, 0) + 1
        return int(self._counters[counter_name])

    def peek_next_value(self, counter_name: str) -> int:
        return int(self._counters.get(counter_name, 0)) + 1
