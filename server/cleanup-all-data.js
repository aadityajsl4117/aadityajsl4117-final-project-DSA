/**
 * Wipe ALL library data except the book catalog, so you can start entering your own data.
 *
 *   node server/cleanup-all-data.js              dry run: shows exactly what would happen, changes nothing
 *   node server/cleanup-all-data.js --apply      makes a backup copy of the database, then cleans it
 *
 * KEPT
 *   - books            every catalog record, untouched (title, author, category, ISBN, publisher, year,
 *                      copies, shelf, cover). Proven by a before/after checksum.
 *   - users            the sign-in accounts (admin, librarian ...). Deleting them would lock you out.
 *   - system_config    the "already initialised" marker. Without it the server would re-create its demo
 *                      data the next time it starts.
 *
 * DELETED (every other table, found automatically - so tables added in future are covered too)
 *   members, loans, payments, deposits, waiting_list, book_requests, feedbacks, emails, notifications,
 *   history (audit log) ...
 *
 * BOOK COUNTERS that only make sense together with the deleted loans are reset:
 *   available_copies -> equals total copies (nothing is on loan any more)
 *   borrow_count     -> 0   (use --keep-borrow-counts to leave the old numbers)
 *
 * Database file: $DATABASE_PATH, or server/lumina_library.db.  Stop the server before running with --apply.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

const DB_PATH = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, 'lumina_library.db');
const APPLY = process.argv.includes('--apply');
const KEEP_BORROW_COUNTS = process.argv.includes('--keep-borrow-counts');
const backupArg = process.argv.find(a => a.startsWith('--backup-dir='));
const BACKUP_DIR = backupArg ? path.resolve(backupArg.split('=')[1]) : path.dirname(DB_PATH);

const KEEP_TABLES = ['books', 'users', 'system_config'];

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
const q = (name) => '"' + name.replace(/"/g, '""') + '"';

async function bookChecksum() {
  const rows = await all('SELECT book_id, title, author, category, isbn, publisher, year, copies, shelf, cover_url FROM books ORDER BY book_id');
  return { count: rows.length, hash: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
}

(async () => {
  const tables = (await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map(t => t.name);
  const missing = KEEP_TABLES.filter(t => !tables.includes(t));
  if (missing.includes('books')) { console.error('No books table found - refusing to continue.'); process.exit(1); }
  const wipe = tables.filter(t => !KEEP_TABLES.includes(t));

  const counts = {};
  for (const t of tables) counts[t] = (await get(`SELECT COUNT(*) AS c FROM ${q(t)}`)).c;
  const stock = await get('SELECT COUNT(*) AS c FROM books WHERE available_copies != copies');
  const bc = await get('SELECT COALESCE(SUM(borrow_count),0) AS s, COUNT(CASE WHEN borrow_count > 0 THEN 1 END) AS n FROM books');
  const before = await bookChecksum();

  console.log(`Database: ${DB_PATH}\n`);
  console.log('KEEP');
  KEEP_TABLES.filter(t => tables.includes(t)).forEach(t => console.log(`  ${t.padEnd(16)} ${String(counts[t]).padStart(5)} rows  (kept)`));
  console.log('\nDELETE');
  wipe.forEach(t => console.log(`  ${t.padEnd(16)} ${String(counts[t]).padStart(5)} rows  -> 0`));
  console.log('\nBOOK COUNTERS');
  console.log(`  available_copies reset to total copies on ${stock.c} book(s) (nothing is on loan after the clean-up)`);
  console.log(KEEP_BORROW_COUNTS
    ? `  borrow_count kept as it is (${bc.s} lifetime borrows across ${bc.n} books)`
    : `  borrow_count reset to 0 on ${bc.n} book(s) (${bc.s} lifetime borrows were counted from the loans being deleted)`);
  console.log(`\nBook catalog: ${before.count} titles, checksum ${before.hash.slice(0, 16)}…`);

  if (!APPLY) {
    console.log('\nDRY RUN - nothing was changed.  Re-run with --apply to clean the database (a backup is made first).');
    db.close();
    return;
  }

  // ---- backup ----
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = path.join(BACKUP_DIR, `${path.basename(DB_PATH)}.BEFORE-CLEANUP-${stamp}`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  await run('PRAGMA wal_checkpoint(TRUNCATE)').catch(() => {});
  fs.copyFileSync(DB_PATH, backup);
  console.log(`\nBackup saved: ${backup}`);

  // ---- clean (one transaction: all or nothing) ----
  await run('PRAGMA foreign_keys = OFF');
  await run('BEGIN IMMEDIATE');
  try {
    for (const t of wipe) await run(`DELETE FROM ${q(t)}`);
    await run('UPDATE books SET available_copies = copies');
    if (!KEEP_BORROW_COUNTS) await run('UPDATE books SET borrow_count = 0');
    // restart auto-numbering for the wiped tables ("users" keeps its numbering)
    const hasSeq = (await all("SELECT name FROM sqlite_master WHERE name = 'sqlite_sequence'")).length > 0;
    if (hasSeq) for (const t of wipe) await run('DELETE FROM sqlite_sequence WHERE name = ?', [t]);

    // ---- verify BEFORE committing; any surprise rolls everything back ----
    const after = await bookChecksum();
    if (after.count !== before.count || after.hash !== before.hash) throw new Error('Book catalog changed unexpectedly - rolling back');
    for (const t of wipe) {
      const c = (await get(`SELECT COUNT(*) AS c FROM ${q(t)}`)).c;
      if (c !== 0) throw new Error(`Table ${t} still has ${c} rows - rolling back`);
    }
    const bad = await get('SELECT COUNT(*) AS c FROM books WHERE available_copies != copies');
    if (bad.c !== 0) throw new Error('Stock counters inconsistent - rolling back');
    const fk = await all('PRAGMA foreign_key_check');
    if (fk.length) throw new Error(`Foreign key problems: ${JSON.stringify(fk.slice(0, 3))} - rolling back`);
    await run('COMMIT');
  } catch (e) {
    await run('ROLLBACK').catch(() => {});
    console.error(`\nClean-up FAILED and was rolled back - your data is unchanged.\n  ${e.message}`);
    db.close();
    process.exit(1);
  }
  await run('PRAGMA foreign_keys = ON');
  await run('VACUUM').catch(() => {});   // actually release the deleted data from the file

  const final = await bookChecksum();
  console.log('\nDONE');
  console.log(`  Books kept:     ${final.count} titles (checksum identical: ${final.hash === before.hash ? 'YES' : 'NO'})`);
  console.log(`  Tables emptied: ${wipe.join(', ')}`);
  console.log(`  Sign-in accounts kept: ${counts.users || 0}`);
  console.log(`\nTo undo: stop the server and copy the backup file back over ${path.basename(DB_PATH)}.`);
  db.close();
})().catch(e => { console.error('Unexpected error:', e); process.exit(1); });
