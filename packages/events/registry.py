"""Canonical domain event registry for VayBooks integration events.

Versioning policy
-----------------
* Additive payload fields are backward-compatible; consumers must ignore
  unknown fields.
* Bump ``version`` when removing or renaming fields, changing field types,
  or altering semantics in a breaking way.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List

__all__ = [
    "EventSpec",
    "EVENT_REGISTRY",
    "get_event",
    "list_events",
    "validate_event_name",
]


@dataclass(frozen=True, slots=True)
class EventSpec:
    """Metadata for a registered domain/integration event."""

    name: str
    version: int
    description: str


EVENT_REGISTRY: Dict[str, EventSpec] = {
    "PartyCreated": EventSpec(
        name="PartyCreated",
        version=1,
        description="A party (customer, vendor, etc.) was created.",
    ),
    "PartyInvalidated": EventSpec(
        name="PartyInvalidated",
        version=1,
        description="A party was marked invalid or deactivated.",
    ),
    "SalesInvoicePosted": EventSpec(
        name="SalesInvoicePosted",
        version=1,
        description="A sales invoice was posted to the ledger.",
    ),
    "StockReserveRequested": EventSpec(
        name="StockReserveRequested",
        version=1,
        description="Inventory reservation was requested for a document line.",
    ),
    "StockReserveConfirmed": EventSpec(
        name="StockReserveConfirmed",
        version=1,
        description="Inventory reservation succeeded.",
    ),
    "StockReserveFailed": EventSpec(
        name="StockReserveFailed",
        version=1,
        description="Inventory reservation failed.",
    ),
    "FinancePostingRequested": EventSpec(
        name="FinancePostingRequested",
        version=1,
        description="A finance posting (voucher/journal) was requested.",
    ),
    "FinancePostingConfirmed": EventSpec(
        name="FinancePostingConfirmed",
        version=1,
        description="Finance posting succeeded.",
    ),
    "FinancePostingFailed": EventSpec(
        name="FinancePostingFailed",
        version=1,
        description="Finance posting failed.",
    ),
    "PurchaseOrderCreated": EventSpec(
        name="PurchaseOrderCreated",
        version=1,
        description="A purchase order was created.",
    ),
    "PurchaseBillPosted": EventSpec(
        name="PurchaseBillPosted",
        version=1,
        description="A purchase bill was posted.",
    ),
    "BoutiqueOrderCreated": EventSpec(
        name="BoutiqueOrderCreated",
        version=1,
        description="A boutique customization order was created.",
    ),
    "StoreTimeLogged": EventSpec(
        name="StoreTimeLogged",
        version=1,
        description="A store time entry was recorded.",
    ),
    "CrmLeadCreated": EventSpec(
        name="CrmLeadCreated",
        version=1,
        description="A CRM lead was created.",
    ),
    "CrmActivityLogged": EventSpec(
        name="CrmActivityLogged",
        version=1,
        description="A CRM activity was logged.",
    ),
    "SchedulerJobQueued": EventSpec(
        name="SchedulerJobQueued",
        version=1,
        description="A scheduled job was queued.",
    ),
    "ProjectCreated": EventSpec(
        name="ProjectCreated",
        version=1,
        description="A project was created.",
    ),
    "ProductionBatchStarted": EventSpec(
        name="ProductionBatchStarted",
        version=1,
        description="A production batch was started.",
    ),
    "MigrationBatchQueued": EventSpec(
        name="MigrationBatchQueued",
        version=1,
        description="A data migration batch was queued.",
    ),
    "SystemSettingChanged": EventSpec(
        name="SystemSettingChanged",
        version=1,
        description="A system setting was changed.",
    ),
}


def get_event(name: str) -> EventSpec:
    """Return the event spec for *name*, raising ``KeyError`` if unknown."""
    key = (name or "").strip()
    if key not in EVENT_REGISTRY:
        raise KeyError(f"Unknown event: {name!r}")
    return EVENT_REGISTRY[key]


def list_events() -> List[EventSpec]:
    """Return all registered events sorted by name."""
    return [EVENT_REGISTRY[k] for k in sorted(EVENT_REGISTRY)]


def validate_event_name(name: str) -> bool:
    """Return True if *name* is a registered event."""
    return (name or "").strip() in EVENT_REGISTRY
