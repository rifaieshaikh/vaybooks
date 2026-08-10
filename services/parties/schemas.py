"""Pydantic request/response models for parties API."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class AddressTaxFields(BaseModel):
    address_line1: str = ""
    address_line2: str = ""
    city: str = ""
    state_code: str = ""
    pincode: str = ""
    country: str = "India"
    gstin: str = ""
    pan: str = ""
    registration_type: str = "Unregistered"
    msme_number: str = ""


class CustomerWrite(AddressTaxFields):
    customer_name: str = Field(min_length=1)
    phone_number: str = ""
    alternate_phone_number: Optional[str] = None
    email: str = ""
    contact_person: str = ""
    notes: str = ""
    segment_ids: List[str] = Field(default_factory=list)
    location_ids: List[str] = Field(default_factory=list)
    is_commission_agent: bool = False


class VendorWrite(AddressTaxFields):
    vendor_name: str = Field(min_length=1)
    phone_number: str = Field(min_length=1)
    alternate_phone_number: Optional[str] = None
    email: str = ""
    contact_person: str = ""
    bank_account_holder: str = ""
    bank_account_number: str = ""
    bank_ifsc: str = ""
    bank_name: str = ""
    notes: str = ""
    segment_ids: List[str] = Field(default_factory=list)
    location_ids: List[str] = Field(default_factory=list)


class DeliveryPartnerWrite(BaseModel):
    partner_name: str = Field(min_length=1)
    phone_number: str = Field(min_length=1)
    legal_display_name: str = ""
    alternate_phone_number: Optional[str] = None
    email: str = ""
    address_line1: str = ""
    address_line2: str = ""
    city: str = ""
    state_code: str = ""
    pincode: str = ""
    country: str = "India"
    gstin: str = ""
    pan: str = ""
    default_expense_ledger_id: str = ""
    payment_terms: str = ""
    is_active: bool = True
    notes: str = ""
    location_ids: List[str] = Field(default_factory=list)


class CommissionAgentWrite(AddressTaxFields):
    agent_name: str = Field(min_length=1)
    phone_number: str = Field(min_length=1)
    alternate_phone_number: Optional[str] = None
    email: str = ""
    contact_person: str = ""
    bank_account_holder: str = ""
    bank_account_number: str = ""
    bank_ifsc: str = ""
    bank_name: str = ""
    notes: str = ""
    commission_profile: Optional[dict[str, Any]] = None
    segment_ids: List[str] = Field(default_factory=list)
    location_ids: List[str] = Field(default_factory=list)
    source_customer_id: str = ""


class WorkerActivityRefIn(BaseModel):
    activity_id: str
    source: str = "customization"


class WorkerWrite(BaseModel):
    worker_name: str = Field(min_length=1)
    activity_refs: List[WorkerActivityRefIn] = Field(default_factory=list)
    is_active: bool = True
    default_hourly_rate: float = 0.0
    base_salary: float = 0.0
    allowances: List[dict[str, Any]] = Field(default_factory=list)
    ot_threshold_hours: float = 0.0
    ot_multiplier: float = 1.5
    location_ids: List[str] = Field(default_factory=list)
    commission_enabled: bool = False
    commission_profile: Optional[dict[str, Any]] = None
    create_login: bool = False
    username: str = ""
    password: str = ""
    role_ids: List[str] = Field(default_factory=list)


class SalaryCalculateBody(BaseModel):
    period_from: str
    period_to: str


class SalaryPayBody(BaseModel):
    period_from: str
    period_to: str
    paying_account_id: str = Field(min_length=1)
    voucher_date: Optional[str] = None
    description: str = ""
    include_commission: bool = False
    commission_amount: float = 0.0
    amount: Optional[float] = None  # override preview total when set


class SegmentWrite(BaseModel):
    name: str = Field(min_length=1)
    applies_to: List[str] = Field(default_factory=lambda: ["customer", "vendor"])
    is_active: bool = True


class BlacklistBody(BaseModel):
    blacklisted: bool = True
    reason: str = ""


class SettleBody(BaseModel):
    amount: float = Field(gt=0)
    mode: str = "park"
    reason: str = ""
    voucher_date: Optional[date] = None


class PartySummary(BaseModel):
    account_id: str = ""
    balance: float = 0.0
    credit_balance: float = 0.0
    receivable_balance: float = 0.0
    extras: dict[str, Any] = Field(default_factory=dict)
