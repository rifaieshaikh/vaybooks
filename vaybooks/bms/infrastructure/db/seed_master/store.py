"""Mongo master ledger for interactive demo/test seeds."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pymongo.database import Database

MASTER_DOC_ID = "demo_seed_master"
COLLECTION = "demo_seed_master"
RUNS_COLLECTION = "demo_seed_runs"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_master(db: Database) -> dict[str, Any]:
    col = db[COLLECTION]
    doc = col.find_one({"_id": MASTER_DOC_ID})
    if doc:
        return doc
    blank = {
        "_id": MASTER_DOC_ID,
        "packs": {},
        "updated_at": _utc_now(),
        "created_at": _utc_now(),
    }
    col.replace_one({"_id": MASTER_DOC_ID}, blank, upsert=True)
    return blank


def record_pack_result(
    db: Database,
    *,
    pack_id: str,
    title: str,
    marker: str,
    status: str,
    summary: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    now = _utc_now()
    ensure_master(db)
    pack_state = {
        "pack_id": pack_id,
        "title": title,
        "marker": marker,
        "status": status,
        "summary": summary or {},
        "error": error,
        "last_run_at": now,
    }
    db[COLLECTION].update_one(
        {"_id": MASTER_DOC_ID},
        {
            "$set": {
                f"packs.{pack_id}": pack_state,
                "updated_at": now,
            }
        },
        upsert=True,
    )
    return pack_state


def record_run(
    db: Database,
    *,
    pack_ids: list[str],
    results: list[dict[str, Any]],
) -> str:
    run_id = uuid4().hex
    now = _utc_now()
    db[RUNS_COLLECTION].insert_one(
        {
            "_id": run_id,
            "pack_ids": pack_ids,
            "results": results,
            "started_at": now,
            "finished_at": now,
        }
    )
    db[COLLECTION].update_one(
        {"_id": MASTER_DOC_ID},
        {"$set": {"last_run_id": run_id, "updated_at": now}},
        upsert=True,
    )
    return run_id


def get_master(db: Database) -> dict[str, Any]:
    return ensure_master(db)


def recent_runs(db: Database, limit: int = 10) -> list[dict[str, Any]]:
    cursor = db[RUNS_COLLECTION].find().sort("finished_at", -1).limit(limit)
    return list(cursor)
