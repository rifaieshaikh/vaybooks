from datetime import date
from typing import List, Optional

from vaybooks.bms.domain.business.activities.entities import (
    COMPLETED_STATUS,
    CREATED_STATUS,
    DEFAULT_ACTIVITY_STATUSES,
)
from vaybooks.bms.domain.business.activities.repository import BusinessActivityRepository
from vaybooks.bms.domain.business.tasks.entities import BusinessTask
from vaybooks.bms.domain.business.tasks.repository import BusinessTaskRepository
from vaybooks.bms.domain.business.time_tracking.repository import (
    BusinessTimeTrackingRepository,
)
from vaybooks.bms.domain.parties.workers.entities import SOURCE_BUSINESS
from vaybooks.bms.domain.parties.workers.repository import WorkerRepository
from vaybooks.bms.domain.shared.date_utils import utc_now
from vaybooks.bms.domain.shared.exceptions import ValidationError


class BusinessTaskAppService:
    def __init__(
        self,
        task_repo: BusinessTaskRepository,
        activity_repo: BusinessActivityRepository,
        worker_repo: WorkerRepository,
        time_repo: Optional[BusinessTimeTrackingRepository] = None,
    ):
        self._task_repo = task_repo
        self._activity_repo = activity_repo
        self._worker_repo = worker_repo
        self._time_repo = time_repo

    def list_tasks(self) -> List[BusinessTask]:
        return self._task_repo.list_all()

    def get_task(self, task_id: str) -> Optional[BusinessTask]:
        return self._task_repo.find_by_id(task_id)

    def create_task(
        self,
        activity_id: str,
        title: str = "",
        notes: str = "",
        due_date: Optional[date] = None,
        estimated_hours: float = 0.0,
        assignee_worker_id: str = "",
    ) -> BusinessTask:
        activity = self._activity_repo.find_by_id(activity_id)
        if activity is None:
            raise ValidationError("Business activity not found")
        if not activity.is_active:
            raise ValidationError("This business activity is inactive")
        task = BusinessTask(
            activity_id=activity.id,
            activity_name=activity.activity_name,
            title=(title or activity.activity_name).strip(),
            status=CREATED_STATUS,
            notes=notes or "",
            due_date=due_date,
            estimated_hours=float(estimated_hours or 0.0),
        )
        if assignee_worker_id:
            self._apply_assignee(task, assignee_worker_id)
        return self._task_repo.save(task)

    def _apply_assignee(self, task: BusinessTask, worker_id: str) -> None:
        worker_id = (worker_id or "").strip()
        if not worker_id:
            task.assignee_worker_id = ""
            task.assignee_name = ""
            return
        worker = self._worker_repo.find_by_id(worker_id)
        if worker is None:
            raise ValidationError("Employee not found")
        if not worker.has_activity(task.activity_id, SOURCE_BUSINESS):
            raise ValidationError(
                "This employee is not assigned to the selected business activity"
            )
        task.assignee_worker_id = worker.id
        task.assignee_name = worker.worker_name

    def assign_task(self, task_id: str, worker_id: str) -> BusinessTask:
        task = self._task_repo.find_by_id(task_id)
        if not task:
            raise ValueError("Business task not found")
        self._apply_assignee(task, worker_id)
        task.updated_at = utc_now()
        return self._task_repo.save(task)

    def update_task(
        self,
        task_id: str,
        *,
        title: Optional[str] = None,
        notes: Optional[str] = None,
        due_date: Optional[date] = None,
        estimated_hours: Optional[float] = None,
        clear_due_date: bool = False,
    ) -> BusinessTask:
        task = self._task_repo.find_by_id(task_id)
        if not task:
            raise ValueError("Business task not found")
        if title is not None:
            task.title = title.strip() or task.activity_name
        if notes is not None:
            task.notes = notes
        if clear_due_date:
            task.due_date = None
        elif due_date is not None:
            task.due_date = due_date
        if estimated_hours is not None:
            task.estimated_hours = float(estimated_hours or 0.0)
        task.updated_at = utc_now()
        return self._task_repo.save(task)

    def set_status(self, task_id: str, status: str) -> BusinessTask:
        task = self._task_repo.find_by_id(task_id)
        if not task:
            raise ValueError("Business task not found")
        activity = self._activity_repo.find_by_id(task.activity_id)
        allowed = activity.statuses if activity else list(DEFAULT_ACTIVITY_STATUSES)
        if status not in allowed:
            raise ValidationError(f"Invalid status: {status}")
        if status == COMPLETED_STATUS and activity and activity.requires_time_tracking:
            if self._time_repo is None:
                raise ValidationError("Record time on the task before completing")
            entries = self._time_repo.find_by_task(task_id)
            real = [
                e
                for e in entries
                if (e.start_time or "").strip() and (e.end_time or "").strip()
            ]
            if not real:
                raise ValidationError(
                    "Record time on the task before completing this activity"
                )
        task.status = status
        task.updated_at = utc_now()
        return self._task_repo.save(task)

    def complete_task(self, task_id: str) -> BusinessTask:
        return self.set_status(task_id, COMPLETED_STATUS)

    def delete_task(self, task_id: str) -> None:
        self._task_repo.delete(task_id)
