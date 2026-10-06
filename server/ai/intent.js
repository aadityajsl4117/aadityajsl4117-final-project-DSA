/**
 * Intent detection + reference resolution ("it", "the second one", "another" ...).
 * This decides WHAT the user wants before any database or Claude call is made,
 * so greetings / thanks / goodbyes never turn into catalog searches.
 */
const { normalize } = require('./search');

const INTENTS = [
  'GREETING', 'BOOK_SEARCH', 'BOOK_RECOMMENDATION', 'BOOK_DETAILS', 'AVAILABILITY_CHECK', 'BORROW_QUESTION',
  'WAITING_LIST', 'AUTHOR_SEARCH', 'CATEGORY_SEARCH', 'SIMILAR_BOOKS', 'BOOK_REQUEST', 'LOAN_STATUS',
  'RETURN_QUESTION', 'FINE_QUESTION', 'PAYMENT_QUESTION', 'DEPOSIT_QUESTION', 'LIBRARY_POLICY',
  'GENERAL_LIBRARY_QUESTION', 'THANKS', 'GOODBYE', 'HELP', 'UNKNOWN'
];

const GREET = /^(hi+|hello+|hey+|heya|hii+|helo|hola|namaste|namaskar|yo|sup|good (morning|afternoon|evening|day)|gm|howdy|greetings|hi there|hello there|hey there)( there| friend| buddy| bot| assistant| librarian)?$/;
const HOW_ARE_YOU = /^(how are (you|u)( doing| today)?|how r u|how('| i)?s it going|what'?s up|wassup|kaise ho|kya haal( hai)?)$/;
const THANKS = /^(thanks?( a lot| so much| a ton)?|thank (you|u)( so much| very much| a lot)?|thx|ty|tysm|much appreciated|appreciate it|cheers|great thanks?|perfect thanks?|awesome thanks?|shukriya|dhanyavad|dhanyawad)( ?!*)?$/;
const BYE = /^(bye+|goodbye|good bye|see (you|ya)( later| soon)?|cya|later|take care|good night|gn|alvida|ok bye|okay bye|that'?s all|that is all|i'?m done|im done)$/;
const HELP = /\b(help|what can you do|how (do|does) (you|this) work|what do you do|commands|capabilities|how to use)\b/;

const ORDINALS = [
  [/\b(first|1st|number 1|no\.? ?1|#1|top one|top)\b/, 1],
  [/\b(second|2nd|number 2|no\.? ?2|#2)\b/, 2],
  [/\b(third|3rd|number 3|no\.? ?3|#3)\b/, 3],
  [/\b(fourth|4th|number 4|no\.? ?4|#4)\b/, 4],
  [/\b(fifth|5th|number 5|no\.? ?5|#5)\b/, 5],
  [/\b(sixth|6th|number 6|no\.? ?6|#6)\b/, 6]
];

function stripGreetingPrefix(text) {
  // "hi, do you have python books" -> "do you have python books"
  return text.replace(/^(hi+|hello+|hey+|hola|namaste|good (morning|afternoon|evening)|yo)\b[\s,!.:-]*/i, '').trim();
}

function isAffirmative(t) {
  return /^(yes+|yeah|yep|yup|sure|ok(ay)?|please do|yes please|go ahead|do it|confirm|confirmed|sounds good|haan|ha|ji|proceed|add (me|them|him|her)|yes,? (add|do|go|join|please).*)$/i.test(t.trim());
}
function isNegative(t) {
  return /^(no+|nope|nah|no thanks|not now|cancel|never ?mind|don'?t|stop|nahi|skip)$/i.test(t.trim());
}

/** Which of the shown books does the sentence point at? */
function findOrdinal(t) {
  if (/\b(last|final|bottom)( one)?\b/.test(t)) return 'last';
  for (const [re, n] of ORDINALS) if (re.test(t)) return n;
  return null;
}

function hasPronounRef(t) {
  return /\b(it|this|that|this one|that one|the same|same one|this book|that book|the book)\b/.test(t);
}

function isAnotherRequest(t) {
  return /\b(another|show more|more (books|options|ones|results)|next one|something else|different (one|book)|else\b|anything else|one more|other (options|books|ones))\b/.test(t) ||
    /^(more|next|again)$/.test(t);
}

/**
 * detectIntent
 * @param {string} message raw user text
 * @param {object} state { hasShown, hasFocus, hasPending }
 * @returns {{intent:string, core:string, norm:string, wantsAction:boolean, ordinal:?(number|string), pronoun:boolean, another:boolean, similar:boolean}}
 */
function detectIntent(message, state = {}) {
  const raw = String(message || '').trim();
  const norm = normalize(raw).replace(/\bu\b/g, 'you').replace(/\bur\b/g, 'your').replace(/\bpls\b|\bplz\b/g, 'please');
  const base = { core: norm, norm, wantsAction: false, ordinal: null, pronoun: false, another: false, similar: false };
  const clean = norm.replace(/[!.?,]+$/g, '').trim();

  if (!clean) return { ...base, intent: 'UNKNOWN' };

  // pure social messages first: never go near the catalog
  if (GREET.test(clean) || HOW_ARE_YOU.test(clean)) return { ...base, intent: 'GREETING', core: clean };
  if (THANKS.test(clean)) return { ...base, intent: 'THANKS', core: clean };
  if (BYE.test(clean)) return { ...base, intent: 'GOODBYE', core: clean };

  if (isAffirmative(clean) || isNegative(clean)) return { ...base, intent: 'UNKNOWN', core: clean };

  const core = stripGreetingPrefix(clean) || clean;
  const t = core;
  const out = {
    ...base, core,
    ordinal: findOrdinal(t),
    pronoun: hasPronounRef(t),
    another: isAnotherRequest(t),
    similar: /\b(similar|more like|like (this|that|it)|same (kind|type|topic|genre)|alternatives?|related( books?)?)\b/.test(t) ||
      /\bbooks? like\b/.test(t)
  };

  // explicit state-changing wording
  out.wantsAction = /\b(add|put|join|enrol+|enroll|sign (me )?up|register|place|reserve|hold)\b.*\b(wait ?list|waiting list|queue|hold)\b/.test(t) ||
    /\b(wait ?list|waiting list)\b.*\b(add|join|put)\b/.test(t) ||
    /^(join|add me|put me)\b/.test(t) ||
    /\b(request|order|purchase|procure)\b.*\b(book|title|copy)\b/.test(t) && /\b(please|can you|could you|i want|i'd like|i would like|add)\b/.test(t);

  const is = (re) => re.test(t);

  if (is(/\b(wait ?list|waiting list|waitlist|queue|on hold|put on hold|hold list)\b/) || (out.wantsAction && is(/\bhold\b/))) {
    return { ...out, intent: 'WAITING_LIST' };
  }
  if (is(/\b(what happens if|what if|what do i do if|what then)\b.*\b(out of stock|unavailable|not available|no copies|all (copies )?(are )?(issued|taken|borrowed))\b/)) {
    return { ...out, intent: 'WAITING_LIST' };
  }
  if (is(/\b(request (a |the |this |new )?(book|title)|book request|requests?\b.*\b(status|pending)|suggest (a )?(book|title) (for|to) (the )?library|purchase request|request (for )?(a )?new|my requests?)\b/) ||
      (out.wantsAction && is(/\b(request|order|purchase)\b/)) ||
      is(/\bcan (you|the library) (get|order|buy|add|stock|purchase)\b/)) {
    return { ...out, intent: 'BOOK_REQUEST' };
  }
  if (is(/\b(deposit|refund|security money|caution money)\b/)) return { ...out, intent: 'DEPOSIT_QUESTION' };
  if (is(/\b(fines?|overdue (charges?|fees?|amount)|late fees?|penalt(y|ies)|how much (do i|i) owe|dues?)\b/)) return { ...out, intent: 'FINE_QUESTION' };
  if (is(/\b(payments?|paid|pay (my|the|a)|settle|receipt|transactions? history)\b/)) return { ...out, intent: 'PAYMENT_QUESTION' };
  if (is(/\b(renew|renewal|return(ing)?|give back|hand ?in|extend (the )?(due|loan)|how (do|can) i return)\b/) && !is(/\breturn (me|results)\b/)) {
    return { ...out, intent: 'RETURN_QUESTION' };
  }
  if (is(/\b(my loans?|my books|what (have|did) i (borrow|issue)|borrowed|issued to|due (date|when|soon)|when (is|are) .*due|currently (have|borrowed)|loan (status|history)|books i have)\b/) ||
      is(/\bloans? (for|of)\b/)) {
    return { ...out, intent: 'LOAN_STATUS' };
  }
  if (is(/\b(policy|policies|rules?|regulations?|loan period|how (long|many days|many books)|borrowing limit|borrow limit|limit|opening hours|timings?|library hours|fine per day|late fee rate|membership)\b/) &&
      !is(/\b(book|books)\b.*\b(about|on)\b/)) {
    return { ...out, intent: 'LIBRARY_POLICY' };
  }
  if (out.similar) return { ...out, intent: 'SIMILAR_BOOKS' };
  if (is(/\b(borrow|issue|check ?out|take (it )?home|lend|rent|loan (me|it)|can i (get|have|take)( it| this| that)?)\b/) &&
      (out.pronoun || out.ordinal || /\b(borrow|issue|check ?out|take home|lend)\b/.test(t))) {
    return { ...out, intent: 'BORROW_QUESTION' };
  }
  if (is(/\b(available|availability|in stock|out of stock|stock|copies (left|available|remaining)|how many copies|any copies|can i get|is there a copy|on (the )?shelf|currently (in|available)|still there|have (it|them)|do you still have)\b/) ||
      /^(which|what) (one|ones|of (them|these|those)|book)?.*\b(available|in stock)\b/.test(t)) {
    return { ...out, intent: 'AVAILABILITY_CHECK' };
  }
  if (is(/\b(tell me (more )?about|more (info|information|details)|details? (of|about|on)|describe|info (on|about)|what is .* about|what('s| is) it about|summary|summari[sz]e|who (wrote|is the author|authored)|author of|publisher|isbn|which shelf|where (is|can i find)|shelf|show (me )?(the )?details|about (it|this|that|the (first|second|third|last) one))\b/) ||
      (out.ordinal && is(/\b(about|details?|info|more)\b/))) {
    return { ...out, intent: 'BOOK_DETAILS' };
  }
  if (is(/\b(categories|category list|sections?|genres?|subjects?|topics?)\b/) &&
      is(/\b(what|which|list|show|available|have|browse|all|types?)\b/)) {
    return { ...out, intent: 'CATEGORY_SEARCH' };
  }
  if (is(/\b(books? by|written by|author|authored by|by [a-z]+( [a-z.]+)*$)\b/) && !is(/\bwho (wrote|is the author)\b/)) {
    return { ...out, intent: 'AUTHOR_SEARCH' };
  }
  if (out.another) return { ...out, intent: 'BOOK_RECOMMENDATION' };
  if (HELP.test(t)) return { ...out, intent: 'HELP' };
  if (is(/\b(recommend|suggest|suggestion|what should i read|something (to read|good|funny|interesting)|good (book|read)|best (book|books)|any (good|interesting)|surprise me|help me (choose|pick|find)|i('| a)?m (bored|looking for something))\b/)) {
    return { ...out, intent: 'BOOK_RECOMMENDATION' };
  }
  if (is(/\b(books?|titles?|novels?|textbooks?|read|reading|copy|copies|find|search|looking for|show me|do you have|any (book|books)|need|want|give me|get me|anything (on|about)|something (on|about|for))\b/)) {
    return { ...out, intent: 'BOOK_SEARCH' };
  }
  if (is(/\b(library|librarian|member(ship)?|card|catalog(ue)?|issue desk|reading room)\b/)) {
    return { ...out, intent: 'GENERAL_LIBRARY_QUESTION' };
  }
  // a bare noun phrase ("python", "clean code", "machine learning") is almost always a topic/title
  if (/^[a-z0-9&+#.' -]{2,60}$/.test(t) && t.split(' ').length <= 6 && !/\b(what|why|how|when|who|is|are|can|will|did|does)\b/.test(t)) {
    return { ...out, intent: 'BOOK_SEARCH' };
  }
  return { ...out, intent: 'UNKNOWN' };
}

/**
 * Resolve which shown book a sentence refers to.
 * @returns {{bookID:?number, ambiguous:Array<number>, how:string}}
 */
function resolveReference(det, session) {
  const shown = session.shown || [];
  if (det.ordinal) {
    if (det.ordinal === 'last') return shown.length ? { bookID: shown[shown.length - 1], ambiguous: [], how: 'ordinal' } : { bookID: null, ambiguous: [], how: 'none' };
    const id = shown[det.ordinal - 1];
    return id ? { bookID: id, ambiguous: [], how: 'ordinal' } : { bookID: null, ambiguous: [], how: 'ordinal-out-of-range' };
  }
  if (/\b(the )?(other|another) one\b|\bwhat about the other\b/.test(det.core) && session.focus && shown.length === 2) {
    const other = shown.find(id => id !== session.focus);
    if (other) return { bookID: other, ambiguous: [], how: 'other' };
  }
  if (det.pronoun) {
    if (session.focus) return { bookID: session.focus, ambiguous: [], how: 'focus' };
    if (shown.length === 1) return { bookID: shown[0], ambiguous: [], how: 'only-shown' };
    if (shown.length > 1) return { bookID: null, ambiguous: shown.slice(0, 5), how: 'ambiguous' };
  }
  return { bookID: null, ambiguous: [], how: 'none' };
}

module.exports = { INTENTS, detectIntent, resolveReference, isAffirmative, isNegative, stripGreetingPrefix };
