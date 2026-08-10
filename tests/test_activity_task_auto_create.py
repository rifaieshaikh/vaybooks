"""Auto-create Created activity task placeholders for required activities."""

from datetime import date

from vaybooks.bms.domain.boutique.activities.entities import ActivityConfig
from vaybooks.bms.domain.boutique.activities.services import ActivityDomainService
from vaybooks.bms.domain.boutique.orders.entities import (
    CustomizationItem,
    CustomizationOrder,
    OrderActivity,
)
from vaybooks.bms.domain.boutique.time_tracking.entities import TaskType, TimeEntry
from vaybooks.bms.domain.boutique.time_tracking.services import TimeTrackingDomainService
from vaybooks.bms.domain.shared.enums import ActivityStatus, ActivityType, OrderStatus
from vaybooks.bms.domain.shared.exceptions import IncompleteTimeEntriesError

from tests.conftest import FakeTimeTrackingRepository


def _order_with_item_activity(*, activity_id="act-stitch", skipped=False, required=True):
    item = CustomizationItem(
        item_id="bill-1",
        bill_number="M-001-1",
        description="Lehenga",
        expected_delivery_date=date(2026, 8, 20),
    )
    activity = OrderActivity(
        order_activity_id="oa-1",
        activity_id=activity_id,
        activity_name="Stitching",
        is_required=required,
        bill_id=item.item_id,
        estimated_hours=3.5,
        activity_status=ActivityStatus.SKIPPED if skipped else ActivityStatus.PENDING,
    )
    order = CustomizationOrder(
        id="ord-1",
        order_number="CO-1001",
        customer_id="c1",
        customer_name="Aysha",
        phone_number="9999999999",
        order_date=date.today(),
        expected_delivery_date=date(2026, 8, 20),
        order_status=OrderStatus.IN_PROGRESS,
        customization_items=[item],
        order_activities=[activity],
    )
    return order, item, activity


def test_sync_creates_created_placeholder_for_required_activity():
    repo = FakeTimeTrackingRepository()
    domain = TimeTrackingDomainService(repo)
    order, item, activity = _order_with_item_activity()

    created = domain.sync_activity_tasks_for_order(order)

    assert len(created) == 1
    entry = created[0]
    assert entry.task_type == TaskType.ACTIVITY
    assert entry.status == "Created"
    assert entry.is_placeholder
    assert entry.start_time == ""
    assert entry.end_time == ""
    assert entry.estimated_hours == 3.5
    assert entry.auto_schedule is True
    assert entry.bill_id == item.item_id
    assert entry.activity_id == activity.activity_id
    assert entry.work_date == date(2026, 8, 20)
    assert entry.notes == "Auto-created task"


def test_sync_is_idempotent_and_skips_skipped_activities():
    repo = FakeTimeTrackingRepository()
    domain = TimeTrackingDomainService(repo)
    order, _, activity = _order_with_item_activity()

    first = domain.sync_activity_tasks_for_order(order)
    second = domain.sync_activity_tasks_for_order(order)
    assert len(first) == 1
    assert len(second) == 1
    assert first[0].id == second[0].id
    assert len(repo.find_by_order(order.id)) == 1

    order.order_activities[0].activity_status = ActivityStatus.SKIPPED
    domain.sync_activity_tasks_for_order(order)
    assert repo.find_by_order(order.id) == []


def test_sync_skips_non_required_activities():
    repo = FakeTimeTrackingRepository()
    domain = TimeTrackingDomainService(repo)
    order, _, _ = _order_with_item_activity(required=False)

    created = domain.sync_activity_tasks_for_order(order)
    assert created == []
    assert repo.find_by_order(order.id) == []


def test_complete_activity_placeholder():
    repo = FakeTimeTrackingRepository()
    domain = TimeTrackingDomainService(repo)
    order, item, activity = _order_with_item_activity()
    domain.sync_activity_tasks_for_order(order)
    closed = domain.complete_activity_placeholder(
        order.id, item.item_id, activity.activity_id
    )
    assert closed is not None
    assert closed.status == "Completed"
    assert closed.is_placeholder  # still empty times, but Completed for outsourced


def test_in_house_completion_rejects_placeholder_only():
    order, item, activity = _order_with_item_activity()
    cfg = ActivityConfig(
        id=activity.activity_id,
        activity_name="Stitching",
        activity_type=ActivityType.IN_HOUSE,
        is_in_house=True,
        requires_time_tracking=True,
        default_hourly_expense=100,
    )
    placeholder = TimeEntry(
        order_id=order.id,
        order_number=order.order_number,
        bill_id=item.item_id,
        bill_number=item.bill_number,
        activity_id=activity.activity_id,
        activity_name=activity.activity_name,
        work_date=date.today(),
        start_time="",
        end_time="",
        duration_minutes=0,
        status="Created",
    )
    domain = ActivityDomainService()
    try:
        domain.prepare_completion(order, activity, cfg, [placeholder])
        assert False, "expected IncompleteTimeEntriesError"
    except IncompleteTimeEntriesError as exc:
        assert "Record time on the task" in str(exc)


def test_outsourced_completion_needs_no_time():
    order, item, activity = _order_with_item_activity(activity_id="act-out")
    cfg = ActivityConfig(
        id=activity.activity_id,
        activity_name="Embroidery",
        activity_type=ActivityType.OUTSOURCED,
        is_in_house=False,
        requires_time_tracking=False,
        default_hourly_expense=0,
    )
    preview = ActivityDomainService().prepare_completion(order, activity, cfg, [])
    assert preview.needs_expense is False
