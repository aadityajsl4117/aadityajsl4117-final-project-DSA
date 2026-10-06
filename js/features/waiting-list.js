/* WAITING LIST & FIFO HOLD QUEUE FEATURE MODULE
 * One simple table: Position | Member | Member ID | Book | Requested | Status | Action
 * - Positions count per book (1, 2, 3 …) and renumber automatically after a cancel/grant
 * - GRANT on the member at Position 1, CANCEL on every row (with confirmation + reason)
 */

LuminaLibrary.prototype.wlEsc = function(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};

/** Safe for use inside a single-quoted JS string within an HTML attribute */
LuminaLibrary.prototype.wlJs = function(v) {
  return this.wlEsc(String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
};

/* ---------- data: one entry per waiting member, grouped by book, ordered by position ---------- */
LuminaLibrary.prototype.getWaitlistGroups = function() {
  const groups = [];
  Object.keys(this.reservations || {}).forEach(bID => {
    const queue = this.reservations[bID];
    if (!queue || queue.isEmpty()) return;
    const book = this.findBook(bID);
    const items = queue.toArray();

    const entries = items.map((item, idx) => {
      const memberID = typeof item === "object" ? item.memberID : item;
      const reqDate = typeof item === "object" && item.dateJoined ? item.dateJoined : (this.todayStr || "");
      const member = this.findMember(memberID);
      return {
        pos: idx + 1,
        total: items.length,
        memberID,
        memberName: member ? member.name : memberID,
        known: !!member,
        reqDate
      };
    });

    groups.push({
      bookID: bID,
      title: book ? book.title : `Book #${bID}`,
      available: book ? book.available : 0,
      copies: book ? book.copies : 0,
      entries
    });
  });
  groups.sort((a, b) => Number(a.bookID) - Number(b.bookID));
  return groups;
};

/* ---------- rendering ---------- */
LuminaLibrary.prototype.renderWaitingList = function() {
  const groups = this.getWaitlistGroups();
  const total = groups.reduce((n, g) => n + g.entries.length, 0);

  let body = "";
  if (total === 0) {
    body = `<tr><td colspan="7" style="text-align:center; padding:28px; color:var(--text-muted);">No active reservations. All catalog titles are available on shelf.</td></tr>`;
  } else {
    body = groups.map(g => g.entries.map((e, i) => `
      <tr class="${i === 0 ? "wl-group-start" : ""}">
        <td class="wl-pos-cell"><strong>Position ${e.pos}</strong></td>
        <td><strong>${this.wlEsc(e.memberName)}</strong>${e.known ? "" : ` <span class="badge badge-warning" title="This member is no longer in the member directory">not in directory</span>`}</td>
        <td><code>${this.wlEsc(e.memberID)}</code></td>
        <td><strong>${this.wlEsc(g.title)}</strong><br><small style="color:var(--text-muted);">ID: #${this.wlEsc(g.bookID)}</small></td>
        <td>${this.wlEsc(e.reqDate)}</td>
        <td><span class="badge badge-warning">WAITING</span></td>
        <td class="wl-actions">
          ${e.pos === 1 ? `<button class="btn btn-sm btn-primary" onclick="app.confirmGrantHold(${Number(g.bookID)})">Grant</button>` : ""}
          <button class="btn btn-sm btn-outline-danger" onclick="app.openCancelWaitlistModal(${Number(g.bookID)}, '${this.wlJs(e.memberID)}')">Cancel</button>
        </td>
      </tr>`).join("")).join("");
  }

  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Waiting List</h1>
        <p class="page-subtext">Manage waiting list reservations</p>
      </div>
      <button class="btn btn-primary" onclick="app.openJoinWaitingListModal()">+ Add to Waiting List</button>
    </div>

    <div class="content-card">
      <div class="card-header-bar">
        <h3>Active Member Reservations (${total} Waiting Member${total === 1 ? "" : "s"})</h3>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th>Position</th>
            <th>Member Name</th>
            <th>Member ID</th>
            <th>Book Title & ID</th>
            <th>Requested Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
};

/* ---------- join modal ---------- */
LuminaLibrary.prototype.openJoinWaitingListModal = function(selectedBookID, selectedMemberID) {
  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  const bookOptions = this.books.map(b => {
    const isOut = b.available <= 0;
    const selected = (selectedBookID && parseInt(selectedBookID) === b.bookID) ? "selected" : "";
    return `<option value="${b.bookID}" ${selected}>#${b.bookID} - ${this.wlEsc(b.title)} (${b.available} of ${b.copies} available) ${isOut ? "⚠️ OUT OF STOCK" : ""}</option>`;
  }).join("");

  const memberOptions = this.members.map(m => {
    const selected = (selectedMemberID && selectedMemberID === m.memberID) ? "selected" : "";
    return `<option value="${this.wlEsc(m.memberID)}" ${selected}>${this.wlEsc(m.name)} (${this.wlEsc(m.memberID)} - ${this.wlEsc(m.userType)})</option>`;
  }).join("");

  dialog.innerHTML = `
    <div style="padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="font-size:1.25rem; font-weight:800;">Join Book Waiting List</h2>
        <span class="badge badge-warning">Priority Hold</span>
      </div>

      <form onsubmit="app.handleJoinWaitingListForm(event)">
        <div style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Select Book</label>
            <select id="wl-book-id" required onchange="app.updateWaitlistPositionHint()" style="width:100%; padding:9px; border:1px solid var(--border-strong); border-radius:var(--radius-sm);">
              <option value="">-- Choose Book --</option>
              ${bookOptions}
            </select>
          </div>

          <div>
            <label style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Select Member</label>
            <select id="wl-member-id" required onchange="app.updateWaitlistPositionHint()" style="width:100%; padding:9px; border:1px solid var(--border-strong); border-radius:var(--radius-sm);">
              <option value="">-- Choose Member --</option>
              ${memberOptions}
            </select>
          </div>

          <div id="wl-position-hint" class="wl-hint">Choose a book to see the queue position this member will get.</div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn" onclick="app.closeModal()">Close</button>
          <button type="submit" class="btn btn-primary">Add to Waiting List</button>
        </div>
      </form>
    </div>
  `;
  modal.style.display = "grid";
  this.updateWaitlistPositionHint();
};

LuminaLibrary.prototype.updateWaitlistPositionHint = function() {
  const hint = document.getElementById("wl-position-hint");
  const bookSel = document.getElementById("wl-book-id");
  const memSel = document.getElementById("wl-member-id");
  if (!hint || !bookSel) return;

  const bookID = parseInt(bookSel.value);
  if (!bookID) { hint.className = "wl-hint"; hint.textContent = "Choose a book to see the queue position this member will get."; return; }

  const book = this.findBook(bookID);
  const queue = this.reservations[bookID];
  const items = queue && !queue.isEmpty() ? queue.toArray() : [];
  const ids = items.map(it => typeof it === "object" ? it.memberID : it);
  const memberID = memSel ? memSel.value : "";

  if (memberID && ids.includes(memberID)) {
    hint.className = "wl-hint wl-hint-warn";
    hint.innerHTML = `⚠️ This member is already <strong>Position ${ids.indexOf(memberID) + 1}</strong> on this book's waiting list.`;
    return;
  }
  const next = items.length + 1;
  let html = `🎟️ This member will be placed at <strong>Position ${next}</strong>` +
             (items.length ? ` (${items.length} ahead of them).` : ` — first in line.`);
  if (book && book.available > 0) html += `<br>📗 Note: ${book.available} cop${book.available === 1 ? "y is" : "ies are"} currently available, so the member could borrow it directly.`;
  hint.className = "wl-hint";
  hint.innerHTML = html;
};

LuminaLibrary.prototype.handleJoinWaitingListForm = async function(e) {
  if (e) e.preventDefault();
  const bookID = parseInt(document.getElementById("wl-book-id").value);
  const memberID = document.getElementById("wl-member-id").value.trim();

  if (!bookID || !memberID) {
    this.showToast("Please select both a book and a member.", true);
    return;
  }

  if (window.LuminaAPI) {
    try {
      const res = await window.LuminaAPI.joinWaitingList({ bookID, memberID });
      if (res && res.success) {
        const m = this.findMember(memberID);
        this.showToast(`${m ? m.name : memberID} joined the waiting list at Position ${res.position}!`);
        this.closeModal();
        await this.loadState();
        return;
      }
    } catch (err) {
      if (!this.wlIsOffline(err)) {
        this.showToast(err.message || "Could not add member to the waiting list.", true);
        return;
      }
    }
  }

  // Offline fallback
  const queue = this.reservations[bookID] || new FIFOQueue();
  const isDuplicate = queue.toArray().some(item => (typeof item === "object" ? item.memberID : item) === memberID);
  if (isDuplicate) { this.showToast("Member is already on the waiting list for this book!", true); return; }

  queue.enqueue({ memberID, dateJoined: this.todayStr });
  this.reservations[bookID] = queue;
  this.showToast(`Joined waiting list at Position ${queue.size()}!`);
  this.closeModal();
  this.saveState();
  this.render();
};

/* ---------- grant ---------- */
LuminaLibrary.prototype.wlIsOffline = function(err) {
  return err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(err && err.message));
};

