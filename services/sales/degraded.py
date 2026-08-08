"""Sales degraded mode — true until Inventory + Finance consumers are healthy."""

from __future__ import annotations


def is_degraded_pending() -> bool:
    """Side-effects stay pending until both downstream consumers report healthy."""
    from services.finance.router import is_consumer_healthy as finance_healthy
    from services.inventory.router import is_consumer_healthy as inventory_healthy

    # Explicit kill-switch for local demos; default follows consumer health.
    import os

    if os.getenv("SALES_FORCE_DEGRADED", "").strip() in {"1", "true", "yes"}:
        return True
    return not (inventory_healthy() and finance_healthy())


# Back-compat constant for importers that read DEGRADED_PENDING at import time.
# Prefer is_degraded_pending() at request time.
DEGRADED_PENDING = True
