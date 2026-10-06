/**
 * Builds a throw-away DEMO database for the automated tests (never touches your real data):
 * a fresh database (default seed) + the 50-book rich demo catalog from seed-rich-dataset.js.
 *
 *   node server/test-support/build-test-db.js /tmp/test.db
 *   const { buildTestDb } = require('./test-support/build-test-db')
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..');

async function buildTestDb(dest) {
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  const port = 5200 + Math.floor(Math.random() * 600);
  const env = { ...process.env, DATABASE_PATH: dest, PORT: String(port), HOST: '127.0.0.1', ANTHROPIC_API_KEY: '' };

  // 1. start the real server once so it creates + seeds a fresh database, then stop it
  const child = spawn('node', [path.join(SERVER_DIR, 'server-complete.js')], { env, stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((res, rej) => {
    child.stdout.on('data', d => String(d).includes('Running') && res());
    child.on('exit', c => rej(new Error('server exited early: ' + c)));
    setTimeout(() => rej(new Error('server start timeout')), 20000);
  });
  child.removeAllListeners('exit');
  child.kill();
  await new Promise(r => setTimeout(r, 400));

  // 2. add the rich demo catalog
  const seeded = spawnSync('node', [path.join(SERVER_DIR, 'seed-rich-dataset.js')], { env, encoding: 'utf8', timeout: 60000 });
  if (seeded.status !== 0) throw new Error('rich seed failed: ' + (seeded.stderr || seeded.stdout).slice(0, 300));
  return dest;
}

module.exports = { buildTestDb };

if (require.main === module) {
  const dest = process.argv[2];
  if (!dest) { console.error('usage: node build-test-db.js <destination.db>'); process.exit(1); }
  buildTestDb(path.resolve(dest)).then(() => console.log('test database ready: ' + dest)).catch(e => { console.error(e.message); process.exit(1); });
}
