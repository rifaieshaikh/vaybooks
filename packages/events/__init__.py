"""Domain event registry and specifications."""

from packages.events.registry import (
    EVENT_REGISTRY,
    EventSpec,
    get_event,
    list_events,
    validate_event_name,
)

__all__ = [
    "EVENT_REGISTRY",
    "EventSpec",
    "get_event",
    "list_events",
    "validate_event_name",
]
