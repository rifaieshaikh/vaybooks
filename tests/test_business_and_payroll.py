from datetime import date
from types import SimpleNamespace

from vaybooks.bms.application.business.activities.service import BusinessActivityAppService
from vaybooks.bms.application.business.tasks.service import BusinessTaskAppService
from vaybooks.bms.application.business.time_tracking.service import (
    BusinessTimeTrackingAppService,
)
from vaybooks.bms.application.parties.workers.payroll import calculate_salary
from vaybooks.bms.domain.business.activities.entities import BusinessActivityConfig
from vaybooks.bms.domain.business.tasks.entities import BusinessTask
from vaybooks.bms.domain.business.time_tracking.entities import BusinessTimeEntry
from vaybooks.bms.domain.parties.workers.entities import (
    SOURCE_BUSINESS,
    Worker,
    WorkerActivityRef,
)
from vaybooks.bms.domain.shared.enums import ActivityCategory
from vaybooks.bms.domain.shared.exceptions import ValidationError


class _MemRepo:
    def __init__(self):
        self._items = {}

    def save(self, item):
        self._items[item.id] = item
        return item

    def find_by_id(self, item_id):
        return self._items.get(item_id)

    def list_all(self, active_only=True):
        rows = list(self._items.values())
        if active_only and rows and hasattr(rows[0], "is_active"):
            return [r for r in rows if getattr(r, "is_active", True)]
        return rows

    def find_by_name(self, name):
        for item in self._items.values():
            if getattr(item, "activity_name", None) == name:
                return item
        return None

    def find_by_task(self, task_id):
        return [e for e in self._items.values() if getattr(e, "task_id", None) == task_id]

    def delete(self, item_id):
        self._items.pop(item_id, None)


class _WorkerRepo:
    def __init__(self, workers):
        self._workers = {w.id: w for w in workers}

    def find_by_id(self, worker_id):
        return self._workers.get(worker_id)


def test_business_task_flow_create_assign_time_complete():
    act_repo = _MemRepo()
    task_repo = _MemRepo()
    time_repo = _MemRepo()
    activities = BusinessActivityAppService(act_repo)
    activity = activities.create_activity(
        "Admin work",
        ActivityCategory.IN_HOUSE_SERVICE.value,
        default_hourly_expense=100,
    )
    worker = Worker(
        worker_name="Alex",
        activity_refs=[WorkerActivityRef(activity_id=activity.id, source=SOURCE_BUSINESS)],
        default_hourly_rate=120,
    )
    workers = _WorkerRepo([worker])
    tasks = BusinessTaskAppService(task_repo, act_repo, workers, time_repo=time_repo)
    times = BusinessTimeTrackingAppService(time_repo, task_repo, act_repo, workers)

    task = tasks.create_task(activity.id, title="File GST")
    assert task.status == "Created"
    tasks.assign_task(task.id, worker.id)
    saved = tasks.get_task(task.id)
    assert saved.assignee_worker_id == worker.id

    try:
        tasks.complete_task(task.id)
        assert False, "expected time gate"
    except ValidationError:
        pass

    entry = times.record_time_entry(
        task_id=task.id,
        worker_id=worker.id,
        work_date=date(2026, 8, 1),
        start_time="09:00",
        end_time="11:00",
    )
    assert entry.duration_minutes == 120
    completed = tasks.complete_task(task.id)
    assert completed.status == "Completed"


def test_salary_prorate_and_hourly():
    worker = Worker(
        worker_name="Sam",
        base_salary=30000,
        default_hourly_rate=100,
        ot_threshold_hours=40,
        ot_multiplier=1.5,
        allowances=[{"label": "Travel", "amount": 500}],
    )
    preview = calculate_salary(worker, date(2026, 8, 1), date(2026, 8, 15), attributed_hours=45)
    assert preview.total > 0
    codes = {line.code for line in preview.lines}
    assert "base" in codes
    assert "allowance" in codes
    assert "overtime" in codes
    assert preview.ot_hours == 5

    hourly = Worker(worker_name="Lee", base_salary=0, default_hourly_rate=80)
    hprev = calculate_salary(hourly, date(2026, 8, 1), date(2026, 8, 7), attributed_hours=10)
    assert any(l.code == "hourly" for l in hprev.lines)
    assert hprev.total == 800
