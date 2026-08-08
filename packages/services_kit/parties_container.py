"""Non-Streamlit parties service container (Mongo or in-memory)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["PartiesContainer"] = None


@dataclass
class PartiesContainer:
    backend: str  # "mongo" | "memory"
    customers: Any
    vendors: Any
    delivery_partners: Any
    commission_agents: Any
    workers: Any
    segments: Any
    accounting: Any
    account_repo: Any


def _mongo_uri() -> str:
    from packages.services_kit.mongo_env import mongo_uri

    return mongo_uri()


def _db_name() -> str:
    from packages.services_kit.mongo_env import mongo_db_name

    return mongo_db_name()


def _build_memory() -> PartiesContainer:
    from packages.services_kit.memory_parties import (
        MemoryAccountRepository,
        MemoryCommissionAgentRepository,
        MemoryCounterRepository,
        MemoryCustomerRepository,
        MemoryDeliveryPartnerRepository,
        MemoryPartySegmentRepository,
        MemoryVendorRepository,
        MemoryVoucherRepository,
        MemoryWorkerRepository,
    )
    from vaybooks.bms.application.finance.accounting.service import AccountingAppService
    from vaybooks.bms.application.parties.commission_agents.service import (
        CommissionAgentAppService,
    )
    from vaybooks.bms.application.parties.customers.service import CustomerAppService
    from vaybooks.bms.application.parties.delivery_partners.service import (
        DeliveryPartnerAppService,
    )
    from vaybooks.bms.application.parties.segments.service import PartySegmentAppService
    from vaybooks.bms.application.parties.vendors.service import VendorAppService
    from vaybooks.bms.application.parties.workers.service import WorkerAppService

    account_repo = MemoryAccountRepository()
    voucher_repo = MemoryVoucherRepository()
    counter_repo = MemoryCounterRepository()
    segment_repo = MemoryPartySegmentRepository()
    segments = PartySegmentAppService(segment_repo)
    agents = CommissionAgentAppService(
        MemoryCommissionAgentRepository(), account_repo, segment_service=segments
    )
    customers = CustomerAppService(
        MemoryCustomerRepository(),
        account_repo,
        segment_service=segments,
        commission_agent_service=agents,
    )
    vendors = VendorAppService(
        MemoryVendorRepository(), account_repo, segment_service=segments
    )
    partners = DeliveryPartnerAppService(MemoryDeliveryPartnerRepository(), account_repo)
    workers = WorkerAppService(MemoryWorkerRepository(), account_repo, user_service=None)
    accounting = AccountingAppService(account_repo, voucher_repo, counter_repo)
    return PartiesContainer(
        backend="memory",
        customers=customers,
        vendors=vendors,
        delivery_partners=partners,
        commission_agents=agents,
        workers=workers,
        segments=segments,
        accounting=accounting,
        account_repo=account_repo,
    )


def _build_mongo(uri: str) -> PartiesContainer:
    from pymongo import MongoClient

    from vaybooks.bms.application.finance.accounting.service import AccountingAppService
    from vaybooks.bms.application.parties.commission_agents.service import (
        CommissionAgentAppService,
    )
    from vaybooks.bms.application.parties.customers.service import CustomerAppService
    from vaybooks.bms.application.parties.delivery_partners.service import (
        DeliveryPartnerAppService,
    )
    from vaybooks.bms.application.parties.segments.service import PartySegmentAppService
    from vaybooks.bms.application.parties.vendors.service import VendorAppService
    from vaybooks.bms.application.parties.workers.service import WorkerAppService
    from vaybooks.bms.application.settings.business.service import BusinessAppService
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
    from vaybooks.bms.infrastructure.repositories.parties.mongo_customer_repository import (
        MongoCustomerRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_delivery_partner_repository import (
        MongoDeliveryPartnerRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_party_segment_repository import (
        MongoPartySegmentRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_vendor_repository import (
        MongoVendorRepository,
    )
    from vaybooks.bms.infrastructure.repositories.parties.mongo_worker_repository import (
        MongoWorkerRepository,
    )
    from vaybooks.bms.infrastructure.repositories.shared.mongo_business_profile_repository import (
        MongoBusinessProfileRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    account_repo = MongoAccountRepository(db)
    voucher_repo = MongoVoucherRepository(db)
    counter_repo = MongoCounterRepository(db)
    segments = PartySegmentAppService(MongoPartySegmentRepository(db))
    business = BusinessAppService(MongoBusinessProfileRepository(db))
    agents = CommissionAgentAppService(
        MongoCommissionAgentRepository(db), account_repo, segment_service=segments
    )
    customers = CustomerAppService(
        MongoCustomerRepository(db),
        account_repo,
        segment_service=segments,
        business_service=business,
        commission_agent_service=agents,
    )
    vendors = VendorAppService(
        MongoVendorRepository(db), account_repo, segment_service=segments
    )
    partners = DeliveryPartnerAppService(MongoDeliveryPartnerRepository(db), account_repo)
    workers = WorkerAppService(MongoWorkerRepository(db), account_repo, user_service=None)
    accounting = AccountingAppService(account_repo, voucher_repo, counter_repo)
    accounting.set_business_service(business)
    return PartiesContainer(
        backend="mongo",
        customers=customers,
        vendors=vendors,
        delivery_partners=partners,
        commission_agents=agents,
        workers=workers,
        segments=segments,
        accounting=accounting,
        account_repo=account_repo,
    )


def build_parties_container() -> PartiesContainer:
    if (os.environ.get("PARTIES_BACKEND") or "").strip().lower() == "memory":
        logger.info("Parties container forced to in-memory backend")
        return _build_memory()
    uri = _mongo_uri()
    if uri:
        try:
            container = _build_mongo(uri)
            logger.info("Parties container using Mongo backend db=%s", _db_name())
            return container
        except Exception as exc:
            logger.warning("Mongo parties backend unavailable (%s); using memory", exc)
    logger.info("Parties container using in-memory backend")
    return _build_memory()


def get_parties_container() -> PartiesContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_parties_container()
    return _CONTAINER


def set_parties_container(container: PartiesContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_parties_container() -> PartiesContainer:
    """Rebuild container (used by tests)."""
    set_parties_container(None)
    return get_parties_container()
