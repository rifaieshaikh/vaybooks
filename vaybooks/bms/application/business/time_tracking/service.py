from datetime import date
from typing import List, Optional

from vaybooks.bms.domain.business.activities.entities import COMPLETED_STATUS
from vaybooks.bms.domain.business.activities.repository import BusinessActivityRepository
from vaybooks.bms.domain.business.tasks.repository import BusinessTaskRepository
from vaybooks.bms.domain.business.time_tracking.entities import BusinessTimeEntry
from vaybooks.bms.domain.business.time_tracking.repository import (
    BusinessTimeTrackingRepository,
)
from vaybooks.bms.domain.parties.workers.entities import SOURCE_BUSINESS
from vaybooks.bms.domain.parties.workers.repository import WorkerRepository
from vaybooks.bms.domain.shared.date_utils import calculate_duration_minutes, utc_now
from vaybooks.bms.domain.shared.exceptions import ValidationError


class BusinessTimeTrackingAppService:
    def __init__(
        self,
        time_repo: BusinessTimeTrackingRepository,
        task_repo: BusinessTaskRepository,
        activity_repo: BusinessActivityRepository,
        worker_repo: WorkerRepository,
    ):
        self._time_repo = time_repo
        self._task_repo = task_repo
        self._activity_repo = activity_repo
        self._worker_repo = worker_repo

    def _resolve_task(self, task_id: str):
        task = self._task_repo.find_by_id(task_id)
        if task is None:
            raise ValidationError("Business task not found")
        if task.status == COMPLETED_STATUS:
            raise ValidationError("Cannot log time on a completed task")
        return task

    def _resolve_worker(self, worker_id: str, activity_id: str):
        worker = self._worker_repo.find_by_id(worker_id)
        if worker is None:
            raise ValidationError("Employee not found")
        if not worker.has_activity(activity_id, SOURCE_BUSINESS):
            raise ValidationError(
                "This employee is not assigned to the selected business activity"
            )
        return worker

    @staticmethod
    def _labour_cost(duration_minutes: int, hourly_rate: float) -> float:
        return round((duration_minutes / 60) * hourly_rate, 2)

    def record_time_entry(
        self,
        task_id: str,
        worker_id: str,
        work_date: date,
        start_time: str,
        end_time: str,
        notes: str = "",
        ends_next_day: bool = False,
    ) -> BusinessTimeEntry:
        missing = []
        if not (start_time or "").strip():
            missing.append("start_time")
        if not (end_time or "").strip():
            missing.append("end_time")
        if missing:
            raise ValidationError(
                "; ".join(f"{field}: This field is required" for field in missing)
            )

        task = self._resolve_task(task_id)
        activity = self._activity_repo.find_by_id(task.activity_id)
        if activity is None:
            raise ValidationError("Business activity not found")
        if activity.requires_time_tracking is False:
            raise ValidationError(
                "This business activity does not require task time tracking"
            )
        worker = self._resolve_worker(worker_id, task.activity_id)

        duration_minutes = calculate_duration_minutes(
            start_time, end_time, ends_next_day=ends_next_day
        )
        hourly_rate = float(
            worker.default_hourly_rate or activity.default_hourly_expense or 0.0
        )
        entry = BusinessTimeEntry(
            task_id=task.id,
            activity_id=activity.id,
            activity_name=activity.activity_name,
            worker_id=worker.id,
            worker_name=worker.worker_name,
            work_date=work_date,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration_minutes,
            hourly_rate=hourly_rate,
            labour_cost=self._labour_cost(duration_minutes, hourly_rate),
            notes=notes,
            status=COMPLETED_STATUS,
        )
        return self._time_repo.save(entry)

    def list_all(self) -> List[BusinessTimeEntry]:
        return self._time_repo.list_all()

    def list_for_task(self, task_id: str) -> List[BusinessTimeEntry]:
        return self._time_repo.find_by_task(task_id)

    def get_entry(self, entry_id: str) -> Optional[BusinessTimeEntry]:
        return self._time_repo.find_by_id(entry_id)

    def delete_time_entry(self, entry_id: str) -> None:
        self._time_repo.delete(entry_id)

    def update_time_entry(
        self,
        entry_id: str,
        work_date: date,
        start_time: str,
        end_time: str,
        notes: str = "",
        ends_next_day: bool = False,
        worker_id: Optional[str] = None,
    ) -> BusinessTimeEntry:
        entry = self._time_repo.find_by_id(entry_id)
        if not entry:
            raise ValueError("Business time entry not found")
        activity = self._activity_repo.find_by_id(entry.activity_id)
        target_worker_id = worker_id or entry.worker_id
        worker = self._resolve_worker(target_worker_id, entry.activity_id)
        entry.worker_id = worker.id
        entry.worker_name = worker.worker_name
        entry.work_date = work_date
        entry.start_time = start_time
        entry.end_time = end_time
        entry.duration_minutes = calculate_duration_minutes(
            start_time, end_time, ends_next_day=ends_next_day
        )
        hourly = float(
            worker.default_hourly_rate
            or (activity.default_hourly_expense if activity else 0.0)
            or 0.0
        )
        entry.hourly_rate = hourly
        entry.labour_cost = self._labour_cost(entry.duration_minutes, hourly)
        entry.notes = notes
        entry.updated_at = utc_now()
        return self._time_repo.save(entry)
