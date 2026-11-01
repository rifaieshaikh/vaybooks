"""Projects API — core, workspace, field (Mongo)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.projects_container import get_projects_container
from services.common.authz import require_permission
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/projects", tags=["projects"])

RECENT_PROJECT_LIMIT = 5


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    customer_id: str = Field(min_length=1)
    contract_value: float = 0.0
    site_address: str = ""
    notes: str = ""
    location_id: str = ""
    location_name: str = ""
    start_date: Optional[str] = None
    expected_end_date: Optional[str] = None


class ProjectPatch(BaseModel):
    name: Optional[str] = None
    contract_value: Optional[float] = None
    site_address: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    expected_end_date: Optional[str] = None
    retention_pct: Optional[float] = None
    overhead_allocation_pct: Optional[float] = None
    billing_mode: Optional[str] = None
    project_manager: Optional[str] = None
    hard_budget_check: Optional[bool] = None


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
    if isinstance(exc, HTTPException):
        return exc
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


_require_ra_approve = Depends(require_permission("projects.ra_bills.approve"))
_require_project_edit = Depends(require_permission("projects.projects.edit"))
_require_project_view = Depends(require_permission("projects.projects.view"))
_require_enquiry_view = Depends(require_permission("projects.enquiries.view"))
_require_enquiry_create = Depends(require_permission("projects.enquiries.create"))
_require_enquiry_edit = Depends(require_permission("projects.enquiries.edit"))
_require_reports_view = Depends(require_permission("projects.reports.view"))


def _audit(
    project_id: str, entity_type: str, entity_id: str, action: str, **kwargs: Any
) -> None:
    """Best-effort project history recording; never affect the primary operation."""
    try:
        audit = getattr(_c(), "audit", None)
        if audit is not None:
            audit.record(project_id, entity_type, entity_id, action, **kwargs)
    except Exception:
        pass


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "projects", "status": "ok", "backend": _c().backend}


@router.get("/overview", dependencies=[_require_project_view])
def overview() -> dict[str, Any]:
    try:
        portfolio = _c().profitability.portfolio_summary()
        return {
            "portfolio": [entity_dict(p) if not isinstance(p, dict) else p for p in portfolio],
            "project_count": len(portfolio),
            "quick_actions": [
                {"to": "/projects/list", "label": "Projects"},
                {"to": "/projects/calendar", "label": "Calendar"},
                {"to": "/projects/enquiries", "label": "Enquiries"},
                {"to": "/projects/measurements", "label": "Measurements"},
                {"to": "/projects/ra-bills", "label": "RA Bills"},
                {"to": "/projects/reports", "label": "Reports"},
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/enquiries", dependencies=[_require_enquiry_view])
def list_enquiries() -> list[dict[str, Any]]:
    try:
        return [entity_dict(e) for e in _c().enquiries.list_enquiries()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/enquiries", status_code=201, dependencies=[_require_enquiry_create])
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


@router.get("/enquiries/{enquiry_id}", dependencies=[_require_enquiry_view])
def get_enquiry(enquiry_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().enquiries.get_enquiry(enquiry_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("", dependencies=[_require_project_view])
def list_projects() -> list[dict[str, Any]]:
    try:
        return [entity_dict(p) for p in _c().projects.list_projects()]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("", status_code=201, dependencies=[_require_project_edit])
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
            start_date=_parse_date(body.start_date),
            expected_end_date=_parse_date(body.expected_end_date),
        )
        publish(
            "ProjectCreated",
            {
                "project_id": project.id,
                "name": project.name,
                "customer_id": body.customer_id,
            },
        )
        _audit(project.id, "project", project.id, "created", after=entity_dict(project))
        return entity_dict(project)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/measurements", dependencies=[_require_project_view])
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


@router.get("/ra-bills", dependencies=[_require_project_view])
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


@router.get("/reports/catalog", dependencies=[_require_reports_view])
def reports_catalog() -> dict[str, Any]:
    types = [
        "Portfolio Summary",
        "WIP Balances",
        "RA Bills",
        "Time Summary",
        "Expense Summary",
    ]
    return {"report_types": types}


@router.post("/reports/run", dependencies=[_require_reports_view])
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


@router.get("/settings", dependencies=[_require_project_view])
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


@router.get(
    "/customers/{customer_id}/related-summary", dependencies=[_require_project_view]
)
def customer_related_summary(
    customer_id: str,
    _: str = Depends(
        require_permission(
            "parties.customers.view", "parties.customers.insights.view"
        )
    ),
) -> dict[str, Any]:
    """Customer-scoped project summary and recent projects."""
    try:
        projects_svc = _c().projects
    except Exception:
        return {"available": False}
    if projects_svc is None:
        return {"available": False}

    try:
        summary = dict(projects_svc.get_customer_summary(customer_id) or {})
        projects: list[Any] = []
        try:
            if hasattr(projects_svc, "list_by_customer"):
                projects = list(projects_svc.list_by_customer(customer_id) or [])
            else:
                projects = [
                    p
                    for p in (projects_svc.list_projects() or [])
                    if str(getattr(p, "customer_id", "") or "") == customer_id
                ]
        except Exception:
            projects = []

        def _sort_key(project: Any):
            raw = (
                getattr(project, "updated_at", None)
                or getattr(project, "created_at", None)
                or getattr(project, "start_date", None)
            )
            if raw is None:
                return datetime.min
            if isinstance(raw, datetime):
                return raw.replace(tzinfo=None) if raw.tzinfo else raw
            if isinstance(raw, date):
                return datetime.combine(raw, datetime.min.time())
            return datetime.min

        try:
            projects.sort(key=_sort_key, reverse=True)
        except Exception:
            pass

        recent: list[dict[str, Any]] = []
        for p in projects[:RECENT_PROJECT_LIMIT]:
            try:
                recent.append(entity_dict(p))
            except Exception:
                continue

        # Average billed margin (falls back to budget margin) across projects.
        try:
            profitability = _c().profitability
            margins: list[float] = []
            billed_revenues: list[float] = []
            for project in projects:
                try:
                    row = profitability.get_project_profitability(project.id)
                except Exception:
                    continue
                margin = getattr(row, "billed_margin", None)
                if margin is None:
                    margin = getattr(row, "budget_margin", None)
                if margin is not None:
                    margins.append(float(margin))
                billed = getattr(row, "billed_revenue", None)
                if billed is not None:
                    billed_revenues.append(float(billed))
            if margins:
                summary["avg_margin"] = round(sum(margins) / len(margins), 2)
            else:
                summary["avg_margin"] = None
            summary["total_billed_revenue"] = round(sum(billed_revenues), 2)
        except Exception:
            summary.setdefault("avg_margin", None)
            summary.setdefault("total_billed_revenue", 0.0)

        return {"available": True, "summary": summary, "recent": recent}
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}", dependencies=[_require_project_view])
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


@router.patch("/{project_id}", dependencies=[_require_project_edit])
def update_project(project_id: str, body: ProjectPatch) -> dict[str, Any]:
    try:
        from vaybooks.bms.domain.shared.enums import ProjectBillingMode, ProjectStatus

        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        if "start_date" in fields:
            fields["start_date"] = _parse_date(fields["start_date"])
        if "expected_end_date" in fields:
            fields["expected_end_date"] = _parse_date(fields["expected_end_date"])
        if "status" in fields:
            fields["status"] = ProjectStatus(str(fields["status"]))
        if "billing_mode" in fields:
            fields["billing_mode"] = ProjectBillingMode(str(fields["billing_mode"]))
        project = _c().projects.update_project_settings(project_id, **fields)
        _audit(project_id, "project", project_id, "updated", after=entity_dict(project))
        return entity_dict(project)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/workspace", dependencies=[_require_project_view])
def project_workspace(project_id: str) -> dict[str, Any]:
    try:
        project = _c().projects.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        budget_summary: dict[str, Any] = {}
        expenses: list[Any] = []
        try:
            budget_summary = _c().budget.budget_summary(project_id)
        except Exception:
            pass
        try:
            if hasattr(_c().expenses, "list_by_project"):
                expenses = _c().expenses.list_by_project(project_id)
        except Exception:
            pass
        accounting_lite: dict[str, Any] = {}
        try:
            accounting_lite = {
                "party_balances": _c().billing.get_party_balances(project_id),
                "wip_balances": _c().billing.get_wip_balances(project_id),
            }
        except Exception:
            pass
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
            "budget_summary": budget_summary,
            "expenses_count": len(expenses),
            "accounting_summary": accounting_lite,
            "activities": [entity_dict(activity) for activity in project.activities],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/boq", dependencies=[_require_project_view])
def list_boq(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(i) for i in _c().boq.list_items(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/boq", status_code=201, dependencies=[_require_project_edit]
)
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
        _audit(project_id, "boq_item", item.id, "created", after=entity_dict(item))
        return entity_dict(item)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/measurements", dependencies=[_require_project_view])
def list_measurements(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(m) for m in _c().measurements.list_by_project(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/measurements", status_code=201, dependencies=[_require_project_edit]
)
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


@router.get("/{project_id}/ra-bills", dependencies=[_require_project_view])
def list_ra(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(b) for b in _c().billing.list_ra_bills(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/ra-bills", status_code=201, dependencies=[_require_project_edit]
)
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


@router.get("/{project_id}/time", dependencies=[_require_project_view])
def list_time(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(t) for t in _c().time.list_by_project(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/time", status_code=201, dependencies=[_require_project_edit]
)
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


@router.get("/{project_id}/expenses", dependencies=[_require_project_view])
def list_expenses(project_id: str) -> list[dict[str, Any]]:
    try:
        svc = _c().expenses
        if hasattr(svc, "list_by_project"):
            return [entity_dict(e) for e in svc.list_by_project(project_id)]
        return []
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/expenses", status_code=201, dependencies=[_require_project_edit]
)
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


@router.get("/{project_id}/documents", dependencies=[_require_project_view])
def list_documents(project_id: str) -> list[dict[str, Any]]:
    try:
        return [
            entity_dict(d)
            for d in _c().documents.list_by_project(project_id, include_data=False)
        ]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/dpr", dependencies=[_require_project_view])
def list_dpr(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(d) for d in _c().dpr.list_dprs(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/dpr", status_code=201, dependencies=[_require_project_edit]
)
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


@router.get("/{project_id}/portal", dependencies=[_require_project_view])
def list_portal_tokens(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(t) for t in _c().portal.list_tokens(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/portal", status_code=201, dependencies=[_require_project_edit]
)
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


@router.get("/{project_id}/site-mobile", dependencies=[_require_project_view])
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


class BudgetLineCreate(BaseModel):
    cost_category: str = "General"
    amount: float = Field(gt=0)
    boq_item_id: str = ""
    activity_id: str = ""
    notes: str = ""


class MeasurementActionBody(BaseModel):
    actor: str = ""


class EnquiryStatusBody(BaseModel):
    status: str = Field(min_length=1)


@router.get("/{project_id}/budget", dependencies=[_require_project_view])
def list_budget(project_id: str) -> dict[str, Any]:
    try:
        return {
            "summary": _c().budget.budget_summary(project_id),
            "lines": [entity_dict(line) for line in _c().budget.list_lines(project_id)],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/budget/lines",
    status_code=201,
    dependencies=[_require_project_edit],
)
def add_budget_line(project_id: str, body: BudgetLineCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().budget.add_line(
                project_id,
                body.cost_category,
                body.amount,
                boq_item_id=body.boq_item_id,
                activity_id=body.activity_id,
                notes=body.notes,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/measurements/{measurement_id}/submit",
    dependencies=[_require_project_edit],
)
def submit_measurement(project_id: str, measurement_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().measurements.submit(measurement_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/measurements/{measurement_id}/verify",
    dependencies=[_require_project_edit],
)
def verify_measurement(
    project_id: str, measurement_id: str, body: Optional[MeasurementActionBody] = None
) -> dict[str, Any]:
    try:
        actor = (body.actor if body else "") or ""
        return entity_dict(_c().measurements.verify(measurement_id, verified_by=actor))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/measurements/{measurement_id}/certify",
    dependencies=[_require_project_edit],
)
def certify_measurement(
    project_id: str, measurement_id: str, body: Optional[MeasurementActionBody] = None
) -> dict[str, Any]:
    try:
        actor = (body.actor if body else "") or ""
        return entity_dict(_c().measurements.certify(measurement_id, certified_by=actor))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/ra-bills/{ra_id}/submit", dependencies=[_require_project_edit]
)
def submit_ra_bill(project_id: str, ra_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().billing.submit_ra(ra_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/ra-bills/{ra_id}/certify")
def certify_ra_bill(
    project_id: str,
    ra_id: str,
    body: Optional[MeasurementActionBody] = None,
    _: str = _require_ra_approve,
) -> dict[str, Any]:
    try:
        # Empty certifications → certify claimed qty on each line (billing service default).
        actor = (body.actor if body else "") or ""
        return entity_dict(
            _c().billing.certify_ra(ra_id, line_certifications=[], certified_by=actor)
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/ra-bills/{ra_id}/approve")
def approve_ra_bill(
    project_id: str, ra_id: str, _: str = _require_ra_approve
) -> dict[str, Any]:
    try:
        return entity_dict(_c().billing.approve_ra(ra_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/documents", status_code=201, dependencies=[_require_project_edit]
)
def upload_document(project_id: str, body: DocumentMeta) -> dict[str, Any]:
    try:
        import base64

        raw = base64.b64decode(body.data_base64) if body.data_base64 else b""
        return entity_dict(
            _c().documents.upload(
                project_id,
                body.category,
                body.name,
                body.content_type,
                raw,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch(
    "/enquiries/{enquiry_id}/status", dependencies=[_require_enquiry_edit]
)
def patch_enquiry_status(enquiry_id: str, body: EnquiryStatusBody) -> dict[str, Any]:
    try:
        return entity_dict(_c().enquiries.update_status(enquiry_id, body.status))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/enquiries/{enquiry_id}/start-estimation", dependencies=[_require_enquiry_edit]
)
def start_enquiry_estimation(enquiry_id: str) -> dict[str, Any]:
    try:
        project = _c().enquiries.start_estimation(enquiry_id)
        return entity_dict(project)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/enquiries/{enquiry_id}/mark-won", dependencies=[_require_enquiry_edit]
)
def mark_enquiry_won(enquiry_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_c().enquiries.mark_won(enquiry_id))
    except Exception as exc:
        raise _http_err(exc) from exc


class ActivityCreate(BaseModel):
    name: str = Field(min_length=1)
    parent_activity_id: str = ""
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None
    percent_complete: float = 0
    weightage: float = 0
    planned_hours: float = 0
    planned_cost: float = 0
    planned_revenue_amount: float = 0


class ActivityPatch(BaseModel):
    name: Optional[str] = None
    percent_complete: Optional[float] = None
    weightage: Optional[float] = None
    status: Optional[str] = None
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None
    planned_hours: Optional[float] = None
    planned_cost: Optional[float] = None
    planned_revenue_amount: Optional[float] = None


class QuotationCreate(BaseModel):
    notes: str = ""
    lines: List[dict] = Field(default_factory=list)
    quotation_date: Optional[str] = None
    valid_until: Optional[str] = None


class WorkOrderCreate(BaseModel):
    description: str = ""
    quotation_id: str = ""
    wo_date: Optional[str] = None


class ConvertInvoiceBody(BaseModel):
    store_account_id: str = Field(min_length=1)
    amount_received: float = 0
    voucher_date: Optional[str] = None
    store_invoice_number: str = ""
    confirm_over_contract: bool = False


class ReceiptCreate(BaseModel):
    receiving_account_id: str = Field(min_length=1)
    customer_account_id: str = Field(min_length=1)
    amount: float = Field(gt=0)
    description: str = ""
    voucher_date: Optional[str] = None
    allocation_invoice_id: Optional[str] = None
    allocations: Optional[List[dict]] = None


class VendorPaymentCreate(BaseModel):
    vendor_account_id: str = Field(min_length=1)
    expense_account_id: str = Field(min_length=1)
    paying_account_id: str = Field(min_length=1)
    amount: float = Field(gt=0)
    description: str = ""
    voucher_date: Optional[str] = None
    tds_amount: float = 0
    tds_section: str = ""
    tds_rate: float = 0
    gross_amount: Optional[float] = None


class RetentionReleaseBody(BaseModel):
    amount: Optional[float] = None
    released_by: str = ""


class ProformaCreate(BaseModel):
    description: str = ""
    amount: float = Field(gt=0)
    proforma_date: Optional[str] = None
    lines: List[dict] = Field(default_factory=list)


class VariationCreate(BaseModel):
    new_contract_value: float
    reason: str = Field(min_length=1)
    variation_date: Optional[str] = None
    change_class: str = "Scope"
    cost_impact: float = 0
    margin_impact: float = 0


class RecognitionDraftBody(BaseModel):
    period_end: str
    method: str = "Percent Complete"
    percent_complete: float = 0
    total_cost: float = 0
    billed_to_date: float = 0
    prior_recognised: float = 0
    estimated_total_cost: float = 0
    notes: str = ""
    idempotency_key: str = ""


class ReconciliationCreate(BaseModel):
    period_end: str = ""
    as_of: Optional[str] = None
    notes: str = ""
    project_subledger: float = 0.0
    gl_balance: float = 0.0
    ar_balance: float = 0.0
    ap_balance: float = 0.0


def _optional_service(name: str) -> Any:
    service = getattr(_c(), name, None)
    if service is None:
        raise HTTPException(status_code=503, detail=f"{name.title()} service is unavailable")
    return service


@router.get("/{project_id}/activities", dependencies=[_require_project_view])
def list_activities(project_id: str) -> list[dict[str, Any]]:
    try:
        project = _c().projects.get_project(project_id)
        if not project:
            raise LookupError("Project not found")
        return [entity_dict(activity) for activity in project.activities]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/activities", status_code=201, dependencies=[_require_project_edit]
)
def create_activity(project_id: str, body: ActivityCreate) -> list[dict[str, Any]]:
    try:
        project = _c().projects.add_activity(
            project_id,
            body.name,
            parent_activity_id=body.parent_activity_id or None,
            planned_start=_parse_date(body.planned_start),
            planned_end=_parse_date(body.planned_end),
            percent_complete=body.percent_complete,
            weightage=body.weightage,
            planned_hours=body.planned_hours,
            planned_cost=body.planned_cost,
            planned_revenue_amount=body.planned_revenue_amount,
        )
        activity_id = str(getattr(project.activities[-1], "id", "") or body.name)
        _audit(project_id, "activity", activity_id, "created")
        return [entity_dict(activity) for activity in project.activities]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.patch(
    "/{project_id}/activities/{activity_id}", dependencies=[_require_project_edit]
)
def patch_activity(
    project_id: str, activity_id: str, body: ActivityPatch
) -> list[dict[str, Any]]:
    try:
        from vaybooks.bms.domain.shared.enums import ProjectActivityStatus

        fields = {key: value for key, value in body.model_dump().items() if value is not None}
        for field in ("planned_start", "planned_end"):
            if field in fields:
                fields[field] = _parse_date(fields[field])
        if "status" in fields:
            fields["status"] = ProjectActivityStatus(fields["status"])
        project = _c().projects.update_activity(project_id, activity_id, **fields)
        return [entity_dict(activity) for activity in project.activities]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/costs", dependencies=[_require_project_view])
def project_costs(project_id: str) -> dict[str, Any]:
    try:
        billing = _c().billing
        transfer_repo = getattr(billing, "_transfer_repo", None)
        write_off_repo = getattr(billing, "_write_off_repo", None)
        return {
            "expenses": [entity_dict(row) for row in _c().expenses.list_by_project(project_id)],
            "transfers": [
                entity_dict(row)
                for row in (
                    transfer_repo.list_by_project(project_id) if transfer_repo else []
                )
            ],
            "write_offs": [
                entity_dict(row)
                for row in (
                    write_off_repo.list_by_project(project_id) if write_off_repo else []
                )
            ],
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/closure-blockers", dependencies=[_require_project_view])
def closure_blockers(project_id: str) -> list[dict[str, Any]]:
    try:
        return _c().projects.get_closure_blockers(
            project_id,
            billing_service=_c().billing,
            measurement_service=_c().measurements,
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/profitability", dependencies=[_require_project_view])
def project_profitability(project_id: str) -> dict[str, Any]:
    try:
        result = _c().profitability.get_project_profitability(project_id)
        return result if isinstance(result, dict) else entity_dict(result)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/accounting-summary", dependencies=[_require_project_view])
def accounting_summary(project_id: str) -> dict[str, Any]:
    try:
        billing = _c().billing
        retention_repo = getattr(billing, "_retention_repo", None)
        retention_total = 0.0
        if retention_repo:
            retention_total = sum(
                float(row.withheld_amount or 0) - float(row.released_amount or 0)
                for row in retention_repo.list_by_project(project_id)
            )
        party_balances = billing.get_party_balances(project_id)
        wip_balances = billing.get_wip_balances(project_id)
        budget = _c().budget.budget_summary(project_id)
        return {
            "party_balances": party_balances,
            "wip_balances": wip_balances,
            "books_match": billing.books_match(project_id),
            "budget": budget,
            "progress": _c().projects.get_weighted_progress(project_id),
            "retention_total": round(retention_total, 2),
            # UI-friendly aliases
            "party": party_balances,
            "wip": wip_balances,
            "retention": round(retention_total, 2),
            "billed": wip_balances.get("billed_revenue"),
            "contract_value": wip_balances.get("contract_value"),
            "total_cost": wip_balances.get("total_cost"),
            "wip_unbilled": wip_balances.get("unbilled_cost"),
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/history", dependencies=[_require_project_view])
def project_history(project_id: str, limit: int = 200) -> list[dict[str, Any]]:
    try:
        if not _c().projects.get_project(project_id):
            raise LookupError("Project not found")
        return [
            entity_dict(entry)
            for entry in _c().audit.list_by_project(project_id, limit=limit)
        ]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/quotations", dependencies=[_require_project_view])
def list_quotations(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(row) for row in _optional_service("quotations").list_by_project(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/quotations", status_code=201, dependencies=[_require_project_edit]
)
def create_quotation(project_id: str, body: QuotationCreate) -> dict[str, Any]:
    try:
        quotation = _optional_service("quotations").create_quotation(
            project_id,
            quotation_date=_parse_date(body.quotation_date),
            lines=body.lines,
            notes=body.notes,
            valid_until=_parse_date(body.valid_until),
        )
        return entity_dict(quotation)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/quotations/{quotation_id}/send",
    dependencies=[_require_project_edit],
)
def send_quotation(project_id: str, quotation_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_optional_service("quotations").send_quotation(quotation_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/quotations/{quotation_id}/revise",
    dependencies=[_require_project_edit],
)
def revise_quotation(project_id: str, quotation_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_optional_service("quotations").revise_quotation(quotation_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/quotations/{quotation_id}/accept",
    dependencies=[_require_project_edit],
)
def accept_quotation(project_id: str, quotation_id: str) -> dict[str, Any]:
    try:
        return entity_dict(_optional_service("quotations").accept_quotation(quotation_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/work-orders", dependencies=[_require_project_view])
def list_work_orders(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(row) for row in _c().billing.list_work_orders(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/work-orders", status_code=201, dependencies=[_require_project_edit]
)
def create_work_order(project_id: str, body: WorkOrderCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().billing.create_work_order(
                project_id,
                wo_date=_parse_date(body.wo_date),
                description=body.description,
                quotation_id=body.quotation_id,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/ra-bills/{ra_id}/convert-invoice")
def convert_ra_invoice(
    project_id: str,
    ra_id: str,
    body: ConvertInvoiceBody,
    _: str = _require_ra_approve,
) -> dict[str, Any]:
    try:
        invoice = _c().billing.convert_ra_to_invoice(
            ra_id,
            body.store_account_id,
            amount_received=body.amount_received,
            voucher_date=_parse_date(body.voucher_date),
            store_invoice_number=body.store_invoice_number,
            confirm_over_contract=body.confirm_over_contract,
        )
        _audit(project_id, "ra_bill", ra_id, "converted_to_invoice", after=entity_dict(invoice))
        return entity_dict(invoice)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/invoices", dependencies=[_require_project_view])
def list_invoices(project_id: str) -> list[dict[str, Any]]:
    try:
        from vaybooks.bms.domain.shared.enums import VoucherType

        invoice_types = {VoucherType.SALES_INVOICE, VoucherType.CUSTOMIZATION_INVOICE}
        return [
            entity_dict(voucher)
            for voucher in _c().billing._list_project_vouchers(project_id)
            if voucher.voucher_type in invoice_types
        ]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/proformas", dependencies=[_require_project_view])
def list_proformas(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(row) for row in _c().billing.list_proformas(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/proformas", status_code=201, dependencies=[_require_project_edit]
)
def create_proforma(project_id: str, body: ProformaCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().billing.create_proforma(
                project_id,
                proforma_date=_parse_date(body.proforma_date),
                description=body.description,
                lines=body.lines,
                amount=body.amount,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/variations", dependencies=[_require_project_view])
def list_variations(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(row) for row in _c().billing.list_variations(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post(
    "/{project_id}/variations", status_code=201, dependencies=[_require_project_edit]
)
def create_variation(project_id: str, body: VariationCreate) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().billing.create_variation(
                project_id,
                body.new_contract_value,
                body.reason,
                variation_date=_parse_date(body.variation_date),
                change_class=body.change_class,
                cost_impact=body.cost_impact,
                margin_impact=body.margin_impact,
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/variations/{variation_id}/approve")
def approve_variation(
    project_id: str, variation_id: str, _: str = _require_project_edit
) -> dict[str, Any]:
    try:
        return entity_dict(_c().billing.approve_variation(variation_id))
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/vouchers", dependencies=[_require_project_view])
def list_project_vouchers(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(row) for row in _c().billing._list_project_vouchers(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/receipts", status_code=201)
def create_project_receipt(
    project_id: str, body: ReceiptCreate, _: str = _require_project_edit
) -> dict[str, Any]:
    try:
        result = _c().billing.create_receipt(
            project_id,
            body.receiving_account_id,
            body.customer_account_id,
            body.amount,
            body.description,
            voucher_date=_parse_date(body.voucher_date),
            allocation_invoice_id=body.allocation_invoice_id,
            allocations=body.allocations,
        )
        voucher = result.get("voucher")
        _audit(
            project_id,
            "receipt",
            str(getattr(voucher, "id", "") or ""),
            "created",
            after=entity_dict(voucher) if voucher is not None else None,
        )
        return {
            key: entity_dict(value) if key == "voucher" else value
            for key, value in result.items()
        }
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/vendor-payments", status_code=201)
def create_project_vendor_payment(
    project_id: str, body: VendorPaymentCreate, _: str = _require_project_edit
) -> dict[str, Any]:
    try:
        payment = _c().billing.create_vendor_payment(
            project_id,
            body.vendor_account_id,
            body.expense_account_id,
            body.paying_account_id,
            body.amount,
            body.description,
            voucher_date=_parse_date(body.voucher_date),
            gross_amount=body.gross_amount,
            tds_section=body.tds_section,
            tds_rate=body.tds_rate,
            tds_amount=body.tds_amount,
        )
        _audit(project_id, "vendor_payment", payment.id, "created", after=entity_dict(payment))
        return entity_dict(payment)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/retentions", dependencies=[_require_project_view])
def list_retentions(project_id: str) -> list[dict[str, Any]]:
    try:
        retention_repo = getattr(_c().billing, "_retention_repo", None)
        if retention_repo is None:
            raise HTTPException(status_code=503, detail="Retention service is unavailable")
        return [entity_dict(row) for row in retention_repo.list_by_project(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/retentions/{retention_id}/release")
def release_retention(
    project_id: str,
    retention_id: str,
    body: RetentionReleaseBody,
    _: str = _require_project_edit,
) -> dict[str, Any]:
    try:
        return entity_dict(
            _c().billing.release_retention(
                retention_id, amount=body.amount, released_by=body.released_by
            )
        )
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/recognition", dependencies=[_require_project_view])
def list_recognition(project_id: str) -> list[dict[str, Any]]:
    try:
        return [entity_dict(row) for row in _optional_service("recognition").list_entries(project_id)]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/recognition", status_code=201)
def draft_recognition(
    project_id: str, body: RecognitionDraftBody, _: str = _require_project_edit
) -> dict[str, Any]:
    try:
        period_end = _parse_date(body.period_end)
        if period_end is None:
            raise ValidationError("period_end is required")
        entry = _optional_service("recognition").draft_recognition(
            project_id,
            period_end,
            body.method,
            percent_complete=body.percent_complete,
            total_cost=body.total_cost,
            billed_to_date=body.billed_to_date,
            prior_recognised=body.prior_recognised,
            estimated_total_cost=body.estimated_total_cost,
            notes=body.notes,
            idempotency_key=body.idempotency_key,
        )
        _audit(project_id, "recognition", entry.id, "drafted", after=entity_dict(entry))
        return entity_dict(entry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/recognition/{entry_id}/post")
def post_recognition(
    project_id: str, entry_id: str, _: str = _require_project_edit
) -> dict[str, Any]:
    try:
        entry = _optional_service("recognition").post(entry_id)
        _audit(project_id, "recognition", entry_id, "posted", after=entity_dict(entry))
        return entity_dict(entry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/recognition/{entry_id}/approve")
def approve_recognition(
    project_id: str, entry_id: str, _: str = _require_project_edit
) -> dict[str, Any]:
    try:
        entry = _optional_service("recognition").approve(entry_id)
        _audit(project_id, "recognition", entry_id, "approved", after=entity_dict(entry))
        return entity_dict(entry)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/{project_id}/reconciliations", dependencies=[_require_project_view])
def list_reconciliations(project_id: str) -> list[dict[str, Any]]:
    try:
        return [
            entity_dict(row)
            for row in _optional_service("recognition").list_reconciliations(project_id)
        ]
    except Exception as exc:
        raise _http_err(exc) from exc


@router.post("/{project_id}/reconciliations", status_code=201)
def create_reconciliation(
    project_id: str, body: ReconciliationCreate, _: str = _require_project_edit
) -> dict[str, Any]:
    try:
        as_of = _parse_date(body.as_of or body.period_end)
        if as_of is None:
            raise ValidationError("as_of / period_end is required")
        reconciliation = _optional_service("recognition").create_reconciliation(
            project_id,
            as_of,
            project_subledger=body.project_subledger,
            gl_balance=body.gl_balance,
            ar_balance=body.ar_balance,
            ap_balance=body.ap_balance,
            notes=body.notes,
        )
        _audit(
            project_id,
            "reconciliation",
            reconciliation.id,
            "created",
            after=entity_dict(reconciliation),
        )
        return entity_dict(reconciliation)
    except Exception as exc:
        raise _http_err(exc) from exc
