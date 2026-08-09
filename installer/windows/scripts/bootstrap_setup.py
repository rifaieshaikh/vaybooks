#!/usr/bin/env python3
"""Apply installer setup.json: migrations, seed, profile, modules, admin, license."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any


def _load_setup(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit("setup.json must be an object")
    return data


def _wait_mongo(uri: str, db_name: str, attempts: int = 30) -> Any:
    from vaybooks.bms.infrastructure.db.connection import get_database_from_uri

    last_err: Exception | None = None
    for i in range(attempts):
        try:
            db = get_database_from_uri(uri, db_name)
            db.command("ping")
            return db
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(2)
            print(f"Waiting for MongoDB ({i + 1}/{attempts})...")
    raise SystemExit(f"MongoDB not reachable: {last_err}")


def _redact_setup(path: Path, data: dict[str, Any]) -> None:
    admin = dict(data.get("admin") or {})
    if "password" in admin:
        admin["password"] = ""
    data["admin"] = admin
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _set_config_completed(data_dir: Path) -> None:
    config_path = data_dir / "config" / "config.toml"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    text = ""
    if config_path.exists():
        text = config_path.read_text(encoding="utf-8")
    lines = [ln for ln in text.splitlines() if not ln.strip().startswith("SETUP_COMPLETED")]
    lines.append("SETUP_COMPLETED = true")
    config_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_bootstrap(setup_path: Path, data_dir: Path, app_dir: Path | None) -> None:
    if app_dir and str(app_dir) not in sys.path:
        sys.path.insert(0, str(app_dir))

    setup = _load_setup(setup_path)
    backend_mode = str(setup.get("backend_mode") or "local").strip().lower()
    if backend_mode != "local":
        print("Remote backend: skipping Mongo bootstrap.")
        return

    mongo_mode = str(setup.get("mongo_mode") or "existing").strip().lower()
    if mongo_mode == "install":
        uri = str(setup.get("mongo_uri") or "mongodb://localhost:27017").strip()
    else:
        uri = str(setup.get("mongo_uri") or "").strip()
    db_name = str(setup.get("db_name") or "zahcci_customization").strip()
    if not uri:
        raise SystemExit("mongo_uri is required for local backend bootstrap")

    os.environ.setdefault("MONGODB_URI", uri)
    os.environ.setdefault("MONGO_URI", uri)
    os.environ.setdefault("MONGODB_DATABASE", db_name)
    os.environ.setdefault("DB_NAME", db_name)
    os.environ["VAYBOOKS_SKIP_DEFAULT_ADMIN"] = "1"

    db = _wait_mongo(uri, db_name)

    from packages.tenancy.context import DEFAULT_ORG_ID, set_org_id
    from vaybooks.bms.application.setup.bootstrap import complete_org_setup, normalize_modules
    from vaybooks.bms.infrastructure.db.indexes import ensure_indexes
    from vaybooks.bms.infrastructure.db.migrations.runner import run_pending_migrations
    from vaybooks.bms.infrastructure.db.seed import run_seed

    set_org_id(DEFAULT_ORG_ID)

    print("Running migrations...")
    run_pending_migrations(db)
    print("Ensuring indexes...")
    ensure_indexes(db)
    print("Seeding defaults / chart of accounts...")
    run_seed(db)

    from packages.services_kit.access_container import get_access_container
    from vaybooks.bms.domain.entitlements.catalog import ROLE_OWNER, SYSTEM_ROLE_DEFINITIONS

    access = get_access_container()

    # Ensure system roles
    roles_svc = access.roles
    for role_id, spec in SYSTEM_ROLE_DEFINITIONS.items():
        try:
            existing = roles_svc.get_role(role_id) if hasattr(roles_svc, "get_role") else None
            if existing:
                continue
        except Exception:
            existing = None
        try:
            from vaybooks.bms.domain.identity.entities import Role

            role = Role(
                id=role_id,
                name=str(spec.get("name") or role_id),
                description=str(spec.get("description") or ""),
                permission_keys=list(spec.get("permission_keys") or []),
                is_system=True,
            )
            if hasattr(roles_svc, "_role_repo"):
                roles_svc._role_repo.save(role)  # noqa: SLF001
        except Exception as exc:  # noqa: BLE001
            print(f"Role seed warning for {role_id}: {exc}")

    admin = setup.get("admin") or {}
    username = str(admin.get("username") or "").strip()
    password = str(admin.get("password") or "")
    if username and password:
        users = access.users
        if not users.list_users():
            users.create_user(
                username=username,
                display_name=str(admin.get("display_name") or username),
                password=password,
                role_ids=[ROLE_OWNER],
                location_ids=[],
                org_id=DEFAULT_ORG_ID,
                active=True,
            )
            print(f"Created owner user: {username}")
        else:
            print("Users already exist; skipping owner create.")
    else:
        print("No installer admin credentials; leaving user seed to API defaults.")

    business = setup.get("business") or {}
    modules = normalize_modules(list(setup.get("enabled_modules") or []))
    license_key = str(setup.get("license_key") or "").strip()

    print("Completing org setup (profile, modules, COA, entitlement)...")
    try:
        complete_org_setup(
            db,
            org_id=DEFAULT_ORG_ID,
            business=business if isinstance(business, dict) else {},
            enabled_modules=modules,
            license_key=license_key,
        )
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f"Org setup failed: {exc}") from exc

    try:
        import services.flags.router as flags_router

        if hasattr(flags_router, "flags_service"):
            flags_router.flags_service.set_enabled_modules(modules)
    except Exception as exc:  # noqa: BLE001
        print(f"Flags sync skipped: {exc}")

    _set_config_completed(data_dir)
    _redact_setup(setup_path, setup)
    print("Bootstrap complete.")


def main() -> int:
    parser = argparse.ArgumentParser(description="VayBooks installer bootstrap")
    parser.add_argument("--setup-json", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--app-dir", type=Path, default=None)
    args = parser.parse_args()
    run_bootstrap(args.setup_json, args.data_dir, args.app_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
