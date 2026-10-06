"""
Browser test: the app opened on a CLEANED database (books kept, everything else wiped).
Builds a demo DB, cleans it with server/cleanup-all-data.js, starts the server on it and clicks through every page.
Needs port 3000 free.   python3 server/test-clean-state-ui.py
"""
import json, os, subprocess, sys, tempfile, shutil, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "http://127.0.0.1:3000"
res = []
def ok(c, m, x=""):
    res.append(bool(c)); print(("  ✔ " if c else "  ✘ ") + m + ((" -> " + str(x)[:250]) if (not c and x != "") else ""))
def get(path): return json.loads(urllib.request.urlopen(BASE + path, timeout=10).read())

try:
    urllib.request.urlopen(BASE + "/api/ai/status", timeout=1); print("Port 3000 is busy - stop the running server first."); sys.exit(2)
except Exception:
    pass

tmp = tempfile.mkdtemp(); db = os.path.join(tmp, "clean.db")
subprocess.run(["node", "server/test-support/build-test-db.js", db], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
books_before = len(json.loads(subprocess.check_output(["node", "-e", f"const s=require('sqlite3');const d=new s.Database('{db}');d.all('select book_id from books',(e,r)=>console.log(JSON.stringify(r)))"], cwd=ROOT)))
subprocess.run(["node", "server/cleanup-all-data.js", "--apply", f"--backup-dir={tmp}/bk"], cwd=ROOT, check=True, env=dict(os.environ, DATABASE_PATH=db), stdout=subprocess.DEVNULL)
srv = subprocess.Popen(["node", "server/server-complete.js"], cwd=ROOT, env=dict(os.environ, PORT="3000", HOST="127.0.0.1", DATABASE_PATH=db, ANTHROPIC_API_KEY=""), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    time.sleep(0.5)
    try: urllib.request.urlopen(BASE + "/api/ai/status", timeout=1); break
    except Exception: pass

NAV = ["dashboard", "catalog", "membership", "circulation", "waiting-list", "book-request", "member-history", "book-history", "payments", "deposits", "email-dispatch", "history", "analytics"]
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(); page = b.new_page(viewport={"width": 1350, "height": 950})
        errors = []
        IGN = ("Chart", "emailjs", "LuminaLibrary is not defined", "Failed to load resource")
        page.on("pageerror", lambda e: errors.append(str(e)) if not any(i in str(e) for i in IGN) else None)
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and not any(i in m.text for i in IGN) else None)
        page.goto(BASE); page.wait_for_selector("#auth-username"); page.click("form button[type=submit]")
        page.wait_for_selector(".app-container", state="visible")

        print("\n1. Every page opens on the cleaned database")
        for v in NAV:
            page.click(f'button[data-view="{v}"]'); page.wait_for_timeout(350)
            txt = page.inner_text("#main-content, .main-content, main") if page.locator("#main-content, .main-content, main").count() else page.inner_text("body")
            ok(len(txt) > 40 and "undefined" not in txt and "NaN" not in txt, f"{v}: renders, no 'undefined'/'NaN'", txt[:120])
        ok(not errors, "no JavaScript errors while visiting all pages", errors[:3])

        print("\n2. The books are all still there; nothing else is")
        page.click('button[data-view="catalog"]'); page.wait_for_selector(".catalog-grid")
        ok(f"({books_before} Titles)" in page.inner_text("body"), f"Books page says {books_before} titles")
        api = get("/api/bootstrap")
        ok(len(api["books"]) == books_before and all(x["available"] == x["copies"] for x in api["books"]), "every book is at full stock")
        ok(page.inner_text("#nav-members-count").strip() in ("0", "") if page.locator("#nav-members-count").count() else True, "Members badge shows 0")
        page.click('button[data-view="dashboard"]'); page.wait_for_timeout(500)
        dash = page.inner_text("body")
        ok("Test Patron" not in dash and "Aaditya" not in dash and "Amit Kumar" not in dash, "no old member names anywhere on the dashboard")
        page.click('button[data-view="membership"]'); page.wait_for_timeout(300)
        ok("Aaditya" not in page.inner_text("body") and page.locator("tbody tr").count() <= 1, "Members page is empty")
        page.click('button[data-view="waiting-list"]'); page.wait_for_timeout(300)
        ok("No active reservations" in page.inner_text("body"), "Waiting List shows its empty message")
        page.click('button[data-view="history"]'); page.wait_for_selector("#audit-results"); page.wait_for_timeout(500)
        page.wait_for_function("document.querySelector('#audit-results').innerText.includes('Showing')")
        t0 = page.inner_text("#audit-results")
        ok("of 1 record" in t0 and "LOGIN" in t0 and "Aaditya" not in t0, "Audit log holds ONLY today's sign-in - no old records", t0[:200])

        print("\n3. Adding NEW data works")
        page.click('button[data-view="membership"]'); page.wait_for_timeout(300)
        page.evaluate("app.openModal('add-member')"); page.wait_for_selector("#nm-name")
        page.fill("#nm-name", "My First Member"); page.fill("#nm-email", "first@mine.org"); page.fill("#nm-phone", "9999999999"); page.fill("#nm-dept", "Physics")
        page.click("#modal-content button[type=submit]"); page.wait_for_function("document.getElementById('toast-root').innerText.toLowerCase().includes('first member') || document.getElementById('toast-root').innerText.toLowerCase().includes('enrolled') || document.getElementById('toast-root').innerText.toLowerCase().includes('added')", timeout=8000)
        page.wait_for_timeout(600)
        mem = get("/api/bootstrap")["members"]
        ok(len(mem) == 1 and mem[0]["name"] == "My First Member", "the new member is saved in the database", [m["name"] for m in mem])
        ok("My First Member" in page.inner_text("body"), "and shows on the Members page")
        mid = mem[0]["memberID"]
        book = api["books"][0]
        page.evaluate(f"app.openModal('issue-book', {{ bookID: {book['bookID']} }})"); page.wait_for_selector("#modal-content form")
        sel = page.locator("#modal-content select").first
        sel.select_option(mid)
        page.click("#modal-content button[type=submit]"); page.wait_for_timeout(1200)
        after = {x["bookID"]: x for x in get("/api/bootstrap")["books"]}
        ok(after[book["bookID"]]["available"] == book["copies"] - 1, "issuing a book to the new member lowers its stock by 1", after[book["bookID"]])
        page.click('button[data-view="history"]'); page.wait_for_function("document.querySelector('#audit-results') && document.querySelector('#audit-results').innerText.includes('My First Member')", timeout=8000)
        t = page.inner_text("#audit-results")
        ok("My First Member" in t and "Aaditya" not in t, "the Audit log shows only the new activity")
        page.click(".chatbot-fab"); page.wait_for_selector("#chat-input", state="visible")
        page.fill("#chat-input", "show me programming books"); page.press("#chat-input", "Enter")
        page.wait_for_function("(()=>{const b=document.querySelectorAll('#chat-messages .chat-bubble.bot');return b.length>0 && !b[b.length-1].innerText.startsWith('Thinking')})()", timeout=10000)
        ok(page.locator("#chat-messages .chat-bubble.bot").last.locator(".badge").count() >= 2, "the AI assistant still recommends the kept books")
        ok(not errors, "no JavaScript errors during all of that", errors[:3])
        page.screenshot(path="/tmp/clean_state.png")
        b.close()
finally:
    srv.terminate(); time.sleep(0.5); shutil.rmtree(tmp, ignore_errors=True)
print(f"\n==== Clean-state browser checks: {sum(res)} passed, {len(res)-sum(res)} failed ====")
sys.exit(0 if all(res) else 1)
