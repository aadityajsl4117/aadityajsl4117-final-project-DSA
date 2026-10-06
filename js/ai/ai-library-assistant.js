/* SMART CONVERSATIONAL AI LIBRARY CHATBOT ENGINE */

LuminaLibrary.prototype.toggleChatbot = function() {
  const win = document.getElementById("chat-window");
  if (win) win.style.display = win.style.display === "none" ? "flex" : "none";
};

/* ---------- AI chat (Claude + live library database; see server/ai/) ---------- */

LuminaLibrary.prototype.aiEsc = function(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};

/** Safe mini-markdown: escape first, then allow **bold** and line breaks only */
LuminaLibrary.prototype.aiFormat = function(text) {
  return this.aiEsc(text)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
};

LuminaLibrary.prototype.aiRenderBooks = function(books) {
  if (!books || !books.length) return "";
  const e = (v) => this.aiEsc(v);
  return `<div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">` +
    books.map(b => {
      const isAvail = b.available > 0;
      const id = Number(b.bookID);
      return `
        <div style="background:var(--bg-card); border:1px solid var(--border-subtle); padding:10px; border-radius:var(--radius-sm); font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong>${e(b.title)}</strong>
            <span class="badge ${isAvail ? 'badge-success' : 'badge-danger'}">${isAvail ? `${Number(b.available)} In Stock` : 'Out of Stock'}</span>
          </div>
          <div style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">by ${e(b.author)} • ${e(b.category)} (ID: #${id})</div>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <button class="btn btn-sm" onclick="app.showBookDetails(${id})">View Details</button>
            ${isAvail
              ? `<button class="btn btn-sm btn-primary" onclick="app.openModal('issue-book', { bookID: ${id} })">Issue Book</button>`
              : `<button class="btn btn-sm btn-warning" onclick="app.openJoinWaitingListModal(${id})">Join Waiting List</button>`}
          </div>
        </div>`;
    }).join("") + `</div>`;
};

LuminaLibrary.prototype.aiRenderPending = function(p) {
  if (!p || !p.token) return "";
  const t = this.aiEsc(p.token);
  return `
    <div class="ai-pending" style="margin-top:10px; padding:10px; border:1px dashed var(--warning, #f59e0b); background:#fffbeb; border-radius:var(--radius-sm); font-size:0.8rem;">
      <div style="font-weight:700; margin-bottom:6px;">Please confirm</div>
      <div>${this.aiEsc(p.summary)}</div>
      <div style="display:flex; gap:6px; margin-top:8px;">
        <button class="btn btn-sm btn-primary" onclick="app.confirmAIAction(this, '${t}', 'confirm')">${this.aiEsc(p.confirmLabel || "Confirm")}</button>
        <button class="btn btn-sm" onclick="app.confirmAIAction(this, '${t}', 'cancel')">Cancel</button>
      </div>
    </div>`;
};

LuminaLibrary.prototype.aiRenderQuick = function(list) {
  if (!list || !list.length) return "";
  return `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">` +
    list.map(q => `<button class="btn btn-sm" style="border-radius:999px;" onclick="app.sendAIQuick(this.dataset.q)" data-q="${this.aiEsc(q)}">${this.aiEsc(q)}</button>`).join("") + `</div>`;
};

LuminaLibrary.prototype.aiFooter = function(res) {
  if (!res || res.mode === "social" || res.mode === "action") return "";
  const label = res.mode === "claude" ? "✨ Claude · live library data" : "Basic mode · live library data";
  const note = res.notice ? `<br>${this.aiEsc(res.notice)}` : "";
  return `<div style="margin-top:8px; font-size:0.68rem; color:var(--text-muted);">${label}${note}</div>`;
};

LuminaLibrary.prototype.sendAIQuick = function(text) {
  const input = document.getElementById("chat-input");
  if (!input || !text) return;
  input.value = text;
  this.handleChatSubmit();
};

