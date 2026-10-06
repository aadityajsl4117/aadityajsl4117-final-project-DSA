/* BOOK CUSTODY & CIRCULATION HISTORY FEATURE MODULE */
function extractIsoDateStr(dateStr) {
  if (!dateStr) return '';
  const match = String(dateStr).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

LuminaLibrary.prototype.renderBookHistory = function() {
  const allTransactions = this.transactionList.toArray();
  this._bookHistoryFilterState = this._bookHistoryFilterState || { bookID: 'ALL', mode: 'ALL', targetDate: '' };

  return `
    <div class="page-title-row" style="flex-wrap:wrap; gap:12px;">
      <div>
        <h1 class="page-heading">Book Custody & History</h1>
        <p class="page-subtext">Track who took each book, checkout timestamp, return timestamp, and current custody status</p>
      </div>

      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="book-history-filter" onchange="app.filterBookHistory()" style="padding:8px 12px; border:1px solid var(--border-strong); border-radius:var(--radius-sm); font-family:var(--font-main); font-size:0.82rem;">
          <option value="ALL">All Catalog Titles</option>
          ${this.books.map(b => `<option value="${b.bookID}">[#${b.bookID}] ${b.title}</option>`).join('')}
        </select>

        <div style="display:flex; gap:6px; align-items:center; background:var(--bg-card-subtle); padding:4px 8px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          <label style="font-size:0.75rem; font-weight:700; white-space:nowrap; color:var(--text-body);">SELECT DATE:</label>
          <input type="date" id="book-history-date-input" style="padding:5px 8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main); font-size:0.8rem;" />
          <button class="btn btn-sm btn-primary" onclick="app.filterBookHistoryByDateInput()">SEARCH</button>
        </div>

        <div style="display:flex; gap:4px; flex-wrap:wrap;">
          <button class="btn btn-sm" onclick="app.filterBookHistoryPreset('TODAY')">TODAY</button>
          <button class="btn btn-sm" onclick="app.filterBookHistoryPreset('WEEK')">THIS WEEK</button>
          <button class="btn btn-sm" onclick="app.filterBookHistoryPreset('MONTH')">THIS MONTH</button>
          <button class="btn btn-sm" style="background:var(--bg-muted); color:var(--text-main);" onclick="app.resetBookHistoryFilters()">ALL HISTORY</button>
        </div>
      </div>
    </div>

    <div class="content-card">
      <table class="custom-table" id="book-history-table">
        <thead>
          <tr>
            <th>Book ID</th>
            <th>Book Title</th>
            <th>Borrower / Patron</th>
            <th>Issue Date</th>
            <th>Due Date</th>
            <th>Return Date</th>
            <th>Custody Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${allTransactions.map(t => {
            const book = this.findBook(t.bookID);
            const isIssued = t.status === "ISSUED";
            const issueIso = extractIsoDateStr(t.issueDate);
            const returnIso = extractIsoDateStr(t.returnDate);
            const dueIso = extractIsoDateStr(t.dueDate);
            return `
              <tr data-book="${t.bookID}" data-issue-date="${issueIso}" data-return-date="${returnIso}" data-due-date="${dueIso}">
                <td><code>#${t.bookID}</code></td>
                <td><strong>${t.bookTitle}</strong></td>
                <td>${t.memberName} (<code>${t.memberID}</code>)</td>
                <td>${t.issueDate}</td>
                <td>${t.dueDate}</td>
                <td>${t.returnDate ? t.returnDate : '—'}</td>
                <td>
                  ${isIssued ? `<span class="badge badge-warning">In Custody of ${t.memberName}</span>` : `<span class="badge badge-success">On Shelf (${book ? book.shelf : 'Desk'})</span>`}
                </td>
                <td>
                  <button class="btn btn-sm" onclick="app.showTransactionTimeline('${t.transactionID}')">Timeline</button>
                </td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="8" style="text-align:center;">No circulation records found.</td></tr>`}
          <tr id="no-book-history-row" style="display:none;">
            <td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted); font-weight:600;">No book history found for this date.</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

LuminaLibrary.prototype.filterBookHistory = function(bookIDArg, dateModeArg, targetDateArg) {
  const sel = document.getElementById("book-history-filter");
  const selectedBookID = bookIDArg !== undefined ? String(bookIDArg) : (sel ? sel.value : "ALL");

  if (!this._bookHistoryFilterState) {
    this._bookHistoryFilterState = { bookID: 'ALL', mode: 'ALL', targetDate: '' };
  }
  if (bookIDArg !== undefined) this._bookHistoryFilterState.bookID = selectedBookID;
  if (dateModeArg !== undefined) this._bookHistoryFilterState.mode = dateModeArg;
  if (targetDateArg !== undefined) this._bookHistoryFilterState.targetDate = targetDateArg;

  const mode = this._bookHistoryFilterState.mode || 'ALL';
  const targetDate = this._bookHistoryFilterState.targetDate || '';

  const now = new Date();
  const todayIso = extractIsoDateStr(now.toISOString());
  const yearMonthIso = todayIso.substring(0, 7);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoIso = extractIsoDateStr(sevenDaysAgo.toISOString());

  const rows = document.querySelectorAll("#book-history-table tbody tr:not(#no-book-history-row)");
  let visibleCount = 0;

  rows.forEach(r => {
    const rBook = r.getAttribute("data-book");
    const rIssue = r.getAttribute("data-issue-date") || '';
    const rReturn = r.getAttribute("data-return-date") || '';
    const rDue = r.getAttribute("data-due-date") || '';

    const matchesBook = (selectedBookID === "ALL" || rBook === selectedBookID);
    let matchesDate = true;

    if (mode === 'DATE' && targetDate) {
      matchesDate = (rIssue === targetDate || rReturn === targetDate || rDue === targetDate);
    } else if (mode === 'TODAY') {
      matchesDate = (rIssue === todayIso || rReturn === todayIso || rDue === todayIso);
    } else if (mode === 'WEEK') {
      const dates = [rIssue, rReturn, rDue].filter(Boolean);
      matchesDate = dates.some(d => d >= sevenDaysAgoIso && d <= todayIso);
    } else if (mode === 'MONTH') {
      const dates = [rIssue, rReturn, rDue].filter(Boolean);
      matchesDate = dates.some(d => d.startsWith(yearMonthIso));
    }

    const show = matchesBook && matchesDate;
    r.style.display = show ? "" : "none";
    if (show) visibleCount++;
  });

  const noMsgRow = document.getElementById("no-book-history-row");
  if (noMsgRow) {
    noMsgRow.style.display = (visibleCount === 0) ? "" : "none";
  }
};

LuminaLibrary.prototype.filterBookHistoryByDateInput = function() {
  const dateInput = document.getElementById("book-history-date-input");
  const val = dateInput ? dateInput.value.trim() : "";
  if (!val) {
    if (typeof this.showToast === 'function') this.showToast('Please select a valid date first', true);
    return;
  }
  this.filterBookHistory(undefined, 'DATE', val);
};

LuminaLibrary.prototype.filterBookHistoryPreset = function(preset) {
  const dateInput = document.getElementById("book-history-date-input");
  if (preset === 'TODAY') {
    const todayIso = extractIsoDateStr(new Date().toISOString());
    if (dateInput) dateInput.value = todayIso;
    this.filterBookHistory(undefined, 'DATE', todayIso);
  } else if (preset === 'WEEK') {
    if (dateInput) dateInput.value = '';
    this.filterBookHistory(undefined, 'WEEK', '');
  } else if (preset === 'MONTH') {
    if (dateInput) dateInput.value = '';
    this.filterBookHistory(undefined, 'MONTH', '');
  }
};

LuminaLibrary.prototype.resetBookHistoryFilters = function() {
  const sel = document.getElementById("book-history-filter");
  if (sel) sel.value = 'ALL';
  const dateInput = document.getElementById("book-history-date-input");
  if (dateInput) dateInput.value = '';
  this._bookHistoryFilterState = { bookID: 'ALL', mode: 'ALL', targetDate: '' };
  this.filterBookHistory('ALL', 'ALL', '');
};

LuminaLibrary.prototype.showSingleBookHistory = function(bookID) {
  this.navigate('book-history');
  setTimeout(() => {
    const sel = document.getElementById("book-history-filter");
    if (sel) { sel.value = String(bookID); this.filterBookHistory(String(bookID)); }
  }, 50);
};
