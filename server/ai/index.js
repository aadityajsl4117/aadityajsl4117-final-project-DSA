/**
 * Lumina AI Assistant - routes + orchestration.
 *
 *   browser chat -> POST /api/ai/query
 *     -> session memory + intent detection
 *     -> Claude (tool use)  [or basic mode if Claude is unavailable, clearly labelled]
 *     -> READ-ONLY library tools -> live SQLite
 *     -> natural reply + live book cards
 *   state changes: tool only PROPOSES -> user confirms -> POST /api/ai/confirm -> verified write
 */
const S = require('./search');
const { getSession, resetSession, remember, takePending, _sessions } = require('./session');
const { detectIntent, isAffirmative, isNegative } = require('./intent');
const { userFromReq, executeAction } = require('./tools');
const claude = require('./claude');
const { basicTurn } = require('./fallback');
const { verifyStockClaims, verifyListedTitles } = require('./guard');

const MSG_MAX = 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = parseInt(process.env.AI_RATE_MAX) || 30;   // messages per minute per chat session
const rate = new Map();

function rateLimited(key) {
  const now = Date.now();
  const arr = (rate.get(key) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rate.set(key, arr);
  if (rate.size > 2000) for (const [k, v] of rate) if (!v.some(t => now - t < RATE_WINDOW_MS)) rate.delete(k);
  return arr.length > RATE_MAX;
}

const SOCIAL = {
  GREETING: (core) => /how are|what'?s up|wassup|kaise|haal/.test(core)
    ? "I'm doing great, thanks for asking! 😊 I can help you find books, check availability and answer library questions. What are you looking for?"
    : "Hi! 👋 I'm your Lumina Library assistant. I can help you find books, check availability, explain books, and answer library questions.",
  THANKS: () => "You're welcome! 😊 Anything else I can help you find?",
  GOODBYE: () => 'Goodbye! Have a great day! 👋'
};

const QUICK = {
  list: ['Which are available?', 'Tell me about the first one', 'Show another'],
  single: ['Can I borrow it?', 'Something similar', 'Show another'],
  start: ['Show me programming books', 'Is Clean Code available?', 'What can you do?']
};

function mapCard(b) {
  return {
    bookID: b.bookID, title: b.title, author: b.author, category: b.category,
    available: b.available, copies: b.copies, issued: b.issued, stockStatus: b.stockStatus,
    shelf: b.shelf, coverUrl: b.coverUrl
  };
}

function isDbError(err) {
  return !!err && (/^SQLITE/.test(String(err.code || '')) || /SQLITE|database/i.test(String(err.message || '')));
}

function claudeErrorLabel(e) {
  if (!e) return 'unknown';
  if (e.timeout) return 'timeout';
  if (e.status) return `http_${e.status}`;
  return 'network';
}

/** Pick the cards to show under a Claude reply: books it actually mentions, in the order they appear */
function cardsFromReply(text, seenMap) {
  const t = S.normalize(text);
  const hits = [];
  for (const b of seenMap.values()) {
    const nt = S.normalize(b.title);
    const idx = nt ? t.indexOf(nt) : -1;
    if (idx >= 0) hits.push({ b, idx });
  }
  hits.sort((x, y) => x.idx - y.idx);
  return hits.slice(0, 6).map(h => h.b.bookID);
}

function register(app, { db, logAudit }) {
  const deps = { logAudit };

  app.get('/api/ai/status', (req, res) => res.json({ success: true, ...claude.publicStatus(), mode: claude.isConfigured() ? 'claude' : 'basic' }));

  app.post('/api/ai/reset', (req, res) => {
    resetSession((req.body || {}).sessionId);
    res.json({ success: true });
  });

  async function runConfirmed(session, token, user) {
    const taken = takePending(session, token, user ? user.username : null);
    if (taken.error) return { ok: false, message: taken.error, expired: true };
    return executeAction(db, taken.action, user, deps);
  }

  // ---- explicit confirmation from the chat button ----
  app.post('/api/ai/confirm', async (req, res) => {
    try {
      const { sessionId, token, decision } = req.body || {};
      const user = await userFromReq(db, req);
      if (!user) return res.status(401).json({ success: false, reply: 'Please sign in to do that.' });
      const session = sessionId && _sessions.get(String(sessionId));
      if (!session || !token) return res.status(410).json({ success: false, reply: 'This confirmation has expired. Please ask me again.' });

      if (decision === 'cancel') {
        const t = takePending(session, token, user.username);
        remember(session, 'assistant', 'Okay, I cancelled that — nothing was changed.');
        return res.json({ success: true, cancelled: true, reply: t.error ? t.error : 'Okay, I cancelled that — nothing was changed.' });
      }
      const result = await runConfirmed(session, token, user);
      remember(session, 'assistant', result.message);
      return res.status(result.expired ? 410 : 200).json({ success: !!result.ok, reply: result.message, verified: !!result.verified, refresh: !!result.refresh, position: result.position, requestID: result.requestID });
    } catch (err) {
      console.error('AI confirm error:', err);
      return res.status(500).json({ success: false, reply: "I couldn't complete that action because the library system did not confirm it." });
    }
  });

  // ---- chat turn ----
  app.post('/api/ai/query', async (req, res) => {
    try {
      const body = req.body || {};
      const message = String(body.query == null ? '' : body.query).trim();
      if (!message) return res.status(400).json({ success: false, error: 'Query prompt is required' });
      if (message.length > MSG_MAX) return res.status(400).json({ success: false, error: `Please keep messages under ${MSG_MAX} characters.`, reply: `Please keep messages under ${MSG_MAX} characters.` });

      const context = body.context && typeof body.context === 'object' ? body.context : {};
      const session = getSession(body.sessionId || context.sessionId, context);
      if (rateLimited(session.id)) {
        return res.status(429).json({ success: false, error: 'Too many messages', reply: "You're sending messages very quickly — give me a moment and try again." });
      }
      const user = await userFromReq(db, req);
      session.turn += 1;

      const det = detectIntent(message, { hasShown: session.shown.length > 0, hasFocus: !!session.focus });
      const ctx = { session, user, seen: new Map(), proposals: [], focus: null, lastSearch: null, member: null };
      const respond = (payload) => {
        const ctxState = {
          sessionId: session.id, lastBookID: session.focus, shownBookIDs: session.shown,
          awaitingConfirmation: payload.pendingAction ? payload.pendingAction.type : null,
          lastAction: det.intent, lastQuery: message
        };
        return res.json({ success: true, sessionId: session.id, intent: det.intent, suggestedActions: [], ...payload, context: ctxState });
      };

      // 1. typed yes/no to a proposal made in the immediately previous turn
      const open = [...session.pending.values()].filter(a => a.createdTurn === session.turn - 1);
      if (open.length === 1 && isAffirmative(det.core) && user) {
        const result = await runConfirmed(session, open[0].token, user);
        remember(session, 'user', message); remember(session, 'assistant', result.message);
        return respond({ reply: result.message, books: [], mode: 'action', actionResult: { success: !!result.ok, verified: !!result.verified, refresh: !!result.refresh }, quickReplies: [] });
      }
      if (open.length && isNegative(det.core)) {
        open.forEach(a => session.pending.delete(a.token));
        const reply = 'No problem — nothing was changed. Anything else I can help with?';
        remember(session, 'user', message); remember(session, 'assistant', reply);
        return respond({ reply, books: [], mode: 'basic', quickReplies: QUICK.start });
      }

      // 2. pure social messages never touch the catalog or cost an API call
      if (SOCIAL[det.intent]) {
        const reply = SOCIAL[det.intent](det.core);
        remember(session, 'user', message); remember(session, 'assistant', reply);
        return respond({ reply, books: [], mode: 'social', quickReplies: det.intent === 'GREETING' ? QUICK.start : [] });
      }

      // 3. real conversation: Claude with tools, else honest basic mode
      let replyText = '';
      let showIDs = [];
      let pending = null;
      let mode = 'basic';
      let notice = null;
      let corrections = [];
      let removedTitles = [];
      let toolCalls = [];
      let claudeError;

      if (claude.isConfigured()) {
        try {
          const booksShown = await S.getBooksByIDs(db, session.shown);
          const turn = await claude.runClaudeTurn({ db, message, session, user, ctx, booksShown, intent: det.intent });
          mode = 'claude';
          toolCalls = turn.toolCalls;
          const titles = await verifyListedTitles(turn.text, ctx.seen, db);   // drop any listed title that isn't in the catalog
          titles.extra.forEach(b => ctx.seen.set(b.bookID, b));
          const verified = verifyStockClaims(titles.text, [...ctx.seen.values()]);
          replyText = verified.text;
          corrections = verified.corrected;
          removedTitles = titles.removed;
          showIDs = cardsFromReply(replyText, ctx.seen);
          pending = ctx.proposals[ctx.proposals.length - 1] || null;
        } catch (err) {
          claudeError = claudeErrorLabel(err);
          console.warn('Claude unavailable, using basic mode:', claudeError, err.detail || err.message);
          notice = 'Claude is unavailable right now, so I answered in basic mode (still using the live library database).';
        }
      }

      if (mode !== 'claude') {
        const out = await basicTurn({ db, det, message, session, ctx });
        replyText = out.reply; showIDs = out.showIDs; pending = out.pending || null;
        if (!claude.isConfigured()) notice = null;
      }

      // 4. cards always carry LIVE stock (re-read now), and deleted books drop out
      const live = await S.getBooksByIDs(db, showIDs);
      if (mode === 'claude') {
        if (live.length) { session.shown = live.map(b => b.bookID); live.forEach(b => { if (!session.seen.includes(b.bookID)) session.seen.push(b.bookID); }); }
        if (ctx.focus && live.find(b => b.bookID === ctx.focus)) session.focus = ctx.focus;
        else if (live.length === 1) session.focus = live[0].bookID;
        else if (live.length > 1) session.focus = null;
        if (ctx.lastSearch) session.lastSearch = ctx.lastSearch;
        if (ctx.member) session.member = ctx.member;
      }

      remember(session, 'user', message);
      remember(session, 'assistant', replyText);

      const quick = pending ? [] : (live.length > 1 ? QUICK.list : live.length === 1 ? QUICK.single : []);
      return respond({
        reply: replyText,
        books: live.map(mapCard),
        pendingAction: pending ? { token: pending.token, type: pending.type, summary: pending.summary, confirmLabel: pending.confirmLabel } : null,
        mode, notice, quickReplies: quick,
        ...(claudeError ? { claudeError } : {}),
        ...(process.env.AI_DEBUG ? { debug: { toolCalls, corrections, removedTitles } } : {})
      });
    } catch (err) {
      console.error('AI Query Error:', err);
      if (isDbError(err)) {
        return res.status(503).json({ success: false, error: 'Library database unavailable', reply: "I can't access the live library catalog right now." });
      }
      return res.status(500).json({ success: false, error: 'AI Assistant query processing failed', reply: "Sorry, I couldn't complete that request right now." });
    }
  });
}

module.exports = { register };
