/**
 * Custom Book ID test (throw-away database).   node server/test-custom-book-id.js
 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const PORT = 4300 + Math.floor(Math.random() * 300);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-bid-'));
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log(`  ${c ? '✔' : '✘'} ${m}${!c && x !== undefined ? '  -> ' + JSON.stringify(x) : ''}`); };
const api = (method, url, body) => new Promise((res, rej) => {
  const d = body ? JSON.stringify(body) : null;
  const r = http.request({ host: '127.0.0.1', port: PORT, path: url, method, headers: { 'Content-Type': 'application/json', ...(d ? { 'Content-Length': Buffer.byteLength(d) } : {}) } }, resp => {
    let b = ''; resp.on('data', c => b += c); resp.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) {} res({ status: resp.statusCode, data: j }); });
  }); r.on('error', rej); if (d) r.write(d); r.end();
});
const book = (extra) => ({ title: 'T ' + Math.random().toString(36).slice(2, 8), author: 'A', category: 'Computer Science', isbn: '1', copies: 2, ...extra });
const bootBooks = async () => (await api('GET', '/api/bootstrap')).data.books;

(async () => {
  const child = spawn('node', [path.join(__dirname, 'server-complete.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: path.join(TMP, 'b.db') }, stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((r, j) => { child.stdout.on('data', d => String(d).includes('Running') && r()); setTimeout(() => j(new Error('timeout')), 15000); });
  try {
    console.log('\nCustom ID accepted');
    let r = await api('POST', '/api/books', book({ title: 'My Own ID Book', bookID: 5000 }));
    ok(r.status === 201 && r.data.bookID === 5000, 'bookID 5000 is used exactly as typed', r.data);
    ok((await bootBooks()).some(b => b.bookID === 5000 && b.title === 'My Own ID Book'), 'the book is stored under #5000');
    const au = (await api('GET', '/api/audit?action=ADD_BOOK&limit=1')).data.logs[0];
    ok(au.bookID === '5000' && /entered manually/.test(au.description), 'audit log says the ID was entered manually', au);
    r = await api('POST', '/api/books', book({ bookID: '#777' }));
    ok(r.status === 201 && r.data.bookID === 777, '"#777" (with the hash) is accepted as 777', r.data);
    r = await api('POST', '/api/books', book({ book_id: 888 }));
    ok(r.status === 201 && r.data.bookID === 888, 'snake_case book_id also works', r.data);
    const iss = await api('POST', '/api/circulation/issue', { memberID: 'MEM-1001', bookID: 5000 });
    ok(iss.status === 201, 'a custom-ID book can be issued like any other');

    console.log('\nAuto-assign still works when the ID is empty');
    const max = Math.max(...(await bootBooks()).map(b => b.bookID));
    for (const empty of [undefined, '', '   ', null]) {
      r = await api('POST', '/api/books', book(empty === undefined ? {} : { bookID: empty }));
      const expected = Math.max(...(await bootBooks()).map(b => b.bookID));
      ok(r.status === 201 && r.data.bookID === expected && r.data.bookID > max, `empty ID (${JSON.stringify(empty)}) -> auto #${r.data && r.data.bookID}`, r.data);
    }
    ok((await api('POST', '/api/books', book({ bookID: 9000 }))).status === 201, 'custom 9000');
    r = await api('POST', '/api/books', book());
    ok(r.data.bookID === 9001, 'next auto ID continues after the highest (9001)', r.data.bookID);

    console.log('\nRejected input');
    const dup = await api('POST', '/api/books', book({ bookID: 5000 }));
    ok(dup.status === 409 && /already used by 'My Own ID Book'/.test(dup.data.error), 'duplicate ID -> 409 naming the book that owns it', dup.data);
    for (const bad of ['abc', '0', '-5', '12.5', '1e3', '12abc', 99999999999, '١٢٣']) {
      r = await api('POST', '/api/books', book({ bookID: bad }));
      ok(r.status === 400 && /whole number/.test(r.data.error), `invalid ID ${JSON.stringify(bad)} -> 400`, [r.status, r.data]);
    }
    const count = (await bootBooks()).length;
    await api('POST', '/api/books', book({ bookID: 'abc' }));
    ok((await bootBooks()).length === count, 'rejected requests create nothing');

    console.log('\nIDs of deleted books');
    await api('POST', '/api/books', book({ bookID: 8001 }));
    ok((await api('DELETE', '/api/books/8001')).status === 200, 'delete 8001 (no history)');
    r = await api('POST', '/api/books', book({ bookID: 8001, title: 'Second Life' }));
    ok(r.status === 201 && r.data.bookID === 8001, 'a deleted, history-free ID can be reused', r.data);
    await api('POST', '/api/books', book({ bookID: 8002 }));
    const l = await api('POST', '/api/circulation/issue', { memberID: 'MEM-1002', bookID: 8002 });
    await api('POST', '/api/circulation/return', { transactionID: l.data.transactionID });
    ok((await api('DELETE', '/api/books/8002')).status === 200, 'delete 8002 (it has loan history)');
    r = await api('POST', '/api/books', book({ bookID: 8002 }));
    ok(r.status === 409 && /loan history/.test(r.data.error), 'its ID cannot be reused (would inherit the old loan history)', r.data);

    console.log('\nTwo people save the same ID at the same moment');
    const race = await Promise.all(Array.from({ length: 6 }, (_, i) => api('POST', '/api/books', book({ bookID: 6500, title: 'Race ' + i }))));
    const codes = race.map(x => x.status).sort();
    ok(codes.filter(c => c === 201).length === 1 && codes.filter(c => c === 409).length === 5, 'exactly one wins (201), the rest get a clear 409', codes);
    ok((await bootBooks()).filter(b => b.bookID === 6500).length === 1, 'only one row exists for #6500');

    console.log('\nOther features unaffected');
    r = await api('PUT', '/api/books/5000', { title: 'My Own ID Book', author: 'A', category: 'Computer Science', copies: 4 });
    ok(r.status === 200, 'editing a custom-ID book works');
    const ai = await api('POST', '/api/ai/query', { query: 'is My Own ID Book available?' }, { Authorization: 'Bearer x.lumina_jwt_token_admin' });
    ok(ai.data && ai.data.books && ai.data.books[0] && ai.data.books[0].bookID === 5000, 'the AI assistant finds it with its custom ID');
  } catch (e) { fail++; console.error(e); }
  child.kill(); fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n==== Custom Book ID tests: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})();