LuminaLibrary.prototype.confirmGrantHold = function(bID) {
  const g = this.getWaitlistGroups().find(x => String(x.bookID) === String(bID));
  if (!g) { this.showToast("This queue no longer exists.", true); this.render(); return; }
  const first = g.entries[0];
  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");
  const warn = g.available <= 0
    ? `<div class="wl-hint wl-hint-warn" style="margin-top:12px;">⚠️ All copies are currently issued. Granting now reserves the next copy for ${this.wlEsc(first.memberName)} when it is returned.</div>`
    : `<div class="wl-hint" style="margin-top:12px;">📗 ${g.available} cop${g.available === 1 ? "y is" : "ies are"} available on the shelf.</div>`;

  dialog.innerHTML = `
    <div style="padding:24px;">
      <h2 style="font-size:1.2rem; font-weight:800; margin-bottom:8px;">Grant hold to next in line?</h2>
      <p style="color:var(--text-body); font-size:0.9rem;"><strong>${this.wlEsc(first.memberName)}</strong> (<code>${this.wlEsc(first.memberID)}</code>) will be served for <strong>${this.wlEsc(g.title)}</strong>.
      ${g.entries.length > 1 ? `The remaining ${g.entries.length - 1} member${g.entries.length - 1 === 1 ? "" : "s"} will each move up one position.` : ""}</p>
      ${warn}
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button class="btn" onclick="app.closeModal()">Not now</button>
        <button class="btn btn-primary" onclick="app.manualGrantHold(${Number(bID)})">Yes, Grant Hold</button>
      </div>
    </div>`;
  modal.style.display = "grid";
};

