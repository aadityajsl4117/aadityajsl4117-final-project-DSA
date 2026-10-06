/**
 * BASIC MODE engine - used only when Claude is not configured or temporarily unreachable.
 * It is deliberately honest and small: intent + reference resolution (it / the second one /
 * another / similar) on top of the SAME grounded tools Claude uses. No catalog data lives
 * here, nothing is invented, and every number comes from a live database read.
 */
const S = require('./search');
const { runTool, POLICY, findMember } = require('./tools');
const { resolveReference } = require('./intent');

const stockPhrase = (b) => b.available > 0
  ? `AVAILABLE — ${b.available} ${b.available === 1 ? 'copy' : 'copies'} in stock`
  : 'OUT OF STOCK';

function setShown(session, books) {
  session.shown = books.map(b => b.bookID);
  books.forEach(b => { if (!session.seen.includes(b.bookID)) session.seen.push(b.bookID); });
  if (session.seen.length > 60) session.seen = session.seen.slice(-60);
}

/** Focus one book without throwing away the list it came from ("what about the first one?" must still work) */
function focusBook(session, bookID) {
  session.focus = bookID;
  if (!session.shown.includes(bookID)) session.shown = [bookID];
}

function listLines(books) {
  return books.map((b, i) => `${i + 1}. **${b.title}** — ${b.author}\n   ${stockPhrase(b)}`).join('\n');
}

const INTENT_WORDS = /\b(tell me (more )?about|more (info|information|details) (about|on)|details? (of|about|on)|info (on|about)|describe|who (wrote|is the author of)|author of|publisher of|isbn of|which shelf|where (is|can i find)|is|are|was|available|availability|in stock|out of stock|do you (still )?have|have you got|copies? of|how many copies|can i (borrow|get|have|take|issue)|borrow|issue|check ?out|take home|show me|about|books? like|similar to|more like|similar|something|alternatives?|related|same (kind|type|topic)|join|put|enrol+l?|reserve|hold|queue|list|waitlist|sign up|yes|no|what|happens?|happen|if|then|out of stock|out|of|so|not|add|to|the|waiting list|waitlist|please|for|me|a|an|any|now|right now|currently|still)\b/g;

