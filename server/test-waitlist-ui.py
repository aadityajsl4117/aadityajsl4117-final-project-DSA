"""Browser test for the Waiting List page. Start the server on a throw-away demo DB first (see test-audit-ui.py)."""
import json, sys, time, urllib.request
from playwright.sync_api import sync_playwright
BASE = "http://127.0.0.1:3000"; res = []; TAG = str(int(time.time()))
def ok(c, m, x=""):
    res.append(bool(c)); print(("  ✔ " if c else "  ✘ ") + m + ((" -> " + str(x)) if (not c and x != "") else ""))
def call(method, path, body=None):
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"}, method=method)
    try: return json.loads(urllib.request.urlopen(r).read())
    except urllib.error.HTTPError as e: return json.loads(e.read())

TITLE = f"Queue UI Book {TAG}"
bk = call("POST", "/api/books", {"title": TITLE, "author": "QA", "category": "Computer Science", "copies": 1})
bid = bk.get("bookID") or bk["book"]["bookID"]
for m in ["MEM-1001", "MEM-1002", "MEM-1003", "MEM-1004"]:
    call("POST", "/api/waiting-list", {"bookID": bid, "memberID": m})

def rows(page):  return page.locator("tbody tr", has_text=TITLE)
def wait_rows(page, n): page.wait_for_function("(a)=>[...document.querySelectorAll('tbody tr')].filter(r=>r.innerText.includes(a[0])).length===a[1]", arg=[TITLE, n])
def positions(page): return [r.locator("td").first.inner_text().strip() for r in rows(page).all()]

