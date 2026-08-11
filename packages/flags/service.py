"""In-memory feature flags for module enablement during migration."""

from __future__ import annotations

from typing import List


class FlagsService:
    """Simple module enablement flags (Phase 0 bootstrap)."""

    def __init__(self, enabled_modules: List[str] | None = None) -> None:
        self._enabled: set[str] = set(enabled_modules or [])

    def get_enabled_modules(self) -> List[str]:
        """Return sorted list of enabled module ids."""
        return sorted(self._enabled)

    def set_enabled_modules(self, modules: List[str]) -> None:
        """Replace the enabled module list."""
        self._enabled = {m.strip() for m in modules if (m or "").strip()}

    def is_module_enabled(self, module: str) -> bool:
        """Return True if *module* is enabled."""
        return (module or "").strip() in self._enabled

    def enable_module(self, module: str) -> None:
        """Enable a single module."""
        key = (module or "").strip()
        if key:
            self._enabled.add(key)

    def disable_module(self, module: str) -> None:
        """Disable a single module."""
        self._enabled.discard((module or "").strip())
