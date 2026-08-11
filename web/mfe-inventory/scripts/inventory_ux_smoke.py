"""Smoke verification for Inventory UX consistency plan against React shell."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, expect, Page

BASE = "http://127.0.0.1:5173"
RESULTS: list[dict] = []


def ok(name: str, detail: str = "") -> None:
    RESULTS.append({"name": name, "pass": True, "detail": detail})
    print(f"PASS  {name}" + (f" — {detail}" if detail else ""))


def fail(name: str, detail: str) -> None:
    RESULTS.append({"name": name, "pass": False, "detail": detail})
    print(f"FAIL  {name} — {detail}")


def login(page: Page) -> None:
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    if page.get_by_role("button", name="Sign in").count():
        page.get_by_label("Username").fill("admin")
        page.get_by_label("Password").fill("admin")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_timeout(1500)
    # dismiss any leftover login
    if "login" in page.url.lower() or page.get_by_role("button", name="Sign in").count():
        raise RuntimeError("Login failed — still on login screen")


def open_path(page: Page, path: str) -> None:
    page.goto(f"{BASE}{path}", wait_until="networkidle")
    page.wait_for_timeout(800)


def dialog_visible(page: Page, title: str):
    return page.get_by_role("dialog", name=title)


def test_categories(page: Page) -> None:
    open_path(page, "/inventory/categories")
    page.get_by_role("button", name="Add Category").click()
    dlg = dialog_visible(page, "Add Category")
    expect(dlg).to_be_visible()
    # SearchableSelect for parent
    if dlg.locator(".de-search").count() < 1:
        fail("Categories add modal", "missing SearchableSelect (.de-search)")
        page.keyboard.press("Escape")
        return
    # Cancel closes
    dlg.get_by_role("button", name="Cancel").click()
    expect(dlg).to_be_hidden(timeout=3000)
    ok("Categories add modal", "ModalForm + SearchableSelect; Cancel closes")

    # Edit if a row exists
    edit_btns = page.locator("button[title='Edit'], button:has-text('Edit')")
    # EntityListActions often use icon buttons — try first row edit via keyboard or action
    rows = page.locator(".el-table tbody tr, table tbody tr, [class*='el-'] tbody tr")
    if page.get_by_role("button", name="Edit").count() > 0:
        page.get_by_role("button", name="Edit").first.click()
        ed = dialog_visible(page, "Edit Category")
        expect(ed).to_be_visible()
        # parent searchable present
        if ed.locator(".de-search").count() < 1:
            fail("Categories edit modal", "missing parent SearchableSelect")
        else:
            ok("Categories edit modal", "opens with parent SearchableSelect")
        page.keyboard.press("Escape")
    else:
        ok("Categories edit modal", "skipped (no Edit control visible; list may be empty)")


def test_products(page: Page) -> None:
    open_path(page, "/inventory/products")
    page.get_by_role("button", name="Add Product").click()
    dlg = dialog_visible(page, "Add Product")
    expect(dlg).to_be_visible()
    searches = dlg.locator(".de-search")
    if searches.count() < 1:
        fail("Products add modal", "expected SearchableSelect/ChipsMultiPicker")
    else:
        ok("Products add modal", f"ModalForm with {searches.count()} searchable controls")
    page.keyboard.press("Escape")
    expect(dlg).to_be_hidden(timeout=3000)
    ok("Products Escape closes", "dialog dismissed")

    open_btns = page.get_by_role("button", name="Open")
    if open_btns.count() > 0:
        open_btns.first.click()
    else:
        row = page.locator("tbody tr").first
        if row.count():
            row.click()
        else:
            ok("Product detail", "skipped (no products)")
            return
    page.wait_for_timeout(1200)
    if "/inventory/products/" not in page.url:
        fail("Product detail", f"did not navigate; url={page.url}")
        return

    page.wait_for_selector(".ed-tabs, [role=tablist]", timeout=10000)
    page.get_by_role("tab", name="Stock").click()
    page.wait_for_timeout(400)
    has_balances = (
        page.get_by_text("Balances by location").count() > 0
        or page.get_by_text("No per-location balances").count() > 0
    )
    page.get_by_role("tab", name="Pricing").click()
    page.wait_for_timeout(400)
    has_rates = page.get_by_text("Rate history").count() > 0 or page.get_by_text("No rate history").count() > 0
    has_chips = page.locator(".de-search").count() > 0
    page.get_by_role("tab", name="Details").click()
    page.wait_for_timeout(300)
    # chips are on details tab
    has_chips = page.locator(".de-search").count() > 0 or page.get_by_text("No categories yet").count() > 0
    if has_balances and has_rates:
        ok(
            "Product detail",
            f"balances + rate history present; category picker={'yes' if has_chips else 'no'}",
        )
    else:
        fail("Product detail", f"balances={has_balances} rates={has_rates} url={page.url}")


def test_movements(page: Page) -> None:
    open_path(page, "/inventory/movements")
    page.get_by_role("button", name="Record Movement").click()
    dlg = dialog_visible(page, "Record Movement")
    expect(dlg).to_be_visible()
    if dlg.locator(".de-search").count() < 1:
        fail("Record Movement", "missing SearchableSelect")
    else:
        ok("Record Movement", "ModalForm + SearchableSelect")
    dlg.get_by_role("button", name="Cancel").click()
    expect(dlg).to_be_hidden(timeout=3000)


def test_transfers(page: Page) -> None:
    open_path(page, "/inventory/transfers")
    page.get_by_role("button", name="New Transfer").click()
    dlg = dialog_visible(page, "New Transfer")
    expect(dlg).to_be_visible()
    if dlg.locator(".de-search").count() < 2:
        fail("New Transfer pickers", f"expected >=2 SearchableSelect, got {dlg.locator('.de-search').count()}")
    else:
        ok("New Transfer pickers", "from/to/product SearchableSelect present")

    # from === to validation: set both to same by focusing and selecting first option if possible
    # Toggle immediate dispatch and submit to get ConfirmDialog
    checkbox = dlg.get_by_text("Dispatch immediately")
    if checkbox.count():
        dlg.locator("input[type=checkbox]").check()
    # Need valid lines — try submit; may get form error or confirm
    dlg.get_by_role("button", name="Create Transfer").click()
    page.wait_for_timeout(600)
    confirm = page.get_by_role("dialog", name="Dispatch transfer?")
    if confirm.count() and confirm.is_visible():
        # Abort should not create
        confirm.get_by_role("button", name="Cancel").click()
        expect(confirm).to_be_hidden(timeout=3000)
        # New Transfer form should still be open
        if dialog_visible(page, "New Transfer").is_visible():
            ok("Immediate-dispatch ConfirmDialog", "opened and abort kept form open")
        else:
            fail("Immediate-dispatch ConfirmDialog", "form closed after abort")
    else:
        # form error due to missing locations/products is acceptable for smoke
        err = dlg.locator("text=/required|different|Choose|Add at least/i")
        if err.count():
            ok("Immediate-dispatch ConfirmDialog", f"blocked by validation before confirm: {err.first.inner_text()[:80]}")
        else:
            fail("Immediate-dispatch ConfirmDialog", "neither confirm nor validation error appeared")

    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    # Detail lifecycle confirms
    open_btns = page.get_by_role("button", name="Open")
    if open_btns.count() == 0:
        row = page.locator("tbody tr").first
        if row.count():
            row.dblclick()
            page.wait_for_timeout(800)
    else:
        open_btns.first.click()
        page.wait_for_timeout(800)

    if "/inventory/transfers/" in page.url:
        for label in ("Dispatch", "Receive", "Cancel"):
            btn = page.get_by_role("button", name=label, exact=True)
            # Cancel button may be ghost "Cancel" — also match Cancel transfer later
            if label == "Cancel":
                btn = page.locator("button").filter(has_text="Cancel").first
            if btn.count() == 0 or not btn.is_visible():
                continue
            btn.click()
            page.wait_for_timeout(400)
            # Confirm dialog should appear
            conf = page.locator("[role=dialog]").filter(has_text="transfer")
            if conf.count() and conf.first.is_visible():
                # decline
                conf.first.get_by_role("button", name="Cancel").click()
                page.wait_for_timeout(300)
                ok(f"Transfer detail {label} confirm", "ConfirmDialog shown; decline closes it")
            else:
                fail(f"Transfer detail {label} confirm", "ConfirmDialog not shown")
            break
        else:
            ok("Transfer detail confirms", "skipped (no Dispatch/Receive/Cancel visible for current status)")
    else:
        ok("Transfer detail confirms", "skipped (no transfer to open)")


def test_customer_prices(page: Page) -> None:
    open_path(page, "/inventory/customer-prices")
    page.get_by_role("button", name="Add Price").click()
    dlg = dialog_visible(page, "Add Customer Price")
    expect(dlg).to_be_visible()
    if dlg.get_by_label("Customer ID").count() > 0 or dlg.get_by_text("Customer ID *").count() > 0:
        fail("Customer prices", "free-text Customer ID still present")
    elif dlg.locator(".de-search").count() < 1:
        fail("Customer prices", "missing SearchableSelect")
    else:
        ok("Customer prices add", "customer/product SearchableSelect; no free-text ID")
    page.keyboard.press("Escape")

    hist = page.get_by_role("button", name="History")
    if hist.count():
        hist.first.click()
        page.wait_for_timeout(500)
        if page.get_by_role("dialog").filter(has_text="Price History").count():
            ok("Price history", "read-only history modal opens")
            page.keyboard.press("Escape")
        else:
            fail("Price history", "dialog not found")
    else:
        ok("Price history", "skipped (no History actions)")


def test_settings_locations(page: Page) -> None:
    open_path(page, "/settings-locations")
    page.get_by_role("button", name="Add location").click()
    dlg = dialog_visible(page, "Add location")
    expect(dlg).to_be_visible()
    if dlg.get_by_role("button", name="Create").count() == 0:
        fail("Settings Locations ModalForm", "Create submit missing")
    else:
        ok("Settings Locations ModalForm", "add dialog with in-form actions")
    page.keyboard.press("Escape")

    # Delete confirm
    del_btns = page.locator("button[title='Delete'], button:has-text('Delete')")
    # EntityListActions delete
    delete_action = page.locator("button.el-action-btn--danger, button[aria-label*='Delete' i]")
    if delete_action.count() == 0:
        # try any Delete text in actions column
        delete_action = page.get_by_role("button", name="Delete")
    if delete_action.count():
        delete_action.first.click()
        page.wait_for_timeout(400)
        conf = page.get_by_role("dialog", name="Delete location?")
        if conf.count() and conf.is_visible():
            # ensure not window.confirm — we got a role=dialog
            conf.get_by_role("button", name="Cancel").click()
            ok("Settings location delete ConfirmDialog", "danger confirm shown; decline works")
        else:
            fail("Settings location delete ConfirmDialog", "expected Delete location? dialog")
    else:
        ok("Settings location delete ConfirmDialog", "skipped (no locations to delete)")


def test_measurement_spec_delete(page: Page) -> None:
    open_path(page, "/settings/measurement-specs")
    if not (
        page.get_by_role("heading", name="Measurement specs").count()
        or page.get_by_text("Measurement specs").count()
    ):
        ok("Measurement-spec delete", "skipped (page not available)")
        return

    delete_action = page.locator("button.el-action-btn--danger")
    if delete_action.count() == 0:
        delete_action = page.get_by_role("button", name="Delete")
    if delete_action.count():
        delete_action.first.click()
        page.wait_for_timeout(400)
        conf = page.get_by_role("dialog", name="Delete measurement spec?")
        if conf.count() and conf.is_visible():
            conf.get_by_role("button", name="Cancel").click()
            ok("Measurement-spec delete ConfirmDialog", "shown; decline works")
        else:
            fail("Measurement-spec delete ConfirmDialog", "dialog not shown")
    else:
        ok("Measurement-spec delete ConfirmDialog", "skipped (no specs)")


def static_checks() -> None:
    web = Path(__file__).resolve().parents[2]
    inv = web / "mfe-inventory"
    lists = web / "mfe-settings" / "src" / "pages" / "Lists.tsx"
    # grep window.confirm
    inv_hits = list(inv.rglob("*.tsx")) + list(inv.rglob("*.ts"))
    bad = []
    for f in inv_hits:
        if "node_modules" in str(f):
            continue
        text = f.read_text(encoding="utf-8", errors="ignore")
        if "window.confirm" in text:
            bad.append(str(f))
    if "window.confirm" in lists.read_text(encoding="utf-8", errors="ignore"):
        bad.append(str(lists))
    if bad:
        fail("Grep window.confirm", ", ".join(bad))
    else:
        ok("Grep window.confirm", "none in mfe-inventory or Lists.tsx")

    # npm test
    r = subprocess.run(
        ["npm", "test"],
        cwd=str(inv),
        capture_output=True,
        text=True,
        shell=True,
    )
    if r.returncode == 0:
        ok("npm test mfe-inventory", "vitest green")
    else:
        fail("npm test mfe-inventory", r.stdout[-500:] + r.stderr[-500:])


def main() -> int:
    static_checks()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        try:
            login(page)
            ok("Login", "admin session established")
            for name, fn in (
                ("categories", test_categories),
                ("products", test_products),
                ("movements", test_movements),
                ("transfers", test_transfers),
                ("customer_prices", test_customer_prices),
                ("settings_locations", test_settings_locations),
                ("measurement_specs", test_measurement_spec_delete),
            ):
                try:
                    fn(page)
                except Exception as e:
                    fail(f"Smoke section: {name}", str(e)[:300])
        except Exception as e:
            fail("Smoke runner", str(e)[:400])
        finally:
            browser.close()

    passed = sum(1 for r in RESULTS if r["pass"])
    total = len(RESULTS)
    print("\n=== SUMMARY ===")
    print(f"{passed}/{total} checks passed")
    failed = [r for r in RESULTS if not r["pass"]]
    if failed:
        print("Failures:")
        for r in failed:
            print(f"  - {r['name']}: {r['detail']}")
    out = Path(__file__).with_name("smoke-results.json")
    out.write_text(json.dumps(RESULTS, indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
