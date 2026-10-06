/**
 * MASTER AUDIT LOG
 * Server-side search / filter / pagination against GET /api/audit,
 * with an offline fallback over the locally cached history.
 */

LuminaLibrary.prototype.auditState = {
  q: "", module: "ALL", action: "ALL", status: "ALL", from: "", to: "",
  page: 1, limit: 25,
  data: null, loading: false, error: null, loaded: false, totalAll: null,
  modules: [], actions: [], searchTimer: null
};

LuminaLibrary.prototype.auditEsc = function(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};

LuminaLibrary.prototype.auditActionBadge = function(h) {
  const a = String(h.action || "");
  let cls = "badge-primary";
  if (h.status && h.status !== "SUCCESS") cls = "badge-danger";
  else if (/DELETE|DEACTIVATE|CANCEL|REFUND/.test(a)) cls = "badge-danger";
  else if (/UNDO|EDIT|UPDATE|RENEW/.test(a)) cls = "badge-warning";
  else if (/RETURN|PAYMENT|DEPOSIT|ADD|CREATE|ISSUE|JOIN|SERVE|GRANT/.test(a)) cls = "badge-success";
  else if (/LOGIN|LOGOUT|SYSTEM/.test(a)) cls = "badge-muted";
  return `<span class="badge ${cls}">${this.auditEsc(a.replace(/_/g, " "))}</span>`;
};

