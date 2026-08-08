"""Step A re-export: domain layer access via platform package."""

from __future__ import annotations

import importlib
from types import ModuleType

_DOMAIN_MODULE = "vaybooks.bms.domain"

try:
    _domain = importlib.import_module(_DOMAIN_MODULE)
except ImportError:  # pragma: no cover - migration bootstrap
    _domain = None  # type: ignore[assignment]


def domain_root() -> ModuleType:
    """Return the root ``vaybooks.bms.domain`` module."""
    if _domain is None:
        raise ImportError(
            f"Could not import {_DOMAIN_MODULE}. "
            "Ensure vaybooks is installed and on PYTHONPATH."
        )
    return _domain


# Re-export the module namespace for ``from packages.reexports.domain import *``.
if _domain is not None:
    for _name in dir(_domain):
        if not _name.startswith("_"):
            globals()[_name] = getattr(_domain, _name)

__all__ = ["domain_root"]
