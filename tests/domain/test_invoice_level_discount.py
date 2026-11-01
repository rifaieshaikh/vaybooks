"""Invoice-level discount applies only to lines without item discount."""

from vaybooks.bms.domain.sales.line_items import (
    SalesInvoiceLine,
    apply_invoice_discount_to_lines,
)


def _line(**kwargs) -> SalesInvoiceLine:
    defaults = {
        "product_id": "p1",
        "item_name": "Item",
        "qty": 1.0,
        "rate": 100.0,
        "discount": 0.0,
        "taxable_amount": 100.0,
        "line_total": 100.0,
        "gst_rate": 0.0,
    }
    defaults.update(kwargs)
    return SalesInvoiceLine(**defaults)


def test_apply_invoice_discount_skips_discounted_lines_and_weights_by_qty_rate():
    # Eligible: A qty*rate=200, B qty*rate=100 → weights 2:1
    # Line C has item discount → untouched
    lines = [
        _line(
            product_id="a",
            item_name="A",
            qty=2,
            rate=100,
            discount=0,
            taxable_amount=200,
            line_total=200,
        ),
        _line(
            product_id="b",
            item_name="B",
            qty=1,
            rate=100,
            discount=0,
            taxable_amount=100,
            line_total=100,
        ),
        _line(
            product_id="c",
            item_name="C",
            qty=1,
            rate=80,
            discount=20,
            taxable_amount=60,
            line_total=60,
        ),
    ]
    adjusted = apply_invoice_discount_to_lines(
        lines,
        30.0,
        business_registered=False,
        business_state_code="27",
        customer_state_code="27",
    )
    by_id = {line.product_id: line for line in adjusted}
    assert by_id["a"].taxable_amount == 180.0  # 200 - 20
    assert by_id["b"].taxable_amount == 90.0  # 100 - 10
    assert by_id["c"].taxable_amount == 60.0
    assert by_id["c"].discount == 20.0


def test_apply_invoice_discount_noop_when_all_lines_have_item_discount():
    lines = [
        _line(discount=5, taxable_amount=95, line_total=95),
    ]
    adjusted = apply_invoice_discount_to_lines(
        lines,
        10.0,
        business_registered=False,
        business_state_code="27",
        customer_state_code="27",
    )
    assert adjusted[0].taxable_amount == 95.0
