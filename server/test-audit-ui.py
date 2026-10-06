"""
Browser test for the Audit page (needs: pip install playwright && playwright install chromium).

Start the server on a THROW-AWAY demo database first (your real data is never used):
    node server/test-support/build-test-db.js /tmp/ui.db
    DATABASE_PATH=/tmp/ui.db PORT=3000 node server/server-complete.js &
    python3 server/test-audit-ui.py
"""
import re, json, sys, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
res = []
TAG = str(int(time.time()))  # unique per run so the test can be re-run on the same DB


def ok(c, m, extra=""):
    res.append(bool(c))
    print(("  ✔ " if c else "  ✘ ") + m + ((" -> " + str(extra)) if (not c and extra != "") else ""))


def post(path, body):
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(r).read())


def get(path):
    return json.loads(urllib.request.urlopen(BASE + path).read())


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(accept_downloads=True)
    page = ctx.new_page()
    errors, dialogs = [], []
    page.on("pageerror", lambda e: errors.append(str(e)) if not any(i in str(e) for i in ("Chart is not defined", "emailjs", "LuminaLibrary is not defined")) else None)
    # Ignore sandbox/CDN noise: Chart.js & EmailJS load from CDNs that may be unreachable offline
    # "LuminaLibrary is not defined" = known pre-existing script-order error in js/data/seed-data.js (not audit related)
    IGNORED = ("Failed to load resource", "Chart is not defined", "emailjs is not defined", "LuminaLibrary is not defined")
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and not any(i in m.text for i in IGNORED) else None)
    page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))

    # the test creates the audit rows it searches for (it must not depend on leftover data)
    post("/api/audit", {"action": "JOIN_WAITLIST", "module": "WAITING_LIST", "memberName": "Amit Kumar", "memberID": "MEM-1003", "description": "Amit Kumar joined the waiting list (test fixture)"})

    print("\n1. Login + open Audit page")
    page.goto(BASE)
    page.wait_for_selector("#auth-username")
    page.click("form button[type=submit]")
    page.wait_for_selector(".app-container", state="visible")
    page.click('button[data-view="history"]')
    page.wait_for_selector("#audit-results table tbody tr")
    rows = page.locator("#audit-results table tbody tr").count()
    total = get("/api/audit")["total"]
    ok(rows == min(25, total), f"table shows {rows} rows (server total {total})")
    stat = page.inner_text("#audit-summary")
    ok("total records" in stat.lower() and "matching filters" in stat.lower(), "summary cards rendered", stat)
    ok(page.inner_text("#nav-hist-count").strip() == str(total), "sidebar badge equals server total", page.inner_text("#nav-hist-count"))
    ok(re.search(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", page.inner_text("#audit-results table tbody tr")) is not None, "timestamps in normalised format")
    ok("undefined" not in page.inner_text("#audit-results").lower(), 'no "undefined" text on the page')

    print("\n2. Search / filters")
    page.fill("#audit-q", "Amit")
    page.wait_for_function("document.querySelectorAll('#audit-results table tbody tr').length>=1 && [...document.querySelectorAll('#audit-results table tbody tr')].every(r=>/amit/i.test(r.innerText))")
    ok(True, "search 'Amit' narrows rows to matching entries")
    page.fill("#audit-q", "zzz-no-such-thing")
    page.wait_for_selector("text=No audit records match")
    ok(True, "empty state shown for no matches")
    page.click("button:has-text('Clear')")
    page.wait_for_function("document.querySelectorAll('#audit-results table tbody tr').length>=3")
    ok(page.input_value("#audit-q") == "", "Clear resets filters")
    page.select_option("#audit-module", "CATALOG")
    page.wait_for_function("(()=>{const c=[...document.querySelectorAll('#audit-results table tbody tr td:nth-child(4)')];return c.length>0&&c.every(x=>x.innerText.trim()==='CATALOG')})()")
    ok(True, "module dropdown filters")
    page.click("button:has-text('Clear')")

    print("\n3. Member edit + delete + undo flow produces audit rows")
    page.click('button[data-view="membership"]')
    page.wait_for_selector("button:has-text('Edit')")
    page.locator("button:has-text('Edit')").first.click()
    page.wait_for_selector("#edit-m-dept")
    old = page.input_value("#edit-m-dept")
    newd = f"Audit Dept {TAG}"
    page.fill("#edit-m-dept", newd)
    page.click("text=Save Changes & Log Audit")
    page.wait_for_timeout(1500)
    ents = get("/api/audit?action=EDIT_MEMBER&limit=1")["logs"]
    ok(bool(ents) and newd in ents[0]["newValue"] and old in ents[0]["oldValue"], "UI edit persisted to DB and audited with old/new", ents[:1])
    page.locator("button:has-text('Delete')").last.click()
    page.wait_for_selector("text=Yes, Delete Member")
    page.click("text=Yes, Delete Member")
    page.wait_for_timeout(1500)
    d = get("/api/audit?action=DEACTIVATE_MEMBER&limit=1")["logs"]
    ok(bool(d), "UI delete audited as DEACTIVATE_MEMBER", d[:1])
    victim = d[0]["memberID"] if d else None
    ok(victim and not any(m["memberID"] == victim for m in get("/api/bootstrap")["members"]), "deleted member no longer served after reload")
    page.click("#btn-undo")
    page.wait_for_timeout(1800)
    u = get("/api/audit?action=UNDO_ACTION&limit=1")["logs"]
    ok(bool(u) and "Restored" in u[0]["description"], "Undo recorded in ledger via POST /api/audit", u[:1])
    ok(any(m["memberID"] == victim for m in get("/api/bootstrap")["members"]), "undo re-activated the member in the database")

    print("\n4. Ledger reflects UI actions (and persists across reload)")
    page.click('button[data-view="history"]')
    page.wait_for_selector("#audit-results table tbody tr")
    page.fill("#audit-q", newd)
    page.wait_for_function("document.querySelector('#audit-results .audit-diff')")
    txt = page.inner_text("#audit-results")
    ok("From:" in txt and newd in txt, "old ➔ new diff displayed on the Audit page")
    page.reload()
    page.wait_for_selector(".app-container", state="visible")
    page.click('button[data-view="history"]')
    page.wait_for_selector("#audit-results table tbody tr")
    page.fill("#audit-q", "Restored")
    page.wait_for_function("[...document.querySelectorAll('#audit-results table tbody tr')].some(r=>/Restored/.test(r.innerText))")
    ok(True, "entries still present after full page reload")
    page.click("button:has-text('Clear')")

    print("\n5. XSS safety")
    post("/api/audit", {"action": f"XSS_{TAG}", "module": "SYSTEM", "memberName": "<b>bold</b>", "description": "<img src=x onerror=alert('xss')> <script>window.__x=1</script>"})
    page.click("button:has-text('Refresh')")
    page.fill("#audit-q", f"XSS_{TAG}")
    page.wait_for_function("document.querySelectorAll('#audit-results table tbody tr').length===1")
    ok(page.locator("#audit-results img").count() == 0 and not dialogs and page.evaluate("window.__x") != 1, "HTML in audit data rendered as inert text", dialogs)
    ok("<img src=x" in page.inner_text("#audit-results"), "payload visible as literal text")
    page.click("button:has-text('Clear')")

    print("\n6. Pagination")
    for i in range(12):
        post("/api/audit", {"action": f"PAGINATION_SEED_{TAG}", "module": "SYSTEM", "description": f"seed row {i}"})
    page.click("button:has-text('Refresh')")
    page.wait_for_selector("#audit-results .audit-pager select")
    page.select_option("#audit-results .audit-pager select", "10")
    page.wait_for_function("/Page 1 \\//.test(document.querySelector('.audit-pager').innerText)")
    first = page.inner_text("#audit-results table tbody tr td:first-child")
    ok(page.locator("#audit-results .audit-pager button:has-text('Prev')").is_disabled(), "Prev disabled on page 1")
    page.click("#audit-results .audit-pager button:has-text('Next')")
    page.wait_for_function("/Page 2 \\//.test(document.querySelector('.audit-pager').innerText)")
    ok(page.inner_text("#audit-results table tbody tr td:first-child") != first, "Next shows a different page")

    print("\n7. CSV export")
    page.fill("#audit-q", "EDIT")
    page.wait_for_timeout(1000)
    with page.expect_download() as dl:
        page.click("button:has-text('Export CSV')")
    data = open(dl.value.path(), encoding="utf-8-sig").read()
    ok(dl.value.suggested_filename.endswith(".csv") and data.startswith('"History ID"'), "CSV downloaded", dl.value.suggested_filename)
    import csv, io
    csv_rows = len(list(csv.reader(io.StringIO(data)))) - 1
    api_total = get("/api/audit?q=EDIT&limit=1")["total"]
    ok(csv_rows == api_total, "CSV honours the active filter (all matching rows)", f"csv={csv_rows} api={api_total}")

    print("\n8. Logout is audited")
    page.click("button[onclick='auth.logout()']")
    page.wait_for_timeout(1000)
    lo = get("/api/audit?action=LOGOUT&limit=1")["logs"]
    ok(bool(lo) and lo[0]["memberID"] == "admin", "LOGOUT audited from the UI", lo[:1])

    ok(not errors, "no JavaScript errors in the console", errors[:3])
    b.close()

print(f"\n==== UI audit checks: {sum(res)} passed, {len(res) - sum(res)} failed ====")
sys.exit(0 if all(res) else 1)
