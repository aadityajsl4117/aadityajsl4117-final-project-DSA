/**
 * Test of server/cleanup-all-data.js on throw-away demo databases (your real data is never touched).
 *   node server/test-cleanup-all-data.js      (or: npm run test:cleanup)
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { buildTestDb } = require('./test-support/build-test-db');

let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log(`  ${c ? '✔' : '✘'} ${m}${!c && x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 300) : ''}`); };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-clean-'));
const SCRIPT = path.join(__dirname, 'cleanup-all-data.js');
const ADMIN = { Authorization: 'Bearer eyJ.lumina_jwt_token_admin' };

const sql = (file, q, p = []) => new Promise((res, rej) => { const d = new sqlite3.Database(file); d.all(q, p, (e, r) => { d.close(); e ? rej(e) : res(r); }); });
const exec = (file, q) => new Promise((res, rej) => { const d = new sqlite3.Database(file); d.run(q, e => { d.close(); e ? rej(e) : res(); }); });
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const cleanup = (db, ...args) => spawnSync('node', [SCRIPT, ...args], { env: { ...process.env, DATABASE_PATH: db }, encoding: 'utf8' });
const bookSum = async (f) => crypto.createHash('sha256').update(JSON.stringify(await sql(f, 'SELECT book_id,title,author,category,isbn,publisher,year,copies,shelf,cover_url FROM books ORDER BY book_id'))).digest('hex');
const count = async (f, t) => (await sql(f, `SELECT COUNT(*) AS c FROM ${t}`))[0].c;

function request(port, method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const d = body === undefined ? null : JSON.stringify(body);
    const r = http.request({ host: '127.0.0.1', port, path: url, method, headers: { 'Content-Type': 'application/json', ...(d ? { 'Content-Length': Buffer.byteLength(d) } : {}), ...headers } }, resp => {
      let b = ''; resp.on('data', c => b += c); resp.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) {} resolve({ status: resp.statusCode, data: j }); });
    });
    r.on('error', reject); if (d) r.write(d); r.end();
  });
}
async function startServer(db) {
  const port = 5900 + Math.floor(Math.random() * 300);
  const child = spawn('node', [path.join(__dirname, 'server-complete.js')], { env: { ...process.env, DATABASE_PATH: db, PORT: String(port), HOST: '127.0.0.1', ANTHROPIC_API_KEY: '' }, stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((r, j) => { child.stdout.on('data', d => String(d).includes('Running') && r()); setTimeout(() => j(new Error('server timeout')), 20000); });
  return { port, api: (m, u, b, h) => request(port, m, u, b, h), stop: async () => { child.kill(); await new Promise(r => setTimeout(r, 400)); } };
}

(async () => {
  try {
    console.log('Building a demo database with data in every table…');
    const db = await buildTestDb(path.join(TMP, 'demo.db'));
    // add rows to the tables the default demo leaves empty, through the real API
    let s = await startServer(db);
    await s.api('POST', '/api/waiting-list', { bookID: 101, memberID: 'MEM-1003' });
    await s.api('POST', '/api/feedbacks', { userName: 'Tester', category: 'General', rating: 4, comments: 'fine' });
    await s.api('POST', '/api/book-requests', { title: 'Wished Book', author: 'W', memberID: 'MEM-1002' });
    await s.api('POST', '/api/payments/settle', { member_id: 'MEM-1001', amount: 40, method: 'Cash' });
    await s.api('POST', '/api/emails/send', { recipient: 'x@y.org', recipientName: 'X', subject: 'Hello', message: 'Body', type: 'NOTICE' });
    await s.stop();
    await exec(db, "INSERT INTO notifications (notification_id, member_id, type, title, message) VALUES ('NTF-1', 'MEM-1001', 'GENERAL', 'Test', 'Test notification')");

    const tables = (await sql(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map(t => t.name);
    const WIPE = tables.filter(t => !['books', 'users', 'system_config'].includes(t));
    const before = {}; for (const t of tables) before[t] = await count(db, t);
    console.log(`  demo data: ${WIPE.map(t => `${t}=${before[t]}`).join(', ')}, books=${before.books}`);
    ok(WIPE.every(t => before[t] > 0), 'every table to be wiped really has data to start with', before);
    const sumBefore = await bookSum(db);
    const stockBefore = await sql(db, 'SELECT COUNT(*) c FROM books WHERE available_copies != copies');
    ok(stockBefore[0].c > 0, 'some books are currently on loan (stock != total) so the stock reset is tested');

    console.log('\n1. Dry run changes nothing');
    const hashBefore = md5(db);
    let r = cleanup(db, `--backup-dir=${TMP}/bk`);
    ok(r.status === 0 && /DRY RUN/.test(r.stdout), 'dry run exits cleanly and says so', r.stdout.slice(-200));
    ok(md5(db) === hashBefore, 'database file is byte-identical after a dry run');
    ok(!fs.existsSync(path.join(TMP, 'bk')), 'no backup is made for a dry run');
    ok(/members\s+\d+ rows\s+-> 0/.test(r.stdout) && /books\s+\d+ rows\s+\(kept\)/.test(r.stdout), 'it lists what is kept and what is deleted');

    console.log('\n2. Apply');
    r = cleanup(db, '--apply', `--backup-dir=${TMP}/bk`);
    ok(r.status === 0 && /DONE/.test(r.stdout), 'apply succeeds', (r.stdout + r.stderr).slice(-300));
    const bks = fs.existsSync(path.join(TMP, 'bk')) ? fs.readdirSync(path.join(TMP, 'bk')) : [];
    ok(bks.length === 1 && /BEFORE-CLEANUP/.test(bks[0]), 'a timestamped backup file was written', bks);
    if (bks.length) {
      const bf = path.join(TMP, 'bk', bks[0]);
      ok((await count(bf, 'members')) === before.members && (await count(bf, 'loans')) === before.loans, 'the backup still holds all the original data (restorable)');
    }
    for (const t of WIPE) ok((await count(db, t)) === 0, `${t} is empty`);
    ok((await count(db, 'books')) === before.books && (await bookSum(db)) === sumBefore, `all ${before.books} books are untouched (checksum of every catalog field identical)`);
    ok((await sql(db, 'SELECT COUNT(*) c FROM books WHERE available_copies != copies'))[0].c === 0, 'every book is back to full stock (available = total copies)');
    ok((await sql(db, 'SELECT COALESCE(SUM(borrow_count),0) s FROM books'))[0].s === 0, 'lifetime borrow counters reset to 0');
    ok((await count(db, 'users')) === before.users && (await count(db, 'system_config')) === before.system_config, 'sign-in accounts and the initialised-marker are kept');
    ok((await sql(db, "SELECT COUNT(*) c FROM sqlite_sequence WHERE name IN ('waiting_list','loans','history')"))[0].c === 0, 'auto-numbering restarted for the wiped tables');
    ok((await sql(db, 'PRAGMA freelist_count'))[0].freelist_count === 0, 'no free pages left behind (the deleted data was really released from the file)');

    console.log('\n3. Applying again is harmless');
    r = cleanup(db, '--apply', `--backup-dir=${TMP}/bk`);
    ok(r.status === 0 && /DONE/.test(r.stdout) && (await bookSum(db)) === sumBefore, 'second run: still fine, books unchanged');

    console.log('\n4. A server started on the cleaned database');
    s = await startServer(db);
    const boot = await s.api('GET', '/api/bootstrap');
    const b = boot.data;
    ok(b.books.length === before.books && b.members.length === 0 && b.transactions.length === 0 && b.history.length === 0 && b.deposits.length === 0 && b.bookRequests.length === 0 && b.payments.length === 0 && b.feedbacks.length === 0 && Object.keys(b.reservations || {}).length === 0, 'API reports all books and zero of everything else', { books: b.books.length, members: b.members.length, tx: b.transactions.length, hist: b.history.length });
    ok(!b.members.some(m => m.memberID === 'EXT-401'), 'the demo member EXT-401 is NOT re-created at start-up');
    const login = await s.api('POST', '/api/auth/login', { username: 'admin', password: 'lumina2026' });
    ok(login.status === 200 && login.data.token, 'admin can still sign in');
    const ai = await s.api('POST', '/api/ai/query', { query: 'show me programming books' }, ADMIN);
    ok(ai.data.books.length >= 2 && ai.data.books.every(x => x.available === x.copies), 'AI assistant still finds the kept books, all at full stock');
    const nm = await s.api('POST', '/api/members', { name: 'First Real Member', email: 'first.real@mine.org', userType: 'Student', department: 'Physics' });
    const mid = nm.data.memberID || (nm.data.member && nm.data.member.memberID);
    ok(nm.status === 201 && mid, 'a brand-new member can be added', nm.data);
    const target = b.books.find(x => x.copies >= 2);
    const iss = await s.api('POST', '/api/circulation/issue', { memberID: mid, bookID: target.bookID });
    const after = (await s.api('GET', '/api/bootstrap')).data;
    ok(iss.status === 201 && after.books.find(x => x.bookID === target.bookID).available === target.copies - 1, 'issuing a book to the new member lowers stock by exactly 1');
    const log = (await s.api('GET', '/api/audit?limit=50')).data;
    ok(log.logs.length >= 2 && log.logs.every(l => l.timestamp >= '2000') && !log.logs.some(l => /Test|Aaditya|Demo/.test(l.description)), 'audit log contains only the new activity', log.logs.map(l => l.action));
    await s.stop();

    console.log('\n5. Restart: nothing comes back');
    s = await startServer(db);
    const again = (await s.api('GET', '/api/bootstrap')).data;
    ok(again.members.length === 1 && again.members[0].name === 'First Real Member' && again.history.length >= 2 && again.books.length === before.books, 'after a restart only the new member exists (no demo data re-seeded)', { members: again.members.map(m => m.name) });
    await s.stop();

    console.log('\n6. --keep-borrow-counts');
    const db2 = await buildTestDb(path.join(TMP, 'demo2.db'));
    const bcBefore = (await sql(db2, 'SELECT COALESCE(SUM(borrow_count),0) s FROM books'))[0].s;
    r = cleanup(db2, '--apply', '--keep-borrow-counts', `--backup-dir=${TMP}/bk2`);
    ok(r.status === 0 && (await sql(db2, 'SELECT COALESCE(SUM(borrow_count),0) s FROM books'))[0].s === bcBefore, `borrow counters kept (${bcBefore}) when asked`);
    ok((await count(db2, 'members')) === 0, '...while everything else is still wiped');

    console.log('\n7. Safety nets');
    const db3 = await buildTestDb(path.join(TMP, 'demo3.db'));
    await exec(db3, "CREATE TRIGGER sneaky AFTER UPDATE ON books BEGIN UPDATE books SET title = title || '!' WHERE book_id = NEW.book_id; END");
    const h3 = await count(db3, 'members');
    r = cleanup(db3, '--apply', `--backup-dir=${TMP}/bk3`);
    ok(r.status !== 0 && /rolled back/i.test(r.stderr), 'if the book catalog would change, the whole clean-up is rolled back', r.stderr.slice(0, 200));
    ok((await count(db3, 'members')) === h3 && (await count(db3, 'loans')) > 0, 'after the rollback ALL data is still there');
    const empty = path.join(TMP, 'nobooks.db');
    await exec(empty, 'CREATE TABLE something (x TEXT)');
    r = cleanup(empty, '--apply');
    ok(r.status !== 0 && /No books table/.test(r.stderr), 'refuses to run on a database without a books table');
    r = spawnSync('node', [SCRIPT], { env: { ...process.env, DATABASE_PATH: path.join(TMP, 'missing.db') }, encoding: 'utf8' });
    ok(r.status !== 0 && /not found/i.test(r.stderr), 'refuses a database path that does not exist (never creates an empty one)');
  } catch (e) { fail++; console.error('ERROR', e); }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n==== Cleanup tests: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})();