LuminaLibrary.prototype.manualGrantHold = async function(bID) {
  if (window.LuminaAPI) {
    try {
      const res = await window.LuminaAPI.serveWaitingList({ bookID: bID });
      const m = res && res.servedMemberID ? this.findMember(res.servedMemberID) : null;
      this.showToast(`Hold granted to ${m ? m.name : (res && res.servedMemberID) || "next patron"}.`);
      this.closeModal();
      await this.loadState();
      return;
    } catch (err) {
      if (!this.wlIsOffline(err)) {
        this.showToast(err.message || "Could not grant hold.", true);
        this.closeModal();
        await this.loadState();
        return;
      }
    }
  }

  const queue = this.reservations[bID];
  if (!queue || queue.isEmpty()) { this.showToast("No patrons currently on hold waitlist.", true); return; }

  const holdItem = queue.dequeue();
  const memberID = typeof holdItem === "object" ? holdItem.memberID : holdItem;
  const member = this.findMember(memberID);
  const book = this.findBook(bID);

  this.logHistory("GRANT_HOLD", "WAITING_LIST", {
    memberID,
    memberName: member ? member.name : memberID,
    bookID: bID,
    bookTitle: book ? book.title : `Book #${bID}`,
    description: `Granted priority hold reservation to ${member ? member.name : memberID}.`
  });

  this.showToast(`Granted hold to ${member ? member.name : memberID}.`);
  this.closeModal();
  this.saveState();
  this.render();
};

