"""Data migration wizard API — profiles, parse/preview/run (Mongo)."""

from __future__ import annotations

import base64
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from packages.services_kit import publish
from packages.services_kit.migration_container import get_migration_container
from services.parties.serialize import entity_dict
from vaybooks.bms.application.migration.schemas import DuplicatePolicy, ImportEntityType

router = APIRouter(prefix="/api/migration", tags=["migration"])

# Ephemeral upload cache for preview/run within process lifetime.
_UPLOADS: dict[str, dict[str, Any]] = {}
_BATCHES: dict[str, dict[str, Any]] = {}


class ProfileSave(BaseModel):
    entity: str = Field(min_length=1)
    name: str = Field(min_length=1)
    mapping: dict[str, str] = Field(default_factory=dict)


class ParseBody(BaseModel):
    filename: str = "upload.csv"
    content_base64: str = Field(min_length=1)


class PreviewBody(BaseModel):
    upload_id: str = Field(min_length=1)
    entity: str = Field(min_length=1)
    mapping: dict[str, str] = Field(default_factory=dict)


class RunImportBody(BaseModel):
    upload_id: str = Field(min_length=1)
    entity: str = Field(min_length=1)
    mapping: dict[str, str] = Field(default_factory=dict)
    duplicate_policy: str = "skip"


class MigrationBatchCreate(BaseModel):
    source: str = Field(min_length=1, description="csv|xlsx|json")
    entity: str = Field(min_length=1, description="customers|products|...")
    payload_ref: str = ""
    mapping: dict[str, str] = Field(default_factory=dict)
    upload_id: str = ""
    tenant_id: str = "default"


def _svc():
    return get_migration_container().migration


def _entity(value: str) -> ImportEntityType:
    try:
        return ImportEntityType(value.strip().lower())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported entity: {value}. "
            f"Use one of {[e.value for e in ImportEntityType]}",
        ) from exc


def _preview_dict(preview) -> dict[str, Any]:
    return {
        "entity_type": preview.entity_type,
        "total_rows": preview.total_rows,
        "valid_rows": preview.valid_rows,
        "can_import": preview.can_import,
        "issues": [
            {"row": i.row, "message": i.message, "field": getattr(i, "field", "")}
            for i in (preview.issues or [])
        ],
    }


def _result_dict(result) -> dict[str, Any]:
    return {
        "entity_type": result.entity_type,
        "created": getattr(result, "created", 0),
        "updated": getattr(result, "updated", 0),
        "skipped": getattr(result, "skipped", 0),
        "failed": getattr(result, "failed", 0),
        "issues": [
            {"row": i.row, "message": i.message, "field": getattr(i, "field", "")}
            for i in (getattr(result, "issues", None) or [])
        ],
    }


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "module": "migration",
        "status": "ok",
        "backend": get_migration_container().backend,
    }


@router.get("/entities")
def list_entities() -> dict[str, Any]:
    return {"entities": [e.value for e in ImportEntityType]}


@router.get("/profiles")
def list_profiles(*, entity: str = "") -> list[dict[str, Any]]:
    if not entity:
        # Aggregate across entity types.
        rows: list[dict[str, Any]] = []
        for et in ImportEntityType:
            for p in _svc().list_mapping_profiles(et):
                rows.append(entity_dict(p))
        return rows
    return [entity_dict(p) for p in _svc().list_mapping_profiles(_entity(entity))]


@router.post("/profiles", status_code=201)
def save_profile(body: ProfileSave) -> dict[str, Any]:
    try:
        profile = _svc().save_mapping_profile(_entity(body.entity), body.name, body.mapping)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return entity_dict(profile)


@router.get("/profiles/{profile_id}")
def get_profile(profile_id: str) -> dict[str, Any]:
    profile = _svc().get_mapping_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="profile not found")
    return entity_dict(profile)


@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: str) -> dict[str, str]:
    _svc().delete_mapping_profile(profile_id)
    return {"status": "deleted", "id": profile_id}


@router.get("/templates/{entity}")
def get_template(entity: str) -> dict[str, str]:
    csv_text = _svc().get_template(_entity(entity))
    return {"entity": entity, "csv": csv_text}


