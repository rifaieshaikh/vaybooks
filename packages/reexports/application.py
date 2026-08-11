"""Step A re-export: application layer access via platform package."""

from __future__ import annotations

import importlib
from types import ModuleType

_APPLICATION_MODULE = "vaybooks.bms.application"

try:
    _application = importlib.import_module(_APPLICATION_MODULE)
except ImportError:  # pragma: no cover - migration bootstrap
    _application = None  # type: ignore[assignment]


def application_root() -> ModuleType:
    """Return the root ``vaybooks.bms.application`` module."""
    if _application is None:
        raise ImportError(
            f"Could not import {_APPLICATION_MODULE}. "
            "Ensure vaybooks is installed and on PYTHONPATH."
        )
    return _application


# Re-export the module namespace for ``from packages.reexports.application import *``.
if _application is not None:
    for _name in dir(_application):
        if not _name.startswith("_"):
            globals()[_name] = getattr(_application, _name)

__all__ = ["application_root"]
