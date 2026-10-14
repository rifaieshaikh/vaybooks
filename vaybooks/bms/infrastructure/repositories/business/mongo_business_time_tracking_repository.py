from datetime import datetime
from typing import List, Optional

from pymongo.database import Database

from vaybooks.bms.domain.business.activities.entities import CREATED_STATUS
from vaybooks.bms.domain.business.time_tracking.entities import BusinessTimeEntry
from vaybooks.bms.infrastructure.db.bson_utils import from_bson_date, to_bson_value


class MongoBusinessTimeTrackingRepository:
    def __init__(self, db: Database):
        self._collection = db.business_time_entries

    def _to_doc(self, entry: BusinessTimeEntry) -> dict:
        return {
            "_id": entry.id,
            "task_id": entry.task_id,
            "activity_id": entry.activity_id,
            "activity_name": entry.activity_name,
            "worker_id": entry.worker_id,
            "worker_name": entry.worker_name,
            "work_date": to_bson_value(entry.work_date),
            "start_time": entry.start_time,
            "end_time": entry.end_time,
            "duration_minutes": entry.duration_minutes,
            "hourly_rate": float(entry.hourly_rate or 0.0),
            "labour_cost": float(entry.labour_cost or 0.0),
            "notes": entry.notes,
            "status": entry.status,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
        }

    def _from_doc(self, doc: dict) -> BusinessTimeEntry:
        return BusinessTimeEntry(
            id=doc["_id"],
            task_id=doc["task_id"],
            activity_id=doc["activity_id"],
            activity_name=doc.get("activity_name", ""),
            worker_id=doc.get("worker_id", ""),
            worker_name=doc.get("worker_name", ""),
            work_date=from_bson_date(doc["work_date"]),
            start_time=doc.get("start_time", ""),
            end_time=doc.get("end_time", ""),
            duration_minutes=doc.get("duration_minutes", 0),
            hourly_rate=float(doc.get("hourly_rate") or 0.0),
            labour_cost=float(doc.get("labour_cost") or 0.0),
            notes=doc.get("notes", ""),
            status=doc.get("status") or CREATED_STATUS,
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow()),
        )

    def save(self, entry: BusinessTimeEntry) -> BusinessTimeEntry:
        self._collection.replace_one({"_id": entry.id}, self._to_doc(entry), upsert=True)
        return entry

    def find_by_id(self, entry_id: str) -> Optional[BusinessTimeEntry]:
        doc = self._collection.find_one({"_id": entry_id})
        return self._from_doc(doc) if doc else None

    def find_by_task(self, task_id: str) -> List[BusinessTimeEntry]:
        return [
            self._from_doc(d)
            for d in self._collection.find({"task_id": task_id}).sort("work_date", -1)
        ]

    def list_all(self) -> List[BusinessTimeEntry]:
        return [self._from_doc(d) for d in self._collection.find()]

    def delete(self, entry_id: str) -> None:
        self._collection.delete_one({"_id": entry_id})