@router.post("/parse")
def parse_upload(body: ParseBody) -> dict[str, Any]:
    try:
        raw = base64.b64decode(body.content_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 content") from exc
    try:
        df = _svc().parse_upload(raw, body.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Parse failed: {exc}") from exc
    upload_id = uuid4().hex
    cols = _svc().source_columns(df)
    _UPLOADS[upload_id] = {
        "df": df,
        "filename": body.filename,
        "bytes": raw,
        "columns": cols,
    }
    return {
        "upload_id": upload_id,
        "filename": body.filename,
        "row_count": int(len(df)),
        "columns": cols,
    }


@router.post("/suggest-mapping")
def suggest_mapping(entity: str, upload_id: str) -> dict[str, Any]:
    upload = _UPLOADS.get(upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="upload not found; parse first")
    et = _entity(entity)
    mapping = _svc().suggest_mapping(et, upload["columns"])
    missing = _svc().missing_required(et, mapping)
    return {"entity": et.value, "mapping": mapping, "missing_required": missing}


@router.post("/preview")
def preview_import(body: PreviewBody) -> dict[str, Any]:
    upload = _UPLOADS.get(body.upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="upload not found; parse first")
    preview = _svc().preview_import(_entity(body.entity), upload["df"], body.mapping)
    return _preview_dict(preview)


@router.post("/run")
def run_import(body: RunImportBody) -> dict[str, Any]:
    upload = _UPLOADS.get(body.upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="upload not found; parse first")
    try:
        policy = DuplicatePolicy(body.duplicate_policy)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid duplicate_policy") from exc
    result = _svc().run_import(
        _entity(body.entity),
        upload["df"],
        body.mapping,
        policy,
        file_bytes=upload.get("bytes"),
        source_filename=upload.get("filename") or "",
    )
    return _result_dict(result)


@router.get("/batches")
def list_batches() -> list[dict[str, Any]]:
    return list(_BATCHES.values())


@router.post("/batches", status_code=201)
def create_batch(body: MigrationBatchCreate) -> dict[str, Any]:
    _entity(body.entity)  # validate
    batch_id = uuid4().hex
    row = {
        "id": batch_id,
        "source": body.source,
        "entity": body.entity,
        "payload_ref": body.payload_ref or body.upload_id,
        "upload_id": body.upload_id,
        "mapping": body.mapping,
        "status": "queued",
        "progress": 0,
        "tenant_id": body.tenant_id,
    }
    _BATCHES[batch_id] = row
    publish(
        "MigrationBatchQueued",
        {"batch_id": batch_id, "source": body.source, "entity": body.entity},
    )
    return row


@router.get("/batches/{batch_id}")
def get_batch(batch_id: str) -> dict[str, Any]:
    row = _BATCHES.get(batch_id)
    if not row:
        raise HTTPException(status_code=404, detail="batch not found")
    return row


@router.post("/batches/{batch_id}/run")
def run_batch(batch_id: str) -> dict[str, Any]:
    row = _BATCHES.get(batch_id)
    if not row:
        raise HTTPException(status_code=404, detail="batch not found")
    row["status"] = "running"
    row["progress"] = 50
    upload_id = row.get("upload_id") or ""
    mapping = row.get("mapping") or {}
    if upload_id and upload_id in _UPLOADS and mapping:
        result = _svc().run_import(
            _entity(row["entity"]),
            _UPLOADS[upload_id]["df"],
            mapping,
            DuplicatePolicy.SKIP,
            file_bytes=_UPLOADS[upload_id].get("bytes"),
            source_filename=_UPLOADS[upload_id].get("filename") or "",
        )
        row["result"] = _result_dict(result)
        row["status"] = "completed" if not result.failed else "completed_with_errors"
        row["progress"] = 100
    else:
        # Profile-only batch: mark complete (wizard uses /run for full import).
        row["status"] = "completed"
        row["progress"] = 100
        row["result"] = {"note": "No upload/mapping; use /parse + /run for full import"}
    _BATCHES[batch_id] = row
    return row


@router.delete("/batches/{batch_id}")
def delete_batch(batch_id: str) -> dict[str, Any]:
    row = _BATCHES.pop(batch_id, None)
    if not row:
        raise HTTPException(status_code=404, detail="batch not found")
    row["deleted"] = True
    return row
