"""Event bus abstractions for desktop (in-process) and web (Kafka)."""

from __future__ import annotations

import threading
from collections import defaultdict
from typing import Any, Callable, DefaultDict, List, Protocol


class EventBus(Protocol):
    def subscribe(self, topic: str, handler: Callable[[dict], None]) -> None: ...

    def publish(self, topic: str, message: dict, *, version: int = 1) -> None: ...


class InProcessBus:
    """Lightweight pub/sub bus for desktop combined deployments."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._subscribers: DefaultDict[str, List[Callable[[dict], None]]] = defaultdict(list)

    def subscribe(self, topic: str, handler: Callable[[dict], None]) -> None:
        with self._lock:
            self._subscribers[topic].append(handler)

    def publish(self, topic: str, message: dict, *, version: int = 1) -> None:
        payload = {**message, "_event_version": version}
        with self._lock:
            handlers = list(self._subscribers.get(topic, []))
        for handler in handlers:
            handler(payload)


class KafkaBus:
    """Kafka adapter stub for web deployments — swap in without changing contracts."""

    def __init__(self, bootstrap_servers: str = "localhost:9092") -> None:
        self.bootstrap_servers = bootstrap_servers

    def subscribe(self, topic: str, handler: Callable[[dict], None]) -> None:
        print(f"[KafkaBus stub] subscribe topic={topic!r} servers={self.bootstrap_servers!r}")

    def publish(self, topic: str, message: dict, *, version: int = 1) -> None:
        print(
            f"[KafkaBus stub] publish topic={topic!r} v{version} message={message!r}"
        )


_bus: InProcessBus | None = None


def get_bus() -> InProcessBus:
    global _bus
    if _bus is None:
        _bus = InProcessBus()
    return _bus
