from datetime import date
from typing import List, Optional, Union

from vaybooks.bms.domain.boutique.deliveries.entities import Delivery
from vaybooks.bms.domain.boutique.orders.entities import CustomizationItem, CustomizationOrder
from vaybooks.bms.domain.shared.date_utils import (
    calculate_duration_minutes,
    minutes_to_hours,
    utc_now,
)
from vaybooks.bms.domain.boutique.time_tracking.entities import (
    DELIVERY_ACTIVITY_NAME,
    ETD_ACTIVITY_ID,
    ETD_ACTIVITY_NAME,
    TaskType,
    TimeEntry,
)
from vaybooks.bms.domain.boutique.time_tracking.repository import TimeTrackingRepository
from vaybooks.bms.domain.shared.enums import ActivityStatus


class TimeTrackingDomainService:
    def __init__(self, repo: TimeTrackingRepository):
        self._repo = repo

    def create_time_entry(
        self,
        order_id: str,
        order_number: str,
        bill_id: str,
        bill_number: str,
        activity_id: str,
        activity_name: str,
        work_date: date,
        start_time: str,
        end_time: str,
        worker_name: str = "",
        notes: str = "",
        ends_next_day: bool = False,
        task_type: TaskType = TaskType.ACTIVITY,
        duration_minutes: Optional[int] = None,
    ) -> TimeEntry:
        if duration_minutes is None:
            duration = calculate_duration_minutes(
                start_time, end_time, ends_next_day=ends_next_day
            )
        else:
            duration = duration_minutes
        entry = TimeEntry(
            order_id=order_id,
            order_number=order_number,
            bill_id=bill_id,
            bill_number=bill_number,
            activity_id=activity_id,
            activity_name=activity_name,
            work_date=work_date,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration,
            worker_name=worker_name,
            notes=notes,
            task_type=task_type,
            status="Completed" if start_time and end_time else "Created",
        )
        return self._repo.save(entry)

    def upsert_activity_task(
        self,
        order: CustomizationOrder,
        item: CustomizationItem,
        activity_id: str,
        activity_name: str,
        estimated_hours: float = 0.0,
    ) -> TimeEntry:
        """Ensure one Created activity task placeholder per in-house activity on an item."""
        existing = next(
            (
                e
                for e in self._repo.find_by_order(order.id)
                if e.task_type == TaskType.ACTIVITY
                and e.bill_id == item.item_id
                and e.activity_id == activity_id
                and e.is_placeholder
            ),
            None,
        )
        work_date = item.expected_delivery_date or order.expected_delivery_date or date.today()
        hours = round(float(estimated_hours or 0), 2)
        if existing:
            changed = False
            if existing.bill_number != item.bill_number:
                existing.bill_number = item.bill_number
                changed = True
            if existing.order_number != order.order_number:
                existing.order_number = order.order_number
                changed = True
            if existing.activity_name != activity_name:
                existing.activity_name = activity_name
                changed = True
            if abs(float(existing.estimated_hours or 0) - hours) > 1e-9:
                existing.estimated_hours = hours
                changed = True
            if existing.work_date != work_date and not existing.start_time:
                existing.work_date = work_date
                changed = True
            # Keep Scheduled placeholders; only normalize blank status.
            if not (existing.status or "").strip():
                existing.status = "Created"
                changed = True
            if changed:
                existing.updated_at = utc_now()
                return self._repo.save(existing)
            return existing
        entry = TimeEntry(
            order_id=order.id,
            order_number=order.order_number,
            bill_id=item.item_id,
            bill_number=item.bill_number,
            activity_id=activity_id,
            activity_name=activity_name,
            work_date=work_date,
            start_time="",
            end_time="",
            duration_minutes=0,
            notes="Auto-created task",
            task_type=TaskType.ACTIVITY,
            status="Created",
            estimated_hours=hours,
            auto_schedule=True,
        )
        return self._repo.save(entry)

    def sync_activity_tasks_for_order(
        self,
        order: CustomizationOrder,
    ) -> List[TimeEntry]:
        """Create/update Created placeholders for every required activity; drop orphans."""
        wanted: set[tuple[str, str]] = set()
        created: List[TimeEntry] = []
        for activity in order.order_activities:
            if not activity.is_required:
                continue
            if activity.activity_status == ActivityStatus.SKIPPED:
                continue
            item = order.get_item_by_id(activity.bill_id)
            if not item:
                continue
            wanted.add((activity.bill_id, activity.activity_id))
            created.append(
                self.upsert_activity_task(
                    order,
                    item,
                    activity.activity_id,
                    activity.activity_name,
                    estimated_hours=float(activity.estimated_hours or 0),
                )
            )

        # Remove Created placeholders for activities no longer on the order.
        for entry in list(self._repo.find_by_order(order.id)):
            if entry.task_type != TaskType.ACTIVITY or not entry.is_placeholder:
                continue
            if (entry.bill_id, entry.activity_id) not in wanted:
                self._repo.delete(entry.id)
        return created

    def find_activity_placeholder(
        self, order_id: str, bill_id: str, activity_id: str
    ) -> Optional[TimeEntry]:
        return next(
            (
                e
                for e in self._repo.find_by_order(order_id)
                if e.task_type == TaskType.ACTIVITY
                and e.bill_id == bill_id
                and e.activity_id == activity_id
                and e.is_placeholder
            ),
            None,
        )

    def complete_activity_placeholder(
        self, order_id: str, bill_id: str, activity_id: str
    ) -> Optional[TimeEntry]:
        """Mark the Created placeholder Completed (e.g. outsourced complete without time)."""
        placeholder = self.find_activity_placeholder(order_id, bill_id, activity_id)
        if not placeholder:
            # Also close any Created activity row for this bill/activity even if
            # status alone marks it (empty times already covered by is_placeholder).
            placeholder = next(
                (
                    e
                    for e in self._repo.find_by_order(order_id)
                    if e.task_type == TaskType.ACTIVITY
                    and e.bill_id == bill_id
                    and e.activity_id == activity_id
                    and (e.status or "") == "Created"
                ),
                None,
            )
        if not placeholder:
            return None
        placeholder.status = "Completed"
        placeholder.updated_at = utc_now()
        return self._repo.save(placeholder)

    def upsert_etd_task(
        self, order: CustomizationOrder, item: CustomizationItem
    ) -> Optional[TimeEntry]:
        etd = item.expected_delivery_date or order.expected_delivery_date
        if not etd:
            return None
        existing = next(
            (
                e
                for e in self._repo.find_by_order(order.id)
                if e.task_type == TaskType.ETD and e.bill_id == item.item_id
            ),
            None,
        )
        if existing:
            if existing.work_date == etd and existing.bill_number == item.bill_number:
                return existing
            existing.work_date = etd
            existing.bill_number = item.bill_number
            existing.order_number = order.order_number
            existing.updated_at = utc_now()
            return self._repo.save(existing)
        return self.create_time_entry(
            order_id=order.id,
            order_number=order.order_number,
            bill_id=item.item_id,
            bill_number=item.bill_number,
            activity_id=ETD_ACTIVITY_ID,
            activity_name=ETD_ACTIVITY_NAME,
            work_date=etd,
            start_time="",
            end_time="",
            duration_minutes=0,
            task_type=TaskType.ETD,
            notes="System ETD task",
        )

    def sync_etd_tasks_for_order(self, order: CustomizationOrder) -> List[TimeEntry]:
        return [
            entry
            for item in order.customization_items
            if (entry := self.upsert_etd_task(order, item)) is not None
        ]

    def create_delivery_task(
        self, order: CustomizationOrder, delivery: Delivery
    ) -> TimeEntry:
        bill_ids = list(delivery.bill_ids or [])
        primary_bill_id = bill_ids[0] if bill_ids else ""
        bill = order.get_bill_by_id(primary_bill_id) if primary_bill_id else None
        bill_number = bill.bill_number if bill else ""
        bill_labels = []
        for bid in bill_ids:
            item = order.get_item_by_id(bid) if hasattr(order, "get_item_by_id") else None
            if item is None:
                item = order.get_bill_by_id(bid)
            if item:
                bill_labels.append(item.bill_number)
            else:
                bill_labels.append(bid)
        notes = f"Delivery {delivery.id}"
        if bill_labels:
            notes = f"{notes}: {', '.join(bill_labels)}"
        if delivery.delivery_notes:
            notes = f"{notes}. {delivery.delivery_notes}"
        existing = next(
            (
                e
                for e in self._repo.find_by_order(order.id)
                if e.task_type == TaskType.DELIVERY
                and e.activity_id == f"delivery:{delivery.id}"
            ),
            None,
        )
        if existing:
            existing.work_date = delivery.delivery_date
            existing.bill_id = primary_bill_id
            existing.bill_number = bill_number
            existing.notes = notes
            existing.updated_at = utc_now()
            return self._repo.save(existing)
        return self.create_time_entry(
            order_id=order.id,
            order_number=order.order_number,
            bill_id=primary_bill_id,
            bill_number=bill_number,
            activity_id=f"delivery:{delivery.id}",
            activity_name=DELIVERY_ACTIVITY_NAME,
            work_date=delivery.delivery_date,
            start_time="",
            end_time="",
            duration_minutes=0,
            task_type=TaskType.DELIVERY,
            notes=notes,
        )

    def get_total_minutes(
        self,
        entries: List[TimeEntry],
        activity_name: Optional[str] = None,
        bill_number: Optional[str] = None,
    ) -> int:
        filtered = [e for e in entries if e.task_type == TaskType.ACTIVITY]
        if activity_name:
            filtered = [e for e in filtered if e.activity_name == activity_name]
        if bill_number:
            filtered = [e for e in filtered if e.bill_number == bill_number]
        return sum(e.duration_minutes for e in filtered)

    def get_summary(self, entries: List[TimeEntry]) -> dict:
        activity_entries = [e for e in entries if e.task_type == TaskType.ACTIVITY]
        stitching = self.get_total_minutes(activity_entries, activity_name="Stitching")
        hand_work = self.get_total_minutes(activity_entries, activity_name="Handwork")
        by_bill: dict = {}
        by_activity: dict = {}
        for entry in activity_entries:
            by_bill[entry.bill_number] = (
                by_bill.get(entry.bill_number, 0) + entry.duration_minutes
            )
            by_activity[entry.activity_name] = (
                by_activity.get(entry.activity_name, 0) + entry.duration_minutes
            )
        return {
            "total_stitching_minutes": stitching,
            "total_hand_work_minutes": hand_work,
            "total_stitching_hours": minutes_to_hours(stitching),
            "total_hand_work_hours": minutes_to_hours(hand_work),
            "by_bill": by_bill,
            "by_activity": by_activity,
        }

    def list_for_calendar(
        self,
        start_date: date,
        end_date: date,
        task_type: Optional[Union[TaskType, str]] = None,
        worker_name: Optional[str] = None,
        activity_name: Optional[str] = None,
    ) -> List[TimeEntry]:
        entries = self._repo.search(
            work_date_from=start_date, work_date_to=end_date
        )
        if task_type and task_type != "all":
            resolved = (
                task_type
                if isinstance(task_type, TaskType)
                else TaskType(str(task_type))
            )
            entries = [e for e in entries if e.task_type == resolved]
        if activity_name:
            needle = activity_name.strip().lower()
            entries = [
                e
                for e in entries
                if e.task_type == TaskType.ACTIVITY
                and (e.activity_name or "").strip().lower() == needle
            ]
        if worker_name:
            needle = worker_name.strip().lower()
            entries = [
                e for e in entries if (e.worker_name or "").strip().lower() == needle
            ]
        return sorted(entries, key=lambda e: (e.work_date, e.activity_name))

