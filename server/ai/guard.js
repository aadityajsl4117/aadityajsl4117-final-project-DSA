/**
 * Post-check on Claude's wording: if the reply states a stock number or status that
 * contradicts what the database returned THIS turn, the stock phrase is rewritten from
 * the database. (Cards under the message always show the live database values anyway.)
 */
const { normalize, resolveTitle } = require('./search');

const canon = (b) => b.available > 0
  ? `AVAILABLE — ${b.available} ${b.available === 1 ? 'copy' : 'copies'} in stock`
  : 'OUT OF STOCK';

const STOCK_START = /(\s*[-—–:(,]?\s*)((?:is |are )?(?:currently |now )?(?:\d+\s*(?:copies|copy|cop\.?)|\d+\s+(?:in stock|available)|available|in stock|out of stock|unavailable|not available|no copies))/i;

function claimedState(segment) {
  const out = /out of stock|unavailable|not available|no copies|\b0 (copies|copy)\b/i.test(segment);
  const num = segment.match(/(\d+)\s*(?:copies|copy|in stock|available|cop\.?)/i);
  const inStock = !out && /available|in stock|\d+\s*cop/i.test(segment);
  return { out, inStock, num: num ? Number(num[1]) : null };
}

function verifyStockClaims(text, books) {
  if (!text || !books || !books.length) return { text, corrected: [] };
  const corrected = [];

  const lines = text.split('\n').map(line => {
    const nl = normalize(line);
    for (const b of books) {
      const t = normalize(b.title);
      if (!t || !nl.includes(t)) continue;

      // look only at the part of the line after the title
      const idx = line.toLowerCase().indexOf(b.title.toLowerCase());
      const start = idx >= 0 ? idx + b.title.length : 0;
      const head = line.slice(0, start);
      const tail = line.slice(start);
      const m = tail.match(STOCK_START);
      if (!m) return line;

      const claim = claimedState(tail);
      const wrong =
        (b.available > 0 && claim.out) ||
        (b.available === 0 && (claim.inStock || (claim.num !== null && claim.num > 0))) ||
        (b.available > 0 && claim.num !== null && claim.num !== b.available && claim.num !== b.copies);
      if (!wrong) return line;

      corrected.push({ bookID: b.bookID, said: claim.out ? 'out of stock' : (claim.num !== null ? claim.num : 'available'), actual: b.available });
      // keep anything before the stock phrase, replace the stock phrase (to end of line) with the live value
      const keep = tail.slice(0, m.index).replace(/[\s,;:—–-]+$/, '');
      const sep = keep || /^\s*[:(]/.test(m[1]) ? '' : '';
      return `${head}${keep}${sep} — ${canon(b)}`.replace(/\s+—\s+—/g, ' —');
    }
    return line;
  });

  return { text: lines.join('\n'), corrected };
}

/**
 * Hallucination guard for book lists: when the reply is a list of books, every listed title
 * must exist in the catalog. A title that Claude never got from a tool is looked up in the live
 * database; if it does not exist the line is removed.
 * Only list-style lines that look like "1. Title — ..." / "- **Title** by ..." are examined,
 * and only when at least one list line matched a real book (so ordinary numbered steps are untouched).
 */
const LIST_LINE = /^\s*(?:\d+[.)]|[-*•])\s+\**\s*["“]?([^*\n"”—–(]+?)["”]?\s*\**\s*(?:—|–|-\s|\sby\s|\(|:|$)/i;

async function verifyListedTitles(text, seenMap, db) {
  const seen = [...seenMap.values()];
  const lines = text.split('\n');
  const parsed = lines.map(l => { const m = l.match(LIST_LINE); return m ? m[1].trim() : null; });
  const known = (title) => {
    const n = normalize(title);
    return n.length >= 3 && seen.find(b => normalize(b.title).includes(n) || n.includes(normalize(b.title)));
  };
  const anyReal = parsed.some(t => t && known(t));
  if (!anyReal) return { text, removed: [], extra: [] };

  const removed = [];
  const extra = [];
  const keep = [];
  for (let i = 0; i < lines.length; i++) {
    const t = parsed[i];
    if (!t || known(t) || t.split(' ').length > 12) { keep.push(lines[i]); continue; }
    // not something a tool returned: does it exist in the real catalog anyway?
    const r = await resolveTitle(db, t, { strict: true });
    if (r.book) { extra.push(r.book); keep.push(lines[i]); } else { removed.push(t); }
  }
  let out = keep.join('\n');
  if (removed.length) out += `\n\n(I left out ${removed.length === 1 ? 'a title' : 'some titles'} I couldn't verify in the library catalog.)`;
  return { text: out, removed, extra };
}

module.exports = { verifyStockClaims, verifyListedTitles };
