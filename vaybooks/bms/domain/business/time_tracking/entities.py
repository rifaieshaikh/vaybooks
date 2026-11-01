from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from vaybooks.bms.domain.business.activities.entities import CREATED_STATUS
from vaybooks.bms.domain.shared.date_utils import utc_now


@dataclass
class BusinessTimeEntry:
    """Time logged against a free-standing business task."""

    task_id: str
    activity_id: str
    activity_name: str
    worker_id: str
    worker_name: str
    work_date: date
    start_time: str
    end_time: str
    duration_minutes: int
    hourly_rate: float = 0.0
    labour_cost: float = 0.0
    notes: str = ""
    status: str = CREATED_STATUS
    id: str = field(default_factory=lambda: uuid4().hex)
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
