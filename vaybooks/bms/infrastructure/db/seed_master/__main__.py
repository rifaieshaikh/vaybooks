"""python -m vaybooks.bms.infrastructure.db.seed_master

Prefer the backend script entrypoint:

  python scripts/seed/seed-data.py
"""

from vaybooks.bms.infrastructure.db.seed_master.interactive import main

if __name__ == "__main__":
    raise SystemExit(main())
