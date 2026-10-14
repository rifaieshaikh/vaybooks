"""Period salary calculation for employees."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, List, Optional, Protocol


@dataclass
class SalaryLine:
    code: str
    label: str
    amount: float
    meta: dict = field(default_factory=dict)


@dataclass
class SalaryPreview:
    worker_id: str
    worker_name: str
    period_from: date
    period_to: date
    lines: List[SalaryLine]
    total: float
    attributed_hours: float
    regular_hours: float
    ot_hours: float


class _TimeSource(Protocol):
    def hours_for_worker(
        self, worker_id: str, period_from: date, period_to: date
    ) -> float: ...


def _days_inclusive(a: date, b: date) -> int:
    return (b - a).days + 1


def calculate_salary(
    worker: Any,
    period_from: date,
    period_to: date,
    attributed_hours: float,
) -> SalaryPreview:
    """Compute pay for [period_from, period_to] using plan defaults.

    - Base: prorate monthly base_salary by calendar days in range / days in month
      of period_from (simple proration).
    - Allowances: sum fixed allowances for the full period (if any overlap).
    - OT: hours above ot_threshold_hours × default_hourly_rate × ot_multiplier.
    - Hourly-only (base_salary == 0): pay attributed hours × default_hourly_rate
      as regular wages (no separate OT split unless threshold set).
    """
    if period_to < period_from:
        raise ValueError("period_to must be on or after period_from")

    base_salary = float(getattr(worker, "base_salary", 0) or 0)
    allowances = list(getattr(worker, "allowances", None) or [])
    hourly = float(getattr(worker, "default_hourly_rate", 0) or 0)
    ot_threshold = float(getattr(worker, "ot_threshold_hours", 0) or 0)
    ot_mult = float(getattr(worker, "ot_multiplier", 1.5) or 1.5)
    hours = max(0.0, float(attributed_hours or 0))

    lines: List[SalaryLine] = []
    period_days = _days_inclusive(period_from, period_to)
    # days in the month of period_from for monthly proration
    month_start = period_from.replace(day=1)
    if period_from.month == 12:
        next_month = period_from.replace(year=period_from.year + 1, month=1, day=1)
    else:
        next_month = period_from.replace(month=period_from.month + 1, day=1)
    month_days = (next_month - month_start).days

    if base_salary > 0:
        prorated = round(base_salary * (period_days / max(month_days, 1)), 2)
        lines.append(
            SalaryLine(
                code="base",
                label="Base salary (prorated)",
                amount=prorated,
                meta={"base_salary": base_salary, "period_days": period_days, "month_days": month_days},
            )
        )
        regular_hours = hours
        ot_hours = 0.0
        if ot_threshold > 0 and hours > ot_threshold:
            ot_hours = round(hours - ot_threshold, 2)
            regular_hours = round(ot_threshold, 2)
            ot_pay = round(ot_hours * hourly * ot_mult, 2)
            if ot_pay:
                lines.append(
                    SalaryLine(
                        code="overtime",
                        label=f"Overtime ({ot_hours}h × {hourly} × {ot_mult})",
                        amount=ot_pay,
                        meta={"ot_hours": ot_hours, "rate": hourly, "multiplier": ot_mult},
                    )
                )
    else:
        # Hourly-only worker
        ot_hours = 0.0
        regular_hours = hours
        if ot_threshold > 0 and hours > ot_threshold:
            ot_hours = round(hours - ot_threshold, 2)
            regular_hours = round(ot_threshold, 2)
            regular_pay = round(regular_hours * hourly, 2)
            ot_pay = round(ot_hours * hourly * ot_mult, 2)
            if regular_pay:
                lines.append(
                    SalaryLine(
                        code="hourly",
                        label=f"Hourly wages ({regular_hours}h × {hourly})",
                        amount=regular_pay,
                        meta={"hours": regular_hours, "rate": hourly},
                    )
                )
            if ot_pay:
                lines.append(
                    SalaryLine(
                        code="overtime",
                        label=f"Overtime ({ot_hours}h × {hourly} × {ot_mult})",
                        amount=ot_pay,
                        meta={"ot_hours": ot_hours, "rate": hourly, "multiplier": ot_mult},
                    )
                )
        else:
            pay = round(hours * hourly, 2)
            if pay or hours:
                lines.append(
                    SalaryLine(
                        code="hourly",
                        label=f"Hourly wages ({hours}h × {hourly})",
                        amount=pay,
                        meta={"hours": hours, "rate": hourly},
                    )
                )

    for item in allowances:
        if isinstance(item, dict):
            label = str(item.get("label") or item.get("name") or "Allowance").strip()
            amount = float(item.get("amount") or 0)
        else:
            label = str(getattr(item, "label", None) or getattr(item, "name", None) or "Allowance")
            amount = float(getattr(item, "amount", 0) or 0)
        if amount:
            lines.append(
                SalaryLine(code="allowance", label=label, amount=round(amount, 2))
            )

    total = round(sum(l.amount for l in lines), 2)
    return SalaryPreview(
        worker_id=worker.id,
        worker_name=worker.worker_name,
        period_from=period_from,
        period_to=period_to,
        lines=lines,
        total=total,
        attributed_hours=hours,
        regular_hours=regular_hours,
        ot_hours=ot_hours,
    )


def preview_to_dict(preview: SalaryPreview) -> dict:
    return {
        "worker_id": preview.worker_id,
        "worker_name": preview.worker_name,
        "period_from": preview.period_from.isoformat(),
        "period_to": preview.period_to.isoformat(),
        "attributed_hours": preview.attributed_hours,
        "regular_hours": preview.regular_hours,
        "ot_hours": preview.ot_hours,
        "lines": [
            {
                "code": line.code,
                "label": line.label,
                "amount": line.amount,
                "meta": line.meta,
            }
            for line in preview.lines
        ],
        "total": preview.total,
    }
