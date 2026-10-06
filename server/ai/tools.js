/**
 * Library tools exposed to Claude (and used by the basic-mode engine).
 *
 * - READ tools query the live SQLite database through the existing `db` helper.
 * - There are NO write tools. State changes are only *proposed* (propose_*) and are
 *   executed by executeAction() after the user clicks/confirms in the chat UI.
 * - Claude never receives a database handle, SQL access, secrets, or other users' contact data.
 */
const S = require('./search');
const { addPending } = require('./session');

// Mirrors the circulation rules implemented in server-complete.js (issue / return / renew / deposits).
const POLICY = Object.freeze({
  loanPeriodDays: 14,
  renewalExtensionDays: 14,
  finePerOverdueDayINR: 5,
  defaultBorrowLimit: 5,
  externalVisitorSecurityDepositINR: 500,
  depositRefundable: true,
  issueRequiresAvailableCopy: true,
  waitingList: 'First-in, first-out queue per book. A member can be on a book\'s queue only once.',
  notStoredInSystem: ['opening hours', 'membership fees', 'holiday schedule']
});

const todayStr = () => new Date().toISOString().split('T')[0];

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00');
  const b = new Date(toStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/* ------------------------------ identity & authorization ------------------------------ */

async function userFromReq(db, req) {
  const auth = (req && req.headers && req.headers.authorization) || '';
  const m = auth.match(/lumina_jwt_token_([A-Za-z0-9_.@-]+)/);
  if (!m) return null;
  const u = await db.getOne('SELECT username, email, role FROM users WHERE username = ?', [m[1]]);
  return u ? { username: u.username, email: u.email, role: String(u.role || '').toUpperCase() } : null;
}

const STAFF = new Set(['ADMIN', 'LIBRARIAN']);
const isStaff = (user) => !!user && STAFF.has(user.role);

function canAccessMember(user, member) {
  if (!user || !member) return false;
  if (isStaff(user)) return true;
  return !!user.email && !!member.email && user.email.toLowerCase() === String(member.email).toLowerCase();
}

/** Resolve "MEM-1001" / email / name to ONE active member, or report ambiguity */
async function findMember(db, ref) {
  const text = String(ref == null ? '' : ref).trim();
  if (!text) return { error: 'No member given.' };
  const idm = text.match(/\b([A-Za-z]{2,4}-\d{2,6})\b/);
  if (idm) {
    const m = await db.getOne('SELECT * FROM members WHERE LOWER(member_id) = LOWER(?)', [idm[1]]);
    if (m) return m.status === 'INACTIVE' ? { error: `Member ${m.member_id} is inactive.` } : { member: m };
    return { error: `I couldn't find a member with ID ${idm[1].toUpperCase()}.` };
  }
  if (/@/.test(text)) {
    const m = await db.getOne('SELECT * FROM members WHERE LOWER(email) = LOWER(?)', [text]);
    return m ? { member: m } : { error: "I couldn't find a member with that email." };
  }
  const like = `%${S.normalize(text).replace(/[%_\\]/g, x => '\\' + x)}%`;
  const rows = await db.query(
    `SELECT * FROM members WHERE COALESCE(status,'ACTIVE') != 'INACTIVE' AND LOWER(name) LIKE ? ESCAPE '\\' ORDER BY name LIMIT 6`, [like]);
  if (rows.length === 1) return { member: rows[0] };
  if (rows.length > 1) {
    const exact = rows.filter(r => S.normalize(r.name) === S.normalize(text));
    if (exact.length === 1) return { member: exact[0] };
    return { ambiguous: rows.map(r => ({ memberID: r.member_id, name: r.name })) };
  }
  return { error: `I couldn't find a member named "${text}".` };
}

async function authorizedMember(db, ctx, ref) {
  if (!ctx.user) return { error: 'Please sign in to see member-specific information.', code: 'NOT_SIGNED_IN' };
  const r = await findMember(db, ref);
  if (r.error || r.ambiguous) return r;
  if (!canAccessMember(ctx.user, r.member)) {
    return { error: 'You are not permitted to view that member\'s information.', code: 'FORBIDDEN' };
  }
  return r;
}

/* ------------------------------ read tools ------------------------------ */

function remember(ctx, books) {
  (books || []).forEach(b => { if (b) ctx.seen.set(b.bookID, b); });
}

async function bookFromInput(db, input) {
  if (input.book_id != null && input.book_id !== '') {
    const b = await S.getBookByID(db, input.book_id);
    return b ? { book: b } : { error: `No book with ID ${input.book_id} exists in the catalog.` };
  }
  if (input.title) {
    const r = await S.resolveTitle(db, input.title);
    if (r.book) return { book: r.book };
    if (r.candidates.length > 1) return { ambiguous: r.candidates.map(b => ({ bookID: b.bookID, title: b.title, author: b.author })) };
    return { error: `I couldn't find "${input.title}" in the catalog.` };
  }
  return { error: 'Provide a book_id or a title.' };
}

const READ_TOOLS = {
  async search_books(db, input, ctx) {
    const res = await S.searchBooks(db, {
      query: input.query, category: input.category, author: input.author,
      availableOnly: !!input.available_only, limit: input.limit || 5,
      excludeIDs: input.exclude_shown ? [...ctx.session.seen] : []
    });
    remember(ctx, res.books);
    ctx.lastSearch = { query: input.query || '', category: input.category || null, author: input.author || null, availableOnly: !!input.available_only };
    return {
      source: 'live catalog database',
      count: res.books.length, totalMatches: res.total,
      correctedSpelling: res.correctedQuery || undefined,
      note: res.books.length === 0 ? 'No matching books exist in the catalog.' : (res.levelHint ? `The catalog has no difficulty-level field, so "${res.levelHint}" could not be used as a filter.` : undefined),
      books: res.books
    };
  },

  async get_book_details(db, input, ctx) {
    const r = await bookFromInput(db, input);
    if (r.book) {
      remember(ctx, [r.book]);
      ctx.focus = r.book.bookID;
      const wl = await db.getOne('SELECT COUNT(*) AS n FROM waiting_list WHERE book_id = ? AND status = "WAITING"', [r.book.bookID]);
      return {
        source: 'live catalog database', book: r.book, peopleOnWaitingList: wl ? wl.n : 0,
        fieldsNotInSystem: ['description', 'summary', 'keywords', 'subject headings', 'reading level']
      };
    }
    return r;
  },

  async check_availability(db, input, ctx) {
    const ids = [];
    const problems = [];
    for (const id of (input.book_ids || [])) ids.push(Number(id));
    for (const title of (input.titles || [])) {
      const r = await bookFromInput(db, { title });
      if (r.book) ids.push(r.book.bookID); else problems.push({ title, ...r });
    }
    if (input.book_id != null || input.title) {
      const r = await bookFromInput(db, input);
      if (r.book) ids.push(r.book.bookID); else problems.push(r);
    }
    const books = await S.getBooksByIDs(db, ids);
    remember(ctx, books);
    const missing = ids.filter(id => !books.find(b => b.bookID === id));
    if (books.length === 1) ctx.focus = books[0].bookID;
    return {
      source: 'live stock (read from the database just now)',
      availability: books.map(b => ({ bookID: b.bookID, title: b.title, available: b.available, totalCopies: b.copies, issued: b.issued, status: b.stockStatus })),
      notFound: [...missing.map(id => ({ bookID: id, reason: 'no longer in the catalog' })), ...problems]
    };
  },

  async find_similar_books(db, input, ctx) {
    const r = await bookFromInput(db, input);
    if (!r.book) return r;
    const res = await S.findSimilarBooks(db, r.book.bookID, { limit: input.limit || 5, excludeIDs: input.exclude_shown ? [...ctx.session.seen] : [] });
    remember(ctx, [res.base, ...res.books]);
    return {
      source: 'live catalog database (matched on category, author and title concepts)',
      basedOn: { bookID: res.base.bookID, title: res.base.title, category: res.base.category, author: res.base.author },
      count: res.books.length, books: res.books
    };
  },

  async list_categories(db) {
    return { source: 'live catalog database', categories: await S.listCategories(db) };
  },

  async get_library_policies() {
    return { source: 'library system rules', ...POLICY };
  },

  async get_member_loan_status(db, input, ctx) {
    const r = await authorizedMember(db, ctx, input.member);
    if (!r.member) return r;
    const m = r.member;
    const loans = await db.query(
      `SELECT transaction_id, book_id, book_title, issue_date, due_date, status FROM loans WHERE member_id = ? AND status = 'ISSUED' ORDER BY due_date ASC`, [m.member_id]);
    const t = todayStr();
    ctx.member = m.member_id;
    return {
      source: 'live loans database',
      member: { memberID: m.member_id, name: m.name, borrowLimit: m.borrow_limit || POLICY.defaultBorrowLimit },
      activeLoanCount: loans.length,
      canBorrowMore: loans.length < (m.borrow_limit || POLICY.defaultBorrowLimit),
      loans: loans.map(l => {
        const overdue = Math.max(0, daysBetween(l.due_date, t));
        return { transactionID: l.transaction_id, bookID: l.book_id, title: l.book_title, issueDate: l.issue_date, dueDate: l.due_date,
          daysUntilDue: daysBetween(t, l.due_date), overdueDays: overdue, accruedFineINR: overdue * POLICY.finePerOverdueDayINR };
      })
    };
  },

  async get_fine_status(db, input, ctx) {
    const r = await authorizedMember(db, ctx, input.member);
    if (!r.member) return r;
    const m = r.member;
    const t = todayStr();
    const unpaid = await db.query(
      `SELECT transaction_id, book_title, fine_amount FROM loans WHERE member_id = ? AND status = 'RETURNED' AND fine_amount > 0 AND payment_status = 'UNPAID'`, [m.member_id]);
    const active = await db.query(
      `SELECT transaction_id, book_title, due_date FROM loans WHERE member_id = ? AND status = 'ISSUED' AND due_date < ?`, [m.member_id, t]);
    const accrued = active.map(l => ({ transactionID: l.transaction_id, title: l.book_title, dueDate: l.due_date,
      overdueDays: daysBetween(l.due_date, t), fineSoFarINR: daysBetween(l.due_date, t) * POLICY.finePerOverdueDayINR }));
    ctx.member = m.member_id;
    return {
      source: 'live loans database',
      member: { memberID: m.member_id, name: m.name },
      unpaidFinesOnReturnedBooks: unpaid.map(l => ({ transactionID: l.transaction_id, title: l.book_title, amountINR: l.fine_amount })),
      unpaidTotalINR: unpaid.reduce((s, l) => s + (l.fine_amount || 0), 0),
      accruingOnOverdueLoans: accrued,
      accruingTotalINR: accrued.reduce((s, l) => s + l.fineSoFarINR, 0),
      finePerOverdueDayINR: POLICY.finePerOverdueDayINR
    };
  },

  async get_payment_status(db, input, ctx) {
    const r = await authorizedMember(db, ctx, input.member);
    if (!r.member) return r;
    const rows = await db.query(
      `SELECT payment_id, transaction_id, amount, payment_method, payment_status, payment_date FROM payments WHERE member_id = ? ORDER BY created_at DESC LIMIT 5`, [r.member.member_id]);
    ctx.member = r.member.member_id;
    return { source: 'live payments database', member: { memberID: r.member.member_id, name: r.member.name },
      recentPayments: rows.map(p => ({ paymentID: p.payment_id, transactionID: p.transaction_id, amountINR: p.amount, method: p.payment_method, status: p.payment_status, date: p.payment_date })) };
  },

  async get_deposit_status(db, input, ctx) {
    const r = await authorizedMember(db, ctx, input.member);
    if (!r.member) return r;
    const rows = await db.query(
      `SELECT deposit_id, amount, status, date, refunded_at FROM deposits WHERE member_id = ? ORDER BY created_at DESC LIMIT 5`, [r.member.member_id]);
    ctx.member = r.member.member_id;
    return { source: 'live deposits database', member: { memberID: r.member.member_id, name: r.member.name },
      deposits: rows.map(d => ({ depositID: d.deposit_id, amountINR: d.amount, status: d.status, date: d.date, refundedAt: d.refunded_at || null })),
      note: rows.length === 0 ? 'No security deposit is recorded for this member (deposits apply to external visitors).' : undefined };
  },

  async get_waiting_list_status(db, input, ctx) {
    if (input.book_id != null || input.title) {
      const b = await bookFromInput(db, input);
      if (!b.book) return b;
      remember(ctx, [b.book]);
      const n = await db.getOne('SELECT COUNT(*) AS n FROM waiting_list WHERE book_id = ? AND status = "WAITING"', [b.book.bookID]);
      const out = { source: 'live waiting-list database', book: { bookID: b.book.bookID, title: b.book.title, available: b.book.available }, peopleWaiting: n ? n.n : 0 };
      if (input.member) {
        const r = await authorizedMember(db, ctx, input.member);
        if (r.member) {
          const row = await db.getOne('SELECT position FROM waiting_list WHERE book_id = ? AND member_id = ? AND status = "WAITING"', [b.book.bookID, r.member.member_id]);
          out.member = { memberID: r.member.member_id, name: r.member.name, onWaitingList: !!row, position: row ? row.position : null };
        } else out.memberLookup = r;
      }
      return out;
    }
    const r = await authorizedMember(db, ctx, input.member);
    if (!r.member) return r;
    const rows = await db.query(
      `SELECT w.book_id, w.position, b.title FROM waiting_list w LEFT JOIN books b ON b.book_id = w.book_id WHERE w.member_id = ? AND w.status = 'WAITING' ORDER BY w.requested_at`, [r.member.member_id]);
    ctx.member = r.member.member_id;
    return { source: 'live waiting-list database', member: { memberID: r.member.member_id, name: r.member.name },
      waitingFor: rows.map(w => ({ bookID: w.book_id, title: w.title || `Book #${w.book_id}`, position: w.position })) };
  },

  async get_book_requests(db, input, ctx) {
    const r = await authorizedMember(db, ctx, input.member);
    if (!r.member) return r;
    const rows = await db.query(
      `SELECT request_id, title, author, status, request_date, admin_response FROM book_requests WHERE member_id = ? ORDER BY created_at DESC LIMIT 8`, [r.member.member_id]);
    ctx.member = r.member.member_id;
    return { source: 'live book-request database', member: { memberID: r.member.member_id, name: r.member.name },
      requests: rows.map(q => ({ requestID: q.request_id, title: q.title, author: q.author, status: q.status, date: q.request_date, librarianResponse: q.admin_response || null })) };
  }
};

/* ------------------------------ proposals (NO database change) ------------------------------ */

async function proposeJoinWaitingList(db, input, ctx) {
  if (!ctx.user) return { error: 'Please sign in before joining a waiting list.', code: 'NOT_SIGNED_IN' };
  const b = await bookFromInput(db, input);
  if (!b.book) return b;
  const r = await authorizedMember(db, ctx, input.member);
  if (!r.member) return r;
  const m = r.member;

  if (b.book.available > 0) {
    return { proposed: false, reason: 'BOOK_IS_AVAILABLE', book: { bookID: b.book.bookID, title: b.book.title, available: b.book.available },
      message: `${b.book.title} has ${b.book.available} cop${b.book.available === 1 ? 'y' : 'ies'} available right now, so a waiting list isn't needed — it can be borrowed directly.` };
  }
  const dup = await db.getOne('SELECT position FROM waiting_list WHERE book_id = ? AND member_id = ? AND status = "WAITING"', [b.book.bookID, m.member_id]);
  if (dup) return { proposed: false, reason: 'ALREADY_ON_LIST', position: dup.position, message: `${m.name} is already on the waiting list for ${b.book.title} at position ${dup.position}.` };

  const n = await db.getOne('SELECT COUNT(*) AS n FROM waiting_list WHERE book_id = ? AND status = "WAITING"', [b.book.bookID]);
  const position = (n ? n.n : 0) + 1;
  remember(ctx, [b.book]);
  ctx.focus = b.book.bookID;
  const token = addPending(ctx.session, {
    type: 'JOIN_WAITING_LIST', bookID: b.book.bookID, memberID: m.member_id,
    dedupeKey: `JWL:${b.book.bookID}:${m.member_id}`,
    summary: `Add ${m.name} (${m.member_id}) to the waiting list for "${b.book.title}" at position ${position}`,
    confirmLabel: 'Yes, join waiting list'
  }, ctx.user.username);
  ctx.proposals.push({ token, type: 'JOIN_WAITING_LIST', summary: `Add ${m.name} (${m.member_id}) to the waiting list for "${b.book.title}" at position ${position}`, confirmLabel: 'Yes, join waiting list' });
  return { proposed: true, awaitingUserConfirmation: true, willHappenOnlyAfterUserClicksConfirm: true,
    book: { bookID: b.book.bookID, title: b.book.title }, member: { memberID: m.member_id, name: m.name }, wouldBePosition: position };
}

async function proposeBookRequest(db, input, ctx) {
  if (!ctx.user) return { error: 'Please sign in before requesting a book.', code: 'NOT_SIGNED_IN' };
  const title = String(input.title || '').trim().slice(0, 200);
  const author = String(input.author || '').trim().slice(0, 200);
  const reason = String(input.reason || '').trim().slice(0, 300);
  if (title.length < 2) return { error: 'A title is needed to request a book.' };
  const r = await authorizedMember(db, ctx, input.member);
  if (!r.member) return r;
  const m = r.member;

  const inCatalog = await db.getOne('SELECT book_id, title FROM books WHERE LOWER(title) = LOWER(?)', [title]);
  if (inCatalog) return { proposed: false, reason: 'ALREADY_IN_CATALOG', message: `"${inCatalog.title}" is already in the catalog (ID #${inCatalog.book_id}), so a request isn't needed.` };
  const dup = await db.getOne(`SELECT request_id FROM book_requests WHERE member_id = ? AND LOWER(title) = LOWER(?) AND status = 'PENDING'`, [m.member_id, title]);
  if (dup) return { proposed: false, reason: 'ALREADY_REQUESTED', message: `${m.name} already has a pending request (${dup.request_id}) for "${title}".` };

  const token = addPending(ctx.session, {
    type: 'CREATE_BOOK_REQUEST', title, author: author || 'Unknown', reason, memberID: m.member_id,
    dedupeKey: `BRQ:${m.member_id}:${title.toLowerCase()}`,
    summary: `Submit a purchase request for "${title}"${author ? ' by ' + author : ''} on behalf of ${m.name} (${m.member_id})`,
    confirmLabel: 'Yes, submit request'
  }, ctx.user.username);
  ctx.proposals.push({ token, type: 'CREATE_BOOK_REQUEST', summary: `Submit a purchase request for "${title}"${author ? ' by ' + author : ''} on behalf of ${m.name} (${m.member_id})`, confirmLabel: 'Yes, submit request' });
  return { proposed: true, awaitingUserConfirmation: true, willHappenOnlyAfterUserClicksConfirm: true,
    request: { title, author: author || 'Unknown' }, member: { memberID: m.member_id, name: m.name } };
}

/* ------------------------------ confirmed execution ------------------------------ */

const inflight = new Set();

/**
 * Runs a confirmed action. Every precondition is re-validated against the database at
 * this moment (stock may have changed since the proposal) and the result is VERIFIED
 * by reading the row back before success is reported.
 */
async function executeAction(db, action, user, deps) {
  if (!user) return { ok: false, message: 'Please sign in to do that.' };
  if (inflight.has(action.dedupeKey)) return { ok: false, message: 'That action is already being processed.' };
  inflight.add(action.dedupeKey);
  try {
    const member = await db.getOne('SELECT * FROM members WHERE member_id = ?', [action.memberID]);
    if (!member || member.status === 'INACTIVE') return { ok: false, message: 'That member is no longer active in the library system.' };
    if (!canAccessMember(user, member)) return { ok: false, message: 'You are not permitted to do that for this member.' };

    if (action.type === 'JOIN_WAITING_LIST') {
      const book = await db.getOne('SELECT * FROM books WHERE book_id = ?', [action.bookID]);
      if (!book) return { ok: false, message: 'That book is no longer in the catalog.' };
      if ((book.available_copies || 0) > 0) {
        return { ok: false, message: `"${book.title}" now has ${book.available_copies} cop${book.available_copies === 1 ? 'y' : 'ies'} available, so no waiting list was needed. It can be borrowed directly.` };
      }
      const dup = await db.getOne('SELECT position FROM waiting_list WHERE book_id = ? AND member_id = ? AND status = "WAITING"', [action.bookID, action.memberID]);
      if (dup) return { ok: false, message: `${member.name} is already on that waiting list at position ${dup.position}.` };
      const n = await db.getOne('SELECT COUNT(*) AS n FROM waiting_list WHERE book_id = ? AND status = "WAITING"', [action.bookID]);
      const position = (n ? n.n : 0) + 1;
      await db.execute('INSERT INTO waiting_list (book_id, member_id, position, status) VALUES (?, ?, ?, "WAITING")', [action.bookID, action.memberID, position]);

      const row = await db.getOne('SELECT position FROM waiting_list WHERE book_id = ? AND member_id = ? AND status = "WAITING"', [action.bookID, action.memberID]);
      if (!row) return { ok: false, message: 'I couldn\'t complete that action because the library system did not confirm it.' };
      if (deps.logAudit) await deps.logAudit({ action: 'JOIN_WAITLIST', module: 'WAITING_LIST', memberID: member.member_id, memberName: member.name, bookID: String(book.book_id), bookTitle: book.title,
        description: `${member.name} joined the waiting list for '${book.title}' at Position #${row.position} via AI Assistant (confirmed by ${user.username}).` });
      return { ok: true, verified: true, position: row.position, message: `Done — ${member.name} is now number ${row.position} on the waiting list for "${book.title}".`, refresh: true };
    }

    if (action.type === 'CREATE_BOOK_REQUEST') {
      const inCatalog = await db.getOne('SELECT book_id FROM books WHERE LOWER(title) = LOWER(?)', [action.title]);
      if (inCatalog) return { ok: false, message: `"${action.title}" is already in the catalog (ID #${inCatalog.book_id}).` };
      const dup = await db.getOne(`SELECT request_id FROM book_requests WHERE member_id = ? AND LOWER(title) = LOWER(?) AND status = 'PENDING'`, [action.memberID, action.title]);
      if (dup) return { ok: false, message: `A pending request (${dup.request_id}) for "${action.title}" already exists.` };
      let reqID;
      for (let i = 0; i < 8; i++) {
        reqID = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
        if (!(await db.getOne('SELECT 1 AS x FROM book_requests WHERE request_id = ?', [reqID]))) break;
      }
      await db.execute(
        `INSERT INTO book_requests (request_id, member_id, title, author, reason, request_date, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [reqID, action.memberID, action.title, action.author || 'Unknown', action.reason || 'Requested via AI Assistant', todayStr()]);
      const row = await db.getOne('SELECT request_id FROM book_requests WHERE request_id = ? AND member_id = ?', [reqID, action.memberID]);
      if (!row) return { ok: false, message: 'I couldn\'t complete that action because the library system did not confirm it.' };
      if (deps.logAudit) await deps.logAudit({ action: 'CREATE_BOOK_REQUEST', module: 'BOOK_REQUEST', memberID: member.member_id, memberName: member.name,
        description: `Book request ${reqID} submitted for '${action.title}'${action.author && action.author !== 'Unknown' ? ' by ' + action.author : ''} via AI Assistant (confirmed by ${user.username}).` });
      return { ok: true, verified: true, requestID: reqID, message: `Done — request ${reqID} for "${action.title}" has been submitted for ${member.name}.`, refresh: true };
    }
    return { ok: false, message: 'Unknown action.' };
  } catch (err) {
    console.error('AI action failed:', err.message);
    return { ok: false, message: 'I couldn\'t complete that action because the library system did not confirm it.' };
  } finally {
    inflight.delete(action.dedupeKey);
  }
}

/* ------------------------------ dispatcher + Claude tool schemas ------------------------------ */

async function runTool(db, name, input, ctx) {
  input = input && typeof input === 'object' ? input : {};
  try {
    if (READ_TOOLS[name]) return await READ_TOOLS[name](db, input, ctx);
    if (name === 'propose_join_waiting_list') return await proposeJoinWaitingList(db, input, ctx);
    if (name === 'propose_book_request') return await proposeBookRequest(db, input, ctx);
    return { error: `Unknown tool: ${name}` };
  } catch (err) {
    console.error(`AI tool ${name} failed:`, err.message);
    return { error: 'The library database could not be read for that request.', code: 'DB_ERROR' };
  }
}

const memberProp = { type: 'string', description: 'Member ID (e.g. MEM-1001), email, or full name' };
const bookProps = {
  book_id: { type: 'integer', description: 'Exact catalog book ID. Prefer this when known (e.g. from earlier results).' },
  title: { type: 'string', description: 'Book title (partial or misspelt is fine)' }
};

const TOOL_SCHEMAS = [
  { name: 'search_books', description: 'Search the REAL library catalog by topic, title, author, category or ISBN. Handles typos and synonyms. Returns live stock for each book. Use for any "do we have…", recommendation or browsing request.',
    input_schema: { type: 'object', properties: {
      query: { type: 'string', description: 'Topic / title / author words, e.g. "machine learning"' },
      category: { type: 'string', description: 'Optional category filter' },
      author: { type: 'string', description: 'Optional author filter' },
      available_only: { type: 'boolean', description: 'Only books with copies in stock' },
      limit: { type: 'integer', description: 'Max results (default 5)' },
      exclude_shown: { type: 'boolean', description: 'Skip books already shown in this conversation (use for "show another"/"more")' } } } },
  { name: 'get_book_details', description: 'Get the catalog record for one book (title, author, category, ISBN, publisher, year, shelf, copies, live stock). Only fields present in the database are returned.',
    input_schema: { type: 'object', properties: bookProps } },
  { name: 'check_availability', description: 'Read LIVE stock for one or more books. Always use this before saying whether a book is available.',
    input_schema: { type: 'object', properties: { ...bookProps,
      book_ids: { type: 'array', items: { type: 'integer' }, description: 'Several book IDs at once (e.g. all books from the previous answer)' },
      titles: { type: 'array', items: { type: 'string' } } } } },
  { name: 'find_similar_books', description: 'Find real catalog books similar to a given book (same category/author/concepts).',
    input_schema: { type: 'object', properties: { ...bookProps, limit: { type: 'integer' }, exclude_shown: { type: 'boolean' } } } },
  { name: 'list_categories', description: 'List the real catalog categories with title counts.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_library_policies', description: 'Loan period, renewal, fine rate, borrow limit, deposit rules as implemented by the system.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_member_loan_status', description: 'Active loans, due dates and overdue days for a member (permission-checked).', input_schema: { type: 'object', properties: { member: memberProp }, required: ['member'] } },
  { name: 'get_fine_status', description: 'Unpaid and accruing fines for a member (permission-checked).', input_schema: { type: 'object', properties: { member: memberProp }, required: ['member'] } },
  { name: 'get_payment_status', description: 'Recent fine payments for a member (permission-checked).', input_schema: { type: 'object', properties: { member: memberProp }, required: ['member'] } },
  { name: 'get_deposit_status', description: 'Security deposit records for a member (permission-checked).', input_schema: { type: 'object', properties: { member: memberProp }, required: ['member'] } },
  { name: 'get_waiting_list_status', description: 'Waiting-list queue length for a book, and/or a member\'s position (permission-checked for member data).',
    input_schema: { type: 'object', properties: { ...bookProps, member: memberProp } } },
  { name: 'get_book_requests', description: 'Book purchase requests submitted by a member (permission-checked).', input_schema: { type: 'object', properties: { member: memberProp }, required: ['member'] } },
  { name: 'propose_join_waiting_list', description: 'PROPOSE adding a member to the waiting list of an OUT-OF-STOCK book. This does NOT change anything: it shows the user a Confirm button. Never claim it is done; say it will happen only after they confirm.',
    input_schema: { type: 'object', properties: { ...bookProps, member: memberProp }, required: ['member'] } },
  { name: 'propose_book_request', description: 'PROPOSE submitting a purchase request for a title that is not in the catalog. Does NOT change anything until the user confirms.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, author: { type: 'string' }, reason: { type: 'string' }, member: memberProp }, required: ['title', 'member'] } }
];

module.exports = { POLICY, TOOL_SCHEMAS, runTool, executeAction, userFromReq, findMember, canAccessMember, isStaff, bookFromInput };
