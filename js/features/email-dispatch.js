/* EMAIL DISPATCH CENTER FEATURE MODULE */
LuminaLibrary.prototype.renderEmailDispatch = function() {
  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Real-Time Email Dispatch Center</h1>
        <p class="page-subtext">Live EmailJS audit trail for registration receipts, due date alerts, and book arrival alerts</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn" onclick="app.sendUpcomingReturnReminders()">Send Near Due Reminders</button>
        <button class="btn btn-primary" onclick="app.sendDailyOverdueReminders()">Run Batch Overdue Alert</button>
      </div>
    </div>

    <div class="content-card">
      <div class="card-header-bar">
        <h3>System Dispatch Log (${this.outbox.length} Messages)</h3>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th>Message ID</th>
            <th>Recipient</th>
            <th>Category</th>
            <th>Subject Header</th>
            <th>Sent Time</th>
            <th>Status</th>
            <th>Preview</th>
          </tr>
        </thead>
        <tbody>
          ${this.outbox.map(email => `
            <tr>
              <td><code>${email.emailID}</code></td>
              <td><strong>${email.recipientName}</strong><br><small style="color:var(--text-muted);">${email.recipient}</small></td>
              <td>
                <span class="badge ${email.type === 'REGISTRATION' ? 'badge-success' : (email.type === 'OVERDUE' ? 'badge-danger' : (email.type === 'BOOK_ARRIVAL' ? 'badge-purple' : 'badge-warning'))}">
                  ${email.type}
                </span>
              </td>
              <td>${email.subject}</td>
              <td>${email.timestamp}</td>
              <td><span class="badge ${email.status === 'DELIVERED' ? 'badge-success' : 'badge-danger'}">${email.status}</span></td>
              <td><button class="btn btn-sm" onclick="app.previewEmail('${email.emailID}')">Read Message</button></td>
            </tr>
          `).join('') || `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No emails dispatched in this session yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
};

LuminaLibrary.prototype.previewEmail = function(emailID) {
  const email = this.outbox.find(e => e.emailID === emailID);
  if (!email) return;

  const modal = document.getElementById("app-modal");
  const dialog = document.getElementById("modal-content");

  dialog.innerHTML = `
    <div style="padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:12px; margin-bottom:16px;">
        <div>
          <span class="badge badge-primary">${email.type}</span>
          <h2 style="font-size:1.15rem; font-weight:800; margin-top:4px;">${email.subject}</h2>
        </div>
        <span style="font-size:0.75rem; color:var(--text-muted);">${email.timestamp}</span>
      </div>

      <div style="background:var(--bg-card-subtle); padding:16px; border-radius:var(--radius-sm); font-size:0.85rem; line-height:1.6; margin-bottom:20px; white-space:pre-wrap; font-family:var(--font-main);">
<strong>To:</strong> ${email.recipientName} &lt;${email.recipient}&gt;
<strong>Status:</strong> <span style="color:${email.status==='DELIVERED'?'var(--success)':'var(--danger)'}; font-weight:700;">${email.status}</span>

${email.body}
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-primary" onclick="app.closeModal()">Close Preview</button>
      </div>
    </div>
  `;
  modal.style.display = "grid";
};
