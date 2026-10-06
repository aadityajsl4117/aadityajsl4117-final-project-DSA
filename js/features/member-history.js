/* MEMBER LIFETIME BORROWING HISTORY FEATURE MODULE */
if (typeof extractIsoDateStr !== 'function') {
  function extractIsoDateStr(dateStr) {
    if (!dateStr) return '';
    const match = String(dateStr).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }
}

LuminaLibrary.prototype.renderMemberHistory = function() {
  const allTransactions = this.transactionList.toArray();
  this._memberHistoryFilterState = this._memberHistoryFilterState || { memberID: 'ALL', mode: 'ALL', targetDate: '' };

  return `
    <div class="page-title-row" style="flex-wrap:wrap; gap:12px;">
      <div>
        <h1 class="page-heading">Member Lifetime History Ledger</h1>
        <p class="page-subtext">Complete patron borrowing record, active loans, returned volumes, and fine status</p>
      </div>

      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="member-history-filter" onchange="app.filterMemberHistory()" style="padding:8px 12px; border:1px solid var(--border-strong); border-radius:var(--radius-sm); font-family:var(--font-main); font-size:0.82rem;">
          <option value="ALL">All Patrons</option>
          ${this.members.map(m => `<option value="${m.memberID}">${m.name} (${m.memberID})</option>`).join('')}
        </select>

        <div style="display:flex; gap:6px; align-items:center; background:var(--bg-card-subtle); padding:4px 8px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          <label style="font-size:0.75rem; font-weight:700; white-space:nowrap; color:var(--text-body);">SELECT DATE:</label>
          <input type="date" id="member-history-date-input" style="padding:5px 8px; border:1px solid var(--border-strong); border-radius:4px; font-family:var(--font-main); font-size:0.8rem;" />
          <button class="btn btn-sm btn-primary" onclick="app.filterMemberHistoryByDateInput()">SEARCH</button>
        </div>

        <div style="display:flex; gap:4px; flex-wrap:wrap;">
          <button class="btn btn-sm" onclick="app.filterMemberHistoryPreset('TODAY')">TODAY</button>
          <button class="btn btn-sm" onclick="app.filterMemberHistoryPreset('WEEK')">THIS WEEK</button>
          <button class="btn btn-sm" onclick="app.filterMemberHistoryPreset('MONTH')">THIS MONTH</button>
          <button class="btn btn-sm" style="background:var(--bg-muted); color:var(--text-main);" onclick="app.resetMemberHistoryFilters()">ALL HISTORY</button>
        </div>
      </div>
    </div>

    <div class="content-card">
      <table class="custom-table" id="member-history-table">
        <thead>
          <tr>
            <th>Loan ID</th>
            <th>Patron Name</th>
            <th>Member ID</th>
            <th>Book Title</th>
            <th>Issue Date</th>
            <th>Due Date</th>
            <th>Return Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${allTransactions.map(t => {
            const isLate = t.status === "ISSUED" && this.calculateOverdueDays(t.dueDate) > 0;
            const issueIso = extractIsoDateStr(t.issueDate);
            const returnIso = extractIsoDateStr(t.returnDate);
            const dueIso = extractIsoDateStr(t.dueDate);
            return `
              <tr data-member="${t.memberID}" data-issue-date="${issueIso}" data-return-date="${returnIso}" data-due-date="${dueIso}">
                <td><code>${t.transactionID}</code></td>
                <td><strong>${t.memberName}</strong></td>
                <td>${t.memberID}</td>
                <td><strong>${t.bookTitle}</strong> (ID: #${t.bookID})</td>
                <td>${t.issueDate}</td>
                <td>${t.dueDate}</td>
                <td>${t.returnDate ? `<span style="color:var(--success); font-weight:700;">${t.returnDate}</span>` : '<span style="color:var(--warning); font-weight:700;">Active Loan</span>'}</td>
                <td>
                  ${t.status === 'RETURNED' ? `<span class="badge badge-success">RETURNED</span>` : 
                    (isLate ? `<span class="badge badge-danger">OVERDUE</span>` : `<span class="badge badge-warning">ON LOAN</span>`)}
                </td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="8" style="text-align:center;">No member records found.</td></tr>`}
          <tr id="no-member-history-row" style="display:none;">
            <td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted); font-weight:600;">No member history found for this date.</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

LuminaLibrary.prototype.filterMemberHistory = function(memberIDArg, dateModeArg, targetDateArg) {
  const sel = document.getElementById("member-history-filter");
  const selectedMemberID = memberIDArg !== undefined ? String(memberIDArg) : (sel ? sel.value : "ALL");

  if (!this._memberHistoryFilterState) {
    this._memberHistoryFilterState = { memberID: 'ALL', mode: 'ALL', targetDate: '' };
  }
  if (memberIDArg !== undefined) this._memberHistoryFilterState.memberID = selectedMemberID;
  if (dateModeArg !== undefined) this._memberHistoryFilterState.mode = dateModeArg;
  if (targetDateArg !== undefined) this._memberHistoryFilterState.targetDate = targetDateArg;

  const mode = this._memberHistoryFilterState.mode || 'ALL';
  const targetDate = this._memberHistoryFilterState.targetDate || '';

  const now = new Date();
  const todayIso = extractIsoDateStr(now.toISOString());
  const yearMonthIso = todayIso.substring(0, 7);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoIso = extractIsoDateStr(sevenDaysAgo.toISOString());

  const rows = document.querySelectorAll("#member-history-table tbody tr:not(#no-member-history-row)");
  let visibleCount = 0;

  rows.forEach(r => {
    const rMember = r.getAttribute("data-member");
    const rIssue = r.getAttribute("data-issue-date") || '';
    const rReturn = r.getAttribute("data-return-date") || '';
    const rDue = r.getAttribute("data-due-date") || '';

    const matchesMember = (selectedMemberID === "ALL" || rMember === selectedMemberID);
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

    const show = matchesMember && matchesDate;
    r.style.display = show ? "" : "none";
    if (show) visibleCount++;
  });

  const noMsgRow = document.getElementById("no-member-history-row");
  if (noMsgRow) {
    noMsgRow.style.display = (visibleCount === 0) ? "" : "none";
  }
};

LuminaLibrary.prototype.filterMemberHistoryByDateInput = function() {
  const dateInput = document.getElementById("member-history-date-input");
  const val = dateInput ? dateInput.value.trim() : "";
  if (!val) {
    if (typeof this.showToast === 'function') this.showToast('Please select a valid date first', true);
    return;
  }
  this.filterMemberHistory(undefined, 'DATE', val);
};

LuminaLibrary.prototype.filterMemberHistoryPreset = function(preset) {
  const dateInput = document.getElementById("member-history-date-input");
  if (preset === 'TODAY') {
    const todayIso = extractIsoDateStr(new Date().toISOString());
    if (dateInput) dateInput.value = todayIso;
    this.filterMemberHistory(undefined, 'DATE', todayIso);
  } else if (preset === 'WEEK') {
    if (dateInput) dateInput.value = '';
    this.filterMemberHistory(undefined, 'WEEK', '');
  } else if (preset === 'MONTH') {
    if (dateInput) dateInput.value = '';
    this.filterMemberHistory(undefined, 'MONTH', '');
  }
};

LuminaLibrary.prototype.resetMemberHistoryFilters = function() {
  const sel = document.getElementById("member-history-filter");
  if (sel) sel.value = 'ALL';
  const dateInput = document.getElementById("member-history-date-input");
  if (dateInput) dateInput.value = '';
  this._memberHistoryFilterState = { memberID: 'ALL', mode: 'ALL', targetDate: '' };
  this.filterMemberHistory('ALL', 'ALL', '');
};

LuminaLibrary.prototype.showSingleMemberHistory = function(memberID) {
  this.navigate('member-history');
  setTimeout(() => {
    const sel = document.getElementById("member-history-filter");
    if (sel) { sel.value = String(memberID); this.filterMemberHistory(String(memberID)); }
  }, 50);
};
