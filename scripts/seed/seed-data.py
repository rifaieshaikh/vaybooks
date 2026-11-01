#!/usr/bin/env python3
"""Backend seed orchestrator (interactive + non-interactive).

Run from the vaybooks repo root (API / backend context):

  python scripts/seed/seed-data.py
  python scripts/seed/seed-data.py --list
  python scripts/seed/seed-data.py --run category_analytics --yes
  python scripts/seed/seed-data.py --run all --yes

Packs are registered in vaybooks.bms.infrastructure.db.seed_master.registry.
A Mongo master ledger (collection demo_seed_master + demo_seed_runs) records
every pack run, status, markers, and summaries.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure vaybooks package root is importable when invoked as a script.
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def main(argv: list[str] | None = None) -> int:
    from vaybooks.bms.infrastructure.db.seed_master.interactive import main as orchestrate

    return orchestrate(argv)


if __name__ == "__main__":
    raise SystemExit(main())
