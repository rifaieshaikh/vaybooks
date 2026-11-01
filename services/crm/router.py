"""CRM API — leads, enquiries, activities, dashboard, calendar, reports, settings (Mongo)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional
from uuid import uuid4

from bson.binary import Binary
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.crm_container import get_crm_container
from packages.services_kit.paging import clamp_page, paged_result
from packages.tenancy.context import DEFAULT_ORG_ID, get_org_id
from services.auth.router import _load_user_by_username, _perm_key, permission_cache
from services.common.authz import require_permission
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.crm.access import CrmAccessPolicy
from vaybooks.bms.domain.crm.entities import CrmImportBatch
from vaybooks.bms.domain.crm.enums import ImportBatchStatus
from vaybooks.bms.domain.crm.services import lead_row_fingerprint
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/crm", tags=["crm"])


# ---- request bodies ---------------------------------------------------------


class LeadCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = ""
    contact_person: str = ""
    alternate_phone: str = ""
    email: str = ""
    address_line1: str = ""
    address_line2: str = ""
    area: str = ""
    city: str = ""
    state_code: str = ""
    pincode: str = ""
    gstin: str = ""
    source: str = ""
    interested_products: str = ""
    estimated_value: float = 0.0
    priority: str = "Medium"
    status: str = "New"
    next_follow_up_at: Optional[str] = None
    notes: str = ""
    assigned_user_id: str = ""
    assigned_user_name: str = ""
    location_id: str = ""
    location_name: str = ""
    branch: str = ""
    custom_field_values: dict[str, Any] = Field(default_factory=dict)
    allow_duplicate: bool = False


class LeadPatch(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    area: Optional[str] = None
    city: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    source: Optional[str] = None
    interested_products: Optional[str] = None
    estimated_value: Optional[float] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    next_follow_up_at: Optional[str] = None
    notes: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    branch: Optional[str] = None
    assigned_user_id: Optional[str] = None
    assigned_user_name: Optional[str] = None
    custom_field_values: Optional[dict[str, Any]] = None


class LeadAssignBody(BaseModel):
    assigned_user_id: str = Field(min_length=1)
    assigned_user_name: str = ""


class LeadStatusBody(BaseModel):
    status: str = Field(min_length=1)


class LeadLostBody(BaseModel):
    reason: str = ""


class LeadConvertBody(BaseModel):
    force_new: bool = False


class LeadDuplicateBody(BaseModel):
    phone: str = ""
    email: str = ""
    gstin: str = ""
    name: str = ""
    exclude_lead_id: str = ""


class BulkAssignBody(BaseModel):
    ids: List[str] = Field(min_length=1)
    assigned_user_id: str = Field(min_length=1)
    assigned_user_name: str = ""


class BulkStatusBody(BaseModel):
    ids: List[str] = Field(min_length=1)
    status: str = Field(min_length=1)
    lost_reason: str = ""


class LeadImportBody(BaseModel):
    rows: List[dict[str, Any]] = Field(default_factory=list)
    duplicate_policy: str = "skip"
    location_id: str = ""
    location_name: str = ""
    branch: str = ""
    source_filename: str = "upload.csv"


class EnquiryCreate(BaseModel):
    lead_id: str = ""
    customer_id: str = ""
    party_name: str = ""
    enquiry_date: Optional[str] = None
    source: str = ""
    product_interest: str = ""
    description: str = ""
    expected_quantity: float = 0.0
    estimated_value: float = 0.0
    priority: str = "Medium"
    assigned_user_id: str = ""
    assigned_user_name: str = ""
    expected_decision_at: Optional[str] = None
    next_follow_up_at: Optional[str] = None
    notes: str = ""
    branch: str = ""
    custom_field_values: dict[str, Any] = Field(default_factory=dict)


class EnquiryPatch(BaseModel):
    party_name: Optional[str] = None
    source: Optional[str] = None
    product_interest: Optional[str] = None
    description: Optional[str] = None
    expected_quantity: Optional[float] = None
    estimated_value: Optional[float] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    lost_reason: Optional[str] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[str] = None
    assigned_user_name: Optional[str] = None
    expected_decision_at: Optional[str] = None
    next_follow_up_at: Optional[str] = None
    enquiry_date: Optional[str] = None
    branch: Optional[str] = None
    customer_id: Optional[str] = None
    quotation_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    custom_field_values: Optional[dict[str, Any]] = None


class ActivityCreate(BaseModel):
    activity_type: str = Field(min_length=1)
    lead_id: str = ""
    enquiry_id: str = ""
    customer_id: str = ""
    party_name: str = ""
    assigned_user_id: str = ""
    assigned_user_name: str = ""
    notes: str = ""
    outcome: str = ""
    next_action: str = ""
    location: str = ""
    location_id: str = ""
    location_name: str = ""
    activity_at: Optional[str] = None
    scheduled_at: Optional[str] = None
    due_at: Optional[str] = None
    next_follow_up_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    priority: str = "Medium"
    status: str = "Scheduled"
    promised_amount: float = 0.0
    promised_date: Optional[str] = None
    branch: str = ""
    custom_field_values: dict[str, Any] = Field(default_factory=dict)


class ActivityPatch(BaseModel):
    notes: Optional[str] = None
    outcome: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    scheduled_at: Optional[str] = None
    due_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    next_action: Optional[str] = None
    next_follow_up_at: Optional[str] = None
    assigned_user_id: Optional[str] = None
    assigned_user_name: Optional[str] = None
    location: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    promised_amount: Optional[float] = None
    promised_date: Optional[str] = None
    custom_field_values: Optional[dict[str, Any]] = None
    needs_correction: Optional[bool] = None


class CompleteBody(BaseModel):
    outcome: str = ""
    notes: str = ""
    next_action: str = ""
    next_follow_up_at: Optional[str] = None


class CancelBody(BaseModel):
    reason: str = Field(min_length=1)


class RescheduleBody(BaseModel):
    scheduled_at: str = Field(min_length=1)
    reason: str = ""


class SettingsPatch(BaseModel):
    lead_sources: Optional[list] = None
    lead_statuses: Optional[list] = None
    enquiry_statuses: Optional[list] = None
    activity_types: Optional[list] = None
    activity_outcomes: Optional[list] = None
    lost_reasons: Optional[list] = None
    default_inactivity_days: Optional[int] = None
    default_follow_up_days: Optional[int] = None
    business_display_name: Optional[str] = None
    order_trigger_status: Optional[str] = None
    payment_trigger: Optional[str] = None
    payment_reminder_template: Optional[str] = None
    payment_reminder_due_offsets_days: Optional[list[int]] = None
    calendar_drag_enabled: Optional[bool] = None
    custom_fields_enabled: Optional[bool] = None
    crm_mode: Optional[str] = None
    field_packs: Optional[dict[str, Any]] = None
    custom_field_defs: Optional[list] = None


class ReportRunBody(BaseModel):
    report_id: str = Field(min_length=1)
    filters: dict[str, Any] = Field(default_factory=dict)


class NotificationPrefsPatch(BaseModel):
    activity_due_today: Optional[bool] = None
    upcoming_visits: Optional[bool] = None
    overdue_follow_ups: Optional[bool] = None
    lead_assigned: Optional[bool] = None
    enquiry_reassigned: Optional[bool] = None
    payment_promises: Optional[bool] = None
    high_priority_idle: Optional[bool] = None
    payment_reminder_due: Optional[bool] = None


class WhatsAppReminderBody(BaseModel):
    customer_id: str = Field(min_length=1)
    phone: str = ""
    outstanding_amount: Optional[float] = None
    message_override: str = ""
    business_name: str = ""


class CreateQuotationBody(BaseModel):
    notes: str = ""
    quotation_date: Optional[str] = None
    valid_until: Optional[str] = None


class ReportPresetCreate(BaseModel):
    name: str = Field(min_length=1)
    report_id: str = Field(min_length=1)
    filters: dict[str, Any] = Field(default_factory=dict)


class ListViewCreate(BaseModel):
    name: str = Field(min_length=1)
    entity: str = Field(min_length=1)
    filters: dict[str, Any] = Field(default_factory=dict)
    sort: Optional[list[Any]] = None
    columns: Optional[list[Any]] = None


_AUDIT_ENTITY_TYPES = {
    "lead": "crm_lead",
    "enquiry": "crm_enquiry",
    "activity": "crm_activity",
}

_LIST_VIEW_ENTITIES = {"lead", "enquiry", "activity"}
_LIST_VIEW_PERMISSIONS = {
    "lead": "crm.leads.view",
    "enquiry": "crm.enquiries.view",
    "activity": "crm.activities.view",
}

_RESTORE_PERMISSIONS = {
    "lead": "crm.leads.delete",
    "enquiry": "crm.enquiries.delete",
    "activity": "crm.activities.edit",
}

_DELETED_MODES = frozenset({"exclude", "only", "include"})


# ---- helpers ----------------------------------------------------------------


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


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        dt = _parse_dt(text)
        return dt.date() if dt else None


def _coerce_dt_fields(fields: dict[str, Any], *keys: str) -> dict[str, Any]:
    out = dict(fields)
    for key in keys:
        if key in out and out[key] is not None and not isinstance(out[key], datetime):
            out[key] = _parse_dt(str(out[key]))
    return out


def _policy_for(username: str) -> CrmAccessPolicy:
    user = _load_user_by_username(username)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    cached = permission_cache.get(_perm_key(user.username, oid)) or {}
    perms = list(cached.get("permissions") or [])
    return CrmAccessPolicy(user=user, permission_keys=perms)


def _ensure_permission(username: str, key: str) -> None:
    user = _load_user_by_username(username)
    oid = getattr(user, "org_id", None) or get_org_id() or DEFAULT_ORG_ID
    cached = permission_cache.get(_perm_key(user.username, oid)) or {}
    if "*" in list(cached.get("permissions") or []):
        return
    from services.auth.router import _access

    if not _access().authorization.can(user, key):
        raise HTTPException(status_code=403, detail=f"Permission denied: {key}")


def _parse_deleted_mode(deleted: str = "exclude") -> str:
    mode = (deleted or "exclude").strip().lower()
    if mode not in _DELETED_MODES:
        raise HTTPException(
            status_code=400,
            detail="deleted must be one of: exclude, only, include",
        )
    return mode


def _access_users():
    try:
        from packages.services_kit.access_container import get_access_container

        return list(get_access_container().users.list_users() or [])
    except Exception:
        return []


def _team_ids(policy: CrmAccessPolicy) -> Optional[List[str]]:
    return policy.team_user_ids_from_users(_access_users())


def _filter_by_scope(rows: list, policy: CrmAccessPolicy) -> list:
    team = _team_ids(policy)
    if team is None:
        return rows
    allowed = set(team)
    out = []
    for row in rows:
        assignee = str(getattr(row, "assigned_user_id", "") or "")
        if policy.can_access_assigned(assignee, team_user_ids=allowed):
            out.append(row)
    return out


def _parse_day_bound(value: Optional[str], *, end_of_day: bool = False) -> Optional[datetime]:
    raw = (value or "").strip()
    if not raw:
        return None
    if len(raw) >= 10:
        try:
            day = date.fromisoformat(raw[:10])
            if len(raw) == 10 or "T" not in raw.upper():
                if end_of_day:
                    return datetime(day.year, day.month, day.day, 23, 59, 59)
                return datetime(day.year, day.month, day.day, 0, 0, 0)
        except ValueError:
            pass
    text = raw.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}") from exc


def _entity_dt(row: Any, *attrs: str) -> Optional[datetime]:
    for attr in attrs:
        val = getattr(row, attr, None)
        if isinstance(val, datetime):
            return val
    return None


def _filter_by_date_range(
    rows: list,
    *,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    attrs: tuple[str, ...] = ("created_at",),
) -> list:
    start = _parse_day_bound(date_from, end_of_day=False)
    end = _parse_day_bound(date_to, end_of_day=True)
    if start is None and end is None:
        return rows
    out = []
    for row in rows:
        stamp = _entity_dt(row, *attrs)
        if stamp is None:
            continue
        if start is not None and stamp < start:
            continue
        if end is not None and stamp > end:
            continue
        out.append(row)
    return out


def _sort_entities(
    rows: list,
    *,
    sort_by: Optional[str] = None,
    sort_desc: bool = True,
) -> list:
    key_name = (sort_by or "").strip()
    if not key_name:
        return rows

    def sort_key(row: Any) -> Any:
        val = getattr(row, key_name, None)
        if val is None:
            return ("", "")
        if isinstance(val, datetime):
            return (0, val)
        if isinstance(val, (int, float)):
            return (0, val)
        return (1, str(val).lower())

    try:
        return sorted(rows, key=sort_key, reverse=bool(sort_desc))
    except TypeError:
        return rows


def _list_view_entity(entity: str) -> str:
    key = (entity or "").strip().lower()
    if key not in _LIST_VIEW_ENTITIES:
        raise ValidationError("entity must be lead, enquiry, or activity")
    return key


def _serialize_list_view(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": doc.get("_id"),
        "name": doc.get("name") or "",
        "entity": doc.get("entity") or "",
        "filters": doc.get("filters") or {},
        "sort": doc.get("sort") or [],
        "columns": doc.get("columns") or [],
        "username": doc.get("username") or "",
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def _page_entities(rows: list, *, page: int, page_size: int) -> dict[str, Any]:
    p, size = clamp_page(page, page_size if page_size else 50)
    size = min(size, 200)
    payload = paged_result([entity_dict(r) for r in rows], page=p, page_size=size)
    return payload


def _dup_dict(match) -> dict[str, Any]:
    lead = getattr(match, "lead", None)
    return {
        "lead": entity_dict(lead) if lead else None,
        "customer_id": getattr(match, "customer_id", "") or "",
        "customer_name": getattr(match, "customer_name", "") or "",
        "match_fields": list(getattr(match, "match_fields", None) or []),
        "is_duplicate": bool(lead or getattr(match, "customer_id", "")),
    }


def _append_attachment(entity_type: str, entity_id: str, attachment_id: str) -> None:
    c = _c()
    if entity_type == "lead":
        lead = c.leads.get_lead(entity_id)
        ids = list(lead.attachment_ids or [])
        if attachment_id not in ids:
            ids.append(attachment_id)
        c.leads.update_lead(entity_id, attachment_ids=ids)
    elif entity_type == "enquiry":
        enquiry = c.enquiries.get_enquiry(entity_id)
        ids = list(enquiry.attachment_ids or [])
        if attachment_id not in ids:
            ids.append(attachment_id)
        c.enquiries.update_enquiry(entity_id, attachment_ids=ids)
    elif entity_type == "activity":
        activity = c.activities.get_activity(entity_id)
        ids = list(activity.attachment_ids or [])
        if attachment_id not in ids:
            ids.append(attachment_id)
        c.activities.update_activity(entity_id, attachment_ids=ids, allow_automatic=True)
    else:
        raise ValidationError("entity_type must be lead, enquiry, or activity")


def _remove_attachment_ref(entity_type: str, entity_id: str, attachment_id: str) -> None:
    c = _c()
    if entity_type == "lead":
        lead = c.leads.get_lead(entity_id)
        c.leads.update_lead(
            entity_id,
            attachment_ids=[x for x in (lead.attachment_ids or []) if x != attachment_id],
        )
    elif entity_type == "enquiry":
        enquiry = c.enquiries.get_enquiry(entity_id)
        c.enquiries.update_enquiry(
            entity_id,
            attachment_ids=[x for x in (enquiry.attachment_ids or []) if x != attachment_id],
        )
    elif entity_type == "activity":
        activity = c.activities.get_activity(entity_id)
        c.activities.update_activity(
            entity_id,
            attachment_ids=[x for x in (activity.attachment_ids or []) if x != attachment_id],
            allow_automatic=True,
        )


# ---- health / overview / owners ---------------------------------------------


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "crm", "status": "ok", "backend": _c().backend}


@router.get("/overview")
def overview(_: str = Depends(require_permission("crm.dashboard.view"))) -> dict[str, Any]:
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


@router.get("/owners")
def list_owners(_: str = Depends(require_permission("crm.leads.view"))) -> list[dict[str, Any]]:
    try:
        users = _access_users()
        out: list[dict[str, Any]] = []
        for user in users:
            if getattr(user, "is_active", True) is False:
                continue
            roles = [str(r) for r in (getattr(user, "crm_roles", None) or [])]
            # Include users with CRM roles or any role id hinting sales/crm
            role_ids = [str(r) for r in (getattr(user, "role_ids", None) or [])]
            if not roles and not any(
                "crm" in r.lower() or "sales" in r.lower() for r in role_ids
            ):
                # still include if they appear assignable — prefer role match
                if not role_ids:
                    continue
            out.append(
                {
                    "id": getattr(user, "id", ""),
                    "name": getattr(user, "display_name", None)
                    or getattr(user, "full_name", None)
                    or getattr(user, "username", "")
                    or "",
                    "active": bool(getattr(user, "is_active", True)),
                    "roles": roles or role_ids,
                }
            )
        if not out:
            # Fallback: all active users (small orgs / bootstrap)
            for user in users:
                if getattr(user, "is_active", True) is False:
                    continue
                out.append(
                    {
                        "id": getattr(user, "id", ""),
                        "name": getattr(user, "display_name", None)
                        or getattr(user, "username", "")
                        or "",
                        "active": True,
                        "roles": [],
                    }
                )
        return out
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- leads ------------------------------------------------------------------


@router.get("/leads")
def list_leads(
    *,
    status: Optional[str] = None,
    search: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    source: Optional[str] = None,
    priority: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_desc: bool = True,
    deleted: str = "exclude",
    page: int = 1,
    page_size: int = 50,
    username: str = Depends(require_permission("crm.leads.view")),
) -> dict[str, Any]:
    try:
        policy = _policy_for(username)
        kwargs: dict[str, Any] = {
            "limit": 5000,
            "search": search or "",
            "deleted": _parse_deleted_mode(deleted),
        }
        if status:
            kwargs["status"] = status
        if source:
            kwargs["source"] = source
        own = policy.scoped_assigned_user_id()
        if own:
            kwargs["assigned_user_id"] = own
        elif assigned_user_id:
            kwargs["assigned_user_id"] = assigned_user_id
        rows = _filter_by_scope(_c().leads.list_leads(**kwargs), policy)
        if assigned_user_id and not own:
            rows = [r for r in rows if str(r.assigned_user_id or "") == assigned_user_id]
        if priority:
            rows = [r for r in rows if str(getattr(r, "priority", "") or "") == priority]
        rows = _filter_by_date_range(
            rows,
            date_from=date_from,
            date_to=date_to,
            attrs=("created_at",),
        )
        rows = _sort_entities(rows, sort_by=sort_by, sort_desc=sort_desc)
        return _page_entities(rows, page=page, page_size=page_size)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads", status_code=201)
def create_lead(
    body: LeadCreate,
    username: str = Depends(require_permission("crm.leads.create")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        lead = _c().leads.create_lead(
            name=body.name,
            phone=body.phone,
            contact_person=body.contact_person,
            alternate_phone=body.alternate_phone,
            email=body.email,
            address_line1=body.address_line1,
            address_line2=body.address_line2,
            area=body.area,
            city=body.city,
            state_code=body.state_code,
            pincode=body.pincode,
            gstin=body.gstin,
            source=body.source,
            interested_products=body.interested_products,
            estimated_value=body.estimated_value,
            priority=body.priority,
            status=body.status,
            next_follow_up_at=_parse_dt(body.next_follow_up_at),
            notes=body.notes,
            assigned_user_id=body.assigned_user_id,
            assigned_user_name=body.assigned_user_name,
            location_id=body.location_id,
            location_name=body.location_name,
            branch=body.branch,
            allow_duplicate=body.allow_duplicate,
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        if body.custom_field_values:
            lead = _c().leads.update_lead(
                lead.id, custom_field_values=body.custom_field_values
            )
        publish("CrmLeadCreated", {"lead_id": lead.id, "name": lead.name, "status": lead.status})
        return entity_dict(lead)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/detect-duplicates")
def detect_duplicates(
    body: LeadDuplicateBody,
    _: str = Depends(require_permission("crm.leads.create")),
) -> dict[str, Any]:
    try:
        match = _c().leads.detect_duplicates(
            phone=body.phone,
            email=body.email,
            gstin=body.gstin,
            name=body.name,
            exclude_lead_id=body.exclude_lead_id,
        )
        return _dup_dict(match)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/bulk-assign")
def bulk_assign_leads(
    body: BulkAssignBody,
    username: str = Depends(require_permission("crm.leads.assign")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        rows = _c().leads.bulk_assign(
            body.ids,
            body.assigned_user_id,
            body.assigned_user_name,
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        return {"items": [entity_dict(r) for r in rows], "total": len(rows)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/bulk-status")
def bulk_status_leads(
    body: BulkStatusBody,
    username: str = Depends(require_permission("crm.leads.edit")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        rows = _c().leads.bulk_update_status(
            body.ids,
            body.status,
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        return {"items": [entity_dict(r) for r in rows], "total": len(rows)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/import/dry-run")
def import_leads_dry_run(
    body: LeadImportBody,
    username: str = Depends(require_permission("crm.import.run")),
) -> dict[str, Any]:
    try:
        outcomes = []
        for idx, row in enumerate(body.rows or []):
            phone = (row.get("phone") or row.get("phone_number") or "").strip()
            email = (row.get("email") or "").strip()
            gstin = (row.get("gstin") or "").strip()
            name = (row.get("name") or row.get("lead_name") or "").strip()
            dup = _c().leads.detect_duplicates(phone=phone, email=email, gstin=gstin, name=name)
            outcomes.append(
                {
                    "row": idx,
                    "name": name,
                    "would_create": not bool(dup.lead) or body.duplicate_policy
                    in ("import_as_separate", "update", "link_to_customer"),
                    "duplicate": _dup_dict(dup),
                }
            )
        return {
            "total_rows": len(body.rows or []),
            "outcomes": outcomes,
            "duplicate_policy": body.duplicate_policy,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/import/commit")
def import_leads_commit(
    body: LeadImportBody,
    username: str = Depends(require_permission("crm.import.run")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        actor_id = getattr(user, "id", "") or ""
        actor_name = getattr(user, "username", "") or username
        batch = CrmImportBatch(
            entity_type="leads",
            source_filename=body.source_filename or "upload.csv",
            imported_by_id=actor_id,
            imported_by_name=actor_name,
            status=ImportBatchStatus.RUNNING.value,
            total_rows=len(body.rows or []),
            branch=body.branch,
        )
        if _c().import_batches:
            batch = _c().import_batches.save(batch)
        outcomes = []
        for row in body.rows or []:
            fp = lead_row_fingerprint(row)
            try:
                result = _c().leads.upsert_from_import_row(
                    row,
                    policy=body.duplicate_policy,
                    batch_id=batch.id,
                    fingerprint=fp,
                    actor_id=actor_id,
                    actor_name=actor_name,
                    branch=body.branch,
                    location_id=body.location_id,
                    location_name=body.location_name,
                )
            except Exception as row_exc:
                result = {"outcome": "failed", "reason": str(row_exc)}
            outcomes.append(result)
            outcome = result.get("outcome")
            if outcome == "created":
                batch.created_count += 1
            elif outcome == "updated":
                batch.updated_count += 1
            elif outcome == "skipped":
                batch.skipped_count += 1
            elif outcome == "linked":
                batch.linked_count += 1
            else:
                batch.failed_count += 1
        batch.row_outcomes = outcomes
        batch.status = ImportBatchStatus.COMPLETED.value
        batch.completed_at = datetime.utcnow()
        if _c().import_batches:
            batch = _c().import_batches.save(batch)
        return entity_dict(batch)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/leads/{lead_id}")
def get_lead(
    lead_id: str,
    include_deleted: bool = False,
    username: str = Depends(require_permission("crm.leads.view")),
) -> dict[str, Any]:
    try:
        if include_deleted:
            _ensure_permission(username, "crm.leads.delete")
        lead = _c().leads.get_lead(lead_id, include_deleted=include_deleted)
        policy = _policy_for(username)
        if not policy.can_access_assigned(
            lead.assigned_user_id, team_user_ids=_team_ids(policy)
        ):
            raise HTTPException(status_code=403, detail="Permission denied for this lead")
        return entity_dict(lead)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/leads/{lead_id}")
def update_lead(
    lead_id: str,
    body: LeadPatch,
    username: str = Depends(require_permission("crm.leads.edit")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        fields = _coerce_dt_fields(fields, "next_follow_up_at")
        return entity_dict(
            _c().leads.update_lead(
                lead_id,
                actor_id=getattr(user, "id", "") or "",
                actor_name=getattr(user, "username", "") or username,
                **fields,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/{lead_id}/assign")
def assign_lead(
    lead_id: str,
    body: LeadAssignBody,
    username: str = Depends(require_permission("crm.leads.assign")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        return entity_dict(
            _c().leads.assign_lead(
                lead_id,
                body.assigned_user_id,
                body.assigned_user_name,
                actor_id=getattr(user, "id", "") or "",
                actor_name=getattr(user, "username", "") or username,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/{lead_id}/status")
def set_lead_status(
    lead_id: str,
    body: LeadStatusBody,
    username: str = Depends(require_permission("crm.leads.edit")),
) -> dict[str, Any]:
    try:
        return entity_dict(_c().leads.update_status(lead_id, body.status))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/{lead_id}/mark-lost")
def mark_lead_lost(
    lead_id: str,
    body: LeadLostBody,
    _: str = Depends(require_permission("crm.leads.edit")),
) -> dict[str, Any]:
    try:
        return entity_dict(_c().leads.mark_lost(lead_id, body.reason))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/{lead_id}/reopen")
def reopen_lead(
    lead_id: str, _: str = Depends(require_permission("crm.leads.edit"))
) -> dict[str, Any]:
    try:
        return entity_dict(_c().leads.reopen_lead(lead_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/leads/{lead_id}/convert")
def convert_lead(
    lead_id: str,
    body: LeadConvertBody,
    _: str = Depends(require_permission("crm.leads.convert")),
) -> dict[str, Any]:
    try:
        return entity_dict(_c().leads.convert_to_customer(lead_id, force_new=body.force_new))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/leads/{lead_id}/timeline")
def lead_timeline(
    lead_id: str, _: str = Depends(require_permission("crm.leads.view"))
) -> list[dict[str, Any]]:
    try:
        _c().leads.get_lead(lead_id)
        rows = _c().activities.list_timeline(lead_id=lead_id, limit=200)
        return [entity_dict(row) for row in rows]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/leads/{lead_id}")
def delete_lead(
    lead_id: str, _: str = Depends(require_permission("crm.leads.delete"))
) -> dict[str, Any]:
    try:
        return entity_dict(_c().leads.soft_delete_lead(lead_id))
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- enquiries --------------------------------------------------------------


@router.get("/enquiries")
def list_enquiries(
    *,
    status: Optional[str] = None,
    search: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_desc: bool = True,
    deleted: str = "exclude",
    page: int = 1,
    page_size: int = 50,
    username: str = Depends(require_permission("crm.enquiries.view")),
) -> dict[str, Any]:
    try:
        policy = _policy_for(username)
        kwargs: dict[str, Any] = {
            "limit": 5000,
            "deleted": _parse_deleted_mode(deleted),
        }
        if status:
            kwargs["status"] = status
        if search:
            kwargs["search"] = search
        own = policy.scoped_assigned_user_id()
        if own:
            kwargs["assigned_user_id"] = own
        elif assigned_user_id:
            kwargs["assigned_user_id"] = assigned_user_id
        try:
            rows = _c().enquiries.list_enquiries(**kwargs)
        except TypeError:
            rows = _c().enquiries.list_enquiries(limit=kwargs["limit"])
        rows = _filter_by_scope(rows, policy)
        if search:
            needle = search.lower()
            rows = [
                r
                for r in rows
                if needle in (r.enquiry_number or "").lower()
                or needle in (r.party_name or "").lower()
                or needle in (r.product_interest or "").lower()
            ]
        rows = _filter_by_date_range(
            rows,
            date_from=date_from,
            date_to=date_to,
            attrs=("enquiry_date", "created_at"),
        )
        rows = _sort_entities(rows, sort_by=sort_by, sort_desc=sort_desc)
        return _page_entities(rows, page=page, page_size=page_size)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/enquiries", status_code=201)
def create_enquiry(
    body: EnquiryCreate,
    username: str = Depends(require_permission("crm.enquiries.create")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
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
            assigned_user_id=body.assigned_user_id,
            assigned_user_name=body.assigned_user_name,
            expected_decision_at=_parse_dt(body.expected_decision_at),
            next_follow_up_at=_parse_dt(body.next_follow_up_at),
            notes=body.notes,
            branch=body.branch,
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        patch: dict[str, Any] = {}
        if body.enquiry_date:
            patch["enquiry_date"] = _parse_dt(body.enquiry_date)
        if body.custom_field_values:
            patch["custom_field_values"] = body.custom_field_values
        if patch:
            enquiry = _c().enquiries.update_enquiry(enquiry.id, **patch)
        return entity_dict(enquiry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/enquiries/bulk-assign")
def bulk_assign_enquiries(
    body: BulkAssignBody,
    username: str = Depends(require_permission("crm.enquiries.assign")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        rows = _c().enquiries.bulk_assign(
            body.ids,
            body.assigned_user_id,
            body.assigned_user_name,
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        return {"items": [entity_dict(r) for r in rows], "total": len(rows)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/enquiries/bulk-status")
def bulk_status_enquiries(
    body: BulkStatusBody,
    username: str = Depends(require_permission("crm.enquiries.edit")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        rows = _c().enquiries.bulk_update_status(
            body.ids,
            body.status,
            lost_reason=body.lost_reason,
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        return {"items": [entity_dict(r) for r in rows], "total": len(rows)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/enquiries/{enquiry_id}")
def get_enquiry(
    enquiry_id: str,
    include_deleted: bool = False,
    username: str = Depends(require_permission("crm.enquiries.view")),
) -> dict[str, Any]:
    try:
        if include_deleted:
            _ensure_permission(username, "crm.enquiries.delete")
        return entity_dict(
            _c().enquiries.get_enquiry(enquiry_id, include_deleted=include_deleted)
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/enquiries/{enquiry_id}")
def update_enquiry(
    enquiry_id: str,
    body: EnquiryPatch,
    username: str = Depends(require_permission("crm.enquiries.edit")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        fields = _coerce_dt_fields(
            fields, "expected_decision_at", "next_follow_up_at", "enquiry_date"
        )
        return entity_dict(
            _c().enquiries.update_enquiry(
                enquiry_id,
                actor_id=getattr(user, "id", "") or "",
                actor_name=getattr(user, "username", "") or username,
                **fields,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/enquiries/{enquiry_id}")
def delete_enquiry(
    enquiry_id: str, _: str = Depends(require_permission("crm.enquiries.delete"))
) -> dict[str, Any]:
    try:
        return entity_dict(_c().enquiries.soft_delete(enquiry_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/enquiries/{enquiry_id}/create-quotation")
def create_quotation_from_enquiry(
    enquiry_id: str,
    body: Optional[CreateQuotationBody] = None,
    username: str = Depends(require_permission("crm.enquiries.edit")),
) -> dict[str, Any]:
    try:
        payload = body or CreateQuotationBody()
        user = _load_user_by_username(username)
        enquiry = _c().enquiries.get_enquiry(enquiry_id)
        product_name = (enquiry.product_interest or "").strip() or "Enquiry item"
        quotation = _c().enquiries.create_quotation_from_enquiry(
            enquiry_id,
            lines=[
                {
                    "product_name": product_name,
                    "qty": 1,
                    "rate": 0,
                }
            ],
            quotation_date=_parse_date(payload.quotation_date),
            valid_until=_parse_date(payload.valid_until),
            notes=payload.notes or "",
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        refreshed = _c().enquiries.get_enquiry(enquiry_id)
        return {
            "quotation": entity_dict(quotation),
            "enquiry": entity_dict(refreshed),
        }
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- activities -------------------------------------------------------------


@router.get("/activities")
def list_activities(
    *,
    lead_id: Optional[str] = None,
    enquiry_id: Optional[str] = None,
    status: Optional[str] = None,
    activity_type: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    search: Optional[str] = None,
    scheduled_from: Optional[str] = None,
    scheduled_to: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_desc: bool = True,
    needs_correction: Optional[bool] = None,
    origin: Optional[str] = None,
    deleted: str = "exclude",
    page: int = 1,
    page_size: int = 50,
    username: str = Depends(require_permission("crm.activities.view")),
) -> dict[str, Any]:
    try:
        policy = _policy_for(username)
        kwargs: dict[str, Any] = {
            "limit": 5000,
            "deleted": _parse_deleted_mode(deleted),
        }
        if lead_id:
            kwargs["lead_id"] = lead_id
        if enquiry_id:
            kwargs["enquiry_id"] = enquiry_id
        if status:
            kwargs["status"] = status
        if activity_type:
            kwargs["activity_type"] = activity_type
        if origin:
            kwargs["origin"] = origin
        if needs_correction is not None:
            kwargs["needs_correction"] = needs_correction
        own = policy.scoped_assigned_user_id()
        if own:
            kwargs["assigned_user_id"] = own
        elif assigned_user_id:
            kwargs["assigned_user_id"] = assigned_user_id
        start = _parse_day_bound(scheduled_from or date_from, end_of_day=False)
        end = _parse_day_bound(scheduled_to or date_to, end_of_day=True)
        if start is not None:
            kwargs["scheduled_from"] = start
        if end is not None:
            kwargs["scheduled_to"] = end
        rows = _filter_by_scope(_c().activities.list_activities(**kwargs), policy)
        if search:
            needle = search.strip().lower()
            rows = [
                r
                for r in rows
                if needle
                in " ".join(
                    [
                        str(getattr(r, "activity_type", "") or ""),
                        str(getattr(r, "party_name", "") or ""),
                        str(getattr(r, "status", "") or ""),
                        str(getattr(r, "notes", "") or ""),
                        str(getattr(r, "origin", "") or ""),
                    ]
                ).lower()
            ]
        rows = _sort_entities(rows, sort_by=sort_by, sort_desc=sort_desc)
        return _page_entities(rows, page=page, page_size=page_size)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities", status_code=201)
def create_activity(
    body: ActivityCreate,
    username: str = Depends(require_permission("crm.activities.create")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        activity = _c().activities.create_manual(
            activity_type=body.activity_type,
            lead_id=body.lead_id,
            enquiry_id=body.enquiry_id,
            customer_id=body.customer_id,
            party_name=body.party_name,
            assigned_user_id=body.assigned_user_id,
            assigned_user_name=body.assigned_user_name,
            notes=body.notes,
            outcome=body.outcome,
            next_action=body.next_action,
            location=body.location,
            location_id=body.location_id,
            location_name=body.location_name,
            activity_at=_parse_dt(body.activity_at),
            scheduled_at=_parse_dt(body.scheduled_at),
            due_at=_parse_dt(body.due_at),
            next_follow_up_at=_parse_dt(body.next_follow_up_at),
            duration_minutes=body.duration_minutes,
            priority=body.priority,
            status=body.status,
            promised_amount=body.promised_amount,
            promised_date=_parse_dt(body.promised_date),
            branch=body.branch,
            actor_id=getattr(user, "id", "") or "",
            actor_name=getattr(user, "username", "") or username,
        )
        if body.custom_field_values:
            activity = _c().activities.update_activity(
                activity.id, custom_field_values=body.custom_field_values
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
def get_activity(
    activity_id: str,
    include_deleted: bool = False,
    username: str = Depends(require_permission("crm.activities.view")),
) -> dict[str, Any]:
    try:
        if include_deleted:
            _ensure_permission(username, "crm.activities.edit")
        return entity_dict(
            _c().activities.get_activity(activity_id, include_deleted=include_deleted)
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/activities/{activity_id}")
def update_activity(
    activity_id: str,
    body: ActivityPatch,
    username: str = Depends(require_permission("crm.activities.edit")),
) -> dict[str, Any]:
    try:
        policy = _policy_for(username)
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        fields = _coerce_dt_fields(
            fields, "scheduled_at", "due_at", "next_follow_up_at", "promised_date"
        )
        allow_automatic = (
            policy.can_correct_automatic_activities()
            or "*" in policy.permission_keys
            or "crm.corrections.review" in policy.permission_keys
        )
        return entity_dict(
            _c().activities.update_activity(
                activity_id, allow_automatic=allow_automatic, **fields
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities/{activity_id}/complete")
def complete_activity(
    activity_id: str,
    body: CompleteBody,
    username: str = Depends(require_permission("crm.activities.complete")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        return entity_dict(
            _c().activities.complete(
                activity_id,
                outcome=body.outcome,
                notes=body.notes,
                next_action=body.next_action,
                next_follow_up_at=_parse_dt(body.next_follow_up_at),
                actor_id=getattr(user, "id", "") or "",
                actor_name=getattr(user, "username", "") or username,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities/{activity_id}/cancel")
def cancel_activity(
    activity_id: str,
    body: CancelBody,
    username: str = Depends(require_permission("crm.activities.edit")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        return entity_dict(
            _c().activities.cancel(
                activity_id,
                reason=body.reason,
                actor_id=getattr(user, "id", "") or "",
                actor_name=getattr(user, "username", "") or username,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/activities/{activity_id}/reschedule")
def reschedule_activity(
    activity_id: str,
    body: RescheduleBody,
    username: str = Depends(require_permission("crm.activities.edit")),
) -> dict[str, Any]:
    try:
        when = _parse_dt(body.scheduled_at)
        if when is None:
            raise ValidationError("scheduled_at is required")
        user = _load_user_by_username(username)
        return entity_dict(
            _c().activities.reschedule(
                activity_id,
                when,
                reason=body.reason or "",
                actor_id=getattr(user, "id", "") or "",
                actor_name=getattr(user, "username", "") or username,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/activities/{activity_id}")
def delete_activity(
    activity_id: str, _: str = Depends(require_permission("crm.activities.edit"))
) -> dict[str, Any]:
    try:
        return entity_dict(_c().activities.soft_delete(activity_id))
    except Exception as exc:
        raise _http_err(exc) from exc


# ---- calendar / reports / settings / prefs / whatsapp / attachments ---------


@router.get("/calendar")
def calendar(
    *,
    scheduled_from: Optional[str] = None,
    scheduled_to: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    status: Optional[str] = None,
    activity_type: Optional[str] = None,
    limit: int = 2000,
    username: str = Depends(require_permission("crm.calendar.view")),
) -> list[dict[str, Any]]:
    try:
        policy = _policy_for(username)
        kwargs: dict[str, Any] = {"limit": limit}
        start = _parse_dt(scheduled_from)
        end = _parse_dt(scheduled_to)
        if start is not None:
            kwargs["scheduled_from"] = start
        if end is not None:
            kwargs["scheduled_to"] = end
        if status:
            kwargs["status"] = status
        if activity_type:
            kwargs["activity_type"] = activity_type
        own = policy.scoped_assigned_user_id()
        if own:
            kwargs["assigned_user_id"] = own
        elif assigned_user_id:
            kwargs["assigned_user_id"] = assigned_user_id
        rows = _filter_by_scope(_c().activities.list_activities(**kwargs), policy)
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
def reports_catalog(
    _: str = Depends(require_permission("crm.reports.view")),
) -> dict[str, Any]:
    try:
        items = _c().reports.list_reports()
        return {
            "reports": items,
            "report_types": [i.get("title") or i.get("id") for i in items],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/reports/run")
def run_report(
    body: ReportRunBody, _: str = Depends(require_permission("crm.reports.view"))
) -> dict[str, Any]:
    try:
        from dataclasses import fields

        from vaybooks.bms.application.crm.reports import CrmReportFilters

        allowed = {f.name for f in fields(CrmReportFilters)}
        filters = None
        if body.filters:
            filters = CrmReportFilters(
                **{k: v for k, v in body.filters.items() if k in allowed}
            )
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
def get_settings(
    _: str = Depends(require_permission("crm.settings.view")),
) -> dict[str, Any]:
    try:
        return entity_dict(_c().settings.get_settings())
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/settings")
def patch_settings(
    body: SettingsPatch,
    username: str = Depends(require_permission("crm.settings.edit")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        return entity_dict(
            _c().settings.update_settings(
                actor_id=getattr(user, "id", "") or "",
                actor_name=getattr(user, "username", "") or username,
                **updates,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/notifications/preferences")
def get_notification_prefs(
    username: str = Depends(require_permission("crm.dashboard.view")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        prefs = _c().notifications.get_preferences(getattr(user, "id", "") or username)
        return entity_dict(prefs)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/notifications/preferences")
def patch_notification_prefs(
    body: NotificationPrefsPatch,
    username: str = Depends(require_permission("crm.dashboard.view")),
) -> dict[str, Any]:
    try:
        user = _load_user_by_username(username)
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        prefs = _c().notifications.update_preferences(
            getattr(user, "id", "") or username, **updates
        )
        return entity_dict(prefs)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/whatsapp/payment-reminder")
def whatsapp_payment_reminder(
    body: WhatsAppReminderBody,
    _: str = Depends(require_permission("crm.reminders.whatsapp.send")),
) -> dict[str, Any]:
    try:
        svc = _c().payment_reminders
        if not svc:
            raise ValidationError("Payment reminder service unavailable")
        preview = svc.preview(
            body.customer_id,
            phone=body.phone,
            outstanding_amount=body.outstanding_amount,
            message_override=body.message_override,
            business_name=body.business_name,
        )
        return entity_dict(preview)
    except Exception as exc:
        raise _http_err(exc) from exc


def _collections_owner_by_customer(collection_related: list[Any]) -> dict[str, dict[str, str]]:
    """Latest open collection activity owner per customer (for balance owner filter)."""
    from vaybooks.bms.application.crm.collections_aging import activity_sort_key

    by_customer: dict[str, Any] = {}
    for row in sorted(collection_related, key=activity_sort_key, reverse=True):
        cid = (getattr(row, "customer_id", None) or "").strip()
        if not cid or cid in by_customer:
            continue
        by_customer[cid] = row
    return {
        cid: {
            "assigned_user_id": getattr(act, "assigned_user_id", "") or "",
            "assigned_user_name": getattr(act, "assigned_user_name", "") or "",
        }
        for cid, act in by_customer.items()
    }


def _enrich_collections_balances(
    balances: list[dict[str, Any]],
    *,
    owner_by_customer: dict[str, dict[str, str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Attach open invoice due dates / days_past_due when accounting is available."""
    from vaybooks.bms.application.crm.collections_aging import (
        build_open_invoice_rows,
        enrich_balance_row,
    )

    accounting = getattr(_c(), "accounting", None)
    customers = getattr(_c(), "customers", None)
    open_invoices: list[dict[str, Any]] = []
    enriched_balances: list[dict[str, Any]] = []

    for balance in balances:
        if not isinstance(balance, dict):
            continue
        customer_id = str(balance.get("customer_id") or "").strip()
        customer_name = str(balance.get("customer_name") or "")
        owner = owner_by_customer.get(customer_id) or {}
        phone = ""
        if customers and customer_id:
            try:
                detail = customers.get_customer_detail(customer_id)
                phone = (getattr(detail, "phone_number", None) or "") if detail else ""
            except Exception:
                phone = ""

        invoice_rows: list[dict[str, Any]] = []
        if accounting and customer_id:
            try:
                acct = accounting.get_customer_account(customer_id)
                account_id = getattr(acct, "id", None) if acct else None
                if account_id:
                    raw = (
                        accounting.list_open_sales_invoices_for_customer(account_id)
                        or []
                    )
                    invoice_rows = build_open_invoice_rows(
                        customer_id=customer_id,
                        customer_name=customer_name,
                        invoices=raw,
                        phone=phone,
                        assigned_user_id=owner.get("assigned_user_id") or "",
                        assigned_user_name=owner.get("assigned_user_name") or "",
                    )
            except Exception:
                invoice_rows = []

        open_invoices.extend(invoice_rows)
        enriched_balances.append(
            enrich_balance_row(
                balance,
                invoice_rows,
                phone=phone,
                assigned_user_id=owner.get("assigned_user_id") or "",
                assigned_user_name=owner.get("assigned_user_name") or "",
            )
        )

    open_invoices.sort(
        key=lambda row: (
            -(row["days_past_due"] if row.get("days_past_due") is not None else -10**9),
            -(float(row.get("outstanding") or 0)),
        )
    )
    return enriched_balances, open_invoices