/* ---------- cancel ---------- */
LuminaLibrary.prototype.openCancelWaitlistModal = function(bID, memberID) {
  const g = this.getWaitlistGroups().find(x => String(x.bookID) === String(bID));
  if (!g) { this.showToast("This queue no longer exists.", true); this.render(); return; }

  const all = memberID === "ALL";
  const entry = all ? null : g.entries.find(e => e.memberID === memberID);
  if (!all && !entry) { this.showToast("That request is no longer in the queue.", true); this.render(); return; }

  const behind = all ? 0 : g.entries.length - entry.pos;
  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  dialog.innerHTML = `
    <div style="padding:24px;">
      <h2 style="font-size:1.2rem; font-weight:800; margin-bottom:8px;">${all ? "Clear entire waiting list?" : "Cancel waiting-list request?"}</h2>
      ${all
        ? `<p style="color:var(--text-body); font-size:0.9rem;">All <strong>${g.entries.length}</strong> members waiting for <strong>${this.wlEsc(g.title)}</strong> will be removed from the queue.</p>`
        : `<p style="color:var(--text-body); font-size:0.9rem;"><strong>${this.wlEsc(entry.memberName)}</strong> (<code>${this.wlEsc(entry.memberID)}</code>) is <strong>Position ${entry.pos} of ${entry.total}</strong> for <strong>${this.wlEsc(g.title)}</strong>.
           ${behind > 0 ? `<br>The ${behind} member${behind === 1 ? "" : "s"} behind will each move up one position.` : ""}</p>`}
      <div style="margin-top:14px;">
        <label style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Reason (saved in the audit log)</label>
        <select id="wl-cancel-reason" style="width:100%; padding:9px; border:1px solid var(--border-strong); border-radius:var(--radius-sm);">
          <option>Member requested cancellation</option>
          <option>Member no longer needs the book</option>
          <option>Book obtained another way</option>
          <option>Duplicate or mistaken entry</option>
          <option>Member account issue</option>
          <option>Other / administrative</option>
        </select>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button class="btn" onclick="app.closeModal()">Keep in queue</button>
        <button class="btn btn-danger" id="wl-cancel-confirm" onclick="app.executeCancelWaitlist(${Number(bID)}, '${this.wlJs(memberID)}')">${all ? "Yes, Clear Queue" : "Yes, Cancel Request"}</button>
      </div>
    </div>`;
  modal.style.display = "grid";
};

LuminaLibrary.prototype.executeCancelWaitlist = async function(bID, memberID) {
  const reasonEl = document.getElementById("wl-cancel-reason");
  const reason = reasonEl ? reasonEl.value : "";
  const btn = document.getElementById("wl-cancel-confirm");
  if (btn) { btn.disabled = true; btn.textContent = "Cancelling…"; }
  const all = memberID === "ALL";
  const member = all ? null : this.findMember(memberID);
  const label = all ? "the whole queue" : (member ? member.name : memberID);

  if (window.LuminaAPI) {
    try {
      await window.LuminaAPI.cancelWaitingList({ bookID: bID, memberID, reason });
      this.showToast(all ? "Waiting list cleared." : `Removed ${label} from the waiting list.`);
      this.closeModal();
      await this.loadState();
      return;
    } catch (err) {
      if (!this.wlIsOffline(err)) {
        this.showToast(err.message || "Could not cancel the request.", true);
        this.closeModal();
        await this.loadState(); // resync: the entry may already have been removed elsewhere
        return;
      }
    }
  }

  // Offline fallback
  const queue = this.reservations[bID];
  if (queue && !queue.isEmpty()) {
    const kept = all ? [] : queue.toArray().filter(item => (typeof item === "object" ? item.memberID : item) !== memberID);
    const newQueue = new queue.constructor();
    kept.forEach(item => newQueue.enqueue(item));
    this.reservations[bID] = newQueue;
  }
  const book = this.findBook(bID);
  this.logHistory("CANCEL_WAITLIST", "WAITING_LIST", {
    memberID: all ? "N/A" : memberID, memberName: member ? member.name : (all ? "System User" : memberID),
    bookID: bID, bookTitle: book ? book.title : `Book #${bID}`,
    description: (all ? "Cleared the waiting list" : `Cancelled waitlist request for ${label}`) + (reason ? `. Reason: ${reason}.` : "."),
    localOnly: false
  });
  this.showToast(all ? "Waiting list cleared." : `Removed ${label} from the waiting list.`);
  this.closeModal();
  this.saveState();
  this.render();
};

/* kept for backward compatibility with any older onclick handlers */
LuminaLibrary.prototype.cancelHoldReservation = function(bID, memberID) {
  this.openCancelWaitlistModal(bID, memberID);
};
