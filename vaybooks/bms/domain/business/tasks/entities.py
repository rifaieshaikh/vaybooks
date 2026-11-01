from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from vaybooks.bms.domain.business.activities.entities import CREATED_STATUS
from vaybooks.bms.domain.shared.date_utils import utc_now


@dataclass
class BusinessTask:
    """Free-standing business job (the task is the job)."""

    activity_id: str
    activity_name: str
    title: str = ""
    status: str = CREATED_STATUS
    assignee_worker_id: str = ""
    assignee_name: str = ""
    due_date: Optional[date] = None
    notes: str = ""
    estimated_hours: float = 0.0
    id: str = field(default_factory=lambda: uuid4().hex)
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
