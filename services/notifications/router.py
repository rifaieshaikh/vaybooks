"""Session notifications inbox (scheduler + project pending approvals)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from packages.services_kit.schedulers_container import get_schedulers_container
from services.auth.router import _decode_token, _load_user_by_username, permission_cache, _perm_key
from services.parties.serialize import entity_dict

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _user_id_for(username: str) -> str:
    cached = permission_cache.get(_perm_key(username)) or {}
    uid = str(cached.get("user_id") or "").strip()
    if uid:
        return uid
    user = _load_user_by_username(username)
    return str(getattr(user, "id", "") or "")


def _project_pending(user_id: str, limit: int) -> list[dict[str, Any]]:
    try:
        from vaybooks.bms.application.projects.notifications.service import (
            ProjectNotificationAppService,
        )
        from vaybooks.bms.infrastructure.repositories.projects.mongo_project_quotation_repository import (
            MongoProjectQuotationRepository,
        )
        from vaybooks.bms.infrastructure.repositories.projects.mongo_project_ra_repository import (
            MongoProjectRARepository,
        )
        from vaybooks.bms.infrastructure.repositories.projects.mongo_project_repository import (
            MongoProjectRepository,
        )
        from packages.services_kit.mongo_env import mongo_db_name, mongo_uri
        from pymongo import MongoClient

        client = MongoClient(mongo_uri(), serverSelectionTimeoutMS=5000)
        db = client[mongo_db_name()]
        svc = ProjectNotificationAppService(
            quotation_repo=MongoProjectQuotationRepository(db),
            ra_repo=MongoProjectRARepository(db),
            project_repo=MongoProjectRepository(db),
        )
        rows = svc.list_pending_approvals(user_id)[:limit]
        out: list[dict[str, Any]] = []
        for row in rows:
            data = entity_dict(row) if not isinstance(row, dict) else dict(row)
            data["source"] = "project"
            data["id"] = data.get("id") or f"project-{data.get('kind')}-{data.get('ref_id') or data.get('project_id')}"
            out.append(data)
        return out
    except Exception:
        return []


@router.get("")
def list_notifications(
    limit: int = Query(default=40, ge=1, le=100),
    username: str = Depends(_decode_token),
) -> list[dict[str, Any]]:
    user_id = _user_id_for(username)
    items: list[dict[str, Any]] = []
    try:
        sched = get_schedulers_container().schedulers
        for row in sched.list_notifications(user_id, state="open", limit=limit):
            data = entity_dict(row)
            data["source"] = "scheduler"
            items.append(data)
    except Exception:
        pass
    remaining = max(limit - len(items), 0)
    if remaining:
        items.extend(_project_pending(user_id, remaining))
    return items[:limit]


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    notification_id: str,
    username: str = Depends(_decode_token),
) -> None:
    _ = username  # auth gate
    if notification_id.startswith("project-"):
        return
    try:
        get_schedulers_container().schedulers.mark_notification_read(notification_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
