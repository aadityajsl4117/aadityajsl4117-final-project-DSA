/**
 * Minimal local stand-in for the Anthropic Messages API, used ONLY by tests.
 *
 * It speaks the real wire protocol (x-api-key header, tools, tool_use / tool_result blocks,
 * stop_reason) so the server's Claude integration can be exercised end-to-end without a key.
 * It is a scripted stub - NOT a language model - so tests using it prove the plumbing
 * (tool loop, grounding, guards, fallbacks), not Claude's own intelligence.
 *
 *   node server/test-mock-anthropic.js 4567        (standalone)
 *   const { startMock } = require('./test-mock-anthropic')   (in-process)
 *
 * Trigger words in the user message switch on misbehaviour to test the guards:
 *   MOCK_LIE_STOCK  MOCK_FAKE_BOOK  MOCK_500  MOCK_HANG  MOCK_BADJSON
 */
const http = require('http');

function stateIds(system) {
  const ids = [];
  const re = /^\s*\d+\.\s+\[id (\d+)\]/gm;
  let m;
  while ((m = re.exec(system || '')) !== null) ids.push(Number(m[1]));
  return ids;
}

const memberIn = (t) => (t.match(/\b([A-Za-z]{2,4}-\d{2,6})\b/) || [])[1];

function decide(userText, system, history) {
  const t = userText.toLowerCase();
  const ids = stateIds(system);
  const member = memberIn(userText);
  if (/\bfine/.test(t) && member) return ['get_fine_status', { member }];
  if (/\bloans?\b/.test(t) && member) return ['get_member_loan_status', { member }];
  if (/(waiting list|waitlist)/.test(t) && /(add|join|put)/.test(t) && member) {
    const input = { member };
    const titled = userText.match(/["“]([^"”]+)["”]/);
    if (titled) input.title = titled[1]; else if (ids[0]) input.book_id = ids[0];
    return ['propose_join_waiting_list', input];
  }
  if (/\brequest\b/.test(t) && member) {
    const q = userText.match(/["“]([^"”]+)["”]/);
    return ['propose_book_request', { title: q ? q[1] : 'Unknown Title', member }];
  }
  if (/second one|2nd/.test(t) && ids[1]) return ['get_book_details', { book_id: ids[1] }];
  if (/similar/.test(t) && ids[0]) return ['find_similar_books', { book_id: ids[0], limit: 3 }];
  if (/\b(another|show more|one more)\b/.test(t)) {
    const prev = [...history].reverse().find(m => m.role === 'user' && typeof m.content === 'string' && !/another|more/i.test(m.content));
    return ['search_books', { query: prev ? prev.content : '', exclude_shown: true, limit: 1 }];
  }
  if (/(available|in stock)/.test(t)) {
    const named = userText.match(/\bis (.+?) available/i);
    if (named) return ['check_availability', { title: named[1] }];
    if (ids.length) return ['check_availability', { book_ids: ids }];
  }
  if (/\b(hello|hi|hey|thanks|thank you|bye)\b/.test(t) && t.split(' ').length <= 3) return null;
  if (/(what is|explain)/.test(t) && !/book/.test(t)) return null;
  if (/(book|show|find|have|recommend|need|something|python|programming|ai\b|funny|quantum)/.test(t)) {
    return ['search_books', { query: userText, limit: 3 }];
  }
  return null;
}

function bookLine(b, i, flags) {
  const n = flags.lie ? 999 : b.available;
  return `${i + 1}. ${b.title} — ${b.available > 0 || flags.lie ? `${n} ${n === 1 ? 'copy' : 'copies'} available` : 'OUT OF STOCK'}`;
}

function compose(results, flags) {
  const parts = [];
  for (const r of results) {
    if (r.error) { parts.push(`I couldn't do that: ${r.error}`); continue; }
    if (r.ambiguous) { parts.push('Which one do you mean? ' + r.ambiguous.map(a => a.title || a.name).join(' or ')); continue; }
    if (r.proposed === true) {
      parts.push(`I can add ${r.member.name} to the waiting list for ${r.book ? r.book.title : 'that title'} — tap Confirm and I'll do it. Nothing has changed yet.`);
    } else if (r.proposed === false) {
      parts.push(r.message);
    } else if (r.books) {
      parts.push(r.books.length ? `Here you go:\n${r.books.map((b, i) => bookLine(b, i, flags)).join('\n')}${flags.fake ? '\n9. The Imaginary Dragon Handbook — 4 copies available' : ''}` : (r.note || 'I could not find matching books in the library system.'));
    } else if (r.availability) {
      parts.push(r.availability.map((a, i) => bookLine({ title: a.title, available: a.available }, i, flags)).join('\n'));
    } else if (r.book) {
      parts.push(`${r.book.title} by ${r.book.author} (${r.book.category}) — ${r.book.available > 0 ? `${r.book.available} copies available` : 'OUT OF STOCK'}`);
    } else if (r.unpaidTotalINR !== undefined) {
      parts.push(`${r.member.name} owes ₹${r.unpaidTotalINR + r.accruingTotalINR} in fines.`);
    } else if (r.loans) {
      parts.push(`${r.member.name} has ${r.activeLoanCount} active loan(s).`);
    } else parts.push('Done looking that up.');
  }
  return parts.join('\n');
}

function startMock(port, options = {}) {
  const state = { calls: 0, requests: [], failNext: 0 };
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/__last') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ calls: state.calls, last: state.requests[state.requests.length - 1] || null, all: state.requests.length }));
    }
    if (req.method !== 'POST' || req.url !== '/v1/messages') { res.statusCode = 404; return res.end('{}'); }
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      state.calls++;
      let body;
      try { body = JSON.parse(raw); } catch (e) { res.statusCode = 400; return res.end('{"error":{"message":"bad json"}}'); }
      state.requests.push({ headers: req.headers, body });

      const msgs = body.messages;
      const last = msgs[msgs.length - 1];
      const userText = typeof last.content === 'string' ? last.content : '';
      const flagText = userText + ' ' + JSON.stringify(msgs[0] || '');
      const json = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };

      if (req.headers['x-api-key'] !== (options.expectKey || req.headers['x-api-key'])) return json(401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      if (/MOCK_500/.test(flagText)) return json(500, { error: { type: 'api_error', message: 'mock server error' } });
      if (/MOCK_BADJSON/.test(flagText)) { res.statusCode = 200; return res.end('<<not json>>'); }
      if (/MOCK_HANG/.test(flagText)) return; // never answers -> client timeout
      if (state.failNext > 0) { state.failNext--; return json(529, { error: { type: 'overloaded_error', message: 'overloaded' } }); }

      // second leg of the tool loop: Claude now writes the answer from the tool results
      if (Array.isArray(last.content) && last.content[0] && last.content[0].type === 'tool_result') {
        const results = last.content.map(c => { try { return JSON.parse(c.content); } catch (e) { return { error: 'unreadable tool result' }; } });
        const firstUser = msgs.filter(m => m.role === 'user' && typeof m.content === 'string').pop();
        const flags = { lie: /MOCK_LIE_STOCK/.test(firstUser ? firstUser.content : ''), fake: /MOCK_FAKE_BOOK/.test(firstUser ? firstUser.content : '') };
        return json(200, { id: 'msg_mock2', type: 'message', role: 'assistant', model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text: compose(results, flags) }] });
      }

      const history = msgs.slice(0, -1);
      const pick = decide(userText, body.system, history);
      if (!pick) {
        const t = userText.toLowerCase();
        const text = /(hello|hi\b|hey)/.test(t) ? 'Hi there! How can I help?'
          : /(thanks|thank you)/.test(t) ? "You're welcome!"
          : /(what is|explain)/.test(t) ? 'Machine learning is a way for computers to learn patterns from data (general knowledge, not from the library system).'
          : "I'm not sure — could you tell me a bit more?";
        return json(200, { id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text }] });
      }
      return json(200, {
        id: 'msg_mock1', type: 'message', role: 'assistant', model: body.model, stop_reason: 'tool_use',
        content: [{ type: 'text', text: 'Let me check the catalog.' }, { type: 'tool_use', id: `toolu_${state.calls}`, name: pick[0], input: pick[1] }]
      });
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, state, port, close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(r); }) })));
}

if (require.main === module) {
  const port = parseInt(process.argv[2]) || 4567;
  startMock(port).then(() => console.log(`mock anthropic listening on ${port}`));
}

module.exports = { startMock };
