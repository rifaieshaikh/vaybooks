#!/usr/bin/env python3
"""Retired route-checklist generator.

docs/parity-checklist.md is maintained directly.
"""

from __future__ import annotations

import sys


def main() -> int:
    print(
        "docs/parity-checklist.md is maintained directly; this generator no longer rewrites it.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
