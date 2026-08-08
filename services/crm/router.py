"""CRM leads, enquiries, and activities API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish

router = APIRouter(prefix="/api/crm", tags=["crm"])
_LEADS = MemoryStore()
_ENQUIRIES = MemoryStore()
_ACTIVITIES = MemoryStore()


class LeadCreate(BaseModel):
    name: str = Field(min_length=1)
    source: str = "manual"
    status: str = "new"
    party_id: str | None = None
    tenant_id: str = "default"


class EnquiryCreate(BaseModel):
    lead_id: str | None = None
    subject: str = Field(min_length=1)
    status: str = "open"
    tenant_id: str = "default"


class ActivityCreate(BaseModel):
    lead_id: str | None = None
    enquiry_id: str | None = None
    kind: str = "call"
    notes: str = ""
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "crm", "status": "ok"}


@router.get("/leads")
def list_leads(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _LEADS.list(include_deleted=include_deleted)


@router.post("/leads", status_code=201)
def create_lead(body: LeadCreate) -> dict[str, Any]:
    row = _LEADS.create(body.model_dump())
    publish("CrmLeadCreated", {"lead_id": row["id"], "name": body.name, "status": body.status})
    return row


@router.get("/leads/{lead_id}")
def get_lead(lead_id: str) -> dict[str, Any]:
    return _LEADS.get(lead_id)


@router.patch("/leads/{lead_id}")
def update_lead(lead_id: str, body: LeadCreate) -> dict[str, Any]:
    return _LEADS.update(lead_id, body.model_dump())


@router.delete("/leads/{lead_id}")
def delete_lead(lead_id: str) -> dict[str, Any]:
    return _LEADS.soft_delete(lead_id)


@router.get("/enquiries")
def list_enquiries(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ENQUIRIES.list(include_deleted=include_deleted)


@router.post("/enquiries", status_code=201)
def create_enquiry(body: EnquiryCreate) -> dict[str, Any]:
    if body.lead_id:
        _LEADS.get(body.lead_id)
    return _ENQUIRIES.create(body.model_dump())


@router.get("/enquiries/{enquiry_id}")
def get_enquiry(enquiry_id: str) -> dict[str, Any]:
    return _ENQUIRIES.get(enquiry_id)


@router.get("/activities")
def list_activities(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ACTIVITIES.list(include_deleted=include_deleted)


@router.post("/activities", status_code=201)
def create_activity(body: ActivityCreate) -> dict[str, Any]:
    row = _ACTIVITIES.create(body.model_dump())
    publish(
        "CrmActivityLogged",
        {
            "activity_id": row["id"],
            "lead_id": body.lead_id,
            "enquiry_id": body.enquiry_id,
            "kind": body.kind,
        },
    )
    return row
