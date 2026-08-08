"""Projects API — core, workspace, field (Mongo)."""

from __future__ import annotations

from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.projects_container import get_projects_container
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    customer_id: str = Field(min_length=1)
    contract_value: float = 0.0
    site_address: str = ""
    notes: str = ""
    location_id: str = ""
    location_name: str = ""


class ProjectPatch(BaseModel):
    name: Optional[str] = None
    contract_value: Optional[float] = None
    site_address: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class EnquiryCreate(BaseModel):
    customer_id: str = Field(min_length=1)
    site_address: str = ""
    requirement: str = ""
    source: str = ""
    internal_notes: str = ""
    customer_notes: str = ""


class BoqItemCreate(BaseModel):
    code: str = ""
    description: str = Field(min_length=1)
    unit: str = "Nos"
    qty: float = 0.0
    rate: float = 0.0


class MeasurementCreate(BaseModel):
    boq_item_id: str = Field(min_length=1)
    measurement_date: Optional[str] = None
    quantity: float = Field(gt=0)
    location: str = ""
    notes: str = ""


class RaCreate(BaseModel):
    claim_amount: float = Field(gt=0)
    description: str = ""
    measurement_ids: List[str] = Field(default_factory=list)


class TimeCreate(BaseModel):
    activity_id: str = Field(min_length=1)
    worker_id: str = Field(min_length=1)
    hours: float = Field(gt=0)
    work_date: Optional[str] = None
    notes: str = ""


class ExpenseCreate(BaseModel):
    amount: float = Field(gt=0)
    category: str = "General"
    description: str = ""
    expense_date: Optional[str] = None


class DocumentMeta(BaseModel):
    category: str = "general"
    name: str = Field(min_length=1)
    content_type: str = "text/plain"
    data_base64: str = ""


class DprCreate(BaseModel):
    report_date: Optional[str] = None
    weather: str = ""
    notes: str = ""


class PortalTokenCreate(BaseModel):
    scope: str = "quote"
    expires_in_days: int = 30
    label: str = ""


class ReportRunBody(BaseModel):
    report_type: str = Field(min_length=1)
    filters: dict[str, Any] = Field(default_factory=dict)


def _c():
    return get_projects_container()


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "projects", "status": "ok", "backend": _c().backend}


