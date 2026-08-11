"""Settings API — business, print, keyboard, activities, discounts, services (Mongo)."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from packages.services_kit.settings_container import get_settings_container
from services.common.authz import require_permission
from services.parties.serialize import entity_dict
from vaybooks.bms.domain.sales.discount_entities import DiscountRule
from vaybooks.bms.domain.shared.document_customization import (
    bank_account_from_dict,
    template_from_dict,
)
from vaybooks.bms.domain.shared.enums import VendorRegistrationType
from vaybooks.bms.domain.shared.exceptions import ValidationError

router = APIRouter(prefix="/api/settings", tags=["settings"])


class PrefsUpdate(BaseModel):
    timezone: str | None = None
    locale: str | None = None


class BusinessPatch(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    registration_type: Optional[str] = None
    composition_tax_rate: Optional[float] = None
    require_customer_name: Optional[bool] = None
    require_customer_phone: Optional[bool] = None
    invoice_numbering_mode: Optional[str] = None
    invoice_number_prefix: Optional[str] = None
    fy_start_month: Optional[int] = None
    fy_year_end_mode: Optional[str] = None
    fy_ask_at_start: Optional[bool] = None


class PrintPatch(BaseModel):
    bank_accounts: list[dict[str, Any]] = Field(default_factory=list)
    document_templates: dict[str, dict[str, Any]] = Field(default_factory=dict)


class KeyboardPatch(BaseModel):
    parents: dict[str, str] = Field(default_factory=dict)
    actions: dict[str, str] = Field(default_factory=dict)


class ActivityCreate(BaseModel):
    activity_name: str = Field(min_length=1)
    activity_category: str = Field(min_length=1)
    default_hourly_expense: float = 0.0
    custom_statuses: Optional[list[str]] = None


class ActivityPatch(BaseModel):
    activity_name: str = Field(min_length=1)
    activity_category: str = Field(min_length=1)
    default_hourly_expense: float = 0.0
    is_active: bool = True
    custom_statuses: Optional[list[str]] = None


class ProjectActivityCreate(BaseModel):
    activity_name: str = Field(min_length=1)
    activity_category: str = Field(min_length=1)
    default_hourly_rate: float = 0.0
    default_amount: float = 0.0
    custom_statuses: Optional[list[str]] = None


class ProjectActivityPatch(BaseModel):
    activity_name: str = Field(min_length=1)
    activity_category: str = Field(min_length=1)
    default_hourly_rate: float = 0.0
    default_amount: float = 0.0
    is_active: bool = True
    custom_statuses: Optional[list[str]] = None


class SpecCreate(BaseModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    person_types: list[str] = Field(default_factory=lambda: ["Men"])
    section: str = "Torso"
    value_type: str = "number"
    unit: str = "inch"
    required: bool = False
    sort_order: int = 0
    help_text: str = ""
    options: Optional[list[str]] = None


class SpecPatch(BaseModel):
    label: Optional[str] = None
    person_types: Optional[list[str]] = None
    section: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    required: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    help_text: Optional[str] = None
    options: Optional[list[str]] = None


class ServiceCreate(BaseModel):
    service_name: str = Field(min_length=1)
    expense_account_id: str = Field(min_length=1)


class ServicePatch(BaseModel):
    service_name: str = Field(min_length=1)
    expense_account_id: str = Field(min_length=1)
    is_active: bool = True


class DiscountCreate(BaseModel):
    name: str = Field(min_length=1)
    scope: str = "global"
    discount_type: str = "percent"
    value: float = 0.0
    priority: int = 100
    is_active: bool = True
    product_ids: list[str] = Field(default_factory=list)
    catalog_product_ids: list[str] = Field(default_factory=list)
    category_ids: list[str] = Field(default_factory=list)
    customer_ids: list[str] = Field(default_factory=list)
    segment_ids: list[str] = Field(default_factory=list)
    apply_to: list[str] = Field(default_factory=list)
    max_discount_amount: Optional[float] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None


class DiscountPatch(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    discount_type: Optional[str] = None
    value: Optional[float] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    product_ids: Optional[list[str]] = None
    catalog_product_ids: Optional[list[str]] = None
    category_ids: Optional[list[str]] = None
    customer_ids: Optional[list[str]] = None
    segment_ids: Optional[list[str]] = None
    apply_to: Optional[list[str]] = None
    max_discount_amount: Optional[float] = None


def _c():
    return get_settings_container()


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _reg_type(raw: Optional[str]) -> VendorRegistrationType:
    if not raw:
        return VendorRegistrationType.UNREGISTERED
    for item in VendorRegistrationType:
        if item.value.lower() == raw.strip().lower() or item.name.lower() == raw.strip().lower():
            return item
    return VendorRegistrationType.UNREGISTERED


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    return date.fromisoformat(value[:10])


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "settings", "status": "ok", "backend": _c().backend}


@router.get("/prefs")
def get_prefs() -> dict[str, str]:
    return _c().prefs_collection.get()


@router.put("/prefs")
def put_prefs(body: PrefsUpdate) -> dict[str, str]:
    return _c().prefs_collection.put(timezone=body.timezone, locale=body.locale)


@router.get("/business")
def get_business() -> dict[str, Any]:
    return entity_dict(_c().business.get_profile())


@router.patch("/business")
def patch_business(body: BusinessPatch) -> dict[str, Any]:
    profile = _c().business.get_profile()
    kwargs: dict[str, Any] = {}
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "registration_type":
            kwargs[key] = _reg_type(value)
        else:
            kwargs[key] = value
    # update_profile requires keyword args; fill from current for missing requireds
    try:
        updated = _c().business.update_profile(
            legal_name=kwargs.get("legal_name", profile.legal_name),
            trade_name=kwargs.get("trade_name", profile.trade_name),
            address_line1=kwargs.get("address_line1", profile.address_line1),
            address_line2=kwargs.get("address_line2", profile.address_line2),
            city=kwargs.get("city", profile.city),
            state_code=kwargs.get("state_code", profile.state_code),
            pincode=kwargs.get("pincode", profile.pincode),
            country=kwargs.get("country", profile.country),
            phone=kwargs.get("phone", profile.phone),
            email=kwargs.get("email", profile.email),
            gstin=kwargs.get("gstin", profile.gstin),
            pan=kwargs.get("pan", profile.pan),
            registration_type=kwargs.get("registration_type", profile.registration_type),
            composition_tax_rate=kwargs.get(
                "composition_tax_rate", profile.composition_tax_rate
            ),
            require_customer_name=kwargs.get(
                "require_customer_name", profile.require_customer_name
            ),
            require_customer_phone=kwargs.get(
                "require_customer_phone", profile.require_customer_phone
            ),
            invoice_numbering_mode=kwargs.get(
                "invoice_numbering_mode", profile.invoice_numbering_mode
            ),
            invoice_number_prefix=kwargs.get(
                "invoice_number_prefix", profile.invoice_number_prefix
            ),
            fy_start_month=kwargs.get("fy_start_month", profile.fy_start_month),
            fy_year_end_mode=kwargs.get("fy_year_end_mode", profile.fy_year_end_mode),
            fy_ask_at_start=kwargs.get("fy_ask_at_start", profile.fy_ask_at_start),
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(updated)


@router.get("/print")
def get_print_settings() -> dict[str, Any]:
    profile = _c().business.get_profile()
    return {
        "bank_accounts": [entity_dict(a) for a in profile.bank_accounts],
        "document_templates": {
            key: entity_dict(value) for key, value in (profile.document_templates or {}).items()
        },
    }


@router.put("/print")
def put_print_settings(body: PrintPatch) -> dict[str, Any]:
    try:
        banks = []
        for item in body.bank_accounts:
            account = bank_account_from_dict(item)
            if account is not None:
                banks.append(account)
        templates = {
            key: template_from_dict(raw)
            for key, raw in (body.document_templates or {}).items()
        }
        # Merge with existing so partial updates keep other document types
        profile = _c().business.get_profile()
        merged = dict(profile.document_templates or {})
        merged.update(templates)
        if not banks:
            banks = list(profile.bank_accounts or [])
        updated = _c().business.update_document_settings(
            bank_accounts=banks,
            document_templates=merged,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return {
        "bank_accounts": [entity_dict(a) for a in updated.bank_accounts],
        "document_templates": {
            key: entity_dict(value) for key, value in (updated.document_templates or {}).items()
        },
    }


@router.get("/keyboard")
def get_keyboard() -> dict[str, Any]:
    from vaybooks.bms.ui.keyboard.bindings import get_bindings
    from vaybooks.bms.ui.keyboard.defaults import ensure_defaults_loaded
    from vaybooks.bms.ui.keyboard.registry import all_actions, all_parents

    ensure_defaults_loaded()
    bindings = get_bindings()
    return {
        **bindings,
        "catalog": {
            "parents": [
                {
                    "key": p.nav_key,
                    "nav_key": p.nav_key,
                    "label": p.label,
                    "group": p.group,
                    "locked": bool(p.locked),
                    "default_chord": p.default_chord or "",
                }
                for p in all_parents()
            ],
            "actions": [
                {
                    "key": a.action_id,
                    "action_id": a.action_id,
                    "label": a.label,
                    "group": a.group,
                    "destructive": bool(a.destructive),
                    "mouse_only": bool(a.mouse_only),
                    "unbound_stub": bool(a.unbound_stub),
                    "default_chord": a.default_chord or "",
                }
                for a in all_actions()
            ],
        },
    }


@router.put("/keyboard")
def put_keyboard(body: KeyboardPatch) -> dict[str, Any]:
    from vaybooks.bms.ui.keyboard.bindings import get_bindings, save_action_binding, save_parent_binding

    errors: list[str] = []
    for key, chord in (body.parents or {}).items():
        ok, msg = save_parent_binding(key, chord)
        if not ok:
            errors.append(msg or f"Invalid parent binding: {key}")
    for key, chord in (body.actions or {}).items():
        ok, msg = save_action_binding(key, chord)
        if not ok:
            errors.append(msg or f"Invalid action binding: {key}")
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors[:5]))
    # Return the enriched GET payload so the UI keeps catalog metadata after save.
    return get_keyboard()

@router.get("/activities")
def list_boutique_activities(active_only: bool = False) -> list[dict[str, Any]]:
    return [entity_dict(a) for a in _c().boutique_activities.list_activities(active_only=active_only)]


@router.post("/activities", status_code=201)
def create_boutique_activity(body: ActivityCreate) -> dict[str, Any]:
    try:
        row = _c().boutique_activities.create_activity(
            body.activity_name,
            body.activity_category,
            default_hourly_expense=body.default_hourly_expense,
            custom_statuses=body.custom_statuses,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.patch("/activities/{activity_id}")
def patch_boutique_activity(activity_id: str, body: ActivityPatch) -> dict[str, Any]:
    try:
        row = _c().boutique_activities.update_activity_details(
            activity_id,
            body.activity_name,
            body.activity_category,
            default_hourly_expense=body.default_hourly_expense,
            is_active=body.is_active,
            custom_statuses=body.custom_statuses,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.get("/store-activities")
def list_store_activities(active_only: bool = False) -> list[dict[str, Any]]:
    return [entity_dict(a) for a in _c().store_activities.list_activities(active_only=active_only)]


@router.post("/store-activities", status_code=201)
def create_store_activity(body: ActivityCreate) -> dict[str, Any]:
    try:
        row = _c().store_activities.create_activity(
            body.activity_name,
            body.activity_category,
            default_hourly_expense=body.default_hourly_expense,
            custom_statuses=body.custom_statuses,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.patch("/store-activities/{activity_id}")
def patch_store_activity(activity_id: str, body: ActivityPatch) -> dict[str, Any]:
    try:
        row = _c().store_activities.update_activity_details(
            activity_id,
            body.activity_name,
            body.activity_category,
            default_hourly_expense=body.default_hourly_expense,
            is_active=body.is_active,
            custom_statuses=body.custom_statuses,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.get("/project-activities")
def list_project_activities(active_only: bool = False) -> list[dict[str, Any]]:
    return [entity_dict(a) for a in _c().project_activities.list_activities(active_only=active_only)]


@router.post("/project-activities", status_code=201)
def create_project_activity(body: ProjectActivityCreate) -> dict[str, Any]:
    try:
        row = _c().project_activities.create_activity(
            body.activity_name,
            body.activity_category,
            default_hourly_rate=body.default_hourly_rate,
            default_amount=body.default_amount,
            custom_statuses=body.custom_statuses,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.patch("/project-activities/{activity_id}")
def patch_project_activity(activity_id: str, body: ProjectActivityPatch) -> dict[str, Any]:
    try:
        row = _c().project_activities.update_activity_details(
            activity_id,
            body.activity_name,
            body.activity_category,
            default_hourly_rate=body.default_hourly_rate,
            default_amount=body.default_amount,
            is_active=body.is_active,
            custom_statuses=body.custom_statuses,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.get("/measurement-specs")
def list_measurement_specs(active_only: bool = False) -> list[dict[str, Any]]:
    return [entity_dict(s) for s in _c().measurements.list_specs(active_only=active_only)]


@router.post("/measurement-specs", status_code=201)
def create_measurement_spec(body: SpecCreate) -> dict[str, Any]:
    try:
        row = _c().measurements.create_spec(
            key=body.key,
            label=body.label,
            person_types=body.person_types,
            section=body.section,
            value_type=body.value_type,
            unit=body.unit,
            required=body.required,
            sort_order=body.sort_order,
            help_text=body.help_text,
            options=body.options,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.patch("/measurement-specs/{spec_id}")
def patch_measurement_spec(spec_id: str, body: SpecPatch) -> dict[str, Any]:
    try:
        row = _c().measurements.update_spec(spec_id, **body.model_dump(exclude_unset=True))
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.delete("/measurement-specs/{spec_id}", status_code=204)
def delete_measurement_spec(spec_id: str) -> None:
    try:
        _c().measurements.delete_spec(spec_id)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/services")
def list_vendor_services(active_only: bool = False) -> list[dict[str, Any]]:
    return [entity_dict(s) for s in _c().vendor_services.list_services(active_only=active_only)]


@router.post("/services", status_code=201)
def create_vendor_service(body: ServiceCreate) -> dict[str, Any]:
    try:
        row = _c().vendor_services.create_service(body.service_name, body.expense_account_id)
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.patch("/services/{service_id}")
def patch_vendor_service(service_id: str, body: ServicePatch) -> dict[str, Any]:
    try:
        row = _c().vendor_services.update_service(
            service_id,
            body.service_name,
            body.expense_account_id,
            is_active=body.is_active,
        )
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.get("/discounts")
def list_discounts(
    active_only: bool = False,
    customer_id: Optional[str] = Query(default=None),
    _: str = Depends(require_permission("settings.discounts.view")),
) -> list[dict[str, Any]]:
    rows = _c().discounts.list_rules(active_only=active_only)
    cid = (customer_id or "").strip()
    if cid:
        rows = [
            r
            for r in rows
            if cid in (getattr(r, "customer_ids", None) or [])
        ]
    return [entity_dict(r) for r in rows]


@router.post("/discounts", status_code=201)
def create_discount(
    body: DiscountCreate,
    _: str = Depends(require_permission("settings.discounts.edit")),
) -> dict[str, Any]:
    try:
        kwargs: dict[str, Any] = {
            "name": body.name,
            "scope": body.scope,
            "discount_type": body.discount_type,
            "value": body.value,
            "priority": body.priority,
            "is_active": body.is_active,
            "product_ids": body.product_ids,
            "catalog_product_ids": body.catalog_product_ids,
            "category_ids": body.category_ids,
            "customer_ids": body.customer_ids,
            "segment_ids": body.segment_ids,
            "max_discount_amount": body.max_discount_amount,
            "valid_from": _parse_date(body.valid_from),
            "valid_to": _parse_date(body.valid_to),
        }
        if body.apply_to:
            kwargs["apply_to"] = body.apply_to
        row = _c().discounts.create_rule(DiscountRule(**kwargs))
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.patch("/discounts/{rule_id}")
def patch_discount(
    rule_id: str,
    body: DiscountPatch,
    _: str = Depends(require_permission("settings.discounts.edit")),
) -> dict[str, Any]:
    try:
        row = _c().discounts.update_rule(rule_id, **body.model_dump(exclude_unset=True))
    except Exception as exc:
        raise _http_err(exc) from exc
    return entity_dict(row)


@router.delete("/discounts/{rule_id}", status_code=204)
def delete_discount(
    rule_id: str,
    _: str = Depends(require_permission("settings.discounts.edit")),
) -> None:
    try:
        _c().discounts.delete_rule(rule_id)
    except Exception as exc:
        raise _http_err(exc) from exc


@router.get("/crm")
def crm_settings_redirect() -> RedirectResponse:
    return RedirectResponse(url="/api/crm/settings", status_code=307)


@router.get("/production")
def production_settings_stub() -> dict[str, Any]:
    return {
        "module": "production",
        "status": "stub",
        "message": "Production settings will be available in the production wave.",
    }


@router.get("/locations")
def locations_redirect() -> RedirectResponse:
    return RedirectResponse(url="/api/inventory/locations", status_code=307)
