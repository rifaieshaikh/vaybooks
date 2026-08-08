"""Serialize domain party entities to JSON-friendly dicts."""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from enum import Enum
from typing import Any


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if is_dataclass(value) and not isinstance(value, type):
        return {k: _jsonable(v) for k, v in asdict(value).items()}
    if hasattr(value, "__dict__"):
        return {
            k: _jsonable(v)
            for k, v in vars(value).items()
            if not k.startswith("_")
        }
    return str(value)


def entity_dict(entity: Any) -> dict[str, Any]:
    data = _jsonable(entity)
    if not isinstance(data, dict):
        return {"value": data}
    # Convenience mirrors used by Streamlit cards
    if "customer_name" in data and "name" not in data:
        data["name"] = data["customer_name"]
    if "vendor_name" in data and "name" not in data:
        data["name"] = data["vendor_name"]
    if "partner_name" in data and "name" not in data:
        data["name"] = data.get("legal_display_name") or data["partner_name"]
    if "agent_name" in data and "name" not in data:
        data["name"] = data["agent_name"]
    if "worker_name" in data and "name" not in data:
        data["name"] = data["worker_name"]
    return data
