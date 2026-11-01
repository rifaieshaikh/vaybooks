from datetime import datetime
from typing import List, Optional

from pymongo.database import Database

from vaybooks.bms.domain.business.activities.entities import CREATED_STATUS
from vaybooks.bms.domain.business.tasks.entities import BusinessTask
from vaybooks.bms.infrastructure.db.bson_utils import from_bson_date, to_bson_value


class MongoBusinessTaskRepository:
    def __init__(self, db: Database):
        self._collection = db.business_tasks

    def _to_doc(self, task: BusinessTask) -> dict:
        return {
            "_id": task.id,
            "activity_id": task.activity_id,
            "activity_name": task.activity_name,
            "title": task.title,
            "status": task.status,
            "assignee_worker_id": task.assignee_worker_id or "",
            "assignee_name": task.assignee_name or "",
            "due_date": to_bson_value(task.due_date) if task.due_date else None,
            "notes": task.notes or "",
            "estimated_hours": float(task.estimated_hours or 0.0),
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }

    def _from_doc(self, doc: dict) -> BusinessTask:
        due = doc.get("due_date")
        return BusinessTask(
            id=doc["_id"],
            activity_id=doc["activity_id"],
            activity_name=doc.get("activity_name", ""),
            title=doc.get("title", "") or "",
            status=doc.get("status") or CREATED_STATUS,
            assignee_worker_id=doc.get("assignee_worker_id", "") or "",
            assignee_name=doc.get("assignee_name", "") or "",
            due_date=from_bson_date(due) if due else None,
            notes=doc.get("notes", "") or "",
            estimated_hours=float(doc.get("estimated_hours") or 0.0),
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow()),
        )

    def save(self, task: BusinessTask) -> BusinessTask:
        self._collection.replace_one({"_id": task.id}, self._to_doc(task), upsert=True)
        return task

    def find_by_id(self, task_id: str) -> Optional[BusinessTask]:
        doc = self._collection.find_one({"_id": task_id})
        return self._from_doc(doc) if doc else None

    def list_all(self) -> List[BusinessTask]:
        return [self._from_doc(d) for d in self._collection.find()]

    def delete(self, task_id: str) -> None:
        self._collection.delete_one({"_id": task_id})
