from packages.services_kit.paging import (
    apply_list_query,
    clamp_page,
    contains_ci,
    filter_by_date_range,
    filter_dicts,
    in_date_range,
    page_slice,
    paged_result,
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
