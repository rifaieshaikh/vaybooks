"""Projects API — projects and enquiries."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from packages.services_kit import MemoryStore, publish

router = APIRouter(prefix="/api/projects", tags=["projects"])
_PROJECTS = MemoryStore()
_ENQUIRIES = MemoryStore()


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    customer_id: str = Field(min_length=1)
    status: str = "active"
    tenant_id: str = "default"


class ProjectEnquiryCreate(BaseModel):
    project_id: str | None = None
    subject: str = Field(min_length=1)
    status: str = "open"
    tenant_id: str = "default"


@router.get("/health")
def health() -> dict[str, str]:
    return {"module": "projects", "status": "ok"}


@router.get("/enquiries")
def list_enquiries(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _ENQUIRIES.list(include_deleted=include_deleted)


@router.post("/enquiries", status_code=201)
def create_enquiry(body: ProjectEnquiryCreate) -> dict[str, Any]:
    if body.project_id:
        _PROJECTS.get(body.project_id)
    return _ENQUIRIES.create(body.model_dump())


@router.get("")
def list_projects(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    return _PROJECTS.list(include_deleted=include_deleted)


@router.post("", status_code=201)
def create_project(body: ProjectCreate) -> dict[str, Any]:
    row = _PROJECTS.create(body.model_dump())
    publish(
        "ProjectCreated",
        {
            "project_id": row["id"],
            "name": body.name,
            "customer_id": body.customer_id,
            "status": body.status,
        },
    )
    return row


@router.get("/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    return _PROJECTS.get(project_id)


@router.patch("/{project_id}")
def update_project(project_id: str, body: ProjectCreate) -> dict[str, Any]:
    return _PROJECTS.update(project_id, body.model_dump())


@router.delete("/{project_id}")
def delete_project(project_id: str) -> dict[str, Any]:
    return _PROJECTS.soft_delete(project_id)