with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page(viewport={"width": 1400, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)) if not any(i in str(e) for i in ("Chart", "emailjs", "LuminaLibrary is not defined")) else None)
    page.goto(BASE); page.wait_for_selector("#auth-username"); page.click("form button[type=submit]")
    page.wait_for_selector(".app-container", state="visible")
    page.click('button[data-view="waiting-list"]'); wait_rows(page, 4)

    print("\n1. Simple table, real positions")
    ok(page.inner_text("h1.page-heading") == "Waiting List", "page title")
    heads = [h.strip().upper() for h in page.locator("thead th").all_inner_texts()]
    ok(heads == ["POSITION", "MEMBER NAME", "MEMBER ID", "BOOK TITLE & ID", "REQUESTED DATE", "STATUS", "ACTION"], "columns match the design", heads)
    ok(positions(page) == ["Position 1", "Position 2", "Position 3", "Position 4"], "Position 1,2,3,4 for the same book", positions(page))
    ok(all("WAITING" in r.inner_text() for r in rows(page).all()), "every row shows WAITING")
    ok(rows(page).locator("button:has-text('Cancel')").count() == 4, "CANCEL on every row (incl. Position 1)")
    ok(rows(page).locator("button:has-text('Grant')").count() == 1 and "grant" in rows(page).nth(0).inner_text().lower(), "GRANT only on Position 1")
    total = len(call("GET", "/api/waiting-list"))
    ok(f"({total} Waiting Members)" in page.inner_text(".card-header-bar"), "header count matches the database", page.inner_text(".card-header-bar"))
    page.screenshot(path="/tmp/wl_simple.png", full_page=True)

    print("\n2. Cancel a middle entry")
    rows(page).nth(1).locator("button:has-text('Cancel')").click(); page.wait_for_selector("#wl-cancel-confirm")
    ok("Position 2 of 4" in page.inner_text("#modal-content") and "2 members behind" in page.inner_text("#modal-content"), "confirmation explains the impact")
    page.select_option("#wl-cancel-reason", "Duplicate or mistaken entry"); page.click("#wl-cancel-confirm")
    wait_rows(page, 3)
    ok(positions(page) == ["Position 1", "Position 2", "Position 3"], "renumbered 1,2,3 after cancel", positions(page))
    log = call("GET", "/api/audit?action=CANCEL_WAITLIST&limit=1")["logs"][0]
    ok("Duplicate or mistaken entry" in log["description"] and log["oldValue"] == "Position: 2", "audit row has reason + old position", log)

    print("\n3. Cancel Position 1 -> next member promoted")
    second = rows(page).nth(1).locator("td").nth(1).inner_text().strip()
    rows(page).nth(0).locator("button:has-text('Cancel')").click(); page.click("#wl-cancel-confirm"); wait_rows(page, 2)
    ok(rows(page).nth(0).locator("td").nth(1).inner_text().strip() == second and positions(page)[0] == "Position 1", "second member is now Position 1")
    ok("grant" in rows(page).nth(0).inner_text().lower(), "GRANT moved to the new Position 1")

    print("\n4. Add to waiting list")
    page.click("text=+ Add to Waiting List"); page.wait_for_selector("#wl-position-hint")
    page.select_option("#wl-book-id", str(bid))
    ok("Position 3" in page.inner_text("#wl-position-hint"), "form tells you the position you will get", page.inner_text("#wl-position-hint"))
    page.select_option("#wl-member-id", "MEM-1003")
    ok("already" in page.inner_text("#wl-position-hint").lower(), "duplicate warned before submit")
    page.select_option("#wl-member-id", "MEM-1005"); page.click("#modal-content button[type=submit]"); wait_rows(page, 3)
    ok(positions(page) == ["Position 1", "Position 2", "Position 3"], "new member joins at Position 3", positions(page))

    print("\n5. Grant")
    rows(page).nth(0).locator("button:has-text('Grant')").click(); page.click("text=Yes, Grant Hold"); wait_rows(page, 2)
    ok(call("GET", "/api/audit?action=SERVE_WAITLIST&limit=1")["logs"][0]["bookTitle"] == TITLE, "grant served + audited")
    ok(positions(page) == ["Position 1", "Position 2"], "queue renumbered after grant", positions(page))

    print("\n6. Stale cancel (removed by someone else first)")
    victim = rows(page).nth(1).locator("td").nth(2).inner_text().strip()
    rows(page).nth(1).locator("button:has-text('Cancel')").click(); page.wait_for_selector("#wl-cancel-confirm")
    call("DELETE", "/api/waiting-list", {"bookID": bid, "memberID": victim})
    page.click("#wl-cancel-confirm")
    page.wait_for_function("document.getElementById('toast-root').innerText.includes('not on the waiting list')", timeout=5000)
    ok(True, "server error shown as toast")
    wait_rows(page, 1); ok(True, "table resynced")

    print("\n7. Survives reload + XSS safe")
    evil = call("POST", "/api/members", {"name": "<img src=x onerror=window.__x=1>Evil", "email": f"evil{TAG}@lumina.edu", "userType": "Student", "department": "X"})
    eid = evil.get("memberID") or evil["member"]["memberID"]; call("POST", "/api/waiting-list", {"bookID": bid, "memberID": eid})
    page.reload(); page.wait_for_selector(".app-container", state="visible"); page.click('button[data-view="waiting-list"]'); wait_rows(page, 2)
    ok(page.locator("tbody img").count() == 0 and "<img src=x" in rows(page).nth(1).inner_text(), "HTML in a member name stays literal text")
    rows(page).nth(1).locator("button:has-text('Cancel')").click(); page.wait_for_selector("#wl-cancel-confirm"); page.click("#wl-cancel-confirm"); page.wait_for_selector("#toast-root .toast-card")
    ok(page.locator("#toast-root img, #modal-content img").count() == 0 and page.evaluate("window.__x") != 1, "dialog and toast are inert too")
    ok(not errors, "no script errors", errors[:2])
    b.close()
print(f"\n==== Waiting-list UI checks: {sum(res)} passed, {len(res)-sum(res)} failed ====")
sys.exit(0 if all(res) else 1)
