/**
 * Audit ledger clean-up utility (touches ONLY the `history` table).
 *
 *   node server/cleanup-audit-data.js            -> dry run, shows what would change
 *   node server/cleanup-audit-data.js --apply    -> backs up the DB, then applies the clean-up
 *
 * What it does
 *   1. Removes audit rows produced by automated test runs (test members / test books,
 *      and every other event logged in the same second as one of those rows, plus
 *      "login + action in the same second" automation bursts).
 *   2. Normalises legacy locale timestamps ("10/2/2026, 9:35:11 PM") to "YYYY-MM-DD HH:MM:SS".
 *   3. Repairs "(undefined)" role text and member names that were stored as raw member IDs.
 *   4. Creates the lookup indexes used by the Audit page.
 */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'lumina_library.db');
const APPLY = process.argv.includes('--apply');

const TEST_MEMBER_IDS = new Set(['MEM-2118', 'MEM-9562', 'MEM-3107', 'MEM-5376']);
const TEST_BOOK_TITLES = new Set([
  'E2E Testing Node.js Applications',
  'Full Stack Integration Testing',
  'Advanced Quantum Algorithms 2026',
  'Deep Learning for PyTorch'
]);
const TEST_NAME_RE = /^(test patron|integration test scholar)$/i;

const db = new sqlite3.Database(DB_PATH);
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
const p2 = n => String(n).padStart(2, '0');

function normalizeTs(ts) {
  const t = String(ts || '');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let hh = parseInt(m[4], 10);
  if (m[7]) {
    const pm = m[7].toUpperCase() === 'PM';
    if (pm && hh < 12) hh += 12;
    if (!pm && hh === 12) hh = 0;
  }
  return `${m[3]}-${p2(m[1])}-${p2(m[2])} ${p2(hh)}:${m[5]}:${p2(m[6] || 0)}`;
}

(async () => {
  const rows = await all('SELECT rowid AS rid, * FROM history ORDER BY rowid');
  const members = Object.fromEntries((await all('SELECT member_id, name FROM members')).map(m => [m.member_id, m.name]));
  const bucket = r => normalizeTs(r.timestamp) || r.timestamp;

  const isTestRow = r =>
    TEST_MEMBER_IDS.has(r.member_id) || TEST_BOOK_TITLES.has(r.book_title) ||
    TEST_NAME_RE.test(r.member_name || '') || /test settlement|fine settlement test/i.test(r.description || '');

  const remove = new Set(rows.filter(isTestRow).map(r => r.rid));

  // every row logged in the same second as a test row belongs to the same automated run
  const testSeconds = new Set(rows.filter(r => remove.has(r.rid)).map(bucket));
  rows.forEach(r => { if (testSeconds.has(bucket(r))) remove.add(r.rid); });

  // automation signature: a LOGIN and another action inside the same second
  const bySecond = {};
  rows.forEach(r => (bySecond[bucket(r)] = bySecond[bucket(r)] || []).push(r));
  Object.values(bySecond).forEach(g => {
    if (g.length > 1 && g.some(r => r.action === 'LOGIN')) g.forEach(r => remove.add(r.rid));
  });

  const keep = rows.filter(r => !remove.has(r.rid));
  console.log(`DB: ${DB_PATH}`);
  console.log(`Audit rows: ${rows.length} total -> ${remove.size} test-run rows to remove, ${keep.length} genuine rows kept`);
  keep.forEach(r => console.log(`  keep  ${bucket(r)} | ${r.action} | ${r.member_name} | ${String(r.description).slice(0, 70)}`));

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to modify the database.');
    return db.close();
  }

  const backup = `${DB_PATH}.audit-backup-${Date.now()}`;
  fs.copyFileSync(DB_PATH, backup);
  console.log(`\nBackup written: ${backup}`);

  await run('BEGIN');
  try {
    for (const rid of remove) await run('DELETE FROM history WHERE rowid = ?', [rid]);

    let tsFixed = 0, textFixed = 0, nameFixed = 0;
    for (const r of keep) {
      const fixedTs = normalizeTs(r.timestamp);
      if (fixedTs && fixedTs !== r.timestamp) { await run('UPDATE history SET timestamp = ? WHERE rowid = ?', [fixedTs, r.rid]); tsFixed++; }
      if (/\(undefined\)/.test(r.description)) {
        await run('UPDATE history SET description = REPLACE(description, "(undefined)", "(Student)") WHERE rowid = ?', [r.rid]); textFixed++;
      }
      if (r.member_name === r.member_id && members[r.member_id]) {
        await run('UPDATE history SET member_name = ? WHERE rowid = ?', [members[r.member_id], r.rid]); nameFixed++;
      }
    }
    await run('CREATE INDEX IF NOT EXISTS idx_history_module ON history(module)');
    await run('CREATE INDEX IF NOT EXISTS idx_history_action ON history(action)');
    await run('CREATE INDEX IF NOT EXISTS idx_history_ts ON history(timestamp)');
    await run('COMMIT');
    console.log(`Removed ${remove.size} rows | timestamps normalised: ${tsFixed} | text repaired: ${textFixed} | names repaired: ${nameFixed}`);
  } catch (e) {
    await run('ROLLBACK');
    console.error('Clean-up failed, rolled back:', e.message);
    process.exitCode = 1;
  }
  db.close();
})();
