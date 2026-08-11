"""Shared Mongo setup for API tests (no memory backends)."""

from __future__ import annotations

import os

import pytest

# Prefer isolated DB for tests unless caller already set one.
if not (os.environ.get("MONGODB_DATABASE") or os.environ.get("DB_NAME")):
    os.environ["MONGODB_DATABASE"] = "zahcci_api_test"

# Clear legacy memory force flags
for key in (
    "PARTIES_BACKEND",
    "INVENTORY_BACKEND",
    "FINANCE_BACKEND",
    "PURCHASES_BACKEND",
    "SALES_BACKEND",
    "BOUTIQUE_BACKEND",
):
    os.environ.pop(key, None)


def require_mongo() -> None:
    from packages.services_kit.mongo_env import mongo_uri

    uri = mongo_uri()
    if not uri:
        pytest.skip("MONGODB_URI not configured (env or .streamlit/secrets.toml)")
    try:
        from pymongo import MongoClient

        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"Mongo unavailable: {exc}")


def reset_all_containers() -> None:
    from packages.services_kit.finance_container import reset_finance_container
    from packages.services_kit.inventory_container import reset_inventory_container
    from packages.services_kit.parties_container import reset_parties_container

    reset_parties_container()
    reset_inventory_container()
    reset_finance_container()
    try:
        from packages.services_kit.purchases_container import reset_purchases_container

        reset_purchases_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.sales_container import reset_sales_container

        reset_sales_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.boutique_container import reset_boutique_container

        reset_boutique_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.crm_container import reset_crm_container

        reset_crm_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.projects_container import reset_projects_container

        reset_projects_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.schedulers_container import reset_schedulers_container

        reset_schedulers_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.migration_container import reset_migration_container

        reset_migration_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.reports_container import reset_reports_container

        reset_reports_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.system_container import reset_system_container

        reset_system_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.access_container import reset_access_container

        reset_access_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.settings_container import reset_settings_container

        reset_settings_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.store_container import reset_store_container

        reset_store_container()
    except ImportError:
        pass
    try:
        from packages.services_kit.production_container import reset_production_container

        reset_production_container()
    except ImportError:
        pass
