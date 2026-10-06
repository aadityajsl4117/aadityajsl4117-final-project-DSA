/* BOOK REQUEST & ACQUISITION FEATURE MODULE */
LuminaLibrary.prototype.renderBookRequest = function() {
  return `
    <div class="page-title-row">
      <div>
        <h1 class="page-heading">Book Request & Acquisition Pipeline</h1>
        <p class="page-subtext">Request unavailable titles, auto-add to waiting list, manage procurement & notify patrons upon arrival</p>
      </div>
      <button class="btn btn-primary" onclick="app.openModal('user-book-request')">+ Submit Book Request</button>
    </div>

    <div class="content-card">
      <div class="card-header-bar">
        <h3>Requested & Procurement Titles (${this.bookRequests.length} Total)</h3>
        <span class="badge badge-purple">Integrated Acquisition Engine</span>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Book Title & Author</th>
            <th>Requested By</th>
            <th>Reason / Syllabus</th>
            <th>Date</th>
            <th>Status</th>
            <th>Librarian Workflow</th>
          </tr>
        </thead>
        <tbody>
          ${this.bookRequests.map(r => `
            <tr>
              <td><code>${r.requestID}</code></td>
              <td><strong>${r.title}</strong><br><small style="color:var(--text-muted);">${r.author || 'Author unspecified'}</small></td>
              <td><strong>${r.memberName}</strong><br><small style="color:var(--text-muted);">${r.memberEmail}</small></td>
              <td>${r.reason}</td>
              <td>${r.dateRequested}</td>
              <td>
                <span class="badge ${r.status === 'ARRIVED_NOTIFIED' ? 'badge-success' : (r.status === 'ORDERED' ? 'badge-primary' : 'badge-warning')}">
                  ${r.status}
                </span>
              </td>
              <td>
                <div style="display:flex; gap:6px;">
                  ${r.status === 'PENDING' ? `
                    <button class="btn btn-sm" onclick="app.updateBookRequestStatus('${r.requestID}', 'ORDERED')">Mark Ordered</button>
                  ` : ''}
                  ${r.status === 'ORDERED' || r.status === 'PENDING' ? `
                    <button class="btn btn-sm btn-primary" onclick="app.markBookArrivedAndNotify('${r.requestID}')">📦 Mark Arrived & Notify Member</button>
                  ` : '<span style="color:var(--success); font-weight:700; font-size:0.8rem;">Fulfilled & Notified ✅</span>'}
                </div>
              </td>
            </tr>
          `).join('') || `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No book requests submitted yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
};

LuminaLibrary.prototype.handleUserBookRequestForm = async function(e) {
  e.preventDefault();
  const title = document.getElementById("ubr-title").value.trim();
  const author = document.getElementById("ubr-author").value.trim();
  const memberID = document.getElementById("ubr-member").value;
  const reason = document.getElementById("ubr-reason").value.trim();

  try {
    if (window.LuminaAPI) {
      await window.LuminaAPI.submitBookRequest({ memberID, title, author, reason });
      this.showToast(`Book request for '${title}' submitted (Saved in DB)!`);
      this.closeModal();
      await this.loadState();
      return;
    }
  } catch (err) {
    this.showToast(err.message || "Failed to save book request in database", true);
    return;
  }

  // Fallback
  const member = this.findMember(memberID);
  const newReq = {
    requestID: `REQ-${Math.floor(100 + Math.random() * 900)}`,
    title,
    author,
    memberID,
    memberName: member ? member.name : memberID,
    reason,
    dateRequested: this.todayStr,
    status: "PENDING"
  };
  this.bookRequests.unshift(newReq);
  this.showToast(`Book request for '${title}' submitted!`);
  this.closeModal();
  this.saveState();
  this.render();
};

LuminaLibrary.prototype.updateBookRequestStatus = function(reqID, newStatus) {
  const req = this.bookRequests.find(r => r.requestID === reqID);
  if (req) {
    req.status = newStatus;
    this.logHistory("UPDATE_REQUEST", "BOOK_REQUEST", { description: `Updated request ${reqID} status to ${newStatus}.` });
    this.showToast(`Request ${reqID} marked as ${newStatus}.`);
    this.saveState();
    this.render();
  }
};

LuminaLibrary.prototype.markBookArrivedAndNotify = function(reqID) {
  const req = this.bookRequests.find(r => r.requestID === reqID);
  if (!req) return;

  req.status = "ARRIVED_NOTIFIED";
  const member = this.findMember(req.memberID);

  this.logHistory("BOOK_ARRIVED", "BOOK_REQUEST", {
    memberID: req.memberID,
    memberName: req.memberName,
    description: `Requested book '${req.title}' has arrived and member was notified.`
  });

  if (member) {
    this.sendLibraryEmail({
      member,
      subject: `Requested Book Has Arrived: ${req.title}`,
      message: `Dear ${req.memberName},\n\nYour requested volume '${req.title}' has arrived at Lumina Central Library.\nIt is reserved at the desk for your pickup.`,
      book_name: req.title,
      status: "BOOK_ARRIVAL"
    });
  }

  this.showToast(`Marked '${req.title}' as arrived! Notification sent.`);
  this.saveState();
  this.render();
};