/* ---------- page shell (filters live outside the results container so typing is never lost) ---------- */
LuminaLibrary.prototype.renderHistory = function() {
  const st = this.auditState;
  if (!st.loaded && !st.loading) setTimeout(() => this.loadAuditLogs(), 0);

  const opt = (list, cur, allLabel) =>
    `<option value="ALL">${allLabel}</option>` +
    list.map(x => `<option value="${this.auditEsc(x)}" ${x === cur ? "selected" : ""}>${this.auditEsc(x.replace(/_/g, " "))}</option>`).join("");

  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Master Audit Log & System History</h1>
        <p class="page-subtext">Append-only record of checkouts, returns, fines, deposits, profile edits, catalog changes and sign-ins</p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" onclick="app.loadAuditLogs()">🔄 Refresh</button>
        <button class="btn btn-primary" onclick="app.exportHistoryCSV()">📥 Export CSV</button>
      </div>
    </div>

    <div id="audit-summary" class="audit-summary"></div>

    <div class="content-card">
      <div class="audit-toolbar">
        <input type="search" id="audit-q" placeholder="Search member, book, transaction, description…" value="${this.auditEsc(st.q)}" oninput="app.onAuditSearchInput(this.value)">
        <select id="audit-module" onchange="app.setAuditFilter('module', this.value)">${opt(st.modules, st.module, "All modules")}</select>
        <select id="audit-action" onchange="app.setAuditFilter('action', this.value)">${opt(st.actions, st.action, "All actions")}</select>
        <select id="audit-status" onchange="app.setAuditFilter('status', this.value)">
          <option value="ALL">All results</option>
          <option value="SUCCESS" ${st.status === "SUCCESS" ? "selected" : ""}>Success</option>
          <option value="FAILED" ${st.status === "FAILED" ? "selected" : ""}>Failed</option>
        </select>
        <label class="audit-date">From <input type="date" id="audit-from" value="${this.auditEsc(st.from)}" onchange="app.setAuditFilter('from', this.value)"></label>
        <label class="audit-date">To <input type="date" id="audit-to" value="${this.auditEsc(st.to)}" onchange="app.setAuditFilter('to', this.value)"></label>
        <button class="btn" onclick="app.resetAuditFilters()">Clear</button>
      </div>
      <div id="audit-results">${this.renderAuditResults()}</div>
    </div>
  `;
};

/* ---------- results table + pager ---------- */
LuminaLibrary.prototype.renderAuditResults = function() {
  const st = this.auditState;
  if (st.loading && !st.data) {
    return `<div class="audit-empty">Loading audit ledger…</div>`;
  }
  if (st.error && !st.data) {
    return `<div class="audit-empty" style="color:var(--danger);">${this.auditEsc(st.error)}</div>`;
  }
  const d = st.data;
  if (!d) return `<div class="audit-empty">Loading audit ledger…</div>`;

  const rows = d.logs.map(h => `
    <tr>
      <td><code>${this.auditEsc(h.historyID)}</code></td>
      <td style="white-space:nowrap;">${this.auditEsc(h.timestamp)}</td>
      <td>${this.auditActionBadge(h)}</td>
      <td>${this.auditEsc(String(h.module || "").replace(/_/g, " "))}</td>
      <td>${h.memberID && h.memberID !== "N/A"
            ? `${this.auditEsc(h.memberName)} <small style="color:var(--text-muted);">(${this.auditEsc(h.memberID)})</small>`
            : `<span style="color:var(--text-muted);">${this.auditEsc(h.memberName || "System")}</span>`}</td>
      <td>
        <strong>${this.auditEsc(h.description)}</strong>
        ${h.bookTitle && h.bookTitle !== "N/A" ? `<br><small style="color:var(--text-muted);">📖 ${this.auditEsc(h.bookTitle)}${h.transactionID && h.transactionID !== "N/A" ? " · " + this.auditEsc(h.transactionID) : ""}</small>` : (h.transactionID && h.transactionID !== "N/A" ? `<br><small style="color:var(--text-muted);">${this.auditEsc(h.transactionID)}</small>` : "")}
        ${h.oldValue && h.oldValue !== "N/A" ? `<br><small class="audit-diff">From: ${this.auditEsc(h.oldValue)} ➔ To: ${this.auditEsc(h.newValue)}</small>` : ""}
      </td>
    </tr>`).join("");

  const from = d.total === 0 ? 0 : (d.page - 1) * d.limit + 1;
  const to = Math.min(d.total, d.page * d.limit);

  return `
    <div class="audit-table-wrap">
      <table class="custom-table">
        <thead>
          <tr><th>Log ID</th><th>Timestamp</th><th>Action</th><th>Module</th><th>Patron</th><th>Details & Changes</th></tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6" style="text-align:center; padding:28px; color:var(--text-muted);">No audit records match the current filters.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="audit-pager">
      <span>Showing <strong>${from}–${to}</strong> of <strong>${d.total}</strong> record${d.total === 1 ? "" : "s"}</span>
      <span style="display:flex; align-items:center; gap:8px;">
        <button class="btn" ${d.page <= 1 ? "disabled" : ""} onclick="app.goAuditPage(${d.page - 1})">‹ Prev</button>
        <span>Page ${d.page} / ${d.pages}</span>
        <button class="btn" ${d.page >= d.pages ? "disabled" : ""} onclick="app.goAuditPage(${d.page + 1})">Next ›</button>
        <select onchange="app.setAuditLimit(this.value)" title="Rows per page">
          ${[10, 25, 50, 100].map(n => `<option value="${n}" ${n === d.limit ? "selected" : ""}>${n} / page</option>`).join("")}
        </select>
      </span>
    </div>
  `;
};

LuminaLibrary.prototype.renderAuditSummary = function() {
  const el = document.getElementById("audit-summary");
  const d = this.auditState.data;
  if (!el || !d) return;
  const card = (label, val, color) => `<div class="audit-stat"><div class="audit-stat-val" style="color:${color};">${val}</div><div class="audit-stat-label">${label}</div></div>`;
  el.innerHTML =
    card("Total records", d.summary.all, "var(--text-main)") +
    card("Logged today", d.summary.today, "#1d4ed8") +
    card("Failed events", d.summary.failed, d.summary.failed ? "#b91c1c" : "#15803d") +
    card("Matching filters", d.total, "#7c3aed");
};

/* ---------- data loading ---------- */
LuminaLibrary.prototype.auditQueryParams = function() {
  const st = this.auditState;
  return { q: st.q.trim(), module: st.module, action: st.action, status: st.status, from: st.from, to: st.to, page: st.page, limit: st.limit };
};

LuminaLibrary.prototype.loadAuditLogs = async function() {
  const st = this.auditState;
  st.loading = true;
  st.error = null;
  try {
    if (!window.LuminaAPI || typeof window.LuminaAPI.getAudit !== "function") throw new Error("offline");
    const res = await window.LuminaAPI.getAudit(this.auditQueryParams());
    st.data = res;
    st.page = res.page;
    st.modules = res.modules || [];
    st.actions = res.actions || [];
    st.totalAll = res.summary ? res.summary.all : null;
    st.offline = false;
  } catch (err) {
    // Offline fallback: filter the locally cached history
    st.data = this.localAuditQuery();
    st.offline = true;
    st.modules = st.data.modules;
    st.actions = st.data.actions;
  }
  st.loading = false;
  st.loaded = true;
  this.updateBadgeCounts();
  if (this.currentView === "history") this.refreshAuditView();
};

LuminaLibrary.prototype.refreshAuditView = function() {
  const st = this.auditState;
  const results = document.getElementById("audit-results");
  if (!results) return;
  results.innerHTML = this.renderAuditResults();
  this.renderAuditSummary();
  // keep dropdown choices in sync with values present in the ledger
  const fill = (id, list, cur, allLabel) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="ALL">${allLabel}</option>` +
      list.map(x => `<option value="${this.auditEsc(x)}" ${x === cur ? "selected" : ""}>${this.auditEsc(x.replace(/_/g, " "))}</option>`).join("");
  };
  fill("audit-module", st.modules, st.module, "All modules");
  fill("audit-action", st.actions, st.action, "All actions");
  if (st.offline) {
    results.insertAdjacentHTML("afterbegin", `<div class="audit-offline">⚠️ Server unreachable — showing locally cached records only.</div>`);
  }
};

