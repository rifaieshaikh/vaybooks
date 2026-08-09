"""Request-scoped org tenancy (Phase 1)."""

from __future__ import annotations

from contextvars import ContextVar

DEFAULT_ORG_ID = "default"

_current_org_id: ContextVar[str] = ContextVar("vaybooks_org_id", default=DEFAULT_ORG_ID)


def get_org_id() -> str:
    value = (_current_org_id.get() or DEFAULT_ORG_ID).strip()
    return value or DEFAULT_ORG_ID


def set_org_id(org_id: str | None) -> None:
    value = (org_id or DEFAULT_ORG_ID).strip() or DEFAULT_ORG_ID
    _current_org_id.set(value)


def reset_org_id() -> None:
    _current_org_id.set(DEFAULT_ORG_ID)