function titleRemainder(det) {
  let t = det.core;
  t = t.replace(/\b(the )?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|final|other|same|number \d|no\.? ?\d|#\d)( one| book)?\b/g, ' ');
  t = t.replace(/\b(it|this|that|these|those|one|ones|this book|that book)\b/g, ' ');
  t = t.replace(INTENT_WORDS, ' ');
  return S.extractTerms(t.replace(/\s+/g, ' ').trim());
}

/** remove a member's name / id from the sentence so only the BOOK title is left */
async function detWithoutMember(db, det, message) {
  const idm = String(message).match(/\b([A-Za-z]{2,4}-\d{2,6})\b/);
  let memberID = idm ? idm[1] : await memberNamedInText(db, message);
  if (!memberID) return det;
  const m = await db.getOne('SELECT member_id, name FROM members WHERE LOWER(member_id) = LOWER(?)', [memberID]);
  if (!m) return det;
  let core = det.core.replace(new RegExp(m.member_id.toLowerCase().replace(/[-]/g, '[- ]'), 'g'), ' ');
  for (const part of S.normalize(m.name).split(' ')) {
    if (part.length >= 2) core = core.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ');
  }
  return { ...det, core: core.replace(/\s+/g, ' ').trim() };
}

/** Work out which book the user means: explicit title > ordinal > pronoun/focus */
async function resolveTarget(db, det, session, ctx, opts = {}) {
  const rem = titleRemainder(det);
  if (rem.fullTokens.length) {
    const r = await S.resolveTitle(db, rem.fullPhrase);
    if (r.book) return { book: r.book };
    if (r.candidates.length > 1) {
      setShown(session, r.candidates.slice(0, 4));
      return { ask: `Do you mean ${r.candidates.slice(0, 4).map(b => `**${b.title}**`).join(' or ')}?`, candidates: r.candidates.slice(0, 4) };
    }
    // typo repair via search
    const res = await S.searchBooks(db, { query: rem.fullPhrase, limit: 3 });
    // only trust a spelling repair if the repaired words really appear in the TITLE
    const inTitle = (b) => res.correctedQuery && res.correctedQuery.split(' ').every(w => S.normalize(b.title).includes(w));
    const titled = res.books.filter(inTitle);
    if (titled.length === 1) return { book: titled[0] };
    if (titled.length > 1) {
      setShown(session, titled);
      return { ask: `Did you mean ${titled.map(b => `**${b.title}**`).join(' or ')}?`, candidates: titled };
    }
    return { notFound: rem.fullPhrase };
  }
  const ref = resolveReference(det, session);
  if (ref.bookID) {
    const b = await S.getBookByID(db, ref.bookID);       // live read: may have been deleted meanwhile
    return b ? { book: b } : { gone: true };
  }
  if (ref.how === 'ordinal-out-of-range') return { ask: `I only showed ${session.shown.length} book${session.shown.length === 1 ? '' : 's'}, so there's no number ${det.ordinal}. Which one do you mean?` };
  if (ref.ambiguous.length) {
    const books = await S.getBooksByIDs(db, ref.ambiguous);
    return { ask: `Which one do you mean — ${books.map(b => `**${b.title}**`).join(' or ')}?`, candidates: books };
  }
  if (opts.allowFocus && session.focus) {
    const b = await S.getBookByID(db, session.focus);
    if (b) return { book: b };
  }
  return { none: true };
}

function targetProblem(t) {
  if (t.ask) return t.ask;
  if (t.notFound) return `I couldn't find a book called "${t.notFound}" in the library system. Want me to search the catalog for something close?`;
  if (t.gone) return "That book is no longer in the library catalog, so I can't use it.";
  return null;
}

/* ------------------------------ member helpers ------------------------------ */

function memberRefFromText(message) {
  const id = String(message).match(/\b([A-Za-z]{2,4}-\d{2,6})\b/);
  if (id) return id[1];
  const email = String(message).match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) return email[0];
  const nm = String(message).match(/\b(?:for|of|about|member|named|called)\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3})\s*[?.!]*$/i);
  if (nm && !/^(me|my|myself|it|this|that|the|them|him|her|a|an)$/i.test(nm[1].trim())) return nm[1].trim();
  return null;
}

/** A member whose full name (or first + last name) is written in the message */
async function memberNamedInText(db, message) {
  const text = S.normalize(message);
  const rows = await db.query("SELECT member_id, name FROM members WHERE COALESCE(status,'ACTIVE') != 'INACTIVE'");
  const hits = rows.filter(r => {
    const n = S.normalize(r.name).replace(/^(dr|prof|mr|mrs|ms)\.? /, '');
    if (!n) return false;
    if (text.includes(n)) return true;
    const parts = n.split(' ').filter(Boolean);
    return parts.length >= 2 && text.includes(parts[0]) && text.includes(parts[parts.length - 1]);
  });
  return hits.length === 1 ? hits[0].member_id : null;
}

/**
 * Who is the user asking about?  explicit ID/email > a name in the sentence >
 * (self, for a signed-in non-staff user) > remembered member (not for "my ..." from staff).
 */
async function defaultMemberRef(db, ctx, session, message) {
  const explicit = String(message).match(/\b([A-Za-z]{2,4}-\d{2,6})\b/) || String(message).match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (explicit) return explicit[1] || explicit[0];
  const named = await memberNamedInText(db, message);
  if (named) return named;
  const fromText = memberRefFromText(message);
  if (fromText) return fromText;
  const staff = ctx.user && ['ADMIN', 'LIBRARIAN'].includes(ctx.user.role);
  if (ctx.user && !staff && ctx.user.email) {
    const m = await db.getOne('SELECT member_id FROM members WHERE LOWER(email) = LOWER(?)', [ctx.user.email]);
    if (m) return m.member_id;
  }
  // staff saying "my loans" are not a library member - never guess
  if (staff && /\b(my|mine|i have|i owe|i borrowed)\b/i.test(message)) return null;
  return session.member || null;
}

function memberProblem(r) {
  if (r.ambiguous) return `I found a few members called that — which one? ${r.ambiguous.map(m => `${m.name} (${m.memberID})`).join(', ')}`;
  if (r.code === 'NOT_SIGNED_IN') return 'Please sign in first, then I can look that up.';
  if (r.code === 'FORBIDDEN') return "I can't show that — you're not permitted to view that member's information.";
  return r.error || null;
}

