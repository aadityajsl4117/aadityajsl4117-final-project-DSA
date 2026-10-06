/**
 * Audit module end-to-end test.
 * Spawns its own server on a throw-away database, so it NEVER pollutes the real audit ledger.
 *   node server/test-audit.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const sqlite3 = require('sqlite3');

const PORT = 3400 + Math.floor(Math.random() * 400);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-audit-'));
const DB = path.join(TMP, 'audit-test.db');

let passed = 0, failed = 0;
const ok = (cond, msg, extra) => {
  if (cond) { passed++; console.log(`  ✔ ${msg}`); }
  else { failed++; console.log(`  ✘ ${msg}${extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''}`); }
};

function api(method, url, body, headers = {}, raw = false) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: '127.0.0.1', port: PORT, path: url, method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (raw) return resolve({ status: res.statusCode, headers: res.headers, text: buf });
        let json = null; try { json = JSON.parse(buf); } catch (e) {}
        resolve({ status: res.statusCode, data: json, text: buf });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function startServer() {
  const child = spawn('node', [path.join(__dirname, 'server-complete.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: DB }, stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stderr.on('data', d => { if (process.env.DEBUG_AUDIT) process.stderr.write(d); });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 15000);
    child.stdout.on('data', d => { if (String(d).includes('Running')) { clearTimeout(t); resolve(child); } });
    child.on('exit', c => { if (c) reject(new Error('server exited ' + c)); });
  });
}
const stopServer = child => new Promise(r => { child.once('exit', r); child.kill(); });
const audit = async (qs = '') => (await api('GET', '/api/audit' + qs)).data;
const latest = async (action) => (await audit(`?action=${action}&limit=1`)).logs[0];

(async () => {
  let server = await startServer();
  const tokenHdr = { Authorization: 'Bearer eyJ.lumina_jwt_token_admin' };
  try {
    console.log('\n1. Ledger shape, seed data and ordering');
    let a = await audit();
    ok(a.success && Array.isArray(a.logs) && a.total >= 5, 'GET /api/audit returns seeded ledger', a && a.total);
    ok(a.logs.every(l => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(l.timestamp)), 'all timestamps use YYYY-MM-DD HH:MM:SS');
    ok(Array.isArray(a.modules) && a.modules.includes('CATALOG') && Array.isArray(a.actions), 'module/action option lists returned');
    ok(a.summary && a.summary.all === a.total, 'summary totals present');
    ok(a.pages === Math.ceil(a.total / a.limit), 'page count correct');

    console.log('\n2. Authentication events');
    const before = (await audit()).summary.all;
    const good = await api('POST', '/api/auth/login', { username: 'admin', password: 'lumina2026' });
    ok(good.status === 200 && good.data.token, 'admin login succeeds');
    let lg = await latest('LOGIN');
    ok(lg && lg.module === 'AUTH' && lg.status === 'SUCCESS', 'LOGIN audited as SUCCESS', lg);
    const bad = await api('POST', '/api/auth/login', { username: 'admin', password: 'definitely-wrong' });
    ok(bad.status === 401, 'wrong password rejected', bad.status);
    lg = await latest('LOGIN_FAILED');
    ok(lg && lg.status === 'FAILED', 'LOGIN_FAILED audited with status FAILED', lg);
    const unknown = await api('POST', '/api/auth/login', { username: 'nobody-here', password: 'x' });
    ok(unknown.status === 401, 'unknown account rejected');
    const failedOnly = await audit('?status=FAILED');
    ok(failedOnly.total >= 2 && failedOnly.logs.every(l => l.status === 'FAILED'), 'status filter isolates failures', failedOnly.total);
    await api('POST', '/api/auth/logout', {}, tokenHdr);
    lg = await latest('LOGOUT');
    ok(lg && lg.memberID === 'admin', 'LOGOUT audited with the signed-in user', lg);

    console.log('\n3. Membership (add / edit diff / no-op / deactivate)');
    const addM = await api('POST', '/api/members', { name: 'Audit Tester', email: 'audit.tester@lumina.edu', phone: '123', userType: '', department: 'Physics' });
    ok(addM.status === 201, 'member created', addM.data);
    const mid = addM.data.memberID || (addM.data.member && addM.data.member.memberID);
    lg = await latest('ADD_MEMBER');
    ok(lg && !/undefined/.test(lg.description), 'ADD_MEMBER description has no "undefined"', lg && lg.description);
    await api('PUT', `/api/members/${mid}`, { name: 'Audit Tester', department: 'Chemistry' });
    lg = await latest('EDIT_MEMBER');
    ok(lg && /Dept: Physics/.test(lg.oldValue) && /Dept: Chemistry/.test(lg.newValue), 'EDIT_MEMBER stores old and new values', lg);
    ok(lg && !/Name:/.test(lg.oldValue), 'only changed fields are recorded', lg && lg.oldValue);
    const cEdit = (await audit('?action=EDIT_MEMBER')).total;
    await api('PUT', `/api/members/${mid}`, { name: 'Audit Tester', department: 'Chemistry' });
    ok((await audit('?action=EDIT_MEMBER')).total === cEdit, 'no-op edit writes no audit row');

    console.log('\n4. Catalog (add / edit diff / delete)');
    const addB = await api('POST', '/api/books', { title: 'Audit Handbook', author: 'Ada Auditor', category: 'Computer Science', isbn: '9780000000001', copies: 2 });
    const bid = addB.data.bookID || (addB.data.book && addB.data.book.bookID);
    ok(addB.status === 201 && bid, 'book created', addB.data);
    await api('PUT', `/api/books/${bid}`, { title: 'Audit Handbook', author: 'Ada Auditor', category: 'Computer Science', copies: 3, shelf: 'ZZ-9' });
    lg = await latest('EDIT_BOOK');
    ok(lg && /Copies: 2/.test(lg.oldValue) && /Copies: 3/.test(lg.newValue) && /Shelf/.test(lg.newValue), 'EDIT_BOOK stores field-level diff', lg);

    console.log('\n5. Circulation + deposits');
    const issue = await api('POST', '/api/circulation/issue', { memberID: mid, bookID: bid });
    ok(issue.status === 201, 'book issued', issue.data);
    const txn = issue.data.transactionID;
    lg = await latest('ISSUE_BOOK');
    ok(lg && lg.memberID === mid && lg.bookTitle === 'Audit Handbook' && lg.transactionID === txn, 'ISSUE_BOOK links member, book and transaction', lg);
    await api('POST', '/api/circulation/renew', { transactionID: txn, extend_days: 7 });
    lg = await latest('RENEW_BOOK');
    ok(lg && lg.memberID === mid && lg.bookTitle === 'Audit Handbook' && /Due:/.test(lg.oldValue) && /Due:/.test(lg.newValue), 'RENEW_BOOK now carries member, book and due-date change', lg);
    await api('POST', '/api/circulation/return', { transactionID: txn });
    lg = await latest('RETURN_BOOK');
    ok(lg && lg.transactionID === txn, 'RETURN_BOOK audited', lg);

    const ext = await api('POST', '/api/members', { name: 'Visitor Audit', email: 'visitor.audit@ext.org', userType: 'External Visitor', department: 'Research' });
    const extId = ext.data.memberID || (ext.data.member && ext.data.member.memberID);
    const extIssue = await api('POST', '/api/circulation/issue', { memberID: extId, bookID: bid });
    lg = await latest('SECURITY_DEPOSIT');
    ok(extIssue.status === 201 && lg && lg.memberID === extId && /500/.test(lg.description), 'external visitor deposit audited', lg);
    await api('POST', '/api/circulation/return', { transactionID: extIssue.data.transactionID });
    const refund = await api('POST', '/api/deposits/refund', { memberID: extId });
    lg = await latest('REFUND_DEPOSIT');
    ok(lg && lg.memberID === extId, 'REFUND_DEPOSIT audited', refund.data);

    console.log('\n6. Waiting list');
    await api('POST', '/api/circulation/issue', { memberID: mid, bookID: bid });
    await api('POST', '/api/circulation/issue', { memberID: 'MEM-1002', bookID: bid });
    const join = await api('POST', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1003' });
    ok(join.status === 201 || join.status === 200, 'joined waitlist', join.data);
    ok((await latest('JOIN_WAITLIST')).memberID === 'MEM-1003', 'JOIN_WAITLIST audited');
    await api('POST', '/api/waiting-list/serve', { bookID: bid });
    lg = await latest('SERVE_WAITLIST');
    ok(lg && lg.memberID === 'MEM-1003' && lg.bookTitle === 'Audit Handbook', 'SERVE_WAITLIST audited', lg);
    await api('POST', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1004' });
    await api('DELETE', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1004' });
    lg = await latest('CANCEL_WAITLIST');
    ok(lg && lg.memberID === 'MEM-1004', 'CANCEL_WAITLIST audited', lg);

    console.log('\n7. Book requests, payments, feedback');
    const rq = await api('POST', '/api/book-requests', { title: 'Requested Title', author: 'Req Author', memberID: 'MEM-1001' });
    const rid = rq.data.requestID;
    lg = await latest('CREATE_BOOK_REQUEST');
    ok(lg && lg.memberID === 'MEM-1001' && /Requested Title/.test(lg.description), 'CREATE_BOOK_REQUEST audited', lg);
    await api('PUT', `/api/book-requests/${rid}`, { status: 'ORDERED' });
    lg = await latest('UPDATE_BOOK_REQUEST');
    ok(lg && /PENDING/.test(lg.oldValue) && /ORDERED/.test(lg.newValue), 'UPDATE_BOOK_REQUEST shows status change', lg);
    ok((await api('PUT', '/api/book-requests/REQ-NOPE', { status: 'ORDERED' })).status === 404, 'unknown request -> 404');
    await api('DELETE', `/api/book-requests/${rid}`);
    ok((await latest('CANCEL_BOOK_REQUEST')).newValue === 'Status: CANCELLED', 'CANCEL_BOOK_REQUEST audited');

    await api('POST', '/api/payments/settle', { member_id: 'MEM-1001', amount: 40, method: 'Cash' });
    lg = await latest('FINE_PAYMENT');
    ok(lg && lg.memberName === 'Aaditya Jaiswal', 'FINE_PAYMENT stores the real patron name, not the ID', lg);
    await api('POST', '/api/feedbacks', { userName: 'Tester', category: 'General', rating: 4, comments: 'ok' });
    ok((await latest('SUBMIT_FEEDBACK')).module === 'FEEDBACK', 'feedback audited');

    console.log('\n8. Deactivate member');
    const freshMem = await api('POST', '/api/members', { name: 'Delete Tester', email: 'deltest@lumina.edu' });
    const freshID = freshMem.data.memberID || (freshMem.data.member && freshMem.data.member.member_id);
    const deact = await api('DELETE', `/api/members/${freshID}`);
    ok(deact.status === 200 || deact.status === 409, 'member delete answered (200 deleted, or 409 with a reason)');
    lg = await latest('DELETE_MEMBER');
    ok(deact.status === 409 || (lg && /Deleted/.test(lg.newValue)), 'DELETE_MEMBER audited', lg);
    ok((await api('DELETE', '/api/members/MEM-DOES-NOT-EXIST')).status === 404, 'unknown member -> 404');
    const boot = await api('GET', '/api/bootstrap');
    ok(!boot.data.members.some(m => (m.memberID || m.member_id) === freshID), 'deactivated member hidden from bootstrap');
    ok(boot.data.history.length > 20 && boot.data.history[0].timestamp >= boot.data.history[boot.data.history.length - 1].timestamp, 'bootstrap history is newest-first');

    console.log('\n9. Browser-originated events (POST /api/audit)');
    ok((await api('POST', '/api/audit', { module: 'SYSTEM' })).status === 400, 'missing action rejected');
    ok((await api('POST', '/api/audit', { action: 'DROP TABLE;--', module: 'SYSTEM' })).status === 400, 'malformed action rejected');
    const post = await api('POST', '/api/audit', { action: 'undo_action', module: 'system', description: '<img src=x onerror=alert(1)> Reversed checkout', memberName: 'Admin' });
    ok(post.status === 201 && post.data.record.action === 'UNDO_ACTION' && /^HIS-/.test(post.data.record.historyID), 'valid event stored and normalised', post.data);
    const dupIds = new Set(); let unique = true;
    const burst = await Promise.all(Array.from({ length: 15 }, () => api('POST', '/api/audit', { action: 'BURST_TEST', module: 'SYSTEM', description: 'burst' })));
    burst.forEach(r => { if (dupIds.has(r.data.record.historyID)) unique = false; dupIds.add(r.data.record.historyID); });
    ok(burst.every(r => r.status === 201) && unique, '15 concurrent writes all succeed with unique IDs');

    console.log('\n10. Filtering, search, pagination');
    const mod = await audit('?module=CIRCULATION');
    ok(mod.total > 0 && mod.logs.every(l => l.module === 'CIRCULATION'), 'module filter');
    const act = await audit('?action=ISSUE_BOOK');
    ok(act.total > 0 && act.logs.every(l => l.action === 'ISSUE_BOOK'), 'action filter');
    const s1 = await audit('?q=audit%20handbook');
    ok(s1.total > 0 && s1.logs.every(l => /audit handbook/i.test(JSON.stringify(l))), 'free-text search (case-insensitive)', s1.total);
    const s2 = await audit('?q=' + encodeURIComponent('100%'));
    ok(s2.success && s2.total === 0, 'search treats % literally (no wildcard leak)', s2.total);
    const s3 = await audit('?q=' + encodeURIComponent("' OR 1=1 --"));
    ok(s3.success && s3.total === 0, 'search is SQL-injection safe', s3.total);
    const today = new Date(); const d = n => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate() + n).padStart(2, '0')}`;
    const inRange = await audit(`?from=${d(0)}&to=${d(0)}`);
    ok(inRange.total > 0 && inRange.logs.every(l => l.timestamp.startsWith(d(0))), "date range 'today' returns only today's rows", inRange.total);
    ok((await audit('?from=2000-01-01&to=2000-01-02')).total === 0, 'empty range returns zero rows');
    ok((await audit('?from=garbage&to=also-bad')).success, 'invalid dates ignored safely');
    const p1 = await audit('?limit=10&page=1'); const p2 = await audit('?limit=10&page=2');
    ok(p1.logs.length === 10 && p2.logs.length > 0 && p1.logs[0].historyID !== p2.logs[0].historyID, 'pagination returns different pages');
    const idsSeen = new Set([...p1.logs, ...p2.logs].map(l => l.historyID));
    ok(idsSeen.size === p1.logs.length + p2.logs.length, 'no overlap between pages');
    const over = await audit('?limit=10&page=9999');
    ok(over.page === over.pages, 'out-of-range page is clamped', [over.page, over.pages]);
    ok((await audit('?limit=100000')).limit === 200, 'limit capped at 200');
    const combined = await audit('?module=CIRCULATION&action=RETURN_BOOK&q=handbook');
    ok(combined.total > 0 && combined.logs.every(l => l.action === 'RETURN_BOOK'), 'filters combine with AND');

    console.log('\n11. CSV export');
    const csv = await api('GET', '/api/audit/export?module=CATALOG', null, {}, true);
    ok(csv.status === 200 && /text\/csv/.test(csv.headers['content-type']) && /attachment/.test(csv.headers['content-disposition']), 'CSV served as attachment');
    ok(csv.text.startsWith('\uFEFF"History ID","Timestamp"'), 'CSV has BOM + header row');
    const lines = csv.text.trim().split('\r\n');
    ok(lines.length - 1 === (await audit('?module=CATALOG')).total, 'CSV row count equals filtered total (all pages)', lines.length - 1);
    await api('POST', '/api/audit', { action: 'CSV_CHECK', module: 'SYSTEM', description: '=HYPERLINK("http://evil","x"), with "quotes"' });
    const csv2 = await api('GET', '/api/audit/export?action=CSV_CHECK', null, {}, true);
    ok(csv2.text.includes(`"'=HYPERLINK(""http://evil"",""x""), with ""quotes"""`), 'formula injection neutralised and quotes escaped', csv2.text.split('\r\n')[1]);

    console.log('\n12. Append-only guarantee');
    for (const m of ['PUT', 'PATCH', 'DELETE']) {
      const r = await api(m, '/api/audit/' + a.logs[0].historyID, {});
      ok(r.status === 404 || r.status === 405, `${m} /api/audit/:id is not available`, r.status);
    }
    const legacy = await api('GET', '/api/audit-logs');
    ok(legacy.status === 200 && Array.isArray(legacy.data) && legacy.data[0].history_id, 'legacy /api/audit-logs still returns a flat array');

    console.log('\n13. Legacy timestamp migration on restart');
    await stopServer(server);
    await new Promise((resolve, reject) => {
      const raw = new sqlite3.Database(DB);
      raw.run(`INSERT INTO history (history_id, timestamp, action, module, description) VALUES ('LEGACY-1', '10/2/2026, 9:35:11 PM', 'LEGACY', 'SYSTEM', 'old row'), ('LEGACY-2', '3/14/2026, 12:05:09 AM', 'LEGACY', 'SYSTEM', 'old row 2')`, e => {
        raw.close(); e ? reject(e) : resolve();
      });
    });
    server = await startServer();
    const mig = await audit('?action=LEGACY&limit=10');
    const byId = Object.fromEntries(mig.logs.map(l => [l.historyID, l.timestamp]));
    ok(byId['LEGACY-1'] === '2026-10-02 21:35:11', 'PM locale string converted', byId['LEGACY-1']);
    ok(byId['LEGACY-2'] === '2026-03-14 00:05:09', '12 AM edge case converted', byId['LEGACY-2']);
    const persisted = await audit('?limit=200');
    ok(persisted.total > 40, 'ledger survives restart (no re-seed / data loss)', persisted.total);
  } catch (e) {
    failed++; console.error('\nUNEXPECTED ERROR:', e);
  } finally {
    try { await stopServer(server); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(`\n==== Audit tests: ${passed} passed, ${failed} failed ====`);
  process.exit(failed ? 1 : 0);
})();
