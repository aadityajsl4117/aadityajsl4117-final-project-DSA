/**
 * Short-term conversation memory (in-memory, expires, bounded).
 * Holds ONLY conversational state — ids of books that were shown, the current focus,
 * recent turns and pending (unconfirmed) actions. Library facts are never stored here;
 * they are re-read from the database on every use.
 */
const crypto = require('crypto');

const TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 500;
const MAX_TURNS = 14;          // messages kept for Claude (7 exchanges)
const PENDING_TTL_MS = 10 * 60 * 1000;

const sessions = new Map();

function prune() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.touched > TTL_MS) sessions.delete(id);
  if (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.values()].sort((a, b) => a.touched - b.touched).slice(0, sessions.size - MAX_SESSIONS);
    oldest.forEach(s => sessions.delete(s.id));
  }
}

function newSession(id) {
  return {
    id: id || crypto.randomBytes(12).toString('hex'),
    touched: Date.now(),
    turn: 0,
    history: [],            // [{role:'user'|'assistant', content:string}]
    shown: [],              // book ids from the latest list, in the order the user saw them
    focus: null,            // book id the conversation is currently about
    lastSearch: null,       // {query, category, author, availableOnly} for "show another"
    seen: [],               // every book id ever shown (to avoid repeating on "another")
    member: null,           // member id the user identified (for loans / fines)
    awaiting: null,         // {type:'MEMBER_FOR_WAITLIST', bookID, turn}
    pending: new Map()      // token -> action
  };
}

function getSession(id, restore) {
  prune();
  let s = id && /^[a-f0-9]{8,64}$/i.test(String(id)) ? sessions.get(String(id)) : null;
  if (!s) {
    s = newSession(id && /^[a-f0-9]{8,64}$/i.test(String(id)) ? String(id) : null);
    // restore minimal state sent back by the client after a server restart / expiry
    if (restore && typeof restore === 'object') {
      if (Array.isArray(restore.shownBookIDs)) s.shown = restore.shownBookIDs.map(Number).filter(Boolean).slice(0, 20);
      if (restore.lastBookID) s.focus = Number(restore.lastBookID) || null;
      s.seen = [...s.shown];
    }
    sessions.set(s.id, s);
  }
  s.touched = Date.now();
  return s;
}

function resetSession(id) { if (id) sessions.delete(String(id)); }

function remember(session, role, content) {
  session.history.push({ role, content: String(content).slice(0, 4000) });
  while (session.history.length > MAX_TURNS) session.history.shift();
}

function addPending(session, action, userKey) {
  for (const [t, a] of session.pending) if (Date.now() - a.createdAt > PENDING_TTL_MS) session.pending.delete(t);
  // only one open proposal of the same kind for the same target at a time (duplicate-click protection)
  for (const [t, a] of session.pending) if (a.dedupeKey === action.dedupeKey) session.pending.delete(t);
  const token = crypto.randomBytes(16).toString('hex');
  session.pending.set(token, { ...action, token, user: userKey, createdAt: Date.now(), createdTurn: session.turn });
  return token;
}

function takePending(session, token, userKey) {
  const a = session.pending.get(token);
  if (!a) return { error: 'This confirmation has expired or was already used.' };
  if (Date.now() - a.createdAt > PENDING_TTL_MS) { session.pending.delete(token); return { error: 'This confirmation has expired. Please ask me again.' }; }
  if (a.user !== userKey) return { error: 'This confirmation belongs to a different user.' };
  session.pending.delete(token); // single use
  return { action: a };
}

module.exports = { getSession, resetSession, remember, addPending, takePending, _sessions: sessions };