/* ------------------------------ the engine ------------------------------ */

async function basicTurn({ db, det, message, session, ctx }) {
  const out = { reply: '', showIDs: [], actions: [] };
  const say = (t) => { out.reply = t; return out; };
  const showBooks = (books) => { out.showIDs = books.map(b => b.bookID); };

  // Answer to "which member?" from the previous turn - only if the reply really names a member
  if (session.awaiting && session.awaiting.turn === session.turn - 1 && session.awaiting.type === 'MEMBER_FOR') {
    const aw = session.awaiting;
    session.awaiting = null;
    const explicit = String(message).match(/\b([A-Za-z]{2,4}-\d{2,6})\b/);
    const named = explicit ? explicit[1] : await memberNamedInText(db, message);
    const shortReply = message.trim().split(/\s+/).length <= 4 && ['BOOK_SEARCH', 'UNKNOWN'].includes(det.intent);
    // a sentence with its own clear intent (deposit, loans, fines...) is a NEW question, not an answer
    const bare = ['BOOK_SEARCH', 'UNKNOWN'].includes(det.intent);
    const ref = bare ? (named || (shortReply ? message.trim() : null)) : null;
    if (ref) return memberFlow(db, aw.intent, ref, aw, session, ctx, out);
    // otherwise it was a new question: fall through and answer it normally
  }
  if (session.awaiting && session.awaiting.type === 'OFFER_WAITLIST' && session.awaiting.turn === session.turn - 1) {
    const aw = session.awaiting;
    session.awaiting = null;
    if (/^(yes|yeah|yep|sure|ok|okay|please|yes please|go ahead|do it|haan|ha)\b/.test(det.core) || det.wantsAction) {
      det = { ...det, intent: 'WAITING_LIST', wantsAction: true };
      session.focus = aw.bookID;
      session.shown = [aw.bookID];
    }
  }

  if (det.intent === 'UNKNOWN' && (require('./intent').isAffirmative(det.core) || require('./intent').isNegative(det.core))) {
    return say(/^(no|nope|nah|nahi|no thanks|not now|cancel|never ?mind|skip|stop|don'?t)/.test(det.core)
      ? 'Okay! Anything else I can help you with?'
      : "Happy to — but I'm not sure what you're saying yes to. What would you like me to look up or do?");
  }

  switch (det.intent) {
    case 'HELP':
      return say("I can help you with the real Lumina catalog:\n• find books by topic, title or author (typos are fine)\n• check live availability and tell you about a book\n• suggest similar books\n• explain loans, fines, deposits and library rules\n• look up a member's loans / fines (if you're allowed to)\n• propose a waiting-list spot or a book request — and only do it after you confirm\n\nTry: \"python books\", \"is Clean Code available?\" or \"something similar\".");

    case 'CATEGORY_SEARCH': {
      const r = await runTool(db, 'list_categories', {}, ctx);
      if (r.error) return say("I can't access the live library catalog right now.");
      return say('Here are the categories currently in the catalog:\n' + r.categories.map(c => `• **${c.category}** — ${c.titles} title${c.titles === 1 ? '' : 's'} (${c.titlesInStock} in stock)`).join('\n') + '\n\nTell me one and I\'ll show you the books.');
    }

    case 'BOOK_SEARCH':
    case 'BOOK_RECOMMENDATION':
    case 'AUTHOR_SEARCH': {
      // "another" / "show more"
      if (det.another) {
        if (session.lastSearch) {
          const wantsOne = /\b(another|one more|next one|different (one|book)|something else)\b/.test(det.core);
          const r = await runTool(db, 'search_books', { ...session.lastSearch, available_only: session.lastSearch.availableOnly, exclude_shown: true, limit: wantsOne ? 1 : 3 }, ctx);
          if (r.error) return say("I can't access the live library catalog right now.");
          if (!r.books.length) return say("That's everything I have for that search — no more matching books in the catalog. Want to try a different topic?");
          setShown(session, r.books); session.focus = r.books.length === 1 ? r.books[0].bookID : null; showBooks(r.books);
          return say(`Here ${r.books.length === 1 ? 'is another one' : 'are a few more'}:\n${listLines(r.books)}\n\nWant details on one of these?`);
        }
        if (session.focus) {
          const r = await runTool(db, 'find_similar_books', { book_id: session.focus, exclude_shown: true, limit: 1 }, ctx);
          if (r.books && r.books.length) { setShown(session, r.books); session.focus = r.books[0].bookID; showBooks(r.books); return say(`Another one in the same area:\n${listLines(r.books)}`); }
        }
        return say('Another what? Tell me a topic or a book and I\'ll find options.');
      }

      const t = S.extractTerms(det.core);
      let authorQ = null;
      if (det.intent === 'AUTHOR_SEARCH') {
        const m = det.core.match(/\b(?:books? by|written by|authored by|author|by)\s+([a-z.' -]+?)\s*$/);
        authorQ = m ? m[1].replace(/\b(books?|please|any|do you have)\b/g, '').trim() : null;
      }
      const queryText = authorQ ? '' : det.core;
      const terms = authorQ ? { tokens: [authorQ] } : t;

      // "recommend something for me" - not enough context -> ask a useful question using REAL categories
      if (!terms.tokens.length && det.intent !== 'AUTHOR_SEARCH') {
        const cats = await runTool(db, 'list_categories', {}, ctx);
        if (cats.error) return say("I can't access the live library catalog right now.");
        const top = cats.categories.slice(0, 6).map(c => c.category).join(', ');
        return say(`Happy to! What are you interested in? Right now the catalog covers: ${top}${cats.categories.length > 6 ? ' and more' : ''}. Pick one, or tell me a topic.`);
      }

      const r = authorQ
        ? await runTool(db, 'search_books', { author: authorQ, limit: 5 }, ctx)
        : await runTool(db, 'search_books', { query: queryText, limit: 5 }, ctx);
      if (r.error) return say("I can't access the live library catalog right now.");
      session.lastSearch = ctx.lastSearch;

      if (!r.books.length) {
        const cats = await runTool(db, 'list_categories', {}, ctx);
        const top = cats.categories ? cats.categories.slice(0, 5).map(c => c.category).join(', ') : '';
        const what = authorQ || terms.tokens.join(' ');
        return say(`I couldn't find any books matching "${what}" in the library catalog.${top ? ` The catalog currently covers: ${top}.` : ''} I can suggest something from one of those, or you can submit a book request.`);
      }
      setShown(session, r.books);
      session.focus = r.books.length === 1 ? r.books[0].bookID : null;
      showBooks(r.books);
      const head = r.correctedSpelling ? `I think you meant "${r.correctedSpelling}". ` : '';
      const lvl = r.note && /difficulty/.test(r.note) ? ' (The catalog has no difficulty levels, so I can\'t filter by beginner/advanced.)' : '';
      let intro = authorQ ? `Books by "${authorQ}" in the catalog` : (det.intent === 'BOOK_RECOMMENDATION' ? 'Here are some picks from the catalog' : `${r.books.length === 1 ? 'I found this book' : 'Here is what I found'}`);

      // asked for a specific title that is not there? say so before showing related books
      if (!authorQ && terms.tokens.length >= 2) {
        const hay = (b) => S.normalize(`${b.title} ${b.category} ${b.author}`);
        const exactish = r.books.some(b => terms.tokens.every(t => hay(b).includes(t)));
        if (!exactish) intro = `I couldn't find "${terms.tokens.join(' ')}" in the catalog, but these related books are`;
      }

      // one hit that is out of stock -> offer the waiting list (never add anyone automatically)
      if (r.books.length === 1 && r.books[0].available <= 0) {
        focusBook(session, r.books[0].bookID);
        session.awaiting = { type: 'OFFER_WAITLIST', bookID: r.books[0].bookID, turn: session.turn };
        return say(`${head}${intro}:${lvl}\n${listLines(r.books)}\n\nIt's currently out of stock. Would you like to join the waiting list? I'll only do that after you confirm.`);
      }
      return say(`${head}${intro}:${lvl}\n${listLines(r.books)}\n\n${r.books.length > 1 ? 'Want details on one, or shall I check which are in stock?' : 'Want more details or something similar?'}`);
    }

    case 'BOOK_DETAILS': {
      const t = await resolveTarget(db, det, session, ctx, { allowFocus: true });
      const problem = targetProblem(t);
      if (problem) return say(problem);
      if (t.none) return say('Which book would you like to know about? Give me a title, or say "the first one" after I show you a list.');
      const r = await runTool(db, 'get_book_details', { book_id: t.book.bookID }, ctx);
      if (r.error) return say(r.error);
      const b = r.book;
      focusBook(session, b.bookID); showBooks([b]);
      const lines = [`**${b.title}**`, `Author: ${b.author}`, `Category: ${b.category}`, `Book ID: #${b.bookID}`];
      if (b.isbn) lines.push(`ISBN: ${b.isbn}`);
      if (b.publisher) lines.push(`Publisher: ${b.publisher}${b.year ? ` (${b.year})` : ''}`);
      if (b.shelf) lines.push(`Shelf: ${b.shelf}`);
      lines.push(`Stock: ${stockPhrase(b)} (${b.copies} total, ${b.issued} issued)`);
      if (r.peopleOnWaitingList) lines.push(`Waiting list: ${r.peopleOnWaitingList} ${r.peopleOnWaitingList === 1 ? 'person' : 'people'} waiting`);
      lines.push('\nThe catalog doesn\'t store a description for this book, so that\'s everything the library system has.');
      return say(lines.join('\n'));
    }

    case 'AVAILABILITY_CHECK': {
      const t = await resolveTarget(db, det, session, ctx);
      if (t.none && (session.shown.length >= 1 || session.focus)) {
        if (!session.shown.length && session.focus) session.shown = [session.focus];
        const r = await runTool(db, 'check_availability', { book_ids: session.shown }, ctx);
        if (r.error) return say("I can't access the live library catalog right now.");
        const live = await S.getBooksByIDs(db, session.shown);
        if (!live.length) return say('Those books are no longer in the catalog.');
        setShown(session, live); showBooks(live);
        const inStock = live.filter(b => b.available > 0);
        const lines = live.map((b, i) => `${i + 1}. **${b.title}** — ${stockPhrase(b)}`).join('\n');
        const summary = inStock.length === 0 ? 'None of them are in stock right now.'
          : inStock.length === live.length ? 'All of them are in stock right now.'
          : `${inStock.length} of ${live.length} ${inStock.length === 1 ? 'is' : 'are'} in stock right now.`;
        if (inStock.length < live.length) {
          const firstOut = live.find(b => b.available <= 0);
          session.awaiting = { type: 'OFFER_WAITLIST', bookID: firstOut.bookID, turn: session.turn };
        }
        return say(`${summary}\n${lines}${inStock.length < live.length ? '\n\nFor any that are out of stock I can add a member to the waiting list — just say which one.' : ''}`);
      }
      const problem = targetProblem(t);
      if (problem) return say(problem);
      if (t.none) return say('Which book should I check? Give me a title, or ask after I show you a list.');
      const r = await runTool(db, 'check_availability', { book_id: t.book.bookID }, ctx);
      const b = (await S.getBookByID(db, t.book.bookID));
      if (r.error || !b) return say("I can't access the live library catalog right now.");
      focusBook(session, b.bookID); showBooks([b]);
      if (b.available > 0) return say(`**${b.title}** is ${stockPhrase(b)}. ✅`);
      session.awaiting = { type: 'OFFER_WAITLIST', bookID: b.bookID, turn: session.turn };
      return say(`**${b.title}** is OUT OF STOCK — all ${b.copies} ${b.copies === 1 ? 'copy is' : 'copies are'} currently issued.\n\nWould you like to add someone to the waiting list? I'll only do it after you confirm.`);
    }

    case 'BORROW_QUESTION': {
      const t = await resolveTarget(db, det, session, ctx, { allowFocus: true });
      const problem = targetProblem(t);
      if (problem) return say(problem);
      if (t.none) return say('Which book would you like to borrow? Give me a title, or pick one from a list I showed.');
      const b = await S.getBookByID(db, t.book.bookID);
      if (!b) return say("That book is no longer in the library catalog.");
      focusBook(session, b.bookID); showBooks([b]);
      if (b.available > 0) {
        return say(`Yes — **${b.title}** is ${stockPhrase(b)}. ✅\nLoans run ${POLICY.loanPeriodDays} days (fine ₹${POLICY.finePerOverdueDayINR}/day if overdue). Library staff can issue it from the Issue/Return screen — use the **Issue Book** button on the card below. I can't issue it from chat.`);
      }
      session.awaiting = { type: 'OFFER_WAITLIST', bookID: b.bookID, turn: session.turn };
      return say(`**${b.title}** is OUT OF STOCK right now, so it can't be issued yet.\nWould you like to join the waiting list? I'll only do that after you confirm.`);
    }

    case 'SIMILAR_BOOKS': {
      const t = await resolveTarget(db, det, session, ctx, { allowFocus: true });
      const problem = targetProblem(t);
      if (problem) return say(problem);
      if (t.none) return say('Similar to which book? Tell me a title, or ask right after I show you one.');
      const repeat = session.lastSimilar === t.book.bookID;
      const r = await runTool(db, 'find_similar_books', { book_id: t.book.bookID, limit: 4, exclude_shown: repeat }, ctx);
      if (r.error) return say(r.error);
      if (!r.books.length) return say(repeat ? `That's all the similar books I have for **${t.book.title}**.` : `I couldn't find other books in the catalog similar to **${t.book.title}**.`);
      session.lastSimilar = t.book.bookID;
      setShown(session, r.books); session.focus = null; showBooks(r.books);
      return say(`If you liked **${r.basedOn.title}**, these in our catalog are close:\n${listLines(r.books)}\n\nWant details on one?`);
    }

    case 'WAITING_LIST': {
      if (!det.wantsAction) {
        const t = await resolveTarget(db, det, session, ctx, { allowFocus: true });
        let extra = '';
        if (t.book) {
          const w = await runTool(db, 'get_waiting_list_status', { book_id: t.book.bookID }, ctx);
          const b = await S.getBookByID(db, t.book.bookID);
          if (b && !w.error) extra = `\n\nRight now **${b.title}** is ${stockPhrase(b)}${b.available <= 0 ? `, with ${w.peopleWaiting} ${w.peopleWaiting === 1 ? 'person' : 'people'} on its waiting list` : ''}.`;
          if (b) { showBooks([b]); }
        }
        return say(`If a book is out of stock, a member can join its waiting list. It's first-in, first-out: when a copy comes back, the person at position 1 gets it next, and everyone behind moves up. Joining never happens automatically — I'll only add someone after you confirm.${extra}`);
      }
      const bookDet = await detWithoutMember(db, det, message);
      const t = await resolveTarget(db, bookDet, session, ctx, { allowFocus: true });
      const problem = targetProblem(t);
      if (problem) return say(problem);
      if (t.none) return say('Which book should the waiting list be for?');
      const b = await S.getBookByID(db, t.book.bookID);
      if (!b) return say('That book is no longer in the catalog.');
      session.focus = b.bookID; showBooks([b]);
      if (b.available > 0) return say(`**${b.title}** has ${b.available} ${b.available === 1 ? 'copy' : 'copies'} available right now, so there's no need for a waiting list — it can be borrowed directly.`);
      return memberFlow(db, 'WAITLIST', await defaultMemberRef(db, ctx, session, message), { bookID: b.bookID }, session, ctx, out);
    }

    case 'BOOK_REQUEST': {
      if (!det.wantsAction && !/\b(request|order|purchase)\b/.test(det.core) || /\b(my requests?|status|pending)\b/.test(det.core)) {
        return memberFlow(db, 'REQUESTS', await defaultMemberRef(db, ctx, session, message), {}, session, ctx, out);
      }
      const q = String(message).match(/["“']([^"”']{2,120})["”']/);
      const m = !q && String(message).match(/\b(?:request|order|purchase|get)\s+(?:a |the |new )?(?:book |title )?(?:called |named |titled )?(.+?)(?:\s+(?:by|for)\s+(.+))?[?.!]*$/i);
      const title = q ? q[1].trim() : (m ? m[1].replace(/\b(please|book|a|the)\b/gi, '').trim() : '');
      const author = !q && m && m[2] && !/^(me|my|member)/i.test(m[2]) ? m[2].trim() : '';
      if (title.length < 2) return say('Sure — what is the title of the book you\'d like the library to get? (You can add the author too.)');
      const exists = await db.getOne('SELECT book_id, title FROM books WHERE LOWER(title) = LOWER(?)', [title]);
      if (exists) return say(`**${exists.title}** is already in the catalog (ID #${exists.book_id}), so a request isn't needed.`);
      return memberFlow(db, 'REQUEST_CREATE', await defaultMemberRef(db, ctx, session, message), { title, author }, session, ctx, out);
    }

    case 'LOAN_STATUS': return memberFlow(db, 'LOANS', await defaultMemberRef(db, ctx, session, message), {}, session, ctx, out);
    case 'FINE_QUESTION': {
      const ref = await defaultMemberRef(db, ctx, session, message);
      if (!ref) {
        return say(`Fines are ₹${POLICY.finePerOverdueDayINR} for every day a book is overdue after its ${POLICY.loanPeriodDays}-day loan period. Tell me a member (name or ID) and I'll look up what they currently owe.`);
      }
      return memberFlow(db, 'FINES', ref, {}, session, ctx, out);
    }
    case 'PAYMENT_QUESTION': return memberFlow(db, 'PAYMENTS', await defaultMemberRef(db, ctx, session, message), {}, session, ctx, out);
    case 'DEPOSIT_QUESTION': {
      const ref = await defaultMemberRef(db, ctx, session, message);
      if (!ref) return say(`External visitors pay a refundable security deposit of ₹${POLICY.externalVisitorSecurityDepositINR} when they borrow, refunded after their books are returned. Tell me a member (name or ID) and I'll check their deposit record.`);
      return memberFlow(db, 'DEPOSITS', ref, {}, session, ctx, out);
    }

    case 'RETURN_QUESTION': {
      const ref = memberRefFromText(message) || session.member;
      const base = `Returns and renewals are processed by library staff on the Issue/Return screen. A renewal extends the due date by ${POLICY.renewalExtensionDays} days; late returns cost ₹${POLICY.finePerOverdueDayINR} per overdue day.`;
      if (ref && /\b(due|when|which|my|loans?)\b/.test(det.core)) return memberFlow(db, 'LOANS', ref, {}, session, ctx, out);
      return say(base + ' Tell me a member and I can show what they currently have out and when it\'s due.');
    }

    case 'LIBRARY_POLICY': {
      const asksHours = /\b(hours?|timings?|open|opening|closing|holiday)\b/.test(det.core);
      if (asksHours) return say("I couldn't find that information in the library system — opening hours aren't stored there. Please check with the library desk.");
      return say(`Here are the rules the system applies:\n• Loan period: ${POLICY.loanPeriodDays} days\n• Renewal: +${POLICY.renewalExtensionDays} days\n• Late fine: ₹${POLICY.finePerOverdueDayINR} per overdue day\n• Borrow limit: ${POLICY.defaultBorrowLimit} books per member by default (can differ per member)\n• External visitors: refundable ₹${POLICY.externalVisitorSecurityDepositINR} security deposit\n• Out-of-stock books: first-in-first-out waiting list`);
    }

    case 'GENERAL_LIBRARY_QUESTION':
      return say("I couldn't find that information in the library system. I can help with books, availability, loans, fines, deposits, waiting lists and book requests — what would you like to know?");

    default:
      return say("I'm not sure I understood that. I'm running in basic mode right now (Claude isn't connected), so I'm best at catalog questions — try \"python books\", \"is Clean Code available?\" or \"help\". For general knowledge questions I'd need Claude connected, but I can check whether we have books on a topic if you tell me which one.");
  }
}

/* ------------------------------ member-specific flows ------------------------------ */

async function memberFlow(db, kind, ref, extra, session, ctx, out) {
  const say = (t) => { out.reply = t; return out; };
  if (!ref) {
    session.awaiting = { type: 'MEMBER_FOR', intent: kind, turn: session.turn, ...extra };
    const what = { WAITLIST: 'Which member should I add to the waiting list?', REQUEST_CREATE: 'Which member is this request for?' }[kind]
      || 'Which member do you mean?';
    return say(`${what} Give me their name or member ID (like MEM-1001).`);
  }
  const call = async (tool, input) => runTool(db, tool, { ...input, member: ref }, ctx);
  const bad = (r) => { const p = memberProblem(r); return p ? say(p) : null; };

  if (kind === 'LOANS') {
    const r = await call('get_member_loan_status', {});
    if (r.error || r.ambiguous) return bad(r);
    session.member = r.member.memberID;
    if (!r.loans.length) return say(`${r.member.name} has no active loans right now.`);
    const lines = r.loans.map(l => `• **${l.title}** — due ${l.dueDate}${l.overdueDays ? ` ⚠️ ${l.overdueDays} day${l.overdueDays === 1 ? '' : 's'} overdue (₹${l.accruedFineINR} so far)` : ` (${l.daysUntilDue} day${l.daysUntilDue === 1 ? '' : 's'} left)`}`).join('\n');
    return say(`${r.member.name} has ${r.activeLoanCount} active loan${r.activeLoanCount === 1 ? '' : 's'} (limit ${r.member.borrowLimit}):\n${lines}`);
  }
  if (kind === 'FINES') {
    const r = await call('get_fine_status', {});
    if (r.error || r.ambiguous) return bad(r);
    session.member = r.member.memberID;
    const total = r.unpaidTotalINR + r.accruingTotalINR;
    if (total === 0) return say(`${r.member.name} owes no fines right now. 🎉`);
    const parts = [];
    if (r.unpaidTotalINR) parts.push(`₹${r.unpaidTotalINR} unpaid from returned books`);
    if (r.accruingTotalINR) parts.push(`₹${r.accruingTotalINR} accruing on overdue loans (₹${r.finePerOverdueDayINR}/day)`);
    return say(`${r.member.name} currently owes ₹${total}: ${parts.join(' and ')}.`);
  }
  if (kind === 'PAYMENTS') {
    const r = await call('get_payment_status', {});
    if (r.error || r.ambiguous) return bad(r);
    session.member = r.member.memberID;
    if (!r.recentPayments.length) return say(`There are no payments on record for ${r.member.name}.`);
    return say(`Recent payments for ${r.member.name}:\n` + r.recentPayments.map(p => `• ₹${p.amountINR} via ${p.method} on ${p.date} — ${p.status}`).join('\n'));
  }
  if (kind === 'DEPOSITS') {
    const r = await call('get_deposit_status', {});
    if (r.error || r.ambiguous) return bad(r);
    session.member = r.member.memberID;
    if (!r.deposits.length) return say(`${r.member.name} has no security deposit on record — deposits only apply to external visitors.`);
    return say(`Deposits for ${r.member.name}:\n` + r.deposits.map(d => `• ₹${d.amountINR} — ${d.status}${d.refundedAt ? ` (refunded ${d.refundedAt})` : ''}, ${d.date}`).join('\n'));
  }
  if (kind === 'REQUESTS') {
    const r = await call('get_book_requests', {});
    if (r.error || r.ambiguous) return bad(r);
    session.member = r.member.memberID;
    if (!r.requests.length) return say(`${r.member.name} hasn't submitted any book requests.`);
    return say(`Book requests by ${r.member.name}:\n` + r.requests.map(q => `• "${q.title}" — ${q.status} (${q.date})`).join('\n'));
  }
  if (kind === 'WAITLIST') {
    const r = await runTool(db, 'propose_join_waiting_list', { book_id: extra.bookID, member: ref }, ctx);
    if (r.error || r.ambiguous) return bad(r);
    if (r.proposed === false) return say(r.message);
    session.member = r.member.memberID;
    const p = ctx.proposals[ctx.proposals.length - 1];
    out.pending = p;
    return say(`Here's what I'll do: add **${r.member.name}** to the waiting list for **${r.book.title}** at position ${r.wouldBePosition}. Nothing has changed yet — tap **Confirm** to go ahead.`);
  }
  if (kind === 'REQUEST_CREATE') {
    const r = await runTool(db, 'propose_book_request', { title: extra.title, author: extra.author, member: ref }, ctx);
    if (r.error || r.ambiguous) return bad(r);
    if (r.proposed === false) return say(r.message);
    session.member = r.member.memberID;
    out.pending = ctx.proposals[ctx.proposals.length - 1];
    return say(`I can submit a purchase request for **${r.request.title}**${r.request.author !== 'Unknown' ? ` by ${r.request.author}` : ''} on behalf of ${r.member.name}. Nothing has been submitted yet — tap **Confirm** to send it.`);
  }
  return say('Sorry, I couldn\'t work out what to look up.');
}

module.exports = { basicTurn, stockPhrase };
