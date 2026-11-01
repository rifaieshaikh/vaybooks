"""Measure the INV-01 representative inventory fixture on an isolated database.

Uses mongodb://127.0.0.1:27017 and database vaybooks_inv01_bench only.
The database is dropped when the run finishes. Does not read or write any
other database.

Writes JSON results to /tmp/inv01-bench/results.json and payload files the
browser check can load.
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
import traceback
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ["MONGODB_URI"] = "mongodb://127.0.0.1:27017"
os.environ["MONGODB_DATABASE"] = "vaybooks_inv01_bench"

from pymongo import MongoClient, monitoring  # noqa: E402

DB_NAME = "vaybooks_inv01_bench"
OUT_DIR = Path("/tmp/inv01-bench")
REPEATS = 3
PARENTS = 1000
SKUS = 5000
LOCATIONS = 10
MOVEMENTS = 50_000
CUSTOMER_PRICES = 10_000
TRANSFERS = 200
BALANCES = SKUS


class QueryCounter(monitoring.CommandListener):
    def __init__(self) -> None:
        self.active = False
        self.count = 0
        self.names: Counter[str] = Counter()

    def started(self, event: monitoring.CommandStartedEvent) -> None:
        if not self.active:
            return
        if event.command_name in {"hello", "ismaster", "ping", "saslStart", "saslContinue"}:
            return
        self.count += 1
        self.names[event.command_name] += 1

    def succeeded(self, event: monitoring.CommandSucceededEvent) -> None:
        return None

    def failed(self, event: monitoring.CommandFailedEvent) -> None:
        return None

    def begin(self) -> None:
        self.count = 0
        self.names = Counter()
        self.active = True

    def end(self) -> tuple[int, dict[str, int]]:
        self.active = False
        return self.count, dict(self.names)


COUNTER = QueryCounter()
monitoring.register(COUNTER)


def percentile(samples: list[float], p: float) -> float:
    ordered = sorted(samples)
    index = max(0, math.ceil(p / 100 * len(ordered)) - 1)
    return ordered[index]


def batched(docs: list[dict], size: int = 2000):
    for start in range(0, len(docs), size):
        yield docs[start : start + size]


def seed(client: MongoClient) -> str:
    if DB_NAME in {"admin", "local", "config", "zahcci_customization", "vay_tutor"}:
        raise RuntimeError(f"refusing to seed {DB_NAME}")
    client.drop_database(DB_NAME)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc)
    locations = [
        {
            "_id": f"loc-{i}",
            "code": f"L{i:02d}",
            "name": f"Location {i}",
            "location_type": "Warehouse",
            "address": "",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        for i in range(LOCATIONS)
    ]
    parents = [
        {
            "_id": f"parent-{i}",
            "name": f"Parent {i}",
            "category_ids": [],
            "category_names": [],
            "category_id": "",
            "category_name": "",
            "unit_id": "",
            "unit": "pcs",
            "hsn_sac": "5208",
            "specifications": {"fabric": "linen"},
            "custom_fields": {"season": "baseline"},
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        for i in range(PARENTS)
    ]
    skus = []
    balances = []
    for i in range(SKUS):
        parent = i // 5
        skus.append(
            {
                "_id": f"sku-{i}",
                "sku": f"SKU-{i:05d}",
                "name": f"SKU {i}",
                "catalog_product_id": f"parent-{parent}",
                "name_override": "",
                "attributes": {"size": "M" if i % 2 == 0 else "L"},
                "barcode": "",
                "category_ids": [],
                "category_names": [],
                "category_id": "",
                "category_name": "",
                "unit_id": "",
                "unit": "pcs",
                "hsn_sac": "5208",
                "specifications": {},
                "custom_fields": {},
                "weighted_avg_cost": 12.5,
                "last_purchase_rate": 10.0,
                "opening_qty": 10.0,
                "current_qty": 8.0 if i % 7 else 3.0,
                "track_batch": False,
                "track_serial": False,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        )
        balances.append(
            {
                "_id": f"bal-{i}",
                "product_id": f"sku-{i}",
                "location_id": f"loc-{i % LOCATIONS}",
                "qty": 8.0,
                "updated_at": now,
            }
        )
    movements = [
        {
            "_id": f"mov-{i}",
            "product_id": f"sku-{i % SKUS}",
            "movement_type": "Receive" if i % 2 == 0 else "Issue",
            "qty": 1.0,
            "movement_date": "2026-01-15",
            "reference_type": "Manual",
            "reference_id": "",
            "location_id": f"loc-{i % LOCATIONS}",
            "warehouse_id": f"loc-{i % LOCATIONS}",
            "notes": "baseline",
            "created_at": now,
        }
        for i in range(MOVEMENTS)
    ]
    transfers = [
        {
            "_id": f"tr-{i}",
            "transfer_number": f"ST-{i:04d}",
            "from_location_id": "loc-0",
            "from_location_name": "Location 0",
            "to_location_id": "loc-1",
            "to_location_name": "Location 1",
            "transfer_date": "2026-01-15",
            "status": "Draft",
            "lines": [
                {
                    "id": f"ln-{i}",
                    "product_id": f"sku-{i % SKUS}",
                    "product_name": f"SKU {i % SKUS}",
                    "qty": 1.0,
                }
            ],
            "notes": "",
            "created_at": now,
            "updated_at": now,
        }
        for i in range(TRANSFERS)
    ]
    prices = [
        {
            "_id": f"cp-{i}",
            "customer_id": f"cust-{i % 200}",
            "customer_name": f"Customer {i % 200}",
            "product_id": f"sku-{i % SKUS}",
            "sku": f"SKU-{i % SKUS:05d}",
            "product_name": f"SKU {i % SKUS}",
            "rate": 15.0,
            "voucher_id": "",
            "store_invoice_number": "",
            "effective_date": "2026-01-15",
            "created_at": now,
        }
        for i in range(CUSTOMER_PRICES)
    ]
    db.warehouses.insert_many(locations)
    for chunk in batched(parents):
        db.inventory_catalog_products.insert_many(chunk)
    for chunk in batched(skus):
        db.inventory_products.insert_many(chunk)
    for chunk in batched(balances):
        db.stock_balances.insert_many(chunk)
    for chunk in batched(movements):
        db.stock_movements.insert_many(chunk)
    db.stock_transfers.insert_many(transfers)
    for chunk in batched(prices):
        db.customer_prices.insert_many(chunk)
    return "sku-0"


def measure(client_http, path: str) -> dict:
    samples_ms: list[float] = []
    payload = 0
    rows = None
    queries = 0
    commands: dict[str, int] = {}
    status = 0
    for _ in range(REPEATS):
        COUNTER.begin()
        started = time.perf_counter()
        response = client_http.get(path)
        elapsed_ms = (time.perf_counter() - started) * 1000
        queries, commands = COUNTER.end()
        status = response.status_code
        if status != 200:
            raise RuntimeError(f"{path} -> {status} {response.text[:400]}")
        samples_ms.append(elapsed_ms)
        payload = len(response.content)
        body = response.json()
        rows = len(body) if isinstance(body, list) else 1
    return {
        "path": path,
        "status": status,
        "rows": rows,
        "payload_bytes": payload,
        "latency_ms": {
            "min": round(min(samples_ms), 1),
            "p50": round(percentile(samples_ms, 50), 1),
            "p95": round(percentile(samples_ms, 95), 1),
            "samples": [round(v, 1) for v in samples_ms],
        },
        "queries_last_sample": queries,
        "commands_last_sample": commands,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    client = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=3000)
    client.admin.command("ping")
    detail_id = seed(client)
    print("seeded", DB_NAME, flush=True)

    import services.common.authz as authz
    from fastapi.testclient import TestClient
    from services.auth.router import _decode_token
    from services.combined.main import app

    authz.assert_permissions = lambda username, keys: None  # noqa: ARG005
    app.dependency_overrides[_decode_token] = lambda: "inv01-bench"
    http = TestClient(app)
    warmup = http.get("/api/inventory/health")
    if warmup.status_code != 200:
        raise RuntimeError(f"health {warmup.status_code} {warmup.text[:300]}")

    paths = [
        "/api/inventory/catalog-products?active_only=false",
        "/api/inventory/products?active_only=false",
        f"/api/inventory/products/{detail_id}",
        "/api/inventory/stock?active_only=false",
        "/api/inventory/movements",
        "/api/inventory/transfers",
        "/api/inventory/customer-prices",
    ]
    results = []
    payloads: dict[str, bytes] = {}
    for path in paths:
        print("measure", path, flush=True)
        row = measure(http, path)
        results.append(row)
        print(json.dumps(row), flush=True)
        if path in {
            "/api/inventory/products?active_only=false",
            "/api/inventory/movements",
        }:
            payloads[path] = http.get(path).content

    (OUT_DIR / "products.json").write_bytes(
        payloads["/api/inventory/products?active_only=false"]
    )
    (OUT_DIR / "movements.json").write_bytes(payloads["/api/inventory/movements"])
    summary = {
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "database": DB_NAME,
        "host": "127.0.0.1:27017",
        "repeats": REPEATS,
        "fixture": {
            "catalog_parents": PARENTS,
            "skus": SKUS,
            "locations": LOCATIONS,
            "movements": MOVEMENTS,
            "customer_price_rows": CUSTOMER_PRICES,
            "transfers": TRANSFERS,
            "balances": BALANCES,
            "rate_history_rows": 0,
        },
        "endpoints": results,
    }
    (OUT_DIR / "results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("wrote", OUT_DIR / "results.json", flush=True)


if __name__ == "__main__":
    mongo = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=3000)
    try:
        main()
    except Exception:
        traceback.print_exc()
        raise
    finally:
        mongo.drop_database(DB_NAME)
        print("dropped", DB_NAME, flush=True)
