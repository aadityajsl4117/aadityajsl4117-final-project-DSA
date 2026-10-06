class LuminaLibrary {
  constructor() {
    window.app = this;
    this.STORAGE_KEY = "luminaLibraryState_2026_enterprise_sih_v4";
    this.emailjsPublicKey = "Ljk6p1rGszhXv3Kax";
    this.emailjsServiceID = "libraryamrita.edu";
    this.emailjsTemplateID = "template_dy3ud3i";
    this.fineRatePerDay = 5.0; // ₹5.00/day fine rate
    
    const today = new Date();
    this.todayStr = today.toISOString().split("T")[0];
    this.defaultPlaceholder = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&auto=format&fit=crop&q=80";

    if (window.emailjs && typeof window.emailjs.init === "function") {
      try { window.emailjs.init(this.emailjsPublicKey); } catch (e) {}
    }

    this.bookBST = new BookBST();
    this.transactionList = new BorrowHistoryLinkedList();
    this.undoStack = new UndoStack();
    this.reservations = {};
    this.chartInstances = {};

    this.books = [];
    this.members = [];
    this.bookRequests = [];
    this.deposits = [];
    this.feedbacks = [];
    this.outbox = [];
    this.history = [];
    this.sentReminders = {}; // Store deduplication reminder keys
    this.searchHistory = [];
    this.currentView = "dashboard";
    this.tempRating = 5;
    this.currentStream = null;

    this.loadState();
    this.init();
  }

  init() {
    this.bookBST.rebuild(this.books);
    this.updateBadgeCounts();
    this.render();
  }

  toggleMobileMenu() {
    const sidebar = document.querySelector(".sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.toggle("mobile-open");
    if (backdrop) backdrop.classList.toggle("active");
  }

  closeMobileMenu() {
    const sidebar = document.querySelector(".sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("mobile-open");
    if (backdrop) backdrop.classList.remove("active");
  }

  navigate(view) {
    this.currentView = view;
    if (view === "history" && this.auditState) { this.auditState.loaded = false; this.auditState.data = null; } // always reload the ledger on entry (never flash stale rows)
    this.closeMobileMenu();
    document.querySelectorAll(".nav-link").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-view") === view);
    });
    this.render();
  }

  getBookCover(book) {
    if (!book) return this.defaultPlaceholder;
    if (book.coverUrl && book.coverUrl.trim().length > 5) {
      return book.coverUrl.trim();
    }
    if (book.isbn && book.isbn.trim().length >= 8) {
      return `https://covers.openlibrary.org/b/isbn/${book.isbn.trim()}-M.jpg`;
    }
    return this.defaultPlaceholder;
  }

  logHistory(action, module, details = {}) {
    const historyID = `PENDING-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date();
    const p2 = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;

    const record = {
      historyID,
      timestamp,
      action,
      module,
      memberID: details.memberID || "N/A",
      memberName: details.memberName || "System User",
      bookID: details.bookID || "N/A",
      bookTitle: details.bookTitle || "N/A",
      transactionID: details.transactionID || "N/A",
      description: details.description || "Administrative execution.",
      oldValue: details.oldValue || "N/A",
      newValue: details.newValue || "N/A",
      performedBy: details.performedBy || "Library Admin",
      status: details.status || "SUCCESS"
    };

    this.history.unshift(record);
    this.saveState();
    this.updateBadgeCounts();

    // Persist browser-originated events to the database ledger (server-side events log themselves)
    if (!details.localOnly && window.LuminaAPI && typeof window.LuminaAPI.recordAudit === "function") {
      window.LuminaAPI.recordAudit({
        action, module,
        memberID: record.memberID, memberName: record.memberName,
        bookID: record.bookID, bookTitle: record.bookTitle, transactionID: record.transactionID,
        description: record.description, oldValue: record.oldValue, newValue: record.newValue, status: record.status
      }).then(res => {
        if (res && res.record) {
          record.historyID = res.record.historyID;
          record.timestamp = res.record.timestamp;
          if (this.auditState) this.auditState.loaded = false;
          if (this.currentView === "history" && typeof this.loadAuditLogs === "function") this.loadAuditLogs();
        }
      }).catch(() => { /* offline: entry stays in local cache */ });
    }
  }

  updateBadgeCounts() {
    const totalWait = Object.values(this.reservations).reduce((acc, q) => acc + q.size(), 0);
    const activeLoans = this.transactionList.toArray().filter(t => t.status === "ISSUED").length;
    const pendingFines = this.transactionList.toArray().filter(t => t.fineAmount > 0 && t.paymentStatus === "UNPAID").length;
    const pendingRequests = this.bookRequests.filter(r => r.status === "PENDING").length;

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT("nav-book-count", this.books.length);
    setT("nav-mem-count", this.members.length);
    setT("nav-loan-count", activeLoans);
    setT("nav-wait-count", totalWait);
    setT("nav-req-count", pendingRequests);
    setT("nav-fine-count", pendingFines);
    setT("nav-mail-count", this.outbox.length);
    setT("nav-hist-count", (this.auditState && typeof this.auditState.totalAll === "number") ? this.auditState.totalAll : this.history.length);
    setT("undo-count", this.undoStack.size());

    const btnUndo = document.getElementById("btn-undo");
    if (btnUndo) btnUndo.disabled = this.undoStack.isEmpty();
  }

  parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  }

  calculateOverdueDays(dueDateStr, returnDateStr = this.todayStr) {
    const due = this.parseLocalDate(dueDateStr);
    const ret = this.parseLocalDate(returnDateStr);
    const diffTime = ret.getTime() - due.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  findBook(id) {
    const bstRes = this.bookBST.search(parseInt(id));
    return bstRes ? bstRes.book : this.books.find(b => b.bookID === parseInt(id));
  }

  findMember(id) {
    return this.members.find(m => m.memberID === id || m.displayID === id);
  }

  handleGlobalSearch(e) {
    const query = e.target.value.trim();
    if (!query) {
      if (this.currentView === 'catalog') this.renderCatalog();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const numID = parseInt(query);
    let bstResult = null;
    if (!isNaN(numID)) {
      bstResult = this.bookBST.search(numID);
    }

    if (this.currentView !== 'catalog') {
      this.navigate('catalog');
    }

    setTimeout(() => {
      const grid = document.querySelector(".catalog-grid");
      const cards = Array.from(document.querySelectorAll(".catalog-grid .book-card-box"));
      if (!grid || cards.length === 0) return;

      let matchCards = [];

      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const matches = text.includes(lowerQuery);
        card.style.display = matches ? "flex" : "none";
        if (matches) {
          // Calculate relevance score: exact title match = 100, exact ID match = 90, starts with = 50, includes = 10
          let score = 10;
          const titleEl = card.querySelector("h4");
          const idEl = card.querySelector(".badge");
          if (titleEl && titleEl.textContent.trim().toLowerCase() === lowerQuery) score += 100;
          else if (titleEl && titleEl.textContent.trim().toLowerCase().startsWith(lowerQuery)) score += 40;
          if (idEl && idEl.textContent.toLowerCase().includes(`#${lowerQuery}`)) score += 90;
          matchCards.push({ card, score });
        }
      });

      matchCards.sort((a, b) => b.score - a.score);
      matchCards.forEach(item => grid.appendChild(item.card));

      if (bstResult) {
        this.showToast(`BST Lookup O(log n): Found ID #${numID} in ${bstResult.hops} search hop(s)!`);
      }
    }, 50);
  }

  executeUndo() {
    if (this.undoStack.isEmpty()) {
      this.showToast("No actions available to undo.", true);
      return;
    }

    const action = this.undoStack.pop();

    if (action.type === "UNDO_ISSUE") {
      const tx = this.transactionList.find(t => t.transactionID === action.transactionID);
      if (tx) tx.status = "CANCELLED";
      const b = this.findBook(action.bookID);
      if (b) b.available++;
      this.logHistory("UNDO_ACTION", "SYSTEM", { description: `Reversed checkout loan #${action.transactionID}.` });
      this.showToast(`Undid loan checkout #${action.transactionID}`);
    } else if (action.type === "UNDO_RETURN") {
      const tx = this.transactionList.find(t => t.transactionID === action.transactionID);
      if (tx) tx.status = "ISSUED";
      const b = this.findBook(action.bookID);
      if (b && b.available > 0) b.available--;
      this.logHistory("UNDO_ACTION", "SYSTEM", { description: `Reversed return for loan #${action.transactionID}.` });
      this.showToast(`Reverted book return for loan #${action.transactionID}`);
    } else if (action.type === "UNDO_DELETE_MEMBER") {
      if (action.member) {
        const restored = action.member;
        if (window.LuminaAPI && typeof window.LuminaAPI.updateMember === "function") {
          window.LuminaAPI.updateMember(restored.memberID, { status: "ACTIVE" })
            .then(() => this.loadState())
            .catch(() => { this.members.push(restored); this.render(); });
        } else {
          this.members.push(restored);
        }
        this.logHistory("UNDO_ACTION", "MEMBERSHIP", { memberID: restored.memberID, memberName: restored.name, description: `Restored deleted member ${restored.name}.` });
        this.showToast(`Restored deleted member ${restored.name}`);
      }
    } else if (action.type === "UNDO_REGISTER") {
      this.members = this.members.filter(m => m.memberID !== action.memberID);
      this.logHistory("UNDO_ACTION", "MEMBERSHIP", { description: `Cancelled member registration #${action.memberID}.` });
      this.showToast(`Undid registration #${action.memberID}`);
    } else if (action.type === "UNDO_ADD_BOOK") {
      this.books = this.books.filter(b => b.bookID !== action.bookID);
      this.bookBST.rebuild(this.books);
      this.logHistory("UNDO_ACTION", "CATALOG", { description: `Removed added book #${action.bookID}.` });
      this.showToast(`Undid adding book #${action.bookID}`);
    }

    this.saveState();
    this.render();
  }

  showToast(msg, isError = false) {
    const tray = document.getElementById("toast-root");
    if (!tray) return;
    const card = document.createElement("div");
    card.className = "toast-card";
    if (isError) card.style.background = "var(--danger)";
    card.innerHTML = `<span>${msg}</span>`;
    tray.appendChild(card);
    setTimeout(() => card.remove(), 4000);
  }

  closeModal() {
    if (this.currentStream) {
      try { this.currentStream.getTracks().forEach(t => t.stop()); } catch(e){}
      this.currentStream = null;
    }
    const modal = document.getElementById("app-modal");
    if (modal) modal.style.display = "none";
  }

  openModal(type, data = {}) {
    const modal = document.getElementById("app-modal");
    const dialog = document.getElementById("modal-content");
    if (!modal || !dialog) return;

    if (type === 'issue-book') {
      dialog.innerHTML = `
        <div style="padding: 24px;">
          <h2 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 16px;">Borrow & Issue Return Desk Authorization</h2>
          <form onsubmit="app.handleIssueForm(event)">
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div>
                <label style="font-size:0.8rem; font-weight:700;">Select Patron</label>
                <select id="modal-issue-member" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px;">
                  ${this.members.map(m => `<option value="${m.memberID}">${m.name} (${m.memberID} - ${m.userType})</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem; font-weight:700;">Select Book Title</label>
                <select id="modal-issue-book" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px;">
                  ${this.books.map(b => `<option value="${b.bookID}" ${data.bookID === b.bookID ? 'selected' : ''}>[ID: #${b.bookID}] ${b.title} (${b.available > 0 ? `${b.available} In Stock` : 'OUT OF STOCK'})</option>`).join('')}
                </select>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:0.8rem; font-weight:700;">Issue Date</label>
                  <input type="date" id="modal-issue-date" value="${this.todayStr}" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px;">
                </div>
                <div>
                  <label style="font-size:0.8rem; font-weight:700;">Due Date (14 Days Standard)</label>
                  <input type="date" id="modal-issue-due" value="${new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0]}" required style="width:100%; padding:8px; border:1px solid var(--border-strong); border-radius:4px;">
                </div>
              </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn" onclick="app.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Authorize Loan</button>
            </div>
          </form>
        </div>
      `;
    } else if (type === 'add-book') {
      const nextBookID = (this.books || []).reduce((m, b) => Math.max(m, Number(b.bookID) || 0), 100) + 1;
      dialog.innerHTML = `
        <div style="padding:24px;">
          <h2 style="font-size:1.25rem; font-weight:800; margin-bottom:16px;">Add New Title to Repository</h2>
          <form onsubmit="app.handleAddBookForm(event)">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div><label style="font-size:0.75rem; font-weight:700;">Book ID</label><input type="number" id="nb-id" min="1" step="1" placeholder="Auto (next free: #${nextBookID})" oninput="app.checkBookIDHint(this.value)" style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"><div id="nb-id-hint" style="font-size:0.7rem; margin-top:3px; color:var(--text-muted);">Type your own ID, or leave empty to auto-assign #${nextBookID}.</div></div>
              <div><label style="font-size:0.75rem; font-weight:700;">Total Copies / Stock</label><input type="number" id="nb-copies" value="5" min="1" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div style="grid-column:span 2;"><label style="font-size:0.75rem; font-weight:700;">Title</label><input type="text" id="nb-title" placeholder="e.g. Modern Software Engineering" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div style="grid-column:span 2;"><label style="font-size:0.75rem; font-weight:700;">Author</label><input type="text" id="nb-author" placeholder="e.g. David Farley" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div><label style="font-size:0.75rem; font-weight:700;">Category</label><input type="text" id="nb-cat" value="Computer Science" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div><label style="font-size:0.75rem; font-weight:700;">ISBN</label><input type="text" id="nb-isbn" value="9780131103627" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div><label style="font-size:0.75rem; font-weight:700;">Shelf Location</label><input type="text" id="nb-shelf" value="CS-05" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              
              <div style="grid-column:span 2;">
                <label style="font-size:0.75rem; font-weight:700;">Cover Image URL (Paste image link here)</label>
                <input type="url" id="nb-coverurl" placeholder="https://images.unsplash.com/photo-1543002588-bfa74002ed7e" style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;">
              </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn" onclick="app.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save to Catalog</button>
            </div>
          </form>
        </div>
      `;
    } else if (type === 'add-member') {
      const nextID = `STU-${Math.floor(100 + Math.random() * 900)}`;
      dialog.innerHTML = `
        <div style="padding:24px;">
          <h2 style="font-size:1.25rem; font-weight:800; margin-bottom:8px;">Biometric Membership Enrollment</h2>
          <div class="camera-box">
            <video id="live-camera-feed" class="camera-preview" autoplay playsinline muted></video>
            <img id="captured-face-preview" class="camera-preview" style="display:none; border:2px solid var(--success);" />
            <div style="display:flex; gap:8px; align-items:center; justify-content:center; margin-top:8px;">
              <button type="button" class="btn btn-sm btn-primary" onclick="event.preventDefault(); event.stopPropagation(); app.captureFacePhoto(event)">📸 Snap Face Photo</button>
              <span id="face-captured-status" style="font-size:0.75rem; color:var(--text-muted);">Initializing Camera...</span>
            </div>
          </div>
          <form onsubmit="app.handleAddMemberForm(event)">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div><label style="font-size:0.75rem; font-weight:700;">Member ID</label><input type="text" id="nm-id" value="${nextID}" readonly style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div>
                <label style="font-size:0.75rem; font-weight:700;">Role Type</label>
                <select id="nm-type" style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;">
                  <option value="Student">Student</option>
                  <option value="Faculty">Teacher / Faculty</option>
                  <option value="Researcher">Researcher</option>
                  <option value="External Visitor">External Visitor</option>
                </select>
              </div>
              <div style="grid-column:span 2;"><label style="font-size:0.75rem; font-weight:700;">Full Legal Name</label><input type="text" id="nm-name" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div><label style="font-size:0.75rem; font-weight:700;">Email Address</label><input type="email" id="nm-email" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div><label style="font-size:0.75rem; font-weight:700;">Phone Number</label><input type="text" id="nm-phone" value="+91 " required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
              <div style="grid-column:span 2;"><label style="font-size:0.75rem; font-weight:700;">Department / Organization</label><input type="text" id="nm-dept" value="Computer Science" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;"></div>
            </div>
            <input type="hidden" id="m-photo-data" value="">
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn" onclick="app.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Complete Registration & Email</button>
            </div>
          </form>
        </div>
      `;
      setTimeout(() => {
        if (typeof this.startLiveCamera === 'function') {
          this.startLiveCamera("live-camera-feed");
        }
      }, 150);
    } else if (type === 'user-book-request') {
      dialog.innerHTML = `
        <div style="padding:24px;">
          <h2 style="font-size:1.25rem; font-weight:800; margin-bottom:16px;">Request Unavailable Title & Join Priority Waitlist</h2>
          <form onsubmit="app.handleUserBookRequestForm(event)">
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div>
                <label style="font-size:0.75rem; font-weight:700;">Book Title</label>
                <input type="text" id="ubr-title" placeholder="Full title of requested book" value="${data.title || ''}" required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;">
              </div>
              <div>
                <label style="font-size:0.75rem; font-weight:700;">Author(s)</label>
                <input type="text" id="ubr-author" placeholder="Author name" style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;">
              </div>
              <div>
                <label style="font-size:0.75rem; font-weight:700;">Select Requesting Patron</label>
                <select id="ubr-member" style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px;">
                  ${this.members.map(m => `<option value="${m.memberID}">${m.name} (${m.memberID} - ${m.email})</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="font-size:0.75rem; font-weight:700;">Reason for Request</label>
                <textarea id="ubr-reason" rows="2" placeholder="Course project reference, thesis research, curriculum recommendation..." required style="width:100%; padding:7px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main);"></textarea>
              </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn" onclick="app.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit Request & Add to Waitlist</button>
            </div>
          </form>
        </div>
      `;
    }

    modal.style.display = "grid";
  }

  render() {
    const container = document.getElementById("main-content");
    if (!container) return;
    switch (this.currentView) {
      case "dashboard":
        container.innerHTML = this.renderDashboard();
        this.initDashboardCharts();
        break;
      case "catalog":
        container.innerHTML = this.renderCatalog();
        break;
      case "membership":
        container.innerHTML = this.renderMembership();
        break;
      case "circulation":
        container.innerHTML = this.renderCirculation();
        break;
      case "waiting-list":
        container.innerHTML = this.renderWaitingList();
        break;
      case "book-request":
        container.innerHTML = this.renderBookRequest();
        break;
      case "member-history":
        container.innerHTML = this.renderMemberHistory();
        break;
      case "book-history":
        container.innerHTML = this.renderBookHistory();
        break;
      case "payments":
        container.innerHTML = this.renderPayments();
        break;
      case "deposits":
        container.innerHTML = this.renderDeposits();
        break;
      case "email-dispatch":
        container.innerHTML = this.renderEmailDispatch();
        break;
      case "history":
        container.innerHTML = this.renderHistory();
        break;
      case "analytics":
        container.innerHTML = this.renderAnalytics();
        this.initAnalyticsCharts();
        break;
    }
    this.updateBadgeCounts();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new LuminaLibrary();
});