@router.get("/collections")
def collections(
    username: str = Depends(require_permission("crm.dashboard.view")),
) -> dict[str, Any]:
    """Collections work queue for CRM.

    When accounting is available, balances are enriched with open sales invoice
    ``due_date`` / ``days_past_due`` (via
    ``AccountingService.list_open_sales_invoices_for_customer``) and an
    ``open_invoices`` list is returned for client-side aging buckets.
    """
    try:
        policy = _policy_for(username)
        if not (
            policy.can_view_collection()
            or "crm.balances.view" in policy.permission_keys
            or "crm.credit.view" in policy.permission_keys
            or "crm.payment_followups.view" in policy.permission_keys
        ):
            raise HTTPException(status_code=403, detail="Permission denied: collections")
        snap = _c().dashboard.snapshot()
        balances = list(getattr(snap, "customers_with_outstanding_balances", None) or [])
        open_statuses = {
            "Scheduled",
            "In Progress",
        }
        keywords = ("payment", "collection", "promise")
        rows = _filter_by_scope(_c().activities.list_activities(limit=2000), policy)
        collection_related = []
        for row in rows:
            if (row.status or "") not in open_statuses:
                continue
            blob = f"{row.activity_type or ''} {row.outcome or ''}".lower()
            if any(k in blob for k in keywords):
                collection_related.append(row)
        payment_promises = [
            entity_dict(r)
            for r in collection_related
            if "promise" in f"{r.activity_type or ''} {r.outcome or ''}".lower()
        ]
        promise_ids = {r.get("id") for r in payment_promises}
        follow_ups = [
            entity_dict(r) for r in collection_related if r.id not in promise_ids
        ]
        owner_by_customer = _collections_owner_by_customer(collection_related)
        balances, open_invoices = _enrich_collections_balances(
            balances, owner_by_customer=owner_by_customer
        )
        reminders = _c().payment_reminders
        return {
            "balances": balances,
            "open_invoices": open_invoices,
            "payment_promises": payment_promises,
            "follow_ups": follow_ups,
            "payment_reminders_available": reminders is not None,
            "can_send_payment_reminders": bool(policy.can_send_payment_reminders()),
            "aging_available": any(
                row.get("due_date") is not None or row.get("days_past_due") is not None
                for row in open_invoices
            ),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/customers/{customer_id}/related")
def customer_related(
    customer_id: str,
    _: str = Depends(require_permission("crm.leads.view")),
) -> dict[str, Any]:
    try:
        from vaybooks.bms.application.crm.collections_aging import build_customer_timeline
        from vaybooks.bms.domain.shared.date_utils import utc_now

        cid = (customer_id or "").strip()
        if not cid:
            raise ValidationError("customer_id is required")
        leads = [
            entity_dict(r)
            for r in _c().leads.list_leads(limit=2000)
            if (r.customer_id or "") == cid
        ]
        enquiries = [
            entity_dict(r)
            for r in _c().enquiries.list_enquiries(customer_id=cid, limit=2000)
        ]
        activity_entities = list(
            _c().activities.list_activities(customer_id=cid, limit=2000)
        )
        activities = [entity_dict(r) for r in activity_entities]
        timeline = build_customer_timeline(activity_entities, limit=15, now=utc_now())
        outstanding_balance = None
        open_invoice_outstanding = None
        accounting = getattr(_c(), "accounting", None)
        if accounting:
            try:
                acct = accounting.get_customer_account(cid)
                account_id = getattr(acct, "id", None) if acct else None
                if account_id:
                    try:
                        outstanding_balance = float(
                            accounting.customer_receivable_balance(account_id) or 0
                        )
                    except Exception:
                        outstanding_balance = float(
                            getattr(acct, "current_balance", 0) or 0
                        )
                    try:
                        open_rows = (
                            accounting.list_open_sales_invoices_for_customer(account_id)
                            or []
                        )
                        total = 0.0
                        for inv in open_rows:
                            if isinstance(inv, dict):
                                total += float(inv.get("outstanding", 0.0) or 0.0)
                            else:
                                total += float(getattr(inv, "outstanding", 0.0) or 0.0)
                        open_invoice_outstanding = total
                    except Exception:
                        open_invoice_outstanding = outstanding_balance
            except Exception:
                pass
        return {
            "customer_id": cid,
            "leads": leads,
            "enquiries": enquiries,
            "activities": activities,
            "recent_activities": [
                entity_dict(r) for r in timeline["recent_activities"]
            ],
            "timeline": [entity_dict(r) for r in timeline["timeline"]],
            "last_contact_at": timeline["last_contact_at"],
            "next_follow_up_at": timeline["next_follow_up_at"],
            "outstanding_balance": outstanding_balance,
            "open_invoice_outstanding": open_invoice_outstanding,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/list-views")
def list_list_views(
    *,
    entity: str,
    username: str = Depends(require_permission()),
) -> dict[str, Any]:
    try:
        key = _list_view_entity(entity)
        _ensure_permission(username, _LIST_VIEW_PERMISSIONS[key])
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        docs = list(
            db.crm_list_views.find({"username": username, "entity": key}).sort(
                "updated_at", -1
            )
        )
        items = [_serialize_list_view(doc) for doc in docs]
        return {"items": items, "total": len(items)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/list-views", status_code=201)
def create_list_view(
    body: ListViewCreate,
    username: str = Depends(require_permission()),
) -> dict[str, Any]:
    try:
        key = _list_view_entity(body.entity)
        _ensure_permission(username, _LIST_VIEW_PERMISSIONS[key])
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        name = body.name.strip()
        if not name:
            raise ValidationError("name is required")
        now = datetime.utcnow()
        view_id = uuid4().hex
        doc = {
            "_id": view_id,
            "username": username,
            "name": name,
            "entity": key,
            "filters": dict(body.filters or {}),
            "sort": list(body.sort or []),
            "columns": list(body.columns or []),
            "created_at": now,
            "updated_at": now,
        }
        db.crm_list_views.insert_one(doc)
        return _serialize_list_view(doc)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/list-views/{view_id}")
def delete_list_view(
    view_id: str,
    username: str = Depends(require_permission()),
) -> dict[str, Any]:
    try:
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        existing = db.crm_list_views.find_one({"_id": view_id, "username": username})
        if not existing:
            raise LookupError("List view not found")
        entity = str(existing.get("entity") or "")
        if entity in _LIST_VIEW_PERMISSIONS:
            _ensure_permission(username, _LIST_VIEW_PERMISSIONS[entity])
        result = db.crm_list_views.delete_one({"_id": view_id, "username": username})
        if result.deleted_count == 0:
            raise LookupError("List view not found")
        return {"ok": True, "id": view_id}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/report-presets")
def list_report_presets(
    username: str = Depends(require_permission("crm.reports.view")),
) -> dict[str, Any]:
    try:
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        docs = list(
            db.crm_report_presets.find({"username": username}).sort("updated_at", -1)
        )
        items = []
        for doc in docs:
            items.append(
                {
                    "id": doc.get("_id"),
                    "name": doc.get("name") or "",
                    "report_id": doc.get("report_id") or "",
                    "filters": doc.get("filters") or {},
                    "username": doc.get("username") or "",
                    "created_at": doc.get("created_at"),
                    "updated_at": doc.get("updated_at"),
                }
            )
        return {"items": items, "total": len(items)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/report-presets", status_code=201)
def create_report_preset(
    body: ReportPresetCreate,
    username: str = Depends(require_permission("crm.reports.view")),
) -> dict[str, Any]:
    try:
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        now = datetime.utcnow()
        preset_id = uuid4().hex
        doc = {
            "_id": preset_id,
            "username": username,
            "name": body.name.strip(),
            "report_id": body.report_id.strip(),
            "filters": dict(body.filters or {}),
            "created_at": now,
            "updated_at": now,
        }
        db.crm_report_presets.insert_one(doc)
        return {
            "id": preset_id,
            "name": doc["name"],
            "report_id": doc["report_id"],
            "filters": doc["filters"],
            "username": username,
            "created_at": now,
            "updated_at": now,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/report-presets/{preset_id}")
def delete_report_preset(
    preset_id: str,
    username: str = Depends(require_permission("crm.reports.view")),
) -> dict[str, Any]:
    try:
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        result = db.crm_report_presets.delete_one(
            {"_id": preset_id, "username": username}
        )
        if result.deleted_count == 0:
            raise LookupError("Report preset not found")
        return {"ok": True, "id": preset_id}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{entity_type}/{entity_id}/audit")
def list_entity_audit(
    entity_type: str,
    entity_id: str,
    *,
    limit: int = 200,
    _: str = Depends(require_permission("crm.audit.view")),
) -> dict[str, Any]:
    try:
        mapped = _AUDIT_ENTITY_TYPES.get((entity_type or "").strip().lower())
        if not mapped:
            raise ValidationError("entity_type must be lead, enquiry, or activity")
        audit = _c().audit
        if audit is None:
            raise ValidationError("CRM audit repository unavailable")
        rows = audit.list_for_entity(mapped, entity_id, limit=min(max(limit, 1), 500))
        return {"items": [entity_dict(r) for r in rows], "total": len(rows)}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{entity_type}/{entity_id}/restore")
def restore_entity(
    entity_type: str,
    entity_id: str,
    username: str = Depends(require_permission()),
) -> dict[str, Any]:
    try:
        key = (entity_type or "").strip().lower()
        perm = _RESTORE_PERMISSIONS.get(key)
        if not perm:
            raise ValidationError("entity_type must be lead, enquiry, or activity")
        _ensure_permission(username, perm)
        user = _load_user_by_username(username)
        actor_id = getattr(user, "id", "") or ""
        actor_name = getattr(user, "username", "") or username
        if key == "lead":
            entity = _c().leads.restore_lead(
                entity_id, actor_id=actor_id, actor_name=actor_name
            )
        elif key == "enquiry":
            entity = _c().enquiries.restore(
                entity_id, actor_id=actor_id, actor_name=actor_name
            )
        else:
            entity = _c().activities.restore(
                entity_id, actor_id=actor_id, actor_name=actor_name
            )
        return entity_dict(entity)
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/attachments", status_code=201)
async def upload_attachment(
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    file: UploadFile = File(...),
    _: str = Depends(require_permission("crm.leads.edit")),
) -> dict[str, Any]:
    try:
        if entity_type not in {"lead", "enquiry", "activity"}:
            raise ValidationError("entity_type must be lead, enquiry, or activity")
        raw = await file.read()
        attachment_id = uuid4().hex
        doc = {
            "_id": attachment_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "name": file.filename or "upload",
            "content_type": file.content_type or "application/octet-stream",
            "size_bytes": len(raw),
            "data": Binary(raw),
            "created_at": datetime.utcnow(),
        }
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        db.crm_attachments.insert_one(doc)
        _append_attachment(entity_type, entity_id, attachment_id)
        return {
            "id": attachment_id,
            "name": doc["name"],
            "content_type": doc["content_type"],
            "size_bytes": doc["size_bytes"],
            "entity_type": entity_type,
            "entity_id": entity_id,
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/attachments/{attachment_id}/meta")
def attachment_meta(
    attachment_id: str, _: str = Depends(require_permission("crm.leads.view"))
) -> dict[str, Any]:
    """Return attachment metadata without file bytes."""
    try:
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        doc = db.crm_attachments.find_one(
            {"_id": attachment_id},
            {"data": 0},
        )
        if not doc:
            raise LookupError("Attachment not found")
        return {
            "id": doc.get("_id") or attachment_id,
            "name": doc.get("name") or "file",
            "content_type": doc.get("content_type") or "application/octet-stream",
            "size_bytes": int(doc.get("size_bytes") or 0),
            "entity_type": doc.get("entity_type") or "",
            "entity_id": doc.get("entity_id") or "",
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/attachments/{attachment_id}")
def download_attachment(
    attachment_id: str, _: str = Depends(require_permission("crm.leads.view"))
):
    from fastapi.responses import Response

    try:
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        doc = db.crm_attachments.find_one({"_id": attachment_id})
        if not doc:
            raise LookupError("Attachment not found")
        return Response(
            content=bytes(doc.get("data") or b""),
            media_type=doc.get("content_type") or "application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{doc.get("name") or "file"}"'
            },
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: str, _: str = Depends(require_permission("crm.leads.edit"))
) -> dict[str, Any]:
    try:
        db = _c().db
        if db is None:
            raise ValidationError("CRM storage unavailable")
        doc = db.crm_attachments.find_one({"_id": attachment_id})
        if not doc:
            raise LookupError("Attachment not found")
        _remove_attachment_ref(doc.get("entity_type") or "", doc.get("entity_id") or "", attachment_id)
        db.crm_attachments.delete_one({"_id": attachment_id})
        return {"ok": True, "id": attachment_id}
    except Exception as exc:
        raise _http_err(exc) from exc
