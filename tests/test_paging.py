from datetime import date

from packages.services_kit.paging import (
    apply_list_query,
    build_mongo_list_filter,
    clamp_page,
    contains_ci,
    filter_by_date_range,
    filter_dicts,
    in_date_range,
    mongo_ci_contains,
    page_slice,
    paged_result,
    query_mongo_page,
    sort_dicts,
)


def test_clamp_page_bounds():
    assert clamp_page(0, 0) == (1, 1)
    assert clamp_page(2, 12) == (2, 12)
    assert clamp_page(1, 9999)[1] == 500


def test_paged_result_slice():
    rows = [{"id": i} for i in range(25)]
    page = paged_result(rows, page=2, page_size=12)
    assert page["total"] == 25
    assert page["page"] == 2
    assert page["page_size"] == 12
    assert [r["id"] for r in page["items"]] == list(range(12, 24))


def test_page_slice_clamps_past_end():
    items, total, page, size = page_slice(list(range(5)), page=9, page_size=2)
    assert total == 5
    assert page == 3
    assert items == [4]


def test_filter_and_sort_dicts():
    rows = [
        {"name": "Ada", "status": "Open"},
        {"name": "Bob", "status": "Closed"},
        {"name": "Ann", "status": "Open"},
    ]
    filtered = filter_dicts(rows, equals={"status": "Open"}, contains={"name": "a"})
    assert [r["name"] for r in filtered] == ["Ada", "Ann"]
    sorted_rows = sort_dicts(filtered, "name", sort_desc=False)
    assert [r["name"] for r in sorted_rows] == ["Ada", "Ann"]
    assert contains_ci("Hello World", "world")
    assert contains_ci("x", "")


def test_in_date_range():
    assert in_date_range("2026-08-10", "2026-08-01", "2026-08-31")
    assert not in_date_range("2026-07-31", "2026-08-01", "2026-08-31")
    assert in_date_range("2026-08-10", "", "")
    assert not in_date_range("", "2026-08-01", "")


def test_filter_by_date_range_and_apply_list_query():
    rows = [
        {"so_number": "SO-1", "customer_name": "Ada", "order_date": "2026-08-01", "total": 10},
        {"so_number": "SO-2", "customer_name": "Bob", "order_date": "2026-07-15", "total": 20},
        {"so_number": "SO-3", "customer_name": "Ann", "order_date": "2026-08-20", "total": 30},
    ]
    august = filter_by_date_range(rows, "order_date", date_from="2026-08-01", date_to="2026-08-31")
    assert [r["so_number"] for r in august] == ["SO-1", "SO-3"]
    page = apply_list_query(
        rows,
        q="a",
        q_fields=("customer_name", "so_number"),
        date_field="order_date",
        date_from="2026-08-01",
        date_to="2026-08-31",
        sort_by="order_date",
        sort_desc=False,
        page=1,
        page_size=12,
    )
    assert page["total"] == 2
    assert [r["so_number"] for r in page["items"]] == ["SO-1", "SO-3"]


def test_mongo_ci_contains_escapes():
    clause = mongo_ci_contains("a+b")
    assert clause["$options"] == "i"
    assert "\\+" in clause["$regex"]


def test_build_mongo_list_filter_composes_and():
    filt = build_mongo_list_filter(
        q="ada",
        q_fields=("customer_name", "so_number"),
        equals={"status": "Confirmed"},
        contains={"customer_name": "Ad"},
        date_field="order_date",
        date_from="2026-08-01",
        date_to="2026-08-31",
        status_nin=("Closed", "Cancelled"),
    )
    assert "$and" in filt
    parts = filt["$and"]
    assert {"status": "Confirmed"} in parts
    assert {"status": {"$nin": ["Closed", "Cancelled"]}} in parts
    assert any("$or" in p for p in parts)  # q or date dual-match


def test_build_mongo_list_filter_status_in_and_voucher_date():
    filt = build_mongo_list_filter(
        date_field="voucher_date",
        date_from="2026-08-01",
        date_to="2026-08-10",
        status_in=("Draft", "Confirmed"),
    )
    assert "$and" in filt
    status_part = next(p for p in filt["$and"] if "status" in p)
    date_part = next(p for p in filt["$and"] if "voucher_date" in p)
    assert status_part["status"] == {"$in": ["Draft", "Confirmed"]}
    bounds = date_part["voucher_date"]
    assert bounds["$gte"].date() == date(2026, 8, 1)
    assert bounds["$lte"].date() == date(2026, 8, 10)


class _FakeCollection:
    def __init__(self, docs):
        self._docs = list(docs)

    def count_documents(self, query):
        return len(self._match(query))

    def find(self, query):
        matched = self._match(query)
        return _FakeCursor(matched)

    def _match(self, query):
        if not query:
            return list(self._docs)
        status = query.get("status")
        if isinstance(status, dict) and "$nin" in status:
            blocked = set(status["$nin"])
            return [d for d in self._docs if d.get("status") not in blocked]
        if "status" in query:
            return [d for d in self._docs if d.get("status") == query["status"]]
        return list(self._docs)


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)
        self._skip = 0
        self._limit = None

    def sort(self, keys):
        key, direction = keys[0]
        reverse = direction < 0
        self._docs.sort(
            key=lambda d: (0, d.get(key)) if isinstance(d.get(key), (int, float)) else (1, str(d.get(key) or "")),
            reverse=reverse,
        )
        return self

    def skip(self, n):
        self._skip = n
        return self

    def limit(self, n):
        self._limit = n
        return self

    def __iter__(self):
        end = None if self._limit is None else self._skip + self._limit
        return iter(self._docs[self._skip : end])


def test_query_mongo_page_clamps_and_maps():
    docs = [{"_id": f"id-{i}", "n": i, "status": "Open"} for i in range(5)]
    coll = _FakeCollection(docs)
    page = query_mongo_page(
        coll,
        {},
        sort_by="n",
        sort_desc=False,
        page=9,
        page_size=2,
        map_doc=lambda d: {"id": d["_id"], "n": d["n"]},
    )
    assert page["total"] == 5
    assert page["page"] == 3
    assert [r["n"] for r in page["items"]] == [4]
