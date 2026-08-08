"""CRM API — leads, enquiries, activities, dashboard, calendar, reports, settings (Mongo)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit.crm_container import get_crm_container
from packages.services_kit import publish
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/crm", tags=["crm"])


class LeadCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = ""
    contact_person: str = ""
    alternate_phone: str = ""
    email: str = ""
    address_line1: str = ""
    source: str = ""
    interested_products: str = ""
    estimated_value: float = 0.0
    priority: str = "Medium"
    status: str = "New"
    notes: str = ""
    location_id: str = ""
    location_name: str = ""
    branch: str = ""
    allow_duplicate: bool = False


class LeadPatch(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    interested_products: Optional[str] = None
    estimated_value: Optional[float] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    location_id: Optional[str] = None
    assigned_user_id: Optional[str] = None
    assigned_user_name: Optional[str] = None


class EnquiryCreate(BaseModel):
    lead_id: str = ""
    customer_id: str = ""
    party_name: str = ""
    source: str = ""
    product_interest: str = ""
    description: str = ""
    expected_quantity: float = 0.0
    estimated_value: float = 0.0
    priority: str = "Medium"
    notes: str = ""
    branch: str = ""


class EnquiryPatch(BaseModel):
    party_name: Optional[str] = None
    source: Optional[str] = None
    product_interest: Optional[str] = None
    description: Optional[str] = None
    expected_quantity: Optional[float] = None
    estimated_value: Optional[float] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[str] = None
    assigned_user_name: Optional[str] = None


class ActivityCreate(BaseModel):
    activity_type: str = Field(min_length=1)
    lead_id: str = ""
    enquiry_id: str = ""
    customer_id: str = ""
    party_name: str = ""
    notes: str = ""
    outcome: str = ""
    location_id: str = ""
    location_name: str = ""
    scheduled_at: Optional[str] = None
    priority: str = "Medium"
    status: str = "Scheduled"


class ActivityPatch(BaseModel):
    notes: Optional[str] = None
    outcome: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    scheduled_at: Optional[str] = None
    next_action: Optional[str] = None


class RescheduleBody(BaseModel):
    scheduled_at: str = Field(min_length=1)
    reason: str = ""


class SettingsPatch(BaseModel):
    default_inactivity_days: Optional[int] = None
    default_follow_up_days: Optional[int] = None
    business_display_name: Optional[str] = None
    order_trigger_status: Optional[str] = None
    payment_trigger: Optional[str] = None


class ReportRunBody(BaseModel):
    report_id: str = Field(min_length=1)
    filters: dict[str, Any] = Field(default_factory=dict)


def _c():
    return get_crm_container()


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}") from exc


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "crm", "status": "ok", "backend": _c().backend}


@router.get("/overview")
def overview() -> dict[str, Any]:
    try:
        snap = _c().dashboard.snapshot()
        data = entity_dict(snap)
        data["quick_actions"] = [
            {"to": "/crm/leads", "label": "Leads"},
            {"to": "/crm/enquiries", "label": "Enquiries"},
            {"to": "/crm/activities", "label": "Activities"},
            {"to": "/crm/calendar", "label": "Calendar"},
            {"to": "/crm/reports", "label": "Reports"},
        ]
        return data
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/leads")
def list_leads(
    *,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 500,
) -> list[dict[str, Any]]:
    try:
        rows = _c().leads.list_leads(status=status, search=search or "", limit=limit)
        return [entity_dict(r) for r in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads", status_code=201)
def create_lead(body: LeadCreate) -> dict[str, Any]:
    try:
        lead = _c().leads.create_lead(
            name=body.name,
            phone=body.phone,
            contact_person=body.contact_person,
            alternate_phone=body.alternate_phone,
            email=body.email,
            address_line1=body.address_line1,
            source=body.source,
            interested_products=body.interested_products,
            estimated_value=body.estimated_value,
            priority=body.priority,
            status=body.status,
            notes=body.notes,
            location_id=body.location_id,
            location_name=body.location_name,
            branch=body.branch,
            allow_duplicate=body.allow_duplicate,
        )
        publish("CrmLeadCreated", {"lead_id": lead.id, "name": lead.name, "status": lead.status})
        return entity_dict(lead)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/leads/{lead_id}")
def get_lead(lead_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().leads.get_lead(lead_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/leads/{lead_id}")
def update_lead(lead_id: str, body: LeadPatch) -> dict[str, Any]:
    try:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        return entity_dict(_c().leads.update_lead(lead_id, **fields))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/leads/{lead_id}")
def delete_lead(lead_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().leads.soft_delete_lead(lead_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/enquiries")
def list_enquiries(*, status: Optional[str] = None, limit: int = 500) -> list[dict[str, Any]]:
    try:
        try:
            rows = _c().enquiries.list_enquiries(status=status, limit=limit)
        except TypeError:
            rows = _c().enquiries.list_enquiries(limit=limit)
        return [entity_dict(r) for r in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/enquiries", status_code=201)
def create_enquiry(body: EnquiryCreate) -> dict[str, Any]:
    try:
        enquiry = _c().enquiries.create_enquiry(
            lead_id=body.lead_id,
            customer_id=body.customer_id,
            party_name=body.party_name,
            source=body.source,
            product_interest=body.product_interest,
            description=body.description,
            expected_quantity=body.expected_quantity,
            estimated_value=body.estimated_value,
            priority=body.priority,
            notes=body.notes,
            branch=body.branch,
        )
        return entity_dict(enquiry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/enquiries/{enquiry_id}")
def get_enquiry(enquiry_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().enquiries.get_enquiry(enquiry_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/enquiries/{enquiry_id}")
def update_enquiry(enquiry_id: str, body: EnquiryPatch) -> dict[str, Any]:
    try:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        return entity_dict(_c().enquiries.update_enquiry(enquiry_id, **fields))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/activities")
def list_activities(
    *,
    lead_id: Optional[str] = None,
    enquiry_id: Optional[str] = None,
    limit: int = 500,
) -> list[dict[str, Any]]:
    try:
        kwargs: dict[str, Any] = {"limit": limit}
        if lead_id:
            kwargs["lead_id"] = lead_id
        if enquiry_id:
            kwargs["enquiry_id"] = enquiry_id
        rows = _c().activities.list_activities(**kwargs)
        return [entity_dict(r) for r in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities", status_code=201)
def create_activity(body: ActivityCreate) -> dict[str, Any]:
    try:
        activity = _c().activities.create_manual(
            activity_type=body.activity_type,
            lead_id=body.lead_id,
            enquiry_id=body.enquiry_id,
            customer_id=body.customer_id,
            party_name=body.party_name,
            notes=body.notes,
            outcome=body.outcome,
            location_id=body.location_id,
            location_name=body.location_name,
            scheduled_at=_parse_dt(body.scheduled_at),
            priority=body.priority,
            status=body.status,
        )
        publish(
            "CrmActivityLogged",
            {
                "activity_id": activity.id,
                "lead_id": body.lead_id or None,
                "enquiry_id": body.enquiry_id or None,
                "kind": body.activity_type,
            },
        )
        return entity_dict(activity)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/activities/{activity_id}")
def get_activity(activity_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().activities.get_activity(activity_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/activities/{activity_id}")
def update_activity(activity_id: str, body: ActivityPatch) -> dict[str, Any]:
    try:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        if "scheduled_at" in fields:
            fields["scheduled_at"] = _parse_dt(fields["scheduled_at"])
        return entity_dict(_c().activities.update_activity(activity_id, **fields))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities/{activity_id}/reschedule")
def reschedule_activity(activity_id: str, body: RescheduleBody) -> dict[str, Any]:
    try:
        when = _parse_dt(body.scheduled_at)
        if when is None:
            raise ValidationError("scheduled_at is required")
        return entity_dict(
            _c().activities.reschedule(activity_id, when, reason=body.reason or "")
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/calendar")
def calendar(
    *,
    scheduled_from: Optional[str] = None,
    scheduled_to: Optional[str] = None,
    limit: int = 2000,
) -> list[dict[str, Any]]:
    try:
        kwargs: dict[str, Any] = {"limit": limit}
        start = _parse_dt(scheduled_from)
        end = _parse_dt(scheduled_to)
        if start is not None:
            kwargs["scheduled_from"] = start
        if end is not None:
            kwargs["scheduled_to"] = end
        rows = _c().activities.list_activities(**kwargs)
        events = []
        for row in rows:
            data = entity_dict(row)
            events.append(
                {
                    **data,
                    "title": data.get("activity_type") or data.get("notes") or "Activity",
                    "start": data.get("scheduled_at") or data.get("activity_at"),
                }
            )
        return events
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/reports/catalog")
def reports_catalog() -> dict[str, Any]:
    try:
        items = _c().reports.list_reports()
        return {
            "reports": items,
            "report_types": [i.get("title") or i.get("id") for i in items],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/reports/run")
def run_report(body: ReportRunBody) -> dict[str, Any]:
    try:
        from dataclasses import fields

        from vaybooks.bms.application.crm.reports import CrmReportFilters

        allowed = {f.name for f in fields(CrmReportFilters)}
        filters = None
        if body.filters:
            filters = CrmReportFilters(**{k: v for k, v in body.filters.items() if k in allowed})
        report_id = body.report_id
        catalog = _c().reports.list_reports()
        ids = {i.get("id") for i in catalog}
        if report_id not in ids:
            for item in catalog:
                if item.get("title") == report_id:
                    report_id = item["id"]
                    break
        result = _c().reports.run_report(report_id, filters=filters)
        data = entity_dict(result)
        if "rows" not in data and isinstance(data.get("data"), list):
            data["rows"] = data["data"]
        return data
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/settings")
def get_settings() -> dict[str, Any]:
    try:
        return entity_dict(_c().settings.get_settings())
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/settings")
def patch_settings(body: SettingsPatch) -> dict[str, Any]:
    try:
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        return entity_dict(_c().settings.update_settings(**updates))
    except Exception as exc:
        raise _http_err(exc) from exc