LuminaLibrary.prototype.localAuditQuery = function() {
  const st = this.auditState;
  const all = this.history || [];
  const q = st.q.trim().toLowerCase();
  const filtered = all.filter(h => {
    if (st.module !== "ALL" && h.module !== st.module) return false;
    if (st.action !== "ALL" && h.action !== st.action) return false;
    if (st.status !== "ALL" && (h.status || "SUCCESS") !== st.status) return false;
    const day = String(h.timestamp || "").slice(0, 10);
    if (st.from && day && day < st.from) return false;
    if (st.to && day && day > st.to) return false;
    if (q) {
      const hay = [h.historyID, h.action, h.module, h.memberID, h.memberName, h.bookID, h.bookTitle, h.transactionID, h.description].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / st.limit));
  const page = Math.min(st.page, pages);
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: filtered.length, page, pages, limit: st.limit,
    logs: filtered.slice((page - 1) * st.limit, page * st.limit),
    modules: [...new Set(all.map(h => h.module))].sort(),
    actions: [...new Set(all.map(h => h.action))].sort(),
    summary: {
      all: all.length,
      today: all.filter(h => String(h.timestamp || "").startsWith(today)).length,
      failed: all.filter(h => (h.status || "SUCCESS") !== "SUCCESS").length
    }
  };
};

/* ---------- filter handlers ---------- */
LuminaLibrary.prototype.onAuditSearchInput = function(value) {
  const st = this.auditState;
  st.q = value;
  clearTimeout(st.searchTimer);
  st.searchTimer = setTimeout(() => { st.page = 1; this.loadAuditLogs(); }, 300);
};

LuminaLibrary.prototype.setAuditFilter = function(key, value) {
  this.auditState[key] = value;
  this.auditState.page = 1;
  this.loadAuditLogs();
};

LuminaLibrary.prototype.setAuditLimit = function(value) {
  this.auditState.limit = parseInt(value, 10) || 25;
  this.auditState.page = 1;
  this.loadAuditLogs();
};

LuminaLibrary.prototype.goAuditPage = function(page) {
  this.auditState.page = Math.max(1, page);
  this.loadAuditLogs();
};

LuminaLibrary.prototype.resetAuditFilters = function() {
  Object.assign(this.auditState, { q: "", module: "ALL", action: "ALL", status: "ALL", from: "", to: "", page: 1 });
  ["audit-q", "audit-from", "audit-to"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  ["audit-module", "audit-action", "audit-status"].forEach(id => { const el = document.getElementById(id); if (el) el.value = "ALL"; });
  this.loadAuditLogs();
};

/* ---------- CSV export (respects the active filters) ---------- */
LuminaLibrary.prototype.exportHistoryCSV = async function() {
  const fileName = `lumina_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
  const download = blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  try {
    const params = this.auditQueryParams();
    delete params.page; delete params.limit;
    const blob = await window.LuminaAPI.exportAudit(params);
    download(blob);
    this.showToast("Audit ledger exported.");
    return;
  } catch (err) { /* fall through to local export */ }

  const data = this.localAuditQuery();
  const all = (this.history || []);
  if (all.length === 0) { this.showToast("No history records to export.", true); return; }
  const cell = v => {
    let t = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const headers = ["History ID", "Timestamp", "Action", "Module", "Status", "Member ID", "Member Name", "Book ID", "Book Title", "Transaction ID", "Description", "Old Value", "New Value"];
  const st = this.auditState;
  const saved = st.limit; st.limit = Math.max(all.length, 1); st.page = 1;
  const full = this.localAuditQuery().logs;
  st.limit = saved;
  const lines = [headers.map(cell).join(",")].concat(full.map(h =>
    [h.historyID, h.timestamp, h.action, h.module, h.status || "SUCCESS", h.memberID, h.memberName, h.bookID, h.bookTitle, h.transactionID, h.description, h.oldValue, h.newValue].map(cell).join(",")));
  download(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  this.showToast("Exported cached audit records (server offline).");
};