@router.get("/overview")
def overview() -> dict[str, Any]:
    try:
        portfolio = _c().profitability.portfolio_summary()
        return {
            "portfolio": [entity_dict(p) if not isinstance(p, dict) else p for p in portfolio],
            "project_count": len(portfolio),
            "quick_actions": [
                {"to": "/projects/list", "label": "Projects"},
                {"to": "/projects/enquiries", "label": "Enquiries"},
                {"to": "/projects/measurements", "label": "Measurements"},
                {"to": "/projects/ra-bills", "label": "RA Bills"},
                {"to": "/projects/reports", "label": "Reports"},
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/enquiries")
def list_enquiries() -> list[dict[str, Any]]:
    try:
        return [entity_dict(e) for e in _c().enquiries.list_enquiries()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/enquiries", status_code=201)
def create_enquiry(body: EnquiryCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().enquiries.create_enquiry(
                body.customer_id,
                site_address=body.site_address,
                requirement=body.requirement,
                source=body.source,
                internal_notes=body.internal_notes,
                customer_notes=body.customer_notes,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/enquiries/{enquiry_id}")
def get_enquiry(enquiry_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().enquiries.get_enquiry(enquiry_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("")
def list_projects() -> list[dict[str, Any]]:
    try:
        return [entity_dict(p) for p in _c().projects.list_projects()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("", status_code=201)
def create_project(body: ProjectCreate) -> dict[str, Any]:
    try:
        project = _c().projects.create_project(
            body.name,
            body.customer_id,
            body.contract_value,
            site_address=body.site_address,
            notes=body.notes,
            location_id=body.location_id,
            location_name=body.location_name,
        )
        publish(
            "ProjectCreated",
            {
                "project_id": project.id,
                "name": project.name,
                "customer_id": body.customer_id,
            },
        )
        return entity_dict(project)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/measurements")
def list_all_measurements() -> list[dict[str, Any]]:
    try:
        rows: list[dict[str, Any]] = []
        for project in _c().projects.list_projects():
            for m in _c().measurements.list_by_project(project.id):
                data = entity_dict(m)
                data["project_id"] = project.id
                data["project_name"] = getattr(project, "name", "")
                rows.append(data)
        return rows
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/ra-bills")
def list_all_ra_bills() -> list[dict[str, Any]]:
    try:
        rows: list[dict[str, Any]] = []
        for project in _c().projects.list_projects():
            for bill in _c().billing.list_ra_bills(project.id):
                data = entity_dict(bill)
                data["project_id"] = project.id
                data["project_name"] = getattr(project, "name", "")
                rows.append(data)
        return rows
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/reports/catalog")
def reports_catalog() -> dict[str, Any]:
    types = [
        "Portfolio Summary",
        "WIP Balances",
        "RA Bills",
        "Time Summary",
        "Expense Summary",
    ]
    return {"report_types": types}


@router.post("/reports/run")
def run_report(body: ReportRunBody) -> dict[str, Any]:
    try:
        rtype = body.report_type
        if rtype == "Portfolio Summary":
            rows = _c().profitability.portfolio_summary()
            return {"report_type": rtype, "rows": rows}
        if rtype == "Time Summary":
            rows = []
            for p in _c().projects.list_projects():
                entries = _c().time.list_by_project(p.id)
                rows.append({"project": p.name, "entries": len(entries)})
            return {"report_type": rtype, "rows": rows}
        if rtype == "Expense Summary":
            rows = []
            for p in _c().projects.list_projects():
                exps = _c().expenses.list_by_project(p.id) if hasattr(_c().expenses, "list_by_project") else []
                total = sum(float(getattr(e, "amount", 0) or 0) for e in exps)
                rows.append({"project": p.name, "total": total})
            return {"report_type": rtype, "rows": rows}
        if rtype == "RA Bills":
            return {"report_type": rtype, "rows": list_all_ra_bills()}
        if rtype == "WIP Balances":
            rows = []
            for p in _c().projects.list_projects():
                try:
                    rows.append({"project": p.name, **_c().billing.get_wip_balances(p.id)})
                except Exception:
                    rows.append({"project": p.name})
            return {"report_type": rtype, "rows": rows}
        raise ValidationError(f"Unknown report: {rtype}")
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/settings")
def project_module_settings() -> dict[str, Any]:
    try:
        activities = []
        if hasattr(_c().activity_configs, "list_all"):
            activities = [entity_dict(a) for a in _c().activity_configs.list_all()]
        elif hasattr(_c().activity_configs, "list_activities"):
            activities = [entity_dict(a) for a in _c().activity_configs.list_activities()]
        return {"activity_configs": activities}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    try:
        project = _c().projects.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        data = entity_dict(project)
        data["progress"] = _c().projects.get_weighted_progress(project_id)
        return data
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch("/{project_id}")
def update_project(project_id: str, body: ProjectPatch) -> dict[str, Any]:
    try:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        return entity_dict(_c().projects.update_project_settings(project_id, **fields))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/workspace")
def project_workspace(project_id: str) -> dict[str, Any]:
    try:
        project = _c().projects.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return {
            "project": entity_dict(project),
            "boq_totals": _c().boq.rollup_totals(project_id),
            "measurements": [entity_dict(m) for m in _c().measurements.list_by_project(project_id)],
            "ra_bills": [entity_dict(b) for b in _c().billing.list_ra_bills(project_id)],
            "time_entries": [entity_dict(t) for t in _c().time.list_by_project(project_id)],
            "documents": [
                entity_dict(d)
                for d in _c().documents.list_by_project(project_id, include_data=False)
            ],
            "progress": _c().projects.get_weighted_progress(project_id),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/boq")
def list_boq(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(i) for i in _c().boq.list_items(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/boq", status_code=201)
def create_boq_item(project_id: str, body: BoqItemCreate) -> dict[str, Any]:
    try:
        item = _c().boq.create_item(
            project_id,
            body.code or "ITEM",
            body.description,
            unit=body.unit,
            estimated_qty=body.qty,
            selling_rate=body.rate,
        )
        return entity_dict(item)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/measurements")
def list_measurements(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(m) for m in _c().measurements.list_by_project(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/measurements", status_code=201)
def create_measurement(project_id: str, body: MeasurementCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().measurements.create(
                project_id,
                body.boq_item_id,
                _parse_date(body.measurement_date) or date.today(),
                body.quantity,
                location=body.location,
                notes=body.notes,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/ra-bills")
def list_ra(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(b) for b in _c().billing.list_ra_bills(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/ra-bills", status_code=201)
def create_ra(project_id: str, body: RaCreate) -> dict[str, Any]:
    try:
        if body.measurement_ids:
            bill = _c().billing.create_ra_from_measurements(
                project_id, body.measurement_ids, description=body.description
            )
        else:
            bill = _c().billing.create_ra_bill(
                project_id, body.claim_amount, description=body.description
            )
        return entity_dict(bill)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/time")
def list_time(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(t) for t in _c().time.list_by_project(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/time", status_code=201)
def create_time(project_id: str, body: TimeCreate) -> dict[str, Any]:
    try:
        rows = _c().time.create_time_entries(
            project_id,
            body.activity_id,
            [{"worker_id": body.worker_id, "hours": body.hours}],
            _parse_date(body.work_date) or date.today(),
            notes=body.notes,
        )
        return entity_dict(rows[0] if rows else {})
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/expenses")
def list_expenses(project_id: str) -> list[dict[str, Any]]:
    try:
        svc = _c().expenses
        if hasattr(svc, "list_by_project"):
            return [entity_dict(e) for e in svc.list_by_project(project_id)]
        return []
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/expenses", status_code=201)
def create_expense(project_id: str, body: ExpenseCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().expenses.create_expense(
                project_id,
                _parse_date(body.expense_date) or date.today(),
                body.description or body.category or "Expense",
                "Other",
                body.amount,
                notes=body.description,
                cost_category=body.category,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/documents")
def list_documents(project_id: str) -> list[dict[str, Any]]:
    try:
        return [
            entity_dict(d)
            for d in _c().documents.list_by_project(project_id, include_data=False)
        ]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/dpr")
def list_dpr(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(d) for d in _c().dpr.list_dprs(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/dpr", status_code=201)
def create_dpr(project_id: str, body: DprCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().dpr.create_dpr(
                project_id,
                _parse_date(body.report_date) or date.today(),
                weather=body.weather,
                notes=body.notes,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/portal")
def list_portal_tokens(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(t) for t in _c().portal.list_tokens(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/portal", status_code=201)
def create_portal_token(project_id: str, body: PortalTokenCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().portal.create_portal_token(
                project_id,
                scope=body.scope,
                expires_in_days=body.expires_in_days,
                label=body.label,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/site-mobile")
def site_mobile(project_id: str) -> dict[str, Any]:
    try:
        project = _c().projects.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return {
            "project": entity_dict(project),
            "dprs": [entity_dict(d) for d in _c().dpr.list_dprs(project_id)],
            "measurements": [entity_dict(m) for m in _c().measurements.list_by_project(project_id)],
            "time_entries": [entity_dict(t) for t in _c().time.list_by_project(project_id)],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc
