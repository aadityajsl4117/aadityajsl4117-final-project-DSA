/**
 * Grounded catalog retrieval for the AI assistant.
 *
 * Every function reads the LIVE database on each call (no catalog cache), so stock,
 * new books and deleted books are reflected immediately.
 * Nothing in this file contains book data — only language helpers (stop words,
 * synonyms, typo correction) that turn a sentence into database queries.
 */

const STOP_WORDS = new Set((
  'a an the and or of for to in on at by with from about into is are was were be been am do does did have has had ' +
  'i me my we you your u ur it its this that these those there here any some one ones ' +
  'can could would should will shall may might please pls plz kindly just really very ' +
  'show give get find search look looking need needs want wants like love prefer ' +
  'recommend recommendation recommendations suggest suggestions something anything everything ' +
  'book books title titles volume volumes novel novels read reading learn study studying ' +
  'good best great nice top new latest available availability stock copy copies library ' +
  'tell what which who whom whose how when where why also another other more less ' +
  'ka ki ke ek koi mujhe chahiye hai hain batao dikhao kya aur ya'
).split(/\s+/));

// words that describe the reader's level, not the topic (the catalog has no level field)
const LEVEL_WORDS = new Set(['beginner', 'beginners', 'basic', 'basics', 'starter', 'easy', 'simple', 'advanced', 'expert', 'intermediate']);

// Language-level concept expansion. Used ONLY to widen the database query.
const SYNONYMS = {
  ai: ['artificial intelligence'],
  'artificial intelligence': ['ai', 'machine learning', 'intelligence'],
  ml: ['machine learning', 'artificial intelligence', 'data science'],
  'machine learning': ['artificial intelligence', 'data science', 'ml'],
  'deep learning': ['machine learning', 'artificial intelligence', 'neural'],
  neural: ['artificial intelligence', 'machine learning'],
  dsa: ['algorithms', 'data structures'],
  algo: ['algorithms'],
  algorithm: ['algorithms'],
  'data structures': ['algorithms', 'structures'],
  db: ['database', 'databases'],
  sql: ['database', 'databases'],
  database: ['databases'],
  databases: ['database'],
  py: ['python'],
  js: ['javascript'],
  coding: ['programming', 'software', 'code'],
  code: ['programming', 'software'],
  programming: ['software engineering', 'code', 'coding'],
  software: ['software engineering', 'programming'],
  funny: ['humor', 'humour', 'comedy', 'comic', 'satire'],
  humor: ['humour', 'comedy', 'funny'],
  humour: ['humor', 'comedy', 'funny'],
  comedy: ['humor', 'humour', 'funny'],
  cyber: ['cyber security', 'security'],
  hacking: ['security', 'cyber security'],
  security: ['cyber security'],
  cloud: ['cloud & devops', 'devops'],
  devops: ['cloud & devops', 'cloud'],
  web: ['web development'],
  website: ['web development'],
  frontend: ['web development'],
  backend: ['web development', 'software'],
  net: ['networking', 'network'],
  network: ['networking'],
  robot: ['robotics'],
  robots: ['robotics'],
  quantum: ['quantum computing'],
  stats: ['data science', 'statistics'],
  analytics: ['data science'],
  maths: ['mathematics'],
  math: ['mathematics'],
  fiction: ['novel', 'story'],
  intro: ['introduction'],
  basics: ['introduction', 'fundamentals'],
  fundamentals: ['introduction']
};

// conversational filler that precedes the actual topic
const FILLER_PHRASES = [
  /\b(do|did|does) (you|u|ya) (guys )?(have|got|stock|keep)\b/g,
  /\bcan (i|we) (get|have|see|find|borrow|take|issue)\b/g,
  /\b(any|got any|have any) (good )?(book|books)? ?(on|about|for|regarding|related to)\b/g,
  /\b(give|show|get|find|bring) (me|us)\b/g,
  /\bi (want|need|would like|wanna|am looking for|m looking for|am searching for)\b/g,
  /\b(need|want) (something|a book|some books?)( about| on| for)?\b/g,
  /\b(looking|searching) for\b/g,
  /\b(suggest|recommend)(ed)?( me)?( some| a| an| 3| three| 5| five)?\b/g,
  /\b(i('| a)?m|im) interested in\b/g,
  /\b(for|to|about) (learn|learning|study|studying)( about)?\b/g,
  /\b(i want to|want to|how to|wanna|i need to) (learn|study)\b/g
];

function normalize(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9&+#.'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFiller(text) {
  let t = ' ' + normalize(text) + ' ';
  for (const re of FILLER_PHRASES) t = t.replace(re, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** sentence -> { tokens, phrase, levelHint, levelWords, fullTokens, fullPhrase }
 *  Level words (beginner/advanced/basics...) are not topics, so `tokens` excludes them,
 *  but they are kept in `fullTokens` because they can be part of a real title ("... Advanced"). */
function extractTerms(text) {
  const cleaned = stripFiller(text);
  const raw = cleaned.split(/\s+/).filter(Boolean);
  let levelHint = null;
  const tokens = [];
  const levelWords = [];
  const fullTokens = [];
  for (const w of raw) {
    const word = w.replace(/^[-'.]+|[-'.]+$/g, '');
    if (!word) continue;
    if (LEVEL_WORDS.has(word)) { levelHint = word; levelWords.push(word); fullTokens.push(word); continue; }
    if (STOP_WORDS.has(word)) continue;
    if (word.length < 2) continue;
    tokens.push(word);
    fullTokens.push(word);
  }
  return { tokens, phrase: tokens.join(' '), levelHint, levelWords, fullTokens, fullPhrase: fullTokens.join(' ') };
}

function expandTerms(tokens, phrase) {
  const out = new Set();
  const add = (k) => (SYNONYMS[k] || []).forEach(v => out.add(v));
  tokens.forEach(add);
  if (phrase) add(phrase);
  for (let i = 0; i < tokens.length - 1; i++) add(tokens[i] + ' ' + tokens[i + 1]);
  tokens.forEach(t => out.delete(t));
  return [...out];
}

function levenshtein(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function mapBook(b) {
  if (!b) return null;
  const copies = Number(b.copies) || 0;
  const available = Math.max(0, Number(b.available_copies) || 0);
  const out = {
    bookID: b.book_id,
    title: b.title,
    author: b.author,
    category: b.category,
    available,
    copies,
    issued: Math.max(0, copies - available),
    stockStatus: available > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
    shelf: b.shelf || null,
    coverUrl: b.cover_url || ''
  };
  // only fields that are actually present in the database
  if (b.isbn) out.isbn = b.isbn;
  if (b.publisher) out.publisher = b.publisher;
  if (b.year) out.year = b.year;
  return out;
}

const COLS = 'book_id, title, author, category, isbn, publisher, year, copies, available_copies, shelf, cover_url';

function scoreRow(row, tokens, expanded, phrase, levelWords = []) {
  const title = normalize(row.title);
  const author = normalize(row.author);
  const category = normalize(row.category);
  const publisher = normalize(row.publisher);
  const isbn = String(row.isbn || '').replace(/[-\s]/g, '');
  let score = 0;
  let matched = 0;

  const wordIn = (hay, w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(hay);

  for (const t of tokens) {
    let hit = 0;
    if (/^\d{9,13}x?$/i.test(t) && isbn.toLowerCase().includes(t.toLowerCase())) hit += 12;
    if (wordIn(title, t)) hit += 5; else if (title.includes(t)) hit += 3;
    if (wordIn(author, t)) hit += 4; else if (author.includes(t)) hit += 2;
    if (wordIn(category, t)) hit += 3; else if (category.includes(t)) hit += 1.5;
    if (publisher.includes(t)) hit += 1;
    if (hit > 0) matched++;
    score += hit;
  }
  for (const e of expanded) {
    if (title.includes(e)) score += 2.5;
    if (category.includes(e)) score += 2;
    if (author.includes(e)) score += 1.5;
  }
  if (phrase && tokens.length > 1) {
    if (title.includes(phrase)) score += 8;
    if (author.includes(phrase)) score += 6;
    if (category.includes(phrase)) score += 5;
  }
  if (tokens.length > 0 && matched === tokens.length) score += 3;
  for (const lw of levelWords) if (wordIn(title, lw)) score += 6;   // "... Advanced" in the title beats its siblings
  return { score, matched };
}

async function fetchCandidates(db, terms, filters) {
  const where = [];
  const params = [];
  if (terms.length) {
    const ors = [];
    for (const t of terms) {
      const like = `%${t.replace(/[%_\\]/g, m => '\\' + m)}%`;
      ors.push(`(LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(author) LIKE ? ESCAPE '\\' OR LOWER(category) LIKE ? ESCAPE '\\' OR LOWER(publisher) LIKE ? ESCAPE '\\' OR REPLACE(isbn, '-', '') LIKE ? ESCAPE '\\')`);
      params.push(like, like, like, like, like);
    }
    where.push('(' + ors.join(' OR ') + ')');
  }
  if (filters.category) {
    where.push(`LOWER(category) LIKE ? ESCAPE '\\'`);
    params.push(`%${normalize(filters.category).replace(/[%_\\]/g, m => '\\' + m)}%`);
  }
  if (filters.author) {
    const parts = normalize(filters.author).split(/[\s.]+/).filter(w => w.length >= 2);
    for (const w of (parts.length ? parts : [normalize(filters.author)])) {
      where.push(`LOWER(author) LIKE ? ESCAPE '\\'`);
      params.push(`%${w.replace(/[%_\\]/g, m => '\\' + m)}%`);
    }
  }
  if (filters.availableOnly) where.push('available_copies > 0');
  if (filters.excludeIDs && filters.excludeIDs.length) {
    where.push(`book_id NOT IN (${filters.excludeIDs.map(() => '?').join(',')})`);
    params.push(...filters.excludeIDs.map(Number));
  }
  return db.query(`SELECT ${COLS} FROM books ${where.length ? 'WHERE ' + where.join(' AND ') : ''} LIMIT 300`, params);
}

/** Build a vocabulary of real words from the catalog (title/author/category only) for typo repair */
async function loadVocabulary(db) {
  const rows = await db.query('SELECT title, author, category FROM books');
  const vocab = new Set();
  for (const r of rows) {
    for (const f of [r.title, r.author, r.category]) {
      normalize(f).split(/\s+/).forEach(w => { const x = w.replace(/^[-'.]+|[-'.]+$/g, ''); if (x.length >= 3) vocab.add(x); });
    }
  }
  return vocab;
}

function repairToken(token, vocab) {
  if (token.length < 4 || vocab.has(token) || SYNONYMS[token]) return null;
  // one slip for normal words; two only for long words. Typos keep the first letter ("potter" must NOT become "foster").
  const max = token.length <= 8 ? 1 : 2;
  let best = null;
  let bestD = max + 1;
  for (const w of vocab) {
    if (w[0] !== token[0]) continue;
    const d = levenshtein(token, w, max);
    if (d < bestD || (d === bestD && best && w.length === token.length && best.length !== token.length)) { bestD = d; best = w; }
  }
  return bestD <= max ? best : null;
}

/**
 * searchBooks
 * @param {object} opts { query, category, author, availableOnly, limit, excludeIDs }
 * @returns {{books:Array, total:number, correctedQuery:?string, levelHint:?string, usedTerms:Array}}
 */
async function searchBooks(db, opts = {}) {
  const limit = Math.min(Math.max(parseInt(opts.limit) || 5, 1), 20);
  const filters = {
    category: opts.category || null,
    author: opts.author || null,
    availableOnly: !!opts.availableOnly,
    excludeIDs: opts.excludeIDs || []
  };

  const { tokens: t0, phrase: p0, levelHint, levelWords } = extractTerms(opts.query || '');
  let tokens = t0;
  let phrase = p0;
  let correctedQuery = null;

  const run = async () => {
    const expanded = expandTerms(tokens, phrase);
    const terms = [...new Set([...tokens, ...expanded])];
    const rows = await fetchCandidates(db, terms, filters);
    const scored = rows
      .map(r => ({ r, ...scoreRow(r, tokens, expanded, phrase, levelWords) }))
      .filter(x => (tokens.length === 0 && !terms.length) ? true : x.score > 0);
    scored.sort((a, b) =>
      b.score - a.score ||
      (b.r.available_copies > 0) - (a.r.available_copies > 0) ||
      String(a.r.title).localeCompare(String(b.r.title)));
    return scored;
  };

  let scored = await run();

  // multi-word queries: drop weak partial matches when a strong one exists
  if (scored.length > 1 && tokens.length > 1) {
    const top = scored[0].score;
    scored = scored.filter(x => x.score >= top * 0.35);
  }

  // typo repair only when nothing matched (keeps the common path to a single indexed-style query)
  if (scored.length === 0 && tokens.length > 0) {
    const vocab = await loadVocabulary(db);
    let changed = false;
    const fixed = tokens.map(t => {
      const f = repairToken(t, vocab);
      if (f && f !== t) { changed = true; return f; }
      return t;
    });
    // accept a repair only if EVERY word is now a real catalog word; otherwise the user asked for
    // something we simply don't have ("harry potter"), and a half-guess would look like an invented answer
    const known = (w) => w.length < 3 || vocab.has(w) || SYNONYMS[w];
    if (changed && !fixed.every(known)) changed = false;
    if (changed) {
      tokens = fixed;
      phrase = fixed.join(' ');
      correctedQuery = phrase;
      scored = await run();
    }
  }

  return {
    books: scored.slice(0, limit).map(x => mapBook(x.r)),
    total: scored.length,
    correctedQuery,
    levelHint,
    usedTerms: tokens
  };
}

async function getBookByID(db, bookID) {
  const id = parseInt(bookID);
  if (!id) return null;
  const row = await db.getOne(`SELECT ${COLS} FROM books WHERE book_id = ?`, [id]);
  return mapBook(row);
}

async function getBooksByIDs(db, ids) {
  const clean = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (!clean.length) return [];
  const rows = await db.query(`SELECT ${COLS} FROM books WHERE book_id IN (${clean.map(() => '?').join(',')})`, clean);
  const byID = new Map(rows.map(r => [r.book_id, mapBook(r)]));
  return clean.map(id => byID.get(id)).filter(Boolean); // deleted books silently drop out
}

/**
 * Resolve a (possibly misspelt / partial) title to a real book.
 * @returns {{book:?object, candidates:Array, exact:boolean}}
 */
async function resolveTitle(db, text, opts = {}) {
  const q = normalize(text);
  if (!q) return { book: null, candidates: [], exact: false };

  const exact = await db.getOne(`SELECT ${COLS} FROM books WHERE LOWER(title) = ?`, [q]);
  if (exact) return { book: mapBook(exact), candidates: [mapBook(exact)], exact: true };

  const terms = extractTerms(q);
  const tokens = terms.tokens;
  if (!tokens.length) return { book: null, candidates: [], exact: false };

  const res = await searchBooks(db, { query: terms.fullPhrase, limit: 6 });
  if (!res.books.length) return { book: null, candidates: [], exact: false };

  const inTitle = (list) => res.books.filter(b => {
    const t = normalize(b.title);
    return list.every(tok => t.includes(tok)) || (!terms.levelWords.length && t.includes(res.usedTerms.join(' ')));
  });
  // prefer candidates that contain EVERY typed word (including "advanced"/"basics"), else ignore level words
  // (if the user typed a level word like "basics" and no title has it, that is a different book - do not guess its sibling)
  const pool = inTitle(terms.fullTokens);

  if (opts.strict && !pool.length) return { book: null, candidates: res.books, exact: false };
  if (pool.length === 1) return { book: pool[0], candidates: pool, exact: false };
  if (pool.length > 1) {
    // the shortest matching title is the most specific one ("clean code" over "clean code in depth")
    const sorted = [...pool].sort((a, b) => normalize(a.title).length - normalize(b.title).length);
    const closeEnough = normalize(sorted[0].title) === normalize(terms.fullPhrase) || normalize(sorted[0].title) === normalize(res.usedTerms.join(' '));
    return { book: closeEnough ? sorted[0] : null, candidates: pool, exact: closeEnough };
  }
  return { book: null, candidates: res.books, exact: false };
}

function overlapScore(aTokens, bTokens) {
  const b = new Set(bTokens);
  return aTokens.filter(t => b.has(t)).length;
}

/** Similar books based on real catalog fields: category, author, title/category concepts */
async function findSimilarBooks(db, bookID, opts = {}) {
  const limit = Math.min(Math.max(parseInt(opts.limit) || 5, 1), 20);
  const base = await db.getOne(`SELECT ${COLS} FROM books WHERE book_id = ?`, [parseInt(bookID)]);
  if (!base) return { base: null, books: [] };

  const exclude = new Set([base.book_id, ...(opts.excludeIDs || []).map(Number)]);
  const concept = (r) => {
    const toks = extractTerms(`${r.title} ${r.category}`).tokens;
    return [...new Set([...toks, ...expandTerms(toks, toks.join(' '))])];
  };
  const baseConcept = concept(base);

  const rows = await db.query(
    `SELECT ${COLS} FROM books WHERE book_id != ? AND (category = ? OR author = ? OR publisher = ? OR LOWER(title) LIKE ? OR LOWER(category) LIKE ?) LIMIT 300`,
    [base.book_id, base.category, base.author, base.publisher || '', `%${normalize(base.category).split(' ')[0]}%`, `%${normalize(base.category).split(' ')[0]}%`]
  );
  // widen with concept-related rows if the same category is tiny
  let pool = rows;
  if (pool.length < limit + 2) {
    const extra = await db.query(`SELECT ${COLS} FROM books WHERE book_id != ? LIMIT 400`, [base.book_id]);
    const seen = new Set(pool.map(r => r.book_id));
    pool = pool.concat(extra.filter(r => !seen.has(r.book_id)));
  }

  const scored = pool
    .filter(r => !exclude.has(r.book_id))
    .map(r => {
      let s = 0;
      if (r.category === base.category) s += 6;
      if (r.author && r.author === base.author) s += 5;
      if (r.publisher && base.publisher && r.publisher === base.publisher) s += 0.5;
      s += overlapScore(concept(r), baseConcept) * 1.5;
      return { r, s };
    })
    .filter(x => x.s >= 2)
    .sort((a, b) => b.s - a.s || (b.r.available_copies > 0) - (a.r.available_copies > 0) || String(a.r.title).localeCompare(String(b.r.title)));

  return { base: mapBook(base), books: scored.slice(0, limit).map(x => mapBook(x.r)) };
}

async function listCategories(db) {
  const rows = await db.query(
    'SELECT category, COUNT(*) AS titles, SUM(CASE WHEN available_copies > 0 THEN 1 ELSE 0 END) AS inStock FROM books GROUP BY category ORDER BY titles DESC, category ASC'
  );
  return rows.map(r => ({ category: r.category, titles: r.titles, titlesInStock: r.inStock || 0 }));
}

module.exports = {
  normalize, stripFiller, extractTerms, expandTerms, levenshtein, mapBook,
  searchBooks, getBookByID, getBooksByIDs, resolveTitle, findSimilarBooks, listCategories
};
