/**
 * Waiting-list API test (throw-away database).   node server/test-waitlist.js
 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const PORT = 3800 + Math.floor(Math.random() * 150);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-wl-'));
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log(`  ${c ? '✔' : '✘'} ${m}${!c && x !== undefined ? '  -> ' + JSON.stringify(x) : ''}`); };
const api = (method, url, body) => new Promise((res, rej) => {
  const d = body ? JSON.stringify(body) : null;
  const r = http.request({ host: '127.0.0.1', port: PORT, path: url, method, headers: { 'Content-Type': 'application/json', ...(d ? { 'Content-Length': Buffer.byteLength(d) } : {}) } }, resp => {
    let b = ''; resp.on('data', c => b += c); resp.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) {} res({ status: resp.statusCode, data: j }); });
  }); r.on('error', rej); if (d) r.write(d); r.end();
});
(async () => {
  const child = spawn('node', [path.join(__dirname, 'server-complete.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: path.join(TMP, 'wl.db') }, stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((r, j) => { child.stdout.on('data', d => String(d).includes('Running') && r()); setTimeout(() => j(new Error('timeout')), 15000); });
  const queue = async bid => ((await api('GET', '/api/waiting-list')).data || []).filter(w => w.book_id === bid);
  const last = async a => (await api('GET', `/api/audit?action=${a}&limit=1`)).data.logs[0];
  try {
    const bk = await api('POST', '/api/books', { title: 'Queue Test Book', author: 'A', category: 'Computer Science', copies: 1 });
    const bid = bk.data.bookID || (bk.data.book && bk.data.book.bookID);
    for (const m of ['MEM-1001', 'MEM-1002', 'MEM-1003', 'MEM-1004']) await api('POST', '/api/waiting-list', { bookID: bid, memberID: m });
    let q = await queue(bid);
    ok(q.length === 4 && q.map(x => x.position).join() === '1,2,3,4', 'four members queued at positions 1,2,3,4', q.map(x => x.position));

    console.log('\nCancel');
    let r = await api('DELETE', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1002', reason: 'Member requested cancellation' });
    ok(r.status === 200 && r.data.remaining === 3, 'cancel a middle entry', r.data);
    q = await queue(bid);
    ok(q.map(x => x.member_id).join() === 'MEM-1001,MEM-1003,MEM-1004' && q.map(x => x.position).join() === '1,2,3', 'members behind move up (1,2,3)', q.map(x => [x.member_id, x.position]));
    let a = await last('CANCEL_WAITLIST');
    ok(a.memberID === 'MEM-1002' && a.oldValue === 'Position: 2' && a.newValue === 'Status: CANCELLED' && /Reason: Member requested/.test(a.description), 'audit has position + reason', a);
    r = await api('DELETE', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1001' });
    ok(r.status === 200, 'cancel position 1 is allowed');
    q = await queue(bid);
    ok(q[0].member_id === 'MEM-1003' && q[0].position === 1, 'next member becomes Position 1', q[0]);
    const before = (await api('GET', '/api/audit')).data.total;
    r = await api('DELETE', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1002' });
    ok(r.status === 404, 'cancelling a non-existent entry -> 404 (was false success)', r.status);
    ok((await api('GET', '/api/audit')).data.total === before, 'failed cancel writes no audit row');
    ok((await api('DELETE', '/api/waiting-list', {})).status === 400, 'missing bookID -> 400');

    console.log('\nClear queue');
    r = await api('DELETE', '/api/waiting-list', { bookID: bid, memberID: 'ALL', reason: 'Duplicate' });
    ok(r.status === 200 && r.data.removed === 2, 'clear whole queue', r.data);
    ok((await queue(bid)).length === 0, 'queue empty');
    a = await last('CANCEL_WAITLIST');
    ok(/entire waiting list \(2 members\)/.test(a.description) && a.oldValue === 'Queue size: 2', 'audit records queue size', a);
    ok((await api('DELETE', '/api/waiting-list', { bookID: bid, memberID: 'ALL' })).status === 404, 'clearing an empty queue -> 404');

    console.log('\nJoin rules');
    ok((await api('POST', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1001' })).status === 201, 'rejoin after cancel is allowed');
    ok((await api('POST', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1001' })).status === 400, 'duplicate join rejected');
    ok((await api('POST', '/api/waiting-list', { bookID: bid, memberID: 'NOPE' })).status === 404, 'unknown member rejected');
    const nm = await api('POST', '/api/members', { name: 'Gone Soon', email: 'gone.soon@lumina.edu', userType: 'Student', department: 'X' });
    const nid = nm.data.memberID || (nm.data.member && nm.data.member.memberID);
    await api('PUT', `/api/members/${nid}`, { status: 'INACTIVE' });
    const ij = await api('POST', '/api/waiting-list', { bookID: bid, memberID: nid });
    ok((ij.status === 400 && /inactive/i.test(ij.data.error)) || ij.status === 404, 'inactive member cannot join', ij.data);

    console.log('\nServe');
    await api('POST', '/api/waiting-list', { bookID: bid, memberID: 'MEM-1003' });
    r = await api('POST', '/api/waiting-list/serve', { bookID: bid });
    ok(r.data.servedMemberID === 'MEM-1001', 'serve takes Position 1', r.data);
    q = await queue(bid);
    ok(q.length === 1 && q[0].member_id === 'MEM-1003' && q[0].position === 1, 'remaining member promoted to Position 1', q);
  } catch (e) { fail++; console.error(e); }
  child.kill(); fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n==== Waitlist tests: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})();
