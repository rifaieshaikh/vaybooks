"""Interactive CLI for selecting and running demo/test seed packs."""

from __future__ import annotations

import argparse
import sys
from typing import Any

from pymongo.database import Database

from vaybooks.bms.infrastructure.db.seed_master.registry import SEED_PACKS, SeedPack, packs_by_ids
from vaybooks.bms.infrastructure.db.seed_master.store import (
    get_master,
    recent_runs,
    record_pack_result,
    record_run,
)


def _fmt_time(value: Any) -> str:
    if value is None:
        return "never"
    try:
        return value.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(value)[:16]


def _print_catalog(db: Database) -> None:
    master = get_master(db)
    packs_state = master.get("packs") or {}
    print()
    print("Available seed packs")
    print("-" * 72)
    for idx, pack in enumerate(SEED_PACKS, start=1):
        state = packs_state.get(pack.id) or {}
        status = state.get("status") or "not run"
        last = _fmt_time(state.get("last_run_at"))
        print(f"  [{idx}] {pack.title}")
        print(f"      id={pack.id}  marker={pack.marker}")
        print(f"      {pack.description}")
        print(f"      last: {last}  status: {status}")
        print(f"      verify: {pack.how_to_verify}")
        print()


def _print_master(db: Database) -> None:
    master = get_master(db)
    packs_state = master.get("packs") or {}
    print()
    print("Master seed ledger")
    print("=" * 72)
    print(f"  Document: demo_seed_master / {master.get('_id')}")
    print(f"  Updated:  {_fmt_time(master.get('updated_at'))}")
    print(f"  Last run: {master.get('last_run_id') or '-'}")
    print()
    if not packs_state:
        print("  No packs recorded yet.")
    else:
        for pack_id, state in sorted(packs_state.items()):
            print(f"  * {state.get('title') or pack_id}")
            print(f"      status={state.get('status')}  last={_fmt_time(state.get('last_run_at'))}")
            print(f"      marker={state.get('marker')}")
            summary = state.get("summary") or {}
            if summary:
                bits = [f"{k}={v}" for k, v in summary.items() if k != "marker"]
                print(f"      summary: {', '.join(bits[:8])}")
            if state.get("error"):
                print(f"      error: {state['error']}")
            print()
    runs = recent_runs(db, limit=5)
    if runs:
        print("Recent runs")
        print("-" * 72)
        for run in runs:
            print(
                f"  {_fmt_time(run.get('finished_at'))}  "
                f"id={run.get('_id')}  packs={','.join(run.get('pack_ids') or [])}"
            )
        print()


def _parse_selection(raw: str) -> list[str] | None:
    text = (raw or "").strip().lower()
    if not text:
        return []
    if text in {"q", "quit", "exit"}:
        return None
    if text in {"s", "status"}:
        return ["__status__"]
    if text in {"a", "all"}:
        return [p.id for p in SEED_PACKS]
    selected: list[str] = []
    for token in text.replace(";", ",").split(","):
        token = token.strip()
        if not token:
            continue
        if token.isdigit():
            idx = int(token)
            if 1 <= idx <= len(SEED_PACKS):
                selected.append(SEED_PACKS[idx - 1].id)
            else:
                print(f"  Unknown number: {token}")
        else:
            # allow pack id
            if any(p.id == token for p in SEED_PACKS):
                selected.append(token)
            else:
                print(f"  Unknown pack: {token}")
    # unique preserve order
    seen: set[str] = set()
    out: list[str] = []
    for pack_id in selected:
        if pack_id not in seen:
            seen.add(pack_id)
            out.append(pack_id)
    return out


def _run_packs(db: Database, packs: list[SeedPack]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for pack in packs:
        print()
        print(f"> Running [{pack.id}] {pack.title} ...")
        try:
            summary = pack.run(db) or {}
            state = record_pack_result(
                db,
                pack_id=pack.id,
                title=pack.title,
                marker=pack.marker,
                status="ok",
                summary=summary,
            )
            results.append({"pack_id": pack.id, "status": "ok", "summary": summary})
            print(f"  OK  marker={pack.marker}")
            if summary:
                for key, value in summary.items():
                    if key == "marker":
                        continue
                    print(f"     {key}: {value}")
            print(f"  Verify: {pack.how_to_verify}")
            _ = state
        except Exception as exc:
            record_pack_result(
                db,
                pack_id=pack.id,
                title=pack.title,
                marker=pack.marker,
                status="error",
                error=str(exc),
            )
            results.append({"pack_id": pack.id, "status": "error", "error": str(exc)})
            print(f"  FAILED: {exc}")
    run_id = record_run(db, pack_ids=[p.id for p in packs], results=results)
    print()
    print(f"Master updated. run_id={run_id}")
    return results


def interactive_loop(db: Database, db_name: str) -> int:
    print()
    print("VayBooks seed orchestrator (API / backend)")
    print(f"Database: {db_name}")
    print("Optional demo/test seeds only - not schema migrations.")
    print("Entry: python scripts/seed/seed-data.py")
    print()
    print("Commands: 1,2,3  |  A=all  |  S=status  |  Q=quit")

    while True:
        _print_catalog(db)
        try:
            raw = input("Select packs to seed: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            print("Bye.")
            return 0
        selection = _parse_selection(raw)
        if selection is None:
            print("Bye.")
            return 0
        if selection == ["__status__"]:
            _print_master(db)
            continue
        if not selection:
            print("  Nothing selected.")
            continue
        packs = packs_by_ids(selection)
        if not packs:
            print("  No valid packs.")
            continue
        labels = ", ".join(p.title for p in packs)
        try:
            confirm = input(f"Run {len(packs)} pack(s) [{labels}]? [y/N]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if confirm not in {"y", "yes"}:
            print("  Cancelled.")
            continue
        _run_packs(db, packs)
    return 0


def main(argv: list[str] | None = None) -> int:
    from vaybooks.bms.infrastructure.config.settings import get_settings
    from vaybooks.bms.infrastructure.db.connection import get_mongo_client_from_settings
    from vaybooks.bms.infrastructure.logging.setup import setup_logging

    parser = argparse.ArgumentParser(
        description="Interactive demo/test seed master (records runs in Mongo)."
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List packs and master status, then exit",
    )
    parser.add_argument(
        "--run",
        nargs="+",
        metavar="PACK",
        help="Non-interactive: run pack id(s) or 'all'",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation when used with --run",
    )
    args = parser.parse_args(argv)

    setup_logging()
    settings = get_settings()
    client = get_mongo_client_from_settings()
    db = client[settings.db_name]

    if args.list:
        print(f"Database: {settings.db_name}")
        _print_catalog(db)
        _print_master(db)
        return 0

    if args.run:
        ids: list[str] = []
        for token in args.run:
            if token.lower() == "all":
                ids = [p.id for p in SEED_PACKS]
                break
            ids.append(token)
        packs = packs_by_ids(ids)
        if not packs:
            print("No valid packs. Use --list to see ids.", file=sys.stderr)
            return 1
        if not args.yes:
            labels = ", ".join(p.id for p in packs)
            confirm = input(f"Run [{labels}] on db={settings.db_name}? [y/N]: ").strip().lower()
            if confirm not in {"y", "yes"}:
                print("Cancelled.")
                return 0
        _run_packs(db, packs)
        _print_master(db)
        return 0

    return interactive_loop(db, settings.db_name)


if __name__ == "__main__":
    raise SystemExit(main())