LuminaLibrary.prototype.handleChatSubmit = async function(e) {
  if (e) e.preventDefault();
  if (this._chatBusy) return;                       // never send two messages at once
  const input = document.getElementById("chat-input");
  const q = input ? input.value.trim() : "";
  if (!q) return;

  if (!this.chatContext) this.chatContext = {};
  const box = document.getElementById("chat-messages");

  const userB = document.createElement("div");
  userB.className = "chat-bubble user";
  userB.textContent = q;
  box.appendChild(userB);
  input.value = "";

  const botB = document.createElement("div");
  botB.className = "chat-bubble bot";
  botB.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Thinking…</span>`;
  box.appendChild(botB);
  box.scrollTop = box.scrollHeight;

  this._chatBusy = true;
  try {
    const res = await window.LuminaAPI.queryAI(q, this.chatContext);
    if (res && res.context) this.chatContext = res.context;
    botB.innerHTML =
      `<div>${this.aiFormat(res.reply)}</div>` +
      this.aiRenderBooks(res.books) +
      this.aiRenderPending(res.pendingAction) +
      this.aiRenderQuick(res.quickReplies) +
      this.aiFooter(res);
  } catch (err) {
    // Never invent an answer: show the server's honest message, or say the catalog is unreachable
    const serverMsg = err && err.data && err.data.reply;
    botB.innerHTML = `<div>${this.aiEsc(serverMsg || "I can't access the live library catalog right now.")}</div>`;
  } finally {
    this._chatBusy = false;
    box.scrollTop = box.scrollHeight;
  }
};

/** Confirm / cancel an action the assistant PROPOSED. Nothing happens until this is clicked. */
LuminaLibrary.prototype.confirmAIAction = async function(btn, token, decision) {
  const wrap = btn && btn.closest ? btn.closest(".ai-pending") : null;
  if (wrap) wrap.querySelectorAll("button").forEach(b => { b.disabled = true; });   // no double submits
  const box = document.getElementById("chat-messages");
  const out = document.createElement("div");
  out.className = "chat-bubble bot";
  try {
    const res = await window.LuminaAPI.confirmAIAction((this.chatContext || {}).sessionId, token, decision);
    out.innerHTML = `<div>${res.cancelled ? "" : (res.success ? "✅ " : "⚠️ ")}${this.aiEsc(res.reply)}</div>`;
    if (wrap) wrap.remove();
    if (res.success && res.refresh && typeof this.loadState === "function") {
      try { await this.loadState(); } catch (e) { /* UI refresh is best-effort */ }
    }
  } catch (err) {
    const msg = (err && err.data && err.data.reply) || "I couldn't complete that action because the library system did not confirm it.";
    out.innerHTML = `<div>⚠️ ${this.aiEsc(msg)}</div>`;
    if (wrap) wrap.remove();
  }
  box.appendChild(out);
  box.scrollTop = box.scrollHeight;
};

// Helper to fill chat input from interactive category pills
LuminaLibrary.prototype.sendAIChatPrompt = function(promptText) {
  const input = document.getElementById("chat-input");
  if (input) {
    input.value = promptText;
    const form = input.closest("form");
    if (form) {
      const event = new Event("submit", { cancelable: true });
      form.dispatchEvent(event);
    }
  }
};

// Fuzzy Levenshtein Distance Helper
LuminaLibrary.prototype.levenshteinDistance = function(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// Query Normalization & Spelling Correction Engine
LuminaLibrary.prototype.normalizeAIQuery = function(query) {
  let q = (query || "").trim().toLowerCase();
  if (!q) return "";

  const typoMap = {
    "comdey": "comedy", "comdy": "comedy", "humor": "comedy", "funny": "comedy",
    "pythn": "python", "pyton": "python", "pyt": "python", "pyhton": "python",
    "algoritm": "algorithm", "algorthm": "algorithm", "algo": "algorithms", "algos": "algorithms",
    "datastructure": "data structures", "datastructures": "data structures", "ds": "dsa",
    "machinelearning": "machine learning", "ml": "machine learning",
    "datascience": "data science",
    "cybersecurity": "cyber security", "securty": "security", "sec": "security",
    "datbase": "database", "databse": "database", "dbms": "database", "sq": "sql",
    "progamming": "programming", "programing": "programming", "codeing": "coding",
    "softwar": "software", "architectur": "architecture", "desgn": "design",
    "motivaton": "motivation"
  };

  const words = q.split(/\s+/).map(w => typoMap[w] || w);
  return words.join(" ");
};

// Core Catalog Discovery Engine (Strict Database Grounding)
LuminaLibrary.prototype.discoverCatalogBooks = function(query) {
  const originalQ = (query || "").trim().toLowerCase();
  const q = this.normalizeAIQuery(originalQ);
  if (!q) return [];

  const conceptMap = [
    {
      concepts: ["design", "architecture", "software design", "system design", "ui design", "patterns", "refactoring"],
      categories: ["Software Engineering", "Programming", "Computer Science"],
      keywords: ["clean code", "design patterns", "pragmatic", "architecture", "domain-driven", "refactoring", "head first"],
      reason: "Focuses on software architecture, design patterns, and system design principles."
    },
    {
      concepts: ["comedy", "humor", "funny", "fiction", "entertainment"],
      categories: ["Fiction", "Literature", "Business", "Software Engineering"],
      keywords: ["mythical", "pragmatic", "clean code", "phoenix"],
      reason: "Humorous and engaging engineering & software development narratives."
    },
    {
      concepts: ["motivation", "productivity", "self improvement", "personal development", "mindset", "success", "leadership", "habits", "efficiency", "discipline"],
      categories: ["Business", "Software Engineering", "Management"],
      keywords: ["lean", "startup", "habits", "mythical", "great", "zero", "pragmatic", "clean"],
      reason: "Focuses on personal efficiency, productivity, and engineering leadership."
    },
    {
      concepts: ["python", "py"],
      categories: ["Programming", "Data Science", "Artificial Intelligence"],
      keywords: ["python", "scikit-learn", "pandas", "crash course"],
      reason: "Covers Python syntax, data analysis, and machine learning models."
    },
    {
      concepts: ["data science", "analytics", "statistics", "data analysis", "visualization"],
      categories: ["Data Science", "Artificial Intelligence"],
      keywords: ["data science", "statistics", "storytelling", "mining", "massive", "data analysis"],
      reason: "Teaches statistical modeling, data visualization, and large-scale analytics."
    },
    {
      concepts: ["machine learning", "ai", "artificial intelligence", "deep learning", "neural", "reinforcement"],
      categories: ["Artificial Intelligence", "Data Science"],
      keywords: ["artificial intelligence", "deep learning", "pattern recognition", "reinforcement", "machine learning"],
      reason: "Comprehensive reference for artificial intelligence, neural networks, and ML."
    },
    {
      concepts: ["database", "sql", "dbms", "backend", "postgres", "nosql", "relational"],
      categories: ["Databases", "Operating Systems"],
      keywords: ["database", "sql", "data-intensive", "seven databases"],
      reason: "Covers SQL queries, relational schema design, and distributed data systems."
    },
    {
      concepts: ["programming", "coding", "beginner", "beginner programming", "learn coding", "developer", "software development"],
      categories: ["Programming", "Software Engineering", "Computer Science"],
      keywords: ["crash course", "head first", "js", "c programming", "interview", "clean code", "pragmatic"],
      reason: "Ideal for learning programming fundamentals, clean syntax, and developer skills."
    },
    {
      concepts: ["dsa", "data structures", "algorithms", "algorithm", "interview", "sorting", "bst", "trees", "graphs"],
      categories: ["Algorithms", "Programming", "Computer Science", "Mathematics"],
      keywords: ["algorithms", "coding interview", "discrete mathematics", "structure and interpretation", "c programming"],
      reason: "Essential reference for algorithmic problem solving, asymptotic complexity, and DSA."
    },
    {
      concepts: ["cyber security", "security", "hacking", "malware", "cryptography", "infosec", "network security"],
      categories: ["Cyber Security", "Networking"],
      keywords: ["hacker", "malware", "exploitation", "cryptography", "incident response", "security"],
      reason: "Teaches cybersecurity auditing, web security, cryptography, and penetration testing."
    },
    {
      concepts: ["software engineering", "clean code", "architecture", "design patterns", "refactoring"],
      categories: ["Software Engineering"],
      keywords: ["clean code", "design patterns", "pragmatic programmer", "refactoring", "mythical"],
      reason: "Teaches production software design, architectural patterns, and code maintainability."
    },
    {
      concepts: ["networking", "tcp/ip", "sockets", "internet", "protocols"],
      categories: ["Networking", "Cyber Security"],
      keywords: ["networking", "tcp/ip", "top-down"],
      reason: "Explains computer network protocols, socket programming, and TCP/IP stack layers."
    },
    {
      concepts: ["operating systems", "os", "linux", "kernel", "concurrency"],
      categories: ["Operating Systems"],
      keywords: ["operating system", "modern operating"],
      reason: "Covers kernel design, process concurrency, memory management, and file systems."
    },
    {
      concepts: ["math", "mathematics", "calculus", "linear algebra", "probability"],
      categories: ["Mathematics"],
      keywords: ["calculus", "linear algebra", "discrete mathematics", "probability"],
      reason: "Mathematical foundations for computer science, engineering, and data analysis."
    }
  ];

  const cleanQuery = q
    .replace(/^(is|check status of|do you have|where is|find|show me|status of|search for|recommend|i want to learn|i need|books for|books about|books similar to|show me books for|which book should i read for|give me a book for)\s+/i, '')
    .replace(/\s+(available|in stock|borrowed|on shelf|books)\??$/i, '')
    .trim();

  const scored = this.books.map(b => {
    let score = 0;
    let matchReasons = [];
    const titleL = b.title.toLowerCase();
    const authorL = b.author.toLowerCase();
    const catL = b.category.toLowerCase();
    const shelfL = (b.shelf || "").toLowerCase();

    // 1. Exact & Substring Title Match
    if (titleL === cleanQuery || titleL === q) {
      score += 100;
      matchReasons.push(`Exact title match for '${b.title}'`);
    } else if (titleL.includes(cleanQuery) || (cleanQuery.length >= 3 && cleanQuery.includes(titleL))) {
      score += 65;
      matchReasons.push(`Title matches '${cleanQuery}'`);
    }

    // 2. Author Match
    if (authorL.includes(cleanQuery) || authorL.includes(q) || authorL.includes(originalQ)) {
      score += 55;
      matchReasons.push(`Authored by ${b.author}`);
    }

    // 3. Category & Shelf Match
    if (catL.includes(cleanQuery) || catL.includes(q) || q.includes(catL) || shelfL.includes(cleanQuery)) {
      score += 45;
      matchReasons.push(`Belongs to category '${b.category}'`);
    }

    // 4. Concept Map Theme Match
    conceptMap.forEach(cm => {
      const hitConcept = cm.concepts.some(c => q.includes(c) || c.includes(q) || cleanQuery.includes(c) || originalQ.includes(c));
      if (hitConcept) {
        if (cm.categories.includes(b.category)) {
          score += 40;
          matchReasons.push(cm.reason);
        }
        if (cm.keywords.some(kw => titleL.includes(kw))) {
          score += 30;
          matchReasons.push(`Matches ${cm.concepts[0]} theme`);
        }
      }
    });

    // 5. Token & Fuzzy Distance Match
    const qTokens = q.split(/\s+/).filter(w => w.length >= 3);
    qTokens.forEach(token => {
      if (titleL.includes(token)) {
        score += 25;
        if (!matchReasons.length) matchReasons.push(`Contains topic keyword '${token}'`);
      } else {
        const titleWords = titleL.split(/\s+/);
        const hasFuzzyWord = titleWords.some(tw => this.levenshteinDistance(token, tw) <= 1 && tw.length >= 4);
        if (hasFuzzyWord) {
          score += 20;
          matchReasons.push(`Fuzzy match for '${token}' in title`);
        }
      }
    });

    return { book: b, score, matchReasons: [...new Set(matchReasons)] };
  });

  return scored.filter(sb => sb.score > 0).sort((a, b) => b.score - a.score);
};

// Conversational Smart Response & Intent Processor
LuminaLibrary.prototype.generateSmartAdvisorResponse = function(query) {
  const originalQ = (query || "").trim();
  const q = originalQ.toLowerCase();
  if (!q) return `<p>Please enter a topic, book title, author, or natural language request.</p>`;

  // Initialize Conversation Context
  if (!this.aiContext) {
    this.aiContext = {
      lastTopic: "",
      lastResults: [],
      selectedBook: null
    };
  }

  if (!this.searchHistory.includes(originalQ)) {
    this.searchHistory.push(originalQ);
  }

  const activeMember = this.members[0] || { name: "Patron", memberID: "STU-201", interests: [] };

  // 1. Broad Greeting / General Request Handling
  if (q === "hi" || q === "hello" || q === "hey" || q === "i need a book" || q === "can you recommend something" || q === "help me find a book" || q === "recommend a book") {
    const categories = [...new Set(this.books.map(b => b.category))].slice(0, 7);
    const pillsHTML = categories.map(c => `
      <button class="btn btn-sm" style="margin:2px; font-size:0.75rem;" onclick="app.sendAIChatPrompt('${c}')">${c}</button>
    `).join('');

    return `
      <div>
        <p style="font-weight:700; color:var(--text-main);">👋 Hello ${activeMember.name}! I'm your Lumina Library Assistant.</p>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px; margin-bottom:8px;">What would you like to learn or read today? You can type any topic, author, or click a popular section below:</p>
        <div>${pillsHTML}</div>
      </div>
    `;
  }

  // 2. Conversational Follow-up Pronoun & Ordinal References ("first one", "is it available", "borrow it", "show another")
  const isOrdinalRef = q.includes("first one") || q.includes("1st one") || q.includes("first book") || q.includes("top one");
  const isSecondRef = q.includes("second one") || q.includes("2nd one") || q.includes("second book");
  const isThirdRef = q.includes("third one") || q.includes("3rd one") || q.includes("third book");
  const isPronounRef = q.includes("that one") || q.includes("this one") || q.includes("is it available") || q.includes("is that available") || q.includes("can i borrow it") || q.includes("borrow it") || q.includes("i want that") || q.includes("when will it be available");

  if ((isOrdinalRef || isSecondRef || isThirdRef || isPronounRef) && this.aiContext.lastResults.length > 0) {
    let targetBook = this.aiContext.selectedBook || this.aiContext.lastResults[0];
    if (isOrdinalRef) targetBook = this.aiContext.lastResults[0];
    if (isSecondRef && this.aiContext.lastResults[1]) targetBook = this.aiContext.lastResults[1];
    if (isThirdRef && this.aiContext.lastResults[2]) targetBook = this.aiContext.lastResults[2];

    this.aiContext.selectedBook = targetBook;
    const escTitle = targetBook.title.replace(/'/g, "\\'");

    if (q.includes("available") || q.includes("stock") || q.includes("when will it be")) {
      if (targetBook.available > 0) {
        return `
          <div>
            <p style="font-size:0.86rem; font-weight:800; color:var(--success);">🟢 Yes! "${targetBook.title}" is currently AVAILABLE.</p>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">We currently have <strong>${targetBook.available} copy(ies) in stock</strong> at shelf location <code>${targetBook.shelf}</code>.</p>
            <div style="display:flex; gap:6px; margin-top:10px;">
              <button class="btn btn-sm btn-primary" onclick="app.closeModal(); app.openModal('issue-book', { bookID: ${targetBook.bookID} })">Borrow Now</button>
              <button class="btn btn-sm" onclick="app.navigate('catalog'); setTimeout(() => app.handleGlobalSearch({ target: { value: '${escTitle}' } }), 50);">View Book Details</button>
            </div>
          </div>
        `;
      } else {
        const queue = this.reservations[targetBook.bookID];
        const waitCount = queue ? queue.size() : 0;
        return `
          <div>
            <p style="font-size:0.86rem; font-weight:800; color:var(--danger);">🔴 "${targetBook.title}" is currently OUT OF STOCK (0/${targetBook.copies}).</p>
            <p style="font-size:0.8rem; color:var(--text-body); margin-top:4px;">${waitCount > 0 ? `There are currently <strong>${waitCount} patron(s)</strong> waiting in the queue.` : 'No patrons are currently waiting.'} You can join the priority waiting list and we will notify you as soon as a copy is returned!</p>
            <div style="display:flex; gap:6px; margin-top:10px;">
              <button class="btn btn-sm btn-primary" onclick="app.openModal('user-book-request', { title: '${escTitle}' })">Join Waiting List</button>
              <button class="btn btn-sm" onclick="app.openModal('user-book-request', { title: '${escTitle}' })">Request Title</button>
            </div>
          </div>
        `;
      }
    }

    if (q.includes("borrow") || q.includes("i want") || q.includes("take")) {
      if (targetBook.available > 0) {
        return `
          <div>
            <p style="font-size:0.86rem; font-weight:800; color:var(--accent);">📖 Great choice! Authorizing loan for "${targetBook.title}"...</p>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Click below to confirm your borrowing authorization at the circulation desk:</p>
            <div style="display:flex; gap:6px; margin-top:10px;">
              <button class="btn btn-sm btn-primary" onclick="app.closeModal(); app.openModal('issue-book', { bookID: ${targetBook.bookID} })">Authorize Borrowing Loan</button>
            </div>
          </div>
        `;
      } else {
        return `
          <div>
            <p style="font-size:0.86rem; font-weight:800; color:var(--danger);">🔴 "${targetBook.title}" is currently out of stock.</p>
            <p style="font-size:0.8rem; color:var(--text-body); margin-top:4px;">Would you like to join the priority waiting list for this volume?</p>
            <div style="display:flex; gap:6px; margin-top:10px;">
              <button class="btn btn-sm btn-primary" onclick="app.openModal('user-book-request', { title: '${escTitle}' })">Join Waiting List</button>
            </div>
          </div>
        `;
      }
    }
  }

  // 3. Conversational Beginner / Recommendation Filter ("beginner", "easier", "which one is best")
  if ((q.includes("beginner") || q.includes("easier") || q.includes("which one is best") || q.includes("which one should i read")) && this.aiContext.lastResults.length > 0) {
    const beginnerMatches = this.aiContext.lastResults.filter(b => 
      b.title.toLowerCase().includes("crash course") || 
      b.title.toLowerCase().includes("head first") || 
      b.title.toLowerCase().includes("introduction") || 
      b.title.toLowerCase().includes("clean code") || 
      b.title.toLowerCase().includes("scratch")
    );

    const bestBook = beginnerMatches.length > 0 ? beginnerMatches[0] : this.aiContext.lastResults[0];
    const escTitle = bestBook.title.replace(/'/g, "\\'");

    return `
      <div>
        <p style="font-size:0.86rem; font-weight:800; color:var(--accent);">⭐ Recommended Choice for Beginners:</p>
        <div class="ai-book-recommend-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <strong>${bestBook.title}</strong>
            <span class="badge ${bestBook.available > 0 ? 'badge-success' : 'badge-danger'}">
              ${bestBook.available > 0 ? `🟢 AVAILABLE — ${bestBook.available} in stock` : '🔴 OUT OF STOCK'}
            </span>
          </div>
          <div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">by ${bestBook.author} • <strong>Shelf ${bestBook.shelf}</strong></div>
          <div style="font-size:0.75rem; margin-top:4px; color:var(--text-body);"><strong>Why Recommended:</strong> Excellent introductory narrative, clear explanations, and hands-on examples.</div>
          <div style="display:flex; gap:6px; margin-top:8px;">
            ${bestBook.available > 0 
              ? `<button class="btn btn-sm btn-primary" onclick="app.closeModal(); app.openModal('issue-book', { bookID: ${bestBook.bookID} })">Borrow</button>`
              : `<button class="btn btn-sm btn-primary" onclick="app.openModal('user-book-request', { title: '${escTitle}' })">Join Waiting List</button>`
            }
            <button class="btn btn-sm" onclick="app.navigate('catalog'); setTimeout(() => app.handleGlobalSearch({ target: { value: '${escTitle}' } }), 50);">View Book</button>
          </div>
        </div>
      </div>
    `;
  }

  // 4. Conversational Show Another / Similar ("show another", "don't want this", "something similar")
  if (q.includes("show another") || q.includes("show me another") || q.includes("different one") || q.includes("something similar") || q.includes("don't want this")) {
    const currentBookID = this.aiContext.selectedBook ? this.aiContext.selectedBook.bookID : (this.aiContext.lastResults[0] ? this.aiContext.lastResults[0].bookID : 0);
    const altMatches = this.books.filter(b => b.bookID !== currentBookID && b.available > 0).slice(0, 3);

    if (altMatches.length > 0) {
      this.aiContext.lastResults = altMatches;
      this.aiContext.selectedBook = altMatches[0];

      let html = `<div><p style="font-size:0.86rem; font-weight:800; color:var(--accent);">💡 Here are alternative available volumes from our repository:</p>`;
      altMatches.forEach(b => {
        const escTitle = b.title.replace(/'/g, "\\'");
        html += `
          <div class="ai-book-recommend-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <strong>${b.title}</strong>
              <span class="badge badge-success">🟢 AVAILABLE — ${b.available} copies in stock</span>
            </div>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">by ${b.author} • <strong>Shelf ${b.shelf}</strong></div>
            <div style="display:flex; gap:6px; margin-top:8px;">
              <button class="btn btn-sm btn-primary" onclick="app.closeModal(); app.openModal('issue-book', { bookID: ${b.bookID} })">Borrow</button>
              <button class="btn btn-sm" onclick="app.navigate('catalog'); setTimeout(() => app.handleGlobalSearch({ target: { value: '${escTitle}' } }), 50);">View Book</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
      return html;
    }
  }

  // 5. Core Discovery Engine Query Execution
  let discoveries = this.discoverCatalogBooks(originalQ);

  // Fallback Discovery if exact terms are broad
  if (!discoveries || discoveries.length === 0) {
    const defaultRecs = this.books.slice(0, 3).map(b => ({
      book: b,
      score: 10,
      matchReasons: [`Available in catalog (${b.category})`]
    }));
    if (defaultRecs.length > 0) {
      discoveries = defaultRecs;
    }
  }

  if (discoveries && discoveries.length > 0) {
    // Save to conversation memory
    this.aiContext.lastTopic = originalQ;
    this.aiContext.lastResults = discoveries.map(d => d.book);
    this.aiContext.selectedBook = discoveries[0].book;

    const availableMatches = discoveries.filter(d => d.book.available > 0);
    const outOfStockMatches = discoveries.filter(d => d.book.available === 0);

    let html = `<div>`;
    html += `<p style="font-size:0.86rem; font-weight:800; color:var(--text-main); margin-bottom:8px;">📚 Librarian Discovery for <em>"${originalQ}"</em>:</p>`;

    if (availableMatches.length > 0) {
      html += `<div style="margin-bottom:10px;"><strong style="font-size:0.78rem; color:var(--success); text-transform:uppercase; letter-spacing:0.04em;">🟢 AVAILABLE BOOKS IN STOCK:</strong></div>`;

      availableMatches.forEach(item => {
        const b = item.book;
        const escTitle = b.title.replace(/'/g, "\\'");
        const reason = item.matchReasons[0] || `Covers ${b.category} concepts and is available on shelf.`;

        html += `
          <div class="ai-book-recommend-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <strong>${b.title}</strong>
              <span class="badge badge-success">🟢 AVAILABLE — ${b.available} copies in stock</span>
            </div>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">by ${b.author} • <strong>Shelf ${b.shelf}</strong></div>
            <div style="font-size:0.75rem; margin-top:4px; color:var(--text-body);"><strong>Why Recommended:</strong> ${reason}</div>
            <div style="display:flex; gap:6px; margin-top:8px;">
              <button class="btn btn-sm btn-primary" onclick="app.closeModal(); app.openModal('issue-book', { bookID: ${b.bookID} })">Borrow</button>
              <button class="btn btn-sm" onclick="app.navigate('catalog'); setTimeout(() => app.handleGlobalSearch({ target: { value: '${escTitle}' } }), 50);">View Book</button>
            </div>
          </div>
        `;
      });
    }

    if (outOfStockMatches.length > 0) {
      html += `<div style="margin-top:14px; border-top:1px dashed var(--border-strong); padding-top:10px;">
                <strong style="font-size:0.78rem; color:var(--danger); text-transform:uppercase; letter-spacing:0.04em;">🔴 CURRENTLY OUT OF STOCK:</strong>
               </div>`;

      outOfStockMatches.forEach(item => {
        const b = item.book;
        const escTitle = b.title.replace(/'/g, "\\'");
        const queue = this.reservations[b.bookID];
        const waitCount = queue ? queue.size() : 0;
        const reason = item.matchReasons[0] || `Highly relevant to ${b.category}`;

        html += `
          <div class="ai-book-recommend-card" style="border-left-color:var(--danger);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <strong>${b.title}</strong>
              <span class="badge badge-danger">🔴 OUT OF STOCK (0/${b.copies})</span>
            </div>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">by ${b.author} • <strong>Shelf ${b.shelf}</strong></div>
            <div style="font-size:0.75rem; margin-top:4px; color:var(--text-body);"><strong>Why Relevant:</strong> ${reason}</div>
            <p style="font-size:0.76rem; color:var(--text-muted); margin-top:4px;">This book is currently unavailable. You can join the waiting list and we'll notify you when a copy becomes available.</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
              <span style="font-size:0.72rem; color:var(--text-muted);">${waitCount > 0 ? `📌 ${waitCount} member(s) waiting` : 'No waitlist queue currently'}</span>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm btn-primary" onclick="app.openModal('user-book-request', { title: '${escTitle}' })">Join Waiting List</button>
                <button class="btn btn-sm" onclick="app.openModal('user-book-request', { title: '${escTitle}' })">Request</button>
              </div>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    return html;
  }

  // Final Factual Fallback Suggestion
  const categories = [...new Set(this.books.map(b => b.category))].slice(0, 5).join(", ");
  return `
    <div>
      <p style="color:var(--text-body);">I couldn't find an exact match for <em>"${originalQ}"</em> in the repository catalog.</p>
      <p style="font-size:0.78rem; color:var(--text-muted); margin-top:6px;">I can search related topics if you'd like. For example: <strong>${categories}</strong>.</p>
    </div>
  `;
};
